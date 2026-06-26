import { Helmet } from "react-helmet-async";

const SITE = "https://app.useatlasapp.com";

interface SEOProps {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
}

/**
 * Per-route SEO tags. Overrides title/description/canonical/og:* from index.html
 * so each route is distinguishable to search engines.
 */
export default function SEO({ title, description, path, noindex }: SEOProps) {
  const url = `${SITE}${path}`;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {noindex ? <meta name="robots" content="noindex,nofollow" /> : null}
    </Helmet>
  );
}