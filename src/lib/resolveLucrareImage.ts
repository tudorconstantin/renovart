// resolveLucrareImage — the CMS ↔ astro:assets round-trip bridge (CMS-02, D-02).
// RESEARCH Pattern 1 (Astro's official "Dynamically importing images" recipe).
//
// The `lucrari` collection stores image references as plain strings rooted at
// `/src/assets/lucrari/...` (NOT Astro's `image()` helper — see content.config.ts /
// Pitfall 3). This helper resolves such a string to the `ImageMetadata` that
// `<Picture>`/`<Image>` consume, so astro:assets still emits AVIF/WebP + srcset.
//
// import.meta.glob is build-time and statically analyzable: the pattern MUST be a
// LITERAL string (no variable interpolation). Its keys are project-root absolute
// paths like '/src/assets/lucrari/cluj-palier-vopsit.jpg' — i.e. exactly the string
// Pages CMS writes (media.output: /src/assets/lucrari) and the frontmatter stores.
import type { ImageMetadata } from 'astro';

// WR-01: include UPPERCASE extension variants in the glob so a CMS upload named e.g.
// `Poza.JPG` is still in the map. The pattern MUST stay a literal (import.meta.glob is
// statically analyzed at build), so list both cases explicitly.
const images = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/lucrari/*.{jpeg,jpg,png,webp,avif,JPEG,JPG,PNG,WEBP,AVIF}',
);

// WR-01: a case-insensitive index of the glob keys, so a frontmatter path that differs
// only in letter-case (common from CMS uploads on case-preserving-but-insensitive
// filesystems, or hand edits) still resolves rather than breaking the whole build.
const imagesByLowerKey = new Map<string, () => Promise<{ default: ImageMetadata }>>();
for (const [key, loader] of Object.entries(images)) {
  imagesByLowerKey.set(key.toLowerCase(), loader);
}

export async function resolveLucrareImage(path: string): Promise<ImageMetadata> {
  // WR-01: normalize the lookup. Pages CMS can write a percent-encoded path (e.g. spaces
  // → %20); decode it first. Try the exact key, then the decoded key, then a
  // case-insensitive match before giving up.
  const decoded = decodeURIComponent(path);
  const loader =
    images[path] ??
    images[decoded] ??
    imagesByLowerKey.get(path.toLowerCase()) ??
    imagesByLowerKey.get(decoded.toLowerCase());
  if (!loader) {
    // Fail closed — a bad CMS path must break the build, never ship a missing image —
    // but name the missing key AND list the available ones so the failure is diagnosable
    // (CI red with a clue, instead of an opaque whole-build break).
    throw new Error(
      `Imagine inexistentă în src/assets/lucrari: "${path}". ` +
        `Disponibile: ${Object.keys(images).join(', ')}`,
    );
  }
  return (await loader()).default;
}
