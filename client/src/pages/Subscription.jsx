"use client"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { FaCheck, FaTimes, FaCrown, FaHeart, FaImage, FaComment, FaArrowLeft } from "react-icons/fa"
import { useAuth } from "../context"
import { useTranslation } from "react-i18next"
import { useLanguage } from "../context"
import { toast } from "react-toastify"
import subscriptionService from "../services/subscriptionService.jsx"
import { createLogger } from "../utils/logger"
import styles from "../styles/subscription.module.css"

const logger = createLogger('Subscription')

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
      logger.error("Error fetching subscription status:", error)
      toast.error(t('fetchFailed'))
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
        toast.success(t('upgradeSuccess'))
        navigate("/dashboard")
      }
    } catch (error) {
      logger.error("Subscription error:", error)
      toast.error(error.message || t('paymentFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`modern-dashboard ${isRTL ? 'rtl-layout' : ''}`}>
      {/* Main Content */}
      <main className="dashboard-content">
        <div className={styles.subscriptionContainer}>
          <div className={styles.gradientBar}></div>
          
          <div className={styles.backNav}>
            <button className={styles.backButton} onClick={() => navigate("/dashboard")}>
              <FaArrowLeft /> {t('backToDashboard') || 'Back to Dashboard'}
            </button>
          </div>

          <h1 className={styles.pageTitle}>
            <FaCrown /> {t('premiumMembership')}
          </h1>

          {hasPremium ? (
            <div className={styles.alreadyPremium}>
              <h3 className={styles.premiumTitle}>{t('alreadyPremium')}</h3>
              <p className={styles.premiumMessage}>{t('enjoyFeatures')}</p>
              <button className={styles.buttonPrimary} onClick={() => navigate("/dashboard")}>
                {t('goBack')} {t('dashboard')}
              </button>
            </div>
          ) : (
            <>
              <div className="text-center mb-5">
                <h2 className={styles.subtitle}>{t('unlockFeatures')}</h2>
                <p className={styles.lead}>{t('upgradeExperience')}</p>
              </div>

              <div className="d-flex justify-content-center">
                <div className={styles.toggleContainer}>
                  <button
                    className={`${styles.toggleBtn} ${selectedPlan === "monthly" ? styles.toggleBtnActive : ""}`}
                    onClick={() => setSelectedPlan("monthly")}
                  >
                    {t('monthly')}
                  </button>
                  <button
                    className={`${styles.toggleBtn} ${selectedPlan === "yearly" ? styles.toggleBtnActive : ""}`}
                    onClick={() => setSelectedPlan("yearly")}
                  >
                    {t('yearly')}
                    <span className={styles.saveBadge}>{t('save')} 20%</span>
                  </button>
                </div>
              </div>

              <div className={styles.pricingCards}>
                <div className={styles.pricingCard}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.planName}>{t('freeTier')}</h3>
                    <p className={styles.price}>$0</p>
                    <p className={styles.period}>{t('forever')}</p>
                  </div>
                  <div className={styles.cardBody}>
                    <ul className={styles.featureList}>
                      <li className={styles.featureItem}>
                        <FaCheck className={styles.iconYes} /> {t('viewProfiles')}
                      </li>
                      <li className={styles.featureItem}>
                        <FaCheck className={styles.iconYes} /> {t('sendWinks')}
                      </li>
                      <li className={styles.featureItem}>
                        <FaCheck className={styles.iconYes} /> {t('limitedLikes')}
                      </li>
                      <li className={styles.featureItem}>
                        <FaCheck className={styles.iconYes} /> {t('limitedStories')}
                      </li>
                      <li className={styles.featureItem}>
                        <FaTimes className={styles.iconNo} /> {t('sendMessages')}
                      </li>
                      <li className={styles.featureItem}>
                        <FaTimes className={styles.iconNo} /> {t('unlimitedLikes')}
                      </li>
                      <li className={styles.featureItem}>
                        <FaTimes className={styles.iconNo} /> {t('unlimitedStories')}
                      </li>
                    </ul>
                    <button className={styles.buttonOutline} disabled>
                      {t('currentPlan')}
                    </button>
                  </div>
                </div>

                <div className={`${styles.pricingCard} ${styles.premiumCard}`}>
                  <div className={styles.popularBadge}>{t('mostPopular')}</div>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.planName}>{t('paidTier')}</h3>
                    <p className={styles.price}>${selectedPlan === "monthly" ? "14.99" : "11.99"}</p>
                    <p className={styles.period}>
                      {selectedPlan === "monthly"
                        ? t('perMonth')
                        : t('perMonthYearly')}
                    </p>
                  </div>
                  <div className={styles.cardBody}>
                    <ul className={styles.featureList}>
                      <li className={styles.featureItem}>
                        <FaCheck className={styles.iconYes} /> {t('viewProfiles')}
                      </li>
                      <li className={styles.featureItem}>
                        <FaCheck className={styles.iconYes} /> {t('sendWinks')}
                      </li>
                      <li className={styles.featureItem}>
                        <FaCheck className={styles.iconYes} /> <strong>{t('unlimitedLikes')}</strong>{" "}
                        <FaHeart className={styles.featureIcon} />
                      </li>
                      <li className={styles.featureItem}>
                        <FaCheck className={styles.iconYes} /> <strong>{t('unlimitedStories')}</strong>{" "}
                        <FaImage className={styles.featureIcon} />
                      </li>
                      <li className={styles.featureItem}>
                        <FaCheck className={styles.iconYes} /> <strong>{t('sendMessages')}</strong>{" "}
                        <FaComment className={styles.featureIcon} />
                      </li>
                      <li className={styles.featureItem}>
                        <FaCheck className={styles.iconYes} /> {t('videoCalls')}
                      </li>
                      <li className={styles.featureItem}>
                        <FaCheck className={styles.iconYes} /> {t('prioritySearch')}
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
                          <span style={{ marginLeft: "8px" }}>{t('processing')}</span>
                        </>
                      ) : (
                        `${t('subscribe')} ${selectedPlan === "monthly" ? "$14.99/month" : "$143.88/year"}`
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
