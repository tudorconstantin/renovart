// JSON-LD schema factories — derived ENTIRELY from business.ts (LAY-05).
// Zero hardcoded NAP/contact strings: every value flows from `business`.
// Pure functions returning plain objects; pages wrap one node (or a @graph
// array) with `@context: 'https://schema.org'` once at the root and pass the
// result to <JsonLd>. Do NOT add `@context` inside these factories.
import { business } from './business';

// Structural types for the factory params — kept local so schema.ts typechecks
// independently of faq.ts/services.ts. They match the `FaqItem`/`Service` shapes
// those single-source modules export (the arrays passed in are those exports).
type FaqItem = { question: string; answer: string };
type Service = { slug: string; title: string; description: string; icon?: string };

const SITE = business.domain; // e.g. https://nume-firma.ro
const BIZ_ID = `${SITE}/#business`; // stable @id for cross-reference
// business.telHref carries the "tel:" prefix — strip it; the remaining
// "+<country><number>" form is the Google-correct telephone format.
const tel = business.telHref.replace(/^tel:/, '');
// Absolute image/logo URL (mirrors BaseHead's ogImage resolution).
const ogImageAbs = new URL(business.ogImage, SITE).href;

/**
 * HomeAndConstructionBusiness (LocalBusiness subtype) — emitted on Home + Contact.
 * `geo` is intentionally OMITTED: no fake coordinates are shipped (geo is
 * recommended, not required, so absence is valid).
 */
export function homeAndConstructionBusiness() {
  return {
    '@type': 'HomeAndConstructionBusiness',
    '@id': BIZ_ID,
    name: business.name,
    url: SITE,
    telephone: tel,
    email: business.email,
    image: ogImageAbs,
    logo: ogImageAbs,
    address: {
      '@type': 'PostalAddress',
      // Derived from business.address ('Str. Exemplu nr. 10, Cluj-Napoca, Cluj').
      streetAddress: business.address.split(',')[0]?.trim() ?? business.address,
      addressLocality: 'Cluj-Napoca',
      addressRegion: 'Cluj',
      addressCountry: 'RO',
    },
    areaServed: { '@type': 'City', name: 'Cluj-Napoca' },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '08:00',
        closes: '17:00',
      },
    ],
    // geo: OMITTED by decision — no fake coordinates.
  };
}

/**
 * Service node — emitted on Servicii. `provider` cross-references the business
 * node by @id (no duplication). `hasOfferCatalog` lists the six offerings.
 */
export function serviceSchema(services: readonly Service[]) {
  return {
    '@type': 'Service',
    serviceType: 'Renovarea scărilor de bloc',
    provider: { '@id': BIZ_ID },
    areaServed: { '@type': 'City', name: 'Cluj-Napoca' },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Servicii de renovare a scărilor de bloc',
      itemListElement: services.map((s) => ({
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: s.title,
          description: s.description,
        },
      })),
    },
  };
}

/**
 * FAQPage node — emitted on Home (and optionally Contact). Mirrors the visible
 * FAQ DOM exactly (same faq.ts source → no drift).
 */
export function faqPageSchema(items: readonly FaqItem[]) {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.question,
      acceptedAnswer: { '@type': 'Answer', text: it.answer },
    })),
  };
}

/**
 * BreadcrumbList node — emitted on /lucrari/[slug]. The final (current) crumb
 * omits `item` per Google guidance.
 */
export function breadcrumbList(crumbs: readonly { name: string; url?: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      ...(c.url ? { item: new URL(c.url, SITE).href } : {}),
    })),
  };
}
