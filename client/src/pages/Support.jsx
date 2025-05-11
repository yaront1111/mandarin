import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../context";
import { SEO } from "../components";
import { FaEnvelope, FaPhone, FaComments, FaQuestionCircle, FaAngleDown, FaAngleUp } from "react-icons/fa";
import { createLogger } from "../utils/logger";
import "../styles/pages.css";

const logger = createLogger('Support');

const Support = () => {
  const { t } = useTranslation();
  const { dir } = useLanguage();
  const [activeTab, setActiveTab] = useState("contact");
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [formSubmitted, setFormSubmitted] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // In a real app, you would send the form data to your backend
    logger.info("Form submitted:", formData);
    setFormSubmitted(true);
    // Reset form after submission
    setFormData({ name: "", email: "", subject: "", message: "" });
    // Show success message for 3 seconds
    setTimeout(() => {
      setFormSubmitted(false);
    }, 3000);
  };

  const toggleFaq = (index) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  const faqs = [
    {
      question: t("faq1Question", "How do I create an account?"),
      answer: t("faq1Answer", "To create an account, click on the 'Register' button on the homepage. Fill out your details, upload a profile photo, and set your preferences. Once you verify your email, your account will be activated."),
    },
    {
      question: t("faq2Question", "How can I change my account settings?"),
      answer: t("faq2Answer", "Navigate to the 'Settings' page after logging in. There, you can update your profile information, notification preferences, privacy settings, and account details."),
    },
    {
      question: t("faq3Question", "Is my personal information secure?"),
      answer: t("faq3Answer", "Yes, we take security very seriously. We use encryption to protect your data and never share your personal information with third parties without your consent. For more details, please review our Privacy Policy."),
    },
    {
      question: t("faq4Question", "How do I cancel my subscription?"),
      answer: t("faq4Answer", "To cancel your subscription, go to 'Settings > Subscription' and click on 'Cancel Subscription'. Your premium benefits will remain active until the end of your current billing period."),
    },
    {
      question: t("faq5Question", "How can I report inappropriate behavior?"),
      answer: t("faq5Answer", "If you encounter inappropriate behavior, use the 'Report' button on the user's profile or in the message thread. Our moderation team will review the report and take appropriate action within 24 hours."),
    },
    {
      question: t("faq6Question", "What should I do if I forget my password?"),
      answer: t("faq6Answer", "On the login page, click 'Forgot Password'. Enter your email address, and we'll send you instructions to reset your password. For security reasons, the reset link expires after 24 hours."),
    },
    {
      question: t("faq7Question", "How do I delete my account?"),
      answer: t("faq7Answer", "Go to 'Settings > Account' and scroll to the bottom where you'll find the 'Delete Account' option. Please note that account deletion is permanent and cannot be undone."),
    },
  ];

  // Define schema for structured data
  const supportSchema = {
    "@context": "https://schema.org",
    "@type": "CustomerService",
    "name": "Flirtss Support",
    "url": "https://flirtss.com/support",
    "email": "support@flirtss.com",
    "telephone": "+972 12 345 6789",
    "availableLanguage": ["English", "Hebrew"],
    "hoursAvailable": "Mo-Fr 09:00-18:00",
    "contactType": "customer support"
  };

  return (
    <div className="policy-page-container" dir={dir}>
      <SEO 
        title="Support Center"
        description="Get help with your Mandarin Dating account. Contact our support team, find answers to frequently asked questions, and troubleshoot common issues."
        schema={supportSchema}
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
              <h1 className="policy-title gradient-text">{t("supportTitle", "Support Center")}</h1>
              
              {/* Support Tabs */}
              <div className="support-tabs mb-4">
                <button 
                  className={`support-tab ${activeTab === "contact" ? "active" : ""}`}
                  onClick={() => setActiveTab("contact")}
                >
                  <FaEnvelope className="tab-icon" />
                  {t("contactUs", "Contact Us")}
                </button>
                <button 
                  className={`support-tab ${activeTab === "faq" ? "active" : ""}`}
                  onClick={() => setActiveTab("faq")}
                >
                  <FaQuestionCircle className="tab-icon" />
                  {t("faq", "FAQ")}
                </button>
              </div>

              {/* Contact Form */}
              {activeTab === "contact" && (
                <div className="support-content">
                  <div className="contact-info mb-4">
                    <div className="contact-methods">
                      <div className="contact-method">
                        <FaEnvelope className="contact-icon" />
                        <div>
                          <h3>{t("email", "Email")}</h3>
                          <p>support@mandarin.example.com</p>
                        </div>
                      </div>
                      <div className="contact-method">
                        <FaPhone className="contact-icon" />
                        <div>
                          <h3>{t("phone", "Phone")}</h3>
                          <p>+972 12 345 6789</p>
                        </div>
                      </div>
                      <div className="contact-method">
                        <FaComments className="contact-icon" />
                        <div>
                          <h3>{t("liveChat", "Live Chat")}</h3>
                          <p>{t("liveChatHours", "Available 9AM-6PM IST")}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <h2 className="mb-4">{t("contactForm", "Send Us a Message")}</h2>
                  {formSubmitted ? (
                    <div className="alert alert-success">
                      {t("formSuccess", "Thank you! Your message has been sent. We'll get back to you soon.")}
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="support-form">
                      <div className="form-group mb-3">
                        <label htmlFor="name">{t("formName", "Your Name")}</label>
                        <input
                          type="text"
                          id="name"
                          name="name"
                          className="form-control"
                          value={formData.name}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      <div className="form-group mb-3">
                        <label htmlFor="email">{t("formEmail", "Email Address")}</label>
                        <input
                          type="email"
                          id="email"
                          name="email"
                          className="form-control"
                          value={formData.email}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      <div className="form-group mb-3">
                        <label htmlFor="subject">{t("formSubject", "Subject")}</label>
                        <input
                          type="text"
                          id="subject"
                          name="subject"
                          className="form-control"
                          value={formData.subject}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      <div className="form-group mb-3">
                        <label htmlFor="message">{t("formMessage", "Message")}</label>
                        <textarea
                          id="message"
                          name="message"
                          className="form-control"
                          rows="5"
                          value={formData.message}
                          onChange={handleInputChange}
                          required
                        ></textarea>
                      </div>
                      <button type="submit" className="btn btn-primary">
                        {t("formSubmit", "Send Message")}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* FAQ */}
              {activeTab === "faq" && (
                <div className="support-content">
                  <h2 className="mb-4">{t("frequentlyAskedQuestions", "Frequently Asked Questions")}</h2>
                  <div className="faq-list">
                    {faqs.map((faq, index) => (
                      <div key={index} className={`faq-item ${expandedFaq === index ? "expanded" : ""}`}>
                        <div className="faq-question" onClick={() => toggleFaq(index)}>
                          <h3>{faq.question}</h3>
                          {expandedFaq === index ? <FaAngleUp /> : <FaAngleDown />}
                        </div>
                        {expandedFaq === index && (
                          <div className="faq-answer">
                            <p>{faq.answer}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="policy-footer">
                <Link to="/" className="btn btn-outline-primary">{t("backToHome", "Back to Home")}</Link>
                <div className="policy-links">
                  <Link to="/about">{t("aboutUs", "About Us")}</Link>
                  <Link to="/privacy">{t("privacyPolicy", "Privacy Policy")}</Link>
                  <Link to="/terms">{t("termsOfService", "Terms of Service")}</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Support;