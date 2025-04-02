// client/src/pages/Home.js
import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { FaArrowRight, FaMapMarkerAlt, FaRegHeart, FaComment, FaUsers } from "react-icons/fa"
import { ThemeToggle } from "../components/theme-toggle.tsx"

const Home = () => {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [onlineUsers, setOnlineUsers] = useState([])

  useEffect(() => {
    // Mock online users - in a real app this would come from an API
    setOnlineUsers([
      {
        id: 1,
        name: "Emma",
        age: 28,
        location: "New York",
        image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80",
        status: "online"
      },
      {
        id: 2,
        name: "Michael",
        age: 32,
        location: "Los Angeles",
        image: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80",
        status: "online"
      },
      {
        id: 3,
        name: "Sophia",
        age: 26,
        location: "Chicago",
        image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80",
        status: "online"
      },
      {
        id: 4,
        name: "James",
        age: 30,
        location: "Miami",
        image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80",
        status: "online"
      },
      {
        id: 5,
        name: "Olivia",
        age: 29,
        location: "San Francisco",
        image: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80",
        status: "online"
      },
      {
        id: 6,
        name: "Daniel",
        age: 31,
        location: "Boston",
        image: "https://images.unsplash.com/photo-1500048993953-d23a436266cf?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80",
        status: "online"
      },
      {
        id: 7,
        name: "Sarah",
        age: 27,
        location: "Seattle",
        image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80",
        status: "online"
      },
      {
        id: 8,
        name: "Alex",
        age: 33,
        location: "Austin",
        image: "https://images.unsplash.com/photo-1504257432389-52343af06ae3?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80",
        status: "online"
      },
      {
        id: 9,
        name: "Jessica",
        age: 25,
        location: "Denver",
        image: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80",
        status: "online"
      },
      {
        id: 10,
        name: "Ryan",
        age: 34,
        location: "Portland",
        image: "https://images.unsplash.com/photo-1499996860823-5214fcc65f8f?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80",
        status: "online"
      },
      {
        id: 11,
        name: "Lisa",
        age: 29,
        location: "Phoenix",
        image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80",
        status: "online"
      },
      {
        id: 12,
        name: "Chris",
        age: 31,
        location: "Atlanta",
        image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80",
        status: "online"
      }
    ])
  }, [])

  const handleStartNow = () => {
    navigate("/register")
  }

  const handleEmailSubmit = (e) => {
    e.preventDefault()
    navigate("/register", { state: { email } })
  }

  return (
    <div className="modern-home-page w-100 overflow-hidden">
      {/* Modern Header */}
      <header className="modern-header glass-effect sticky-top shadow-sm">
        <div className="container d-flex justify-content-between align-items-center py-2">
          <div className="logo gradient-text font-weight-bold text-nowrap">Mandarin</div>
          <nav className="d-none d-md-flex main-tabs gap-4">
            <Link to="/about" className="tab-button hover-opacity transition-all">
              About
            </Link>
            <Link to="/safety" className="tab-button hover-opacity transition-all">
              Safety
            </Link>
            <Link to="/support" className="tab-button hover-opacity transition-all">
              Support
            </Link>
          </nav>
          <div className="header-actions d-flex align-items-center gap-2">
            <ThemeToggle />
            <Link to="/login" className="btn btn-outline btn-sm hover-scale transition-all">
              Login
            </Link>
            <Link to="/register" className="btn btn-primary btn-sm hover-scale transition-all">
              Register
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section animate-fade-in py-5 position-relative overflow-hidden">
        <div className="hero-content mx-auto text-center p-4 max-w-lg">
          <h1 className="animate-slide-up mb-4 text-shadow font-weight-bold">Find Your Perfect Connection</h1>
          <p className="animate-slide-up delay-200 mb-4 text-md opacity-90 line-height-relaxed">
            Discover genuine connections in a safe, discreet environment designed for adults seeking meaningful
            encounters.
          </p>
          <div className="hero-actions animate-slide-up delay-300 mx-auto max-w-md">
            <form onSubmit={handleEmailSubmit} className="email-signup-form d-flex gap-2 shadow-md rounded-lg overflow-hidden">
              <input
                type="email"
                placeholder="Enter your email"
                className="form-control border-0 py-3 flex-grow-1"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-primary btn-lg d-flex align-items-center gap-2 transition-transform hover-scale">
                <span>Get Started</span> <FaArrowRight />
              </button>
            </form>
          </div>
        </div>

        <div className="hero-image position-relative mt-5">
          <div className="image-collage d-flex justify-content-center">
            <div className="collage-image image1 rounded-lg shadow-lg transform-gpu scale-up-hover transition-transform" />
            <div className="collage-image image2 rounded-lg shadow-lg transform-gpu scale-up-hover transition-transform" />
            <div className="collage-image image3 rounded-lg shadow-lg transform-gpu scale-up-hover transition-transform" />
          </div>
        </div>
      </section>

      {/* Online Users Section */}
      <section className="online-users-section animate-fade-in py-5 my-4">
        <div className="container">
          <div className="section-header text-center mb-5">
            <h2 className="gradient-text animate-slide-up mb-3 d-flex align-items-center justify-content-center gap-2">
              <FaUsers className="text-primary" /> <span>People Online Now</span>
            </h2>
            <p className="section-subtitle animate-slide-up delay-100 text-opacity-80 max-w-md mx-auto">
              Connect with these amazing people who are currently active on Mandarin
            </p>
          </div>
          
          <div className="online-users-grid grid-cols-2 grid-cols-md-3 grid-cols-lg-4 gap-3 animate-slide-up delay-200">
            {onlineUsers.map((user, index) => (
              <div 
                key={user.id} 
                className="online-user-card staggered-item shadow-sm hover-shadow-md rounded-lg overflow-hidden transition-all cursor-pointer transform-gpu hover-scale"
                onClick={() => navigate("/register")}
              >
                <div className="user-card-photo position-relative">
                  <img src={user.image} alt={user.name} className="w-100 h-auto object-cover aspect-ratio-1" />
                  <div className="user-status online position-absolute rounded-circle pulse-animation"></div>
                </div>
                <div className="user-card-info p-3">
                  <h3 className="user-name mb-1 font-weight-medium text-truncate">{user.name}, {user.age}</h3>
                  <p className="user-location text-sm mb-2 d-flex align-items-center gap-1 text-opacity-70">
                    <FaMapMarkerAlt className="location-icon text-primary-light" /> {user.location}
                  </p>
                  <div className="user-actions d-flex gap-2 justify-content-end">
                    <button 
                      className="mini-action-btn like-btn d-flex align-items-center justify-content-center rounded-circle shadow-sm hover-scale transition-transform"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate("/register");
                      }}
                    >
                      <FaRegHeart className="text-danger" />
                    </button>
                    <button 
                      className="mini-action-btn message-btn d-flex align-items-center justify-content-center rounded-circle shadow-sm hover-scale transition-transform"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate("/register");
                      }}
                    >
                      <FaComment className="text-primary" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="view-more-container animate-slide-up delay-400 text-center mt-5">
            <button className="btn btn-secondary btn-lg d-inline-flex align-items-center gap-2 shadow-md hover-scale transition-all px-4 py-3" onClick={handleStartNow}>
              <span>Join to See More</span> <FaArrowRight />
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section animate-fade-in bg-light-subtle py-5 my-4 rounded-lg mx-3">
        <div className="container">
          <div className="features-grid grid-cols-1 grid-cols-md-3 gap-4">
            <div className="feature-card animate-slide-up bg-white p-4 rounded-lg shadow-sm hover-shadow-md transition-all text-center">
              <div className="feature-icon privacy d-flex justify-content-center align-items-center mx-auto mb-3 rounded-circle bg-primary-50"></div>
              <h3 className="font-weight-medium mb-3">Privacy First</h3>
              <p className="text-opacity-70 line-height-relaxed">Your privacy is our top priority. Control who sees your profile and what information you share.</p>
            </div>
            <div className="feature-card animate-slide-up delay-100 bg-white p-4 rounded-lg shadow-sm hover-shadow-md transition-all text-center">
              <div className="feature-icon secure d-flex justify-content-center align-items-center mx-auto mb-3 rounded-circle bg-primary-50"></div>
              <h3 className="font-weight-medium mb-3">Secure Communication</h3>
              <p className="text-opacity-70 line-height-relaxed">End-to-end encrypted messaging ensures your conversations remain private and secure.</p>
            </div>
            <div className="feature-card animate-slide-up delay-200 bg-white p-4 rounded-lg shadow-sm hover-shadow-md transition-all text-center">
              <div className="feature-icon match d-flex justify-content-center align-items-center mx-auto mb-3 rounded-circle bg-primary-50"></div>
              <h3 className="font-weight-medium mb-3">Smart Matching</h3>
              <p className="text-opacity-70 line-height-relaxed">Our advanced algorithm connects you with people who match your preferences and interests.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="modern-footer mt-5 border-top pt-5">
        <div className="container footer-content d-flex flex-column flex-md-row justify-content-between align-items-center gap-4 mb-4">
          <div className="footer-logo gradient-text font-weight-bold text-xl">Mandarin</div>
          <div className="footer-links d-flex flex-wrap justify-content-center gap-3 gap-md-4">
            <Link to="/about" className="text-decoration-none text-body hover-text-primary transition-all">About Us</Link>
            <Link to="/safety" className="text-decoration-none text-body hover-text-primary transition-all">Safety</Link>
            <Link to="/support" className="text-decoration-none text-body hover-text-primary transition-all">Support</Link>
            <Link to="/terms" className="text-decoration-none text-body hover-text-primary transition-all">Terms</Link>
            <Link to="/privacy" className="text-decoration-none text-body hover-text-primary transition-all">Privacy</Link>
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
          <p className="text-sm text-opacity-70 mb-0">© {new Date().getFullYear()} Mandarin Dating. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

export default Home