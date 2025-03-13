import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FaEnvelope, FaLock, FaEye, FaEyeSlash, FaGoogle, FaFacebook, FaArrowRight } from 'react-icons/fa';
import { useAuth } from '../context';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { login, error, clearErrors, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const from = location.state?.from || '/dashboard';
  
  useEffect(() => {
    // If already authenticated, redirect to dashboard
    if (isAuthenticated) {
      navigate(from);
    }
    
    // Populate email if passed from register or home page
    if (location.state?.email) {
      setFormData(prev => ({ ...prev, email: location.state.email }));
    }
    
    // Clear any previous auth errors when component mounts
    clearErrors();
  }, [isAuthenticated, navigate, from, location.state?.email, clearErrors]);
  
  useEffect(() => {
    // Set error from auth context
    if (error) {
      setFormErrors({ general: error });
      setIsSubmitting(false);
    }
  }, [error]);
  
  const validateForm = () => {
    const errors = {};
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    
    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!emailRegex.test(formData.email)) {
      errors.email = 'Invalid email format';
    }
    
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    return errors;
  };
  
  const handleChange = e => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    
    // Clear specific field error when user types
    if (formErrors[name]) {
      setFormErrors({ ...formErrors, [name]: '' });
    }
  };
  
  const handleSubmit = async e => {
    e.preventDefault();
    
    // Validate form
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    // Clear previous errors
    setFormErrors({});
    setIsSubmitting(true);
    
    // Attempt login
    try {
      await login({ email: formData.email, password: formData.password });
      // If successful, the useEffect with isAuthenticated will handle redirect
    } catch (err) {
      // Error is handled in useEffect with error dependency
      console.error('Login error', err);
    }
  };
  
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };
  
  return (
    <div className="auth-page login-page">
      <div className="auth-container">
        <div className="auth-content">
          <div className="auth-form-container">
            <div className="auth-header">
              <Link to="/" className="logo">Mandarin</Link>
              <h1>Welcome Back</h1>
              <p>Sign in to continue your journey</p>
            </div>
            
            {formErrors.general && (
              <div className="error-alert">
                <p>{formErrors.general}</p>
              </div>
            )}
            
            <form className="auth-form" onSubmit={handleSubmit}>
              <div className={`form-group ${formErrors.email ? 'has-error' : ''}`}>
                <label htmlFor="email">Email Address</label>
                <div className="input-with-icon">
                  <FaEnvelope className="field-icon" />
                  <input
                    type="email"
                    id="email"
                    name="email"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={isSubmitting}
                  />
                </div>
                {formErrors.email && <p className="error-message">{formErrors.email}</p>}
              </div>
              
              <div className={`form-group ${formErrors.password ? 'has-error' : ''}`}>
                <div className="password-label-group">
                  <label htmlFor="password">Password</label>
                  <Link to="/forgot-password" className="forgot-password">
                    Forgot Password?
                  </Link>
                </div>
                <div className="input-with-icon">
                  <FaLock className="field-icon" />
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    name="password"
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleChange}
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={togglePasswordVisibility}
                    tabIndex="-1"
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
                {formErrors.password && <p className="error-message">{formErrors.password}</p>}
              </div>
              
              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={() => setRememberMe(!rememberMe)}
                    disabled={isSubmitting}
                  />
                  <span className="checkbox-text">Remember me</span>
                </label>
              </div>
              
              <button
                type="submit"
                className={`btn btn-primary btn-block ${isSubmitting ? 'loading' : ''}`}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner"></span>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <FaArrowRight />
                  </>
                )}
              </button>
            </form>
            
            <div className="auth-separator">
              <span>OR</span>
            </div>
            
            <div className="social-login">
              <button className="btn btn-social btn-google">
                <FaGoogle />
                <span>Sign in with Google</span>
              </button>
              
              <button className="btn btn-social btn-facebook">
                <FaFacebook />
                <span>Sign in with Facebook</span>
              </button>
            </div>
            
            <div className="auth-footer">
              <p>
                Don't have an account?{' '}
                <Link to="/register" className="auth-link">
                  Sign Up
                </Link>
              </p>
            </div>
          </div>
        </div>
        
        <div className="auth-image">
          <div className="image-overlay"></div>
          <div className="auth-quote">
            <blockquote>
              "Life is about making connections that matter."
            </blockquote>
            <div className="testimonial-author">
              <img src="/images/testimonial-avatar.jpg" alt="Happy user" />
              <div>
                <h4>Jessica M.</h4>
                <p>Found her perfect match on Mandarin</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
