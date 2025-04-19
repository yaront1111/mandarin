// client/src/pages/Home.jsx
import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { FaArrowRight, FaArrowLeft, FaMapMarkerAlt, FaRegHeart, FaComment, FaUsers, FaGlobe, FaLanguage, FaLock, FaShieldAlt } from "react-icons/fa"
import { ThemeToggle } from "../components/theme-toggle.tsx"
import axios from "axios"

const Home = () => {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [onlineUsers, setOnlineUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [language, setLanguage] = useState(() => {
    // Get language from localStorage or default to 'en'
    return localStorage.getItem('language') || 'en'
  })

  // Update direction attribute on language change
  useEffect(() => {
    document.documentElement.setAttribute('lang', language)
    document.documentElement.setAttribute('dir', language === 'he' ? 'rtl' : 'ltr')
    localStorage.setItem('language', language)
  }, [language])

  // Toggle language
  const toggleLanguage = () => {
    setLanguage(prevLang => prevLang === 'en' ? 'he' : 'en')
  }

  useEffect(() => {
    // Fetch real online users from API
    const fetchOnlineUsers = async () => {
      setIsLoading(true)
      setError(null)
      try {
        // Try to get online users from API
        const response = await axios.get('/api/users?online=true&limit=12')
        if (response.data.success) {
          setOnlineUsers(response.data.data)
        } else {
          // Fallback to mock data if API request was not successful
          setOnlineUsers(getMockUsers())
        }
      } catch (err) {
        console.error("Error fetching online users:", err)
        setError("Failed to load online users")
        // Fallback to mock data
        setOnlineUsers(getMockUsers())
      } finally {
        setIsLoading(false)
      }
    }

    fetchOnlineUsers()
  }, [])

  // Get mock users as fallback
  const getMockUsers = () => {
    return [
      {
        id: 1,
        nickname: "Emma",
        details: { age: 28, location: "New York" },
        photos: [{ url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80" }],
        isOnline: true
      },
      {
        id: 2,
        nickname: "Michael",
        details: { age: 32, location: "Los Angeles" },
        photos: [{ url: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80" }],
        isOnline: true
      },
      {
        id: 3,
        nickname: "Sophia",
        details: { age: 26, location: "Chicago" },
        photos: [{ url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80" }],
        isOnline: true
      },
      {
        id: 4,
        nickname: "James",
        details: { age: 30, location: "Miami" },
        photos: [{ url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80" }],
        isOnline: true
      },
      {
        id: 5,
        nickname: "Olivia",
        details: { age: 29, location: "San Francisco" },
        photos: [{ url: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80" }],
        isOnline: true
      },
      {
        id: 6,
        nickname: "Daniel",
        details: { age: 31, location: "Boston" },
        photos: [{ url: "https://images.unsplash.com/photo-1500048993953-d23a436266cf?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80" }],
        isOnline: true
      },
      {
        id: 7,
        nickname: "Sarah",
        details: { age: 27, location: "Seattle" },
        photos: [{ url: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80" }],
        isOnline: true
      },
      {
        id: 8,
        nickname: "Alex",
        details: { age: 33, location: "Austin" },
        photos: [{ url: "https://images.unsplash.com/photo-1504257432389-52343af06ae3?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80" }],
        isOnline: true
      }
    ]
  }

  const handleStartNow = () => {
    navigate("/register")
  }

  const handleEmailSubmit = (e) => {
    e.preventDefault()
    navigate("/register", { state: { email } })
  }

  // Text content based on language
  const content = {
    en: {
      about: "About",
      safety: "Safety",
      support: "Support",
      login: "Login",
      register: "Register",
      heroTitle: "Find Your Perfect Connection",
      heroSubtitle: "Discover genuine connections in a safe, discreet environment designed for adults seeking meaningful encounters.",
      emailPlaceholder: "Enter your email",
      getStarted: "Get Started",
      onlineNow: "People Online Now",
      onlineSubtitle: "Connect with these amazing people who are currently active on Mandarin",
      joinToSeeMore: "Join to See More",
      featuresTitle: "Why Choose Mandarin",
      privacyTitle: "Privacy First",
      privacyDesc: "Your privacy is our top priority. Control who sees your profile and what information you share.",
      secureTitle: "Secure Communication",
      secureDesc: "End-to-end encrypted messaging ensures your conversations remain private and secure.",
      matchTitle: "Smart Matching",
      matchDesc: "Our advanced algorithm connects you with people who match your preferences and interests.",
      footerAbout: "About Us",
      footerSafety: "Safety",
      footerSupport: "Support",
      footerTerms: "Terms",
      footerPrivacy: "Privacy",
      footerRights: "All rights reserved.",
      languageToggle: "עברית"
    },
    he: {
      about: "אודות",
      safety: "בטיחות",
      support: "תמיכה",
      login: "התחברות",
      register: "הרשמה",
      heroTitle: "מצא את החיבור המושלם שלך",
      heroSubtitle: "גלה קשרים אמיתיים בסביבה בטוחה ודיסקרטית המיועדת למבוגרים המחפשים מפגשים משמעותיים.",
      emailPlaceholder: "הכנס את האימייל שלך",
      getStarted: "התחל עכשיו",
      onlineNow: "אנשים מחוברים עכשיו",
      onlineSubtitle: "התחבר עם האנשים המדהימים האלה שפעילים כרגע במנדרין",
      joinToSeeMore: "הצטרף כדי לראות עוד",
      featuresTitle: "למה לבחור במנדרין",
      privacyTitle: "פרטיות תחילה",
      privacyDesc: "הפרטיות שלך היא בעדיפות עליונה. שליטה במי רואה את הפרופיל שלך ואיזה מידע אתה משתף.",
      secureTitle: "תקשורת מאובטחת",
      secureDesc: "הודעות מוצפנות מקצה לקצה מבטיחות שהשיחות שלך נשארות פרטיות ומאובטחות.",
      matchTitle: "התאמה חכמה",
      matchDesc: "האלגוריתם המתקדם שלנו מחבר אותך עם אנשים שתואמים את ההעדפות והתחומי העניין שלך.",
      footerAbout: "אודותינו",
      footerSafety: "בטיחות",
      footerSupport: "תמיכה",
      footerTerms: "תנאי שימוש",
      footerPrivacy: "פרטיות",
      footerRights: "כל הזכויות שמורות.",
      languageToggle: "English"
    }
  }

  // Get current language content
  const t = content[language]

  // Get appropriate arrow icon based on language direction
  const ArrowIcon = language === 'he' ? FaArrowLeft : FaArrowRight

  return (
    <div className="modern-home-page w-100 overflow-hidden">
      {/* Modern Header */}
      <header className="modern-header glass-effect sticky-top shadow-sm">
        <div className="container d-flex justify-content-between align-items-center py-2">
          <div className="logo gradient-text font-weight-bold text-nowrap">Mandarin</div>
          <nav className="d-none d-md-flex main-tabs gap-4">
            <Link to="/about" className="tab-button hover-opacity transition-all">
              {t.about}
            </Link>
            <Link to="/safety" className="tab-button hover-opacity transition-all">
              {t.safety}
            </Link>
            <Link to="/support" className="tab-button hover-opacity transition-all">
              {t.support}
            </Link>
          </nav>
          <div className="header-actions d-flex align-items-center gap-2">
            <button
              onClick={toggleLanguage}
              className="btn btn-outline btn-sm hover-scale transition-all d-flex align-items-center gap-1"
              aria-label="Toggle language"
            >
              <FaLanguage />
              <span className="d-none d-sm-inline">{t.languageToggle}</span>
            </button>
            <ThemeToggle />
            <Link to="/login" className="btn btn-outline btn-sm hover-scale transition-all">
              {t.login}
            </Link>
            <Link to="/register" className="btn btn-primary btn-sm hover-scale transition-all">
              {t.register}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section with 3D Effect */}
      <section className="hero-section animate-fade-in py-5 position-relative overflow-hidden">
        <div className="hero-bg-shapes">
          <div className="shape shape-1"></div>
          <div className="shape shape-2"></div>
          <div className="shape shape-3"></div>
        </div>

        <div className="hero-content mx-auto text-center p-4 max-w-lg position-relative z-2">
          <h1 className="animate-slide-up mb-4 text-shadow font-weight-bold gradient-hero-text">
            {t.heroTitle}
          </h1>
          <p className="animate-slide-up delay-200 mb-4 text-md opacity-90 line-height-relaxed">
            {t.heroSubtitle}
          </p>
          <div className="hero-actions animate-slide-up delay-300 mx-auto max-w-md">
            <form onSubmit={handleEmailSubmit} className="email-signup-form d-flex gap-2 shadow-md rounded-lg overflow-hidden">
              <input
                type="email"
                placeholder={t.emailPlaceholder}
                className="form-control border-0 py-3 flex-grow-1"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-primary btn-lg d-flex align-items-center gap-2 transition-transform hover-scale">
                <span>{t.getStarted}</span> <ArrowIcon />
              </button>
            </form>
          </div>
        </div>

        <div className="hero-image position-relative mt-5">
          <div className="image-collage d-flex justify-content-center">
            <div className="collage-image image1 rounded-lg shadow-lg transform-gpu scale-up-hover transition-transform"></div>
            <div className="collage-image image2 rounded-lg shadow-lg transform-gpu scale-up-hover transition-transform"></div>
            <div className="collage-image image3 rounded-lg shadow-lg transform-gpu scale-up-hover transition-transform"></div>
          </div>
        </div>
      </section>

      {/* Online Users Section - Now with real user data */}
      <section className="online-users-section animate-fade-in py-5 my-4">
        <div className="container">
          <div className="section-header text-center mb-5">
            <h2 className="gradient-text animate-slide-up mb-3 d-flex align-items-center justify-content-center gap-2">
              <FaUsers className="text-primary" /> <span>{t.onlineNow}</span>
            </h2>
            <p className="section-subtitle animate-slide-up delay-100 text-opacity-80 max-w-md mx-auto">
              {t.onlineSubtitle}
            </p>
          </div>

          {isLoading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : error ? (
            <div className="alert alert-danger">{error}</div>
          ) : (
            <div className="online-users-grid grid-cols-2 grid-cols-md-3 grid-cols-lg-4 gap-3 animate-slide-up delay-200">
              {onlineUsers.map((user, index) => (
                <div
                  key={user._id || user.id}
                  className="online-user-card staggered-item shadow-sm hover-shadow-md rounded-lg overflow-hidden cursor-pointer transform-gpu hover-scale"
                  onClick={() => navigate("/register")}
                  style={{animationDelay: `${index * 0.1}s`}}
                >
                  <div className="user-card-photo position-relative">
                    <img
                      src={(user.photos && user.photos[0] && user.photos[0].url) ||
                          (user.avatar || "/api/avatar/default")}
                      alt={user.nickname || "User"}
                      className="w-100 h-auto object-cover aspect-ratio-1"
                      loading="lazy"
                    />
                    <div className="user-status online position-absolute rounded-circle pulse-animation"></div>
                  </div>
                  <div className="user-card-info p-3">
                    <h3 className="user-name mb-1 font-weight-medium text-truncate">
                      {user.nickname || "User"}, {user.details?.age || "?"}
                    </h3>
                    <p className="user-location text-sm mb-2 d-flex align-items-center gap-1 text-opacity-70">
                      <FaMapMarkerAlt className="location-icon text-primary-light" />
                      {user.details?.location || "Unknown Location"}
                    </p>
                    <div className="user-actions d-flex gap-2 justify-content-end">
                      <button
                        className="mini-action-btn like-btn d-flex align-items-center justify-content-center rounded-circle shadow-sm hover-scale transition-transform"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate("/register");
                        }}
                        aria-label="Like user"
                      >
                        <FaRegHeart className="text-danger" />
                      </button>
                      <button
                        className="mini-action-btn message-btn d-flex align-items-center justify-content-center rounded-circle shadow-sm hover-scale transition-transform"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate("/register");
                        }}
                        aria-label="Message user"
                      >
                        <FaComment className="text-primary" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="view-more-container animate-slide-up delay-400 text-center mt-5">
            <button className="btn btn-secondary btn-lg d-inline-flex align-items-center gap-2 shadow-md hover-scale transition-all px-4 py-3" onClick={handleStartNow}>
              <span>{t.joinToSeeMore}</span> <ArrowIcon />
            </button>
          </div>
        </div>
      </section>

      {/* Features Section - Enhanced with more modern design */}
      <section className="features-section animate-fade-in glass-effect py-5 my-4 mx-3">
        <div className="container">
          <div className="section-header text-center mb-5">
            <h2 className="gradient-text animate-slide-up mb-3">{t.featuresTitle}</h2>
          </div>

          <div className="features-grid grid-cols-1 grid-cols-md-3 gap-4">
            <div className="feature-card animate-slide-up bg-white p-4 rounded-lg shadow-sm hover-shadow-md transition-all text-center">
              <div className="feature-icon-wrapper mb-4">
                <div className="feature-icon privacy d-flex justify-content-center align-items-center mx-auto rounded-circle bg-primary-50">
                  <FaLock className="text-primary" />
                </div>
              </div>
              <h3 className="font-weight-medium mb-3">{t.privacyTitle}</h3>
              <p className="text-opacity-70 line-height-relaxed">{t.privacyDesc}</p>
            </div>

            <div className="feature-card animate-slide-up delay-100 bg-white p-4 rounded-lg shadow-sm hover-shadow-md transition-all text-center">
              <div className="feature-icon-wrapper mb-4">
                <div className="feature-icon secure d-flex justify-content-center align-items-center mx-auto rounded-circle bg-primary-50">
                  <FaShieldAlt className="text-primary" />
                </div>
              </div>
              <h3 className="font-weight-medium mb-3">{t.secureTitle}</h3>
              <p className="text-opacity-70 line-height-relaxed">{t.secureDesc}</p>
            </div>

            <div className="feature-card animate-slide-up delay-200 bg-white p-4 rounded-lg shadow-sm hover-shadow-md transition-all text-center">
              <div className="feature-icon-wrapper mb-4">
                <div className="feature-icon match d-flex justify-content-center align-items-center mx-auto rounded-circle bg-primary-50">
                  <FaUsers className="text-primary" />
                </div>
              </div>
              <h3 className="font-weight-medium mb-3">{t.matchTitle}</h3>
              <p className="text-opacity-70 line-height-relaxed">{t.matchDesc}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="modern-footer mt-5 border-top pt-5">
        <div className="container footer-content d-flex flex-column flex-md-row justify-content-between align-items-center gap-4 mb-4">
          <div className="footer-logo gradient-text font-weight-bold text-xl">Mandarin</div>
          <div className="footer-links d-flex flex-wrap justify-content-center gap-3 gap-md-4">
            <Link to="/about" className="text-decoration-none text-body hover-text-primary transition-all">{t.footerAbout}</Link>
            <Link to="/safety" className="text-decoration-none text-body hover-text-primary transition-all">{t.footerSafety}</Link>
            <Link to="/support" className="text-decoration-none text-body hover-text-primary transition-all">{t.footerSupport}</Link>
            <Link to="/terms" className="text-decoration-none text-body hover-text-primary transition-all">{t.footerTerms}</Link>
            <Link to="/privacy" className="text-decoration-none text-body hover-text-primary transition-all">{t.footerPrivacy}</Link>
          </div>
          <div className="footer-social d-flex gap-3">
            <a href="#" className="social-icon d-flex align-items-center justify-content-center rounded-circle bg-light hover-bg-primary hover-text-white transition-all shadow-sm">
              FB
            </a>
            <a href="#" className="social-icon d-flex align-items-center justify-content-center rounded-circle bg-light hover-bg-primary hover-text-white transition-all shadow-sm">
              IG
            </a>
            <a href="#" className="social-icon d-flex align-items-center justify-content-center rounded-circle bg-light hover-bg-primary hover-text-white transition-all shadow-sm">
              TW
            </a>
          </div>
        </div>
        <div className="footer-bottom border-top py-3 text-center">
          <p className="text-sm text-opacity-70 mb-0">© {new Date().getFullYear()} Mandarin Dating. {t.footerRights}</p>
        </div>
      </footer>
    </div>
  )
}

export default Home
