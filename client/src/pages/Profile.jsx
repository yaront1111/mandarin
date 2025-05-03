"use client"

// client/src/pages/Profile.js
import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth, useUser, useLanguage } from "../context"
import { toast } from "react-toastify"
// Removed axios import in favor of apiService
import apiService from "../services/apiService.jsx"
import { useTranslation } from "react-i18next"
import { useIsMobile, useMobileDetect } from "../hooks"
import logger from "../utils/logger"
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
} from "react-icons/fa"
import { Navbar } from "../components/LayoutComponents"

// Import CSS module
import styles from "../styles/profile.module.css"

// Import the normalizePhotoUrl utility
import { normalizePhotoUrl } from "../utils/index.js"

// Create a named logger for this component
const log = logger.create("Profile")

const Profile = () => {
  
  const { user } = useAuth()
  const { updateProfile, uploadPhoto, refreshUserData } = useUser()
  const { t } = useTranslation()
  const { isRTL } = useLanguage()
  
  // Add mobile detection
  const isMobile = useIsMobile()
  const { isTouch, isIOS } = useMobileDetect()

  const [isEditing, setIsEditing] = useState(false)
  const [profileData, setProfileData] = useState({
    nickname: "",
    details: {
      age: "",
      gender: "",
      location: "",
      bio: "",
      interests: [],
      // Change back to iAm
      iAm: "",
      lookingFor: [],
      intoTags: [],
      turnOns: [],
      maritalStatus: "",
    },
  })
  const [localPhotos, setLocalPhotos] = useState([])
  const [profilePhotoIndex, setProfilePhotoIndex] = useState(0)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false)
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

  // New states for loading
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [profile, setProfile] = useState(null)
  const [userId, setUserId] = useState(null) // Assuming you might want to view other profiles
  const [likeLoading, setLikeLoading] = useState(false)
  const [messageLoading, setMessageLoading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [photoLoading, setPhotoLoading] = useState({})

  const isOwnProfile = !userId // Determine if it's the logged-in user's profile

  // Initialize profile state from user data.
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
          // Ensure these fields are properly read from user data
          iAm: user.details?.iAm || "",
          lookingFor: user.details?.lookingFor || [],
          intoTags: user.details?.intoTags || [],
          turnOns: user.details?.turnOns || [],
          maritalStatus: user.details?.maritalStatus || "",
        },
      })

      if (user.photos && user.photos.length > 0) {
        const photos = user.photos.map((photo) => ({
          ...photo,
          isPrivate: photo.isPrivate ?? false,
          isProfile: false,
        }))
        if (photos.length > 0) {
          photos[0].isProfile = true
          setProfilePhotoIndex(0)
        }
        setLocalPhotos(photos)
      } else {
        setLocalPhotos([])
        setProfilePhotoIndex(-1)
      }
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

  const [formData, setFormData] = useState({
    nickname: "",
    details: {
      age: "",
      gender: "",
      location: "",
      bio: "",
      interests: [],
    },
  })

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
      
      profileLogger.info("Submitting profile data:", submissionData)
      const updatedUser = await updateProfile(submissionData)
      
      if (updatedUser) {
        profileLogger.info("Profile updated successfully, refreshing user data...");
        
        try {
          // After successful update, force a refresh of user data
          const refreshResult = await refreshUserData(updatedUser._id);
          
          if (refreshResult) {
            profileLogger.info("User data refresh successful");
          } else {
            profileLogger.warn("User data refresh may not have been complete, but continuing");
          }
          
          toast.success(t('profile.profileUpdated'))
          setIsEditing(false)
        } catch (refreshError) {
          // Even if refresh fails, the profile was updated successfully
          profileLogger.warn("Failed to refresh user data, but profile was updated:", refreshError);
          toast.success(t('profile.profileUpdated'))
          toast.info(t('profile.refreshFailed'))
          setIsEditing(false)
        }
      } else {
        throw new Error(t('profile.updateFailed'))
      }
    } catch (error) {
      profileLogger.error("Failed to update profile:", error)
      toast.error(error.message || t('errors.profileUpdateFailed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  // Update the handlePhotoUpload function to fix race conditions and memory leaks
  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const fileType = file.type.split("/")[0]
    if (fileType !== "image") {
      toast.error(t('errors.uploadTypeMismatch'))
      return
    }
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      toast.error(t('errors.uploadSizeLimitExceeded'))
      return
    }
    setIsUploading(true)
    setUploadProgress(0)

    // Create a temporary ID for this upload
    const tempId = `temp-${Date.now()}`

    // Add a temporary photo with loading state
    setLocalPhotos((prev) => [
      ...prev,
      {
        _id: tempId,
        url: URL.createObjectURL(file),
        isPrivate: false,
        isProfile: false,
        isLoading: true,
      },
    ])

    try {
      const newPhoto = await uploadPhoto(file, false, (progress) => {
        setUploadProgress(progress)
      })

      if (newPhoto) {
        toast.success(t('profile.photoUploadSuccess'))

        // Clean up temporary photo before refreshing data
        setLocalPhotos((prev) => prev.filter((photo) => photo._id !== tempId))

        // Refresh user data to get the updated photos
        await refreshUserData(user?._id)

        // Reset upload progress and file input
        setUploadProgress(0)
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      } else {
        throw new Error(t('errors.photoUploadFailed'))
      }
    } catch (error) {
      log.error("Failed to upload photo:", error)
      toast.error(error.message || t('errors.photoUploadFailed'))

      // Remove the temporary photo on error
      setLocalPhotos((prev) => prev.filter((photo) => photo._id !== tempId))
    } finally {
      setIsUploading(false)
    }
  }
  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  const handleTogglePhotoPrivacy = async (photoId, e) => {
    e?.stopPropagation()
    if (isProcessingPhoto) return

    // Check if this is a temporary photo
    if (photoId.toString().startsWith("temp-")) {
      toast.warning(t('profile.uploading'))
      return
    }

    const photoIndex = localPhotos.findIndex((p) => p._id === photoId)
    if (photoIndex === -1) return
    const newPrivacyValue = !localPhotos[photoIndex].isPrivate
    setLocalPhotos((prev) =>
      prev.map((photo) => (photo._id === photoId ? { ...photo, isPrivate: newPrivacyValue } : photo)),
    )
    setIsProcessingPhoto(true)
    try {
      const data = await apiService.put(`/users/photos/${photoId}/privacy`, { 
        isPrivate: newPrivacyValue 
      })
      
      if (!data.success) {
        throw new Error(data.error || t('errors.photoPrivacyUpdateFailed'))
      }
      toast.success(t('profile.photoPrivacySuccess', { status: newPrivacyValue ? t('common.private') : t('common.public') }))
      await refreshUserData(user?._id)
    } catch (error) {
      log.error("Failed to update photo privacy:", error)
      toast.error(error.message || t('errors.photoPrivacyUpdateFailed'))
      setLocalPhotos((prev) =>
        prev.map((photo) => (photo._id === photoId ? { ...photo, isPrivate: !newPrivacyValue } : photo)),
      )
    } finally {
      setIsProcessingPhoto(false)
    }
  }

  const handleSetProfilePhoto = async (photoId) => {
    if (isProcessingPhoto) return

    // Check if this is a temporary photo
    if (photoId.toString().startsWith("temp-")) {
      toast.warning(t('profile.uploading'))
      return
    }

    const photoIndex = localPhotos.findIndex((p) => p._id === photoId)
    if (photoIndex === -1) return
    if (profilePhotoIndex === photoIndex) return

    setProfilePhotoIndex(photoIndex)
    setLocalPhotos((prev) =>
      prev.map((photo, index) => ({
        ...photo,
        isProfile: index === photoIndex,
      })),
    )
    setIsProcessingPhoto(true)
    try {
      const data = await apiService.put(`/users/photos/${photoId}/profile`, {})
      
      if (!data.success) {
        throw new Error(data.error || t('errors.profilePhotoUpdateFailed'))
      }
      toast.success(t('profile.profilePhotoUpdated'))
      await refreshUserData(user?._id)
    } catch (error) {
      log.error("Failed to set profile photo:", error)
      toast.error(error.message || t('errors.profilePhotoUpdateFailed'))
      const oldProfileIndex = localPhotos.findIndex((p) => p.isProfile)
      if (oldProfileIndex !== -1) {
        setProfilePhotoIndex(oldProfileIndex)
        setLocalPhotos((prev) =>
          prev.map((photo, index) => ({
            ...photo,
            isProfile: index === oldProfileIndex,
          })),
        )
      }
    } finally {
      setIsProcessingPhoto(false)
    }
  }

  const handleDeletePhoto = async (photoId, e) => {
    e?.stopPropagation()
    if (isProcessingPhoto) return

    // Check if this is a temporary photo
    if (photoId.toString().startsWith("temp-")) {
      // For temporary photos, just remove them from the local state
      setLocalPhotos((prev) => prev.filter((photo) => photo._id !== photoId))
      return
    }

    if (!window.confirm(t('profile.confirmDeletePhoto'))) return
    const photoIndex = localPhotos.findIndex((p) => p._id === photoId)
    if (photoIndex === -1) return
    if (localPhotos.length === 1) {
      toast.error(t('profile.cannotDeleteOnlyPhoto'))
      return
    }
    if (localPhotos[photoIndex].isProfile) {
      toast.error(t('profile.cannotDeleteProfilePhoto'))
      return
    }
    const updatedPhotos = localPhotos.filter((photo) => photo._id !== photoId)
    setLocalPhotos(updatedPhotos)
    if (photoIndex < profilePhotoIndex) {
      setProfilePhotoIndex(profilePhotoIndex - 1)
    }
    setIsProcessingPhoto(true)
    try {
      const data = await apiService.delete(`/users/photos/${photoId}`)
      
      if (!data.success) {
        throw new Error(data.error || t('errors.photoDeleteFailed'))
      }
      toast.success(t('profile.photoDeleteSuccess'))
      await refreshUserData(user?._id)
    } catch (error) {
      log.error("Failed to delete photo:", error)
      toast.error(error.message || t('errors.photoDeleteFailed'))
      await refreshUserData(user?._id)
    } finally {
      setIsProcessingPhoto(false)
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

  // Find where profile data is being loaded
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true)
        const token = sessionStorage.getItem("token")
        if (!token) {
          setError("Authentication required")
          setLoading(false)
          return
        }

        // Use the correct endpoint based on your API routes with apiService
        // If viewing own profile, use the current user endpoint
        const endpoint = userId ? `/users/${userId}` : `/users`

        // Use apiService instead of direct axios call
        const response = await apiService.get(endpoint)
        setProfile(response.data)
      } catch (error) {
        log.error("Failed to fetch profile:", error)
        setError("Could not load profile data")
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [userId])

  const handleLike = async () => {
    setLikeLoading(true)
    try {
      // Implement your like/unlike logic here
      // Example: await axios.post(`/api/users/${userId}/like`);
      // Update the profile state accordingly
      setProfile((prevProfile) => ({
        ...prevProfile,
        isLiked: !prevProfile.isLiked,
      }))
    } catch (error) {
      log.error("Failed to like/unlike profile:", error)
      toast.error("Failed to like/unlike profile")
    } finally {
      setLikeLoading(false)
    }
  }

  const handleMessage = async () => {
    setMessageLoading(true)
    try {
      // Implement your message logic here
      // Example: navigate(`/messages/${userId}`);
      navigate("/messages") // Redirect to messages for now
    } catch (error) {
      log.error("Failed to navigate to messages:", error)
      toast.error("Failed to navigate to messages")
    } finally {
      setMessageLoading(false)
    }
  }

  const handleProfilePhotoUpload = () => {
    // Implement your profile photo upload logic here
    log.debug("Profile photo upload clicked")
  }

  const handleCoverPhotoUpload = () => {
    // Implement your cover photo upload logic here
    log.debug("Cover photo upload clicked")
  }

  // Update the getProfilePhoto function to use the normalizePhotoUrl utility
  const getProfilePhoto = () => {
    if (!user || !user.photos || user.photos.length === 0) {
      return "/placeholder.svg"
    }
    return normalizePhotoUrl(user.photos[0].url)
  }

  // Replace the profile rendering with this
  return (
    <div className={`${styles.profilePage} min-vh-100 w-100 overflow-hidden bg-light-subtle transition-all ${isRTL ? 'rtl-layout' : ''} ${isMobile ? 'mobile-device' : ''}`}>
      {/* Use Navbar from LayoutComponents */}
      <Navbar />

      {/* Main Content */}
      <main className={`${styles.dashboardContent} py-5`}>
        <div className="container max-w-xl mx-auto px-4 d-flex flex-column gap-5">
          {isLoading ? (
            <div className="d-flex flex-column align-items-center justify-content-center py-5 text-center">
              <div className={`${styles.spinner} ${styles.spinnerLarge} text-primary mb-4`}></div>
              <p className="text-opacity-70 font-weight-medium">{t('profile.loadingProfile')}</p>
            </div>
          ) : (
            <>
              {/* Profile Photo Section */}
              <div className={`${styles.photoSection} text-center bg-white shadow-lg rounded-lg border py-4 transform-gpu hover-shadow-xl transition-all`}>
                {localPhotos.length > 0 && profilePhotoIndex >= 0 ? (
                  <div className={`${styles.profilePhotoWrapper} position-relative d-inline-block`}>
                    <img
                      src={localPhotos[profilePhotoIndex].url || "/placeholder.svg?height=200&width=200"}
                      alt={t('profile.profilePhoto')}
                      className={`${styles.profilePhoto} w-300px h-300px object-cover rounded-circle shadow-lg border-4 border-white transform-gpu transition-transform hover-scale`}
                      onLoad={() => {
                        // Clear loading state when image loads
                        if (localPhotos[profilePhotoIndex]?.isLoading) {
                          setLocalPhotos((prev) =>
                            prev.map((photo, idx) =>
                              idx === profilePhotoIndex ? { ...photo, isLoading: false } : photo,
                            ),
                          )
                        }
                      }}
                    />
                    {localPhotos[profilePhotoIndex]?.isLoading && (
                      <div className="position-absolute top-0 left-0 w-100 h-100 rounded-circle d-flex align-items-center justify-content-center bg-overlay-light">
                        <div className={`${styles.spinner} ${styles.spinnerLarge}`}></div>
                      </div>
                    )}
                    {localPhotos[profilePhotoIndex].isPrivate && (
                      <div className="position-absolute top-0 left-0 w-100 h-100 rounded-circle d-flex align-items-center justify-content-center bg-overlay-dark">
                        <FaLock className="text-3xl text-white" />
                      </div>
                    )}
                    <div className="position-absolute bottom-0 left-0 w-100 py-1 bg-overlay-dark text-white text-xs rounded-bottom-circle">
                      {t('profile.profilePhoto')}
                    </div>
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
                      <div className="text-center text-opacity-70">{t('profile.uploading')} {uploadProgress}%</div>
                    </div>
                  ) : (
                    <button
                      className="btn btn-outline-primary rounded-pill d-inline-flex align-items-center gap-2 hover-scale shadow-sm transition-all px-4 py-2"
                      onClick={triggerFileInput}
                      disabled={isProcessingPhoto}
                      aria-label={t('profile.addPhoto')}
                    >
                      <FaCamera /> <span>{t('profile.addPhoto')}</span>
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

              {/* Photo Gallery Section - With mobile optimization */}
              {localPhotos.length > 0 && (
                <div className={`${styles.photoGallery} ${isMobile ? 'mobile-gallery' : ''}`}>
                  {localPhotos.map((photo) => (
                    <div
                      key={photo._id}
                      className={`${styles.galleryItem} ${photo.isProfile ? styles.profileGalleryItem : ''} ${isMobile ? 'touch-item' : ''}`}
                      style={{
                        cursor: photo._id.toString().startsWith("temp-") ? "not-allowed" : "pointer",
                      }}
                      onClick={() => handleSetProfilePhoto(photo._id)}
                    >
                      <img
                        src={photo.url || "/placeholder.svg?height=100&width=100"}
                        alt={t('profile.profilePhoto')}
                        className={styles.galleryImage}
                      />
                      {photo.isLoading && (
                        <div className={styles.galleryItemLoading}>
                          <div className={`${styles.spinner} ${styles.spinnerSmall}`}></div>
                        </div>
                      )}
                      {photo._id.toString().startsWith("temp-") && (
                        <div className={styles.galleryItemUploading}>
                          {t('profile.uploading')}
                        </div>
                      )}
                      <div className={styles.photoControls}>
                        <button
                          onClick={(e) => handleTogglePhotoPrivacy(photo._id, e)}
                          className={styles.photoControlBtn}
                          title={photo.isPrivate ? t('profile.makePublic') : t('profile.makePrivate')}
                          disabled={isProcessingPhoto || photo.isLoading || photo._id.toString().startsWith("temp-")}
                          aria-label={photo.isPrivate ? t('profile.makePublic') : t('profile.makePrivate')}
                        >
                          {photo.isPrivate ? (
                            <FaLock style={{ fontSize: "14px" }} />
                          ) : (
                            <FaLockOpen style={{ fontSize: "14px" }} />
                          )}
                        </button>
                        {!photo.isProfile && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSetProfilePhoto(photo._id)
                            }}
                            className={styles.photoControlBtn}
                            title={t('profile.setAsProfilePhoto')}
                            disabled={isProcessingPhoto || photo.isLoading || photo._id.toString().startsWith("temp-")}
                            aria-label={t('profile.setAsProfilePhoto')}
                          >
                            <FaStar style={{ fontSize: "14px" }} />
                          </button>
                        )}
                        {!photo.isProfile && (
                          <button
                            onClick={(e) => handleDeletePhoto(photo._id, e)}
                            className={styles.photoControlBtn}
                            title={t('profile.deletePhoto')}
                            disabled={isProcessingPhoto || photo.isLoading}
                            aria-label={t('profile.deletePhoto')}
                          >
                            <FaTrash style={{ fontSize: "14px" }} />
                          </button>
                        )}
                      </div>
                      {photo.isProfile && (
                        <div className={styles.profileBadge}>
                          {t('profile.profilePhoto')}
                        </div>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className={styles.addPhotoItem}
                    onClick={triggerFileInput}
                    disabled={isUploading || isProcessingPhoto}
                    aria-label={t('profile.addPhoto')}
                  >
                    <FaCamera style={{ fontSize: "24px", color: "#555" }} />
                  </button>
                </div>
              )}

              {/* Profile Information Section - Enhanced with utility classes */}
              <div className={styles.profileInfo}>
                <div className={styles.profileHeader}>
                  <h2 className={styles.profileTitle}>{t('profile.myProfile')}</h2>
                  {!isEditing ? (
                    <button 
                      className={`${styles.btn} ${styles.btnPrimary}`}
                      onClick={() => setIsEditing(true)} 
                      aria-label={t('profile.edit')}
                    >
                      <FaEdit /> <span>{t('profile.edit')}</span>
                    </button>
                  ) : (
                    <div className={`${styles.flexDisplay} ${styles.gap2}`}>
                      <button
                        className={`${styles.btn} ${styles.btnOutline}`}
                        onClick={handleCancelEdit}
                        disabled={isSubmitting}
                        aria-label={t('profile.cancel')}
                      >
                        <FaTimes /> <span>{t('profile.cancel')}</span>
                      </button>
                      <button
                        className={`${styles.btn} ${styles.btnPrimary}`}
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        aria-label={t('profile.save')}
                      >
                        {isSubmitting ? (
                          <>
                            <span className={`${styles.spinner} ${styles.spinnerDark}`}></span>
                            <span>{t('profile.saving')}</span>
                          </>
                        ) : (
                          <>
                            <FaCheck /> <span>{t('profile.save')}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                <form className="mt-4" onSubmit={handleSubmit}>
                  <div className={`${styles.infoSection} animate-fade-in`}>
                    <h3 className={styles.sectionTitle}>{t('profile.basicInformation')}</h3>
                    <div className={styles.infoGrid}>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel} htmlFor="nickname">
                          {t('profile.nickname')}
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
                          {t('profile.age')}
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
                          {t('profile.location')}
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
                      <label className={styles.formLabel}>{t('profile.iAmA')}</label>
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
                              {t(`profile_${option}`)}
                              {profileData.details.iAm === option && <FaCheck style={{ marginLeft: "4px" }} />}
                            </button>
                          );
                        })}
                      </div>
                      {!profileData.details.iAm && !isEditing && (
                        <p className={`${styles.textMuted} ${styles.fstItalic} ${styles.mt2}`}>{t('profile.notSpecified')}</p>
                      )}
                    </div>
                    
                    <div className={styles.mt4}>
                      <label className={styles.formLabel}>{t('profile.maritalStatus')}</label>
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
                            {status.toLowerCase() === "married" ? t('profile.maritalStatusMarried') : status}
                            {profileData.details.maritalStatus === status && <FaCheck style={{ marginLeft: "4px" }} />}
                          </button>
                        ))}
                      </div>
                      {!profileData.details.maritalStatus && !isEditing && (
                        <p className={`${styles.textMuted} ${styles.fstItalic} ${styles.mt2}`}>{t('profile.notSpecified')}</p>
                      )}
                    </div>
                  </div>

                  <div className={styles.infoSection}>
                    <h3 className={styles.sectionTitle}>{t('profile.aboutMe')}</h3>
                    <textarea
                      name="details.bio"
                      rows="5"
                      className={`${styles.formControl} ${styles.textArea} ${errors.bio ? styles.borderDanger : ''}`}
                      value={profileData.details.bio || ""}
                      onChange={handleChange}
                      disabled={!isEditing}
                      maxLength={500}
                      placeholder={isEditing ? t('profile.tellAboutYourself') : t('profile.noBioProvided')}
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
                    <h3 className={styles.sectionTitle}>{t('profile.interests')}</h3>
                    {isEditing && (
                      <div className={`${styles.textMuted} ${styles.mb2}`}>
                        {t('profile.interestsLimit')}
                      </div>
                    )}
                    <div className={styles.interestsTags}>
                      {availableInterests.map((interest) => {
                        const isSelected = profileData.details.interests.includes(interest);
                        return (
                          <button
                            key={interest}
                            type="button"
                            className={`${styles.interestTag} ${isSelected ? styles.selected : ''} ${isMobile ? 'touch-target' : ''}`}
                            onClick={() => isEditing && toggleInterest(interest)}
                            disabled={!isEditing || (!isSelected && profileData.details.interests.length >= 10)}
                            aria-pressed={isSelected}
                            aria-label={`${t('profile.interests')}: ${interest}`}
                          >
                            {interest}
                            {isSelected && <FaCheck style={{ marginLeft: "4px" }} />}
                          </button>
                        );
                      })}
                    </div>
                    {profileData.details.interests.length === 0 && !isEditing && (
                      <p className={`${styles.textMuted} ${styles.fstItalic} ${styles.mt2}`}>{t('profile.noInterestsSelected')}</p>
                    )}
                  </div>

                  <div className={styles.infoSection}>
                    <h3 className={styles.sectionTitle}>{t('profile.lookingFor')}</h3>
                    {isEditing && (
                      <div className={`${styles.textMuted} ${styles.mb2}`}>
                        {t('profile.lookingForLimit')}
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
                            {t(`profile_${option}`)}
                            {isSelected && <FaCheck style={{ marginLeft: "4px" }} />}
                          </button>
                        );
                      })}
                    </div>
                    {profileData.details.lookingFor.length === 0 && !isEditing && (
                      <p className={`${styles.textMuted} ${styles.fstItalic} ${styles.mt2}`}>{t('profile.notSpecified')}</p>
                    )}
                  </div>

                  <div className={styles.infoSection}>
                    <h3 className={styles.sectionTitle}>{t('profile.imInto')}</h3>
                    {isEditing && (
                      <div className={`${styles.textMuted} ${styles.mb2}`}>
                        {t('profile.intoTagsLimit')}
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
                            {tag}
                            {isSelected && <FaCheck style={{ marginLeft: "4px" }} />}
                          </button>
                        );
                      })}
                    </div>
                    {profileData.details.intoTags.length === 0 && !isEditing && (
                      <p className={`${styles.textMuted} ${styles.fstItalic} ${styles.mt2}`}>{t('profile.noTagsSelected')}</p>
                    )}
                  </div>

                  <div className={styles.infoSection}>
                    <h3 className={styles.sectionTitle}>{t('profile.turnOns')}</h3>
                    {isEditing && (
                      <div className={`${styles.textMuted} ${styles.mb2}`}>
                        {t('profile.turnOnsLimit')}
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
                            {tag}
                            {isSelected && <FaCheck style={{ marginLeft: "4px" }} />}
                          </button>
                        );
                      })}
                    </div>
                    {profileData.details.turnOns.length === 0 && !isEditing && (
                      <p className={`${styles.textMuted} ${styles.fstItalic} ${styles.mt2}`}>{t('profile.noTagsSelected')}</p>
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
