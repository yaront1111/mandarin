"use client"

// client/src/pages/Register.js
import { useState, useEffect, useCallback } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import {
  FaUser,
  FaEnvelope,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaBirthdayCake,
  FaMapMarkerAlt,
  FaMars,
  FaVenus,
  FaGenderless,
  FaCheck,
  FaArrowRight,
  FaArrowLeft,
  FaGoogle,
  FaFacebook,
  FaExclamationTriangle,
} from "react-icons/fa"
import { useAuth } from "../context"
import { toast } from "react-toastify"

const Register = () => {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    nickname: "",
    email: "",
    password: "",
    confirmPassword: "",
    age: "",
    gender: "",
    location: "",
    interests: [],
    lookingFor: [],
    agreeTerms: false,
    agreePrivacy: false,
    newsletter: false,
  })
  const [showPassword, setShowPassword] = useState(false)
  const [formErrors, setFormErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Track if a submission has been attempted to improve validation UX
  const [attemptedSubmit, setAttemptedSubmit] = useState(false)
  const [errors, setErrors] = useState({})

  const { register, error, clearErrors, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const availableInterests = [
    "Dating",
    "Casual",
    "Friendship",
    "Long-term",
    "Travel",
    "Outdoors",
    "Movies",
    "Music",
    "Fitness",
    "Food",
    "Art",
    "Reading",
    "Gaming",
    "Photography",
    "Dancing",
    "Cooking",
    "Sports",
  ]

  const relationshipGoals = [
    "Casual Dating",
    "Serious Relationship",
    "Friendship",
    "Something Discreet",
    "Adventure",
    "Just Chatting",
  ]

  // Handle initial state
  useEffect(() => {
    // If user is already authenticated, redirect to dashboard
    if (isAuthenticated) {
      navigate("/dashboard")
    }

    // If there's an email in location state, use it
    if (location.state?.email) {
      setFormData((prev) => ({ ...prev, email: location.state.email }))
    }

    // Clear any previous errors
    clearErrors()

    // Clean up form on unmount
    return () => {
      setFormData({
        nickname: "",
        email: "",
        password: "",
        confirmPassword: "",
        age: "",
        gender: "",
        location: "",
        interests: [],
        lookingFor: [],
        agreeTerms: false,
        agreePrivacy: false,
        newsletter: false,
      })
    }
  }, [isAuthenticated, navigate, location.state?.email, clearErrors])

  // Handle auth errors from context
  useEffect(() => {
    if (error) {
      setFormErrors((prev) => ({ ...prev, general: error }))
      setIsSubmitting(false)

      // Scroll to error message
      const errorElement = document.querySelector(".alert-danger")
      if (errorElement) {
        errorElement.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    }
  }, [error])

  // More robust validation function
  const validateStep = useCallback(
    (step) => {
      const errors = {}

      if (step === 1) {
        // Email validation with more comprehensive regex
        const emailRegex =
          /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/

        // Nickname validation
        if (!formData.nickname.trim()) {
          errors.nickname = "Nickname is required"
        } else if (formData.nickname.length < 3) {
          errors.nickname = "Nickname must be at least 3 characters"
        } else if (formData.nickname.length > 50) {
          errors.nickname = "Nickname cannot exceed 50 characters"
        } else if (!/^[a-zA-Z0-9_]+$/.test(formData.nickname)) {
          errors.nickname = "Nickname can only contain letters, numbers, and underscores"
        }

        // Email validation
        if (!formData.email) {
          errors.email = "Email is required"
        } else if (!emailRegex.test(formData.email.toLowerCase())) {
          errors.email = "Please enter a valid email address"
        }

        // Password validation with more robust requirements
        if (!formData.password) {
          errors.password = "Password is required"
        } else if (formData.password.length < 6) {
          errors.password = "Password must be at least 6 characters"
        } else if (formData.password.length > 100) {
          errors.password = "Password cannot exceed 100 characters"
        }

        // Password confirmation
        if (formData.password !== formData.confirmPassword) {
          errors.confirmPassword = "Passwords do not match"
        }
      }

      if (step === 2) {
        // Age validation
        if (!formData.age) {
          errors.age = "Age is required"
        } else {
          const ageValue = Number.parseInt(formData.age)
          if (isNaN(ageValue)) {
            errors.age = "Please enter a valid number"
          } else if (ageValue < 18) {
            errors.age = "You must be at least 18 years old"
          } else if (ageValue > 120) {
            errors.age = "Please enter a valid age"
          }
        }

        // Gender validation
        if (!formData.gender) {
          errors.gender = "Gender is required"
        }

        // Location validation
        if (!formData.location.trim()) {
          errors.location = "Location is required"
        } else if (formData.location.length < 2) {
          errors.location = "Location must be at least 2 characters"
        } else if (formData.location.length > 100) {
          errors.location = "Location cannot exceed 100 characters"
        }
      }

      if (step === 3) {
        // Interests validation
        if (formData.interests.length === 0) {
          errors.interests = "Please select at least one interest"
        } else if (formData.interests.length > 10) {
          errors.interests = "Please select no more than 10 interests"
        }

        // Looking for validation
        if (formData.lookingFor.length === 0) {
          errors.lookingFor = "Please select what you're looking for"
        } else if (formData.lookingFor.length > 5) {
          errors.lookingFor = "Please select no more than 5 options"
        }

        // Agreement validations
        if (!formData.agreeTerms) {
          errors.agreeTerms = "You must agree to the Terms of Service"
        }

        if (!formData.agreePrivacy) {
          errors.agreePrivacy = "You must agree to the Privacy Policy"
        }
      }

      return errors
    },
    [formData],
  )

  // Handle input changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target

    // For checkbox inputs, use the checked property
    if (type === "checkbox") {
      setFormData({ ...formData, [name]: checked })
    }
    // For number inputs, ensure valid numbers
    else if (type === "number") {
      // Allow empty string or valid numbers
      if (value === "" || !isNaN(Number.parseInt(value))) {
        setFormData({ ...formData, [name]: value })
      }
    }
    // For all other inputs
    else {
      setFormData({ ...formData, [name]: value })
    }

    // Clear the error for this field if it exists
    if (formErrors[name]) {
      setFormErrors({ ...formErrors, [name]: "" })
    }
  }

  // Validate current step and move to next if valid
  const handleNextStep = () => {
    setAttemptedSubmit(true)
    const errors = validateStep(currentStep)

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)

      // Scroll to first error
      const firstErrorElement = document.querySelector(".error-message")
      if (firstErrorElement) {
        firstErrorElement.scrollIntoView({ behavior: "smooth", block: "start" })
      }

      return
    }

    // Clear errors and move to next step
    setFormErrors({})
    setCurrentStep(currentStep + 1)
    setAttemptedSubmit(false)

    // Scroll to top of form
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // Move to previous step
  const handlePrevStep = () => {
    setCurrentStep(currentStep - 1)
    setFormErrors({})
    setAttemptedSubmit(false)

    // Scroll to top of form
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // Toggle interest selection
  const toggleInterest = (interest) => {
    let updatedInterests

    if (formData.interests.includes(interest)) {
      // Remove interest if already selected
      updatedInterests = formData.interests.filter((i) => i !== interest)
    } else {
      // Add interest if not already selected
      updatedInterests = [...formData.interests, interest]
    }

    setFormData({
      ...formData,
      interests: updatedInterests,
    })

    // Clear interests error if now valid
    if (formErrors.interests && updatedInterests.length > 0) {
      setFormErrors({ ...formErrors, interests: "" })
    }
  }

  // Toggle relationship goal selection
  const toggleGoal = (goal) => {
    let updatedGoals

    if (formData.lookingFor.includes(goal)) {
      // Remove goal if already selected
      updatedGoals = formData.lookingFor.filter((g) => g !== goal)
    } else {
      // Add goal if not already selected
      updatedGoals = [...formData.lookingFor, goal]
    }

    setFormData({
      ...formData,
      lookingFor: updatedGoals,
    })

    // Clear lookingFor error if now valid
    if (formErrors.lookingFor && updatedGoals.length > 0) {
      setFormErrors({ ...formErrors, lookingFor: "" })
    }
  }

  const validateForm = useCallback(() => {
    const errors = {}
    // Add your validation logic here, accessing formData
    return errors
  }, [formData])

  // Handle form submission
  const handleSubmit = async (e) => {
    e?.preventDefault()
    const validationErrors = validateForm()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      const firstErrorElement = document.querySelector(".error-message")
      if (firstErrorElement) {
        firstErrorElement.scrollIntoView({ behavior: "smooth", block: "center" })
      }
      return
    }
    setErrors({})
    setIsSubmitting(true)
    try {
      // Determine account tier based on gender
      let accountTier = "FREE"
      if (formData.gender.toLowerCase() === "female") {
        accountTier = "FEMALE"
      }

      const submissionData = {
        nickname: formData.nickname.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        age: formData.age,
        gender: formData.gender.toLowerCase(),
        location: formData.location.trim(),
        interests: formData.interests,
        lookingFor: formData.lookingFor,
        agreeTerms: formData.agreeTerms,
        agreePrivacy: formData.agreePrivacy,
        newsletter: formData.newsletter,
      }

      const success = await register(submissionData)

      if (success) {
        toast.success("Welcome to Mandarin! Your account has been created successfully.")
        navigate("/dashboard")
      }
    } catch (err) {
      console.error("Registration error", err)
      setIsSubmitting(false)

      // Fallback error handling
      if (!formErrors.general) {
        setFormErrors((prev) => ({
          ...prev,
          general: "An unexpected error occurred. Please try again.",
        }))
      }
    }
  }

  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword)
  }

  // Render progress indicator
  const renderProgress = () => (
    <div className="registration-progress">
      <div className="progress-steps d-flex justify-content-center align-items-center">
        <div className={`progress-step ${currentStep >= 1 ? "active" : ""}`}>
          <div className="step-circle">{currentStep > 1 ? <FaCheck /> : 1}</div>
          <span className="step-label">Account</span>
        </div>
        <div className="progress-line"></div>
        <div className={`progress-step ${currentStep >= 2 ? "active" : ""}`}>
          <div className="step-circle">{currentStep > 2 ? <FaCheck /> : 2}</div>
          <span className="step-label">Profile</span>
        </div>
        <div className="progress-line"></div>
        <div className={`progress-step ${currentStep >= 3 ? "active" : ""}`}>
          <div className="step-circle">3</div>
          <span className="step-label">Preferences</span>
        </div>
      </div>
    </div>
  )

  // Render step 1 content (Account Information)
  const renderStep1 = () => (
    <>
      <div className="step-header text-center">
        <h3>Create Your Account</h3>
        <p className="text-light">Enter your basic information</p>
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="nickname">
          Nickname
        </label>
        <div className="input-with-icon">
          <FaUser className="field-icon" />
          <input
            type="text"
            id="nickname"
            name="nickname"
            placeholder="Choose a nickname"
            className={`form-control ${formErrors.nickname ? "border-danger" : ""}`}
            value={formData.nickname}
            onChange={handleChange}
            maxLength={50}
            aria-describedby="nickname-help"
          />
        </div>
        {formErrors.nickname ? (
          <p className="error-message text-danger">
            <FaExclamationTriangle className="me-1" />
            {formErrors.nickname}
          </p>
        ) : (
          <small id="nickname-help" className="form-text text-muted">
            Your public display name (can contain letters, numbers, and underscores)
          </small>
        )}
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="email">
          Email Address
        </label>
        <div className="input-with-icon">
          <FaEnvelope className="field-icon" />
          <input
            type="email"
            id="email"
            name="email"
            placeholder="Enter your email"
            className={`form-control ${formErrors.email ? "border-danger" : ""}`}
            value={formData.email}
            onChange={handleChange}
            aria-describedby="email-help"
          />
        </div>
        {formErrors.email ? (
          <p className="error-message text-danger">
            <FaExclamationTriangle className="me-1" />
            {formErrors.email}
          </p>
        ) : (
          <small id="email-help" className="form-text text-muted">
            We'll never share your email with anyone else
          </small>
        )}
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="password">
          Password
        </label>
        <div className="input-with-icon">
          <FaLock className="field-icon" />
          <input
            type={showPassword ? "text" : "password"}
            id="password"
            name="password"
            placeholder="Create a password"
            className={`form-control ${formErrors.password ? "border-danger" : ""}`}
            value={formData.password}
            onChange={handleChange}
            aria-describedby="password-help"
          />
          <button
            type="button"
            className="toggle-password"
            onClick={togglePasswordVisibility}
            tabIndex={-1}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <FaEyeSlash /> : <FaEye />}
          </button>
        </div>
        {formErrors.password ? (
          <p className="error-message text-danger">
            <FaExclamationTriangle className="me-1" />
            {formErrors.password}
          </p>
        ) : (
          <small id="password-help" className="form-text text-muted">
            Must be at least 6 characters
          </small>
        )}
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="confirmPassword">
          Confirm Password
        </label>
        <div className="input-with-icon">
          <FaLock className="field-icon" />
          <input
            type={showPassword ? "text" : "password"}
            id="confirmPassword"
            name="confirmPassword"
            placeholder="Confirm password"
            className={`form-control ${formErrors.confirmPassword ? "border-danger" : ""}`}
            value={formData.confirmPassword}
            onChange={handleChange}
          />
        </div>
        {formErrors.confirmPassword && (
          <p className="error-message text-danger">
            <FaExclamationTriangle className="me-1" />
            {formErrors.confirmPassword}
          </p>
        )}
      </div>
      <div className="form-actions d-flex justify-content-end mt-3">
        <button type="button" className="btn btn-primary" onClick={handleNextStep} disabled={isSubmitting}>
          Continue <FaArrowRight />
        </button>
      </div>
    </>
  )

  // Render step 2 content (Profile Information)
  const renderStep2 = () => (
    <>
      <div className="step-header text-center">
        <h3>Tell Us About Yourself</h3>
        <p className="text-light">Add some basic profile details</p>
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="age">
          Age
        </label>
        <div className="input-with-icon">
          <FaBirthdayCake className="field-icon" />
          <input
            type="number"
            id="age"
            name="age"
            placeholder="Enter your age"
            className={`form-control ${formErrors.age ? "border-danger" : ""}`}
            min="18"
            max="120"
            value={formData.age}
            onChange={handleChange}
            aria-describedby="age-help"
          />
        </div>
        {formErrors.age ? (
          <p className="error-message text-danger">
            <FaExclamationTriangle className="me-1" />
            {formErrors.age}
          </p>
        ) : (
          <small id="age-help" className="form-text text-muted">
            You must be at least 18 years old to use this service
          </small>
        )}
      </div>
      <div className="form-group">
        <label className="form-label">Gender</label>
        <div className="d-flex gap-2">
          <label
            className={`gender-option ${formData.gender === "Male" ? "selected" : ""} ${formErrors.gender ? "error" : ""}`}
          >
            <input
              type="radio"
              name="gender"
              value="Male"
              checked={formData.gender === "Male"}
              onChange={handleChange}
            />
            <FaMars />
            <span>Male</span>
          </label>
          <label
            className={`gender-option ${formData.gender === "Female" ? "selected" : ""} ${formErrors.gender ? "error" : ""}`}
          >
            <input
              type="radio"
              name="gender"
              value="Female"
              checked={formData.gender === "Female"}
              onChange={handleChange}
            />
            <FaVenus />
            <span>Female</span>
          </label>
          <label
            className={`gender-option ${formData.gender === "Other" ? "selected" : ""} ${formErrors.gender ? "error" : ""}`}
          >
            <input
              type="radio"
              name="gender"
              value="Other"
              checked={formData.gender === "Other"}
              onChange={handleChange}
            />
            <FaGenderless />
            <span>Other</span>
          </label>
        </div>
        {formErrors.gender && (
          <p className="error-message text-danger">
            <FaExclamationTriangle className="me-1" />
            {formErrors.gender}
          </p>
        )}
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="location">
          Location
        </label>
        <div className="input-with-icon">
          <FaMapMarkerAlt className="field-icon" />
          <input
            type="text"
            id="location"
            name="location"
            placeholder="City, Country"
            className={`form-control ${formErrors.location ? "border-danger" : ""}`}
            value={formData.location}
            onChange={handleChange}
            maxLength={100}
            aria-describedby="location-help"
          />
        </div>
        {formErrors.location ? (
          <p className="error-message text-danger">
            <FaExclamationTriangle className="me-1" />
            {formErrors.location}
          </p>
        ) : (
          <small id="location-help" className="form-text text-muted">
            Your general location (e.g., New York, USA)
          </small>
        )}
      </div>
      <div className="form-actions d-flex justify-content-between mt-3">
        <button type="button" className="btn btn-outline" onClick={handlePrevStep}>
          <FaArrowLeft /> Back
        </button>
        <button type="button" className="btn btn-primary" onClick={handleNextStep} disabled={isSubmitting}>
          Continue <FaArrowRight />
        </button>
      </div>
    </>
  )

  // Render step 3 content (Preferences)
  const renderStep3 = () => (
    <>
      <div className="step-header text-center">
        <h3>Your Preferences</h3>
        <p className="text-light">What do you like and what are you seeking?</p>
      </div>
      <div className="form-group">
        <label className="form-label">Interests</label>
        <small className="d-block text-muted mb-2">Select up to 10 interests</small>
        <div className="interests-grid">
          {availableInterests.map((interest) => (
            <button
              key={interest}
              type="button"
              className={`interest-tag ${formData.interests.includes(interest) ? "selected" : ""} ${formErrors.interests && attemptedSubmit ? "error-border" : ""}`}
              onClick={() => toggleInterest(interest)}
              disabled={!formData.interests.includes(interest) && formData.interests.length >= 10}
            >
              {interest}
              {formData.interests.includes(interest) && <FaCheck className="tag-check" />}
            </button>
          ))}
        </div>
        {formErrors.interests && (
          <p className="error-message text-danger">
            <FaExclamationTriangle className="me-1" />
            {formErrors.interests}
          </p>
        )}
      </div>
      <div className="form-group">
        <label className="form-label">Looking For</label>
        <small className="d-block text-muted mb-2">Select up to 5 options</small>
        <div className="interests-grid">
          {relationshipGoals.map((goal) => (
            <button
              key={goal}
              type="button"
              className={`interest-tag ${formData.lookingFor.includes(goal) ? "selected" : ""} ${formErrors.lookingFor && attemptedSubmit ? "error-border" : ""}`}
              onClick={() => toggleGoal(goal)}
              disabled={!formData.lookingFor.includes(goal) && formData.lookingFor.length >= 5}
            >
              {goal}
              {formData.lookingFor.includes(goal) && <FaCheck className="tag-check" />}
            </button>
          ))}
        </div>
        {formErrors.lookingFor && (
          <p className="error-message text-danger">
            <FaExclamationTriangle className="me-1" />
            {formErrors.lookingFor}
          </p>
        )}
      </div>
      <div className="form-group checkbox-group mt-3">
        <label className={`checkbox-label ${formErrors.agreeTerms ? "error" : ""}`}>
          <input type="checkbox" name="agreeTerms" checked={formData.agreeTerms} onChange={handleChange} />
          <span style={{ marginLeft: "8px" }}>
            I agree to the{" "}
            <Link to="/terms" target="_blank" rel="noopener noreferrer">
              Terms of Service
            </Link>
          </span>
        </label>
        {formErrors.agreeTerms && (
          <p className="error-message text-danger">
            <FaExclamationTriangle className="me-1" />
            {formErrors.agreeTerms}
          </p>
        )}
      </div>
      <div className="form-group checkbox-group">
        <label className={`checkbox-label ${formErrors.agreePrivacy ? "error" : ""}`}>
          <input type="checkbox" name="agreePrivacy" checked={formData.agreePrivacy} onChange={handleChange} />
          <span style={{ marginLeft: "8px" }}>
            I agree to the{" "}
            <Link to="/privacy" target="_blank" rel="noopener noreferrer">
              Privacy Policy
            </Link>
          </span>
        </label>
        {formErrors.agreePrivacy && (
          <p className="error-message text-danger">
            <FaExclamationTriangle className="me-1" />
            {formErrors.agreePrivacy}
          </p>
        )}
      </div>
      <div className="form-group checkbox-group">
        <label className="checkbox-label">
          <input type="checkbox" name="newsletter" checked={formData.newsletter} onChange={handleChange} />
          <span style={{ marginLeft: "8px" }}>I want to receive news and special offers (optional)</span>
        </label>
      </div>
      <div className="form-actions d-flex justify-content-between mt-3">
        <button type="button" className="btn btn-outline" onClick={handlePrevStep} disabled={isSubmitting}>
          <FaArrowLeft /> Back
        </button>
        <button type="submit" className={`btn btn-primary ${isSubmitting ? "loading" : ""}`} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <span className="spinner spinner-dark"></span>
              <span style={{ marginLeft: "8px" }}>Creating account...</span>
            </>
          ) : (
            <>
              <span>Create Account</span> <FaCheck />
            </>
          )}
        </button>
      </div>
    </>
  )

  // Render appropriate step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return renderStep1()
      case 2:
        return renderStep2()
      case 3:
        return renderStep3()
      default:
        return null
    }
  }

  return (
    <div className="auth-page register-page d-flex">
      <div className="auth-container d-flex flex-column justify-content-center w-100">
        <div className="container" style={{ maxWidth: "600px" }}>
          <div className="card">
            <div className="card-header text-center">
              <Link to="/" className="logo">
                Mandarin
              </Link>
              <h2 className="mb-1">Join Mandarin</h2>
              <p className="text-light">Create your account in a few steps</p>
            </div>
            <div className="card-body">
              {formErrors.general && (
                <div className="alert alert-danger" role="alert">
                  <FaExclamationTriangle className="me-2" />
                  <p className="mb-0">{formErrors.general}</p>
                </div>
              )}
              {renderProgress()}
              <form className="mt-4" onSubmit={handleSubmit} noValidate>
                {renderStepContent()}
              </form>
              {currentStep === 1 && (
                <>
                  <div className="auth-separator text-center mt-4 mb-2">
                    <span>OR SIGN UP WITH</span>
                  </div>
                  <div className="d-flex flex-column gap-2">
                    <button className="btn btn-outline d-flex align-items-center justify-content-center">
                      <FaGoogle style={{ marginRight: "8px" }} />
                      Sign up with Google
                    </button>
                    <button className="btn btn-outline d-flex align-items-center justify-content-center">
                      <FaFacebook style={{ marginRight: "8px" }} />
                      Sign up with Facebook
                    </button>
                  </div>
                </>
              )}
              <div className="auth-footer text-center mt-4">
                <p className="mb-0">
                  Already have an account?{" "}
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
  )
}

export default Register
