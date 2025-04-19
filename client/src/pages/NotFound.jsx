// client/src/pages/NotFound.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context';

const NotFound = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  return (
    <div
      className={`d-flex flex-column align-items-center justify-content-center ${isRTL ? 'rtl-layout' : ''}`}
      style={{ height: '80vh', textAlign: 'center' }}
    >
      <h1 style={{ fontSize: '3rem', marginBottom: '16px' }}>404</h1>
      <p style={{ marginBottom: '24px' }}>
        {t('errors.notFound')}
      </p>
      <button className="btn btn-primary" onClick={() => navigate('/')}>
        {t('errors.backToHome')}
      </button>
    </div>
  );
};

export default NotFound;
