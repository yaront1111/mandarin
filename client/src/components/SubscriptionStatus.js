"use client"
import { FaCrown, FaHeart, FaImage, FaInfoCircle } from "react-icons/fa"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context"

const SubscriptionStatus = () => {
  const { user } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  // Determine account status
  const isFree = user.accountTier === "FREE"
  const isPaid = user.accountTier === "PAID"
  const isFemale = user.accountTier === "FEMALE"
  const isCouple = user.accountTier === "COUPLE"

  // Calculate story cooldown if applicable
  let storyCooldown = null
  if (isFree && user.lastStoryCreated) {
    const cooldownPeriod = 72 * 60 * 60 * 1000 // 72 hours in milliseconds
    const timeSinceLastStory = Date.now() - new Date(user.lastStoryCreated).getTime()
    const timeRemaining = cooldownPeriod - timeSinceLastStory

    if (timeRemaining > 0) {
      const hoursRemaining = Math.ceil(timeRemaining / (60 * 60 * 1000))
      storyCooldown = hoursRemaining
    }
  }

  return (
    <div className="subscription-status-card">
      <div className="status-header">
        {isFree ? (
          <h3>Free Account</h3>
        ) : (
          <h3>
            <FaCrown className="premium-icon" />
            {isPaid ? "Premium Account" : isFemale ? "Female Account" : "Couple Account"}
          </h3>
        )}
      </div>

      <div className="status-body">
        {isFree ? (
          <>
            <div className="limit-item">
              <FaHeart className="limit-icon" />
              <div className="limit-info">
                <span className="limit-label">Daily Likes</span>
                <span className="limit-value">{user.dailyLikesRemaining} / 3 remaining</span>
                <div className="progress">
                  <div className="progress-bar" style={{ width: `${(user.dailyLikesRemaining / 3) * 100}%` }}></div>
                </div>
              </div>
            </div>

            <div className="limit-item">
              <FaImage className="limit-icon" />
              <div className="limit-info">
                <span className="limit-label">Story Creation</span>
                {storyCooldown ? (
                  <span className="limit-value">Available in {storyCooldown} hours</span>
                ) : (
                  <span className="limit-value">Available now</span>
                )}
                {storyCooldown && (
                  <div className="progress">
                    <div className="progress-bar" style={{ width: `${100 - (storyCooldown / 72) * 100}%` }}></div>
                  </div>
                )}
              </div>
            </div>

            <button className="btn btn-primary upgrade-btn" onClick={() => navigate("/subscription")}>
              <FaCrown className="me-2" /> Upgrade Now
            </button>
          </>
        ) : (
          <div className="premium-features">
            <p>
              <FaInfoCircle className="me-2" />
              You have full access to all premium features:
            </p>
            <ul>
              <li>Unlimited messaging</li>
              <li>Unlimited likes</li>
              <li>Unlimited stories</li>
              <li>Video calls</li>
              <li>Priority in search results</li>
            </ul>
          </div>
        )}
      </div>

      <style jsx>{`
        .subscription-status-card {
          background: var(--bg-card);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          margin-bottom: 24px;
        }
        
        .status-header {
          padding: 16px;
          background: ${isFree ? "var(--bg-card)" : "var(--primary)"};
          color: ${isFree ? "var(--text)" : "white"};
          border-bottom: 1px solid rgba(0,0,0,0.1);
        }
        
        .status-header h3 {
          margin: 0;
          display: flex;
          align-items: center;
          font-size: 18px;
        }
        
        .premium-icon {
          margin-right: 8px;
          color: gold;
        }
        
        .status-body {
          padding: 16px;
        }
        
        .limit-item {
          display: flex;
          align-items: center;
          margin-bottom: 16px;
        }
        
        .limit-icon {
          font-size: 24px;
          margin-right: 16px;
          color: var(--primary);
        }
        
        .limit-info {
          flex: 1;
        }
        
        .limit-label {
          display: block;
          font-weight: 500;
          margin-bottom: 4px;
        }
        
        .limit-value {
          display: block;
          font-size: 14px;
          color: var(--text-medium);
          margin-bottom: 6px;
        }
        
        .progress {
          height: 6px;
          background: rgba(0,0,0,0.1);
          border-radius: 3px;
          overflow: hidden;
        }
        
        .progress-bar {
          height: 100%;
          background: var(--primary);
        }
        
        .upgrade-btn {
          width: 100%;
          margin-top: 8px;
        }
        
        .premium-features ul {
          padding-left: 20px;
          margin-top: 8px;
        }
        
        .premium-features li {
          margin-bottom: 4px;
        }
      `}</style>
    </div>
  )
}

export default SubscriptionStatus
