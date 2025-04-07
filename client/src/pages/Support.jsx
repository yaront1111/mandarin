import React, { useState } from 'react';
import { Helmet } from '../components';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import { Link } from 'react-router-dom';
import { FaHeadset, FaQuestionCircle, FaEnvelope, FaPaperPlane, FaUser, FaExclamationTriangle, FaInfoCircle, FaSearch, FaArrowRight, FaArrowLeft, FaCheck } from 'react-icons/fa';

const Support = () => {
  const { t } = useTranslation();
  const { isRTL, language } = useLanguage();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const handleSubmit = (e) => {
    e.preventDefault();
    // In a real implementation, send the form data to a backend
    // For now, we'll just simulate success
    setSubmitted(true);
    
    // Reset form
    setName('');
    setEmail('');
    setSubject('');
    setMessage('');
    
    // After 5 seconds, reset the submitted state
    setTimeout(() => {
      setSubmitted(false);
    }, 5000);
  };
  
  const handleSearch = (e) => {
    e.preventDefault();
    // In a real implementation, this would search the knowledge base
    alert(t('support.searchAlertText', 'Search functionality would be implemented in a production environment.'));
  };
  
  // Common Questions
  const faqItems = [
    {
      id: 1,
      question: t('support.faq1Question', 'How do I change my profile information?'),
      answer: t('support.faq1Answer', 'To update your profile, go to Settings > Profile. From there, you can edit your personal information, preferences, and photos. Click "Save" to confirm your changes.')
    },
    {
      id: 2,
      question: t('support.faq2Question', 'How do I cancel my subscription?'),
      answer: t('support.faq2Answer', 'To cancel your subscription, go to Settings > Subscription > Manage Subscription. Follow the prompts to cancel. Your premium features will remain active until the end of the current billing period.')
    },
    {
      id: 3,
      question: t('support.faq3Question', 'How can I report inappropriate behavior?'),
      answer: t('support.faq3Answer', 'You can report users by clicking the "Report" button on their profile or in your conversation. Please provide as much detail as possible to help our team investigate.')
    },
    {
      id: 4,
      question: t('support.faq4Question', 'Why was my photo rejected?'),
      answer: t('support.faq4Answer', 'Photos are rejected if they violate our content guidelines. This includes photos that are blurry, don\'t show your face clearly, contain inappropriate content, or include other people who haven\'t consented to be on the platform.')
    },
    {
      id: 5,
      question: t('support.faq5Question', 'How can I get verified?'),
      answer: t('support.faq5Answer', 'To verify your profile, go to Settings > Verification. You\'ll be prompted to take a selfie matching a specific pose. Our team will review it within 24-48 hours.')
    }
  ];
  
  return (
    <div className={`support-page container py-5 ${isRTL ? 'rtl-layout' : ''}`}>
      <Helmet
        title={t('support.pageTitle', 'Customer Support - Mandarin Dating')}
        description={t('support.metaDescription', 'Get help with your Mandarin Dating account. Browse our FAQ, knowledge base, or contact our support team for personalized assistance.')}
        htmlAttributes={{ lang: language, dir: isRTL ? "rtl" : "ltr" }}
      />
      
      <header className="text-center mb-5">
        <div className="support-icon mb-3 mx-auto" style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FaHeadset className="text-white" size={40} />
        </div>
        <h1 className="display-4 gradient-text mb-4">{t('support.title', 'Customer Support')}</h1>
        <p className="lead mb-0 text-secondary">{t('support.subtitle', 'We\'re here to help. Find answers to common questions or contact our support team.')}</p>
      </header>
      
      <section className="mb-5">
        <div className="row">
          <div className="col-lg-8 mx-auto">
            <div className="bg-light p-4 rounded-lg shadow-sm mb-4">
              <h2 className="h5 mb-3">{t('support.search', 'Search Our Knowledge Base')}</h2>
              <form onSubmit={handleSearch} className="d-flex">
                <div className="input-group">
                  <span className="input-group-text bg-white border-end-0">
                    <FaSearch className="text-muted" />
                  </span>
                  <input 
                    type="text" 
                    className="form-control border-start-0" 
                    placeholder={t('support.searchPlaceholder', 'Type your question here...')} 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <button type="submit" className="btn btn-primary">
                    {t('support.searchButton', 'Search')}
                  </button>
                </div>
              </form>
            </div>
            
            <div className="mb-5">
              <div className="d-flex align-items-center mb-4">
                <FaQuestionCircle className="me-2 text-primary" size={24} />
                <h2 className="h4 mb-0">{t('support.commonQuestions', 'Frequently Asked Questions')}</h2>
              </div>
              
              <div className="accordion" id="faqAccordion">
                {faqItems.map((item) => (
                  <div className="accordion-item mb-3 border rounded overflow-hidden" key={item.id}>
                    <h3 className="accordion-header" id={`heading${item.id}`}>
                      <button 
                        className="accordion-button collapsed" 
                        type="button" 
                        data-bs-toggle="collapse" 
                        data-bs-target={`#collapse${item.id}`} 
                        aria-expanded="false" 
                        aria-controls={`collapse${item.id}`}
                      >
                        {item.question}
                      </button>
                    </h3>
                    <div 
                      id={`collapse${item.id}`} 
                      className="accordion-collapse collapse" 
                      aria-labelledby={`heading${item.id}`} 
                      data-bs-parent="#faqAccordion"
                    >
                      <div className="accordion-body">
                        <p className="mb-0">{item.answer}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="text-center mt-4">
                <Link to="/faq" className="btn btn-outline-primary">
                  {t('support.viewAllFaq', 'View All FAQs')} {isRTL ? <FaArrowLeft className="ms-2" /> : <FaArrowRight className="ms-2" />}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      <section className="mb-5">
        <div className="row">
          <div className="col-lg-8 mx-auto">
            <div className="card border-0 shadow">
              <div className="card-body p-4">
                <div className="d-flex align-items-center mb-4">
                  <FaEnvelope className="me-2 text-primary" size={24} />
                  <h2 className="h4 mb-0">{t('support.contactUs', 'Contact Us')}</h2>
                </div>
                
                {submitted ? (
                  <div className="text-center p-4">
                    <div className="success-icon mb-3 mx-auto" style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FaCheck className="text-white" size={30} />
                    </div>
                    <h3 className="h5 mb-3">{t('support.messageSent', 'Message Sent Successfully!')}</h3>
                    <p className="mb-0">{t('support.responsePromise', 'Thank you for contacting us. We\'ll respond to your inquiry within 24-48 hours.')}</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit}>
                    <div className="row g-3">
                      <div className="col-md-6 mb-3">
                        <label htmlFor="name" className="form-label">{t('support.name', 'Your Name')}</label>
                        <div className="input-group">
                          <span className="input-group-text bg-white border-end-0">
                            <FaUser className="text-muted" />
                          </span>
                          <input 
                            type="text" 
                            className="form-control border-start-0" 
                            id="name" 
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required 
                          />
                        </div>
                      </div>
                      
                      <div className="col-md-6 mb-3">
                        <label htmlFor="email" className="form-label">{t('support.email', 'Email Address')}</label>
                        <div className="input-group">
                          <span className="input-group-text bg-white border-end-0">
                            <FaEnvelope className="text-muted" />
                          </span>
                          <input 
                            type="email" 
                            className="form-control border-start-0" 
                            id="email" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required 
                          />
                        </div>
                      </div>
                      
                      <div className="col-12 mb-3">
                        <label htmlFor="subject" className="form-label">{t('support.subject', 'Subject')}</label>
                        <select 
                          className="form-select" 
                          id="subject"
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                          required
                        >
                          <option value="">{t('support.selectSubject', 'Select a subject...')}</option>
                          <option value="account">{t('support.subjectAccount', 'Account Issues')}</option>
                          <option value="billing">{t('support.subjectBilling', 'Billing Questions')}</option>
                          <option value="report">{t('support.subjectReport', 'Report a User')}</option>
                          <option value="feedback">{t('support.subjectFeedback', 'Feedback & Suggestions')}</option>
                          <option value="technical">{t('support.subjectTechnical', 'Technical Support')}</option>
                          <option value="other">{t('support.subjectOther', 'Other')}</option>
                        </select>
                      </div>
                      
                      <div className="col-12 mb-3">
                        <label htmlFor="message" className="form-label">{t('support.message', 'Your Message')}</label>
                        <textarea 
                          className="form-control" 
                          id="message" 
                          rows="5"
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          required
                        ></textarea>
                      </div>
                      
                      <div className="col-12">
                        <button type="submit" className="btn btn-primary d-flex align-items-center">
                          <FaPaperPlane className="me-2" />
                          {t('support.sendMessage', 'Send Message')}
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
      
      <section className="mb-5">
        <div className="row">
          <div className="col-lg-8 mx-auto">
            <div className="bg-light p-4 rounded-lg">
              <div className="d-flex mb-3">
                <div className="me-3 fs-4 text-warning"><FaExclamationTriangle /></div>
                <div>
                  <h3 className="h5">{t('support.reportIssue', 'Report a Serious Safety Issue')}</h3>
                  <p className="mb-0">{t('support.emergencyContact', 'For urgent safety concerns or to report harmful behavior, please contact our Trust & Safety team directly at safety@mandarin.com or call our emergency helpline at +972-XX-XXX-XXXX.')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      <section className="py-4 border-top mt-5">
        <div className="row">
          <div className="col-md-4 mb-4 mb-md-0">
            <div className="d-flex align-items-center mb-3">
              <FaInfoCircle className="me-2 text-primary" />
              <h3 className="h5 mb-0">{t('support.helpfulResources', 'Helpful Resources')}</h3>
            </div>
            <ul className="list-unstyled ps-4">
              <li className="mb-2"><Link to="/safety" className="text-decoration-none">{t('support.safetyTips', 'Safety Tips')}</Link></li>
              <li className="mb-2"><Link to="/privacy" className="text-decoration-none">{t('support.privacySettings', 'Privacy Settings Guide')}</Link></li>
              <li className="mb-2"><Link to="/verification" className="text-decoration-none">{t('support.verificationGuide', 'Profile Verification Guide')}</Link></li>
              <li className="mb-2"><Link to="/terms" className="text-decoration-none">{t('support.termsOfService', 'Terms of Service')}</Link></li>
            </ul>
          </div>
          
          <div className="col-md-4 mb-4 mb-md-0">
            <div className="d-flex align-items-center mb-3">
              <FaHeadset className="me-2 text-primary" />
              <h3 className="h5 mb-0">{t('support.supportHours', 'Support Hours')}</h3>
            </div>
            <ul className="list-unstyled ps-4">
              <li className="mb-2">{t('support.mondayFriday', 'Monday-Friday: 8:00 AM - 10:00 PM IST')}</li>
              <li className="mb-2">{t('support.saturday', 'Saturday: 10:00 AM - 6:00 PM IST')}</li>
              <li className="mb-2">{t('support.sunday', 'Sunday: 10:00 AM - 6:00 PM IST')}</li>
              <li className="mb-2">{t('support.holidayHours', 'Holiday hours may vary')}</li>
            </ul>
          </div>
          
          <div className="col-md-4">
            <div className="d-flex align-items-center mb-3">
              <FaEnvelope className="me-2 text-primary" />
              <h3 className="h5 mb-0">{t('support.emailUs', 'Email Us')}</h3>
            </div>
            <ul className="list-unstyled ps-4">
              <li className="mb-2">{t('support.generalInquiries', 'General Inquiries:')}<br />
                <a href="mailto:support@mandarin.com" className="text-decoration-none">support@mandarin.com</a>
              </li>
              <li className="mb-2">{t('support.technicalSupport', 'Technical Support:')}<br />
                <a href="mailto:tech@mandarin.com" className="text-decoration-none">tech@mandarin.com</a>
              </li>
              <li className="mb-2">{t('support.privacyQuestions', 'Privacy Questions:')}<br />
                <a href="mailto:privacy@mandarin.com" className="text-decoration-none">privacy@mandarin.com</a>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Support;