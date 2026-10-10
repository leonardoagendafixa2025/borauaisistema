import { Helmet } from 'react-helmet-async';

const SITE = 'https://borauai.com';

interface SEOProps {
  title: string;
  description: string;
  path?: string;
  image?: string;
  type?: 'website' | 'article' | 'product';
  noindex?: boolean;
  jsonLd?: object | object[];
}

/**
 * Per-route SEO tags. `path` should start with '/' (defaults to current route).
 * Canonical and og:url self-reference this route.
 */
export function SEO({ title, description, path = '/', image, type = 'website', noindex, jsonLd }: SEOProps) {
  const url = `${SITE}${path}`;
  const ogImage = image || 'https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/b0db24ac-ef47-422f-9ccf-01f0866956a2/id-preview-e43b3e66--04f6528c-fd0d-4c44-96c6-12848efc12fe.lovable.app-1775160769613.png';
  const schemas = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:locale" content="pt_BR" />
      <meta property="og:site_name" content="Bora Uai" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {schemas.map((s, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(s)}</script>
      ))}
    </Helmet>
  );
}

export default SEO;
