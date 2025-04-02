"use client"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { FaCheck, FaTimes, FaCrown, FaHeart, FaImage, FaComment, FaUserCircle } from "react-icons/fa"
import { useAuth } from "../context"
import { toast } from "react-toastify"
import { ThemeToggle } from "../components/theme-toggle.tsx"
import subscriptionService from "../services/subscriptionService.jsx"
import styles from "../styles/subscription.module.css"

const Subscription = () => {
  const { user, getCurrentUser } = useAuth()
  const navigate = useNavigate()
  const [selectedPlan, setSelectedPlan] = useState("monthly")
  const [loading, setLoading] = useState(false)
  const [subscriptionData, setSubscriptionData] = useState(null)

  // Redirect if user is not logged in
  useEffect(() => {
    if (!user) {
      navigate("/login")
    } else {
      // Fetch subscription data when component mounts
      fetchSubscriptionStatus()
    }
  }, [user, navigate])

  // Fetch subscription status
  const fetchSubscriptionStatus = async () => {
    try {
      const response = await subscriptionService.getSubscriptionStatus()
      if (response.success) {
        setSubscriptionData(response.data)
      }
    } catch (error) {
      console.error("Error fetching subscription status:", error)
      toast.error("Could not load subscription information")
    }
  }

  // Check if user already has premium access
  const hasPremium =
    user?.isPaid ||
    user?.accountTier === "PAID" ||
    user?.accountTier === "FEMALE" ||
    user?.accountTier === "COUPLE" ||
    (subscriptionData &&
      (subscriptionData.isPaid ||
        subscriptionData.accountTier === "PAID" ||
        subscriptionData.accountTier === "FEMALE" ||
        subscriptionData.accountTier === "COUPLE"))

  const handleSubscribe = async (plan) => {
    setLoading(true)
    try {
      // Call the subscription service to upgrade
      const response = await subscriptionService.upgradeSubscription(plan)

      if (response.success) {
        // Refresh user data to reflect the new subscription status
        await getCurrentUser()

        // Redirect to dashboard after successful subscription
        toast.success(`Successfully subscribed to ${plan} plan!`)
        navigate("/dashboard")
      }
    } catch (error) {
      console.error("Subscription error:", error)
      toast.error(error.message || "Failed to process subscription. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modern-dashboard">
      {/* Header */}
      <header className="modern-header">
        <div className="container d-flex justify-content-between align-items-center">
          <div className="logo" style={{ cursor: "pointer" }} onClick={() => navigate("/dashboard")}>
            Mandarin
          </div>
          <div className="d-none d-md-flex main-tabs">
            <button className="tab-button" onClick={() => navigate("/dashboard")}>
              Dashboard
            </button>
            <button className="tab-button" onClick={() => navigate("/messages")}>
              Messages
            </button>
          </div>
          <div className="header-actions d-flex align-items-center">
            <ThemeToggle />
            {user?.photos?.[0] ? (
              <img
                src={user.photos[0].url || "/placeholder.svg"}
                alt={user.nickname}
                className="user-avatar"
                onClick={() => navigate("/profile")}
              />
            ) : (
              <FaUserCircle className="user-avatar" style={{ fontSize: "32px" }} onClick={() => navigate("/profile")} />
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-content">
        <div className={styles.subscriptionContainer}>
          <div className={styles.gradientBar}></div>
          
          <h1 className={styles.pageTitle}>
            <FaCrown /> Premium Membership
          </h1>

          {hasPremium ? (
            <div className={styles.alreadyPremium}>
              <h3 className={styles.premiumTitle}>You already have premium access!</h3>
              <p className={styles.premiumMessage}>Enjoy all the premium features of Mandarin.</p>
              <button className={styles.buttonPrimary} onClick={() => navigate("/dashboard")}>
                Return to Dashboard
              </button>
            </div>
          ) : (
            <>
              <div className="text-center mb-5">
                <h2 className={styles.subtitle}>Unlock All Features</h2>
                <p className={styles.lead}>Upgrade your experience and connect with more people</p>
              </div>

              <div className="d-flex justify-content-center">
                <div className={styles.toggleContainer}>
                  <button
                    className={`${styles.toggleBtn} ${selectedPlan === "monthly" ? styles.toggleBtnActive : ""}`}
                    onClick={() => setSelectedPlan("monthly")}
                  >
                    Monthly
                  </button>
                  <button
                    className={`${styles.toggleBtn} ${selectedPlan === "yearly" ? styles.toggleBtnActive : ""}`}
                    onClick={() => setSelectedPlan("yearly")}
                  >
                    Yearly
                    <span className={styles.saveBadge}>Save 20%</span>
                  </button>
                </div>
              </div>

              <div className={styles.pricingCards}>
                <div className={styles.pricingCard}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.planName}>Free</h3>
                    <p className={styles.price}>$0</p>
                    <p className={styles.period}>forever</p>
                  </div>
                  <div className={styles.cardBody}>
                    <ul className={styles.featureList}>
                      <li className={styles.featureItem}>
                        <FaCheck className={styles.iconYes} /> View profiles
                      </li>
                      <li className={styles.featureItem}>
                        <FaCheck className={styles.iconYes} /> Send winks
                      </li>
                      <li className={styles.featureItem}>
                        <FaCheck className={styles.iconYes} /> 3 likes per day
                      </li>
                      <li className={styles.featureItem}>
                        <FaCheck className={styles.iconYes} /> 1 story every 72 hours
                      </li>
                      <li className={styles.featureItem}>
                        <FaTimes className={styles.iconNo} /> Send messages
                      </li>
                      <li className={styles.featureItem}>
                        <FaTimes className={styles.iconNo} /> Unlimited likes
                      </li>
                      <li className={styles.featureItem}>
                        <FaTimes className={styles.iconNo} /> Unlimited stories
                      </li>
                    </ul>
                    <button className={styles.buttonOutline} disabled>
                      Current Plan
                    </button>
                  </div>
                </div>

                <div className={`${styles.pricingCard} ${styles.premiumCard}`}>
                  <div className={styles.popularBadge}>Most Popular</div>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.planName}>Premium</h3>
                    <p className={styles.price}>${selectedPlan === "monthly" ? "14.99" : "11.99"}</p>
                    <p className={styles.period}>per {selectedPlan === "monthly" ? "month" : "month, billed yearly"}</p>
                  </div>
                  <div className={styles.cardBody}>
                    <ul className={styles.featureList}>
                      <li className={styles.featureItem}>
                        <FaCheck className={styles.iconYes} /> View profiles
                      </li>
                      <li className={styles.featureItem}>
                        <FaCheck className={styles.iconYes} /> Send winks
                      </li>
                      <li className={styles.featureItem}>
                        <FaCheck className={styles.iconYes} /> <strong>Unlimited likes</strong>{" "}
                        <FaHeart className={styles.featureIcon} />
                      </li>
                      <li className={styles.featureItem}>
                        <FaCheck className={styles.iconYes} /> <strong>Unlimited stories</strong>{" "}
                        <FaImage className={styles.featureIcon} />
                      </li>
                      <li className={styles.featureItem}>
                        <FaCheck className={styles.iconYes} /> <strong>Send messages</strong>{" "}
                        <FaComment className={styles.featureIcon} />
                      </li>
                      <li className={styles.featureItem}>
                        <FaCheck className={styles.iconYes} /> Video calls
                      </li>
                      <li className={styles.featureItem}>
                        <FaCheck className={styles.iconYes} /> Priority in search results
                      </li>
                    </ul>
                    <button
                      className={styles.buttonPrimary}
                      onClick={() => handleSubscribe(selectedPlan)}
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <span className={styles.spinner}></span>
                          <span style={{ marginLeft: "8px" }}>Processing...</span>
                        </>
                      ) : (
                        `Subscribe ${selectedPlan === "monthly" ? "$14.99/month" : "$143.88/year"}`
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default Subscription