"use client"

// client/src/pages/Profile.js
import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth, useUser } from "../context"
import { toast } from "react-toastify"
import axios from "axios"
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

const Profile = () => {
  const { user } = useAuth()
  const { updateProfile, uploadPhoto, refreshUserData } = useUser()

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
      validationErrors.nickname = "Nickname is required"
    } else if (profileData.nickname.length < 3) {
      validationErrors.nickname = "Nickname must be at least 3 characters"
    } else if (profileData.nickname.length > 50) {
      validationErrors.nickname = "Nickname cannot exceed 50 characters"
    }
    if (!profileData.details.age && profileData.details.age !== 0) {
      validationErrors.age = "Age is required"
    } else if (isNaN(profileData.details.age)) {
      validationErrors.age = "Age must be a number"
    } else if (profileData.details.age < 18) {
      validationErrors.age = "You must be at least 18 years old"
    } else if (profileData.details.age > 120) {
      validationErrors.age = "Please enter a valid age"
    }
    if (!profileData.details.location.trim()) {
      validationErrors.location = "Location is required"
    } else if (profileData.details.location.length < 2) {
      validationErrors.location = "Location must be at least 2 characters"
    }
    if (profileData.details.bio && profileData.details.bio.length > 500) {
      validationErrors.bio = "Bio cannot exceed 500 characters"
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
      
      console.log("Submitting profile data:", submissionData)
      const updatedUser = await updateProfile(submissionData)
      
      if (updatedUser) {
        console.log("Profile updated successfully, refreshing user data...");
        
        // After successful update, force a refresh of user data and wait for it to complete
        const refreshResult = await refreshUserData(updatedUser._id);
        
        if (refreshResult) {
          console.log("User data refresh successful");
        } else {
          console.warn("User data refresh may not have been complete, but continuing");
        }

        setIsEditing(false)
      } else {
        throw new Error("Failed to update profile")
      }
    } catch (error) {
      console.error("Failed to update profile:", error)
      toast.error(error.message || "Failed to update profile. Please try again.")
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
      toast.error("Please upload an image file")
      return
    }
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      toast.error("Image size should be less than 5MB")
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
        toast.success("Photo uploaded successfully")

        // Clean up temporary photo before refreshing data
        setLocalPhotos((prev) => prev.filter((photo) => photo._id !== tempId))

        // Refresh user data to get the updated photos
        await refreshUserData()

        // Reset upload progress and file input
        setUploadProgress(0)
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      } else {
        throw new Error("Failed to upload photo")
      }
    } catch (error) {
      console.error("Failed to upload photo:", error)
      toast.error(error.message || "Failed to upload photo. Please try again.")

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
      toast.warning("Please wait for the upload to complete before changing privacy settings")
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
      const response = await fetch(`/api/users/photos/${photoId}/privacy`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionStorage.getItem("token")}`,
        },
        body: JSON.stringify({ isPrivate: newPrivacyValue }),
      })
      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || "Failed to update photo privacy")
      }
      toast.success(`Photo is now ${newPrivacyValue ? "private" : "public"}`)
      await refreshUserData()
    } catch (error) {
      console.error("Failed to update photo privacy:", error)
      toast.error(error.message || "Failed to update privacy setting")
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
      toast.warning("Please wait for the upload to complete before setting as profile photo")
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
      const response = await fetch(`/api/users/photos/${photoId}/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionStorage.getItem("token")}`,
        },
      })
      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || "Failed to set profile photo")
      }
      toast.success("Profile photo updated")
      await refreshUserData()
    } catch (error) {
      console.error("Failed to set profile photo:", error)
      toast.error(error.message || "Failed to set profile photo")
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

    if (!window.confirm("Are you sure you want to delete this photo?")) return
    const photoIndex = localPhotos.findIndex((p) => p._id === photoId)
    if (photoIndex === -1) return
    if (localPhotos.length === 1) {
      toast.error("You cannot delete your only photo")
      return
    }
    if (localPhotos[photoIndex].isProfile) {
      toast.error("You cannot delete your profile photo. Please set another photo as profile first.")
      return
    }
    const updatedPhotos = localPhotos.filter((photo) => photo._id !== photoId)
    setLocalPhotos(updatedPhotos)
    if (photoIndex < profilePhotoIndex) {
      setProfilePhotoIndex(profilePhotoIndex - 1)
    }
    setIsProcessingPhoto(true)
    try {
      const response = await fetch(`/api/users/photos/${photoId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem("token")}`,
        },
      })
      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || "Failed to delete photo")
      }
      toast.success("Photo deleted")
      await refreshUserData()
    } catch (error) {
      console.error("Failed to delete photo:", error)
      toast.error(error.message || "Failed to delete photo")
      await refreshUserData()
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

        // Use the correct endpoint based on your API routes
        // If viewing own profile, use the current user endpoint
        const endpoint = userId ? `/api/users/${userId}` : `/api/users`

        const response = await axios.get(endpoint, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        setProfile(response.data)
      } catch (error) {
        console.error("Failed to fetch profile:", error)
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
      console.error("Failed to like/unlike profile:", error)
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
      console.error("Failed to navigate to messages:", error)
      toast.error("Failed to navigate to messages")
    } finally {
      setMessageLoading(false)
    }
  }

  const handleProfilePhotoUpload = () => {
    // Implement your profile photo upload logic here
    console.log("Profile photo upload clicked")
  }

  const handleCoverPhotoUpload = () => {
    // Implement your cover photo upload logic here
    console.log("Cover photo upload clicked")
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
    <div className={`${styles.profilePage} min-vh-100 w-100 overflow-hidden bg-light-subtle transition-all`}>
      {/* Use Navbar from LayoutComponents */}
      <Navbar />

      {/* Main Content */}
      <main className={`${styles.dashboardContent} py-5`}>
        <div className="container max-w-xl mx-auto px-4 d-flex flex-column gap-5">
          {isLoading ? (
            <div className="d-flex flex-column align-items-center justify-content-center py-5 text-center">
              <div className={`${styles.spinner} ${styles.spinnerLarge} text-primary mb-4`}></div>
              <p className="text-opacity-70 font-weight-medium">Loading your profile...</p>
            </div>
          ) : (
            <>
              {/* Profile Photo Section */}
              <div className={`${styles.photoSection} text-center bg-white shadow-lg rounded-lg border py-4 transform-gpu hover-shadow-xl transition-all`}>
                {localPhotos.length > 0 && profilePhotoIndex >= 0 ? (
                  <div className={`${styles.profilePhotoWrapper} position-relative d-inline-block`}>
                    <img
                      src={localPhotos[profilePhotoIndex].url || "/placeholder.svg?height=200&width=200"}
                      alt="Profile"
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
                      Profile Photo
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
                      <div className="text-center text-opacity-70">Uploading... {uploadProgress}%</div>
                    </div>
                  ) : (
                    <button
                      className="btn btn-outline-primary rounded-pill d-inline-flex align-items-center gap-2 hover-scale shadow-sm transition-all px-4 py-2"
                      onClick={triggerFileInput}
                      disabled={isProcessingPhoto}
                      aria-label="Add photo"
                    >
                      <FaCamera /> <span>Add Photo</span>
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

              {/* Photo Gallery Section - Now with responsive grid */}
              {localPhotos.length > 0 && (
                <div className={styles.photoGallery}>
                  {localPhotos.map((photo) => (
                    <div
                      key={photo._id}
                      className={`${styles.galleryItem} ${photo.isProfile ? styles.profileGalleryItem : ''}`}
                      style={{
                        cursor: photo._id.toString().startsWith("temp-") ? "not-allowed" : "pointer",
                      }}
                      onClick={() => handleSetProfilePhoto(photo._id)}
                    >
                      <img
                        src={photo.url || "/placeholder.svg?height=100&width=100"}
                        alt={`Gallery`}
                        className={styles.galleryImage}
                      />
                      {photo.isLoading && (
                        <div className={styles.galleryItemLoading}>
                          <div className={`${styles.spinner} ${styles.spinnerSmall}`}></div>
                        </div>
                      )}
                      {photo._id.toString().startsWith("temp-") && (
                        <div className={styles.galleryItemUploading}>
                          Uploading...
                        </div>
                      )}
                      <div className={styles.photoControls}>
                        <button
                          onClick={(e) => handleTogglePhotoPrivacy(photo._id, e)}
                          className={styles.photoControlBtn}
                          title={photo.isPrivate ? "Make public" : "Make private"}
                          disabled={isProcessingPhoto || photo.isLoading || photo._id.toString().startsWith("temp-")}
                          aria-label={photo.isPrivate ? "Make photo public" : "Make photo private"}
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
                            title="Set as profile photo"
                            disabled={isProcessingPhoto || photo.isLoading || photo._id.toString().startsWith("temp-")}
                            aria-label="Set as profile photo"
                          >
                            <FaStar style={{ fontSize: "14px" }} />
                          </button>
                        )}
                        {!photo.isProfile && (
                          <button
                            onClick={(e) => handleDeletePhoto(photo._id, e)}
                            className={styles.photoControlBtn}
                            title="Delete photo"
                            disabled={isProcessingPhoto || photo.isLoading}
                            aria-label="Delete photo"
                          >
                            <FaTrash style={{ fontSize: "14px" }} />
                          </button>
                        )}
                      </div>
                      {photo.isProfile && (
                        <div className={styles.profileBadge}>
                          Profile
                        </div>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className={styles.addPhotoItem}
                    onClick={triggerFileInput}
                    disabled={isUploading || isProcessingPhoto}
                    aria-label="Add new photo"
                  >
                    <FaCamera style={{ fontSize: "24px", color: "#555" }} />
                  </button>
                </div>
              )}

              {/* Profile Information Section - Enhanced with utility classes */}
              <div className={styles.profileInfo}>
                <div className={styles.profileHeader}>
                  <h2 className={styles.profileTitle}>My Profile</h2>
                  {!isEditing ? (
                    <button 
                      className={`${styles.btn} ${styles.btnPrimary}`}
                      onClick={() => setIsEditing(true)} 
                      aria-label="Edit profile"
                    >
                      <FaEdit /> <span>Edit</span>
                    </button>
                  ) : (
                    <div className={`${styles.flexDisplay} ${styles.gap2}`}>
                      <button
                        className={`${styles.btn} ${styles.btnOutline}`}
                        onClick={handleCancelEdit}
                        disabled={isSubmitting}
                        aria-label="Cancel editing"
                      >
                        <FaTimes /> <span>Cancel</span>
                      </button>
                      <button
                        className={`${styles.btn} ${styles.btnPrimary}`}
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        aria-label="Save profile changes"
                      >
                        {isSubmitting ? (
                          <>
                            <span className={`${styles.spinner} ${styles.spinnerDark}`}></span>
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <FaCheck /> <span>Save</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                <form className="mt-4" onSubmit={handleSubmit}>
                  <div className={`${styles.infoSection} animate-fade-in`}>
                    <h3 className={styles.sectionTitle}>Basic Information</h3>
                    <div className={styles.infoGrid}>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel} htmlFor="nickname">
                          Nickname
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
                            {errors.nickname}
                          </p>
                        )}
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel} htmlFor="details.age">
                          Age
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
                            {errors.age}
                          </p>
                        )}
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel} htmlFor="details.location">
                          Location
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
                            {errors.location}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className={styles.mt4}>
                      <label className={styles.formLabel}>I am a</label>
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
                              {option.charAt(0).toUpperCase() + option.slice(1)}
                              {profileData.details.iAm === option && <FaCheck style={{ marginLeft: "4px" }} />}
                            </button>
                          );
                        })}
                      </div>
                      {!profileData.details.iAm && !isEditing && (
                        <p className={`${styles.textMuted} ${styles.fstItalic} ${styles.mt2}`}>Not specified</p>
                      )}
                    </div>
                    
                    <div className={styles.mt4}>
                      <label className={styles.formLabel}>Marital Status</label>
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
                            {status}
                            {profileData.details.maritalStatus === status && <FaCheck style={{ marginLeft: "4px" }} />}
                          </button>
                        ))}
                      </div>
                      {!profileData.details.maritalStatus && !isEditing && (
                        <p className={`${styles.textMuted} ${styles.fstItalic} ${styles.mt2}`}>Not specified</p>
                      )}
                    </div>
                  </div>

                  <div className={styles.infoSection}>
                    <h3 className={styles.sectionTitle}>About Me</h3>
                    <textarea
                      name="details.bio"
                      rows="5"
                      className={`${styles.formControl} ${styles.textArea} ${errors.bio ? styles.borderDanger : ''}`}
                      value={profileData.details.bio || ""}
                      onChange={handleChange}
                      disabled={!isEditing}
                      maxLength={500}
                      placeholder={isEditing ? "Tell others about yourself..." : "No bio provided"}
                      aria-invalid={errors.bio ? "true" : "false"}
                      aria-describedby={errors.bio ? "bio-error" : undefined}
                    />
                    {errors.bio && (
                      <p id="bio-error" className={styles.errorMessage}>
                        <FaExclamationTriangle style={{ marginRight: "4px" }} />
                        {errors.bio}
                      </p>
                    )}
                    {isEditing && (
                      <div className={`${styles.textMuted} ${styles.textRight} ${styles.mt1}`}>
                        {profileData.details.bio ? profileData.details.bio.length : 0}/500
                      </div>
                    )}
                  </div>

                  <div className={styles.infoSection}>
                    <h3 className={styles.sectionTitle}>Interests</h3>
                    {isEditing && (
                      <div className={`${styles.textMuted} ${styles.mb2}`}>
                        Select up to 10 interests
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
                            aria-label={`Interest: ${interest}`}
                          >
                            {interest}
                            {isSelected && <FaCheck style={{ marginLeft: "4px" }} />}
                          </button>
                        );
                      })}
                    </div>
                    {profileData.details.interests.length === 0 && !isEditing && (
                      <p className={`${styles.textMuted} ${styles.fstItalic} ${styles.mt2}`}>No interests selected</p>
                    )}
                  </div>

                  <div className={styles.infoSection}>
                    <h3 className={styles.sectionTitle}>Looking For</h3>
                    {isEditing && (
                      <div className={`${styles.textMuted} ${styles.mb2}`}>
                        Select up to 3 options
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
                            {option.charAt(0).toUpperCase() + option.slice(1)}
                            {isSelected && <FaCheck style={{ marginLeft: "4px" }} />}
                          </button>
                        );
                      })}
                    </div>
                    {profileData.details.lookingFor.length === 0 && !isEditing && (
                      <p className={`${styles.textMuted} ${styles.fstItalic} ${styles.mt2}`}>Not specified</p>
                    )}
                  </div>

                  <div className={styles.infoSection}>
                    <h3 className={styles.sectionTitle}>I'm Into</h3>
                    {isEditing && (
                      <div className={`${styles.textMuted} ${styles.mb2}`}>
                        Select up to 20 tags
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
                      <p className={`${styles.textMuted} ${styles.fstItalic} ${styles.mt2}`}>No tags selected</p>
                    )}
                  </div>

                  <div className={styles.infoSection}>
                    <h3 className={styles.sectionTitle}>It Turns Me On</h3>
                    {isEditing && (
                      <div className={`${styles.textMuted} ${styles.mb2}`}>
                        Select up to 20 tags
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
                      <p className={`${styles.textMuted} ${styles.fstItalic} ${styles.mt2}`}>No tags selected</p>
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
