import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../context";
import { SEO } from "../components";
import "../styles/pages.css";

const Terms = () => {
  const { t } = useTranslation();
  const { dir } = useLanguage();

  // Define schema for structured data
  const termsSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Terms of Service - Flirtss",
    "description": "Terms and conditions for using the Flirtss platform.",
    "url": "https://flirtss.com/terms",
    "mainEntity": {
      "@type": "Article",
      "name": "Flirtss Terms of Service",
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
        title="Terms of Service"
        description="Read the Mandarin Dating terms of service, including user eligibility, account rules, acceptable conduct, and subscription terms."
        schema={termsSchema}
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
              <h1 className="policy-title gradient-text">{t("terms.title", "Terms of Service")}</h1>
              <p className="policy-last-updated">
                {t("terms.lastUpdated", "Last Updated")}: {t("terms.updateDate", "April 15, 2024")}
              </p>
              
              <section className="mb-5">
                <h2>{t("terms.introduction", "Introduction")}</h2>
                <p>
                  {t("terms.introContent", 
                    "Welcome to Mandarin. These Terms of Service (\"Terms\") govern your access to and use of the Mandarin application and website (the \"Service\"). Please read these Terms carefully before using our Service."
                  )}
                </p>
                <p>
                  {t("terms.introAgreement", 
                    "By accessing or using the Service, you agree to be bound by these Terms. If you do not agree to all the terms and conditions, you may not access or use the Service."
                  )}
                </p>
              </section>

              <section className="mb-5">
                <h2>{t("terms.eligibility", "Eligibility")}</h2>
                <p>
                  {t("terms.eligibilityContent", 
                    "You must be at least 18 years old to use the Service. By using the Service, you represent and warrant that you meet all eligibility requirements. The Service is not available to previously removed users or those who have had their account suspended."
                  )}
                </p>
              </section>

              <section className="mb-5">
                <h2>{t("terms.accountCreation", "Account Creation and Security")}</h2>
                <p>
                  {t("terms.accountContent", 
                    "To use certain features of the Service, you must register for an account. You agree to provide accurate and complete information and to keep this information up to date. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account."
                  )}
                </p>
                <p>
                  {t("terms.accountSecurity", 
                    "You are solely responsible for safeguarding your password and agree to notify us immediately of any unauthorized use of your account. We reserve the right to close your account at any time for any or no reason."
                  )}
                </p>
              </section>

              <section className="mb-5">
                <h2>{t("terms.userConduct", "User Conduct")}</h2>
                <p>
                  {t("terms.conductIntro", 
                    "You agree not to engage in any of the following prohibited activities:"
                  )}
                </p>
                <ul>
                  <li>
                    {t("terms.conductViolate", 
                      "Violating any laws, regulations, or third party rights"
                    )}
                  </li>
                  <li>
                    {t("terms.conductHarassment", 
                      "Engaging in harassment, intimidation, or abusive behavior toward other users"
                    )}
                  </li>
                  <li>
                    {t("terms.conductFalse", 
                      "Providing false or misleading information or creating a false identity"
                    )}
                  </li>
                  <li>
                    {t("terms.conductSecurity", 
                      "Attempting to circumvent security features or access parts of the Service for which you do not have permission"
                    )}
                  </li>
                  <li>
                    {t("terms.conductSolicitation", 
                      "Using the Service for commercial solicitation without our prior written consent"
                    )}
                  </li>
                  <li>
                    {t("terms.conductHarmful", 
                      "Posting or transmitting malicious code or content that could harm our systems or other users"
                    )}
                  </li>
                </ul>
              </section>

              <section className="mb-5">
                <h2>{t("terms.contentRights", "Content and Intellectual Property Rights")}</h2>
                <p>
                  {t("terms.contentOwnership", 
                    "The Service and its original content, features, and functionality are owned by Mandarin and are protected by international copyright, trademark, and other intellectual property laws."
                  )}
                </p>
                <p>
                  {t("terms.userContent", 
                    "By submitting content to the Service, you grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, modify, adapt, publish, translate, and distribute your content in connection with providing the Service."
                  )}
                </p>
                <p>
                  {t("terms.contentResponsibility", 
                    "You are solely responsible for the content you post and warrant that you have all necessary rights to post such content."
                  )}
                </p>
              </section>

              <section className="mb-5">
                <h2>{t("terms.subscriptions", "Subscriptions and Payments")}</h2>
                <p>
                  {t("terms.subscriptionContent", 
                    "Some features of the Service may require a subscription. By subscribing, you agree to pay the fees in accordance with our payment terms. You authorize us to charge the payment method you provide for the subscription fees."
                  )}
                </p>
                <p>
                  {t("terms.subscriptionRenewal", 
                    "Subscriptions automatically renew unless you cancel before the renewal date. You can cancel your subscription at any time through your account settings."
                  )}
                </p>
                <p>
                  {t("terms.subscriptionRefund", 
                    "Payments are non-refundable except where required by law or as expressly stated in our refund policy."
                  )}
                </p>
              </section>

              <section className="mb-5">
                <h2>{t("terms.termination", "Termination")}</h2>
                <p>
                  {t("terms.terminationContent", 
                    "We may terminate or suspend your account and access to the Service immediately, without prior notice or liability, for any reason, including if you breach these Terms."
                  )}
                </p>
                <p>
                  {t("terms.terminationEffect", 
                    "Upon termination, your right to use the Service will immediately cease. All provisions of these Terms which by their nature should survive termination shall survive termination."
                  )}
                </p>
              </section>

              <section className="mb-5">
                <h2>{t("terms.disclaimer", "Disclaimer")}</h2>
                <p>
                  {t("terms.disclaimerContent", 
                    "THE SERVICE IS PROVIDED \"AS IS\" AND \"AS AVAILABLE\" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO, IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT."
                  )}
                </p>
              </section>

              <section className="mb-5">
                <h2>{t("terms.limitation", "Limitation of Liability")}</h2>
                <p>
                  {t("terms.limitationContent", 
                    "TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL MANDARIN BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM YOUR ACCESS TO OR USE OF OR INABILITY TO ACCESS OR USE THE SERVICE."
                  )}
                </p>
              </section>

              <section className="mb-5">
                <h2>{t("terms.changes", "Changes to Terms")}</h2>
                <p>
                  {t("terms.changesContent", 
                    "We reserve the right to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion."
                  )}
                </p>
              </section>

              <section className="mb-5">
                <h2>{t("terms.contactUs", "Contact Us")}</h2>
                <p>
                  {t("terms.contactContent", 
                    "If you have any questions about these Terms, please contact us at:"
                  )}
                </p>
                <p>
                  Email: legal@mandarin.example.com<br />
                  Address: 123 Legal Street, Tel Aviv, Israel
                </p>
              </section>

              <div className="policy-footer">
                <Link to="/" className="btn btn-outline-primary">{t("common.backToHome", "Back to Home")}</Link>
                <div className="policy-links">
                  <Link to="/about">{t("common.aboutUs", "About Us")}</Link>
                  <Link to="/privacy">{t("common.privacyPolicy", "Privacy Policy")}</Link>
                  <Link to="/support">{t("common.contactSupport", "Contact Support")}</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Terms;
