import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const dist = new URL('../dist/', import.meta.url);
const read = (path) => readFile(new URL(path, dist), 'utf8');

test('published articles have canonical URLs and appear in the index, RSS, and sitemap', async () => {
  const [home, article, rss, sitemap] = await Promise.all([
    read('index.html'),
    read('posts/welcome/index.html'),
    read('rss.xml'),
    read('sitemap-0.xml'),
  ]);
  assert.match(home, /href="\/posts\/welcome\/"/);
  assert.match(article, /rel="canonical" href="https:\/\/blog\.mimekit\.net\/posts\/welcome\/"/);
  assert.match(article, /property="og:type" content="article"/);
  assert.match(article, /November 6, 2026/);
  assert.match(rss, /<link>https:\/\/blog\.mimekit\.net\/posts\/welcome\/<\/link>/);
  assert.match(sitemap, /<loc>https:\/\/blog\.mimekit\.net\/posts\/welcome\/<\/loc>/);
});

test('drafts are excluded from every production output', async () => {
  const files = await readdir(dist, { recursive: true });
  assert.ok(!files.some((file) => file.includes('building-a-message')));
  for (const file of files.filter((file) => /\.(html|xml)$/.test(file))) {
    assert.doesNotMatch(await readFile(new URL(file.replaceAll('\\', '/'), dist), 'utf8'), /building-a-message|Draft preview/);
  }
});

test('custom-domain assets and crawl directives are generated', async () => {
  const [cname, robots, notFound, icon] = await Promise.all([
    read('CNAME'),
    read('robots.txt'),
    read('404.html'),
    readFile(new URL('favicon.png', dist)),
  ]);
  assert.equal(cname.trim(), 'blog.mimekit.net');
  assert.match(robots, /Sitemap: https:\/\/blog\.mimekit\.net\/sitemap-index\.xml/);
  assert.match(notFound, /name="robots" content="noindex, nofollow"/);
  assert.ok(icon.length > 0);
});
