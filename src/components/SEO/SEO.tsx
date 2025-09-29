// src/components/SEO/SEO.tsx

import { Helmet } from 'react-helmet-async';

type SEOProps = {
  title: string;
  description: string;
  name?: string; // автор/бренд (опционально)
  type?: string; // тип og (по умолчанию website)
  url?: string; // канонический URL
  image?: string; // ссылка на картинку для превью
};

export default function SEO({
  title,
  description,
  name = 'Смоляное чучелко',
  type = 'website',
  url,
  image,
}: SEOProps) {
  return (
    <Helmet>
      {/* Базовые мета-теги */}
      <title>{title}</title>
      <meta name="description" content={description} />

      {/* Канонический URL */}
      {url && <link rel="canonical" href={url} />}

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      {url && <meta property="og:url" content={url} />}
      {image && <meta property="og:image" content={image} />}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {image && <meta name="twitter:image" content={image} />}
      {name && <meta name="twitter:creator" content={name} />}
    </Helmet>
  );
}
