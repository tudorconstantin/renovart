// Astro 6 content collections (CLAUDE.md "What NOT to Use" — obey exactly):
// - This file lives at src/content.config.ts (NOT the legacy src/content/config.ts).
// - `defineCollection` is imported from 'astro:content' (NOT 'astro/zod' — that
//   re-exports ONLY `z`; importing defineCollection from there triggers the Phase 1
//   GenerateContentTypesError trap — see 01-03-SUMMARY.md).
// - `z` is imported from 'astro/zod' (NO separate zod install — avoids version drift).
// - `glob` is imported from 'astro/loaders'.
//
// IMAGE MODEL — Phase 4 migration (D-01/D-02, RESEARCH Pattern 1 + Pitfall 3):
// The image fields are plain `z.string()` paths, NOT Astro's `image()` helper, and the
// schema function is `() =>` (no `({ image })`). WHY:
//   - D-01 requires a SINGLE shared media folder (`src/assets/lucrari/`) fed by Pages CMS,
//     not per-entry co-located `./`-relative images.
//   - `image()` resolves ONLY `./`-relative paths against each entry's own directory, so it
//     structurally cannot express a shared-folder reference written by the CMS (Pitfall 3:
//     re-adding `image()` for any CMS-fed field re-introduces the import trap / build error).
//   - Instead the CMS writes a stable `/src/assets/lucrari/<file>` string; at render time
//     `src/lib/resolveLucrareImage.ts` resolves it via `import.meta.glob` to `ImageMetadata`,
//     so `astro:assets` still emits AVIF/WebP + responsive srcset (D-02). Fail-closed: a bad
//     path throws at build (the glob map is fully resolved at build time).
import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob, file } from 'astro/loaders';

// `lucrari` — the portfolio spine (LUC-01, D-01, D-12). Every downstream surface
// (grid, detail page, slider, Phase 3 homepage featured pull) reads from this
// collection + schema. Glob matches BOTH .md and .mdx so the real after-only
// project (.md) and the demo before/after project (.mdx) both load.
const lucrari = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/lucrari' }),
  schema: () =>
    z.object({
      title: z.string(),
      location: z.string(),
      date: z.coerce.date(), // ISO YYYY-MM-DD → Date (CMS-friendly)
      // category stays optional in the schema but is HIDDEN from the CMS form (D-08):
      // no filtering UI consumes it yet; keeping it here avoids a future schema churn.
      category: z.enum(['scara-bloc', 'palier', 'fatada-interioara']).optional(),
      // String paths rooted at /src/assets/lucrari/ — resolved via import.meta.glob
      // (resolveLucrareImage) into ImageMetadata at render. See header note (Pitfall 3).
      coverImage: z.string(),
      // Before/after comparisons (slider). The paired object shape makes before↔after
      // misalignment structurally impossible in the CMS (D-04). Empty → no slider.
      pairs: z.array(z.object({ before: z.string(), after: z.string() })).default([]),
      // After-only photos (gallery, D-05). An entry with pairs:[] + a populated gallery
      // is the after-only case (the real Cluj project) — renders the gallery, not a
      // broken/empty slider.
      gallery: z.array(z.string()).default([]),
      featured: z.boolean().default(false), // owner-controlled homepage toggle (D-08)
    })
      // CR-01 invariant: the detail page is binary on `pairs.length > 0` and falls into
      // the gallery branch otherwise. An entry with BOTH `pairs` and `gallery` empty would
      // render an empty, screen-reader-labelled <ul> (a broken page from a valid CMS edit).
      // Enforce "at least one image surface" at content-load so the build fails closed with
      // a clear message instead of shipping the empty gallery. Legitimate shapes still pass:
      // pairs-only (slider), gallery-only (the real Cluj after-only project), or both.
      .refine((d) => d.pairs.length > 0 || d.gallery.length > 0, {
        message:
          'Lucrarea nu are nici perechi înainte/după (pairs), nici galerie (gallery) — ' +
          'adăugați cel puțin o imagine de comparație sau o fotografie în galerie.',
        path: ['pairs'],
      }),
});

// ── Phase 5 editable-copy collections (CMS-03, D-08/D-09/D-10) ──────────────
// The FAQ, services, and trust marketing copy moves out of TS literals into
// zod-validated JSON the owner edits via Pages CMS. Each collection is the
// SINGLE source consumed by BOTH the visible DOM and the JSON-LD factories in
// schema.ts (no drift). `file()` (not `image()`) — these carry no images.
// A malformed/over-length CMS edit fails `astro build` (fail-closed, T-05-01).
// `.max()` caps mirror the UI-SPEC hard limits.

// faqCopy — array of {id, question, answer}; file() uses `id` as each entry id.
// 5 items today (garanție · deviz · termene · plată · zonă). The payment answer
// uses the D-03 soft register only (no invoicing/tax language).
const faqCopy = defineCollection({
  loader: file('src/data/copy/faq.json'),
  schema: z.object({
    question: z.string().max(80),
    answer: z.string().max(600),
  }),
});

