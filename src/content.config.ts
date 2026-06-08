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
import { glob } from 'astro/loaders';

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

export const collections = { lucrari };
