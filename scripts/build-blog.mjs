#!/usr/bin/env node
/**
 * Vantelyo — build/patch the static article pages from _data/blog.json.
 *
 * The static article pages in blog/*.html are the SEO-critical source of truth
 * for published articles (headings, structured data, canonical URLs).
 * blog/index.html reads _data/blog.json live for listings; the individual page
 * files are NOT regenerated automatically by GitHub Pages.
 *
 * This script is the bridge. It surgically rewrites ONLY the fields derived
 * from blog.json (title, description, dates, image, category, body...).
 * Hand-authored sections that live only in the static files — related reading,
 * localized chrome, article structure — are preserved untouched.
 *
 * Usage:
 *   node scripts/build-blog.mjs            # read-only check (CI-friendly, exit 1 if stale)
 *   node scripts/build-blog.mjs --write    # patch in place + report
 *   node scripts/build-blog.mjs --out DIR  # write all pages into DIR (testing)
 *   node scripts/build-blog.mjs --check    # same as default (explicit)
 *
 * No dependencies. Node >= 16.
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const OUT = process.argv.includes('--out')
  ? path.resolve(process.argv[process.argv.indexOf('--out') + 1])
  : null;
// Safe-by-default: no flag ⇒ read-only staleness check (no files written).
const WRITE = process.argv.includes('--write');
const CHECK = process.argv.includes('--check') || (!OUT && !WRITE);

const SITE = 'https://vantelyo.online';
const HANDLED_LANGS = new Set(['en', 'fr', 'ar']);

const read = (p) => fs.readFileSync(p, 'utf8');

const attrEsc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
const textEsc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
const jsonEsc = (s) =>
  String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[\u0000-\u001f]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

const LOCALE_DATE_OPTS = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' };
const localeDate = (iso, lang) =>
  new Intl.DateTimeFormat(
    lang === 'fr' ? 'fr-FR' : lang === 'ar' ? 'ar' : 'en-US',
    LOCALE_DATE_OPTS
  ).format(new Date(iso + 'T00:00:00Z'));
const localeOf = (lang) => (lang === 'fr' ? 'fr_FR' : lang === 'ar' ? 'ar_AR' : 'en_US');
const fileUrl = (slug) => `${SITE}/blog/${slug}.html`;

const eolOf = (s) => (s.includes('\r\n') ? '\r\n' : '\n');
const normalizeEol = (s, eol) => s.replace(/\r\n/g, '\n');
const restoreEol = (s, eol) => (eol === '\r\n' ? s.replace(/\n/g, '\r\n') : s);

function rep(html, re, replacement, label) {
  if (!re.test(html)) throw new Error(`Not found: ${label}`);
  const repl = typeof replacement === 'function' ? replacement : () => replacement;
  return html.replace(re, repl);
}

function patch(file, post) {
  const eol = eolOf(read(file));
  let html = normalizeEol(read(file), eol);
  const base = path.basename(file);

  // --- <title> ---
  html = rep(html, /<title>[^<]*<\/title>/, `<title>${textEsc(post.title)} — Vantelyo</title>`, 'title');

  // --- meta description / author / robots unchanged ---
  html = rep(html, /<meta name="description" content="[^"]*">/, `<meta name="description" content="${attrEsc(post.excerpt)}">`, 'description');

  // --- canonical ---
  html = rep(html, /<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${fileUrl(post.slug)}">`, 'canonical');

  // --- hreflang group (from <link rel="alternate" ... up to og:site_name) ---
  const altStartRaw = html.indexOf('<link rel="alternate" hreflang=');
  const altEndRaw = html.indexOf('<meta property="og:site_name"');
  if (altStartRaw === -1 || altEndRaw === -1 || altStartRaw >= altEndRaw) {
    throw new Error(`hreflang block not found in ${base}`);
  }
  const altStart = html.lastIndexOf('\n', altStartRaw) + 1;
  const altEnd = html.lastIndexOf('\n', altEndRaw) + 1;
  const alternates = Array.isArray(post.alternates) ? post.alternates : [];
  const enPost = alternates.find((a) => a.lang === 'en');
  const xDefaultSlug = enPost ? enPost.slug : post.slug;
  const altLines = alternates.map(
    (a) => `<link rel="alternate" hreflang="${a.lang}" href="${fileUrl(a.slug)}">`
  );
  altLines.push(`<link rel="alternate" hreflang="${post.lang}" href="${fileUrl(post.slug)}">`);
  altLines.push(`<link rel="alternate" hreflang="x-default" href="${fileUrl(xDefaultSlug)}">`);
  const block = altLines.map((l) => `  ${l}`).join('\n') + '\n';
  html = html.slice(0, altStart) + block + html.slice(altEnd);

  // --- Open Graph ---
  html = rep(html, /<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${attrEsc(post.title)}">`, 'og:title');
  html = rep(html, /<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${attrEsc(post.excerpt)}">`, 'og:description');
  html = rep(html, /<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${fileUrl(post.slug)}">`, 'og:url');
  html = rep(html, /<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${attrEsc(post.image)}">`, 'og:image');
  html = rep(html, /<meta property="og:image:alt" content="[^"]*">/, `<meta property="og:image:alt" content="${attrEsc(post.title)}">`, 'og:image:alt');
  html = rep(html, /<meta property="og:locale" content="[^"]*">/, `<meta property="og:locale" content="${localeOf(post.lang)}">`, 'og:locale');

  // --- Twitter ---
  html = rep(html, /<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${attrEsc(post.title)}">`, 'twitter:title');
  html = rep(html, /<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${attrEsc(post.excerpt)}">`, 'twitter:description');
  html = rep(html, /<meta name="twitter:image" content="[^"]*">/, `<meta name="twitter:image" content="${attrEsc(post.image)}">`, 'twitter:image');

  // --- JSON-LD BlogPosting ---
  const blogPosting =
    `<script type="application/ld+json">{"@context":"https://schema.org","@type":"BlogPosting",` +
    `"headline":"${jsonEsc(post.title)}","description":"${jsonEsc(post.excerpt)}",` +
    `"image":"${jsonEsc(post.image)}","datePublished":"${jsonEsc(post.date)}","dateModified":"${jsonEsc(post.updated)}",` +
    `"inLanguage":"${post.lang}","articleSection":"${jsonEsc(post.categoryLabel)}",` +
    `"author":{"@type":"Organization","name":"Vantelyo"},` +
    `"publisher":{"@type":"Organization","name":"Vantelyo","logo":{"@type":"ImageObject","url":"${SITE}/assets/img/logo.svg"}},` +
    `"mainEntityOfPage":{"@type":"WebPage","@id":"${fileUrl(post.slug)}"}}` +
    `</script>`;
  html = rep(html, /<script type="application\/ld\+json">\{\s*"@context":"https:\/\/schema.org","@type":"BlogPosting"[\s\S]*?<\/script>/, () => blogPosting, 'BlogPosting');

  // --- JSON-LD BreadcrumbList ---
  const breadcrumb =
    `<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList",` +
    `"itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"${SITE}/"},` +
    `{"@type":"ListItem","position":2,"name":"Blog","item":"${SITE}/blog/"},` +
    `{"@type":"ListItem","position":3,"name":"${jsonEsc(post.title)}","item":"${fileUrl(post.slug)}"}]}` +
    `</script>`;
  html = rep(html, /<script type="application\/ld\+json">\{\s*"@context":"https:\/\/schema.org","@type":"BreadcrumbList"[\s\S]*?<\/script>/, () => breadcrumb, 'BreadcrumbList');

  // --- <h1> ---
  html = rep(html, /<h1>[^<]*<\/h1>/, `<h1>${textEsc(post.title)}</h1>`, 'h1');

  // --- Article meta block ---
  const meta =
    `<div class="article-meta">\n` +
    `              <span class="article-category">${textEsc(post.categoryLabel)}</span>\n` +
    `              <span>${localeDate(post.date, post.lang)}</span>\n` +
    `              <span>${textEsc(post.readTime)}</span>\n` +
    `              <span data-i18n="publishedBy">Published by</span>\n` +
    `              <span>Vantelyo</span>\n` +
    `            </div>`;
  html = rep(html, /<div class="article-meta">[\s\S]*?<\/div>/, () => meta, 'article-meta');

  // --- lang-alt anchors ---
  const altLabels = { en: 'Read in English →', fr: 'Lire en français →', ar: 'اقرأ بالعربية →' };
  const altLinks = alternates
    .map((a) => `<a class="lang-alt" href="${a.slug}.html">${altLabels[a.lang] || a.slug}</a>`)
    .join(' ');
  html = html.replace(
    /<a class="lang-alt"[^>]*>[\s\S]*?<\/a>(\s*<a class="lang-alt"[^>]*>[\s\S]*?<\/a>)*/,
    () => altLinks
  );

  // --- Cover image ---
  html = rep(html, /<img class="article-cover"[^>]*>/, `<img class="article-cover" src="${attrEsc(post.image)}" alt="${attrEsc(post.title)}" loading="eager">`, 'cover');

  // --- Article body (content is trusted, authored HTML) ---
  const bodyMarkup =
    `<div class="article-body">\n            ${post.content}\n          </div>`;
  const bodyRe = /<div class="article-body">[\s\S]*?<\/div>/;
  if (!bodyRe.test(html)) throw new Error(`article-body not found in ${base}`);
  html = rep(html, bodyRe, bodyMarkup, 'article-body');

  // --- altMap (browser lang-button navigation) ---
  const altMap = {};
  for (const a of alternates) altMap[a.lang] = `${a.slug}.html`;
  const altMapRe = /var altMap = \{[^}]*\};/;
  if (altMapRe.test(html)) {
    html = html.replace(altMapRe, `var altMap = ${JSON.stringify(altMap)};`);
  }

  return restoreEol(html, eol);
}

