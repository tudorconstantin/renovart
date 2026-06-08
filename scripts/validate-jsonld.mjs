// Zero-dependency Phase 3 dist/ verification gate (SEO-03/04/05, PAG-04/05, success criterion 4).
// Asserts, against the built dist/ tree:
//   1. Every <script type="application/ld+json"> block is valid JSON.
//   2. No <form> on the Contact page (locked constraint).
//   3. No leftover TODO / lorem ipsum / [TOKEN] placeholders in rendered HTML.
//   4. Expected schema node types appear on the correct pages, and the Twitter card shipped.
// Exits non-zero with a clear message on the first failure; prints ALL_PASS on success.
// Node 22.12+ ships fs.globSync (project engine floor; RESEARCH §Environment Availability).
import { readFileSync, globSync, existsSync } from 'node:fs';

const fail = (msg) => {
  console.error('FAIL:', msg);
  process.exit(1);
};

const files = globSync('dist/**/*.html');
if (files.length === 0) fail('no dist/**/*.html files — run `astro build` first');

// 1. Every JSON-LD block parses.
const re = /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g;
let ldCount = 0;
for (const f of files) {
  const html = readFileSync(f, 'utf8');
  let m;
  while ((m = re.exec(html)) !== null) {
    ldCount++;
    try {
      JSON.parse(m[1]);
    } catch (e) {
      fail(`invalid JSON-LD in ${f}: ${e.message}`);
    }
  }
}

// 2. No <form> on Contact.
const contact = 'dist/contact/index.html';
if (!existsSync(contact)) fail(`${contact} missing`);
if (/<form/i.test(readFileSync(contact, 'utf8'))) fail(`<form> present in ${contact}`);

// 3. No leftover placeholders anywhere in rendered HTML.
// WR-06: use SPECIFIC, prose-proof token markers that cannot legitimately appear in
// Romanian copy. The old `\bTODO\b` / `[TOKEN]` would false-FAIL on genuine prose that
// merely contains the English word "TODO" or any bracketed token. Authors should mark
// real placeholders with one of these explicit sentinels (e.g. `{{TODO}}`); `lorem ipsum`
// stays because it is itself unambiguous filler text that must never ship.
const placeholderRe = /\{\{\s*TODO\s*\}\}|@@PLACEHOLDER@@|lorem ipsum/i;
for (const f of files) {
  if (placeholderRe.test(readFileSync(f, 'utf8'))) fail(`leftover placeholder in ${f}`);
}

// 4. Expected node types on the right pages + twitter card.
const has = (file, needle) => {
  if (!existsSync(file)) fail(`${file} missing`);
  if (!readFileSync(file, 'utf8').includes(needle)) fail(`"${needle}" not found in ${file}`);
};
has('dist/index.html', 'HomeAndConstructionBusiness');
has('dist/index.html', 'FAQPage');
has('dist/index.html', 'twitter:card');
has('dist/contact/index.html', 'HomeAndConstructionBusiness');

// Servicii: structurally assert the TOP-LEVEL provider-carrying Service node shipped
// (a plain '"@type":"Service"' substring also matches the nested itemOffered offers,
// so it could pass even if the real Service node were missing — WR-01).
const serviciiFile = 'dist/servicii/index.html';
if (!existsSync(serviciiFile)) fail(`${serviciiFile} missing`);
const flatten = (node) =>
  Array.isArray(node) ? node.flatMap(flatten) : node && node['@graph'] ? flatten(node['@graph']) : [node];
let serviceNodeFound = false;
{
  const html = readFileSync(serviciiFile, 'utf8');
  let m;
  const sre = /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g;
  while ((m = sre.exec(html)) !== null) {
    // WR-04: guard the parse and route through fail() rather than relying on the implicit
    // (undocumented) assumption that section 1 already validated every block in this file.
    let parsed;
    try {
      parsed = JSON.parse(m[1]);
    } catch (e) {
      fail(`invalid JSON-LD in ${serviciiFile}: ${e.message}`);
    }
    for (const node of flatten(parsed)) {
      if (node && node['@type'] === 'Service' && node.provider) serviceNodeFound = true;
    }
  }
}
if (!serviceNodeFound) fail(`no top-level Service node with a provider in ${serviciiFile}`);

const detailPages = globSync('dist/lucrari/*/index.html');
if (detailPages.length === 0) fail('no dist/lucrari/*/index.html detail pages');
const anyBreadcrumb = detailPages.some((f) => readFileSync(f, 'utf8').includes('BreadcrumbList'));
if (!anyBreadcrumb) fail('no BreadcrumbList JSON-LD on any dist/lucrari/*/index.html');

// 5. (D-03 / CMS-02) lucrari images survived the CMS->astro:assets round-trip as
//    optimized AVIF/WebP with srcset — not shipped verbatim. <Picture> emits a
//    <source type="image/avif"> + <source type="image/webp"> pair carrying srcset.
//    Astro may order attributes either way (srcset before or after type), so the
//    regex tolerates both orderings on the same <source> tag.
const lucrariPages = globSync('dist/lucrari/*/index.html');
if (lucrariPages.length === 0) fail('no dist/lucrari/*/index.html pages to check images');

const sourceHas = (html, fmt) => {
  const tagRe = /<source\b[^>]*>/gi;
  let m;
  while ((m = tagRe.exec(html)) !== null) {
    const tag = m[0];
    if (new RegExp(`type=["']image\\/${fmt}["']`, 'i').test(tag) && /srcset=/i.test(tag)) return true;
  }
  return false;
};

// WR-05: assert the round-trip PER-PAGE, not "any page". A single slider page passing
// used to make the whole gate green even if an after-only gallery page shipped zero
// optimized images (this also closes CR-01's false-pass). Every lucrari surface must
// ship an avif+webp+srcset <source> pair.
for (const f of lucrariPages) {
  const html = readFileSync(f, 'utf8');
  if (!(sourceHas(html, 'avif') && sourceHas(html, 'webp')))
    fail(
      `no optimized <Picture> (avif+webp+srcset) on ${f} — CMS image round-trip dropped astro:assets on this page`,
    );
}

// 6. Next-gen optimized assets actually emitted into _astro/.
const optimizedAssets = globSync('dist/_astro/*.{avif,webp}');
if (optimizedAssets.length === 0)
  fail('no dist/_astro/*.{avif,webp} emitted — astro:assets did not optimize any image');

// 7. (SEO-06 / D-13) Sitemap emitted from the custom domain (never github.io).
const sitemapIdx = 'dist/sitemap-index.xml';
const sitemapSet0 = 'dist/sitemap-0.xml';
if (!existsSync(sitemapIdx)) fail(`${sitemapIdx} missing — @astrojs/sitemap did not emit the index`);
if (!existsSync(sitemapSet0)) fail(`${sitemapSet0} missing — @astrojs/sitemap did not emit the url set`);
const sitemapIdxXml = readFileSync(sitemapIdx, 'utf8');
if (!sitemapIdxXml.includes('https://nume-firma.ro/'))
  fail('sitemap-index.xml does not reference the custom domain (https://nume-firma.ro/)');
if (sitemapIdxXml.includes('github.io'))
  fail('sitemap references github.io — site/base misconfigured');

console.log(
  `ALL_PASS: ${files.length} html files, ${ldCount} JSON-LD blocks valid; no <form> on Contact; ` +
    `no placeholders; expected node types present; ${lucrariPages.length} lucrari page(s) ship optimized ` +
    `AVIF/WebP+srcset (${optimizedAssets.length} next-gen assets); sitemap emits from nume-firma.ro (no github.io)`,
);