// servicesCopy — array of {slug, title, description, icon}; `slug` is the entry id.
// EXPECT exactly the 6 known services; `icon` is a fixed enum (RESEARCH Open Q3)
// so an arbitrary owner value fails the build rather than rendering the fallback
// glyph. slug stays code-stable (the CMS form labels it "nu modificați").
const servicesCopy = defineCollection({
  loader: file('src/data/copy/services.json'),
  schema: z.object({
    slug: z.string(),
    title: z.string().max(60),
    description: z.string().max(400),
    icon: z.enum(['paint', 'stairs', 'rail', 'door', 'bulb', 'shield']),
  }),
});

// trustCopy — object format → single entry keyed `main`. warrantyText carries the
// qualitative phrasing (D-04); warrantyMonths/turnaroundDays are optional and
// empty by default (D-05) — owner fills real numbers later via one CMS edit.
const trustCopy = defineCollection({
  loader: file('src/data/copy/trust.json'),
  schema: z.object({
    yearsExperience: z.string().max(16),
    worksCompleted: z.string().max(16),
    warrantyText: z.string(),
    warrantyMonths: z.string().optional(),
    turnaroundDays: z.string().optional(),
  }),
});

// homeCopy — object format → single entry keyed `main`. The Home page chrome
// (hero + section headings/intros + "Cum lucrăm" steps + closing CTA) the owner
// edits via Pages CMS. `.max()` caps mirror the UI-SPEC HARD limits so an
// egregious edit fails `astro build` (fail-closed, T-05-04), while the visible
// copy stays the SINGLE source the DOM renders.
const homeCopy = defineCollection({
  loader: file('src/data/copy/home.json'),
  schema: z.object({
    eyebrow: z.string().max(40),
    headline: z.string().max(60),
    lead: z.string().max(220),
    servicesHeading: z.string().max(60),
    servicesIntro: z.string().max(300),
    trustHeading: z.string().max(60),
    trustIntro: z.string().max(300),
    featuredHeading: z.string().max(60),
    stepsHeading: z.string().max(60),
    // WR-04: step-text cap unified with despreCopy.steps[].text (both 300). The two
    // "Cum lucrăm" step editors render visually-identical UI, so they enforce ONE
    // limit — an editor copying step text between Home and Despre gets consistent
    // build behavior. The `.pages.yml` help text for both step editors states "~300".
    steps: z
      .array(z.object({ name: z.string().max(30), text: z.string().max(300) }))
      .min(3)
      .max(4),
    closingHeading: z.string().max(60),
    closingLead: z.string().max(300),
    ctaCallLabel: z.string().max(12),
    ctaWaLabel: z.string().max(12),
  }),
});

// serviciiCopy — object format → single entry keyed `main`. The Servicii page
// chrome (h1, lead, closing CTA copy + labels). The six service blocks
// themselves come from `servicesCopy` (Plan 01), fed once to both DOM + JSON-LD.
const serviciiCopy = defineCollection({
  loader: file('src/data/copy/servicii.json'),
  schema: z.object({
    headline: z.string().max(60),
    lead: z.string().max(300),
    closingHeading: z.string().max(60),
    closingLead: z.string().max(300),
    ctaCallLabel: z.string().max(12),
    ctaWaLabel: z.string().max(12),
  }),
});

// despreCopy — object format → single entry keyed `main`. The Despre page chrome
// (story lead + "Cum lucrăm" steps + "De ce noi" bullets + closing CTA) the owner
// edits via Pages CMS. Despre emits NO JSON-LD — copy is DOM-only. The 3–6 bullet
// cap (deCeNoiBullets.min(3).max(6)) + `.max()` length caps fail `astro build`
// (fail-closed, T-05-06) so an over-length / out-of-range CMS edit cannot ship.
const despreCopy = defineCollection({
  loader: file('src/data/copy/despre.json'),
  schema: z.object({
    headline: z.string().max(60),
    storyLead: z.string().max(400),
    cumLucramHeading: z.string().max(60),
    cumLucramIntro: z.string().max(300),
    steps: z
      .array(z.object({ name: z.string().max(30), text: z.string().max(300) }))
      .min(3)
      .max(4),
    deCeNoiHeading: z.string().max(60),
    deCeNoiIntro: z.string().max(300),
    deCeNoiBullets: z.array(z.string().max(80)).min(3).max(6),
    closingHeading: z.string().max(60),
    closingLead: z.string().max(300),
    ctaCallLabel: z.string().max(12),
    ctaWaLabel: z.string().max(12),
  }),
});

// contactCopy — object format → single entry keyed `main`. Only the editable
// marketing chrome lives here (headline, lead, CTA labels). The NAP (address,
// hours, phone, email, service area) stays in business.ts (LAY-05) — it is NOT
// duplicated into this JSON. Contact's JSON-LD is business.ts-derived, not copy.
const contactCopy = defineCollection({
  loader: file('src/data/copy/contact.json'),
  schema: z.object({
    headline: z.string().max(60),
    lead: z.string().max(220),
    ctaCallLabel: z.string().max(12),
    ctaWaLabel: z.string().max(12),
    ctaEmailLabel: z.string().max(12),
  }),
});

export const collections = {
  lucrari,
  faqCopy,
  servicesCopy,
  trustCopy,
  homeCopy,
  serviciiCopy,
  despreCopy,
  contactCopy,
};
