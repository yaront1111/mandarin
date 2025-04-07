import { useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';

const Footer = () => {
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const scriptsLoaded = useRef(false);
  
  useEffect(() => {
    // Skip loading scripts if they've already been loaded (prevent duplicates)
    if (scriptsLoaded.current) return;
    
    // Defer non-critical script loading until after page load
    if (document.readyState === 'complete') {
      loadDeferredScripts();
    } else {
      window.addEventListener('load', loadDeferredScripts);
    }
    
    // Cleanup function
    return () => {
      window.removeEventListener('load', loadDeferredScripts);
    };
  }, []);
  
  // Function to load scripts in a non-blocking way
  const loadDeferredScripts = () => {
    if (scriptsLoaded.current) return;
    
    // Dynamically load scripts only after page has loaded (non-blocking)
    setTimeout(() => {
      // Mark as loaded to prevent duplicate loading
      scriptsLoaded.current = true;
      
      // Add scripts using a script loader to index.html instead of here
      // This is already handled by the deferred script loading in index.html
      // and the gtag-loader.js file
    }, 1500); // Delay to prioritize main content rendering
  };
  
  // Add JSON-LD structured data instead of using microdata
  useEffect(() => {
    // Create organization schema
    const organizationSchema = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Flirtss",
      "url": "https://flirtss.com",
      "email": "contact@flirtss.com",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "123 Dating Street",
        "addressLocality": "Web City",
        "addressRegion": "WC",
        "postalCode": "12345",
        "addressCountry": "Israel"
      }
    };

    // Add schema to head as JSON-LD (modern approach)
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.innerHTML = JSON.stringify(organizationSchema);
    script.id = 'organization-schema';
    
    // Remove any existing schema with this ID
    const existingScript = document.getElementById('organization-schema');
    if (existingScript) {
      existingScript.remove();
    }
    
    document.head.appendChild(script);
    
    // Cleanup on unmount
    return () => {
      const scriptToRemove = document.getElementById('organization-schema');
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
  }, []);

  return (
    <footer className={`site-footer ${isDarkMode ? 'dark-mode' : 'light-mode'}`} role="contentinfo" aria-label="Site footer">
      <div className="footer-content">
        <div>
          <p>© {new Date().getFullYear()} Flirtss. All rights reserved.</p>
        </div>
        <nav className="footer-links" aria-label="Footer navigation">
          <a href="/about">About Us</a>
          <a href="/safety">Safety</a>
          <a href="/support">Support</a>
          <a href="/privacy" rel="nofollow">Privacy Policy</a>
          <a href="/terms" rel="nofollow">Terms of Service</a>
          <a href="/sitemap.xml" aria-label="Sitemap">Sitemap</a>
        </nav>
      </div>
      
      {/* Adding accessibility statement using semantic HTML */}
      <div className="footer-secondary">
        <div className="container">
          {/* Use hidden but accessible content for SEO and screen readers */}
          <address className="visually-hidden">
            123 Dating Street, Web City, WC 12345 Israel
            <a href="mailto:contact@flirtss.com" className="visually-hidden">contact@flirtss.com</a>
          </address>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
