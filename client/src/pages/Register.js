// client/src/pages/Register.js
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  FaUser, FaEnvelope, FaLock, FaEye, FaEyeSlash, FaBirthdayCake,
  FaMapMarkerAlt, FaMars, FaVenus, FaGenderless, FaCheck,
  FaArrowRight, FaArrowLeft, FaGoogle, FaFacebook
} from 'react-icons/fa';
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
    if (isAuthenticated) {
      navigate('/dashboard');
    }
    if (location.state?.email) {
      setFormData(prev => ({ ...prev, email: location.state.email }));
    }
    clearErrors();
  }, [isAuthenticated, navigate, location.state?.email, clearErrors]);

  useEffect(() => {
    if (error) {
      setFormErrors({ general: error });
      setIsSubmitting(false);
    }
  }, [error]);

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
        errors.lookingFor = `Please select what you're looking for`;
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

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setFormData({ ...formData, [name]: checked });
    } else {
      setFormData({ ...formData, [name]: value });
    }
    if (formErrors[name]) {
      setFormErrors({ ...formErrors, [name]: '' });
    }
  };

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
    if (formErrors.interests && formData.interests.length > 0) {
      setFormErrors({ ...formErrors, interests: '' });
    }
  };

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
    if (formErrors.lookingFor && formData.lookingFor.length > 0) {
      setFormErrors({ ...formErrors, lookingFor: '' });
    }
  };

  const handleNextStep = () => {
    const errors = validateStep(currentStep);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    setCurrentStep(currentStep + 1);
  };

  const handlePrevStep = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validateStep(currentStep);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    setIsSubmitting(true);

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

    try {
      await register(registrationData);
    } catch (err) {
      console.error('Registration error', err);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const renderProgress = () => (
    <div className="registration-progress">
      <div className="progress-steps d-flex justify-content-center align-items-center">
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

  const renderStep1 = () => (
    <>
      <div className="step-header text-center">
        <h3>Create Your Account</h3>
        <p className="text-light">Enter your basic information</p>
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="nickname">Nickname</label>
        <div className="input-with-icon">
          <FaUser className="field-icon" />
          <input
            type="text"
            id="nickname"
            name="nickname"
            placeholder="Choose a nickname"
            className="form-control"
            value={formData.nickname}
            onChange={handleChange}
          />
        </div>
        {formErrors.nickname && <p className="error-message">{formErrors.nickname}</p>}
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="email">Email Address</label>
        <div className="input-with-icon">
          <FaEnvelope className="field-icon" />
          <input
            type="email"
            id="email"
            name="email"
            placeholder="Enter your email"
            className="form-control"
            value={formData.email}
            onChange={handleChange}
          />
        </div>
        {formErrors.email && <p className="error-message">{formErrors.email}</p>}
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="password">Password</label>
        <div className="input-with-icon">
          <FaLock className="field-icon" />
          <input
            type={showPassword ? 'text' : 'password'}
            id="password"
            name="password"
            placeholder="Create a password"
            className="form-control"
            value={formData.password}
            onChange={handleChange}
          />
          <button
            type="button"
            className="toggle-password"
            onClick={togglePasswordVisibility}
            tabIndex={-1}
          >
            {showPassword ? <FaEyeSlash /> : <FaEye />}
          </button>
        </div>
        {formErrors.password && <p className="error-message">{formErrors.password}</p>}
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
        <div className="input-with-icon">
          <FaLock className="field-icon" />
          <input
            type={showPassword ? 'text' : 'password'}
            id="confirmPassword"
            name="confirmPassword"
            placeholder="Confirm password"
            className="form-control"
            value={formData.confirmPassword}
            onChange={handleChange}
          />
        </div>
        {formErrors.confirmPassword && <p className="error-message">{formErrors.confirmPassword}</p>}
      </div>
      <div className="form-actions d-flex justify-content-end mt-3">
        <button type="button" className="btn btn-primary" onClick={handleNextStep}>
          Continue <FaArrowRight />
        </button>
      </div>
    </>
  );

  const renderStep2 = () => (
    <>
      <div className="step-header text-center">
        <h3>Tell Us About Yourself</h3>
        <p className="text-light">Add some basic profile details</p>
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="age">Age</label>
        <div className="input-with-icon">
          <FaBirthdayCake className="field-icon" />
          <input
            type="number"
            id="age"
            name="age"
            placeholder="Enter your age"
            className="form-control"
            min="18"
            max="120"
            value={formData.age}
            onChange={handleChange}
          />
        </div>
        {formErrors.age && <p className="error-message">{formErrors.age}</p>}
      </div>
      <div className="form-group">
        <label className="form-label">Gender</label>
        <div className="d-flex gap-2">
          <label className={`gender-option ${formData.gender === 'Male' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="gender"
              value="Male"
              checked={formData.gender === 'Male'}
              onChange={handleChange}
            />
            <FaMars />
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
            <FaVenus />
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
            <FaGenderless />
            <span>Other</span>
          </label>
        </div>
        {formErrors.gender && <p className="error-message">{formErrors.gender}</p>}
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="location">Location</label>
        <div className="input-with-icon">
          <FaMapMarkerAlt className="field-icon" />
          <input
            type="text"
            id="location"
            name="location"
            placeholder="City, Country"
            className="form-control"
            value={formData.location}
            onChange={handleChange}
          />
        </div>
        {formErrors.location && <p className="error-message">{formErrors.location}</p>}
      </div>
      <div className="form-actions d-flex justify-content-between mt-3">
        <button type="button" className="btn btn-outline" onClick={handlePrevStep}>
          <FaArrowLeft /> Back
        </button>
        <button type="button" className="btn btn-primary" onClick={handleNextStep}>
          Continue <FaArrowRight />
        </button>
      </div>
    </>
  );

  const renderStep3 = () => (
    <>
      <div className="step-header text-center">
        <h3>Your Preferences</h3>
        <p className="text-light">What do you like and what are you seeking?</p>
      </div>
      <div className="form-group">
        <label className="form-label">Interests</label>
        <div className="interests-grid">
          {availableInterests.map((interest) => (
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
        <label className="form-label">Looking For</label>
        <div className="interests-grid">
          {relationshipGoals.map((goal) => (
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
      <div className="form-group checkbox-group mt-3">
        <label className={`checkbox-label ${formErrors.agreeTerms ? 'error' : ''}`}>
          <input
            type="checkbox"
            name="agreeTerms"
            checked={formData.agreeTerms}
            onChange={handleChange}
          />
          <span style={{ marginLeft: '8px' }}>
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
          <span style={{ marginLeft: '8px' }}>
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
          <span style={{ marginLeft: '8px' }}>
            I want to receive news and special offers (optional)
          </span>
        </label>
      </div>
      <div className="form-actions d-flex justify-content-between mt-3">
        <button type="button" className="btn btn-outline" onClick={handlePrevStep}>
          <FaArrowLeft /> Back
        </button>
        <button
          type="submit"
          className={`btn btn-primary ${isSubmitting ? 'loading' : ''}`}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <span className="spinner spinner-dark"></span>
              <span style={{ marginLeft: '8px' }}>Creating account...</span>
            </>
          ) : (
            <>
              <span>Create Account</span> <FaCheck />
            </>
          )}
        </button>
      </div>
    </>
  );

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

  return (
    <div className="auth-page register-page d-flex">
      <div className="auth-container d-flex flex-column justify-content-center w-100">
        <div className="container" style={{ maxWidth: '600px' }}>
          <div className="card">
            <div className="card-header text-center">
              <Link to="/" className="logo">Mandarin</Link>
              <h2 className="mb-1">Join Mandarin</h2>
              <p className="text-light">Create your account in a few steps</p>
            </div>
            <div className="card-body">
              {formErrors.general && (
                <div className="alert alert-danger">
                  <p>{formErrors.general}</p>
                </div>
              )}
              {renderProgress()}
              <form className="mt-4" onSubmit={handleSubmit}>
                {renderStepContent()}
              </form>
              {currentStep === 1 && (
                <>
                  <div className="auth-separator text-center mt-4 mb-2">
                    <span>OR SIGN UP WITH</span>
                  </div>
                  <div className="d-flex flex-column gap-2">
                    <button className="btn btn-outline d-flex align-items-center justify-content-center">
                      <FaGoogle style={{ marginRight: '8px' }} />
                      Sign up with Google
                    </button>
                    <button className="btn btn-outline d-flex align-items-center justify-content-center">
                      <FaFacebook style={{ marginRight: '8px' }} />
                      Sign up with Facebook
                    </button>
                  </div>
                </>
              )}
              <div className="auth-footer text-center mt-4">
                <p className="mb-0">
                  Already have an account?{' '}
                  <Link to="/login" className="text-primary">
                    Sign In
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
