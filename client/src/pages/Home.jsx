// client/src/pages/Home.jsx
import React, { useState, useEffect } from "react";
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
import "../styles/home.css";

// Fallback data if API fails or returns no users
const getMockUsers = () => [
  {
    _id: "mock1",
    nickname: "Emma",
    details: { age: 28, location: "New York" },
    photos: [{ url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb…"}],
    isOnline: true,
  },
  {
    _id: "mock2",
    nickname: "Michael",
    details: { age: 32, location: "Los Angeles" },
    photos: [{ url: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6…"}],
    isOnline: true,
  },
  {
    _id: "mock3",
    nickname: "Sophia",
    details: { age: 26, location: "Chicago" },
    photos: [{ url: "https://images.unsplash.com/photo-1517841905240-472988babdf9…"}],
    isOnline: true,
  },
  {
    _id: "mock4",
    nickname: "James",
    details: { age: 30, location: "Miami" },
    photos: [{ url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d…"}],
    isOnline: true,
  },
];

const Home = () => {
  const { t } = useTranslation();
  const { language, changeLanguage, dir } = useLanguage();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [displayError, setDisplayError] = useState(null);

  // Fetch the list of online users
  useEffect(() => {
    let isMounted = true;
    apiService
      .get("/users", { params: { online: true, limit: 12 } })
      .then((res) => {
        if (!isMounted) return;
        const users = Array.isArray(res.data) ? res.data : [];
        setOnlineUsers(users.length ? users : getMockUsers());
        setDisplayError(null);
      })
      .catch((err) => {
        console.error(err);
        if (!isMounted) return;
        setDisplayError(err.message || t("errors.generalError", "Something went wrong"));
        setOnlineUsers(getMockUsers());
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [t]);

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    navigate("/register", { state: { email } });
  };
  const handleStartNow = () => navigate("/register");

  const handleToggleLanguage = () => {
    const next = language === "en" ? "he" : "en";
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
      title: t("privacyTitle", "Privacy First"),
      desc: t(
        "privacyDesc",
        "Your privacy is our top priority. Control who sees your profile and what information you share."
      ),
    },
    {
      icon: FaShieldAlt,
      title: t("secureTitle", "Secure Communication"),
      desc: t(
        "secureDesc",
        "End‑to‑end encrypted messaging ensures your conversations remain private and secure."
      ),
    },
    {
      icon: FaUsers,
      title: t("matchTitle", "Smart Matching"),
      desc: t(
        "matchDesc",
        "Our advanced algorithm connects you with people who match your preferences and interests."
      ),
    },
  ];

  return (
    <div className="modern-home-page w-100 overflow-hidden" dir={dir}>
      {/* Header */}
      <header className="modern-header glass-effect sticky-top shadow-sm">
        <div className="container d-flex justify-content-between align-items-center py-2">
          <div className="logo gradient-text font-weight-bold">Mandarin</div>
          <nav className="d-none d-md-flex main-tabs gap-4">
            <Link to="/about" className="tab-button">
              {t("common.aboutUs", "About")}
            </Link>
            <Link to="/safety" className="tab-button">
              {t("common.privacyPolicy", "Safety")}
            </Link>
            <Link to="/support" className="tab-button">
              {t("common.contactSupport", "Support")}
            </Link>
          </nav>
          <div className="header-actions d-flex align-items-center gap-2">
            <button
              onClick={handleToggleLanguage}
              className="btn btn-outline btn-sm d-flex align-items-center gap-1"
              aria-label={t("common.language", "Toggle language")}
            >
              <FaLanguage />
              <span className="d-none d-sm-inline">{langLabel}</span>
            </button>
            <ThemeToggle />
            <Link to="/login" className="btn btn-outline btn-sm">
              {t("auth.signIn", "Login")}
            </Link>
            <Link to="/register" className="btn btn-primary btn-sm">
              {t("register.createAccount", "Register")}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section animate-fade-in py-5 position-relative overflow-hidden">
        <div className="hero-bg-shapes">
          <div className="shape shape-1" />
          <div className="shape shape-2" />
          <div className="shape shape-3" />
        </div>
        <div className="hero-content mx-auto text-center p-4 max-w-lg position-relative z-2">
          <h1 className="animate-slide-up mb-4 text-shadow font-weight-bold gradient-hero-text">
            {t("heroTitle", "Find Your Perfect Connection")}
          </h1>
          <p className="animate-slide-up delay-200 mb-4 text-md opacity-90 line-height-relaxed">
            {t(
              "heroSubtitle",
              "Discover genuine connections in a safe, discreet environment designed for adults seeking meaningful encounters."
            )}
          </p>
          <form
            onSubmit={handleEmailSubmit}
            className="email-signup-form d-flex gap-2 shadow-md rounded-lg overflow-hidden animate-slide-up delay-300 mx-auto max-w-md"
          >
            <input
              type="email"
              placeholder={t("emailPlaceholder", "Enter your email")}
              className="form-control border-0 py-3 flex-grow-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button
              type="submit"
              className="btn btn-primary btn-lg d-flex align-items-center gap-2 transition-transform hover-scale"
            >
              <span>{t("getStarted", "Get Started")}</span> <ArrowIcon />
            </button>
          </form>
        </div>
      </section>

      {/* Online Users */}
      <section className="online-users-section animate-fade-in py-5 my-4">
        <div className="container">
          <div className="section-header text-center mb-5">
            <h2 className="gradient-text animate-slide-up mb-3 d-flex align-items-center justify-content-center gap-2">
              <FaUsers /> {t("onlineNow", "People Online Now")}
            </h2>
            <p className="section-subtitle animate-slide-up delay-100 text-opacity-80 max-w-md mx-auto">
              {t(
                "onlineSubtitle",
                "Connect with these amazing people who are currently active on Mandarin"
              )}
            </p>
          </div>

          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status" />
            </div>
          ) : displayError ? (
            <div className="alert alert-danger">{displayError}</div>
          ) : (
            <div className="online-users-grid grid-cols-2 grid-cols-md-3 grid-cols-lg-4 gap-3">
              {onlineUsers.map((user, index) => (
                <div
                  key={user._id}
                  className="online-user-card staggered-item shadow-sm rounded-lg overflow-hidden cursor-pointer transform-gpu hover-scale"
                  onClick={handleStartNow}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="user-card-photo position-relative">
                    <img
                      src={user.photos?.[0]?.url || "/api/avatar/default"}
                      alt={user.nickname}
                      className="w-100 h-auto object-cover aspect-ratio-1"
                      loading="lazy"
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
                      <FaMapMarkerAlt /> {user.details?.location}
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
                        <FaRegHeart />
                      </button>
                      <button
                        className="mini-action-btn message-btn d-flex align-items-center justify-content-center rounded-circle shadow-sm hover-scale"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartNow();
                        }}
                        aria-label={t("common.message", "Message")}
                      >
                        <FaComment />
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
              {t("joinToSeeMore", "Join to See More")} <ArrowIcon />
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features-section animate-fade-in glass-effect py-5 my-4 mx-3">
        <div className="container">
          <h2 className="gradient-text animate-slide-up mb-5 text-center">
            {t("featuresTitle", "Why Choose Mandarin")}
          </h2>
          <div className="features-grid grid-cols-1 grid-cols-md-3 gap-4">
            {features.map(({ icon: Icon, title, desc }, idx) => (
              <div key={idx} className="feature-card animate-slide-up transition-all text-center">
                <div className="feature-icon-wrapper mb-4">
                  <div className="feature-icon privacy d-flex justify-content-center align-items-center mx-auto rounded-circle bg-primary-50">
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

      {/* Footer */}
      <footer className="modern-footer mt-5 border-top pt-5">
        <div className="container footer-content d-flex flex-column flex-md-row justify-content-between align-items-center gap-4 mb-4">
          <div className="footer-logo gradient-text font-weight-bold text-xl">Mandarin</div>
          <div className="footer-links d-flex flex-wrap justify-content-center gap-3 gap-md-4">
            <Link to="/about">{t("common.aboutUs", "About Us")}</Link>
            <Link to="/safety">{t("common.privacyPolicy", "Safety")}</Link>
            <Link to="/support">{t("common.contactSupport", "Support")}</Link>
            <Link to="/terms">{t("common.termsOfService", "Terms")}</Link>
            <Link to="/privacy">{t("common.privacyPolicy", "Privacy")}</Link>
          </div>
          <div className="footer-social d-flex gap-3">
            {["FB", "IG", "TW"].map((lbl) => (
              <a key={lbl} href="#" aria-label={lbl} className="social-icon">
                {lbl}
              </a>
            ))}
          </div>
        </div>
        <div className="footer-bottom border-top py-3 text-center">
          © {new Date().getFullYear()} Mandarin.{" "}
          {t("common.allRightsReserved", "All rights reserved.")}
        </div>
      </footer>
    </div>
  );
};

export default Home;
