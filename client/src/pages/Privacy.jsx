import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../context";
import { SEO } from "../components";
import "../styles/pages.css";

const Privacy = () => {
  const { t } = useTranslation();
  const { dir } = useLanguage();

  // Define schema for structured data
  const privacySchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Privacy Policy - Flirtss",
    "description": "Learn about how Flirtss protects your privacy and manages your personal information.",
    "url": "https://flirtss.com/privacy",
    "mainEntity": {
      "@type": "Article",
      "name": "Flirtss Privacy Policy",
      "datePublished": "2024-04-15",
      "dateModified": "2024-04-15",
      "author": {
        "@type": "Organization",
        "name": "Flirtss"
      }
    }
  };

  return (
    <div className="policy-page-container" dir={dir}>
      <SEO 
        title="Privacy Policy"
        description="Learn how Mandarin Dating protects your personal information, what data we collect, and your privacy rights when using our service."
        schema={privacySchema}
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
              <h1 className="policy-title gradient-text">{t("privacyTitle", "Privacy Policy")}</h1>
              <p className="policy-last-updated">
                {t("lastUpdated", "Last Updated")}: {t("privacyUpdateDate", "April 15, 2024")}
              </p>

              <section className="mb-5">
                <h2>{t("introduction", "Introduction")}</h2>
                <p>
                  {t("privacyIntroContent",
                    "At Mandarin, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service. Please read this policy carefully to understand our practices regarding your personal data."
                  )}
                </p>
              </section>

              <section className="mb-5">
                <h2>{t("informationWeCollect", "Information We Collect")}</h2>
                <p>
                  {t("collectIntro",
                    "We collect several types of information to provide and improve our service to you:"
                  )}
                </p>
                <ul>
                  <li>
                    <strong>{t("personalInformation", "Personal Information")}</strong>:
                    {t("personalInfoDetails",
                      " Name, email address, date of birth, gender, relationship status, and preferences."
                    )}
                  </li>
                  <li>
                    <strong>{t("profileInformation", "Profile Information")}</strong>:
                    {t("profileInfoDetails",
                      " Photos, bio, interests, and other details you choose to share on your profile."
                    )}
                  </li>
                  <li>
                    <strong>{t("usageInformation", "Usage Information")}</strong>:
                    {t("usageInfoDetails",
                      " How you interact with our service, including login times, features used, and messages sent."
                    )}
                  </li>
                  <li>
                    <strong>{t("deviceInformation", "Device Information")}</strong>:
                    {t("deviceInfoDetails",
                      " IP address, browser type, device type, and operating system."
                    )}
                  </li>
                  <li>
                    <strong>{t("locationInformation", "Location Information")}</strong>:
                    {t("locationInfoDetails",
                      " General location data based on IP address or user-provided information."
                    )}
                  </li>
                </ul>
              </section>

              <section className="mb-5">
                <h2>{t("howWeUseInformation", "How We Use Your Information")}</h2>
                <p>
                  {t("useIntro",
                    "We use the information we collect for various purposes, including to:"
                  )}
                </p>
                <ul>
                  <li>{t("useProvideService", "Provide, maintain, and improve our services")}</li>
                  <li>{t("usePersonalize", "Personalize your experience and provide relevant matches")}</li>
                  <li>{t("useCommunicate", "Communicate with you about service updates and offers")}</li>
                  <li>{t("useSecurity", "Monitor and analyze usage patterns for security and service improvement")}</li>
                  <li>{t("useLegal", "Comply with legal obligations and enforce our terms")}</li>
                </ul>
              </section>

              <section className="mb-5">
                <h2>{t("informationSharing", "Information Sharing and Disclosure")}</h2>
                <p>
                  {t("sharingIntro",
                    "We do not sell your personal information. We may share information in the following situations:"
                  )}
                </p>
                <ul>
                  <li>
                    <strong>{t("sharingConsent", "With Your Consent")}</strong>: 
                    {t("sharingConsentDetails",
                      " When you explicitly agree to share information with other users or third parties."
                    )}
                  </li>
                  <li>
                    <strong>{t("sharingServiceProviders", "Service Providers")}</strong>: 
                    {t("sharingProvidersDetails",
                      " With trusted third parties who assist us in operating our service, such as payment processors, cloud storage providers, and analytics services."
                    )}
                  </li>
                  <li>
                    <strong>{t("sharingLegal", "Legal Requirements")}</strong>: 
                    {t("sharingLegalDetails",
                      " When we believe disclosure is necessary to comply with a legal obligation, protect our rights, or ensure the safety of our users."
                    )}
                  </li>
                </ul>
              </section>

              <section className="mb-5">
                <h2>{t("dataSecurity", "Data Security")}</h2>
                <p>
                  {t("securityContent",
                    "We implement appropriate technical and organizational measures to protect your personal information from unauthorized access, loss, or alteration. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security."
                  )}
                </p>
              </section>

              <section className="mb-5">
                <h2>{t("yourRights", "Your Rights and Choices")}</h2>
                <p>
                  {t("rightsContent",
                    "Depending on your location, you may have certain rights regarding your personal information, including:"
                  )}
                </p>
                <ul>
                  <li>{t("rightsAccess", "Access and review your personal information")}</li>
                  <li>{t("rightsCorrect", "Correct inaccurate or incomplete information")}</li>
                  <li>{t("rightsDelete", "Request deletion of your personal information")}</li>
                  <li>{t("rightsRestrict", "Restrict or object to certain processing of your data")}</li>
                  <li>{t("rightsPortability", "Request a copy of your data in a portable format")}</li>
                </ul>
                <p>
                  {t("rightsExercise",
                    "To exercise these rights, please contact us using the information provided in the \"Contact Us\" section."
                  )}
                </p>
              </section>

              <section className="mb-5">
                <h2>{t("cookies", "Cookies and Tracking Technologies")}</h2>
                <p>
                  {t("cookiesContent",
                    "We use cookies and similar tracking technologies to collect information about your browsing activities and to personalize your experience. You can control cookies through your browser settings, but disabling certain cookies may limit your ability to use some features of our service."
                  )}
                </p>
              </section>

              <section className="mb-5">
                <h2>{t("privacyChanges", "Changes to This Privacy Policy")}</h2>
                <p>
                  {t("privacyChangesContent",
                    "We may update this Privacy Policy from time to time. We will notify you of any significant changes by posting the new Privacy Policy on this page and updating the \"Last Updated\" date at the top."
                  )}
                </p>
              </section>

              <section className="mb-5">
                <h2>{t("contactUs", "Contact Us")}</h2>
                <p>
                  {t("privacyContactContent",
                    "If you have any questions or concerns about this Privacy Policy, please contact us at:"
                  )}
                </p>
                <p>
                  Email: privacy@mandarin.example.com<br />
                  Address: 123 Privacy Street, Tel Aviv, Israel
                </p>
              </section>

              <div className="policy-footer">
                <Link to="/" className="btn btn-outline-primary">{t("backToHome", "Back to Home")}</Link>
                <div className="policy-links">
                  <Link to="/about">{t("aboutUs", "About Us")}</Link>
                  <Link to="/terms">{t("termsOfService", "Terms of Service")}</Link>
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

export default Privacy;
