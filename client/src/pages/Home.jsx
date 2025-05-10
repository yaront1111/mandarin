// client/src/pages/Home.jsx
import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaArrowRight,
  FaArrowLeft,
  FaMapMarkerAlt,
  FaRegHeart,
  FaComment,
  FaUsers,
  FaLanguage,
  FaLock,
  FaShieldAlt,
} from "react-icons/fa";
import { useTranslation } from "react-i18next";

import apiService from "../services/apiService";       // your axios/fetch wrapper
import { useLanguage } from "../context";              // your LanguageContext
import { ThemeToggle } from "../components/theme-toggle";
import { SEO } from "../components";
import { createLogger } from "../utils/logger";
import { useIsMobile, useMobileDetect } from "../hooks";
import { enhanceScrolling, provideTactileFeedback } from "../utils/mobileGestures";
import "../styles/home.css";

const logger = createLogger('Home');

// Fallback data if API fails or returns no users
const getMockUsers = () => [
  {
    _id: "mock1",
    nickname: "Emma",
    details: { age: 28, location: "New York" },
    photos: [{ url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80"}],
    isOnline: true,
  },
  {
    _id: "mock2",
    nickname: "Michael",
    details: { age: 32, location: "Los Angeles" },
    photos: [{ url: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80"}],
    isOnline: true,
  },
  {
    _id: "mock3",
    nickname: "Sophia",
    details: { age: 26, location: "Chicago" },
    photos: [{ url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80"}],
    isOnline: true,
  },
  {
    _id: "mock4",
    nickname: "James",
    details: { age: 30, location: "Miami" },
    photos: [{ url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80"}],
    isOnline: true,
  },
  {
    _id: "mock5",
    nickname: "Olivia",
    details: { age: 27, location: "Tel Aviv" },
    photos: [{ url: "https://images.unsplash.com/photo-1524502397800-2eeaad7c3fe5?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80"}],
    isOnline: true,
  },
  {
    _id: "mock6",
    nickname: "Daniel",
    details: { age: 33, location: "London" },
    photos: [{ url: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80"}],
    isOnline: true,
  },
  {
    _id: "mock7",
    nickname: "Ava",
    details: { age: 24, location: "Paris" },
    photos: [{ url: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80"}],
    isOnline: true,
  },
  {
    _id: "mock8",
    nickname: "Noah",
    details: { age: 29, location: "Berlin" },
    photos: [{ url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80"}],
    isOnline: true,
  },
];

const Home = () => {
  const { t } = useTranslation();
  const { language, changeLanguage, dir } = useLanguage();
  const navigate = useNavigate();
  
  // Mobile detection
  const isMobile = useIsMobile();
  const { isTouch, isIOS, isAndroid } = useMobileDetect();
  
  // Refs for scroll optimization and touch gestures
  const homeContainerRef = useRef(null);
  const usersGridRef = useRef(null);
  const currentCardIndex = useRef(0);
  
  const [email, setEmail] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [displayError, setDisplayError] = useState(null);
  const [swipeDirection, setSwipeDirection] = useState(null);

  // Fetch the list of online users
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    
    // Attempt to fetch online users from the API
    apiService
      .get("/users", { params: { online: true, limit: 12 } })
      .then((res) => {
        if (!isMounted) return;
        const users = Array.isArray(res.data) ? res.data : [];
        // If no users or error, use mock data
        setOnlineUsers(users.length ? users : getMockUsers());
        setDisplayError(null);
      })
      .catch((err) => {
        logger.error("Error fetching online users:", err);
        if (!isMounted) return;
        // On error, show mock data instead of an error message for better UX
        setOnlineUsers(getMockUsers());
        setDisplayError(null); // Hide error for better UX on home page
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
          // Trigger animation for user cards
          setTimeout(() => {
            const cards = document.querySelectorAll('.staggered-item');
            cards.forEach(card => card.classList.add('animated'));
          }, 300);
        }
      });
      
    return () => {
      isMounted = false;
    };
  }, [t]);
  
  // Mobile optimizations
  useEffect(() => {
    // Enhance scrolling behavior on mobile
    let cleanupScrolling = null;
    if (isTouch && homeContainerRef.current) {
      cleanupScrolling = enhanceScrolling(homeContainerRef.current);
      logger.debug('Mobile scroll enhancements applied to Home');
    }
    
    return () => {
      if (cleanupScrolling) cleanupScrolling();
    };
  }, [isTouch]);
  
  // Setup touch gestures for the user cards grid
  useEffect(() => {
    if (!isTouch || !usersGridRef.current) return;
    
    let touchStartX = 0;
    let touchEndX = 0;
    
    const handleTouchStart = (e) => {
      touchStartX = e.changedTouches[0].screenX;
    };
    
    const handleTouchEnd = (e) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    };
    
    const handleSwipe = () => {
      const swipeThreshold = 50;
      if (touchEndX - touchStartX > swipeThreshold) {
        // Right swipe
        setSwipeDirection('right');
        if (isTouch) provideTactileFeedback('selectConversation');
        
        // Find the currently visible card and "like" it
        const visibleCardIndex = Math.min(
          Math.max(currentCardIndex.current - 1, 0), 
          onlineUsers.length - 1
        );
        currentCardIndex.current = visibleCardIndex;
        
        // Animate the "like" button for the visible card
        const cards = usersGridRef.current.querySelectorAll('.online-user-card');
        if (cards[visibleCardIndex]) {
          const likeBtn = cards[visibleCardIndex].querySelector('.like-btn');
          if (likeBtn) {
            likeBtn.classList.add('swiped-right');
            setTimeout(() => likeBtn.classList.remove('swiped-right'), 500);
          }
        }
        
      } else if (touchStartX - touchEndX > swipeThreshold) {
        // Left swipe
        setSwipeDirection('left');
        if (isTouch) provideTactileFeedback('selectConversation');
        
        // Find the currently visible card and show "next"
        const visibleCardIndex = Math.min(
          Math.max(currentCardIndex.current + 1, 0), 
          onlineUsers.length - 1
        );
        currentCardIndex.current = visibleCardIndex;
        
        // Animate the card transition
        const cards = usersGridRef.current.querySelectorAll('.online-user-card');
        if (cards.length > 0) {
          cards.forEach(card => card.classList.add('swiped-left'));
          setTimeout(() => {
            cards.forEach(card => card.classList.remove('swiped-left'));
          }, 300);
        }
      }
    };
    
    const gridElement = usersGridRef.current;
    gridElement.addEventListener('touchstart', handleTouchStart, { passive: true });
    gridElement.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    return () => {
      gridElement.removeEventListener('touchstart', handleTouchStart);
      gridElement.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isTouch, onlineUsers.length]);

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    // Add tactile feedback for mobile devices
    if (isTouch) provideTactileFeedback('send');
    navigate("/register", { state: { email } });
  };
  
  const handleStartNow = () => {
    // Add tactile feedback for mobile devices
    if (isTouch) provideTactileFeedback('selectConversation');
    navigate("/register");
  };

  const handleToggleLanguage = () => {
    const next = language === "en" ? "he" : "en";
    // Add tactile feedback for mobile devices
    if (isTouch) provideTactileFeedback('selectConversation');
    changeLanguage(next);
  };

  const ArrowIcon = dir === "rtl" ? FaArrowLeft : FaArrowRight;
  const langLabel =
    language === "en"
      ? t("settings.languageHebrew", "עברית")
      : t("settings.languageEnglish", "English");

  // Feature cards data
  const features = [
    {
      icon: FaLock,
      title: t("home.privacyTitle", "Privacy First"),
      desc: t(
        "home.privacyDescription",
        "Your privacy is our top priority. Control who sees your profile and what information you share."
      ),
    },
    {
      icon: FaShieldAlt,
      title: t("home.secureTitle", "Secure Communication"),
      desc: t(
        "home.secureCommDescription",
        "End‑to‑end encrypted messaging ensures your conversations remain private and secure."
      ),
    },
    {
      icon: FaUsers,
      title: t("home.matchTitle", "Smart Matching"),
      desc: t(
        "home.smartMatchingDescription",
        "Our advanced algorithm connects you with people who match your preferences and interests."
      ),
    },
  ];

  // Define schema for structured data
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Flirtss",
    "url": "https://flirtss.com/",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://flirtss.com/search?q={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <div 
      ref={homeContainerRef}
      className={`modern-home-page w-100 overflow-hidden ${isMobile ? 'mobile-optimized' : ''}`} 
      dir={dir}>
      <SEO 
        title="Find Your Perfect Connection" 
        description="Discover genuine connections in a safe, discreet environment designed for adults seeking meaningful relationships."
        schema={websiteSchema}
      />

      {/* Hero Section */}
      <section className="hero-section animate-fade-in py-5 position-relative overflow-hidden">
        <div className="hero-bg-shapes">
          <div className="shape shape-1" />
          <div className="shape shape-2" />
          <div className="shape shape-3" />
        </div>
        <div className="hero-content mx-auto text-center p-4 max-w-lg position-relative z-2">
          <h1 className="animate-slide-up mb-4 text-shadow font-weight-bold gradient-hero-text">
            {t("home.findYourConnection", "Find Your Perfect Connection")}
          </h1>
          <p className="animate-slide-up delay-200 mb-4 text-md opacity-90 line-height-relaxed">
            {t(
              "home.heroSubtitle",
              "Discover genuine connections in a safe, discreet environment designed for adults seeking meaningful encounters."
            )}
          </p>
          <form
            onSubmit={handleEmailSubmit}
            className="email-signup-form d-flex gap-2 shadow-md rounded-lg overflow-hidden animate-slide-up delay-300 mx-auto max-w-md"
          >
            <input
              type="email"
              placeholder={t("home.emailPlaceholder", "Enter your email")}
              className="form-control border-0 py-3 flex-grow-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button
              type="submit"
              className="btn btn-primary btn-lg d-flex align-items-center gap-2 transition-transform hover-scale"
            >
              <span>{t("home.getStarted", "Get Started")}</span> <ArrowIcon />
            </button>
          </form>
        </div>
      </section>

      {/* Online Users */}
      <section className="online-users-section animate-fade-in py-5 my-4">
        <div className="container">
          <div className="section-header text-center mb-5">
            <h2 className="gradient-text animate-slide-up mb-3 d-flex align-items-center justify-content-center gap-2">
              <FaUsers /> {t("home.peopleOnlineNow", "People Online Now")}
            </h2>
            <p className="section-subtitle animate-slide-up delay-100 text-opacity-80 max-w-md mx-auto">
              {t(
                "home.onlineNowSubtitle",
                "Connect with these amazing people who are currently active on Mandarin"
              )}
            </p>
          </div>

          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : displayError ? (
            <div className="alert alert-danger">{displayError}</div>
          ) : (
            <div 
              ref={usersGridRef}
              className={`online-users-grid ${isMobile ? 'swipe-enabled' : ''}`}>
              {onlineUsers.map((user, index) => (
                <div
                  key={user._id}
                  className="online-user-card staggered-item shadow-sm rounded-lg overflow-hidden cursor-pointer transform-gpu hover-scale animated"
                  onClick={handleStartNow}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="user-card-photo position-relative">
                    <img
                      src={user.photos?.[0]?.url || "/default-avatar.png"}
                      alt={user.nickname}
                      className="w-100 h-100 object-cover"
                      loading="lazy"
                      onError={(e) => {
                        e.target.src = "/default-avatar.png";
                      }}
                    />
                    {user.isOnline && (
                      <div className="user-status online position-absolute rounded-circle pulse-animation" />
                    )}
                  </div>
                  <div className="user-card-info p-3">
                    <h3 className="user-name mb-1 font-weight-medium text-truncate">
                      {user.nickname}, {user.details?.age || "?"}
                    </h3>
                    <p className="user-location text-sm mb-2 d-flex align-items-center gap-1 text-opacity-70">
                      <FaMapMarkerAlt /> {user.details?.location || t("common.notSpecified", "Not specified")}
                    </p>
                    <div className="user-actions d-flex gap-2 justify-content-end">
                      <button
                        className="mini-action-btn like-btn d-flex align-items-center justify-content-center rounded-circle shadow-sm hover-scale"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartNow();
                        }}
                        aria-label={t("common.like", "Like")}
                      >
                        <FaRegHeart className="action-icon" />
                      </button>
                      <button
                        className="mini-action-btn message-btn d-flex align-items-center justify-content-center rounded-circle shadow-sm hover-scale"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartNow();
                        }}
                        aria-label={t("common.message", "Message")}
                      >
                        <FaComment className="action-icon" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="view-more-container animate-slide-up delay-400 text-center mt-5">
            <button
              className="btn btn-secondary btn-lg d-inline-flex align-items-center gap-2"
              onClick={handleStartNow}
            >
              {t("home.joinToSeeMore", "Join to See More")} <ArrowIcon />
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features-section animate-fade-in glass-effect py-5 my-4 mx-3">
        <div className="container">
          <h2 className="gradient-text animate-slide-up mb-5 text-center">
            {t("home.featuresTitle", "Why Choose Mandarin")}
          </h2>
          <div className="features-grid">
            {features.map(({ icon: Icon, title, desc }, idx) => (
              <div 
                key={idx} 
                className="feature-card animate-slide-up transition-all text-center"
                style={{ animationDelay: `${idx * 0.15}s` }}
              >
                <div className="feature-icon-wrapper mb-4">
                  <div className="feature-icon d-flex justify-content-center align-items-center mx-auto rounded-circle bg-primary-50">
                    <Icon />
                  </div>
                </div>
                <h3 className="font-weight-medium mb-3">{title}</h3>
                <p className="text-opacity-70 line-height-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
};

export default Home;
