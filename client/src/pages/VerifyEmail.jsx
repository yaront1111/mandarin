"use client"

import { useState, useEffect } from "react"
import { useNavigate, useLocation, Link } from "react-router-dom"
import { FaCheckCircle, FaExclamationTriangle, FaSpinner, FaEnvelope } from "react-icons/fa"
import apiService from "../services/apiService"
import { useAuth } from "../context/AuthContext"
import { useTranslation } from "react-i18next"
import { useLanguage } from "../context"
import { createLogger } from "../utils/logger"

const logger = createLogger('VerifyEmail')

const VerifyEmail = () => {
  const [status, setStatus] = useState("loading") // loading, success, error
  const [message, setMessage] = useState("")
  const navigate = useNavigate()
  const location = useLocation()
  const { user, login, resendVerificationEmail } = useAuth()
  const { t } = useTranslation()
  const { isRTL } = useLanguage()

  // Extract token from URL query parameters
  const getTokenFromUrl = () => {
    const searchParams = new URLSearchParams(location.search)
    return searchParams.get("token")
  }

  useEffect(() => {
    const verifyEmail = async () => {
      const token = getTokenFromUrl()

      if (!token) {
        setStatus("error")
        setMessage(t('tokenMissing'))
        return
      }

      try {
        const response = await apiService.post("/auth/verify-email", { token })

        if (response.success) {
          setStatus("success")
          setMessage(t('accountVerified'))

          // If user is already logged in, refresh their profile
          if (user) {
            try {
              await apiService.get("/auth/me")
            } catch (err) {
              logger.error("Error refreshing user profile:", err)
            }
          }
        } else {
          setStatus("error")
          setMessage(response.error || t('verificationFailed'))
        }
      } catch (err) {
        logger.error("Verification error:", err)
        setStatus("error")
        setMessage(err.response?.data?.error || t('verificationFailed'))
      }
    }

    verifyEmail()
  }, [user, t])

  const handleResendVerification = async () => {
    if (user) {
      await resendVerificationEmail()
      setMessage(t('verificationEmailSent'))
    } else {
      setMessage(t('loginToResend'))
    }
  }

  const handleGoToDashboard = () => {
    navigate("/dashboard")
  }

  const handleGoToLogin = () => {
    navigate("/login")
  }

  return (
    <div className={`verify-email-page ${isRTL ? 'rtl-layout' : ''}`}>
      <div className="verify-email-container">
        <div className="verify-email-card">
          <div className="verify-email-header">
            <h1>{t('verifyEmail')}</h1>
          </div>

          <div className="verify-email-content">
            {status === "loading" && (
              <div className="verify-email-loading">
                <FaSpinner className="spinner" />
                <p>{t('verifyingEmail')}</p>
              </div>
            )}

            {status === "success" && (
              <div className="verify-email-success">
                <FaCheckCircle className="success-icon" />
                <h2>{t('verificationSuccess')}</h2>
                <p>{message}</p>
                <div className="verify-email-actions">
                  {user ? (
                    <button className="primary-button" onClick={handleGoToDashboard}>
                      {t('goBack')} {t('dashboard')}
                    </button>
                  ) : (
                    <button className="primary-button" onClick={handleGoToLogin}>
                      {t('signIn')}
                    </button>
                  )}
                </div>
              </div>
            )}

            {status === "error" && (
              <div className="verify-email-error">
                <FaExclamationTriangle className="error-icon" />
                <h2>{t('verificationFailed')}</h2>
                <p>{message}</p>
                <div className="verify-email-actions">
                  <button className="secondary-button" onClick={handleResendVerification}>
                    <FaEnvelope /> {t('resendVerificationEmail')}
                  </button>
                  <Link to="/login" className="text-link">
                    {t('backToLogin')}
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .verify-email-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #f5f5f5;
          padding: 20px;
        }
        
        .verify-email-container {
          width: 100%;
          max-width: 500px;
        }
        
        .verify-email-card {
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        
        .verify-email-header {
          background-color: #ff4b7d;
          color: white;
          padding: 20px;
          text-align: center;
        }
        
        .verify-email-header h1 {
          margin: 0;
          font-size: 24px;
        }
        
        .verify-email-content {
          padding: 30px;
          text-align: center;
        }
        
        .verify-email-loading,
        .verify-email-success,
        .verify-email-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 15px;
        }
        
        .spinner {
          animation: spin 1s linear infinite;
          font-size: 40px;
          color: #ff4b7d;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .success-icon {
          font-size: 60px;
          color: #28a745;
        }
        
        .error-icon {
          font-size: 60px;
          color: #dc3545;
        }
        
        .verify-email-actions {
          margin-top: 20px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          width: 100%;
        }
        
        .primary-button {
          background-color: #ff4b7d;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 12px 20px;
          font-size: 16px;
          cursor: pointer;
          width: 100%;
          transition: background-color 0.2s;
        }
        
        .primary-button:hover {
          background-color: #e6305f;
        }
        
        .secondary-button {
          background-color: #f8f9fa;
          color: #333;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 12px 20px;
          font-size: 16px;
          cursor: pointer;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: background-color 0.2s;
        }
        
        .secondary-button:hover {
          background-color: #e9ecef;
        }
        
        .text-link {
          color: #ff4b7d;
          text-decoration: none;
          margin-top: 10px;
          display: inline-block;
        }
        
        .text-link:hover {
          text-decoration: underline;
        }
      `}</style>
    </div>
  )
}

export default VerifyEmail
