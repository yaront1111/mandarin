// client/src/pages/Login.js
import { useState, useEffect } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { FaEnvelope, FaLock, FaEye, FaEyeSlash, FaGoogle, FaFacebook, FaArrowRight, FaExclamationTriangle } from "react-icons/fa"
import { useTranslation } from "react-i18next"
import { useAuth, useLanguage } from "../context"
import { createLogger } from "../utils/logger"
import styles from "../styles/login.module.css"

const logger = createLogger('Login')

const Login = () => {
  const [formData, setFormData] = useState({ email: "", password: "" })
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [formErrors, setFormErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { login, error, clearError, isAuthenticated } = useAuth()
  const { t } = useTranslation()
  const { isRTL } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()

  const from = location.state?.from || "/dashboard"

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from)
    }
  }, [isAuthenticated, navigate, from])

  useEffect(() => {
    // Only set email from location state on initial mount
    if (location.state?.email) {
      setFormData((prev) => ({ ...prev, email: location.state.email }))
    }
    // Clear any previous errors when component mounts
    clearError()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty dependency array means this only runs once on mount

  useEffect(() => {
    if (error) {
      setFormErrors({ general: error })
      setIsSubmitting(false)
    }
  }, [error])

  const validateForm = () => {
    const errors = {}
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/

    if (!formData.email) {
      errors.email = t('email') + " " + t('validationError')
    } else if (!emailRegex.test(formData.email)) {
      errors.email = t('validationError')
    }
    if (!formData.password) {
      errors.password = t('password') + " " + t('validationError')
    } else if (formData.password.length < 6) {
      errors.password = t('passwordRequirements')
    }

    return errors
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
    if (formErrors[name]) {
      setFormErrors({ ...formErrors, [name]: "" })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errors = validateForm()
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }
    setFormErrors({})
    setIsSubmitting(true)

    try {
      await login({ email: formData.email, password: formData.password })
    } catch (err) {
      logger.error("Login error", err)
    }
  }

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword)
  }

  return (
    <div className={`auth-page login-page d-flex min-vh-100 bg-light-subtle ${isRTL ? 'rtl-layout' : ''}`}>
      <div className={styles.loginContainer}>
        <div className={styles.gradientBar}></div>
        
        <div className="text-center mb-4">
          <Link to="/" className={styles.pageTitle}>
            Mandarin
          </Link>
          <p className={styles.subtitle}>{t('signIn')}</p>
        </div>

        {formErrors.general && (
          <div className={`${styles.alert} ${styles.alertDanger}`}>
            <FaExclamationTriangle />
            <p className="mb-0">{formErrors.general}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="email">
              {t('email')}
            </label>
            <div className={styles.inputWrapper}>
              <FaEnvelope className={styles.inputIcon} />
              <input
                type="email"
                id="email"
                name="email"
                className={styles.input}
                placeholder={t('email')}
                value={formData.email}
                onChange={handleChange}
                disabled={isSubmitting}
                autoComplete="email"
              />
            </div>
            {formErrors.email && (
              <p className={styles.errorMessage}>
                <FaExclamationTriangle />
                {formErrors.email}
              </p>
            )}
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="password">
              {t('password')}
            </label>
            <div className={styles.inputWrapper}>
              <FaLock className={styles.inputIcon} />
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                className={styles.input}
                placeholder={t('password')}
                value={formData.password}
                onChange={handleChange}
                disabled={isSubmitting}
                autoComplete="current-password"
              />
              <button 
                type="button" 
                className={styles.togglePassword}
                onClick={togglePasswordVisibility} 
                tabIndex={-1}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            {formErrors.password && (
              <p className={styles.errorMessage}>
                <FaExclamationTriangle />
                {formErrors.password}
              </p>
            )}
          </div>

          <div className={styles.rememberForgotWrapper}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={rememberMe}
                onChange={() => setRememberMe(!rememberMe)}
                disabled={isSubmitting}
              />
              {t('rememberMe')}
            </label>
            <Link to="/forgot-password" className={styles.forgotPassword}>
              {t('forgotPassword')}
            </Link>
          </div>

          <button
            type="submit"
            className={styles.submitButton}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className={styles.spinner}></span>
                <span>{t('loading')}</span>
              </>
            ) : (
              <>
                <span>{t('signIn')}</span>
                <FaArrowRight />
              </>
            )}
          </button>
        </form>

        <div className={styles.divider}>{t('or')}</div>

        <div>
          <button className={styles.socialButton}>
            <FaGoogle className={styles.googleIcon} />
            <span>{t('signInWith')} Google</span>
          </button>
          <button className={styles.socialButton}>
            <FaFacebook className={styles.facebookIcon} />
            <span>{t('signInWith')} Facebook</span>
          </button>
        </div>

        <div className={styles.footer}>
          {t('dontHaveAccount')}{" "}
          <Link to="/register" className={styles.footerLink}>
            {t('signUp')}
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Login