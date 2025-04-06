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
    
    // Add scripts to document head
    document.head.appendChild(gtagScript1);
    document.head.appendChild(gtagScript2);
    
    // Clean up function to remove scripts when component unmounts
    return () => {
      try {
        document.head.removeChild(gtagScript1);
        document.head.removeChild(gtagScript2);
      } catch (err) {
        // Handle case where the script might have been removed already
        console.log("Analytics scripts already removed");
      }
    };
  }, []);
  
  return (
    <footer className={`site-footer ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>
      <div className="footer-content">
        <p>© {new Date().getFullYear()} Flirtss. All rights reserved.</p>
        <div className="footer-links">
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
          <a href="/contact">Contact Us</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;