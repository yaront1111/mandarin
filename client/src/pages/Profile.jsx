"use client"

// client/src/pages/Profile.js
import { useState, useEffect, useRef, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth, useUser, useLanguage } from "../context"
import { toast } from "react-toastify"
import axios from "axios"
import { useTranslation } from "react-i18next"
import {
  FaUserCircle,
  FaCamera,
  FaLock,
  FaLockOpen,
  FaStar,
  FaTrash,
  FaEdit,
  FaTimes,
  FaCheck,
  FaExclamationTriangle,
  FaUsers
} from "react-icons/fa"
import { Navbar } from "../components/LayoutComponents"

// Import CSS module
import styles from "../styles/profile.module.css"

// Import hooks and components
import { usePhotoManagement, useMobileDetect, useIsMobile } from "../hooks"
import PhotoGallery from "../components/common/PhotoGallery"

// Import the normalizePhotoUrl utility
import { normalizePhotoUrl } from "../utils/index.js"
import logger from "../utils/logger"
import { enhanceScrolling, provideTactileFeedback } from "../utils/mobileGestures"

const log = logger.create("Profile")

const Profile = () => {
  // Reference to the profile container for mobile optimizations
  const profileContainerRef = useRef(null);
  const { user } = useAuth()
  const { updateProfile, refreshUserData } = useUser()
  const { t } = useTranslation()
  const { isRTL } = useLanguage()

  // Use mobile detection hooks
  const isMobile = useIsMobile()
  const { isTouch, isIOS, isAndroid, isPWA } = useMobileDetect()

  // Memoized translations using direct t() calls with fallbacks
  const translations = useMemo(() => ({
    // Profile photo management
    profilePhoto: t('profilePhoto') || 'Profile Photo',
    profileUpdated: t('profileUpdated') || 'Profile updated successfully',
    updateFailed: t('updateFailed') || 'Update failed',
    photoUploadSuccess: t('photoUploadSuccess') || 'Photo uploaded successfully',
    updatingPhotoPrivacy: t('updatingPhotoPrivacy') || 'Updating photo privacy...',
    photoPrivacySuccess: t('photoPrivacySuccess') || 'Photo privacy updated',
    updatingProfilePhoto: t('updatingProfilePhoto') || 'Updating profile photo...',
    profilePhotoUpdated: t('profilePhotoUpdated') || 'Profile photo updated',
    confirmDeletePhoto: t('confirmDeletePhoto') || 'Are you sure you want to delete this photo?',
    photoDeleteSuccess: t('photoDeleteSuccess') || 'Photo deleted successfully',

    // UI elements
    loadingProfile: t('loading') || 'Loading...',
    uploading: t('uploading') || 'Uploading...',
    addPhoto: t('addPhoto') || 'Add Photo',
    myProfile: t('myProfile') || 'My Profile',
    edit: t('edit') || 'Edit',
    cancel: t('cancel') || 'Cancel',
    save: t('save') || 'Save',
    saving: t('saving') || 'Saving...',
    basicInformation: t('basicInfo') || 'Basic Information',

    // Profile fields
    nickname: t('nickname') || 'Nickname',
    age: t('age') || 'Age',
    location: t('location') || 'Location',
    iAmA: t('iAm') || 'I am',
    notSpecified: t('notSpecified') || 'Not specified',
    maritalStatus: t('maritalStatus') || 'Marital Status',
    maritalStatusMarried: t('maritalStatusMarried') || 'Married',
    aboutMe: t('aboutMe') || 'About Me',
    tellAboutYourself: t('tellAboutYourself') || 'Tell others about yourself...',
    noBioProvided: t('noBioProvided') || 'No bio provided',

    // Interests and preferences
    interests: t('interests') || 'Interests',
    interestsLimit: t('interestsLimit') || 'Select up to 10 interests',
    noInterestsSelected: t('noInterestsSelected') || 'No interests selected',
    lookingFor: t('lookingFor') || 'Looking For',
    lookingForLimit: t('lookingForLimit') || 'Select up to 3 options',
    imInto: t('intoTags') || 'I\'m Into',
    intoTagsLimit: t('intoTagsLimit') || 'Select up to 20 tags',
    noTagsSelected: t('noTagsSelected') || 'No tags selected',
    turnOns: t('turnOns') || 'Turn Ons',
    turnOnsLimit: t('turnOnsLimit') || 'Select up to 20 turn ons',

    // Privacy states
    private: t('private') || 'Private',
    public: t('public') || 'Public',
    friendsOnly: t('friendsOnly') || 'Friends Only',

    // Error messages
    profileUpdateFailed: t('profileUpdateFailed') || 'Failed to update profile',
    photoUploadFailed: t('photoUploadFailed') || 'Failed to upload photo',
    photoPrivacyUpdateFailed: t('photoPrivacyUpdateFailed') || 'Failed to update photo privacy',
    profilePhotoUpdateFailed: t('profilePhotoUpdateFailed') || 'Failed to update profile photo',
    photoDeleteFailed: t('photoDeleteFailed') || 'Failed to delete photo',

    // Field validations
    required: t('required') || 'This field is required',
    invalidFormat: t('invalidFormat') || 'Invalid format',
    tooShort: t('tooShort') || 'Too short',
    tooLong: t('tooLong') || 'Too long',

    // User types
    man: t('man') || 'Man',
    woman: t('woman') || 'Woman',
    couple: t('couple') || 'Couple',
    men: t('men') || 'Men',
    women: t('women') || 'Women',
    couples: t('couples') || 'Couples'
  }), [t])
  
  // Use the centralized photo management hook
  const {
    uploadPhoto,
    setPhotoPrivacy,
    setProfilePhoto,
    deletePhoto,
    isUploading,
    uploadProgress,
    isProcessingPhoto,
    processPhotos,
    clearCache,
    refreshAllAvatars
  } = usePhotoManagement()

  const [isEditing, setIsEditing] = useState(false)
  const [profileData, setProfileData] = useState({
    nickname: "",
    details: {
      age: "",
      gender: "",
      location: "",
      bio: "",
      interests: [],
      iAm: "",
      lookingFor: [],
      intoTags: [],
      turnOns: [],
      maritalStatus: "",
    },
  })
  
  const [availableInterests] = useState([
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
  ])
  const [iAmOptions] = useState(["woman", "man", "couple"])
  const [lookingForOptions] = useState(["women", "men", "couples"])
  const [intoTagsOptions] = useState([
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
  ])
  const [turnOnsOptions] = useState([
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
  ])
  const [maritalStatusOptions] = useState([
    "Single",
    "Married",
    "Divorced",
    "Separated",
    "Widowed",
    "In a relationship",
    "It's complicated",
    "Open relationship",
    "Polyamorous",
  ])
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fileInputRef = useRef(null)
  const navigate = useNavigate()

  // States for loading and photo management
  const [isLoading, setIsLoading] = useState(true)
  const [photosUpdateTimestamp, setPhotosUpdateTimestamp] = useState(Date.now())

  // Initialize profile state from user data
  useEffect(() => {
    setIsLoading(true)
    if (user) {
      setProfileData({
        nickname: user.nickname || "",
        details: {
          age: user.details?.age || "",
          gender: user.details?.gender || "",
          location: user.details?.location || "",
          bio: user.details?.bio || "",
          interests: user.details?.interests || [],
          iAm: user.details?.iAm || "",
          lookingFor: user.details?.lookingFor || [],
          intoTags: user.details?.intoTags || [],
          turnOns: user.details?.turnOns || [],
          maritalStatus: user.details?.maritalStatus || "",
        },
      })
      log.debug(`User has ${user.photos?.length || 0} photos`)
    }
    setIsLoading(false)
  }, [user])

  // Add a mounted ref to prevent state updates after component unmount
  const isMountedRef = useRef(true)
  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Cleanup file input on unmount to prevent lingering file references.
  useEffect(() => {
    return () => {
      if (fileInputRef.current) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        fileInputRef.current.value = ""
      }
    }
  }, [])
  
  // Setup mobile optimizations
  useEffect(() => {
    // Enhance scrolling behavior on mobile devices
    let cleanupScrolling = null;
    if (isTouch && profileContainerRef.current) {
      cleanupScrolling = enhanceScrolling(profileContainerRef.current);
      log.debug('Mobile scroll enhancements applied to Profile');
    }
    
    return () => {
      if (cleanupScrolling) cleanupScrolling();
    };
  }, [isTouch]);


  const handleChange = (e) => {
    const { name, value, type, checked } = e.target

    // For checkbox inputs, use the checked property
    if (type === "checkbox") {
      setProfileData({ ...profileData, [name]: checked })
    }
    // For number inputs, ensure valid numbers
    else if (type === "number") {
      // Allow empty string or valid numbers
      if (value === "" || !isNaN(Number.parseInt(value))) {
        if (name.includes("details.")) {
          const fieldName = name.split(".")[1]
          setProfileData({
            ...profileData,
            details: {
              ...profileData.details,
              [fieldName]: value,
            },
          })
        } else {
          setProfileData({ ...profileData, [name]: value })
        }
      }
    }
    // For all other inputs
    else {
      if (name.includes("details.")) {
        const fieldName = name.split(".")[1]
        setProfileData({
          ...profileData,
          details: {
            ...profileData.details,
            [fieldName]: value,
          },
        })
      } else {
        setProfileData({ ...profileData, [name]: value })
      }
    }

    // Clear the error for this field if it exists
    if (errors[name.split(".").pop()]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[name.split(".").pop()]
        return newErrors
      })
    }
  }

  const toggleInterest = (interest) => {
    const interests = profileData.details.interests
    if (!interests.includes(interest) && interests.length >= 10) {
      toast.warning("You can select up to 10 interests")
      return
    }
    const updated = interests.includes(interest) ? interests.filter((i) => i !== interest) : [...interests, interest]
    setProfileData((prev) => ({
      ...prev,
      details: { ...prev.details, interests: updated },
    }))
  }

  const handleIAmSelection = (option) => {
    setProfileData((prev) => ({
      ...prev,
      details: { ...prev.details, iAm: prev.details.iAm === option ? "" : option },
    }))
  }

  const toggleLookingFor = (option) => {
    const lookingFor = profileData.details.lookingFor
    let updated

    if (lookingFor.includes(option)) {
      updated = lookingFor.filter((item) => item !== option)
    } else {
      if (lookingFor.length >= 3) {
        toast.warning("You can select up to 3 options")
        return
      }
      updated = [...lookingFor, option]
    }

    setProfileData((prev) => ({
      ...prev,
      details: { ...prev.details, lookingFor: updated },
    }))
  }

  const toggleIntoTag = (tag) => {
    const intoTags = profileData.details.intoTags

    if (!intoTags.includes(tag) && intoTags.length >= 20) {
      toast.warning("You can select up to 20 'I'm into' tags")
      return
    }

    const updated = intoTags.includes(tag) ? intoTags.filter((t) => t !== tag) : [...intoTags, tag]

    setProfileData((prev) => ({
      ...prev,
      details: { ...prev.details, intoTags: updated },
    }))
  }

  const toggleTurnOn = (tag) => {
    const turnOns = profileData.details.turnOns

    if (!turnOns.includes(tag) && turnOns.length >= 20) {
      toast.warning("You can select up to 20 'Turn ons' tags")
      return
    }

    const updated = turnOns.includes(tag) ? turnOns.filter((t) => t !== tag) : [...turnOns, tag]

    setProfileData((prev) => ({
      ...prev,
      details: { ...prev.details, turnOns: updated },
    }))
  }

  const handleMaritalStatusSelection = (status) => {
    setProfileData((prev) => ({
      ...prev,
      details: { ...prev.details, maritalStatus: prev.details.maritalStatus === status ? "" : status },
    }))
  }

  const validateForm = () => {
    const validationErrors = {}
    if (!profileData.nickname.trim()) {
      validationErrors.nickname = "nicknameRequired"
    } else if (profileData.nickname.length < 3) {
      validationErrors.nickname = "nicknameTooShort"
    } else if (profileData.nickname.length > 50) {
      validationErrors.nickname = "nicknameTooLong"
    }
    if (!profileData.details.age && profileData.details.age !== 0) {
      validationErrors.age = "ageRequired"
    } else if (isNaN(profileData.details.age)) {
      validationErrors.age = "ageInvalid"
    } else if (profileData.details.age < 18) {
      validationErrors.age = "ageMinimum"
    } else if (profileData.details.age > 120) {
      validationErrors.age = "ageMaximum"
    }
    if (!profileData.details.location.trim()) {
      validationErrors.location = "locationRequired"
    } else if (profileData.details.location.length < 2) {
      validationErrors.location = "locationTooShort"
    }
    if (profileData.details.bio && profileData.details.bio.length > 500) {
      validationErrors.bio = "bioTooLong"
    }
    return validationErrors
  }

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
      // Ensure we're properly handling all fields, especially the newly moved ones
      const submissionData = {
        nickname: profileData.nickname.trim(),
        details: {
          ...profileData.details,
          age: Number(profileData.details.age),
          location: profileData.details.location.trim(),
          bio: profileData.details.bio ? profileData.details.bio.trim() : "",
          interests: Array.isArray(profileData.details.interests) ? profileData.details.interests : [],
          // Ensure iAm and maritalStatus (which were moved) are properly included
          iAm: profileData.details.iAm || "",
          lookingFor: Array.isArray(profileData.details.lookingFor) ? profileData.details.lookingFor : [],
          intoTags: Array.isArray(profileData.details.intoTags) ? profileData.details.intoTags : [],
          turnOns: Array.isArray(profileData.details.turnOns) ? profileData.details.turnOns : [],
          maritalStatus: profileData.details.maritalStatus || "",
        },
      }

      const updatedUser = await updateProfile(submissionData)

      if (updatedUser) {
        // After successful update, force a refresh of user data and wait for it to complete
        const refreshResult = await refreshUserData(updatedUser._id);

        if (!refreshResult) {
          log.warn("User data refresh may not have been complete, but continuing");
        }

        toast.success(translations.profileUpdated)
        setIsEditing(false)
      } else {
        throw new Error(translations.updateFailed)
      }
    } catch (error) {
      console.error("Failed to update profile:", error)
      toast.error(error.message || translations.profileUpdateFailed)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Updated to use the centralized photo management hook
  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    // Add tactile feedback for mobile users
    if (isTouch) {
      provideTactileFeedback('sendFile');
    }
    
    // No need to duplicate validation logic from the hook
    try {
      // Default to private for new uploads
      const newPhoto = await uploadPhoto(file, 'private')
      
      if (newPhoto) {
        // Clear URL cache to ensure new photo is displayed without refresh
        clearCache();
        
        // Update timestamp to force re-rendering
        setPhotosUpdateTimestamp(Date.now());
        
        toast.success(translations.photoUploadSuccess)
        
        // Force immediate refresh of user data to update UI without page reload
        await refreshUserData(user?._id, true)
        
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      }
    } catch (error) {
      log.error("Failed to upload photo:", error)
      toast.error(error.message || translations.photoUploadFailed)
    }
  }
  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  // Updated to use the centralized hook's setPhotoPrivacy method
  const handleSetPhotoPrivacy = async (photoId, newPrivacy, e) => {
    e?.stopPropagation()
    
    try {
      // Show loading indicator
      toast.info(translations.updatingPhotoPrivacy, { autoClose: 1000 });
      
      // The hook handles all validation and error processing
      await setPhotoPrivacy(photoId, newPrivacy, user?._id)
      
      // Use the most aggressive refresh option - force a page reload
      // This is the simplest and most reliable way to ensure everything updates
      refreshAllAvatars(true); // Pass true to force a page refresh
      
      // The code below won't execute because the page will refresh
      // but we'll keep it as a fallback
      
      // Clear URL cache to ensure photo is displayed with updated privacy
      clearCache();
      
      // Update timestamp to force re-rendering
      setPhotosUpdateTimestamp(Date.now());
      
      // Force immediate refresh of user data to update UI without page reload
      await refreshUserData(user?._id, true)
      
      // Toast with the privacy level that was set
      const privacyName =
        newPrivacy === 'private' ? translations.private :
        newPrivacy === 'friends_only' ? translations.friendsOnly :
        translations.public;

      toast.success(t('photoPrivacySuccess') || `Photo privacy set to ${privacyName}`)
    } catch (error) {
      log.error("Failed to update photo privacy:", error)
      toast.error(error.message || translations.photoPrivacyUpdateFailed)
    }
  }

  // Updated to use the centralized hook's setProfilePhoto method
  const handleSetProfilePhoto = async (photoId) => {
    try {
      // Add tactile feedback for mobile users
      if (isTouch) {
        provideTactileFeedback('selectConversation');
      }
      
      // Show loading indicator
      toast.info(translations.updatingProfilePhoto, { autoClose: 1000 });
      
      // The hook handles all validation and processing
      await setProfilePhoto(photoId, user?._id);
      
      // Use the most aggressive refresh option - force a page reload
      // This is the simplest and most reliable way to ensure everything updates
      refreshAllAvatars(true); // Pass true to force a page refresh
      
      // The code below won't execute because the page will refresh
      // but we'll keep it as a fallback
      
      // Force immediate UI update with new timestamp 
      window.__photo_refresh_timestamp = Date.now();
      setPhotosUpdateTimestamp(window.__photo_refresh_timestamp);
      
      // Wait briefly to let the server process the update
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Force immediate refresh of user data to update UI without page reload
      await refreshUserData(user?._id, true);
      
      // Force a component re-render after everything is updated
      setPhotosUpdateTimestamp(Date.now());
      
      toast.success(translations.profilePhotoUpdated)
    } catch (error) {
      log.error("Failed to set profile photo:", error)
      toast.error(error.message || translations.profilePhotoUpdateFailed)
    }
  }

  // Updated to use the centralized hook's deletePhoto method
  const handleDeletePhoto = async (photoId, e) => {
    e?.stopPropagation()
    
    // Confirm deletion with the user
    if (!window.confirm(translations.confirmDeletePhoto)) return
    
    try {
      // The hook handles validation including profile photo check
      await deletePhoto(photoId, user?._id)
      
      // Clear URL cache to ensure deleted photo is no longer displayed
      clearCache();
      
      // Update timestamp to force re-rendering
      setPhotosUpdateTimestamp(Date.now());
      
      // Force immediate refresh of user data to update UI without page reload
      await refreshUserData(user?._id, true)
      
      toast.success(translations.photoDeleteSuccess)
    } catch (error) {
      log.error("Failed to delete photo:", error)
      toast.error(error.message || translations.photoDeleteFailed)
    }
  }

  const handleCancelEdit = () => {
    if (user) {
      setProfileData({
        nickname: user.nickname || "",
        details: {
          age: user.details?.age || "",
          gender: user.details?.gender || "",
          location: user.details?.location || "",
          bio: user.details?.bio || "",
          interests: user.details?.interests || [],
          iAm: user.details?.iAm || "",
          lookingFor: user.details?.lookingFor || [],
          intoTags: user.details?.intoTags || [],
          turnOns: user.details?.turnOns || [],
          maritalStatus: user.details?.maritalStatus || "",
        },
      })
    }
    setErrors({})
    setIsEditing(false)
  }


  const handleMessage = () => {
    navigate("/messages")
  }

  
  return (
    <div 
      ref={profileContainerRef}
      className={`${styles.profilePage} min-vh-100 w-100 overflow-hidden bg-light-subtle transition-all ${isRTL ? 'rtl-layout' : ''} ${isMobile ? 'mobile-optimized' : ''}`}>
      {/* Use Navbar from LayoutComponents */}
      <Navbar />

      {/* Main Content */}
      <main className={`${styles.dashboardContent} py-5`}>
        <div className="container max-w-xl mx-auto px-4 d-flex flex-column gap-5">
          {isLoading ? (
            <div className="d-flex flex-column align-items-center justify-content-center py-5 text-center">
              <div className={`${styles.spinner} ${styles.spinnerLarge} text-primary mb-4`}></div>
              <p className="text-opacity-70 font-weight-medium">{translations.loadingProfile}</p>
            </div>
          ) : (
            <>
              {/* Profile Photo Section */}
              <div className={`${styles.photoSection} text-center bg-white shadow-lg rounded-lg border py-4 transform-gpu hover-shadow-xl transition-all`}>
                {user?.photos && user.photos.some(p => p.isProfile && !p.isDeleted) ? (
                  <div className={`${styles.profilePhotoWrapper} position-relative d-inline-block`}>
                    {/* Find the profile photo from user photos */}
                    {(() => {
                      const profilePhoto = user.photos.find(p => p.isProfile && !p.isDeleted) || user.photos[0];
                      const photoPrivacy = profilePhoto.privacy || (profilePhoto.isPrivate ? 'private' : 'public');
                      
                      return (
                        <>
                          <img
                            key={`profile-photo-${photosUpdateTimestamp}`}
                            src={`${normalizePhotoUrl(profilePhoto.url, true)}${window.__photo_refresh_timestamp ? `&_t=${window.__photo_refresh_timestamp}` : ''}&_updateTime=${photosUpdateTimestamp}`}
                            alt={translations.profilePhoto}
                            className={`${styles.profilePhoto} w-300px h-300px object-cover rounded-circle shadow-lg border-4 border-white transform-gpu transition-transform hover-scale`}
                          />
                          
                          {/* Show privacy overlay based on the new privacy model */}
                          {photoPrivacy !== 'public' && (
                            <div className="position-absolute top-0 left-0 w-100 h-100 rounded-circle d-flex align-items-center justify-content-center bg-overlay-dark">
                              {photoPrivacy === 'private' ? (
                                <FaLock className="text-3xl text-white" />
                              ) : (
                                <FaUsers className="text-3xl text-white" />
                              )}
                            </div>
                          )}
                          
                          <div className="position-absolute bottom-0 left-0 w-100 py-1 bg-overlay-dark text-white text-xs rounded-bottom-circle">
                            {translations.profilePhoto}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="w-300px h-300px rounded-circle bg-light d-flex align-items-center justify-content-center mx-auto border-4 border-white">
                    <FaUserCircle className="text-7xl text-gray-400" />
                  </div>
                )}

                {/* Photo Upload */}
                <div className="mt-4">
                  {isUploading ? (
                    <div className="mx-auto w-200px">
                      <div className="h-8px bg-gray-800 rounded-pill overflow-hidden mb-2">
                        <div
                          className="h-100 bg-primary transition-width"
                          role="progressbar"
                          style={{ width: `${uploadProgress}%` }}
                          aria-valuenow={uploadProgress}
                          aria-valuemin="0"
                          aria-valuemax="100"
                        ></div>
                      </div>
                      <div className="text-center text-opacity-70">{translations.uploading} {uploadProgress}%</div>
                    </div>
                  ) : (
                    <button
                      className="btn btn-outline-primary rounded-pill d-inline-flex align-items-center gap-2 hover-scale shadow-sm transition-all px-4 py-2"
                      onClick={triggerFileInput}
                      disabled={isProcessingPhoto}
                      aria-label={translations.addPhoto}
                    >
                      <FaCamera /> <span>{translations.addPhoto}</span>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handlePhotoUpload}
                        accept="image/*"
                        style={{ display: "none" }}
                        aria-hidden="true"
                      />
                    </button>
                  )}
                </div>
              </div>

              {/* Photo Gallery Section - Using the consolidated PhotoGallery component */}
              {user?.photos && user.photos.length > 0 && (
                <>
                  <PhotoGallery
                    key={`photo-gallery-${user.photos?.length || 0}-${photosUpdateTimestamp}`}
                    photos={processPhotos(user.photos)}
                    onSetProfilePhoto={handleSetProfilePhoto}
                    onSetPrivacy={handleSetPhotoPrivacy}
                    onDeletePhoto={handleDeletePhoto}
                    isProcessing={isProcessingPhoto}
                    isUploading={isUploading}
                    uploadProgress={uploadProgress}
                    canEdit={true}
                    canTogglePrivacy={true}
                    userId={user?._id}
                    isOwner={true}
                    canViewPrivate={true}
                    gridView={true} // Use grid view for the profile page
                  />
                  
                  {/* Add Photo Button - Keep outside the gallery for better positioning */}
                  <div className="text-center mt-4">
                    <button
                      type="button"
                      className={styles.addPhotoButton}
                      onClick={triggerFileInput}
                      disabled={isUploading || isProcessingPhoto}
                      aria-label={translations.addPhoto}
                    >
                      <FaCamera style={{ fontSize: "18px", marginRight: "8px" }} />
                      {translations.addPhoto}
                    </button>
                  </div>
                </>
              )}

              {/* Profile Information Section - Enhanced with utility classes */}
              <div className={styles.profileInfo}>
                <div className={styles.profileHeader}>
                  <h2 className={styles.profileTitle}>{translations.myProfile}</h2>
                  {!isEditing ? (
                    <button
                      className={`${styles.btn} ${styles.btnPrimary}`}
                      onClick={() => setIsEditing(true)}
                      aria-label={translations.edit}
                    >
                      <FaEdit /> <span>{translations.edit}</span>
                    </button>
                  ) : (
                    <div className={`${styles.flexDisplay} ${styles.gap2}`}>
                      <button
                        className={`${styles.btn} ${styles.btnOutline}`}
                        onClick={handleCancelEdit}
                        disabled={isSubmitting}
                        aria-label={translations.cancel}
                      >
                        <FaTimes /> <span>{translations.cancel}</span>
                      </button>
                      <button
                        className={`${styles.btn} ${styles.btnPrimary}`}
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        aria-label={translations.save}
                      >
                        {isSubmitting ? (
                          <>
                            <span className={`${styles.spinner} ${styles.spinnerDark}`}></span>
                            <span>{translations.saving}</span>
                          </>
                        ) : (
                          <>
                            <FaCheck /> <span>{translations.save}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                <form className="mt-4" onSubmit={handleSubmit}>
                  <div className={`${styles.infoSection} animate-fade-in`}>
                    <h3 className={styles.sectionTitle}>{translations.basicInformation}</h3>
                    <div className={styles.infoGrid}>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel} htmlFor="nickname">
                          {translations.nickname}
                        </label>
                        <input
                          type="text"
                          id="nickname"
                          name="nickname"
                          className={`${styles.formControl} ${errors.nickname ? styles.borderDanger : ''}`}
                          value={profileData.nickname}
                          onChange={handleChange}
                          disabled={!isEditing}
                          maxLength={50}
                          aria-invalid={errors.nickname ? "true" : "false"}
                          aria-describedby={errors.nickname ? "nickname-error" : undefined}
                        />
                        {errors.nickname && (
                          <p id="nickname-error" className={styles.errorMessage}>
                            <FaExclamationTriangle className="mr-1" />
                            {t(`errors.${errors.nickname}`)}
                          </p>
                        )}
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel} htmlFor="details.age">
                          {translations.age}
                        </label>
                        <input
                          type="number"
                          id="details.age"
                          name="details.age"
                          className={`${styles.formControl} ${errors.age ? styles.borderDanger : ''}`}
                          value={profileData.details.age}
                          onChange={handleChange}
                          disabled={!isEditing}
                          min="18"
                          max="120"
                          aria-invalid={errors.age ? "true" : "false"}
                          aria-describedby={errors.age ? "age-error" : undefined}
                        />
                        {errors.age && (
                          <p id="age-error" className={styles.errorMessage}>
                            <FaExclamationTriangle className="mr-1" />
                            {t(`errors.${errors.age}`)}
                          </p>
                        )}
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel} htmlFor="details.location">
                          {translations.location}
                        </label>
                        <input
                          type="text"
                          id="details.location"
                          name="details.location"
                          className={`${styles.formControl} ${errors.location ? styles.borderDanger : ''}`}
                          value={profileData.details.location}
                          onChange={handleChange}
                          disabled={!isEditing}
                          maxLength={100}
                          aria-invalid={errors.location ? "true" : "false"}
                          aria-describedby={errors.location ? "location-error" : undefined}
                        />
                        {errors.location && (
                          <p id="location-error" className={styles.errorMessage}>
                            <FaExclamationTriangle className="mr-1" />
                            {t(`errors.${errors.location}`)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className={styles.mt4}>
                      <label className={styles.formLabel}>{translations.iAmA}</label>
                      <div className={`${styles.flexDisplay} ${styles.flexWrap} ${styles.gap2}`}>
                        {iAmOptions.map((option) => {
                          const identityClass =
                            option === "woman" ? styles["identity-woman"] :
                            option === "man" ? styles["identity-man"] :
                            option === "couple" ? styles["identity-couple"] : "";

                          return (
                            <button
                              key={option}
                              type="button"
                              className={`${styles.interestTag} ${profileData.details.iAm === option ? `${styles.selected} ${identityClass}` : identityClass}`}
                              onClick={() => isEditing && handleIAmSelection(option)}
                              disabled={!isEditing}
                              aria-pressed={profileData.details.iAm === option}
                            >
                              {t(option) || option}
                              {profileData.details.iAm === option && <FaCheck style={{ marginLeft: "4px" }} />}
                            </button>
                          );
                        })}
                      </div>
                      {!profileData.details.iAm && !isEditing && (
                        <p className={`${styles.textMuted} ${styles.fstItalic} ${styles.mt2}`}>{translations.notSpecified}</p>
                      )}
                    </div>

                    <div className={styles.mt4}>
                      <label className={styles.formLabel}>{translations.maritalStatus}</label>
                      <div className={`${styles.flexDisplay} ${styles.flexWrap} ${styles.gap2}`}>
                        {maritalStatusOptions.map((status) => (
                          <button
                            key={status}
                            type="button"
                            className={`${styles.interestTag} ${profileData.details.maritalStatus === status ? styles.selected : ''}`}
                            onClick={() => isEditing && handleMaritalStatusSelection(status)}
                            disabled={!isEditing}
                            aria-pressed={profileData.details.maritalStatus === status}
                          >
                            {t(status) || (status.toLowerCase() === "married" ? translations.maritalStatusMarried : status)}
                            {profileData.details.maritalStatus === status && <FaCheck style={{ marginLeft: "4px" }} />}
                          </button>
                        ))}
                      </div>
                      {!profileData.details.maritalStatus && !isEditing && (
                        <p className={`${styles.textMuted} ${styles.fstItalic} ${styles.mt2}`}>{translations.notSpecified}</p>
                      )}
                    </div>
                  </div>

                  <div className={styles.infoSection}>
                    <h3 className={styles.sectionTitle}>{translations.aboutMe}</h3>
                    <textarea
                      name="details.bio"
                      rows="5"
                      className={`${styles.formControl} ${styles.textArea} ${errors.bio ? styles.borderDanger : ''}`}
                      value={profileData.details.bio || ""}
                      onChange={handleChange}
                      disabled={!isEditing}
                      maxLength={500}
                      placeholder={isEditing ? translations.tellAboutYourself : translations.noBioProvided}
                      aria-invalid={errors.bio ? "true" : "false"}
                      aria-describedby={errors.bio ? "bio-error" : undefined}
                    />
                    {errors.bio && (
                      <p id="bio-error" className={styles.errorMessage}>
                        <FaExclamationTriangle style={{ marginRight: "4px" }} />
                        {t(`errors.${errors.bio}`)}
                      </p>
                    )}
                    {isEditing && (
                      <div className={`${styles.textMuted} ${styles.textRight} ${styles.mt1}`}>
                        {profileData.details.bio ? profileData.details.bio.length : 0}/500
                      </div>
                    )}
                  </div>

                  <div className={styles.infoSection}>
                    <h3 className={styles.sectionTitle}>{translations.interests}</h3>
                    {isEditing && (
                      <div className={`${styles.textMuted} ${styles.mb2}`}>
                        {translations.interestsLimit}
                      </div>
                    )}
                    <div className={styles.interestsTags}>
                      {availableInterests.map((interest) => {
                        const isSelected = profileData.details.interests.includes(interest);
                        return (
                          <button
                            key={interest}
                            type="button"
                            className={`${styles.interestTag} ${isSelected ? styles.selected : ''}`}
                            onClick={() => isEditing && toggleInterest(interest)}
                            disabled={!isEditing || (!isSelected && profileData.details.interests.length >= 10)}
                            aria-pressed={isSelected}
                            aria-label={`${translations.interests}: ${interest}`}
                          >
                            {t(interest) || interest}
                            {isSelected && <FaCheck style={{ marginLeft: "4px" }} />}
                          </button>
                        );
                      })}
                    </div>
                    {profileData.details.interests.length === 0 && !isEditing && (
                      <p className={`${styles.textMuted} ${styles.fstItalic} ${styles.mt2}`}>{translations.noInterestsSelected}</p>
                    )}
                  </div>

                  <div className={styles.infoSection}>
                    <h3 className={styles.sectionTitle}>{translations.lookingFor || 'Looking For'}</h3>
                    {isEditing && (
                      <div className={`${styles.textMuted} ${styles.mb2}`}>
                        {translations.lookingForLimit || 'Select up to 3 options'}
                      </div>
                    )}
                    <div className={styles.interestsTags}>
                      {lookingForOptions.map((option) => {
                        const isSelected = profileData.details.lookingFor.includes(option);
                        // Gender-based styling
                        const identityClass =
                          option.toLowerCase().includes("women") || option.toLowerCase().includes("woman") ? styles["identity-woman"] :
                          option.toLowerCase().includes("men") || option.toLowerCase().includes("man") ? styles["identity-man"] :
                          option.toLowerCase().includes("couple") ? styles["identity-couple"] : "";

                        return (
                          <button
                            key={option}
                            type="button"
                            className={`${styles.interestTag} ${isSelected ? `${styles.selected} ${identityClass}` : identityClass}`}
                            onClick={() => isEditing && toggleLookingFor(option)}
                            disabled={
                              !isEditing ||
                              (!isSelected && profileData.details.lookingFor.length >= 3)
                            }
                            aria-pressed={isSelected}
                          >
                            {t(option) || option}
                            {isSelected && <FaCheck style={{ marginLeft: "4px" }} />}
                          </button>
                        );
                      })}
                    </div>
                    {profileData.details.lookingFor.length === 0 && !isEditing && (
                      <p className={`${styles.textMuted} ${styles.fstItalic} ${styles.mt2}`}>{translations.notSpecified}</p>
                    )}
                  </div>

                  <div className={styles.infoSection}>
                    <h3 className={styles.sectionTitle}>{translations.imInto}</h3>
                    {isEditing && (
                      <div className={`${styles.textMuted} ${styles.mb2}`}>
                        {translations.intoTagsLimit}
                      </div>
                    )}
                    <div className={styles.interestsTags}>
                      {intoTagsOptions.map((tag) => {
                        const isSelected = profileData.details.intoTags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            className={`${styles.interestTag} ${isSelected ? styles.selected : ""}`}
                            onClick={() => isEditing && toggleIntoTag(tag)}
                            disabled={
                              !isEditing ||
                              (!isSelected && profileData.details.intoTags.length >= 20)
                            }
                            aria-pressed={isSelected}
                          >
                            {t(tag) || tag}
                            {isSelected && <FaCheck style={{ marginLeft: "4px" }} />}
                          </button>
                        );
                      })}
                    </div>
                    {profileData.details.intoTags.length === 0 && !isEditing && (
                      <p className={`${styles.textMuted} ${styles.fstItalic} ${styles.mt2}`}>{translations.noTagsSelected}</p>
                    )}
                  </div>

                  <div className={styles.infoSection}>
                    <h3 className={styles.sectionTitle}>{translations.turnOns}</h3>
                    {isEditing && (
                      <div className={`${styles.textMuted} ${styles.mb2}`}>
                        {translations.turnOnsLimit}
                      </div>
                    )}
                    <div className={styles.interestsTags}>
                      {turnOnsOptions.map((tag) => {
                        const isSelected = profileData.details.turnOns.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            className={`${styles.interestTag} ${isSelected ? styles.selected : ""}`}
                            onClick={() => isEditing && toggleTurnOn(tag)}
                            disabled={
                              !isEditing ||
                              (!isSelected && profileData.details.turnOns.length >= 20)
                            }
                            aria-pressed={isSelected}
                          >
                            {t(tag) || tag}
                            {isSelected && <FaCheck style={{ marginLeft: "4px" }} />}
                          </button>
                        );
                      })}
                    </div>
                    {profileData.details.turnOns.length === 0 && !isEditing && (
                      <p className={`${styles.textMuted} ${styles.fstItalic} ${styles.mt2}`}>{translations.noTagsSelected}</p>
                    )}
                  </div>
                </form>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default Profile