function main() {
  const blog = JSON.parse(read(path.join(ROOT, '_data', 'blog.json')));
  const posts = Array.isArray(blog.posts) ? blog.posts : [];
  const staticPosts = posts.filter((p) => p && p.static === true);

  const results = [];
  for (const post of staticPosts) {
    if (!HANDLED_LANGS.has(post.lang)) {
      console.warn(`SKIP ${post.slug}: unsupported lang ${post.lang}`);
      continue;
    }
    const src = path.join(ROOT, 'blog', `${post.slug}.html`);
    if (!fs.existsSync(src)) {
      console.warn(`MISSING ${src} — skipped`);
      continue;
    }
    const original = read(src);
    const patched = patch(src, post);

    if (CHECK) {
      const changed = patched !== original;
      results.push({ file: `blog/${post.slug}.html`, changed });
      console.log(`${changed ? 'STALE' : 'ok'}  blog/${post.slug}.html`);
      continue;
    }

    const target = OUT ? path.join(OUT, 'blog', `${post.slug}.html`) : src;
    if (OUT) fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, patched, 'utf8');
    results.push({ file: `blog/${post.slug}.html`, changed: patched !== original });
    console.log(`${patched !== original ? 'wrote' : 'same'}  blog/${post.slug}.html`);
  }

  const changedCount = results.filter((r) => r.changed).length;
  console.log(`\n${changedCount} file(s) updated, ${results.length - changedCount} unchanged`);
  if (CHECK && changedCount > 0) {
    console.error('\nStale pages detected. Run `node scripts/build-blog.mjs --write` to rebuild.');
    process.exit(1);
  }
}

main();
