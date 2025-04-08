"use client"

import { useState, useEffect } from "react"
import { FaExclamationTriangle, FaEnvelope, FaTimes } from "react-icons/fa"
import { useAuth } from "../context"
import { useTheme } from "../context/ThemeContext"

const VerificationBanner = () => {
  const { user, resendVerificationEmail, isAuthenticated, authChecked } = useAuth()
  const { theme } = useTheme()
  const isDarkMode = theme === "dark"
  const [showBanner, setShowBanner] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  // Check if the banner has been dismissed
  useEffect(() => {
    // Only run this check if user is authenticated and not verified
    if (!isAuthenticated || !user || user?.isVerified) {
      setShowBanner(false)
      return;
    }
    
    // We got here, so user is authenticated and not verified
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
    } else {
      // Explicitly set banner to show if not dismissed and user needs verification
      setShowBanner(true)
    }
  }, [isAuthenticated, user])

  // Set up cooldown timer
  useEffect(() => {
    let timerId

    if (cooldown > 0) {
      timerId = setInterval(() => {
        setCooldown((prev) => prev - 1)
      }, 60000) // Update every minute
    }

    // Check localStorage for existing cooldown when mounting
    const storedCooldown = localStorage.getItem("verificationEmailCooldown");
    if (storedCooldown) {
      try {
        const cooldownData = JSON.parse(storedCooldown);
        const expiresAt = new Date(cooldownData.expiresAt);
        
        if (expiresAt > new Date()) {
          // Calculate remaining minutes
          const remainingMinutes = Math.ceil((expiresAt - new Date()) / 60000);
          if (remainingMinutes > 0) {
            setCooldown(remainingMinutes);
          }
        } else {
          // Cooldown has expired, remove it
          localStorage.removeItem("verificationEmailCooldown");
        }
      } catch (error) {
        console.error("Error parsing stored cooldown:", error);
        localStorage.removeItem("verificationEmailCooldown");
      }
    }

    return () => clearInterval(timerId)
  }, [cooldown])

  // Handle resending verification email with retry mechanism
  const handleResendEmail = async () => {
    setResending(true);
    
    // Track attempts
    let attempts = 0;
    const maxAttempts = 2;
    
    const attemptSend = async () => {
      attempts++;
      try {
        const success = await resendVerificationEmail();
        if (success) {
          // Set cooldown to 30 minutes and store in localStorage
          const cooldownMinutes = 30;
          setCooldown(cooldownMinutes);
          
          // Store cooldown expiration in localStorage
          const expiresAt = new Date(Date.now() + cooldownMinutes * 60000);
          localStorage.setItem(
            "verificationEmailCooldown", 
            JSON.stringify({ 
              expiresAt: expiresAt.toISOString() 
            })
          );
          return true;
        }
        return false;
      } catch (error) {
        console.error(`Error resending verification email (attempt ${attempts}):`, error);
        
        // Only retry on timeout errors
        if (error.originalError?.code === 'ECONNABORTED' && attempts < maxAttempts) {
          console.log(`Retrying verification email send (attempt ${attempts + 1}/${maxAttempts})`);
          return false; // Signal to retry
        }
        
        throw error; // Re-throw other errors
      }
    };
    
    try {
      // First attempt
      const success = await attemptSend();
      
      // If first attempt failed with timeout, try one more time
      if (!success && attempts < maxAttempts) {
        await attemptSend();
      }
    } catch (error) {
      console.error("All verification email attempts failed:", error);
    } finally {
      setResending(false);
    }
  }

  // Handle dismissing the banner
  const handleDismiss = () => {
    setShowBanner(false)
    localStorage.setItem("verificationBannerDismissed", new Date().toISOString())
  }

  // Don't show if:
  // 1. Auth check is not completed
  // 2. Not authenticated
  // 3. No user (not logged in) 
  // 4. User is already verified
  // 5. Banner has been dismissed
  // 6. We don't have a valid user ID
  if (!authChecked || !isAuthenticated || !user || user?.isVerified || !showBanner || !user?._id) {
    return null
  }
  
  // Double-check authentication status - don't show when not logged in
  if (!isAuthenticated) {
    return null
  }

  return (
    <div className={`verification-banner ${isDarkMode ? 'dark' : 'light'}`}>
      <div className="container">
        <div className="banner-content">
          <FaExclamationTriangle className="banner-icon" />
          <p>Your email is not verified. Please verify your email address to unlock all features. Check your inbox and spam folder for the verification email.</p>
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
                <>Wait {cooldown}m to resend</>
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
          padding: 12px 20px;
          text-align: center;
          position: absolute;
          top: 64px;
          left: 0;
          width: 100%;
          z-index: 100;
          transition: all 0.3s ease;
        }
        
        /* Light mode styles */
        .verification-banner.light {
          background-color: #fef08a;
          color: #92400e;
          border-bottom: 1px solid #fcd34d;
        }
        
        /* Dark mode styles */
        .verification-banner.dark {
          background-color: #453a18;
          color: #fcd34d;
          border-bottom: 1px solid #92400e;
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
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        /* Light mode button styles */
        .light .resend-btn,
        .light .dismiss-btn {
          color: #92400e;
        }
        
        .light .resend-btn:hover,
        .light .dismiss-btn:hover {
          background-color: rgba(255, 255, 255, 0.3);
        }
        
        /* Dark mode button styles */
        .dark .resend-btn,
        .dark .dismiss-btn {
          color: #fcd34d;
        }
        
        .dark .resend-btn:hover,
        .dark .dismiss-btn:hover {
          background-color: rgba(0, 0, 0, 0.2);
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
