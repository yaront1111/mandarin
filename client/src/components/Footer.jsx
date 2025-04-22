// src/components/Footer.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async'; // Import Helmet for potential schema
import ReactGA from 'react-ga4'; // Import ReactGA if you choose this library

// Optional: Define Organization Schema
const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Mandarin', // Replace with your actual app/company name
  url: 'https://flirtss.com', // Replace with your actual domain
  // logo: 'URL_TO_YOUR_LOGO.png', // Optional: Add URL to your logo
  // sameAs: [ // Optional: Add links to social media profiles
  //   'https://www.facebook.com/yourprofile',
  //   'https://www.twitter.com/yourprofile',
  //   'https://www.linkedin.com/company/yourcompany'
  // ]
};

const Footer = () => {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  // Example function to track footer link clicks with GA4
  const handleFooterLinkClick = (label) => {
    ReactGA.event({
      category: 'Footer Navigation',
      action: 'Clicked Footer Link',
      label: label, // e.g., 'Privacy Policy', 'About Us'
    });
    console.log(`GA Event: Footer Click - ${label}`); // For debugging
  };


  return (
    <footer className="app-footer" style={footerStyles.container}>
      {/* Optional: Add Organization Schema to Helmet */}
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(organizationSchema)}
        </script>
      </Helmet>

      <div className="footer-content" style={footerStyles.content}>
        <div className="footer-links" style={footerStyles.linksSection}>
          <h5 style={footerStyles.heading}>{t('footer.company')}</h5>
          <ul style={footerStyles.list}>
            {/* Use onClick to track GA events */}
            <li><Link to="/about" style={footerStyles.link} onClick={() => handleFooterLinkClick('About')}>{t('footer.about')}</Link></li>
            <li><Link to="/support" style={footerStyles.link} onClick={() => handleFooterLinkClick('Support')}>{t('footer.support')}</Link></li>
            {/* Add other company links as needed */}
          </ul>
        </div>

        <div className="footer-links" style={footerStyles.linksSection}>
          <h5 style={footerStyles.heading}>{t('footer.legal')}</h5>
          <ul style={footerStyles.list}>
            <li><Link to="/privacy" style={footerStyles.link} onClick={() => handleFooterLinkClick('Privacy')}>{t('footer.privacy')}</Link></li>
            <li><Link to="/terms" style={footerStyles.link} onClick={() => handleFooterLinkClick('Terms')}>{t('footer.terms')}</Link></li>
            <li><Link to="/safety" style={footerStyles.link} onClick={() => handleFooterLinkClick('Safety')}>{t('footer.safety')}</Link></li>
          </ul>
        </div>

        {/* Optional: Social Media Links Section */}
        {/* <div className="footer-social" style={footerStyles.linksSection}>
          <h5 style={footerStyles.heading}>{t('footer.followUs')}</h5>
           Add social media icons/links here
           Example: <a href="..." target="_blank" rel="noopener noreferrer" onClick={() => handleFooterLinkClick('Social - Facebook')}><FaFacebook /></a>
        </div> */}

      </div>
      <div className="footer-bottom" style={footerStyles.bottom}>
        <p>&copy; {currentYear} Mandarin. {t('footer.rightsReserved')}</p>
        {/* You might want to add a sitemap link here too */}
        {/* <Link to="/sitemap.xml" style={footerStyles.link}>Sitemap</Link> */}
      </div>
    </footer>
  );
};

// Basic inline styles (consider moving to a CSS file like layout.css or a dedicated footer.css)
const footerStyles = {
  container: {
    backgroundColor: '#f8f9fa', // Example background color
    color: '#6c757d', // Example text color
    padding: '40px 20px 20px',
    borderTop: '1px solid #dee2e6',
    marginTop: 'auto', // Pushes footer to bottom if main content is short
  },
  content: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginBottom: '20px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  linksSection: {
    minWidth: '150px',
    marginBottom: '20px',
  },
  heading: {
    color: '#343a40', // Darker heading color
    marginBottom: '10px',
    fontSize: '1rem',
    fontWeight: 'bold',
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  link: {
    color: '#007bff', // Example link color
    textDecoration: 'none',
    marginBottom: '5px',
    display: 'block',
  },
  bottom: {
    textAlign: 'center',
    marginTop: '20px',
    paddingTop: '20px',
    borderTop: '1px solid #e9ecef',
    fontSize: '0.9rem',
  }
};


// Add translations for footer keys to your i18n resource files (e.g., en.json)
/*
{
  "footer": {
    "company": "Company",
    "about": "About Us",
    "support": "Support",
    "legal": "Legal",
    "privacy": "Privacy Policy",
    "terms": "Terms of Service",
    "safety": "Safety",
    "followUs": "Follow Us",
    "rightsReserved": "All rights reserved."
  }
}
*/

export default Footer;
