export function addCodeCopyButtons() {
  for (const pre of document.querySelectorAll<HTMLPreElement>('.prose pre')) {
    const code = pre.querySelector('code');
    if (!code || pre.parentElement?.classList.contains('code-block')) continue;

    const wrapper = document.createElement('div');
    wrapper.className = 'code-block';
    const toolbar = document.createElement('div');
    toolbar.className = 'code-toolbar';
    const status = document.createElement('span');
    status.setAttribute('role', 'status');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'code-copy';
    button.textContent = 'Copy';
    button.setAttribute('aria-label', 'Copy code');
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('width', '16');
    icon.setAttribute('height', '16');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', '1.8');
    icon.setAttribute('aria-hidden', 'true');
    icon.setAttribute('focusable', 'false');
    const back = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    back.setAttribute('d', 'M8 16H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2');
    const front = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    front.setAttribute('x', '8');
    front.setAttribute('y', '8');
    front.setAttribute('width', '12');
    front.setAttribute('height', '12');
    front.setAttribute('rx', '2');
    icon.append(back, front);
    button.prepend(icon);

    button.addEventListener('click', async () => {
      button.disabled = true;
      status.textContent = '';
      try {
        await navigator.clipboard.writeText(code.textContent ?? '');
        status.textContent = 'Copied!';
      } catch (error) {
        console.error('Could not copy code to the clipboard.', error);
        status.textContent = 'Could not copy. Select the code and copy it manually.';
      } finally {
        button.disabled = false;
      }
    });

    toolbar.append(status, button);
    pre.before(wrapper);
    wrapper.append(toolbar, pre);
  }
}
