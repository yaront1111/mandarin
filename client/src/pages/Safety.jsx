import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../context";
import { SEO } from "../components";
import { FaShieldAlt, FaLock, FaUserShield, FaExclamationTriangle, FaCheck } from "react-icons/fa";
import "../styles/pages.css";

const Safety = () => {
  const { t } = useTranslation();
  const { dir } = useLanguage();

  // Define schema for structured data
  const safetySchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "How does Flirtss protect my privacy?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Flirtss uses end-to-end encryption for all personal data, gives you control over who sees your photos and profile information, provides precise control over location sharing, and offers customizable privacy settings."
        }
      },
      {
        "@type": "Question",
        "name": "What should I do if I encounter inappropriate behavior?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Use the 'Report' button on the user's profile or in your chat conversation, contact our support team which is available 24/7, and in case of immediate danger or threats, contact your local authorities first."
        }
      },
      {
        "@type": "Question",
        "name": "How does Flirtss verify users?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Flirtss employs multiple verification methods including photo verification technology, email verification, phone number verification, and a profile review process. Look for the verified badge on profiles to identify users who have completed our verification process."
        }
      }
    ]
  };

  return (
    <div className="policy-page-container" dir={dir}>
      <SEO 
        title="Safety & Privacy Guidelines"
        description="Learn about Mandarin Dating's comprehensive safety measures, privacy protection features, and guidelines for staying safe while using our platform."
        schema={safetySchema}
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
              <h1 className="policy-title gradient-text">{t("safetyTitle", "Safety & Privacy")}</h1>
              
              <section className="mb-5">
                <div className="safety-icon-container">
                  <FaShieldAlt className="safety-main-icon" />
                </div>
                <h2>{t("safetyIntroduction", "Your Safety is Our Priority")}</h2>
                <p>
                  {t("safetyIntroContent",
                    "At Mandarin, we are committed to creating a safe, secure, and respectful environment for all our users. We have implemented comprehensive safety measures to protect your privacy and ensure positive interactions. This page outlines our commitment to your safety and provides resources to help you stay safe while using our platform."
                  )}
                </p>
              </section>

              <section className="mb-5">
                <h2 className="d-flex align-items-center">
                  <FaLock className="section-icon" />
                  {t("privacyProtection", "Privacy Protection")}
                </h2>
                <p>
                  {t("privacyContent",
                    "Your personal information is safeguarded by industry-leading security measures:"
                  )}
                </p>
                <ul className="safety-checklist">
                  <li>
                    <FaCheck className="check-icon" />
                    {t("dataEncryption", "End-to-end encryption for all personal data")}
                  </li>
                  <li>
                    <FaCheck className="check-icon" />
                    {t("photoPrivacy", "Control over who sees your photos and profile information")}
                  </li>
                  <li>
                    <FaCheck className="check-icon" />
                    {t("locationControl", "Precise control over your location sharing")}
                  </li>
                  <li>
                    <FaCheck className="check-icon" />
                    {t("privacySettings", "Customizable privacy settings for your comfort level")}
                  </li>
                </ul>
                <p>
                  {t("reviewPrivacyPolicy",
                    "For more details on how we handle your data, please review our"
                  )} <Link to="/privacy" className="text-link">{t("privacyPolicyLink", "Privacy Policy")}</Link>.
                </p>
              </section>

              <section className="mb-5">
                <h2 className="d-flex align-items-center">
                  <FaUserShield className="section-icon" />
                  {t("onlineSafety", "Online Safety Tips")}
                </h2>
                <p>
                  {t("tipsIntro",
                    "While we work hard to maintain a safe platform, it's important to follow these safety guidelines:"
                  )}
                </p>
                
                <div className="safety-tips-grid">
                  <div className="safety-tip">
                    <h3>{t("meetingTip", "Meeting In Person")}</h3>
                    <ul>
                      <li>{t("meetPublic", "Always meet in a public place for your first meeting")}</li>
                      <li>{t("tellFriend", "Tell a friend or family member about your plans")}</li>
                      <li>{t("stayingSober", "Stay sober and clear-headed during initial meetings")}</li>
                      <li>{t("ownTransport", "Arrange your own transportation to and from the meeting")}</li>
                    </ul>
                  </div>
                  
                  <div className="safety-tip">
                    <h3>{t("personalInfoTip", "Protecting Personal Information")}</h3>
                    <ul>
                      <li>{t("limitInfo", "Limit personal information in your profile and messages")}</li>
                      <li>{t("noFinancial", "Never share financial information or send money")}</li>
                      <li>{t("privateComm", "Keep communications on the platform until you build trust")}</li>
                      <li>{t("socialMedia", "Be cautious about connecting on social media too quickly")}</li>
                    </ul>
                  </div>
                  
                  <div className="safety-tip">
                    <h3>{t("recognizeTip", "Recognizing Red Flags")}</h3>
                    <ul>
                      <li>{t("inconsistencies", "Be wary of inconsistencies in someone's story")}</li>
                      <li>{t("rushingRelationship", "Be cautious of someone rushing the relationship")}</li>
                      <li>{t("avoidingQuestions", "Watch for avoidance of direct questions")}</li>
                      <li>{t("requestingMoney", "Be alert if someone requests money for any reason")}</li>
                    </ul>
                  </div>
                  
                  <div className="safety-tip">
                    <h3>{t("respectTip", "Respectful Communication")}</h3>
                    <ul>
                      <li>{t("consentMatters", "Always respect boundaries and consent")}</li>
                      <li>{t("politeDecline", "Politely decline interests that don't match yours")}</li>
                      <li>{t("reportHarassment", "Report any harassment or inappropriate messages")}</li>
                      <li>{t("blockOption", "Use the block feature if someone makes you uncomfortable")}</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section className="mb-5">
                <h2 className="d-flex align-items-center">
                  <FaExclamationTriangle className="section-icon" />
                  {t("reportingIssues", "Reporting Issues")}
                </h2>
                <p>
                  {t("reportingContent",
                    "Your safety is our priority. If you encounter inappropriate behavior, we encourage you to report it immediately:"
                  )}
                </p>
                <ol className="safety-reporting">
                  <li>
                    <strong>{t("reportingUser", "Report a User")}:</strong> {t("reportingUserDetails", "Use the 'Report' button on their profile or in your chat conversation")}
                  </li>
                  <li>
                    <strong>{t("reportingContact", "Contact Support")}:</strong> {t("reportingContactDetails", "Our support team is available 24/7 to assist with urgent safety concerns")}
                  </li>
                  <li>
                    <strong>{t("reportingAuthorities", "Contact Authorities")}:</strong> {t("reportingAuthoritiesDetails", "In case of immediate danger or threats, please contact local authorities first")}
                  </li>
                </ol>
                <div className="safety-alert">
                  <p>
                    <strong>{t("emergencySituations", "For emergency situations")}: </strong>
                    {t("emergencyContact", "Contact your local emergency services immediately, then notify our support team so we can take appropriate action on our platform.")}
                  </p>
                </div>
              </section>

              <section className="mb-5">
                <h2>{t("verification", "User Verification")}</h2>
                <p>
                  {t("verificationContent",
                    "We employ multiple verification methods to ensure the authenticity of our users:"
                  )}
                </p>
                <ul className="safety-checklist">
                  <li>
                    <FaCheck className="check-icon" />
                    {t("photoVerification", "Photo verification technology")}
                  </li>
                  <li>
                    <FaCheck className="check-icon" />
                    {t("emailVerification", "Email verification")}
                  </li>
                  <li>
                    <FaCheck className="check-icon" />
                    {t("phoneVerification", "Phone number verification")}
                  </li>
                  <li>
                    <FaCheck className="check-icon" />
                    {t("profileReview", "Profile review process")}
                  </li>
                </ul>
                <p>
                  {t("verificationBadge",
                    "Look for the verified badge on profiles to identify users who have completed our verification process."
                  )}
                </p>
              </section>

              <section className="mb-5">
                <h2>{t("contactSafetyTeam", "Contact Our Safety Team")}</h2>
                <p>
                  {t("safetyContactContent",
                    "If you have safety concerns or suggestions, our dedicated safety team is here to help:"
                  )}
                </p>
                <p>
                  Email: safety@mandarin.example.com<br />
                  Support: <Link to="/support" className="text-link">{t("supportCenter", "Support Center")}</Link>
                </p>
              </section>

              <div className="policy-footer">
                <Link to="/" className="btn btn-outline-primary">{t("backToHome", "Back to Home")}</Link>
                <div className="policy-links">
                  <Link to="/about">{t("aboutUs", "About Us")}</Link>
                  <Link to="/privacy">{t("privacyPolicy", "Privacy Policy")}</Link>
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

export default Safety;