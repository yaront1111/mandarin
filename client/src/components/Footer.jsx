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
  
  return (
    <footer className={`site-footer ${isDarkMode ? 'dark-mode' : 'light-mode'}`} role="contentinfo" aria-label="Site footer">
      <div className="footer-content">
        <div itemScope itemType="http://schema.org/Organization">
          <p>© {new Date().getFullYear()} <span itemProp="name">Flirtss</span>. All rights reserved.</p>
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
