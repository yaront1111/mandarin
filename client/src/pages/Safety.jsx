import React from 'react';
import { Helmet } from '../components';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import { Link } from 'react-router-dom';
import { FaShieldAlt, FaLock, FaUserShield, FaExclamationTriangle, FaHandPaper, FaEye, FaMapMarkerAlt, FaCocktail, FaPhone, FaHeartbeat } from 'react-icons/fa';

const Safety = () => {
  const { t } = useTranslation();
  const { isRTL, language } = useLanguage();
  
  return (
    <div className={`safety-page container py-5 ${isRTL ? 'rtl-layout' : ''}`}>
      <Helmet
        title={t('safety.pageTitle', 'Safety Guidelines - Mandarin Dating')}
        description={t('safety.metaDescription', 'Safety first! Learn about how to stay safe while using Mandarin Dating, both online and when meeting in person.')}
        htmlAttributes={{ lang: language, dir: isRTL ? "rtl" : "ltr" }}
      />
      
      <header className="text-center mb-5">
        <div className="safety-icon mb-3 mx-auto" style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FaShieldAlt className="text-white" size={40} />
        </div>
        <h1 className="display-4 gradient-text mb-4">{t('safety.title', 'Safety First')}</h1>
        <p className="lead mb-0 text-secondary">{t('safety.subtitle', 'Your safety is our top priority. Follow these guidelines to ensure a secure and enjoyable experience.')}</p>
      </header>
      
      <section className="mb-5">
        <div className="row">
          <div className="col-lg-8 mx-auto">
            <div className="alert alert-primary mb-4">
              <div className="d-flex">
                <div className="me-3 fs-4"><FaExclamationTriangle /></div>
                <div>
                  <p className="mb-0"><strong>{t('safety.important', 'Important:')}</strong> {t('safety.mainWarning', 'While we work hard to maintain a safe platform, always use your best judgment and prioritize your personal safety when using dating services.')}</p>
                </div>
              </div>
            </div>
            
            <p className="mb-4">{t('safety.introduction', 'At Mandarin Dating, we are committed to creating a safe environment for all our users. However, meeting new people always comes with some risks. This guide provides essential safety tips for both online interactions and in-person meetings.')}</p>
          </div>
        </div>
      </section>
      
      <section className="mb-5">
        <h2 className="text-center mb-4">{t('safety.onlineSafety', 'Online Safety')}</h2>
        <div className="row g-4">
          <div className="col-md-6">
            <div className="card h-100 border-0 shadow-sm">
              <div className="card-body p-4">
                <div className="d-flex align-items-center mb-3">
                  <div className="safety-tip-icon me-3" style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FaLock className="text-white" size={24} />
                  </div>
                  <h3 className="h5 mb-0">{t('safety.protectPrivacy', 'Protect Your Privacy')}</h3>
                </div>
                <ul className="ps-3">
                  <li>{t('safety.privacyTip1', 'Never share personal information (full name, address, workplace, financial details) with someone you have just met online.')}</li>
                  <li>{t('safety.privacyTip2', 'Use the platform messaging system until you build sufficient trust to move to other communication channels.')}</li>
                  <li>{t('safety.privacyTip3', 'Be careful about sharing photos that could reveal your location or routine.')}</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="col-md-6">
            <div className="card h-100 border-0 shadow-sm">
              <div className="card-body p-4">
                <div className="d-flex align-items-center mb-3">
                  <div className="safety-tip-icon me-3" style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FaUserShield className="text-white" size={24} />
                  </div>
                  <h3 className="h5 mb-0">{t('safety.spotRedFlags', 'Spot Red Flags')}</h3>
                </div>
                <ul className="ps-3">
                  <li>{t('safety.redFlag1', 'Be wary of profiles with very few photos or generic descriptions.')}</li>
                  <li>{t('safety.redFlag2', 'Watch out for users who ask for money or financial assistance, regardless of the reason.')}</li>
                  <li>{t('safety.redFlag3', 'Be cautious if someone pressures you to move to another platform or meet in person very quickly.')}</li>
                  <li>{t('safety.redFlag4', 'Trust your instincts - if something feels off, it probably is.')}</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="col-md-6">
            <div className="card h-100 border-0 shadow-sm">
              <div className="card-body p-4">
                <div className="d-flex align-items-center mb-3">
                  <div className="safety-tip-icon me-3" style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FaHandPaper className="text-white" size={24} />
                  </div>
                  <h3 className="h5 mb-0">{t('safety.respectBoundaries', 'Respect Boundaries')}</h3>
                </div>
                <ul className="ps-3">
                  <li>{t('safety.boundaries1', 'Always communicate respectfully, even if you are not interested or the conversation is not going as expected.')}</li>
                  <li>{t('safety.boundaries2', 'Never pressure someone to share photos, personal information, or meet up if they are not comfortable.')}</li>
                  <li>{t('safety.boundaries3', 'Accept rejection gracefully and move on - persistence after someone has declined interest is harassment.')}</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="col-md-6">
            <div className="card h-100 border-0 shadow-sm">
              <div className="card-body p-4">
                <div className="d-flex align-items-center mb-3">
                  <div className="safety-tip-icon me-3" style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FaEye className="text-white" size={24} />
                  </div>
                  <h3 className="h5 mb-0">{t('safety.reportSuspicious', 'Report Suspicious Activity')}</h3>
                </div>
                <ul className="ps-3">
                  <li>{t('safety.report1', 'Report suspicious profiles or inappropriate behavior immediately using our reporting tools.')}</li>
                  <li>{t('safety.report2', 'Document harassing or threatening messages before blocking the user.')}</li>
                  <li>{t('safety.report3', 'If you believe someone is misrepresenting themselves, report the profile for review.')}</li>
                  <li>{t('safety.report4', 'By reporting problems, you are helping keep the community safe for everyone.')}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      <section className="mb-5">
        <h2 className="text-center mb-4">{t('safety.meetingSafety', 'Meeting In Person')}</h2>
        <div className="row g-4">
          <div className="col-md-6">
            <div className="card h-100 border-0 shadow-sm">
              <div className="card-body p-4">
                <div className="d-flex align-items-center mb-3">
                  <div className="safety-tip-icon me-3" style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FaMapMarkerAlt className="text-white" size={24} />
                  </div>
                  <h3 className="h5 mb-0">{t('safety.publicLocation', 'Meet in Public Places')}</h3>
                </div>
                <ul className="ps-3">
                  <li>{t('safety.public1', 'Always meet for the first time in a busy, public place like a café or restaurant.')}</li>
                  <li>{t('safety.public2', 'Avoid secluded areas, private residences, or isolated locations for initial meetings.')}</li>
                  <li>{t('safety.public3', 'Stay in public for the entire first meeting - do not leave to go to a private location.')}</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="col-md-6">
            <div className="card h-100 border-0 shadow-sm">
              <div className="card-body p-4">
                <div className="d-flex align-items-center mb-3">
                  <div className="safety-tip-icon me-3" style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FaPhone className="text-white" size={24} />
                  </div>
                  <h3 className="h5 mb-0">{t('safety.tellFriend', 'Inform a Friend')}</h3>
                </div>
                <ul className="ps-3">
                  <li>{t('safety.inform1', 'Tell a trusted friend or family member about your plans, including when and where you are meeting.')}</li>
                  <li>{t('safety.inform2', 'Share the name and profile information of the person you are meeting.')}</li>
                  <li>{t('safety.inform3', 'Arrange to check in with someone during and after the date.')}</li>
                  <li>{t('safety.inform4', 'Consider using a location-sharing app with a trusted friend during the meeting.')}</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="col-md-6">
            <div className="card h-100 border-0 shadow-sm">
              <div className="card-body p-4">
                <div className="d-flex align-items-center mb-3">
                  <div className="safety-tip-icon me-3" style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FaCocktail className="text-white" size={24} />
                  </div>
                  <h3 className="h5 mb-0">{t('safety.stayAlertSober', 'Stay Alert and Sober')}</h3>
                </div>
                <ul className="ps-3">
                  <li>{t('safety.alert1', 'Limit alcohol consumption and never leave your drink unattended.')}</li>
                  <li>{t('safety.alert2', 'Maintain awareness of your surroundings at all times.')}</li>
                  <li>{t('safety.alert3', 'Trust your instincts - if you feel uncomfortable, make an excuse and leave.')}</li>
                  <li>{t('safety.alert4', 'Have a plan for how to get home safely.')}</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="col-md-6">
            <div className="card h-100 border-0 shadow-sm">
              <div className="card-body p-4">
                <div className="d-flex align-items-center mb-3">
                  <div className="safety-tip-icon me-3" style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FaHeartbeat className="text-white" size={24} />
                  </div>
                  <h3 className="h5 mb-0">{t('safety.practiceConsent', 'Practice Mutual Consent')}</h3>
                </div>
                <ul className="ps-3">
                  <li>{t('safety.consent1', 'Always get explicit consent before any intimate or physical activity.')}</li>
                  <li>{t('safety.consent2', 'Respect when someone says "no" or expresses discomfort.')}</li>
                  <li>{t('safety.consent3', 'Remember that consent can be withdrawn at any time.')}</li>
                  <li>{t('safety.consent4', 'Communicate openly about boundaries and expectations.')}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      <section className="mb-5 py-4 bg-light rounded-lg">
        <div className="container">
          <h2 className="text-center mb-4">{t('safety.emergencySituation', 'In Case of Emergency')}</h2>
          <div className="row">
            <div className="col-lg-8 mx-auto">
              <div className="d-flex mb-4">
                <div className="me-3 fs-3 text-danger"><FaExclamationTriangle /></div>
                <div>
                  <p className="mb-2"><strong>{t('safety.unsafe', 'If you feel unsafe:')}</strong></p>
                  <ol className="ps-3">
                    <li>{t('safety.emergency1', 'Remain calm and find a way to excuse yourself from the situation.')}</li>
                    <li>{t('safety.emergency2', 'Call emergency services (100 for Police in Israel) if you feel threatened or in danger.')}</li>
                    <li>{t('safety.emergency3', 'Contact support to report any user who made you feel unsafe.')}</li>
                    <li>{t('safety.emergency4', 'Trust your instincts - better to be cautious than to risk your safety.')}</li>
                  </ol>
                </div>
              </div>
              
              <div className="d-flex">
                <div className="me-3 fs-3 text-primary"><FaShieldAlt /></div>
                <div>
                  <p className="mb-2"><strong>{t('safety.reporting', 'Reporting serious incidents:')}</strong></p>
                  <p>{t('safety.reportingText', 'If you experience harassment, threats, or assault, please report it to local authorities first, then contact our support team. We can help provide relevant information to assist in any investigation.')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      <section className="text-center mb-5">
        <h2 className="mb-4">{t('safety.commitment', 'Our Commitment to Safety')}</h2>
        <div className="row">
          <div className="col-lg-8 mx-auto">
            <p className="mb-4">{t('safety.commitmentText', 'At Mandarin Dating, we continuously work to improve our safety measures. We verify profiles, monitor suspicious activity, and promptly respond to reports. However, your active participation in practicing safe dating habits is essential for a secure experience.')}</p>
            
            <div className="alert alert-secondary">
              <p className="mb-0"><strong>{t('safety.remember', 'Remember:')}</strong> {t('safety.finalTip', 'Your safety is more important than politeness. Trust your instincts and do not hesitate to end any interaction that makes you uncomfortable.')}</p>
            </div>
          </div>
        </div>
      </section>
      
      <section className="text-center mb-5">
        <Link to="/support" className="btn btn-primary btn-lg">{t('safety.contactSupport', 'Contact Support')}</Link>
      </section>
    </div>
  );
};

export default Safety;