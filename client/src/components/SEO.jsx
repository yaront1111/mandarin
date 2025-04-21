import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '../context';

/**
 * SEO component for managing document head metadata
 * 
 * @param {Object} props - Component props
 * @param {string} props.title - Page title
 * @param {string} props.description - Page description
 * @param {string} props.image - Image URL for social sharing
 * @param {string} props.schema - JSON-LD schema for structured data
 * @param {Object} props.meta - Additional meta tags
 */
const SEO = ({
  title,
  description,
  image = '/images/flirtss-social-share.jpg',
  schema,
  meta = {},
  canonicalUrl,
}) => {
  const location = useLocation();
  const { language, isRTL } = useLanguage();
  
  // Base URL (change to actual domain in production)
  const baseUrl = 'https://flirtss.com';
  
  // Default canonical URL is current page
  const canonical = canonicalUrl || `${baseUrl}${location.pathname}`;
  
  // Default page title
  const defaultTitle = 'Flirtss';
  const fullTitle = title ? `${title} | ${defaultTitle}` : defaultTitle;
  
  // Default description
  const defaultDescription = 'Find meaningful relationships and make genuine connections with singles in your area.';
  const pageDescription = description || defaultDescription;
  
  // Full image URL
  const imageUrl = image.startsWith('http') ? image : `${baseUrl}${image}`;
  
  return (
    <Helmet
      htmlAttributes={{
        lang: language,
        dir: isRTL ? 'rtl' : 'ltr',
      }}
      title={fullTitle}
      meta={[
        { name: 'description', content: pageDescription },
        
        // Open Graph / Facebook
        { property: 'og:title', content: fullTitle },
        { property: 'og:description', content: pageDescription },
        { property: 'og:url', content: canonical },
        { property: 'og:type', content: 'website' },
        { property: 'og:image', content: imageUrl },
        
        // Twitter Card
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: fullTitle },
        { name: 'twitter:description', content: pageDescription },
        { name: 'twitter:image', content: imageUrl },
        
        // Additional meta tags
        ...Object.entries(meta).map(([name, content]) => ({
          name,
          content,
        })),
      ]}
      link={[
        { rel: 'canonical', href: canonical },
        // Alternate language links could be added here
      ]}
    >
      {/* Add JSON-LD structured data if provided */}
      {schema && (
        <script type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      )}
    </Helmet>
  );
};

export default SEO;
