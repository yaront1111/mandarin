"use client"

import { useState, useEffect } from "react"
import { FaExclamationTriangle, FaEnvelope, FaTimes } from "react-icons/fa"
import { useAuth } from "../context"
import logger from "../utils/logger"

const log = logger.create("VerificationBanner")

const VerificationBanner = () => {
  const { user, resendVerificationEmail } = useAuth()
  const [showBanner, setShowBanner] = useState(true)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  // Check if the banner has been dismissed
  useEffect(() => {
    const dismissed = localStorage.getItem("verificationBannerDismissed")
    if (dismissed) {
      const dismissedDate = new Date(dismissed)
      const now = new Date()
      const diff = now.getTime() - dismissedDate.getTime()
      const twentyFourHours = 24 * 60 * 60 * 1000

      if (diff < twentyFourHours) {
        setShowBanner(false)
      } else {
        localStorage.removeItem("verificationBannerDismissed")
        setShowBanner(true)
      }
    }
  }, [])

  // Set up cooldown timer
  useEffect(() => {
    let timerId

    if (cooldown > 0) {
      timerId = setInterval(() => {
        setCooldown((prev) => prev - 1)
      }, 60000) // Update every minute
    }

    return () => clearInterval(timerId)
  }, [cooldown])

  // Handle resending verification email
  const handleResendEmail = async () => {
    setResending(true)
    try {
      const success = await resendVerificationEmail()
      if (success) {
        setCooldown(60) // Set cooldown to 60 minutes
      }
    } catch (error) {
      log.error("Error resending verification email:", error)
    } finally {
      setResending(false)
    }
  }

  // Handle dismissing the banner
  const handleDismiss = () => {
    setShowBanner(false)
    localStorage.setItem("verificationBannerDismissed", new Date().toISOString())
  }

  if (!user || user.isVerified || !showBanner) {
    return null
  }

  return (
    <div className="verification-banner">
      <div className="container">
        <div className="banner-content">
          <FaExclamationTriangle className="banner-icon" />
          <p>Your email is not verified. Please verify your email address to unlock all features.</p>
          <div className="banner-actions">
            <button
              className="resend-btn"
              onClick={handleResendEmail}
              disabled={resending || cooldown > 0}
              aria-label="Resend verification email"
            >
              {resending ? (
                <>Sending...</>
              ) : cooldown > 0 ? (
                `Resend Email (${cooldown}m)`
              ) : (
                <>
                  <FaEnvelope /> Resend Email
                </>
              )}
            </button>
            <button className="dismiss-btn" onClick={handleDismiss} aria-label="Dismiss banner">
              <FaTimes />
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .verification-banner {
          background-color: #fef08a;
          color: #92400e;
          padding: 12px 20px;
          text-align: center;
          position: absolute;
          top: 64px;
          left: 0;
          width: 100%;
          z-index: 100;
          border-bottom: 1px solid #fcd34d;
        }

        .container {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .banner-content {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .banner-icon {
          font-size: 20px;
        }

        .banner-actions {
          display: flex;
          gap: 10px;
        }

        .resend-btn,
        .dismiss-btn {
          background: none;
          border: none;
          color: #92400e;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .resend-btn:hover,
        .dismiss-btn:hover {
          background-color: rgba(255, 255, 255, 0.2);
        }

        .resend-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .banner-content {
            flex-direction: column;
            text-align: center;
          }

          .banner-actions {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  )
}

export default VerificationBanner
