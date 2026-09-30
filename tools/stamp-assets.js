#!/usr/bin/env node
// Cache-busting for a zero-build site.
// Rewrites every local <script src> / <link href> in the HTML entry points to
// "path?v=<content-hash>", so browsers re-download a file only when it changed.
// Also stamps window.ASSET_VERSION (hash of data/archive/) for lazily loaded files.
// Usage: node tools/stamp-assets.js [--check]   (--check exits 1 if anything is stale)

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const check = process.argv.includes('--check');
const pages = ['index.html', 'projects/index.html'].filter(p => fs.existsSync(path.join(root, p)));

const hashOf = buf => crypto.createHash('sha1').update(buf).digest('hex').slice(0, 10);

function hashDir(rel) {
  const dir = path.join(root, rel);
  if (!fs.existsSync(dir)) return '0';
  const h = crypto.createHash('sha1');
  for (const f of fs.readdirSync(dir).sort()) h.update(f).update(fs.readFileSync(path.join(dir, f)));
  return h.digest('hex').slice(0, 10);
}

let stale = 0;
for (const page of pages) {
  const file = path.join(root, page);
  const src = fs.readFileSync(file, 'utf8');
  let out = src.replace(/(<(?:script|link)\b[^>]*?\s(?:src|href)=")([^"?#]+\.(?:js|css))(?:\?v=[\w]+)?(")/g, (all, pre, url, post) => {
    if (/^(https?:)?\/\//.test(url)) return all;
    const abs = path.join(root, url); // all pages are served from root-relative URLs (/projects is a rewrite)
    if (!fs.existsSync(abs)) { console.warn(`  ! ${page}: missing ${url}`); return all; }
    return `${pre}${url}?v=${hashOf(fs.readFileSync(abs))}${post}`;
  });
  if (page === 'index.html') {
    const tag = `<script>window.ASSET_VERSION = "${hashDir('data/archive')}";</script>`;
    out = /<script>window\.ASSET_VERSION = "[\w]*";<\/script>/.test(out)
      ? out.replace(/<script>window\.ASSET_VERSION = "[\w]*";<\/script>/, tag)
      : out.replace('</head>', `  ${tag}\n</head>`);
  }
  if (out !== src) {
    stale++;
    if (!check) fs.writeFileSync(file, out);
    console.log(`${check ? 'stale' : 'stamped'}: ${page}`);
  } else console.log(`up to date: ${page}`);
}
if (check && stale) process.exit(1);
