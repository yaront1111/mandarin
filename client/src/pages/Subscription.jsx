"use client"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { FaCheck, FaTimes, FaCrown, FaHeart, FaImage, FaComment, FaUserCircle } from "react-icons/fa"
import { useAuth } from "../context"
import { useTranslation } from "react-i18next"
import { useLanguage } from "../context"
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
  const { t } = useTranslation()
  const { isRTL } = useLanguage()

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
      toast.error(t('subscriptions.fetchFailed'))
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
        toast.success(t('subscriptions.upgradeSuccess'))
        navigate("/dashboard")
      }
    } catch (error) {
      console.error("Subscription error:", error)
      toast.error(error.message || t('subscriptions.paymentFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`modern-dashboard ${isRTL ? 'rtl-layout' : ''}`}>
      {/* Header */}
      <header className="modern-header">
        <div className="container d-flex justify-content-between align-items-center">
          <div className="logo" style={{ cursor: "pointer" }} onClick={() => navigate("/dashboard")}>
            Mandarin
          </div>
          <div className="d-none d-md-flex main-tabs">
            <button className="tab-button" onClick={() => navigate("/dashboard")}>
              {t('common.dashboard')}
            </button>
            <button className="tab-button" onClick={() => navigate("/messages")}>
              {t('common.messages')}
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
            <FaCrown /> {t('subscriptions.premiumMembership')}
          </h1>

          {hasPremium ? (
            <div className={styles.alreadyPremium}>
              <h3 className={styles.premiumTitle}>{t('subscriptions.alreadyPremium')}</h3>
              <p className={styles.premiumMessage}>{t('subscriptions.enjoyFeatures')}</p>
              <button className={styles.buttonPrimary} onClick={() => navigate("/dashboard")}>
                {t('common.goBack')} {t('common.dashboard')}
              </button>
            </div>
          ) : (
            <>
              <div className="text-center mb-5">
                <h2 className={styles.subtitle}>{t('subscriptions.unlockFeatures')}</h2>
                <p className={styles.lead}>{t('subscriptions.upgradeExperience')}</p>
              </div>

              <div className="d-flex justify-content-center">
                <div className={styles.toggleContainer}>
                  <button
                    className={`${styles.toggleBtn} ${selectedPlan === "monthly" ? styles.toggleBtnActive : ""}`}
                    onClick={() => setSelectedPlan("monthly")}
                  >
                    {t('subscriptions.monthly')}
                  </button>
                  <button
                    className={`${styles.toggleBtn} ${selectedPlan === "yearly" ? styles.toggleBtnActive : ""}`}
                    onClick={() => setSelectedPlan("yearly")}
                  >
                    {t('subscriptions.yearly')}
                    <span className={styles.saveBadge}>{t('subscriptions.save')} 20%</span>
                  </button>
                </div>
              </div>

              <div className={styles.pricingCards}>
                <div className={styles.pricingCard}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.planName}>{t('subscriptions.freeTier')}</h3>
                    <p className={styles.price}>$0</p>
                    <p className={styles.period}>{t('subscriptions.forever')}</p>
                  </div>
                  <div className={styles.cardBody}>
                    <ul className={styles.featureList}>
                      <li className={styles.featureItem}>
                        <FaCheck className={styles.iconYes} /> {t('subscriptions.viewProfiles')}
                      </li>
                      <li className={styles.featureItem}>
                        <FaCheck className={styles.iconYes} /> {t('subscriptions.sendWinks')}
                      </li>
                      <li className={styles.featureItem}>
                        <FaCheck className={styles.iconYes} /> {t('subscriptions.limitedLikes')}
                      </li>
                      <li className={styles.featureItem}>
                        <FaCheck className={styles.iconYes} /> {t('subscriptions.limitedStories')}
                      </li>
                      <li className={styles.featureItem}>
                        <FaTimes className={styles.iconNo} /> {t('subscriptions.sendMessages')}
                      </li>
                      <li className={styles.featureItem}>
                        <FaTimes className={styles.iconNo} /> {t('subscriptions.unlimitedLikes')}
                      </li>
                      <li className={styles.featureItem}>
                        <FaTimes className={styles.iconNo} /> {t('subscriptions.unlimitedStories')}
                      </li>
                    </ul>
                    <button className={styles.buttonOutline} disabled>
                      {t('subscriptions.currentPlan')}
                    </button>
                  </div>
                </div>

                <div className={`${styles.pricingCard} ${styles.premiumCard}`}>
                  <div className={styles.popularBadge}>{t('subscriptions.mostPopular')}</div>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.planName}>{t('subscriptions.paidTier')}</h3>
                    <p className={styles.price}>${selectedPlan === "monthly" ? "14.99" : "11.99"}</p>
                    <p className={styles.period}>
                      {selectedPlan === "monthly"
                        ? t('subscriptions.perMonth')
                        : t('subscriptions.perMonthYearly')}
                    </p>
                  </div>
                  <div className={styles.cardBody}>
                    <ul className={styles.featureList}>
                      <li className={styles.featureItem}>
                        <FaCheck className={styles.iconYes} /> {t('subscriptions.viewProfiles')}
                      </li>
                      <li className={styles.featureItem}>
                        <FaCheck className={styles.iconYes} /> {t('subscriptions.sendWinks')}
                      </li>
                      <li className={styles.featureItem}>
                        <FaCheck className={styles.iconYes} /> <strong>{t('subscriptions.unlimitedLikes')}</strong>{" "}
                        <FaHeart className={styles.featureIcon} />
                      </li>
                      <li className={styles.featureItem}>
                        <FaCheck className={styles.iconYes} /> <strong>{t('subscriptions.unlimitedStories')}</strong>{" "}
                        <FaImage className={styles.featureIcon} />
                      </li>
                      <li className={styles.featureItem}>
                        <FaCheck className={styles.iconYes} /> <strong>{t('subscriptions.sendMessages')}</strong>{" "}
                        <FaComment className={styles.featureIcon} />
                      </li>
                      <li className={styles.featureItem}>
                        <FaCheck className={styles.iconYes} /> {t('subscriptions.videoCalls')}
                      </li>
                      <li className={styles.featureItem}>
                        <FaCheck className={styles.iconYes} /> {t('subscriptions.prioritySearch')}
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
                          <span style={{ marginLeft: "8px" }}>{t('common.processing')}</span>
                        </>
                      ) : (
                        `${t('subscriptions.subscribe')} ${selectedPlan === "monthly" ? "$14.99/month" : "$143.88/year"}`
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
