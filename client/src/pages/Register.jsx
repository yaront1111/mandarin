"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import {
  FaUser,
  FaEnvelope,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaMapMarkerAlt,
  FaCheck,
  FaArrowRight,
  FaArrowLeft,
  FaGoogle,
  FaFacebook,
  FaExclamationTriangle,
  FaCalendarAlt,
  FaCamera,
  FaImage,
  FaTrash,
  FaEdit,
} from "react-icons/fa"
import { useAuth } from "../context"
import { toast } from "react-toastify"
import styles from "../styles/register.module.css"

const Register = () => {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    nickname: "",
    email: "",
    password: "",
    confirmPassword: "",
    dateOfBirth: "", // Changed from age to dateOfBirth
    location: "",
    interests: [],
    lookingFor: [],
    agreeTerms: false,
    agreePrivacy: false,
    newsletter: false,
    // Add new fields
    iAm: "",
    intoTags: [],
    turnOns: [],
    maritalStatus: "",
    profilePhoto: null,
  })
  const [previewImage, setPreviewImage] = useState(null)
  const fileInputRef = useRef(null)
  const [showPassword, setShowPassword] = useState(false)
  const [formErrors, setFormErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Track if a submission has been attempted to improve validation UX
  const [attemptedSubmit, setAttemptedSubmit] = useState(false)
  const [errors, setErrors] = useState({})
  const [locationSuggestions, setLocationSuggestions] = useState([])

  const { register, error, isAuthenticated } = useAuth()
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

  // Add these new constants for the additional preference options
  const iAmOptions = ["woman", "man", "couple"]
  const lookingForOptions = ["women", "men", "couples"]

  const intoTagsOptions = [
    "Meetups",
    "Power play",
    "Threesomes",
    "Online fun",
    "Hot chat",
    "Photo sharing",
    "Camera chat",
    "Cuckold",
    "Golden showers",
    "Strap-on",
    "Forced bi",
    "Erotic domination",
    "Humiliation",
    "Crossdressing",
    "Worship",
    "Foot fetish",
    "Oral",
    "From behind",
    "Role-play",
    "Toys",
    "Massages",
    "Foreplay",
    "Casual meetups",
    "Fantasy fulfillment",
    "Bizarre",
    "Education",
    "Experiences",
    "Tantra",
  ]

  const turnOnsOptions = [
    "Sexy ass",
    "Dirty talk",
    "Aggressive",
    "Slow and gentle",
    "In a public place",
    "Pampering",
    "Sexy clothing",
    "Leather/latex clothing",
    "Watching porn",
    "Fit body",
    "Bathing together",
    "Erotic writing",
    "Eye contact",
    "Being pampered",
    "Sexy legs",
    "Teasing",
    "Pushing boundaries",
  ]

  // Add marital status options
  const maritalStatusOptions = [
    "Single",
    "Married",
    "Divorced",
    "Separated",
    "Widowed",
    "In a relationship",
    "It's complicated",
    "Open relationship",
    "Polyamorous",
  ]

  // Common locations in Israel for the datalist
  const commonLocations = [
    "Tel Aviv, Israel",
    "Jerusalem, Israel",
    "Haifa, Israel",
    "Eilat, Israel",
    "Beer Sheva, Israel",
    "Netanya, Israel",
    "Herzliya, Israel",
    "Ashdod, Israel",
    "Ashkelon, Israel",
    "Tiberias, Israel",
    "Ramat Gan, Israel",
    "Rishon LeZion, Israel",
    "Petah Tikva, Israel",
    "Holon, Israel",
    "Bat Yam, Israel",
    "Rehovot, Israel",
    "Kfar Saba, Israel",
    "Raanana, Israel",
    "Nahariya, Israel",
    "Acre, Israel",
  ]

  // Calculate age from date of birth
  const calculateAge = (dob) => {
    if (!dob) return 0
    const birthDate = new Date(dob)
    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }

    return age
  }

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

    // Clean up form on unmount
    return () => {
      setFormData({
        nickname: "",
        email: "",
        password: "",
        confirmPassword: "",
        dateOfBirth: "",
        location: "",
        interests: [],
        lookingFor: [],
        agreeTerms: false,
        agreePrivacy: false,
        newsletter: false,
        iAm: "",
        intoTags: [],
        turnOns: [],
        maritalStatus: "",
      })
    }
  }, [isAuthenticated, navigate, location.state?.email])

  // Handle auth errors from context
  useEffect(() => {
    if (error) {
      setFormErrors((prev) => ({ ...prev, general: error }))
      setIsSubmitting(false)

      // Scroll to error message
      const errorElement = document.querySelector(`.${styles.alertDanger}`)
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

        // Password validation with more robust requirements to match backend
        if (!formData.password) {
          errors.password = "Password is required"
        } else if (formData.password.length < 8) {
          errors.password = "Password must be at least 8 characters"
        } else if (!/(?=.*[a-z])/.test(formData.password)) {
          errors.password = "Password must include at least one lowercase letter"
        } else if (!/(?=.*[A-Z])/.test(formData.password)) {
          errors.password = "Password must include at least one uppercase letter"
        } else if (!/(?=.*\d)/.test(formData.password)) {
          errors.password = "Password must include at least one number"
        } else if (!/(?=.*[@$!%*?&])/.test(formData.password)) {
          errors.password = "Password must include at least one special character (@$!%*?&)"
        }

        // Password confirmation
        if (formData.password !== formData.confirmPassword) {
          errors.confirmPassword = "Passwords do not match"
        }
      }

      if (step === 2) {
        // Date of Birth validation
        if (!formData.dateOfBirth) {
          errors.dateOfBirth = "Date of birth is required"
        } else {
          const age = calculateAge(formData.dateOfBirth)
          if (age < 18) {
            errors.dateOfBirth = "You must be at least 18 years old"
          } else if (age > 120) {
            errors.dateOfBirth = "Please enter a valid date of birth"
          }
        }

        // I am validation (moved from step 3)
        if (!formData.iAm) {
          errors.iAm = "Please select who you are"
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
        // Add validation for profile photo
        if (!formData.profilePhoto) {
          errors.profilePhoto = "Please upload a profile photo"
        }
      }

      if (step === 4) {
        // Add validation for marital status
        if (!formData.maritalStatus) {
          errors.maritalStatus = "Please select your marital status"
        }

        // Add validation for lookingFor
        if (formData.lookingFor.length === 0) {
          errors.lookingFor = "Please select what you're looking for"
        } else if (formData.lookingFor.length > 3) {
          errors.lookingFor = "Please select no more than 3 options"
        }

        // Validate the count of intoTags and turnOns
        if (formData.intoTags.length > 20) {
          errors.intoTags = "Please select no more than 20 'I'm into' tags"
        }

        if (formData.turnOns.length > 20) {
          errors.turnOns = "Please select no more than 20 'Turn ons' tags"
        }

        // Interests validation
        if (formData.interests.length === 0) {
          errors.interests = "Please select at least one interest"
        } else if (formData.interests.length > 10) {
          errors.interests = "Please select no more than 10 interests"
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

  // Handle location input change with suggestions
  const handleLocationChange = (e) => {
    const value = e.target.value
    setFormData({ ...formData, location: value })

    if (formErrors.location) {
      setFormErrors({ ...formErrors, location: "" })
    }

    if (value.length > 1) {
      const filtered = commonLocations.filter((loc) => loc.toLowerCase().includes(value.toLowerCase()))
      setLocationSuggestions(filtered)
    } else {
      setLocationSuggestions([])
    }
  }

  // Validate current step and move to next if valid
  const handleNextStep = () => {
    setAttemptedSubmit(true)
    const errors = validateStep(currentStep)

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)

      const firstErrorElement = document.querySelector(`.${styles.errorMessage}`)
      if (firstErrorElement) {
        firstErrorElement.scrollIntoView({ behavior: "smooth", block: "start" })
      }

      return
    }

    setFormErrors({})
    setCurrentStep(currentStep + 1)
    setAttemptedSubmit(false)

    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // Move to previous step
  const handlePrevStep = () => {
    setCurrentStep(currentStep - 1)
    setFormErrors({})
    setAttemptedSubmit(false)

    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // Toggle interest selection
  const toggleInterest = (interest) => {
    let updatedInterests

    if (formData.interests.includes(interest)) {
      updatedInterests = formData.interests.filter((i) => i !== interest)
    } else {
      updatedInterests = [...formData.interests, interest]
    }

    setFormData({
      ...formData,
      interests: updatedInterests,
    })

    if (formErrors.interests && updatedInterests.length > 0) {
      setFormErrors({ ...formErrors, interests: "" })
    }
  }

  // Toggle relationship goal selection
  const toggleGoal = (goal) => {
    let updatedGoals

    if (formData.lookingFor.includes(goal)) {
      updatedGoals = formData.lookingFor.filter((g) => g !== goal)
    } else {
      updatedGoals = [...formData.lookingFor, goal]
    }

    setFormData({
      ...formData,
      lookingFor: updatedGoals,
    })

    if (formErrors.lookingFor && updatedGoals.length > 0) {
      setFormErrors({ ...formErrors, lookingFor: "" })
    }
  }

  // Toggle "I am" selection
  const handleIAmSelection = (option) => {
    setFormData({
      ...formData,
      iAm: formData.iAm === option ? "" : option,
    })

    if (formErrors.iAm && option) {
      setFormErrors({ ...formErrors, iAm: "" })
    }
  }

  // Toggle "I'm into" tag selection
  const toggleIntoTag = (tag) => {
    let updatedTags

    if (formData.intoTags.includes(tag)) {
      updatedTags = formData.intoTags.filter((t) => t !== tag)
    } else {
      if (formData.intoTags.length >= 20) {
        toast.warning("You can select up to 20 'I'm into' tags")
        return
      }
      updatedTags = [...formData.intoTags, tag]
    }

    setFormData({
      ...formData,
      intoTags: updatedTags,
    })

    if (formErrors.intoTags && updatedTags.length > 0) {
      setFormErrors({ ...formErrors, intoTags: "" })
    }
  }

  // Toggle "Turn on" tag selection
  const toggleTurnOn = (tag) => {
    let updatedTags

    if (formData.turnOns.includes(tag)) {
      updatedTags = formData.turnOns.filter((t) => t !== tag)
    } else {
      if (formData.turnOns.length >= 20) {
        toast.warning("You can select up to 20 'Turn ons' tags")
        return
      }
      updatedTags = [...formData.turnOns, tag]
    }

    setFormData({
      ...formData,
      turnOns: updatedTags,
    })

    if (formErrors.turnOns && updatedTags.length > 0) {
      setFormErrors({ ...formErrors, turnOns: "" })
    }
  }

  // Handle marital status selection
  const handleMaritalStatusChange = (e) => {
    setFormData({
      ...formData,
      maritalStatus: e.target.value,
    })

    if (formErrors.maritalStatus) {
      setFormErrors({ ...formErrors, maritalStatus: "" })
    }
  }
  
  // Handle photo upload
  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a valid image file (JPEG, JPG or PNG)')
      return
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB')
      return
    }
    
    // Update form data and preview
    setFormData({
      ...formData,
      profilePhoto: file
    })
    
    // Create and set preview URL
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreviewImage(reader.result)
    }
    reader.readAsDataURL(file)
    
    if (formErrors.profilePhoto) {
      setFormErrors({ ...formErrors, profilePhoto: '' })
    }
  }
  
  // Remove uploaded photo
  const handleRemovePhoto = () => {
    setFormData({
      ...formData,
      profilePhoto: null
    })
    setPreviewImage(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }
  
  // Trigger file input click
  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const validateForm = useCallback(() => {
    const errors = {}
    // Add your validation logic here if needed
    return errors
  }, [formData])

  // Handle form submission
  const handleSubmit = async (e) => {
    e?.preventDefault()
    const validationErrors = validateForm()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      const firstErrorElement = document.querySelector(`.${styles.errorMessage}`)
      if (firstErrorElement) {
        firstErrorElement.scrollIntoView({ behavior: "smooth", block: "center" })
      }
      return
    }
    setErrors({})
    setIsSubmitting(true)
    try {
      // Map iAm to proper gender format
      let gender = ""
      if (formData.iAm.toLowerCase() === "woman") {
        gender = "female"
      } else if (formData.iAm.toLowerCase() === "man") {
        gender = "male"
      } else if (formData.iAm.toLowerCase() === "couple") {
        gender = "other" // Using "other" for couples
      }

      // Determine account tier based on gender and couple status
      let accountTier = "FREE"
      const isCouple = formData.iAm.toLowerCase() === "couple"
      if (formData.iAm.toLowerCase() === "woman") {
        accountTier = "FEMALE"
      } else if (isCouple) {
        accountTier = "COUPLE"
      }

      const submissionData = {
        nickname: formData.nickname.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        accountTier,
        isCouple,
        details: {
          age: calculateAge(formData.dateOfBirth),
          gender,
          location: formData.location.trim(),
          bio: "",
          interests: formData.interests,
          iAm: formData.iAm,
          lookingFor: formData.lookingFor,
          intoTags: formData.intoTags,
          turnOns: formData.turnOns,
          maritalStatus: formData.maritalStatus,
          dateOfBirth: formData.dateOfBirth,
        },
      }

      try {
        const success = await register(submissionData)
        if (success) {
          // If there's a profile photo, upload it after successful registration
          if (formData.profilePhoto) {
            try {
              // Create FormData object for file upload
              const photoFormData = new FormData()
              photoFormData.append('photo', formData.profilePhoto)
              photoFormData.append('isPrivate', 'false') // Default to public profile photo
              
              // Get base URL from apiService
              const baseURL = import.meta.env.VITE_API_URL || 
                (window.location.hostname.includes("localhost") ? "http://localhost:5000/api" : "/api")
              
              // Send photo to the server
              const response = await fetch(`${baseURL}/users/photos`, {
                method: 'POST',
                body: photoFormData,
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('token')}`, // Use stored token for authorization
                  'x-auth-token': localStorage.getItem('token') // Include both headers for compatibility
                }
              })
              
              const result = await response.json()
              
              if (result.success) {
                toast.success("Profile photo uploaded successfully")
              } else {
                toast.error("Failed to upload profile photo: " + (result.error || "Unknown error"))
              }
            } catch (photoErr) {
              console.error("Error uploading photo:", photoErr)
              toast.error("Failed to upload profile photo")
            }
          }
          
          toast.success("Welcome to Mandarin! Your account has been created successfully.")
          navigate("/dashboard")
        }
      } catch (err) {
        if (err.error === "User already exists" || err.code === "EMAIL_EXISTS" || 
            (err.message && err.message.includes("already exists"))) {
          setFormErrors({
            email: "This email is already registered. Please log in or use a different email.",
            general: "An account with this email already exists. Would you like to log in instead?",
          })

          // Scroll to the error message
          const errorElement = document.querySelector(`.${styles.errorMessage}`)
          if (errorElement) {
            errorElement.scrollIntoView({ behavior: "smooth", block: "start" })
          }
        } else {
          setFormErrors((prev) => ({
            ...prev,
            general: err.message || "An unexpected error occurred. Please try again.",
          }))
        }
      }
    } catch (err) {
      console.error("Registration error", err)
      setIsSubmitting(false)

      if (!formErrors.general) {
        setFormErrors((prev) => ({
          ...prev,
          general: "An unexpected error occurred. Please try again.",
        }))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword)
  }

  // Render progress indicator with four steps
  const renderProgress = () => (
    <div className={styles.progressContainer}>
      <div className={styles.progressSteps}>
        <div className={`${styles.progressStep} ${currentStep >= 1 ? styles.active : ""}`}>
          <div className={styles.stepCircle}>{currentStep > 1 ? <FaCheck /> : 1}</div>
          <span className={styles.stepLabel}>Account</span>
        </div>
        <div className={styles.progressLine}></div>
        <div className={`${styles.progressStep} ${currentStep >= 2 ? styles.active : ""}`}>
          <div className={styles.stepCircle}>{currentStep > 2 ? <FaCheck /> : 2}</div>
          <span className={styles.stepLabel}>Profile</span>
        </div>
        <div className={styles.progressLine}></div>
        <div className={`${styles.progressStep} ${currentStep >= 3 ? styles.active : ""}`}>
          <div className={styles.stepCircle}>{currentStep > 3 ? <FaCheck /> : 3}</div>
          <span className={styles.stepLabel}>Photo</span>
        </div>
        <div className={styles.progressLine}></div>
        <div className={`${styles.progressStep} ${currentStep >= 4 ? styles.active : ""}`}>
          <div className={styles.stepCircle}>{currentStep > 4 ? <FaCheck /> : 4}</div>
          <span className={styles.stepLabel}>Preferences</span>
        </div>
      </div>
    </div>
  )

  // Render step 1 content (Account Information)
  const renderStep1 = () => (
    <>
      <div className={styles.stepHeader}>
        <h3>Create Your Account</h3>
        <p>Enter your basic information</p>
      </div>
      <div className={styles.formGroup}>
        <label className={styles.formLabel} htmlFor="nickname">
          Nickname
        </label>
        <div className={styles.inputWrapper}>
          <FaUser className={styles.inputIcon} />
          <input
            type="text"
            id="nickname"
            name="nickname"
            placeholder="Choose a nickname"
            className={styles.input}
            value={formData.nickname}
            onChange={handleChange}
            maxLength={50}
          />
        </div>
        {formErrors.nickname ? (
          <p className={styles.errorMessage}>
            <FaExclamationTriangle />
            {formErrors.nickname}
          </p>
        ) : (
          <p className={styles.helpText}>
            Your public display name (can contain letters, numbers, and underscores)
          </p>
        )}
      </div>
      <div className={styles.formGroup}>
        <label className={styles.formLabel} htmlFor="email">
          Email Address
        </label>
        <div className={styles.inputWrapper}>
          <FaEnvelope className={styles.inputIcon} />
          <input
            type="email"
            id="email"
            name="email"
            placeholder="Enter your email"
            className={styles.input}
            value={formData.email}
            onChange={handleChange}
          />
        </div>
        {formErrors.email ? (
          <p className={styles.errorMessage}>
            <FaExclamationTriangle />
            {formErrors.email}
          </p>
        ) : (
          <p className={styles.helpText}>
            We'll never share your email with anyone else
          </p>
        )}
      </div>
      <div className={styles.formGroup}>
        <label className={styles.formLabel} htmlFor="password">
          Password
        </label>
        <div className={styles.inputWrapper}>
          <FaLock className={styles.inputIcon} />
          <input
            type={showPassword ? "text" : "password"}
            id="password"
            name="password"
            placeholder="Create a password"
            className={styles.input}
            value={formData.password}
            onChange={handleChange}
          />
          <button
            type="button"
            className={styles.togglePassword}
            onClick={togglePasswordVisibility}
            tabIndex={-1}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <FaEyeSlash /> : <FaEye />}
          </button>
        </div>
        {formErrors.password ? (
          <p className={styles.errorMessage}>
            <FaExclamationTriangle />
            {formErrors.password}
          </p>
        ) : (
          <p className={styles.helpText}>
            Must be at least 8 characters with uppercase, lowercase, number, and special character
          </p>
        )}
      </div>
      <div className={styles.formGroup}>
        <label className={styles.formLabel} htmlFor="confirmPassword">
          Confirm Password
        </label>
        <div className={styles.inputWrapper}>
          <FaLock className={styles.inputIcon} />
          <input
            type={showPassword ? "text" : "password"}
            id="confirmPassword"
            name="confirmPassword"
            placeholder="Confirm password"
            className={styles.input}
            value={formData.confirmPassword}
            onChange={handleChange}
          />
        </div>
        {formErrors.confirmPassword && (
          <p className={styles.errorMessage}>
            <FaExclamationTriangle />
            {formErrors.confirmPassword}
          </p>
        )}
      </div>
      <div className={styles.formActions}>
        <div></div> {/* Empty div for flex spacing */}
        <button type="button" className={`${styles.button} ${styles.buttonPrimary}`} onClick={handleNextStep} disabled={isSubmitting}>
          Continue <FaArrowRight />
        </button>
      </div>
    </>
  )

  // Render step 2 content (Profile Information)
  const renderStep2 = () => (
    <>
      <div className={styles.stepHeader}>
        <h3>Tell Us About Yourself</h3>
        <p>Add some basic profile details</p>
      </div>
      <div className={styles.formGroup}>
        <label className={styles.formLabel} htmlFor="dateOfBirth">
          Date of Birth
        </label>
        <div className={styles.inputWrapper}>
          <FaCalendarAlt className={styles.inputIcon} />
          <input
            type="date"
            id="dateOfBirth"
            name="dateOfBirth"
            className={styles.input}
            value={formData.dateOfBirth}
            onChange={handleChange}
            max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split("T")[0]}
          />
        </div>
        {formErrors.dateOfBirth ? (
          <p className={styles.errorMessage}>
            <FaExclamationTriangle />
            {formErrors.dateOfBirth}
          </p>
        ) : (
          <p className={styles.helpText}>
            You must be at least 18 years old to use this service
          </p>
        )}
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>I am a</label>
        <div className={styles.tagContainer}>
          {iAmOptions.map((option) => (
            <button
              key={option}
              type="button"
              className={`${styles.tag} ${formData.iAm === option ? styles.selected : ""}`}
              onClick={() => handleIAmSelection(option)}
            >
              {option.charAt(0).toUpperCase() + option.slice(1)}
              {formData.iAm === option && <FaCheck className={styles.tagCheck} />}
            </button>
          ))}
        </div>
        {formErrors.iAm && (
          <p className={styles.errorMessage}>
            <FaExclamationTriangle />
            {formErrors.iAm}
          </p>
        )}
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel} htmlFor="location">
          Location
        </label>
        <div className={styles.inputWrapper}>
          <FaMapMarkerAlt className={styles.inputIcon} />
          <input
            type="text"
            id="location"
            name="location"
            placeholder="City, Country"
            className={styles.input}
            value={formData.location}
            onChange={handleLocationChange}
            maxLength={100}
            list="location-suggestions"
          />
          <datalist id="location-suggestions">
            {commonLocations.map((loc, index) => (
              <option key={index} value={loc} />
            ))}
          </datalist>
        </div>
        {formErrors.location ? (
          <p className={styles.errorMessage}>
            <FaExclamationTriangle />
            {formErrors.location}
          </p>
        ) : (
          <p className={styles.helpText}>
            Your general location (e.g., Tel Aviv, Israel)
          </p>
        )}
      </div>
      <div className={styles.formActions}>
        <button type="button" className={`${styles.button} ${styles.buttonOutline}`} onClick={handlePrevStep}>
          <FaArrowLeft /> Back
        </button>
        <button type="button" className={`${styles.button} ${styles.buttonPrimary}`} onClick={handleNextStep} disabled={isSubmitting}>
          Continue <FaArrowRight />
        </button>
      </div>
    </>
  )

  // Render step 3 content (Photo Upload)
  const renderStep3 = () => (
    <>
      <div className={styles.stepHeader}>
        <h3>Upload Your Photo</h3>
        <p>Add a profile photo to improve your visibility</p>
      </div>
      
      <div className={styles.photoUploadContainer}>
        <div 
          className={`${styles.photoUploadArea} ${previewImage ? styles.hasImage : ''}`}
          onClick={triggerFileInput}
        >
          <input 
            type="file"
            ref={fileInputRef}
            accept="image/jpeg,image/png,image/jpg" 
            onChange={handlePhotoChange}
            className="d-none"
          />
          
          {previewImage ? (
            <img src={previewImage} alt="Profile Preview" className={styles.profileImagePreview} />
          ) : (
            <>
              <FaCamera className={styles.photoUploadIcon} />
              <p className={styles.photoUploadText}>
                Click to upload a profile photo
              </p>
            </>
          )}
        </div>
        
        <p className={styles.uploadGuidelines}>
          Photos should be clear, recent and show your face. 
          <br />Maximum size: 5MB. Formats: JPG, JPEG, PNG.
        </p>
        
        {formErrors.profilePhoto && (
          <p className={styles.errorMessage}>
            <FaExclamationTriangle />
            {formErrors.profilePhoto}
          </p>
        )}
        
        {previewImage && (
          <div className={styles.photoActions}>
            <button type="button" className={`${styles.photoActionButton} ${styles.changePhotoButton}`} onClick={triggerFileInput}>
              <FaEdit /> Change Photo
            </button>
            <button type="button" className={`${styles.photoActionButton} ${styles.removePhotoButton}`} onClick={handleRemovePhoto}>
              <FaTrash /> Remove
            </button>
          </div>
        )}
      </div>
      
      <div className={styles.formActions}>
        <button type="button" className={`${styles.button} ${styles.buttonOutline}`} onClick={handlePrevStep} disabled={isSubmitting}>
          <FaArrowLeft /> Back
        </button>
        <button type="button" className={`${styles.button} ${styles.buttonPrimary}`} onClick={handleNextStep} disabled={isSubmitting}>
          Continue <FaArrowRight />
        </button>
      </div>
    </>
  )
  
  // Render step 4 content (Preferences)
  const renderStep4 = () => (
    <>
      <div className={styles.stepHeader}>
        <h3>Your Preferences</h3>
        <p>Tell us about yourself and what you're looking for</p>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>Marital Status</label>
        <select
          className={styles.input}
          name="maritalStatus"
          value={formData.maritalStatus}
          onChange={handleMaritalStatusChange}
          style={{ paddingLeft: "1rem" }}
        >
          <option value="">Select your status</option>
          {maritalStatusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        {formErrors.maritalStatus && (
          <p className={styles.errorMessage}>
            <FaExclamationTriangle />
            {formErrors.maritalStatus}
          </p>
        )}
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>Looking For</label>
        <p className={styles.helpText}>Select up to 3 options</p>
        <div className={styles.tagContainer}>
          {lookingForOptions.map((option) => (
            <button
              key={option}
              type="button"
              className={`${styles.tag} ${formData.lookingFor.includes(option) ? styles.selected : ""}`}
              onClick={() => toggleGoal(option)}
              disabled={!formData.lookingFor.includes(option) && formData.lookingFor.length >= 3}
            >
              {option.charAt(0).toUpperCase() + option.slice(1)}
              {formData.lookingFor.includes(option) && <FaCheck className={styles.tagCheck} />}
            </button>
          ))}
        </div>
        {formErrors.lookingFor && (
          <p className={styles.errorMessage}>
            <FaExclamationTriangle />
            {formErrors.lookingFor}
          </p>
        )}
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>Interests</label>
        <p className={styles.helpText}>Select up to 10 interests</p>
        <div className={styles.tagContainer}>
          {availableInterests.map((interest) => (
            <button
              key={interest}
              type="button"
              className={`${styles.tag} ${formData.interests.includes(interest) ? styles.selected : ""}`}
              onClick={() => toggleInterest(interest)}
              disabled={!formData.interests.includes(interest) && formData.interests.length >= 10}
            >
              {interest}
              {formData.interests.includes(interest) && <FaCheck className={styles.tagCheck} />}
            </button>
          ))}
        </div>
        {formErrors.interests && (
          <p className={styles.errorMessage}>
            <FaExclamationTriangle />
            {formErrors.interests}
          </p>
        )}
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>I'm into</label>
        <p className={styles.helpText}>Select up to 20 tags</p>
        <div className={styles.tagContainer}>
          {intoTagsOptions.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`${styles.tag} ${formData.intoTags.includes(tag) ? styles.selected : ""}`}
              onClick={() => toggleIntoTag(tag)}
              disabled={!formData.intoTags.includes(tag) && formData.intoTags.length >= 20}
            >
              {tag}
              {formData.intoTags.includes(tag) && <FaCheck className={styles.tagCheck} />}
            </button>
          ))}
        </div>
        {formErrors.intoTags && (
          <p className={styles.errorMessage}>
            <FaExclamationTriangle />
            {formErrors.intoTags}
          </p>
        )}
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>It turns me on</label>
        <p className={styles.helpText}>Select up to 20 tags</p>
        <div className={styles.tagContainer}>
          {turnOnsOptions.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`${styles.tag} ${formData.turnOns.includes(tag) ? styles.selected : ""}`}
              onClick={() => toggleTurnOn(tag)}
              disabled={!formData.turnOns.includes(tag) && formData.turnOns.length >= 20}
            >
              {tag}
              {formData.turnOns.includes(tag) && <FaCheck className={styles.tagCheck} />}
            </button>
          ))}
        </div>
        {formErrors.turnOns && (
          <p className={styles.errorMessage}>
            <FaExclamationTriangle />
            {formErrors.turnOns}
          </p>
        )}
      </div>

      <div className={styles.checkboxGroup}>
        <label className={`${styles.checkboxLabel} ${formErrors.agreeTerms ? styles.checkboxLabelError : ""}`}>
          <input 
            type="checkbox" 
            className={styles.checkbox} 
            name="agreeTerms" 
            checked={formData.agreeTerms} 
            onChange={handleChange} 
          />
          I agree to the{" "}
          <Link to="/terms" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>
            Terms of Service
          </Link>
        </label>
        {formErrors.agreeTerms && (
          <p className={styles.errorMessage}>
            <FaExclamationTriangle />
            {formErrors.agreeTerms}
          </p>
        )}
      </div>

      <div className={styles.checkboxGroup}>
        <label className={`${styles.checkboxLabel} ${formErrors.agreePrivacy ? styles.checkboxLabelError : ""}`}>
          <input 
            type="checkbox" 
            className={styles.checkbox} 
            name="agreePrivacy" 
            checked={formData.agreePrivacy} 
            onChange={handleChange} 
          />
          I agree to the{" "}
          <Link to="/privacy" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>
            Privacy Policy
          </Link>
        </label>
        {formErrors.agreePrivacy && (
          <p className={styles.errorMessage}>
            <FaExclamationTriangle />
            {formErrors.agreePrivacy}
          </p>
        )}
      </div>

      <div className={styles.checkboxGroup}>
        <label className={styles.checkboxLabel}>
          <input 
            type="checkbox" 
            className={styles.checkbox} 
            name="newsletter" 
            checked={formData.newsletter} 
            onChange={handleChange} 
          />
          I want to receive news and special offers (optional)
        </label>
      </div>

      <div className={styles.formActions}>
        <button type="button" className={`${styles.button} ${styles.buttonOutline}`} onClick={handlePrevStep} disabled={isSubmitting}>
          <FaArrowLeft /> Back
        </button>
        <button 
          type="submit" 
          className={`${styles.button} ${styles.buttonPrimary}`} 
          disabled={isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting ? (
            <>
              <span className={styles.spinner}></span>
              <span>Creating account...</span>
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
      case 4:
        return renderStep4()
      default:
        return null
    }
  }

  return (
    <div className="auth-page register-page d-flex min-vh-100 bg-light-subtle">
      <div className={styles.registerContainer}>
        <div className={styles.gradientBar}></div>
        
        <div className="text-center mb-4">
          <Link to="/" className={styles.pageTitle}>
            Mandarin
          </Link>
          <p className={styles.subtitle}>Create your account in a few steps</p>
        </div>

        {formErrors.general && (
          <div className={`${styles.alert} ${styles.alertDanger}`}>
            <FaExclamationTriangle />
            <p className="mb-0">{formErrors.general}</p>
          </div>
        )}

        {renderProgress()}

        <form onSubmit={(e) => { e.preventDefault(); if (currentStep === 4) handleSubmit(); }}>
          {renderStepContent()}
        </form>

        {currentStep === 1 && (
          <>
            <div className={styles.divider}>OR SIGN UP WITH</div>
            <div className={styles.socialButtons}>
              <button className={styles.socialButton}>
                <FaGoogle className={styles.googleIcon} />
                <span>Sign up with Google</span>
              </button>
              <button className={styles.socialButton}>
                <FaFacebook className={styles.facebookIcon} />
                <span>Sign up with Facebook</span>
              </button>
            </div>
          </>
        )}

        <div className={styles.footer}>
          Already have an account?{" "}
          <Link to="/login" className={styles.footerLink}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Register