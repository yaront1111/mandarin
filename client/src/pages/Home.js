import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaHeart, FaShieldAlt, FaComments, FaSearch, FaArrowRight } from 'react-icons/fa';

const Home = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');

  const handleStartNow = () => {
    navigate('/register');
  };

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    navigate('/register', { state: { email } });
  };

  return (
    <div className="home-page">
      <header className="landing-header">
        <div className="container">
          <div className="logo">Mandarin</div>
          <nav className="landing-nav">
            <Link to="/about">About</Link>
            <Link to="/safety">Safety</Link>
            <Link to="/support">Support</Link>
          </nav>
          <div className="header-actions">
            <Link to="/login" className="btn btn-outline">Login</Link>
            <Link to="/register" className="btn btn-primary">Register</Link>
          </div>
        </div>
      </header>

      <section className="hero-section">
        <div className="hero-overlay"></div>
        <div className="container hero-container">
          <div className="hero-content">
            <h1>Find Your Perfect Connection</h1>
            <p>Discover genuine connections in a safe, discreet environment designed for adults seeking meaningful encounters.</p>
            <form className="hero-form" onSubmit={handleEmailSubmit}>
              <input
                type="email"
                placeholder="Enter your email to get started"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-primary">
                <span>Get Started</span>
                <FaArrowRight />
              </button>
            </form>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-value">2M+</span>
                <span className="stat-label">Active Users</span>
              </div>
              <div className="stat">
                <span className="stat-value">85%</span>
                <span className="stat-label">Match Rate</span>
              </div>
              <div className="stat">
                <span className="stat-value">100%</span>
                <span className="stat-label">Discreet</span>
              </div>
            </div>
          </div>
          <div className="hero-image">
            <div className="image-grid">
              <div className="image-card card-1">
                <img src="/images/couple-1.jpg" alt="Happy couple" />
              </div>
              <div className="image-card card-2">
                <img src="/images/profile-1.jpg" alt="Dating profile" />
              </div>
              <div className="image-card card-3">
                <img src="/images/couple-2.jpg" alt="Couple meeting" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="features-section">
        <div className="container">
          <h2 className="section-title">Why Choose <span>Mandarin</span></h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <FaShieldAlt />
              </div>
              <h3>Private & Secure</h3>
              <p>Your privacy matters. All profiles are verified, and your data is protected with end-to-end encryption.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <FaSearch />
              </div>
              <h3>Smart Matching</h3>
              <p>Our advanced algorithm connects you with compatible partners based on your preferences and interests.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <FaHeart />
              </div>
              <h3>Quality Connections</h3>
              <p>Find genuine connections with like-minded adults seeking casual and meaningful encounters.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <FaComments />
              </div>
              <h3>Real Conversations</h3>
              <p>Break the ice easily with our conversation starters and enjoy video calls for deeper connections.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="how-it-works">
        <div className="container">
          <h2 className="section-title">How Mandarin Works</h2>
          <div className="steps-container">
            <div className="step">
              <div className="step-number">1</div>
              <h3>Create Your Profile</h3>
              <p>Sign up and create your profile with your preferences and interests.</p>
            </div>
            <div className="step-arrow">→</div>
            <div className="step">
              <div className="step-number">2</div>
              <h3>Find Matches</h3>
              <p>Browse profiles and discover potential matches that align with your desires.</p>
            </div>
            <div className="step-arrow">→</div>
            <div className="step">
              <div className="step-number">3</div>
              <h3>Connect & Chat</h3>
              <p>Start conversations, share photos, and arrange to meet when you're ready.</p>
            </div>
          </div>
          <button className="btn btn-primary btn-lg" onClick={handleStartNow}>Start Now</button>
        </div>
      </section>

      <section className="testimonials-section">
        <div className="container">
          <h2 className="section-title">Success Stories</h2>
          <div className="testimonials-grid">
            <div className="testimonial">
              <div className="testimonial-content">
                <p>"Mandarin changed my dating life. The connections are genuine and the privacy features give me peace of mind."</p>
              </div>
              <div className="testimonial-author">
                <img src="/images/testimonial-1.jpg" alt="Michael, 34" />
                <div>
                  <h4>Michael, 34</h4>
                  <p>Member since 2023</p>
                </div>
              </div>
            </div>
            <div className="testimonial">
              <div className="testimonial-content">
                <p>"I've tried many dating platforms, but Mandarin truly understands what adults are looking for in casual relationships."</p>
              </div>
              <div className="testimonial-author">
                <img src="/images/testimonial-2.jpg" alt="Jessica, 29" />
                <div>
                  <h4>Jessica, 29</h4>
                  <p>Member since 2022</p>
                </div>
              </div>
            </div>
            <div className="testimonial">
              <div className="testimonial-content">
                <p>"The verification process ensures I'm talking to real people. I've made amazing connections that I wouldn't have found elsewhere."</p>
              </div>
              <div className="testimonial-author">
                <img src="/images/testimonial-3.jpg" alt="David, 37" />
                <div>
                  <h4>David, 37</h4>
                  <p>Member since 2023</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="container">
          <div className="cta-content">
            <h2>Ready to Find Your Perfect Match?</h2>
            <p>Join thousands of adults finding meaningful connections every day.</p>
            <button className="btn btn-light btn-lg" onClick={handleStartNow}>Create Your Free Profile</button>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-brand">
              <div className="logo">Mandarin</div>
              <p>Connecting adults in a safe, discreet environment.</p>
              <div className="social-links">
                <a href="#" aria-label="Facebook"><i className="fab fa-facebook-f"></i></a>
                <a href="#" aria-label="Instagram"><i className="fab fa-instagram"></i></a>
                <a href="#" aria-label="Twitter"><i className="fab fa-twitter"></i></a>
              </div>
            </div>
            <div className="footer-links">
              <div className="link-group">
                <h4>Company</h4>
                <Link to="/about">About Us</Link>
                <Link to="/careers">Careers</Link>
                <Link to="/press">Press</Link>
              </div>
              <div className="link-group">
                <h4>Resources</h4>
                <Link to="/safety">Safety Tips</Link>
                <Link to="/blog">Blog</Link>
                <Link to="/help">Help Center</Link>
              </div>
              <div className="link-group">
                <h4>Legal</h4>
                <Link to="/terms">Terms of Service</Link>
                <Link to="/privacy">Privacy Policy</Link>
                <Link to="/cookies">Cookie Policy</Link>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>© {new Date().getFullYear()} Mandarin Dating. All rights reserved.</p>
            <div className="app-stores">
              <a href="#" className="app-store-link">
                <img src="/images/app-store.svg" alt="Download on the App Store" />
              </a>
              <a href="#" className="app-store-link">
                <img src="/images/google-play.svg" alt="Get it on Google Play" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
