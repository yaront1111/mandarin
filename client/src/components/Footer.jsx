import { useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';

const Footer = () => {
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  
  useEffect(() => {
    // Create and add Google Analytics script
    const gtagScript1 = document.createElement('script');
    gtagScript1.async = true;
    gtagScript1.src = "https://www.googletagmanager.com/gtag/js?id=G-Y9EQ02574T";
    
    const gtagScript2 = document.createElement('script');
    gtagScript2.innerHTML = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-Y9EQ02574T');
    `;
    
    // Add modern schema.org structured data
    const structuredDataScript = document.createElement('script');
    structuredDataScript.type = 'application/ld+json';
    structuredDataScript.innerHTML = `
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "Flirtss",
        "url": "${window.location.origin}",
        "description": "Flirtss connects singles for meaningful relationships. Find your perfect match with our advanced matching algorithm.",
        "keywords": "dating, singles, relationships, online dating, match, flirt",
        "inLanguage": ["en", "he"],
        "potentialAction": {
          "@type": "SearchAction",
          "target": "${window.location.origin}/search?q={search_term_string}",
          "query-input": "required name=search_term_string"
        }
      }
    `;
    
    // Add Organization structured data
    const organizationDataScript = document.createElement('script');
    organizationDataScript.type = 'application/ld+json';
    organizationDataScript.innerHTML = `
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "Flirtss",
        "alternateName": "Flirtss Dating",
        "url": "${window.location.origin}",
        "logo": "${window.location.origin}/placeholder.svg",
        "description": "Flirtss is a modern dating platform helping singles connect for meaningful relationships.",
        "contactPoint": {
          "@type": "ContactPoint",
          "contactType": "customer support",
          "email": "support@flirtss.com",
          "availableLanguage": ["English", "Hebrew"]
        },
        "sameAs": []
      }
    `;
    
    // Add FaqPage structured data for better search visibility
    const faqDataScript = document.createElement('script');
    faqDataScript.type = 'application/ld+json';
    faqDataScript.innerHTML = `
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "Is Flirtss free to use?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes, Flirtss offers a free basic membership with essential features. Premium subscription options are available for enhanced functionality and an ad-free experience."
            }
          },
          {
            "@type": "Question",
            "name": "How does Flirtss matching algorithm work?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Our advanced matching algorithm uses your profile information, interests, and preferences to suggest compatible matches. The more you interact with the platform, the better our suggestions become."
            }
          },
          {
            "@type": "Question",
            "name": "Is my personal information safe on Flirtss?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes, we take privacy seriously. Flirtss uses state-of-the-art encryption and security measures to protect your personal information. We never share your data with third parties without consent."
            }
          }
        ]
      }
    `;
    
    // Add scripts to document head
    document.head.appendChild(gtagScript1);
    document.head.appendChild(gtagScript2);
    document.head.appendChild(structuredDataScript);
    document.head.appendChild(organizationDataScript);
    document.head.appendChild(faqDataScript);
    
    // Clean up function to remove scripts when component unmounts
    return () => {
      try {
        document.head.removeChild(gtagScript1);
        document.head.removeChild(gtagScript2);
        document.head.removeChild(structuredDataScript);
        document.head.removeChild(organizationDataScript);
        document.head.removeChild(faqDataScript);
      } catch (err) {
        // Handle case where the script might have been removed already
        console.log("Analytics or structured data scripts already removed");
      }
    };
  }, []);
  
  return (
    <footer className={`site-footer ${isDarkMode ? 'dark-mode' : 'light-mode'}`} role="contentinfo" aria-label="Site footer">
      <div className="footer-content">
        <div itemScope itemType="http://schema.org/Organization">
          <p>© {new Date().getFullYear()} <span itemProp="name">Flirtss</span>. All rights reserved.</p>
        </div>
        <nav className="footer-links" aria-label="Footer navigation">
          <a href="/privacy" rel="nofollow">Privacy Policy</a>
          <a href="/terms" rel="nofollow">Terms of Service</a>
          <a href="/contact">Contact Us</a>
          <a href="/sitemap.xml" aria-label="Sitemap">Sitemap</a>
        </nav>
      </div>
      
      {/* Adding accessibility statement and additional information for SEO */}
      <div className="footer-secondary">
        <div className="container">
          <address className="visually-hidden">
            <span itemProp="address" itemScope itemType="http://schema.org/PostalAddress">
              <span itemProp="streetAddress">123 Dating Street</span>,
              <span itemProp="addressLocality">Web City</span>,
              <span itemProp="addressRegion">WC</span>
              <span itemProp="postalCode">12345</span>
              <span itemProp="addressCountry">Israel</span>
            </span>
            <a href="mailto:contact@flirtss.com" className="visually-hidden" itemProp="email">contact@flirtss.com</a>
          </address>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
