# MimeKit & MailKit Blog

An Astro static blog for **https://blog.mimekit.net**, styled to match the new
MimeKit website: slate-blue hero, blue accents, system fonts, and automatic
light/dark mode. No database is required; a small client-side script adds
copy buttons to code blocks.

## Local development

Use Node.js 24 LTS (Astro requires Node.js 22.23.4 or newer).

```sh
npm ci
npm run dev
```

Open the local URL printed by Astro (normally `http://localhost:4321`).

```sh
npm test         # Type-check, build, and check production output
npm run build   # Type-check and generate dist/
npm run preview # Serve the production build locally (no drafts)
```

## Writing posts

Add a Markdown file under `src/content/posts`. Its filename becomes its URL:
`my-article.md` is published at `/posts/my-article/`. Keep filenames lowercase
and hyphenated, and avoid renaming published files without arranging redirects.

```yaml
---
title: "Your article title"
description: "A short summary for the index, feed, and search engines."
pubDate: 2026-11-06
tags: ["MimeKit", "MailKit"]
draft: true
---
```

Write the article below the frontmatter. Use `##` for sections (the page already
renders the title as its `h1`) and fenced code blocks with a language such as
`csharp`, `xml`, or `bash` for syntax highlighting. Articles with multiple
second-level headings get an automatic table of contents.

- Drafts appear in `npm run dev`, with a preview banner and `noindex`.
- Drafts are excluded from production pages, the sitemap, and RSS. RSS excludes
  drafts even in development.
- Set `draft: false` (or remove it) to publish. Dates are displayed in UTC;
  `pubDate` controls ordering, **not scheduled publication**.
- Optionally add `updatedDate: 2026-11-07` when revising an article.
- Put images in `public/images` and reference them as `/images/filename.png`,
  with meaningful alt text.

`welcome.md` is a small published starter; edit or remove it before launch.
`building-a-message.md` is a draft demonstrating C# and article formatting.
The output checks in `test/build.test.mjs` reference these starters; update the
checks if you rename, remove, or publish them.

Site-wide title, description, and author live in `src/consts.ts`. Layout and
colors live in `src/layouts/BaseLayout.astro` and `src/styles/site.css`.
The icons are copied from the sibling MimeKit website; there is no build-time
dependency on that checkout.

## GitHub Pages deployment

The included workflow checks pull requests and deploys pushes to `master`.
Deployment requires this one-time setup; no GitHub settings or DNS records
have been changed by this scaffold:

1. In the repository's **Settings > Pages**, set **Source** to **GitHub Actions**.
2. Set the Pages **Custom domain** to `blog.mimekit.net`. For Actions
   deployments, configure this setting explicitly; `public/CNAME` alone is
   not a substitute.
3. At your DNS provider, add a **CNAME** record for `blog` pointing to
   `jstedfast.github.io` (not a URL or repository path). Remove any conflicting
   records for that same hostname; leave the main website's records alone.
4. Commit and push the blog to `master`, then check the **Actions** tab.
5. Once GitHub has verified DNS and issued a certificate, enable **Enforce HTTPS**
   in Pages settings.

Consider [verifying your domain with GitHub](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages)
before connecting DNS. Domain verification helps prevent domain takeover.

The custom domain is also configured in `astro.config.mjs` and `public/CNAME`.
There is intentionally no repository-name `base` path. RSS is at `/rss.xml`,
and the sitemap is at `/sitemap-index.xml`.

To use another static host, run `npm run build` and deploy `dist/`, preserving
directory-index URLs and serving `404.html` for missing pages. Disable or remove
the Pages workflow if you do not use GitHub Pages.
