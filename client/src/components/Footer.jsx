// src/components/common/Footer.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from '../styles/footer.module.css'

const Footer = () => {
  const { t } = useTranslation();

  return (
    <footer className={styles.modernFooter}> {/* Use CSS Module class */}
      <div className={`container ${styles.footerContent}`}> {/* Use CSS Module class */}
        {/* Logo - Updated to Link to home */}
        <Link to="/" className={styles.footerLogo}>Mandarin</Link> {/* Use CSS Module class */}

        {/* Links */}
        <div className={styles.footerLinks}> {/* Use CSS Module class */}
          <Link to="/about">{t("aboutUs", "About Us")}</Link>
          <Link to="/safety">{t("safety", "Safety")}</Link> {/* Changed key slightly based on common usage */}
          <Link to="/support">{t("contactSupport", "Support")}</Link>
          <Link to="/terms">{t("termsOfService", "Terms")}</Link>
          <Link to="/privacy">{t("privacyPolicy", "Privacy")}</Link> {/* Use more specific key */}
        </div>

        {/* Social Icons (Example placeholders) */}
        <div className={styles.footerSocial}> {/* Use CSS Module class */}
          {/* Replace # with actual links */}
          <a href="#" aria-label="Facebook" className={styles.socialIcon}>FB</a>
          <a href="#" aria-label="Instagram" className={styles.socialIcon}>IG</a>
          <a href="#" aria-label="Twitter" className={styles.socialIcon}>TW</a>
        </div>
      </div>
      <div className={styles.footerBottom}> {/* Use CSS Module class */}
        © {new Date().getFullYear()} Mandarin.{" "}
        {t("allRightsReserved", "All rights reserved.")}
      </div>
    </footer>
  );
};

// Export as default or named, adjust import in App.jsx accordingly
export default Footer;
