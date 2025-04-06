/**
 * Schema generators for structured data
 * These functions generate JSON-LD structured data for various page types
 */

/**
 * Generate Schema.org WebPage schema for standard pages
 * 
 * @param {Object} options
 * @param {string} options.title - Page title
 * @param {string} options.description - Page description
 * @param {string} options.url - Full canonical URL
 * @param {string} options.image - Image URL (optional)
 * @param {Date} options.lastUpdated - Last updated date (optional, defaults to current date)
 * @returns {Object} JSON-LD structured data object
 */
export const generatePageSchema = ({ 
  title, 
  description, 
  url, 
  image = 'https://flirtss.com/images/social-preview.jpg',
  lastUpdated = new Date()
}) => {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    'url': url,
    'name': title,
    'description': description,
    'image': image,
    'isPartOf': {
      '@type': 'WebSite',
      '@id': 'https://flirtss.com/#website',
      'name': 'Flirtss',
      'url': 'https://flirtss.com/'
    },
    'datePublished': '2024-01-01T00:00:00+00:00',
    'dateModified': lastUpdated.toISOString(),
    'inLanguage': 'en-US',
    'potentialAction': [
      {
        '@type': 'ReadAction',
        'target': [url]
      }
    ]
  };
};

/**
 * Generate Schema.org Person schema for user profiles
 * 
 * @param {Object} options
 * @param {string} options.name - User's name
 * @param {string} options.description - User bio/description
 * @param {string} options.profileUrl - Full URL to profile
 * @param {string} options.imageUrl - Profile photo URL
 * @param {string} options.gender - User gender (optional)
 * @param {string} options.location - User location (optional)
 * @returns {Object} JSON-LD structured data object
 */
export const generateProfileSchema = ({
  name,
  description,
  profileUrl,
  imageUrl,
  gender = null,
  location = null
}) => {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${profileUrl}#person`,
    'name': name,
    'description': description,
    'url': profileUrl,
    'image': imageUrl,
  };
  
  // Add optional fields if provided
  if (gender) schema.gender = gender;
  if (location) {
    schema.location = {
      '@type': 'Place',
      'name': location
    };
  }
  
  return schema;
};

/**
 * Generate Schema.org Article schema for blog posts or articles
 * 
 * @param {Object} options
 * @param {string} options.headline - Article headline
 * @param {string} options.description - Article description/excerpt
 * @param {string} options.url - Full canonical URL
 * @param {string} options.imageUrl - Article image URL
 * @param {Date} options.datePublished - Publication date
 * @param {Date} options.dateModified - Last modified date (optional)
 * @param {Object} options.author - Author object with name and url
 * @returns {Object} JSON-LD structured data object
 */
export const generateArticleSchema = ({
  headline,
  description,
  url,
  imageUrl,
  datePublished,
  dateModified = null,
  author = { name: 'Flirtss Team', url: 'https://flirtss.com/about' }
}) => {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${url}#article`,
    'headline': headline,
    'description': description,
    'image': imageUrl,
    'url': url,
    'mainEntityOfPage': {
      '@type': 'WebPage',
      '@id': url
    },
    'datePublished': datePublished.toISOString(),
    'dateModified': (dateModified || datePublished).toISOString(),
    'author': {
      '@type': 'Person',
      'name': author.name,
      'url': author.url
    },
    'publisher': {
      '@type': 'Organization',
      'name': 'Flirtss',
      'logo': {
        '@type': 'ImageObject',
        'url': 'https://flirtss.com/logo.png',
        'width': '192',
        'height': '192'
      }
    }
  };
};