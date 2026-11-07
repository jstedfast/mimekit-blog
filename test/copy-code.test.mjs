import assert from 'node:assert/strict';
import test from 'node:test';
import { addCodeCopyButtons } from '../src/scripts/copy-code.ts';

function setup(t, clipboard, text = '  var message = new MimeMessage();\n\n  Send(message);\n') {
  const elements = [];
  const pre = {
    parentElement: null,
    querySelector: () => ({ textContent: text }),
    before(wrapper) { this.wrapper = wrapper; },
  };
  const document = {
    querySelectorAll: () => [pre],
    createElementNS(namespace, tag) {
      const element = this.createElement(tag);
      element.namespaceURI = namespace;
      return element;
    },
    createElement(tag) {
      const element = {
        tag,
        attributes: {},
        children: [],
        listeners: {},
        classList: { contains: (name) => element.className === name },
        setAttribute(name, value) { this.attributes[name] = value; },
        addEventListener(name, listener) { this.listeners[name] = listener; },
        append(...children) {
          this.children.push(...children);
          for (const child of children) child.parentElement = this;
        },
        prepend(...children) {
          this.children.unshift(...children);
          for (const child of children) child.parentElement = this;
        },
      };
      elements.push(element);
      return element;
    },
  };
  for (const [name, value] of Object.entries({ document, navigator: { clipboard } })) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    });
  }
  return { pre, elements };
}

test('copy buttons preserve code whitespace and announce clipboard success', async (t) => {
  let copied;
  const { pre, elements } = setup(t, { writeText: async (text) => { copied = text; } });
  addCodeCopyButtons();
  const button = elements.find(({ tag }) => tag === 'button');
  const status = elements.find(({ tag }) => tag === 'span');
  assert.equal(button.type, 'button');
  assert.equal(button.attributes['aria-label'], 'Copy code');
  assert.equal(button.children[0].namespaceURI, 'http://www.w3.org/2000/svg');
  assert.equal(button.children[0].attributes['aria-hidden'], 'true');
  assert.equal(status.attributes.role, 'status');
  assert.equal(pre.wrapper.children[1], pre);
  const click = button.listeners.click();
  assert.equal(button.disabled, true);
  await click;
  assert.equal(copied, '  var message = new MimeMessage();\n\n  Send(message);\n');
  assert.equal(status.textContent, 'Copied!');
  assert.equal(button.disabled, false);
});

for (const [name, clipboard] of [
  ['clipboard permission is denied', { writeText: async () => { throw new Error('Permission denied'); } }],
  ['the clipboard API is unavailable', undefined],
]) {
  test(`copy failures are visible and retryable when ${name}`, async (t) => {
    const log = t.mock.method(console, 'error', () => {});
    const { elements } = setup(t, clipboard);
    addCodeCopyButtons();
    const button = elements.find(({ tag }) => tag === 'button');
    await button.listeners.click();
    assert.match(elements.find(({ tag }) => tag === 'span').textContent, /Could not copy.*manually/);
    assert.equal(button.disabled, false);
    assert.equal(log.mock.callCount(), 1);
  });
}

test('code controls are not duplicated and non-code preformatted text is untouched', (t) => {
  const { pre, elements } = setup(t, {});
  pre.querySelector = () => null;
  addCodeCopyButtons();
  assert.equal(elements.length, 0);
  pre.querySelector = () => ({ textContent: '' });
  addCodeCopyButtons();
  addCodeCopyButtons();
  assert.equal(elements.filter(({ tag }) => tag === 'button').length, 1);
});
