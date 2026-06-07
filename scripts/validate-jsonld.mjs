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
const placeholderRe = /\bTODO\b|lorem ipsum|\[TOKEN\]/i;
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
    for (const node of flatten(JSON.parse(m[1]))) {
      if (node && node['@type'] === 'Service' && node.provider) serviceNodeFound = true;
    }
  }
}
if (!serviceNodeFound) fail(`no top-level Service node with a provider in ${serviciiFile}`);

const detailPages = globSync('dist/lucrari/*/index.html');
if (detailPages.length === 0) fail('no dist/lucrari/*/index.html detail pages');
const anyBreadcrumb = detailPages.some((f) => readFileSync(f, 'utf8').includes('BreadcrumbList'));
if (!anyBreadcrumb) fail('no BreadcrumbList JSON-LD on any dist/lucrari/*/index.html');

console.log(`ALL_PASS: ${files.length} html files, ${ldCount} JSON-LD blocks valid; no <form> on Contact; no placeholders; expected node types present`);
