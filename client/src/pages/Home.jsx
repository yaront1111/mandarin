// client/src/pages/Home.jsx
import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaArrowRight, FaArrowLeft, FaMapMarkerAlt, FaRegHeart, FaComment, FaUsers, FaGlobe, FaLanguage, FaLock, FaShieldAlt } from "react-icons/fa";
import { useTranslation } from 'react-i18next'; // Import useTranslation


import { useApi } from '../hooks'; // Keep useApi from hooks
import { useLanguage } from '../context'; // Import useLanguage from context
// Assuming ThemeToggle is exported correctly
import { ThemeToggle } from "../components/theme-toggle";
// Assuming apiService instance is needed for the hook or exported from services
// import apiService from '../services/apiService'; // Import apiService if needed directly

// Mock users function (kept as fallback)
const getMockUsers = () => {
  // Return the same mock user array as before...
  return [
    { _id: "mock1", nickname: "Emma", details: { age: 28, location: "New York" }, photos: [{ url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80" }], isOnline: true },
    { _id: "mock2", nickname: "Michael", details: { age: 32, location: "Los Angeles" }, photos: [{ url: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80" }], isOnline: true },
    { _id: "mock3", nickname: "Sophia", details: { age: 26, location: "Chicago" }, photos: [{ url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80" }], isOnline: true },
    { _id: "mock4", nickname: "James", details: { age: 30, location: "Miami" }, photos: [{ url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80" }], isOnline: true },
    // Add other mock users with _id
  ];
};


const Home = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation(); // Use i18n hook
  const { language, changeLanguage, dir } = useLanguage(); // Use language context hook
  const { data: fetchedUsers, loading, error: apiError, callApi } = useApi(); // Use API hook

  const [email, setEmail] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [displayError, setDisplayError] = useState(null); // Separate state for displaying error message

  // Fetch online users using useApi hook
  useEffect(() => {
    // Assuming apiService.get is the intended function to call
    // Adjust the call according to how useApi expects the function/parameters
    callApi('/users', { params: { online: true, limit: 12 } }, 'get'); // Pass method type if useApi requires it
  }, [callApi]);

  // Process fetched data or error
  useEffect(() => {
    if (loading) {
      setDisplayError(null); // Clear error while loading
    } else if (apiError) {
      console.error("Error fetching online users:", apiError);
      setDisplayError(apiError.message || t('errors.failedToLoadOnlineUsers', "Failed to load online users")); // Use translation for error message
      setOnlineUsers(getMockUsers()); // Fallback to mock data
    } else if (fetchedUsers) {
       // Ensure fetchedUsers is treated as an array
       const usersArray = Array.isArray(fetchedUsers) ? fetchedUsers : (fetchedUsers.data && Array.isArray(fetchedUsers.data)) ? fetchedUsers.data : [];

       if (usersArray.length > 0) {
           setOnlineUsers(usersArray);
       } else {
           // Optional: Fallback if API returns success but empty data
           setOnlineUsers(getMockUsers());
       }
       setDisplayError(null); // Clear error on success
    } else {
      // Initial state or successful empty response
      setOnlineUsers([]);
      setDisplayError(null);
    }
  }, [fetchedUsers, loading, apiError, t]);


  const handleStartNow = () => {
    navigate("/register");
  };

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    navigate("/register", { state: { email } });
  };

  // Toggle language using the context function
  const handleToggleLanguage = () => {
    const nextLang = language === 'en' ? 'he' : 'en';
    changeLanguage(nextLang); // Use the function from the context
  };

  // Determine the correct arrow icon based on text direction from context
  const ArrowIcon = dir === 'rtl' ? FaArrowLeft : FaArrowRight;
  const languageToggleText = language === 'en' ? t('languageToggleHE', 'עברית') : t('languageToggleEN', 'English');


  return (
    // Add dir attribute to the root element for component-level directionality if needed,
    // although LanguageContext likely handles it globally on <html>
    <div className="modern-home-page w-100 overflow-hidden" dir={dir}>
      {/* Modern Header */}
      <header className="modern-header glass-effect sticky-top shadow-sm">
        <div className="container d-flex justify-content-between align-items-center py-2">
          <div className="logo gradient-text font-weight-bold text-nowrap">Mandarin</div>
          <nav className="d-none d-md-flex main-tabs gap-4">
            {/* Use translation keys */}
            <Link to="/about" className="tab-button hover-opacity transition-all">
              {t('about', 'About')}
            </Link>
            <Link to="/safety" className="tab-button hover-opacity transition-all">
              {t('safety', 'Safety')}
            </Link>
            <Link to="/support" className="tab-button hover-opacity transition-all">
              {t('support', 'Support')}
            </Link>
          </nav>
          <div className="header-actions d-flex align-items-center gap-2">
            <button
              onClick={handleToggleLanguage} // Use context toggle function
              className="btn btn-outline btn-sm hover-scale transition-all d-flex align-items-center gap-1"
              aria-label={t('toggleLanguage', 'Toggle language')}
            >
              <FaLanguage />
              <span className="d-none d-sm-inline">{languageToggleText}</span>
            </button>
            <ThemeToggle /> {/* Ensure ThemeToggle component works */}
            <Link to="/login" className="btn btn-outline btn-sm hover-scale transition-all">
              {t('login', 'Login')}
            </Link>
            <Link to="/register" className="btn btn-primary btn-sm hover-scale transition-all">
              {t('register', 'Register')}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section animate-fade-in py-5 position-relative overflow-hidden">
        {/* ... background shapes ... */}
         <div className="hero-bg-shapes">
          <div className="shape shape-1"></div>
          <div className="shape shape-2"></div>
          <div className="shape shape-3"></div>
        </div>

        <div className="hero-content mx-auto text-center p-4 max-w-lg position-relative z-2">
          <h1 className="animate-slide-up mb-4 text-shadow font-weight-bold gradient-hero-text">
            {t('heroTitle', 'Find Your Perfect Connection')}
          </h1>
          <p className="animate-slide-up delay-200 mb-4 text-md opacity-90 line-height-relaxed">
            {t('heroSubtitle', 'Discover genuine connections in a safe, discreet environment designed for adults seeking meaningful encounters.')}
          </p>
          <div className="hero-actions animate-slide-up delay-300 mx-auto max-w-md">
            <form onSubmit={handleEmailSubmit} className="email-signup-form d-flex gap-2 shadow-md rounded-lg overflow-hidden">
              <input
                type="email"
                placeholder={t('emailPlaceholder', 'Enter your email')}
                className="form-control border-0 py-3 flex-grow-1"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-primary btn-lg d-flex align-items-center gap-2 transition-transform hover-scale">
                <span>{t('getStarted', 'Get Started')}</span> <ArrowIcon />
              </button>
            </form>
          </div>
        </div>

        {/* ... hero image collage ... */}
         <div className="hero-image position-relative mt-5">
          <div className="image-collage d-flex justify-content-center">
            <div className="collage-image image1 rounded-lg shadow-lg transform-gpu scale-up-hover transition-transform"></div>
            <div className="collage-image image2 rounded-lg shadow-lg transform-gpu scale-up-hover transition-transform"></div>
            <div className="collage-image image3 rounded-lg shadow-lg transform-gpu scale-up-hover transition-transform"></div>
          </div>
        </div>
      </section>

      {/* Online Users Section */}
      <section className="online-users-section animate-fade-in py-5 my-4">
        <div className="container">
          <div className="section-header text-center mb-5">
            <h2 className="gradient-text animate-slide-up mb-3 d-flex align-items-center justify-content-center gap-2">
              <FaUsers className="text-primary" /> <span>{t('onlineNow', 'People Online Now')}</span>
            </h2>
            <p className="section-subtitle animate-slide-up delay-100 text-opacity-80 max-w-md mx-auto">
              {t('onlineSubtitle', 'Connect with these amazing people who are currently active on Mandarin')}
            </p>
          </div>

          {/* Use loading state from useApi */}
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">{t('loading', 'Loading...')}</span>
              </div>
            </div>
            // Use displayError state
          ) : displayError ? (
            <div className="alert alert-danger">{displayError}</div>
          ) : (
            <div className="online-users-grid grid-cols-2 grid-cols-md-3 grid-cols-lg-4 gap-3 animate-slide-up delay-200">
              {/* Ensure onlineUsers is an array before mapping */}
              {Array.isArray(onlineUsers) && onlineUsers.map((user, index) => (
                <div
                  // Use _id consistently
                  key={user._id}
                  className="online-user-card staggered-item shadow-sm hover-shadow-md rounded-lg overflow-hidden cursor-pointer transform-gpu hover-scale"
                  onClick={() => navigate("/register")}
                  style={{animationDelay: `${index * 0.1}s`}}
                >
                  <div className="user-card-photo position-relative">
                    <img
                      // Consider using the normalizePhotoUrl utility if needed/available
                      src={(user.photos && user.photos[0]?.url) || user.avatar || "/api/avatar/default"}
                      alt={user.nickname || t('userAlt', 'User')}
                      className="w-100 h-auto object-cover aspect-ratio-1"
                      loading="lazy"
                    />
                    {user.isOnline && <div className="user-status online position-absolute rounded-circle pulse-animation"></div>}
                  </div>
                  <div className="user-card-info p-3">
                    <h3 className="user-name mb-1 font-weight-medium text-truncate">
                      {user.nickname || t('user', 'User')}, {user.details?.age || "?"}
                    </h3>
                    <p className="user-location text-sm mb-2 d-flex align-items-center gap-1 text-opacity-70">
                      <FaMapMarkerAlt className="location-icon text-primary-light" />
                      {user.details?.location || t('unknownLocation', 'Unknown Location')}
                    </p>
                    <div className="user-actions d-flex gap-2 justify-content-end">
                       <button
                        className="mini-action-btn like-btn d-flex align-items-center justify-content-center rounded-circle shadow-sm hover-scale transition-transform"
                        onClick={(e) => { e.stopPropagation(); navigate("/register"); }}
                        aria-label={t('likeUser', 'Like user')}
                      >
                        <FaRegHeart className="text-danger" />
                      </button>
                      <button
                        className="mini-action-btn message-btn d-flex align-items-center justify-content-center rounded-circle shadow-sm hover-scale transition-transform"
                        onClick={(e) => { e.stopPropagation(); navigate("/register"); }}
                        aria-label={t('messageUser', 'Message user')}
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
              <span>{t('joinToSeeMore', 'Join to See More')}</span> <ArrowIcon />
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section animate-fade-in glass-effect py-5 my-4 mx-3">
         <div className="container">
          <div className="section-header text-center mb-5">
            <h2 className="gradient-text animate-slide-up mb-3">{t('featuresTitle', 'Why Choose Mandarin')}</h2>
          </div>

          <div className="features-grid grid-cols-1 grid-cols-md-3 gap-4">
            {/* Feature Card 1 */}
            <div className="feature-card animate-slide-up bg-white p-4 rounded-lg shadow-sm hover-shadow-md transition-all text-center">
              <div className="feature-icon-wrapper mb-4">
                 <div className="feature-icon privacy d-flex justify-content-center align-items-center mx-auto rounded-circle bg-primary-50">
                  <FaLock className="text-primary" aria-hidden="true" /> {/* Added aria-hidden */}
                </div>
              </div>
              <h3 className="font-weight-medium mb-3">{t('privacyTitle', 'Privacy First')}</h3>
              <p className="text-opacity-70 line-height-relaxed">{t('privacyDesc', 'Your privacy is our top priority. Control who sees your profile and what information you share.')}</p>
            </div>
            {/* Feature Card 2 */}
            <div className="feature-card animate-slide-up delay-100 bg-white p-4 rounded-lg shadow-sm hover-shadow-md transition-all text-center">
               <div className="feature-icon-wrapper mb-4">
                <div className="feature-icon secure d-flex justify-content-center align-items-center mx-auto rounded-circle bg-primary-50">
                  <FaShieldAlt className="text-primary" aria-hidden="true" /> {/* Added aria-hidden */}
                </div>
              </div>
              <h3 className="font-weight-medium mb-3">{t('secureTitle', 'Secure Communication')}</h3>
              <p className="text-opacity-70 line-height-relaxed">{t('secureDesc', 'End-to-end encrypted messaging ensures your conversations remain private and secure.')}</p>
            </div>
            {/* Feature Card 3 */}
             <div className="feature-card animate-slide-up delay-200 bg-white p-4 rounded-lg shadow-sm hover-shadow-md transition-all text-center">
               <div className="feature-icon-wrapper mb-4">
                <div className="feature-icon match d-flex justify-content-center align-items-center mx-auto rounded-circle bg-primary-50">
                  <FaUsers className="text-primary" aria-hidden="true" /> {/* Added aria-hidden */}
                </div>
              </div>
              <h3 className="font-weight-medium mb-3">{t('matchTitle', 'Smart Matching')}</h3>
              <p className="text-opacity-70 line-height-relaxed">{t('matchDesc', "Our advanced algorithm connects you with people who match your preferences and interests.")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="modern-footer mt-5 border-top pt-5">
        <div className="container footer-content d-flex flex-column flex-md-row justify-content-between align-items-center gap-4 mb-4">
          <div className="footer-logo gradient-text font-weight-bold text-xl">Mandarin</div>
          <div className="footer-links d-flex flex-wrap justify-content-center gap-3 gap-md-4">
            <Link to="/about" className="text-decoration-none text-body hover-text-primary transition-all">{t('footerAbout', 'About Us')}</Link>
            <Link to="/safety" className="text-decoration-none text-body hover-text-primary transition-all">{t('footerSafety', 'Safety')}</Link>
            <Link to="/support" className="text-decoration-none text-body hover-text-primary transition-all">{t('footerSupport', 'Support')}</Link>
            <Link to="/terms" className="text-decoration-none text-body hover-text-primary transition-all">{t('footerTerms', 'Terms')}</Link>
            <Link to="/privacy" className="text-decoration-none text-body hover-text-primary transition-all">{t('footerPrivacy', 'Privacy')}</Link>
          </div>
          {/* ... social icons ... */}
           <div className="footer-social d-flex gap-3">
            <a href="#" aria-label={t('facebookAriaLabel', 'Facebook')} className="social-icon d-flex align-items-center justify-content-center rounded-circle bg-light hover-bg-primary hover-text-white transition-all shadow-sm">
              FB
            </a>
            <a href="#" aria-label={t('instagramAriaLabel', 'Instagram')} className="social-icon d-flex align-items-center justify-content-center rounded-circle bg-light hover-bg-primary hover-text-white transition-all shadow-sm">
              IG
            </a>
            <a href="#" aria-label={t('twitterAriaLabel', 'Twitter')} className="social-icon d-flex align-items-center justify-content-center rounded-circle bg-light hover-bg-primary hover-text-white transition-all shadow-sm">
              TW
            </a>
          </div>
        </div>
        <div className="footer-bottom border-top py-3 text-center">
          <p className="text-sm text-opacity-70 mb-0">© {new Date().getFullYear()} Mandarin Dating. {t('footerRights', 'All rights reserved.')}</p>
        </div>
      </footer>
    </div>
  );
};

export default Home;
