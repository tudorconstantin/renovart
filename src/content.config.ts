// Astro 6 content collections (CLAUDE.md "What NOT to Use" — obey exactly):
// - This file lives at src/content.config.ts (NOT the legacy src/content/config.ts).
// - `z` is imported from 'astro/zod' (NO separate zod install — avoids version drift).
// - `glob` is imported from 'astro/loaders'.
// - schema is a FUNCTION so the image() helper is in scope; image() resolves the
//   frontmatter `./`-relative path against the entry file's own directory (Pattern A,
//   RESEARCH Pitfall 1) → astro:assets emits AVIF/WebP + responsive srcset at build.
import { defineCollection, z } from 'astro/zod';
import { glob } from 'astro/loaders';

// THROWAWAY collection: proves the Pattern A image pipeline end-to-end exactly as
// Phase 2's `lucrari` collection will use it (IMG-01 + Success Criterion #4).
// Per RESEARCH Open Question 3, this collection is throwaway — the real `lucrari`
// collection lands in Phase 2. See 01-03-SUMMARY.md for the keep/delete decision.
const imgtest = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/imgtest' }),
  schema: ({ image }) =>
    z.object({
      cover: image(),
    }),
});

export const collections = { imgtest };
