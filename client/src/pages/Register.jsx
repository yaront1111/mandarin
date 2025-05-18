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
// Assuming hooks are exported from here
import { useApi, usePhotoManagement } from '../hooks'; // Add usePhotoManagement
import { useAuth, useLanguage } from '../context'; // Import useLanguage from context
import { useTranslation } from "react-i18next"
import { toast } from "react-toastify"
import { createLogger } from "../utils/logger"
import styles from "../styles/register.module.css"

const logger = createLogger('Register')

const Register = () => {
  const { t } = useTranslation();
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
    profilePhoto: null, // This will hold the File object
  })
  const [previewImage, setPreviewImage] = useState(null)
  const fileInputRef = useRef(null)
  const [showPassword, setShowPassword] = useState(false)
  const [formErrors, setFormErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false)
  // Track if a submission has been attempted to improve validation UX
  const [attemptedSubmit, setAttemptedSubmit] = useState(false)
  // Remove redundant 'errors' state, use formErrors
  // const [errors, setErrors] = useState({})
  const [locationSuggestions, setLocationSuggestions] = useState([])

  // Internationalization and Auth context
  const { isRTL } = useLanguage() // Use language context hook
  const { register, error: authError, isAuthenticated } = useAuth() // Rename error to avoid conflict
  const navigate = useNavigate()
  const location = useLocation()
  
  // Get photo upload functionality from central hook with extended features
  const { 
    uploadPhoto, 
    isUploading, 
    uploadProgress, 
    normalizePhotoUrl,
    clearCache,
    pendingUploads
  } = usePhotoManagement()

  // --- Options (Consider translating these if they appear in UI directly) ---
  const availableInterests = [ /* Keys for interests */
    "Dating", "Casual", "Friendship", "Long-term", "Travel", "Outdoors", "Movies", "Music", "Fitness", "Food", "Art", "Reading", "Gaming", "Photography", "Dancing", "Cooking", "Sports",
  ]
  const iAmOptions = ["woman", "man", "couple"] // Keys for iAm
  const lookingForOptions = ["women", "men", "couples"] // Keys for lookingFor
  const intoTagsOptions = [ /* Keys for intoTags */
    "Meetups", "Power play", "Threesomes", "Online fun", "Hot chat", "Photo sharing", "Camera chat", "Cuckold", "Golden showers", "Strap-on", "Forced bi", "Erotic domination", "Humiliation", "Crossdressing", "Worship", "Foot fetish", "Oral", "From behind", "Role-play", "Toys", "Massages", "Foreplay", "Casual meetups", "Fantasy fulfillment", "Bizarre", "Education", "Experiences", "Tantra",
  ]
  const turnOnsOptions = [ /* Keys for turnOns */
    "Sexy ass", "Dirty talk", "Aggressive", "Slow and gentle", "In a public place", "Pampering", "Sexy clothing", "Leather/latex clothing", "Watching porn", "Fit body", "Bathing together", "Erotic writing", "Eye contact", "Being pampered", "Sexy legs", "Teasing", "Pushing boundaries",
  ]
  const maritalStatusOptions = [ /* Keys for maritalStatus */
    "Single", "Married", "Divorced", "Separated", "Widowed", "In a relationship", "It's complicated", "Open relationship", "Polyamorous",
  ]
  // ------------------------------------------------------------------------

  // Common locations in Israel for the datalist (These are values, not keys - generally okay not to translate)
  const commonLocations = [
    "Tel Aviv, Israel", "Jerusalem, Israel", "Haifa, Israel", "Eilat, Israel", "Beer Sheva, Israel", "Netanya, Israel", "Herzliya, Israel", "Ashdod, Israel", "Ashkelon, Israel", "Tiberias, Israel", "Ramat Gan, Israel", "Rishon LeZion, Israel", "Petah Tikva, Israel", "Holon, Israel", "Bat Yam, Israel", "Rehovot, Israel", "Kfar Saba, Israel", "Raanana, Israel", "Nahariya, Israel", "Acre, Israel",
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
    if (isAuthenticated) {
      navigate("/dashboard")
    }
    if (location.state?.email) {
      setFormData((prev) => ({ ...prev, email: location.state.email }))
    }
    // No need for cleanup function resetting state here if component unmounts
  }, [isAuthenticated, navigate, location.state?.email])
  
  // Check for pending uploads on component mount
  useEffect(() => {
    if (pendingUploads.length > 0 && isAuthenticated) {
      // Show notification about pending uploads, but only if already authenticated
      toast.info(
        t('pendingUploadsNotice', 
          `You have {{count}} photos pending upload that will complete when you're online.`, 
          { count: pendingUploads.length }
        )
      );
      logger.debug(`Found ${pendingUploads.length} pending uploads in queue`);
    }
  }, [pendingUploads.length, isAuthenticated, t])

  // Handle auth errors from context
  useEffect(() => {
    if (authError) {
       // Ensure authError is treated as a string
      const errorMessage = typeof authError === 'string' ? authError : t('generalError', 'An unexpected error occurred.');
      setFormErrors((prev) => ({ ...prev, general: errorMessage }))
      setIsSubmitting(false)
      const errorElement = document.querySelector(`.${styles.alertDanger}`)
      if (errorElement) {
        errorElement.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    }
  }, [authError, t]) // Added t dependency

  // Validation function (Error messages should be translated if possible)
  const validateStep = useCallback(
    (step) => {
      const errors = {}
      const emailRegex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/

      if (step === 1) {
        if (!formData.nickname.trim()) errors.nickname = t('nicknameRequired', "Nickname is required");
        else if (formData.nickname.length < 3) errors.nickname = t('nicknameTooShort', "Nickname must be at least 3 characters");
        else if (formData.nickname.length > 50) errors.nickname = t('nicknameTooLong', "Nickname cannot exceed 50 characters");
        else if (!/^[\p{L}\p{N}_]+$/u.test(formData.nickname)) errors.nickname = t('nicknameInvalid', "Nickname can contain letters in any language, numbers, and underscores");

        if (!formData.email) errors.email = t('emailRequired', 'Email is required');
        else if (!emailRegex.test(formData.email.toLowerCase())) errors.email = t('invalidEmail', "Please enter a valid email address");

        if (!formData.password) errors.password = t('passwordRequired', 'Password is required');
        else if (formData.password.length < 8) errors.password = t('passwordLengthError', 'Password must be at least 8 characters');
        // Updated password validation translations
        else if (!/(?=.*[a-z])/.test(formData.password)) errors.password = t('passwordLowercaseError', 'Password must include at least one lowercase letter');
        else if (!/(?=.*[A-Z])/.test(formData.password)) errors.password = t('passwordUppercaseError', 'Password must include at least one uppercase letter');
        else if (!/(?=.*\d)/.test(formData.password)) errors.password = t('passwordNumberError', 'Password must include at least one number');
        else if (!/(?=.*[@$!%*?&])/.test(formData.password)) errors.password = t('passwordSpecialError', 'Password must include at least one special character (@$!%*?&)');

        if (formData.password !== formData.confirmPassword) errors.confirmPassword = t('passwordMatchError', "Passwords do not match");
      }

      if (step === 2) {
        if (!formData.dateOfBirth) errors.dateOfBirth = t('dateOfBirthRequired', "Date of birth is required"); // Example specific validation key
        else {
          const age = calculateAge(formData.dateOfBirth);
          if (age < 18) errors.dateOfBirth = t('ageRestriction', "You must be at least 18 years old");
          else if (age > 120) errors.dateOfBirth = t('invalidDateOfBirth', "Please enter a valid date of birth");
        }
        if (!formData.iAm) errors.iAm = t('selectIdentity', "Please select who you are");
        if (!formData.location.trim()) errors.location = t('locationRequired', "Location is required");
        else if (formData.location.length < 2) errors.location = t('locationTooShort', "Location must be at least 2 characters");
        else if (formData.location.length > 100) errors.location = t('locationTooLong', "Location cannot exceed 100 characters");
      }

      if (step === 3) {
        if (!formData.profilePhoto) errors.profilePhoto = t('profilePhotoRequired', "Please upload a profile photo");
      }

      if (step === 4) {
        if (!formData.maritalStatus) errors.maritalStatus = t('maritalStatusRequired', "Please select your marital status");
        if (formData.lookingFor.length === 0) errors.lookingFor = t('selectLookingFor', "Please select what you're looking for");
        else if (formData.lookingFor.length > 3) errors.lookingFor = t('tooManyLookingFor', "Please select no more than 3 options");
        if (formData.intoTags.length > 20) errors.intoTags = t('tooManyIntoTags', "Please select no more than 20 'I'm into' tags");
        if (formData.turnOns.length > 20) errors.turnOns = t('tooManyTurnOns', "Please select no more than 20 'Turn ons' tags");
        if (formData.interests.length === 0) errors.interests = t('interestsRequired', "Please select at least one interest");
        else if (formData.interests.length > 10) errors.interests = t('tooManyInterests', "Please select no more than 10 interests");
        if (!formData.agreeTerms) errors.agreeTerms = t('termsRequired', "You must agree to the Terms of Service");
        if (!formData.agreePrivacy) errors.agreePrivacy = t('privacyRequired', "You must agree to the Privacy Policy");
      }

      return errors;
    },
    [formData, t], // Added t dependency
  );


  // Handle input changes (no translation needed here)
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }))
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: "" }))
    }
  }

  // Handle location input change with suggestions (no translation needed here)
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

  // Handle step navigation (no translation needed here)
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

  const handlePrevStep = () => {
    setCurrentStep(currentStep - 1)
    setFormErrors({})
    setAttemptedSubmit(false)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // --- Toggle functions for tag selections ---
  const toggleInterest = (interest) => {
    setFormData((prev) => {
      const currentInterests = prev.interests || [];
      const updatedInterests = currentInterests.includes(interest)
        ? currentInterests.filter((i) => i !== interest)
        : [...currentInterests, interest];
      if (updatedInterests.length > 10) {
        toast.warning(t('tooManyInterests', 'Please select no more than 10 interests'));
        return prev; // Do not update if limit exceeded
      }
      if (formErrors.interests && updatedInterests.length > 0) {
          setFormErrors({ ...formErrors, interests: "" })
      }
      return { ...prev, interests: updatedInterests };
    });
  };


  const toggleGoal = (goal) => {
    setFormData((prev) => {
      const currentGoals = prev.lookingFor || [];
      const updatedGoals = currentGoals.includes(goal)
        ? currentGoals.filter((g) => g !== goal)
        : [...currentGoals, goal];
      if (updatedGoals.length > 3) {
        toast.warning(t('tooManyLookingFor', 'Please select no more than 3 options'));
        return prev;
      }
       if (formErrors.lookingFor && updatedGoals.length > 0) {
         setFormErrors({ ...formErrors, lookingFor: "" })
       }
      return { ...prev, lookingFor: updatedGoals };
    });
  };

  const handleIAmSelection = (option) => {
     setFormData((prev) => ({ ...prev, iAm: prev.iAm === option ? "" : option }));
      if (formErrors.iAm && option) {
        setFormErrors({ ...formErrors, iAm: "" })
     }
  };

  const toggleIntoTag = (tag) => {
     setFormData((prev) => {
        const currentTags = prev.intoTags || [];
        const updatedTags = currentTags.includes(tag)
         ? currentTags.filter((t) => t !== tag)
         : [...currentTags, tag];
        if (updatedTags.length > 20) {
          toast.warning(t('tooManyIntoTags', "Please select no more than 20 'I'm into' tags"));
          return prev;
        }
        if (formErrors.intoTags) { // Clear error once a tag is selected/deselected
           setFormErrors({ ...formErrors, intoTags: "" })
        }
        return { ...prev, intoTags: updatedTags };
     });
  };

  const toggleTurnOn = (tag) => {
     setFormData((prev) => {
        const currentTags = prev.turnOns || [];
        const updatedTags = currentTags.includes(tag)
         ? currentTags.filter((t) => t !== tag)
         : [...currentTags, tag];
        if (updatedTags.length > 20) {
          toast.warning(t('tooManyTurnOns', "Please select no more than 20 'Turn ons' tags"));
          return prev;
        }
        if (formErrors.turnOns) { // Clear error once a tag is selected/deselected
          setFormErrors({ ...formErrors, turnOns: "" })
        }
        return { ...prev, turnOns: updatedTags };
     });
  };
  // ---------------------------------------

   // Handle marital status selection (no translation needed here)
  const handleMaritalStatusChange = (e) => {
    setFormData({ ...formData, maritalStatus: e.target.value })
    if (formErrors.maritalStatus) {
      setFormErrors({ ...formErrors, maritalStatus: "" })
    }
  }

   // Handle photo upload using the centralized hook
  const handlePhotoChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg']
    if (!allowedTypes.includes(file.type)) {
      toast.error(t('uploadTypeMismatch', 'Please upload a valid image file (JPEG, JPG or PNG)'))
      return
    }
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('uploadSizeLimitExceeded', 'Image size should be less than 5MB'))
      return
    }
    
    try {
      // Show processing indicator for large files
      if (file.size > 2 * 1024 * 1024) {
        setIsProcessingPhoto(true)
      }
      
      // Store the original file for later upload
      setFormData({ ...formData, profilePhoto: file })
      
      // Show preview (use the original file for preview)
      const reader = new FileReader()
      reader.onloadend = () => { 
        setPreviewImage(reader.result)
        setIsProcessingPhoto(false) // Hide processing indicator once preview is ready
      }
      reader.readAsDataURL(file)
      
      // Clear any previous errors
      if (formErrors.profilePhoto) {
        setFormErrors({ ...formErrors, profilePhoto: '' })
      }
      
      // Log file size for debugging
      logger.debug(`Selected photo: ${file.name}, size: ${(file.size / 1024 / 1024).toFixed(2)}MB`)
      
    } catch (err) {
      setIsProcessingPhoto(false)
      logger.error("Error processing photo:", err)
      toast.error(t('photoProcessingError', "Error processing photo"))
    }
  }

  // Handle photo removal (no translation needed here)
  const handleRemovePhoto = () => {
    setFormData({ ...formData, profilePhoto: null })
    setPreviewImage(null)
    setIsProcessingPhoto(false) // Clear processing state
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Trigger file input click (no translation needed here)
  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  // Removed redundant validateForm - using validateStep

  // Handle form submission (translate toast messages and errors)
  const handleSubmit = async (e) => {
    e?.preventDefault()
    // Validate the final step before submitting
    const finalStepErrors = validateStep(4);
     if (Object.keys(finalStepErrors).length > 0) {
        setFormErrors(finalStepErrors);
        const firstErrorElement = document.querySelector(`.${styles.errorMessage}`);
        if (firstErrorElement) {
          firstErrorElement.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return; // Stop submission if final step has errors
     }

    // Check if we're offline before starting registration
    if (!navigator.onLine && formData.profilePhoto) {
      // Show offline warning for photo uploads
      toast.info(t('offlinePhotoUploadWarn', 'You are currently offline. Your profile will be created, and your photo will upload automatically when you reconnect.'));
    }

    setFormErrors({}) // Clear errors before submitting
    setIsSubmitting(true)
    // Reset photo processing state
    setIsProcessingPhoto(false)

    try {
      // --- Step 1: Register User ---
      let gender = "";
      if (formData.iAm.toLowerCase() === "woman") gender = "female";
      else if (formData.iAm.toLowerCase() === "man") gender = "male";
      else if (formData.iAm.toLowerCase() === "couple") gender = "other";

      let accountTier = "FREE";
      if (formData.iAm.toLowerCase() === "woman") accountTier = "FEMALE";
      else if (formData.iAm.toLowerCase() === "couple") accountTier = "COUPLE";

      const submissionData = {
        nickname: formData.nickname.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        accountTier,
        isCouple: formData.iAm.toLowerCase() === "couple",
        details: {
          age: calculateAge(formData.dateOfBirth),
          gender,
          location: formData.location.trim(),
          bio: "", // Assuming bio is added later
          interests: formData.interests,
          iAm: formData.iAm,
          lookingFor: formData.lookingFor,
          intoTags: formData.intoTags,
          turnOns: formData.turnOns,
          maritalStatus: formData.maritalStatus,
          dateOfBirth: formData.dateOfBirth, // Send DOB
        },
      };

      const result = await register(submissionData); // Call register from useAuth

      // --- Step 2: Upload Photo if Registration Successful ---
      if (result && result.token) {
        // If there's a profile photo File object, upload it using the centralized hook
        if (formData.profilePhoto instanceof File) {
          try {
            // Use the enhanced uploadPhoto function with all new features
            const photoResult = await uploadPhoto(
              formData.profilePhoto,
              'public',
              null, // No progress callback needed here
              true, // Set as profile photo
              {
                isNewRegistration: true, // Enable token race condition handling
                compressImage: true, // Use image compression
                addToQueueOnFailure: true, // Add to retry queue if it fails
                compressionOptions: {
                  maxSizeMB: 1, // Compress to 1MB
                  maxWidthOrHeight: 1920 // Reasonable size for profile photos
                }
              }
            );

            if (photoResult) {
              if (photoResult.queued) {
                // Photo was queued for later upload (user is offline)
                toast.info(t('photoQueuedUpload', "Profile photo will be uploaded when you're online"));
                logger.debug("Profile photo queued for upload:", photoResult);
              } else {
                // Don't show success toast here - let the hook handle it
                logger.debug("Profile photo uploaded successfully via hook:", photoResult);
              }
            } else {
              logger.error("Photo upload returned no result");
              toast.error(t('photoUploadFailed', "Failed to upload profile photo"));
            }
          } catch (photoErr) {
            logger.error("Error uploading photo via hook:", photoErr);
            
            // Don't show error to user if already navigating to dashboard
            // This prevents the error toast from showing after the success message
            if (document.visibilityState === 'visible' && photoErr.message && !photoErr.message.includes('success')) {
              toast.error(t('photoUploadFailed', "Failed to upload profile photo:") + " " + (photoErr.message || ""));
            }
          }
        }

        // --- Step 3: Final Success Message and Navigation ---
        // Show success message
        toast.success(t('registerSuccess', "Welcome to Mandarin! Your account has been created successfully."));
        
        // Delay navigation slightly to allow photo upload to complete in the background
        // This ensures the token is fully processed before any navigation happens
        setTimeout(() => {
          navigate("/dashboard");
        }, 800);

      }
      // If register didn't return a token or threw an error, it's handled by the catch block below
      // or the useEffect watching authError.

    } catch (err) {
      logger.error("Registration error caught in component:", err);
      // Error handling is mostly done within useAuth's register function now.
      // We rely on the useEffect watching authError to display errors.
      // Set a general fallback error if needed and not already set by auth context.
       if (!formErrors.general && !authError) {
         setFormErrors((prev) => ({
           ...prev,
           general: err.message || t('generalError', "An unexpected error occurred. Please try again."),
         }));
       }
       // Scroll to error
       const errorElement = document.querySelector(`.${styles.errorMessage}, .${styles.alertDanger}`);
       if (errorElement) {
           errorElement.scrollIntoView({ behavior: "smooth", block: "start" });
       }
    } finally {
      setIsSubmitting(false);
    }
  }


  // Toggle password visibility (no translation needed here)
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword)
  }

   // Render progress indicator (uses t() correctly)
   const renderProgress = () => (
    <div className={styles.progressContainer}>
      <div className={styles.progressSteps}>
        <div className={`${styles.progressStep} ${currentStep >= 1 ? styles.active : ""}`}>
          <div className={styles.stepCircle}>{currentStep > 1 ? <FaCheck /> : 1}</div>
          <span className={styles.stepLabel}>{t('accountStep', 'Account')}</span>
        </div>
        <div className={styles.progressLine}></div>
        <div className={`${styles.progressStep} ${currentStep >= 2 ? styles.active : ""}`}>
          <div className={styles.stepCircle}>{currentStep > 2 ? <FaCheck /> : 2}</div>
          <span className={styles.stepLabel}>{t('profileStep', 'Profile')}</span>
        </div>
        <div className={styles.progressLine}></div>
        <div className={`${styles.progressStep} ${currentStep >= 3 ? styles.active : ""}`}>
          <div className={styles.stepCircle}>{currentStep > 3 ? <FaCheck /> : 3}</div>
          <span className={styles.stepLabel}>{t('photoStep', 'Photo')}</span>
        </div>
        <div className={styles.progressLine}></div>
        <div className={`${styles.progressStep} ${currentStep >= 4 ? styles.active : ""}`}>
          <div className={styles.stepCircle}>{currentStep > 4 ? <FaCheck /> : 4}</div>
          <span className={styles.stepLabel}>{t('preferencesStep', 'Preferences')}</span>
        </div>
      </div>
    </div>
  )

   // Render step 1 content (Account Information) - Use translations
  const renderStep1 = () => (
    <>
      <div className={styles.stepHeader}>
        <h3>{t('createAccount', 'Create Your Account')}</h3>
        <p>{t('enterBasicInfo', 'Enter your basic information')}</p>
      </div>
      <div className={styles.formGroup}>
        <label className={styles.formLabel} htmlFor="nickname">
          {t('nickname', 'Nickname')}
        </label>
        <div className={styles.inputWrapper}>
          <FaUser className={styles.inputIcon} />
          <input type="text" id="nickname" name="nickname" placeholder={t('chooseNickname', 'Choose a nickname')} className={styles.input} value={formData.nickname} onChange={handleChange} maxLength={50} autoComplete="nickname" />
        </div>
        {formErrors.nickname ? (<p className={styles.errorMessage}><FaExclamationTriangle /> {formErrors.nickname}</p>) : (<p className={styles.helpText}>{t('nicknameHelp', 'Your public display name (can contain letters, numbers, and underscores)')}</p>)}
      </div>
      <div className={styles.formGroup}>
        <label className={styles.formLabel} htmlFor="email">
          {t('emailAddress', 'Email Address')}
        </label>
        <div className={styles.inputWrapper}>
          <FaEnvelope className={styles.inputIcon} />
          <input type="email" id="email" name="email" placeholder={t('enterEmail', 'Enter your email')} className={styles.input} value={formData.email} onChange={handleChange} autoComplete="username" />
        </div>
        {formErrors.email ? (<p className={styles.errorMessage}><FaExclamationTriangle /> {formErrors.email}</p>) : (<p className={styles.helpText}>{t('emailHelp', "We'll never share your email with anyone else")}</p>)}
      </div>
      <div className={styles.formGroup}>
        <label className={styles.formLabel} htmlFor="password">
           {t('password', 'Password')}
        </label>
        <div className={styles.inputWrapper}>
          <FaLock className={styles.inputIcon} />
          <input type={showPassword ? "text" : "password"} id="password" name="password" placeholder={t('createPassword', 'Create a password')} className={styles.input} value={formData.password} onChange={handleChange} autoComplete="new-password" />
          <button type="button" className={styles.togglePassword} onClick={togglePasswordVisibility} tabIndex={-1} aria-label={showPassword ? t('hidePassword', "Hide password") : t('showPassword', "Show password")}>
            {showPassword ? <FaEyeSlash /> : <FaEye />}
          </button>
        </div>
        {formErrors.password ? (<p className={styles.errorMessage}><FaExclamationTriangle /> {formErrors.password}</p>) : (<p className={styles.helpText}>{t('passwordHelp', 'Must be at least 8 characters with uppercase, lowercase, number, and special character')}</p>)}
      </div>
      <div className={styles.formGroup}>
        <label className={styles.formLabel} htmlFor="confirmPassword">
          {t('confirmPassword', 'Confirm Password')}
        </label>
        <div className={styles.inputWrapper}>
          <FaLock className={styles.inputIcon} />
          <input type={showPassword ? "text" : "password"} id="confirmPassword" name="confirmPassword" placeholder={t('confirmPassword', 'Confirm password')} className={styles.input} value={formData.confirmPassword} onChange={handleChange} autoComplete="new-password" />
        </div>
        {formErrors.confirmPassword && (<p className={styles.errorMessage}><FaExclamationTriangle /> {formErrors.confirmPassword}</p>)}
      </div>
      <div className={styles.formActions}>
        <div></div>
        <button type="button" className={`${styles.button} ${styles.buttonPrimary}`} onClick={handleNextStep} disabled={isSubmitting}>
          {t('continue', 'Continue')} <FaArrowRight />
        </button>
      </div>
    </>
  )

  // Render step 2 content (Profile Information) - Use translations
  const renderStep2 = () => (
    <>
      <div className={styles.stepHeader}>
        <h3>{t('tellAboutYourself', 'Tell Us About Yourself')}</h3>
        <p>{t('addBasicProfileDetails', 'Add some basic profile details')}</p>
      </div>
      <div className={styles.formGroup}>
        <label className={styles.formLabel} htmlFor="dateOfBirth">
          {t('dateOfBirth', 'Date of Birth')}
        </label>
        <div className={styles.inputWrapper}>
          <FaCalendarAlt className={styles.inputIcon} />
          <input type="date" id="dateOfBirth" name="dateOfBirth" className={styles.input} value={formData.dateOfBirth} onChange={handleChange} max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split("T")[0]} />
        </div>
        {formErrors.dateOfBirth ? (<p className={styles.errorMessage}><FaExclamationTriangle /> {formErrors.dateOfBirth}</p>) : (<p className={styles.helpText}>{t('dateOfBirthHelp', 'You must be at least 18 years old to use this service')}</p>)}
      </div>
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>{t('iAmA', 'I am a')}</label>
        <div className={styles.tagContainer}>
          {iAmOptions.map((option) => (
            <button key={option} type="button" className={`${styles.tag} ${formData.iAm === option ? styles.selected : ""}`} onClick={() => handleIAmSelection(option)}>
              {t(option) || option.charAt(0).toUpperCase() + option.slice(1)}
              {formData.iAm === option && <FaCheck className={styles.tagCheck} />}
            </button>
          ))}
        </div>
        {formErrors.iAm && (<p className={styles.errorMessage}><FaExclamationTriangle /> {formErrors.iAm}</p>)}
      </div>
      <div className={styles.formGroup}>
        <label className={styles.formLabel} htmlFor="location">
          {t('location', 'Location')}
        </label>
        <div className={styles.inputWrapper}>
          <FaMapMarkerAlt className={styles.inputIcon} />
          <input type="text" id="location" name="location" placeholder={t('locationPlaceholder', 'City, Country')} className={styles.input} value={formData.location} onChange={handleLocationChange} maxLength={100} list="location-suggestions" />
          <datalist id="location-suggestions">{commonLocations.map((loc, index) => (<option key={index} value={loc} />))}</datalist>
        </div>
        {formErrors.location ? (<p className={styles.errorMessage}><FaExclamationTriangle /> {formErrors.location}</p>) : (<p className={styles.helpText}>{t('locationHelp', 'Your general location (e.g., Tel Aviv, Israel)')}</p>)}
      </div>
      <div className={styles.formActions}>
        <button type="button" className={`${styles.button} ${styles.buttonOutline}`} onClick={handlePrevStep}>
          <FaArrowLeft /> {t('back', 'Back')}
        </button>
        <button type="button" className={`${styles.button} ${styles.buttonPrimary}`} onClick={handleNextStep} disabled={isSubmitting}>
          {t('continue', 'Continue')} <FaArrowRight />
        </button>
      </div>
    </>
  )

  // Render step 3 content (Photo Upload) - Use translations
  const renderStep3 = () => (
    <>
      <div className={styles.stepHeader}>
        <h3>{t('uploadYourPhoto', 'Upload Your Photo')}</h3>
        <p>{t('improveVisibility', 'Add a profile photo to improve your visibility')}</p>
      </div>
      <div className={styles.photoUploadContainer}>
        {isUploading ? (
          <div className={styles.uploadProgressContainer}>
            <div className={styles.uploadProgressBar}>
              <div 
                className={styles.uploadProgressFill} 
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className={styles.uploadProgressText}>{t('uploading', 'Uploading')} {uploadProgress}%</p>
          </div>
        ) : isProcessingPhoto ? (
          <div className={styles.uploadProgressContainer}>
            <div className={styles.processingContainer}>
              <div className={styles.spinner}></div>
              <p>{t('processingPhoto', 'Processing photo...')}</p>
            </div>
          </div>
        ) : (
          <div className={`${styles.photoUploadArea} ${previewImage ? styles.hasImage : ''}`} onClick={triggerFileInput}>
            <input type="file" ref={fileInputRef} accept="image/jpeg,image/png,image/jpg" onChange={handlePhotoChange} className="d-none" />
            {previewImage ? (
              <img 
                src={previewImage} 
                alt={t('profilePhoto', 'Profile Preview')} 
                className={styles.profileImagePreview} 
              />
            ) : (
              <>
                <FaCamera className={styles.photoUploadIcon} />
                <p className={styles.photoUploadText}>
                  {t('clickToUpload', 'Click to upload a profile photo')}
                </p>
              </>
            )}
          </div>
        )}
        
        <p className={styles.uploadGuidelines}>
          {t('profileImageHelp', 'Photos should be clear, recent and show your face.')}
          <br />{t('profileImageSize', 'Maximum size: 5MB. Formats: JPG, JPEG, PNG.')}
        </p>
        
        {formErrors.profilePhoto && (
          <p className={styles.errorMessage}>
            <FaExclamationTriangle /> {formErrors.profilePhoto}
          </p>
        )}
        
        {previewImage && !isUploading && !isProcessingPhoto && (
          <div className={styles.photoActions}>
            <button 
              type="button" 
              className={`${styles.photoActionButton} ${styles.changePhotoButton}`} 
              onClick={triggerFileInput}
              disabled={isUploading || isProcessingPhoto}
            >
              <FaEdit /> {t('changePhoto', 'Change Photo')}
            </button>
            <button 
              type="button" 
              className={`${styles.photoActionButton} ${styles.removePhotoButton}`} 
              onClick={handleRemovePhoto}
              disabled={isUploading || isProcessingPhoto}
            >
              <FaTrash /> {t('removePhoto', 'Remove')}
            </button>
          </div>
        )}
      </div>
      <div className={styles.formActions}>
        <button 
          type="button" 
          className={`${styles.button} ${styles.buttonOutline}`} 
          onClick={handlePrevStep} 
          disabled={isSubmitting || isUploading || isProcessingPhoto}
        >
          <FaArrowLeft /> {t('back', 'Back')}
        </button>
        <button 
          type="button" 
          className={`${styles.button} ${styles.buttonPrimary}`} 
          onClick={handleNextStep} 
          disabled={isSubmitting || isUploading || isProcessingPhoto}
        >
           {t('continue', 'Continue')} <FaArrowRight />
        </button>
      </div>
    </>
  )

  // Render step 4 content (Preferences) - Use translations
  const renderStep4 = () => (
    <>
      <div className={styles.stepHeader}>
        <h3>{t('yourPreferences', 'Your Preferences')}</h3>
        <p>{t('tellWhatLooking', "Tell us about yourself and what you're looking for")}</p>
      </div>
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>{t('maritalStatus', 'Marital Status')}</label>
        <select className={styles.input} name="maritalStatus" value={formData.maritalStatus} onChange={handleMaritalStatusChange} style={{ paddingLeft: "1rem" }}>
          <option value="">{t('selectStatus', 'Select your status')}</option>
          {maritalStatusOptions.map((status) => (<option key={status} value={status}>{t(status) || status}</option>))}
        </select>
        {formErrors.maritalStatus && (<p className={styles.errorMessage}><FaExclamationTriangle /> {formErrors.maritalStatus}</p>)}
      </div>
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>{t('lookingFor', 'Looking For')}</label>
        <p className={styles.helpText}>{t('lookingForHelp', 'Select up to 3 options')}</p>
        <div className={styles.tagContainer}>
          {lookingForOptions.map((option) => (
            <button key={option} type="button" className={`${styles.tag} ${formData.lookingFor.includes(option) ? styles.selected : ""}`} onClick={() => toggleGoal(option)} disabled={!formData.lookingFor.includes(option) && formData.lookingFor.length >= 3}>
               {t(option) || option.charAt(0).toUpperCase() + option.slice(1)}
              {formData.lookingFor.includes(option) && <FaCheck className={styles.tagCheck} />}
            </button>
          ))}
        </div>
        {formErrors.lookingFor && (<p className={styles.errorMessage}><FaExclamationTriangle /> {formErrors.lookingFor}</p>)}
      </div>
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>{t('interests', 'Interests')}</label>
        <p className={styles.helpText}>{t('interestsHelp', 'Select up to 10 interests')}</p>
        <div className={styles.tagContainer}>
          {availableInterests.map((interest) => (
            <button key={interest} type="button" className={`${styles.tag} ${formData.interests.includes(interest) ? styles.selected : ""}`} onClick={() => toggleInterest(interest)} disabled={!formData.interests.includes(interest) && formData.interests.length >= 10}>
               {t(interest) || interest}
              {formData.interests.includes(interest) && <FaCheck className={styles.tagCheck} />}
            </button>
          ))}
        </div>
        {formErrors.interests && (<p className={styles.errorMessage}><FaExclamationTriangle /> {formErrors.interests}</p>)}
      </div>
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>{t('imInto', "I'm into")}</label>
        <p className={styles.helpText}>{t('imIntoHelp', 'Select up to 20 tags')}</p>
        <div className={styles.tagContainer}>
          {intoTagsOptions.map((tag) => (
            <button key={tag} type="button" className={`${styles.tag} ${formData.intoTags.includes(tag) ? styles.selected : ""}`} onClick={() => toggleIntoTag(tag)} disabled={!formData.intoTags.includes(tag) && formData.intoTags.length >= 20}>
               {/* Adjust key generation for tags with special chars if needed */}
               {t(tag) || tag}
              {formData.intoTags.includes(tag) && <FaCheck className={styles.tagCheck} />}
            </button>
          ))}
        </div>
        {formErrors.intoTags && (<p className={styles.errorMessage}><FaExclamationTriangle /> {formErrors.intoTags}</p>)}
      </div>
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>{t('turnsMeOn', 'It turns me on')}</label>
        <p className={styles.helpText}>{t('turnsMeOnHelp', 'Select up to 20 tags')}</p>
        <div className={styles.tagContainer}>
          {turnOnsOptions.map((tag) => (
            <button key={tag} type="button" className={`${styles.tag} ${formData.turnOns.includes(tag) ? styles.selected : ""}`} onClick={() => toggleTurnOn(tag)} disabled={!formData.turnOns.includes(tag) && formData.turnOns.length >= 20}>
               {/* Adjust key generation for tags with special chars if needed */}
               {t(tag) || tag}
              {formData.turnOns.includes(tag) && <FaCheck className={styles.tagCheck} />}
            </button>
          ))}
        </div>
        {formErrors.turnOns && (<p className={styles.errorMessage}><FaExclamationTriangle /> {formErrors.turnOns}</p>)}
      </div>
      <div className={styles.checkboxGroup}>
        <label className={`${styles.checkboxLabel} ${formErrors.agreeTerms ? styles.checkboxLabelError : ""}`}>
          <input type="checkbox" className={styles.checkbox} name="agreeTerms" checked={formData.agreeTerms} onChange={handleChange} />
          {t('termsAgreement', 'I agree to the')}{" "}
          <Link to="/terms" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>{t('termsOfService', 'Terms of Service')}</Link>
        </label>
        {formErrors.agreeTerms && (<p className={styles.errorMessage}><FaExclamationTriangle /> {formErrors.agreeTerms}</p>)}
      </div>
      <div className={styles.checkboxGroup}>
        <label className={`${styles.checkboxLabel} ${formErrors.agreePrivacy ? styles.checkboxLabelError : ""}`}>
          <input type="checkbox" className={styles.checkbox} name="agreePrivacy" checked={formData.agreePrivacy} onChange={handleChange} />
          {t('privacyAgreement', 'I agree to the')}{" "}
          <Link to="/privacy" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>{t('privacyPolicy', 'Privacy Policy')}</Link>
        </label>
        {formErrors.agreePrivacy && (<p className={styles.errorMessage}><FaExclamationTriangle /> {formErrors.agreePrivacy}</p>)}
      </div>
      <div className={styles.checkboxGroup}>
        <label className={styles.checkboxLabel}>
          <input type="checkbox" className={styles.checkbox} name="newsletter" checked={formData.newsletter} onChange={handleChange} />
           {t('newsletterAgreement', 'I want to receive news and special offers (optional)')}
        </label>
      </div>
      <div className={styles.formActions}>
        <button type="button" className={`${styles.button} ${styles.buttonOutline}`} onClick={handlePrevStep} disabled={isSubmitting}>
          <FaArrowLeft /> {t('back', 'Back')}
        </button>
        <button type="submit" className={`${styles.button} ${styles.buttonPrimary}`} disabled={isSubmitting} onClick={handleSubmit}>
          {isSubmitting ? (<> <span className={styles.spinner}></span> <span>{t('creatingAccount', 'Creating account...')}</span> </>) : (<> <span>{t('createBtn', 'Create Account')}</span> <FaCheck /> </>)}
        </button>
      </div>
    </>
  )

  // Render appropriate step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      default: return null;
    }
  }

  return (
    <div className={`auth-page register-page d-flex min-vh-100 bg-light-subtle ${isRTL ? 'rtl-layout' : ''}`}>
      <div className={styles.registerContainer}>
        <div className={styles.gradientBar}></div>
        <div className="text-center mb-4">
          <Link to="/" className={styles.pageTitle}>Mandarin</Link>
          <p className={styles.subtitle}>{t('createAccount', 'Create Your Account')}</p>
        </div>

        {/* Display general errors (ensure formErrors.general is a string) */}
        {formErrors.general && (
          <div className={`${styles.alert} ${styles.alertDanger}`}>
            <FaExclamationTriangle />
            {/* Render error message, ensuring it's a string */}
            <p className="mb-0">{typeof formErrors.general === 'string' ? formErrors.general : t('generalError', 'An error occurred')}</p>
          </div>
        )}

        {renderProgress()}

        {/* Ensure form submission only calls handleSubmit on final step */}
        <form onSubmit={(e) => { e.preventDefault(); if (currentStep === 4) handleSubmit(); }}>
          {renderStepContent()}
        </form>

        {/* Translate social login section */}
        {currentStep === 1 && (
          <>
            <div className={styles.divider}>{t('signUpWith', 'OR SIGN UP WITH')}</div>
            <div className={styles.socialButtons}>
              <button type="button" className={styles.socialButton}> {/* Add type="button" */}
                <FaGoogle className={styles.googleIcon} />
                <span>{t('signUpGoogle', 'Sign up with Google')}</span>
              </button>
              <button type="button" className={styles.socialButton}> {/* Add type="button" */}
                <FaFacebook className={styles.facebookIcon} />
                <span>{t('signUpFacebook', 'Sign up with Facebook')}</span>
              </button>
            </div>
          </>
        )}

        {/* Translate footer link */}
        <div className={styles.footer}>
          {t('haveAccount', 'Already have an account?')} {" "}
          <Link to="/login" className={styles.footerLink}>{t('signIn', 'Sign In')}</Link>
        </div>
      </div>
    </div>
  )
}

export default Register
