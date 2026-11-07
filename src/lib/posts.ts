import { getCollection } from 'astro:content';

export async function getPosts() {
  const posts = await getCollection('posts', ({ data }) =>
    import.meta.env.DEV || !data.draft,
  );

  return posts.sort((a, b) =>
    b.data.pubDate.valueOf() - a.data.pubDate.valueOf() || a.id.localeCompare(b.id),
  );
}

export function postUrl(id: string) {
  return `/posts/${id.split('/').map(encodeURIComponent).join('/')}/`;
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
