import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FaUser, FaEnvelope, FaLock, FaEye, FaEyeSlash, FaBirthdayCake,
         FaMapMarkerAlt, FaMars, FaVenus, FaGenderless, FaCheck,
         FaArrowRight, FaArrowLeft, FaGoogle, FaFacebook } from 'react-icons/fa';
import { useAuth } from '../context';

const Register = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    nickname: '',
    email: '',
    password: '',
    confirmPassword: '',
    age: '',
    gender: '',
    location: '',
    interests: [],
    lookingFor: [],
    agreeTerms: false,
    agreePrivacy: false,
    newsletter: false
  });

  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, error, clearErrors, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Available interests and relationship goals
  const availableInterests = [
    'Dating', 'Casual', 'Friendship', 'Long-term', 'Travel', 'Outdoors',
    'Movies', 'Music', 'Fitness', 'Food', 'Art', 'Reading', 'Gaming',
    'Photography', 'Dancing', 'Cooking', 'Sports'
  ];

  const relationshipGoals = [
    'Casual Dating', 'Serious Relationship', 'Friendship',
    'Something Discreet', 'Adventure', 'Just Chatting'
  ];

  useEffect(() => {
    // If already authenticated, redirect to dashboard
    if (isAuthenticated) {
      navigate('/dashboard');
    }

    // Populate email if passed from home page
    if (location.state?.email) {
      setFormData(prev => ({ ...prev, email: location.state.email }));
    }

    // Clear any previous auth errors
    clearErrors();
  }, [isAuthenticated, navigate, location.state?.email, clearErrors]);

  useEffect(() => {
    // Set error from auth context
    if (error) {
      setFormErrors({ general: error });
      setIsSubmitting(false);
    }
  }, [error]);

  // Validate current step
  const validateStep = (step) => {
    const errors = {};

    if (step === 1) {
      const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;

      if (!formData.nickname.trim()) {
        errors.nickname = 'Nickname is required';
      } else if (formData.nickname.length < 3) {
        errors.nickname = 'Nickname must be at least 3 characters';
      }

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

      if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
      }
    }

    if (step === 2) {
      if (!formData.age) {
        errors.age = 'Age is required';
      } else if (parseInt(formData.age) < 18) {
        errors.age = 'You must be at least 18 years old';
      } else if (parseInt(formData.age) > 120) {
        errors.age = 'Please enter a valid age';
      }

      if (!formData.gender) {
        errors.gender = 'Gender is required';
      }

      if (!formData.location.trim()) {
        errors.location = 'Location is required';
      }
    }

    if (step === 3) {
      if (formData.interests.length === 0) {
        errors.interests = 'Please select at least one interest';
      }

      if (formData.lookingFor.length === 0) {
        errors.lookingFor = 'Please select what you\'re looking for';
      }

      if (!formData.agreeTerms) {
        errors.agreeTerms = 'You must agree to the Terms of Service';
      }

      if (!formData.agreePrivacy) {
        errors.agreePrivacy = 'You must agree to the Privacy Policy';
      }
    }

    return errors;
  };

  const handleChange = e => {
    const { name, value, type, checked } = e.target;

    // Handle checkboxes differently
    if (type === 'checkbox') {
      setFormData({ ...formData, [name]: checked });
    } else {
      setFormData({ ...formData, [name]: value });
    }

    // Clear specific field error when user types
    if (formErrors[name]) {
      setFormErrors({ ...formErrors, [name]: '' });
    }
  };

  // Toggle interest selection
  const toggleInterest = (interest) => {
    if (formData.interests.includes(interest)) {
      setFormData({
        ...formData,
        interests: formData.interests.filter(i => i !== interest)
      });
    } else {
      setFormData({
        ...formData,
        interests: [...formData.interests, interest]
      });
    }

    // Clear interest error if at least one is selected
    if (formErrors.interests && formData.interests.length > 0) {
      setFormErrors({ ...formErrors, interests: '' });
    }
  };

  // Toggle relationship goal selection
  const toggleGoal = (goal) => {
    if (formData.lookingFor.includes(goal)) {
      setFormData({
        ...formData,
        lookingFor: formData.lookingFor.filter(g => g !== goal)
      });
    } else {
      setFormData({
        ...formData,
        lookingFor: [...formData.lookingFor, goal]
      });
    }

    // Clear lookingFor error if at least one is selected
    if (formErrors.lookingFor && formData.lookingFor.length > 0) {
      setFormErrors({ ...formErrors, lookingFor: '' });
    }
  };

  // Handle next step
  const handleNextStep = () => {
    const errors = validateStep(currentStep);

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    setCurrentStep(currentStep + 1);
  };

  // Handle previous step
  const handlePrevStep = () => {
    setCurrentStep(currentStep - 1);
  };

  // Handle form submission
  const handleSubmit = async e => {
    e.preventDefault();

    // Validate final step
    const errors = validateStep(currentStep);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    // Clear errors and set loading
    setFormErrors({});
    setIsSubmitting(true);

    // Prepare data for API
    const registrationData = {
      nickname: formData.nickname,
      email: formData.email,
      password: formData.password,
      details: {
        age: parseInt(formData.age),
        gender: formData.gender,
        location: formData.location,
        interests: formData.interests,
        lookingFor: formData.lookingFor
      }
    };

    // Register user
    try {
      await register(registrationData);
      // If successful, useEffect with isAuthenticated will handle redirect
    } catch (err) {
      // Error is handled in useEffect with error dependency
      console.error('Registration error', err);
    }
  };

  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // Render progress bar
  const renderProgress = () => {
    return (
      <div className="registration-progress">
        <div className="progress-steps">
          <div className={`progress-step ${currentStep >= 1 ? 'active' : ''}`}>
            <div className="step-circle">
              {currentStep > 1 ? <FaCheck /> : 1}
            </div>
            <span className="step-label">Account</span>
          </div>
          <div className="progress-line"></div>
          <div className={`progress-step ${currentStep >= 2 ? 'active' : ''}`}>
            <div className="step-circle">
              {currentStep > 2 ? <FaCheck /> : 2}
            </div>
            <span className="step-label">Profile</span>
          </div>
          <div className="progress-line"></div>
          <div className={`progress-step ${currentStep >= 3 ? 'active' : ''}`}>
            <div className="step-circle">3</div>
            <span className="step-label">Preferences</span>
          </div>
        </div>
      </div>
    );
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      default:
        return null;
    }
  };

  // Step 1: Account Information
  const renderStep1 = () => {
    return (
      <>
        <div className="step-header">
          <h2>Create Your Account</h2>
          <p>Enter your basic information to get started</p>
        </div>

        <div className="form-group">
          <label htmlFor="nickname">Nickname</label>
          <div className="input-with-icon">
            <FaUser className="field-icon" />
            <input
              type="text"
              id="nickname"
              name="nickname"
              placeholder="Choose a nickname"
              value={formData.nickname}
              onChange={handleChange}
            />
          </div>
          {formErrors.nickname && <p className="error-message">{formErrors.nickname}</p>}
        </div>

        <div className="form-group">
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
            />
          </div>
          {formErrors.email && <p className="error-message">{formErrors.email}</p>}
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <div className="input-with-icon">
            <FaLock className="field-icon" />
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              name="password"
              placeholder="Create a password"
              value={formData.password}
              onChange={handleChange}
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

        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm Password</label>
          <div className="input-with-icon">
            <FaLock className="field-icon" />
            <input
              type={showPassword ? "text" : "password"}
              id="confirmPassword"
              name="confirmPassword"
              placeholder="Confirm your password"
              value={formData.confirmPassword}
              onChange={handleChange}
            />
          </div>
          {formErrors.confirmPassword && <p className="error-message">{formErrors.confirmPassword}</p>}
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={handleNextStep}
          >
            Continue <FaArrowRight />
          </button>
        </div>
      </>
    );
  };

  // Step 2: Profile Information
  const renderStep2 = () => {
    return (
      <>
        <div className="step-header">
          <h2>Tell Us About Yourself</h2>
          <p>Add some basic details to your profile</p>
        </div>

        <div className="form-group">
          <label htmlFor="age">Age</label>
          <div className="input-with-icon">
            <FaBirthdayCake className="field-icon" />
            <input
              type="number"
              id="age"
              name="age"
              placeholder="Enter your age"
              min="18"
              max="120"
              value={formData.age}
              onChange={handleChange}
            />
          </div>
          {formErrors.age && <p className="error-message">{formErrors.age}</p>}
        </div>

        <div className="form-group">
          <label>Gender</label>
          <div className="gender-options">
            <label className={`gender-option ${formData.gender === 'Male' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="gender"
                value="Male"
                checked={formData.gender === 'Male'}
                onChange={handleChange}
              />
              <div className="gender-icon"><FaMars /></div>
              <span>Male</span>
            </label>

            <label className={`gender-option ${formData.gender === 'Female' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="gender"
                value="Female"
                checked={formData.gender === 'Female'}
                onChange={handleChange}
              />
              <div className="gender-icon"><FaVenus /></div>
              <span>Female</span>
            </label>

            <label className={`gender-option ${formData.gender === 'Other' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="gender"
                value="Other"
                checked={formData.gender === 'Other'}
                onChange={handleChange}
              />
              <div className="gender-icon"><FaGenderless /></div>
              <span>Other</span>
            </label>
          </div>
          {formErrors.gender && <p className="error-message">{formErrors.gender}</p>}
        </div>

        <div className="form-group">
          <label htmlFor="location">Location</label>
          <div className="input-with-icon">
            <FaMapMarkerAlt className="field-icon" />
            <input
              type="text"
              id="location"
              name="location"
              placeholder="City, Country"
              value={formData.location}
              onChange={handleChange}
            />
          </div>
          {formErrors.location && <p className="error-message">{formErrors.location}</p>}
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={handlePrevStep}
          >
            <FaArrowLeft /> Back
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleNextStep}
          >
            Continue <FaArrowRight />
          </button>
        </div>
      </>
    );
  };

  // Step 3: Preferences and Agreement
  const renderStep3 = () => {
    return (
      <>
        <div className="step-header">
          <h2>Your Preferences</h2>
          <p>Tell us what you like and what you're looking for</p>
        </div>

        <div className="form-group">
          <label>What are you interested in?</label>
          <div className="interests-grid">
            {availableInterests.map(interest => (
              <button
                key={interest}
                type="button"
                className={`interest-tag ${formData.interests.includes(interest) ? 'selected' : ''}`}
                onClick={() => toggleInterest(interest)}
              >
                {interest}
                {formData.interests.includes(interest) && <FaCheck className="tag-check" />}
              </button>
            ))}
          </div>
          {formErrors.interests && <p className="error-message">{formErrors.interests}</p>}
        </div>

        <div className="form-group">
          <label>What are you looking for?</label>
          <div className="interests-grid">
            {relationshipGoals.map(goal => (
              <button
                key={goal}
                type="button"
                className={`interest-tag ${formData.lookingFor.includes(goal) ? 'selected' : ''}`}
                onClick={() => toggleGoal(goal)}
              >
                {goal}
                {formData.lookingFor.includes(goal) && <FaCheck className="tag-check" />}
              </button>
            ))}
          </div>
          {formErrors.lookingFor && <p className="error-message">{formErrors.lookingFor}</p>}
        </div>

        <div className="form-group checkbox-group">
          <label className={`checkbox-label ${formErrors.agreeTerms ? 'error' : ''}`}>
            <input
              type="checkbox"
              name="agreeTerms"
              checked={formData.agreeTerms}
              onChange={handleChange}
            />
            <span className="checkbox-text">
              I agree to the <Link to="/terms" target="_blank">Terms of Service</Link>
            </span>
          </label>
          {formErrors.agreeTerms && <p className="error-message">{formErrors.agreeTerms}</p>}
        </div>

        <div className="form-group checkbox-group">
          <label className={`checkbox-label ${formErrors.agreePrivacy ? 'error' : ''}`}>
            <input
              type="checkbox"
              name="agreePrivacy"
              checked={formData.agreePrivacy}
              onChange={handleChange}
            />
            <span className="checkbox-text">
              I agree to the <Link to="/privacy" target="_blank">Privacy Policy</Link>
            </span>
          </label>
          {formErrors.agreePrivacy && <p className="error-message">{formErrors.agreePrivacy}</p>}
        </div>

        <div className="form-group checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="newsletter"
              checked={formData.newsletter}
              onChange={handleChange}
            />
            <span className="checkbox-text">
              I want to receive news and special offers (optional)
            </span>
          </label>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={handlePrevStep}
          >
            <FaArrowLeft /> Back
          </button>
          <button
            type="submit"
            className={`btn btn-primary ${isSubmitting ? 'loading' : ''}`}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="spinner"></span>
                <span>Creating account...</span>
              </>
            ) : (
              <>
                <span>Create Account</span>
                <FaCheck />
              </>
            )}
          </button>
        </div>
      </>
    );
  };

  return (
    <div className="auth-page register-page">
      <div className="auth-container">
        <div className="auth-content">
          <div className="auth-form-container">
            <div className="auth-header">
              <Link to="/" className="logo">Mandarin</Link>
              <h1>Join Mandarin</h1>
              <p>Create your account in a few steps</p>
            </div>

            {formErrors.general && (
              <div className="error-alert">
                <p>{formErrors.general}</p>
              </div>
            )}

            {renderProgress()}

            <form className="auth-form" onSubmit={handleSubmit}>
              {renderStepContent()}
            </form>

            {currentStep === 1 && (
              <>
                <div className="auth-separator">
                  <span>OR SIGN UP WITH</span>
                </div>

                <div className="social-login">
                  <button className="btn btn-social btn-google">
                    <FaGoogle />
                    <span>Google</span>
                  </button>

                  <button className="btn btn-social btn-facebook">
                    <FaFacebook />
                    <span>Facebook</span>
                  </button>
                </div>
              </>
            )}

            <div className="auth-footer">
              <p>
                Already have an account?{' '}
                <Link to="/login" className="auth-link">
                  Sign In
                </Link>
              </p>
            </div>
          </div>
        </div>

        <div className="auth-image">
          <div className="image-overlay"></div>
          <div className="auth-quote">
            <blockquote>
              "Finding someone special is just a few clicks away."
            </blockquote>
            <div className="testimonial-author">
              <img src="/images/testimonial-avatar-2.jpg" alt="Happy user" />
              <div>
                <h4>Michael T.</h4>
                <p>Member since 2023</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
