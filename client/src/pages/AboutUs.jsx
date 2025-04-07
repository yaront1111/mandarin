import React from 'react';
import { Helmet } from '../components';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import { Link } from 'react-router-dom';

const AboutUs = () => {
  const { t } = useTranslation();
  const { isRTL, language } = useLanguage();
  
  return (
    <div className={`about-page container py-5 ${isRTL ? 'rtl-layout' : ''}`}>
      <Helmet
        title={t('aboutUs.pageTitle', 'About Us - Mandarin Dating')}
        description={t('aboutUs.metaDescription', 'Learn about Mandarin Dating, our mission, our team, and how we help people connect in meaningful ways.')}
        htmlAttributes={{ lang: language, dir: isRTL ? "rtl" : "ltr" }}
      />
      
      <header className="text-center mb-5">
        <h1 className="display-4 gradient-text mb-4">{t('aboutUs.title', 'About Us')}</h1>
        <p className="lead mb-0 text-secondary">{t('aboutUs.subtitle', 'Get to know the team behind Mandarin Dating')}</p>
      </header>
      
      <section className="mb-5">
        <div className="row align-items-center">
          <div className="col-lg-6">
            <div className="p-4">
              <h2 className="mb-4">{t('aboutUs.ourStory', 'Our Story')}</h2>
              <p className="mb-3">{t('aboutUs.storyPart1', 'Mandarin Dating was founded in 2020 with a simple mission: to create a platform where adults can form genuine, meaningful connections in a safe and respectful environment.')}</p>
              <p className="mb-3">{t('aboutUs.storyPart2', 'We recognized that many dating platforms focus solely on casual encounters or long-term relationships, but there was a gap for those seeking connections that combine passion with discretion.')}</p>
              <p>{t('aboutUs.storyPart3', 'Our team of developers, designers, and relationship experts came together to build a platform that understands the nuances of modern relationships and provides the tools needed to navigate them successfully.')}</p>
            </div>
          </div>
          <div className="col-lg-6">
            <div className="text-center p-4">
              <div className="about-image-container rounded-circle overflow-hidden mx-auto shadow-lg" style={{ width: '300px', height: '300px', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="image-placeholder py-5 px-4 text-center text-white">
                  <h3 className="h5 mb-3">{t('aboutUs.connecting', 'Connecting People')}</h3>
                  <p className="small mb-0">{t('aboutUs.connectingText', 'Building meaningful relationships in a digital world')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      <section className="mb-5 py-4 bg-light rounded-lg">
        <div className="container">
          <h2 className="text-center mb-4">{t('aboutUs.ourValues', 'Our Core Values')}</h2>
          <div className="row g-4">
            <div className="col-md-4">
              <div className="card h-100 border-0 shadow-sm">
                <div className="card-body text-center p-4">
                  <div className="value-icon mb-3 mx-auto rounded-circle d-flex align-items-center justify-content-center" style={{ width: '70px', height: '70px', backgroundColor: 'var(--primary-light)', color: 'white' }}>
                    <span className="h3 mb-0">1</span>
                  </div>
                  <h3 className="h5 mb-3">{t('aboutUs.value1Title', 'Privacy')}</h3>
                  <p className="card-text">{t('aboutUs.value1Text', 'We believe your dating life is your business. Our platform is built with privacy at its core, giving you control over who sees your information and how you connect.')}</p>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card h-100 border-0 shadow-sm">
                <div className="card-body text-center p-4">
                  <div className="value-icon mb-3 mx-auto rounded-circle d-flex align-items-center justify-content-center" style={{ width: '70px', height: '70px', backgroundColor: 'var(--primary-light)', color: 'white' }}>
                    <span className="h3 mb-0">2</span>
                  </div>
                  <h3 className="h5 mb-3">{t('aboutUs.value2Title', 'Authenticity')}</h3>
                  <p className="card-text">{t('aboutUs.value2Text', 'We encourage genuine connections based on honesty. Our verification systems help ensure you are connecting with real people who are looking for the same things you are.')}</p>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card h-100 border-0 shadow-sm">
                <div className="card-body text-center p-4">
                  <div className="value-icon mb-3 mx-auto rounded-circle d-flex align-items-center justify-content-center" style={{ width: '70px', height: '70px', backgroundColor: 'var(--primary-light)', color: 'white' }}>
                    <span className="h3 mb-0">3</span>
                  </div>
                  <h3 className="h5 mb-3">{t('aboutUs.value3Title', 'Respect')}</h3>
                  <p className="card-text">{t('aboutUs.value3Text', 'Every interaction on our platform should be respectful. We have zero tolerance for harassment or inappropriate behavior, ensuring a positive experience for all users.')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      <section className="mb-5">
        <h2 className="text-center mb-4">{t('aboutUs.howItWorks', 'How Mandarin Works')}</h2>
        <div className="row">
          <div className="col-lg-8 mx-auto">
            <div className="timeline">
              <div className="timeline-item mb-4 d-flex">
                <div className="timeline-marker rounded-circle" style={{ width: '40px', height: '40px', backgroundColor: 'var(--primary-light)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>1</div>
                <div className="timeline-content ms-4">
                  <h3 className="h5 mb-2">{t('aboutUs.step1Title', 'Create Your Profile')}</h3>
                  <p>{t('aboutUs.step1Text', 'Sign up and create a detailed profile that highlights your personality, interests, and what you\'re looking for. Add photos and verify your account to build trust.')}</p>
                </div>
              </div>
              <div className="timeline-item mb-4 d-flex">
                <div className="timeline-marker rounded-circle" style={{ width: '40px', height: '40px', backgroundColor: 'var(--primary-light)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>2</div>
                <div className="timeline-content ms-4">
                  <h3 className="h5 mb-2">{t('aboutUs.step2Title', 'Discover Matches')}</h3>
                  <p>{t('aboutUs.step2Text', 'Our advanced matching algorithm suggests compatible profiles based on your preferences, interests, and behavior on the platform.')}</p>
                </div>
              </div>
              <div className="timeline-item mb-4 d-flex">
                <div className="timeline-marker rounded-circle" style={{ width: '40px', height: '40px', backgroundColor: 'var(--primary-light)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>3</div>
                <div className="timeline-content ms-4">
                  <h3 className="h5 mb-2">{t('aboutUs.step3Title', 'Connect Securely')}</h3>
                  <p>{t('aboutUs.step3Text', 'Message your matches using our encrypted platform. Exchange photos, video chat, and build rapport before deciding to meet in person.')}</p>
                </div>
              </div>
              <div className="timeline-item d-flex">
                <div className="timeline-marker rounded-circle" style={{ width: '40px', height: '40px', backgroundColor: 'var(--primary-light)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>4</div>
                <div className="timeline-content ms-4">
                  <h3 className="h5 mb-2">{t('aboutUs.step4Title', 'Meet and Experience')}</h3>
                  <p>{t('aboutUs.step4Text', 'When you\'re ready, arrange to meet in person. Follow our safety guidelines to ensure a positive experience for everyone involved.')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      <section className="text-center mb-5">
        <h2 className="mb-4">{t('aboutUs.joinUs', 'Join Us Today')}</h2>
        <p className="lead mb-4">{t('aboutUs.joinUsText', 'Experience a dating platform that understands what you\'re looking for and helps you find it with privacy and respect.')}</p>
        <Link to="/register" className="btn btn-primary btn-lg">{t('aboutUs.getStarted', 'Get Started Now')}</Link>
      </section>
      
      <section className="py-4">
        <div className="row">
          <div className="col-md-4 mb-4 mb-md-0">
            <h3 className="h5 mb-3">{t('aboutUs.learnMore', 'Learn More')}</h3>
            <ul className="list-unstyled">
              <li className="mb-2"><Link to="/safety" className="text-decoration-none">{t('aboutUs.safetyTips', 'Safety Tips')}</Link></li>
              <li className="mb-2"><Link to="/privacy" className="text-decoration-none">{t('aboutUs.privacyPolicy', 'Privacy Policy')}</Link></li>
              <li className="mb-2"><Link to="/terms" className="text-decoration-none">{t('aboutUs.termsOfService', 'Terms of Service')}</Link></li>
            </ul>
          </div>
          <div className="col-md-4 mb-4 mb-md-0">
            <h3 className="h5 mb-3">{t('aboutUs.support', 'Support')}</h3>
            <ul className="list-unstyled">
              <li className="mb-2"><Link to="/support" className="text-decoration-none">{t('aboutUs.contactUs', 'Contact Us')}</Link></li>
              <li className="mb-2"><Link to="/faq" className="text-decoration-none">{t('aboutUs.faq', 'FAQ')}</Link></li>
              <li className="mb-2"><Link to="/feedback" className="text-decoration-none">{t('aboutUs.feedback', 'Give Feedback')}</Link></li>
            </ul>
          </div>
          <div className="col-md-4">
            <h3 className="h5 mb-3">{t('aboutUs.legal', 'Legal')}</h3>
            <ul className="list-unstyled">
              <li className="mb-2"><Link to="/cookies" className="text-decoration-none">{t('aboutUs.cookiePolicy', 'Cookie Policy')}</Link></li>
              <li className="mb-2"><Link to="/accessibility" className="text-decoration-none">{t('aboutUs.accessibility', 'Accessibility')}</Link></li>
              <li className="mb-2"><Link to="/sitemap" className="text-decoration-none">{t('aboutUs.sitemap', 'Sitemap')}</Link></li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutUs;