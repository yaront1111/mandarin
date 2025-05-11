import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../context";
import { SEO } from "../components";
import "../styles/pages.css";

const About = () => {
  const { t } = useTranslation();
  const { dir } = useLanguage();

  // Define schema for structured data
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Flirtss",
    "url": "https://flirtss.com",
    "logo": "https://flirtss.com/logo.png",
    "description": "Flirtss is a dating platform that helps adults find meaningful connections in a safe, respectful environment.",
    "foundingDate": "2022",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Tel Aviv",
      "addressCountry": "Israel"
    }
  };

  return (
    <div className="policy-page-container" dir={dir}>
      <SEO 
        title="About Flirtss"
        description="Learn about Flirtss - our story, mission, values, and the team behind our platform for meaningful connections."
        schema={organizationSchema}
      />
      <header className="modern-header">
        <div className="container header-container">
          <Link to="/" className="logo gradient-text font-weight-bold">Flirtss</Link>
        </div>
      </header>

      <div className="policy-content container py-5">
        <div className="row justify-content-center">
          <div className="col-12 col-lg-10">
            <div className="policy-card">
              <h1 className="policy-title gradient-text">{t("aboutUs", "About Us")}</h1>
              
              <section className="mb-5">
                <h2>{t("ourStory", "Our Story")}</h2>
                <p>
                  {t("storyContent",
                    "Founded in 2022, Mandarin was created with a simple mission: to help adults find meaningful connections in a safe, respectful environment. Our team of dedicated professionals combines expertise in technology, psychology, and relationship dynamics to create a platform that prioritizes authentic interactions."
                  )}
                </p>
              </section>

              <section className="mb-5">
                <h2>{t("ourMission", "Our Mission")}</h2>
                <p>
                  {t("missionContent",
                    "At Mandarin, we believe that everyone deserves to find connections that enrich their lives. Our mission is to provide a platform where adults can explore relationships in an environment that values privacy, consent, and mutual respect."
                  )}
                </p>
              </section>

              <section className="mb-5">
                <h2>{t("ourValues", "Our Values")}</h2>
                <div className="values-grid">
                  <div className="value-item">
                    <h3>{t("valuePrivacy", "Privacy")}</h3>
                    <p>{t("valuePrivacyDesc", "Your personal information and interactions are yours alone. We implement industry-leading security measures to protect your data.")}</p>
                  </div>
                  <div className="value-item">
                    <h3>{t("valueAuthenticity", "Authenticity")}</h3>
                    <p>{t("valueAuthenticityDesc", "We encourage genuine interactions and have systems in place to verify real users and reduce fake profiles.")}</p>
                  </div>
                  <div className="value-item">
                    <h3>{t("valueInclusion", "Inclusion")}</h3>
                    <p>{t("valueInclusionDesc", "We welcome adults of all backgrounds, orientations, and relationship preferences in a judgment-free environment.")}</p>
                  </div>
                  <div className="value-item">
                    <h3>{t("valueRespect", "Respect")}</h3>
                    <p>{t("valueRespectDesc", "Mutual respect is fundamental to positive interactions. We have zero tolerance for harassment or disrespectful behavior.")}</p>
                  </div>
                </div>
              </section>

              <section className="mb-5">
                <h2>{t("ourTeam", "Our Team")}</h2>
                <p>
                  {t("teamContent",
                    "Our diverse team brings together expertise in technology, design, security, and relationship psychology. Based in Tel Aviv with team members across the globe, we work together to create an exceptional platform for meaningful connections."
                  )}
                </p>
              </section>

              <section className="mb-5">
                <h2>{t("contactUs", "Contact Us")}</h2>
                <p>
                  {t("aboutContactContent",
                    "We value your feedback and are here to assist with any questions or concerns. Please reach out to our support team at support@mandarin.example.com or visit our"
                  )} <Link to="/support">{t("supportPage", "support page")}</Link>.
                </p>
              </section>

              <div className="policy-footer">
                <Link to="/" className="btn btn-outline-primary">{t("backToHome", "Back to Home")}</Link>
                <div className="policy-links">
                  <Link to="/terms">{t("termsOfService", "Terms of Service")}</Link>
                  <Link to="/privacy">{t("privacyPolicy", "Privacy Policy")}</Link>
                  <Link to="/support">{t("contactSupport", "Contact Support")}</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
