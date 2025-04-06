import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Helmet - Dynamic SEO component that updates document head based on page content
 * 
 * @param {Object} props
 * @param {string} props.title - Page title
 * @param {string} props.description - Page description
 * @param {string} props.keywords - Keywords for search engines
 * @param {string} props.canonicalPath - Path for canonical URL (will be appended to domain)
 * @param {string} props.ogImage - Open Graph image path (optional)
 * @param {string} props.ogType - Open Graph type (optional, defaults to website)
 * @param {Object} props.structuredData - JSON-LD structured data (optional)
 */
const Helmet = ({ 
  title, 
  description, 
  keywords = '', 
  canonicalPath = '', 
  ogImage = '/images/social-preview.jpg', 
  ogType = 'website',
  structuredData = null
}) => {
  const location = useLocation();
  const domain = 'https://flirtss.com';
  const fullCanonicalUrl = canonicalPath ? `${domain}${canonicalPath}` : `${domain}${location.pathname}`;
  
  useEffect(() => {
    // Update page title
    document.title = title ? `${title} | Flirtss` : 'Flirtss - Meet Local Singles & Find Your Perfect Match';
    
    // Update meta description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', description);
    } else {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      metaDescription.setAttribute('content', description);
      document.head.appendChild(metaDescription);
    }
    
    // Update meta keywords
    if (keywords) {
      let metaKeywords = document.querySelector('meta[name="keywords"]');
      if (metaKeywords) {
        metaKeywords.setAttribute('content', keywords);
      } else {
        metaKeywords = document.createElement('meta');
        metaKeywords.setAttribute('name', 'keywords');
        metaKeywords.setAttribute('content', keywords);
        document.head.appendChild(metaKeywords);
      }
    }
    
    // Update canonical URL
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink) {
      canonicalLink.setAttribute('href', fullCanonicalUrl);
    } else {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      canonicalLink.setAttribute('href', fullCanonicalUrl);
      document.head.appendChild(canonicalLink);
    }
    
    // Update Open Graph tags
    const ogTags = {
      'og:title': title ? `${title} | Flirtss` : 'Flirtss - Meet Local Singles & Find Your Perfect Match',
      'og:description': description,
      'og:url': fullCanonicalUrl,
      'og:type': ogType,
      'og:image': ogImage.startsWith('http') ? ogImage : `${domain}${ogImage}`
    };
    
    Object.entries(ogTags).forEach(([property, content]) => {
      let metaTag = document.querySelector(`meta[property="${property}"]`);
      if (metaTag) {
        metaTag.setAttribute('content', content);
      } else {
        metaTag = document.createElement('meta');
        metaTag.setAttribute('property', property);
        metaTag.setAttribute('content', content);
        document.head.appendChild(metaTag);
      }
    });
    
    // Twitter Card tags
    const twitterTags = {
      'twitter:title': title ? `${title} | Flirtss` : 'Flirtss - Meet Local Singles & Find Your Perfect Match',
      'twitter:description': description,
      'twitter:url': fullCanonicalUrl,
      'twitter:image': ogImage.startsWith('http') ? ogImage : `${domain}${ogImage}`
    };
    
    Object.entries(twitterTags).forEach(([property, content]) => {
      let metaTag = document.querySelector(`meta[property="${property}"]`);
      if (metaTag) {
        metaTag.setAttribute('content', content);
      } else {
        metaTag = document.createElement('meta');
        metaTag.setAttribute('property', property);
        metaTag.setAttribute('content', content);
        document.head.appendChild(metaTag);
      }
    });
    
    // Add structured data if provided
    if (structuredData) {
      // Remove any existing structured data with the same @type
      const existingScripts = document.querySelectorAll('script[type="application/ld+json"]');
      existingScripts.forEach(script => {
        try {
          const data = JSON.parse(script.innerHTML);
          if (data['@type'] === structuredData['@type']) {
            script.remove();
          }
        } catch (e) {
          // Skip if parsing fails
        }
      });
      
      // Add new structured data
      const scriptTag = document.createElement('script');
      scriptTag.setAttribute('type', 'application/ld+json');
      scriptTag.innerHTML = JSON.stringify(structuredData);
      document.head.appendChild(scriptTag);
    }
    
    // Cleanup function
    return () => {
      // We don't remove most tags on cleanup as it would cause flickering
      // Only remove dynamic structured data if it was added temporarily
      if (structuredData) {
        const tempScripts = document.querySelectorAll('script[type="application/ld+json"]');
        tempScripts.forEach(script => {
          try {
            const data = JSON.parse(script.innerHTML);
            if (data['@type'] === structuredData['@type'] && 
                data['@id'] === structuredData['@id']) {
              script.remove();
            }
          } catch (e) {
            // Skip if parsing fails
          }
        });
      }
    };
  }, [title, description, keywords, fullCanonicalUrl, ogImage, ogType, structuredData]);
  
  // This component doesn't render anything visibly
  return null;
};

export default Helmet;