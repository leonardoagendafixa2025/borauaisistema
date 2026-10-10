// Runs before `vite dev` and `vite build` (predev/prebuild hooks); writes public/sitemap.xml.
// Includes static public routes + one entry per active restaurant slug.

import { writeFileSync } from 'fs';
import { resolve } from 'path';

const BASE_URL = 'https://borauai.com';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ynxrtjvyeymbiifehenk.supabase.co';
const SUPABASE_ANON =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_FyJ2tPdnlBu28g1yE1UJYw_Jqpl9Hd5';

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: string;
}

const staticEntries: SitemapEntry[] = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/precos', changefreq: 'weekly', priority: '0.9' },
  { path: '/cadastro', changefreq: 'monthly', priority: '0.8' },
  { path: '/ajuda', changefreq: 'monthly', priority: '0.7' },
  { path: '/status', changefreq: 'weekly', priority: '0.4' },
  { path: '/vendas', changefreq: 'monthly', priority: '0.5' },
  { path: '/demo/balada', changefreq: 'monthly', priority: '0.5' },
  { path: '/legal/termos', changefreq: 'yearly', priority: '0.3' },
  { path: '/legal/privacidade', changefreq: 'yearly', priority: '0.3' },
  { path: '/legal/lgpd', changefreq: 'yearly', priority: '0.3' },
];

async function fetchRestaurantSlugs(): Promise<SitemapEntry[]> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/restaurants?select=slug,updated_at&status=in.(active,trial)`,
      {
        headers: {
          apikey: SUPABASE_ANON,
          Authorization: `Bearer ${SUPABASE_ANON}`,
        },
      }
    );
    if (!res.ok) {
      console.warn(`[sitemap] Restaurant fetch failed: ${res.status}`);
      return [];
    }
    const rows = (await res.json()) as Array<{ slug: string; updated_at?: string }>;
    return rows
      .filter((r) => r.slug)
      .map((r) => ({
        path: `/${r.slug}`,
        lastmod: r.updated_at?.slice(0, 10),
        changefreq: 'weekly' as const,
        priority: '0.6',
      }));
  } catch (e) {
    console.warn('[sitemap] Restaurant fetch error:', e);
    return [];
  }
}

function generateSitemap(entries: SitemapEntry[]) {
  const urls = entries.map((e) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join('\n')
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join('\n');
}

(async () => {
  const dynamicEntries = await fetchRestaurantSlugs();
  const entries = [...staticEntries, ...dynamicEntries];
  writeFileSync(resolve('public/sitemap.xml'), generateSitemap(entries));
  console.log(`sitemap.xml written (${entries.length} entries: ${staticEntries.length} static + ${dynamicEntries.length} restaurants)`);
})();
