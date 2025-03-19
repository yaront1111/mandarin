

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
import { ThemeToggle } from "../components/theme-toggle.tsx"

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
        setProfileData({ ...profileData, [name]: value })
      }
    }
    // For all other inputs
    else {
      setProfileData({ ...profileData, [name]: value })
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
    if (!profileData.details.gender) {
      validationErrors.gender = "Gender is required"
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
      const firstErrorElement = document.querySelector(".error-message")
      if (firstErrorElement) {
        firstErrorElement.scrollIntoView({ behavior: "smooth", block: "center" })
      }
      return
    }
    setErrors({})
    setIsSubmitting(true)
    try {
      const submissionData = {
        nickname: profileData.nickname.trim(),
        details: {
          ...profileData.details,
          location: profileData.details.location.trim(),
          bio: profileData.details.bio ? profileData.details.bio.trim() : "",
          interests: Array.isArray(profileData.details.interests) ? profileData.details.interests : [],
        },
      }
      const updatedUser = await updateProfile(submissionData)
      if (updatedUser) {
        toast.success("Profile updated successfully")
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
        await refreshUserData()
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
      // Remove the temporary photo
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
        const response = await axios.get(`/api/users/${userId || "me"}`)
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

  // Replace the profile rendering with this
  return (
    <div className="modern-dashboard">
      {/* Header */}
      <header className="modern-header">
        <div className="container d-flex justify-content-between align-items-center">
          <div className="logo" style={{ cursor: "pointer" }} onClick={() => navigate("/dashboard")}>
            Mandarin
          </div>
          <div className="d-none d-md-flex main-tabs">
            <button className="tab-button" onClick={() => navigate("/dashboard")}>
              Dashboard
            </button>
            <button className="tab-button" onClick={() => navigate("/messages")}>
              Messages
            </button>
          </div>
          <div className="header-actions d-flex align-items-center">
            <ThemeToggle />
            {user?.photos?.[0] ? (
              <img
                src={user.photos[0].url || "/placeholder.svg?height=32&width=32"}
                alt={user.nickname}
                className="user-avatar"
                onClick={() => navigate("/profile")}
              />
            ) : (
              <FaUserCircle className="user-avatar" style={{ fontSize: "32px" }} onClick={() => navigate("/profile")} />
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-content">
        <div className="container" style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          {isLoading ? (
            <div className="text-center py-5">
              <div className="spinner spinner-large"></div>
              <p className="mt-3">Loading your profile...</p>
            </div>
          ) : (
            <>
              {/* Profile Photo Section */}
              <div className="profile-photo-section text-center">
                {localPhotos.length > 0 && profilePhotoIndex >= 0 ? (
                  <div style={{ position: "relative", display: "inline-block" }}>
                    <img
                      src={localPhotos[profilePhotoIndex].url || "/placeholder.svg?height=200&width=200"}
                      alt="Profile"
                      style={{
                        width: "200px",
                        height: "200px",
                        objectFit: "cover",
                        borderRadius: "50%",
                        boxShadow: "0 6px 16px rgba(0, 0, 0, 0.1)",
                        transition: "transform 0.3s ease",
                      }}
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
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: "100%",
                          borderRadius: "50%",
                          background: "rgba(255,255,255,0.7)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <div className="spinner"></div>
                      </div>
                    )}
                    {localPhotos[profilePhotoIndex].isPrivate && (
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: "100%",
                          borderRadius: "50%",
                          background: "rgba(0,0,0,0.4)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <FaLock style={{ fontSize: "32px", color: "#fff" }} />
                      </div>
                    )}
                    <div
                      style={{
                        position: "absolute",
                        bottom: "0",
                        left: "0",
                        width: "100%",
                        background: "rgba(0,0,0,0.6)",
                        color: "white",
                        padding: "4px",
                        fontSize: "12px",
                      }}
                    >
                      Profile Photo
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      width: "200px",
                      height: "200px",
                      borderRadius: "50%",
                      background: "#f0f0f0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto",
                    }}
                  >
                    <FaUserCircle style={{ fontSize: "80px", color: "#ccc" }} />
                  </div>
                )}

                {/* Photo Upload */}
                <div style={{ marginTop: "16px" }}>
                  {isUploading ? (
                    <div className="upload-progress-container" style={{ width: "200px", margin: "0 auto" }}>
                      <div className="progress mb-2" style={{ height: "8px" }}>
                        <div
                          className="progress-bar bg-primary"
                          role="progressbar"
                          style={{ width: `${uploadProgress}%` }}
                          aria-valuenow={uploadProgress}
                          aria-valuemin="0"
                          aria-valuemax="100"
                        ></div>
                      </div>
                      <div className="text-center">Uploading... {uploadProgress}%</div>
                    </div>
                  ) : (
                    <button
                      className="btn btn-outline"
                      onClick={triggerFileInput}
                      disabled={isProcessingPhoto}
                      aria-label="Add photo"
                    >
                      <FaCamera style={{ marginRight: "4px" }} /> Add Photo
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
                <div
                  className="photo-gallery"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
                    gap: "16px",
                  }}
                >
                  {localPhotos.map((photo) => (
                    <div
                      key={photo._id}
                      className="gallery-item"
                      style={{
                        position: "relative",
                        cursor: "pointer",
                        border: photo.isProfile ? "2px solid var(--primary)" : "2px solid transparent",
                        borderRadius: "8px",
                        overflow: "hidden",
                        transition: "transform 0.3s ease",
                        height: "100px",
                      }}
                      onClick={() => handleSetProfilePhoto(photo._id)}
                    >
                      <img
                        src={photo.url || "/placeholder.svg?height=100&width=100"}
                        alt={`Gallery`}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                      {photo.isLoading && (
                        <div
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: "100%",
                            background: "rgba(255,255,255,0.7)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <div className="spinner spinner-small"></div>
                        </div>
                      )}
                      <div
                        className="photo-controls"
                        style={{
                          position: "absolute",
                          bottom: "0",
                          left: "0",
                          right: "0",
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "4px",
                          background: "rgba(0,0,0,0.5)",
                        }}
                      >
                        <button
                          onClick={(e) => handleTogglePhotoPrivacy(photo._id, e)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "white",
                            cursor: "pointer",
                            padding: "2px",
                          }}
                          title={photo.isPrivate ? "Make public" : "Make private"}
                          disabled={isProcessingPhoto || photo.isLoading}
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
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "white",
                              cursor: "pointer",
                              padding: "2px",
                            }}
                            title="Set as profile photo"
                            disabled={isProcessingPhoto || photo.isLoading}
                            aria-label="Set as profile photo"
                          >
                            <FaStar style={{ fontSize: "14px" }} />
                          </button>
                        )}
                        {!photo.isProfile && (
                          <button
                            onClick={(e) => handleDeletePhoto(photo._id, e)}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "white",
                              cursor: "pointer",
                              padding: "2px",
                            }}
                            title="Delete photo"
                            disabled={isProcessingPhoto || photo.isLoading}
                            aria-label="Delete photo"
                          >
                            <FaTrash style={{ fontSize: "14px" }} />
                          </button>
                        )}
                      </div>
                      {photo.isProfile && (
                        <div
                          style={{
                            position: "absolute",
                            top: "0",
                            left: "0",
                            background: "var(--primary)",
                            color: "white",
                            fontSize: "10px",
                            padding: "2px 4px",
                            borderBottomRightRadius: "4px",
                          }}
                        >
                          Profile
                        </div>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="gallery-item add"
                    onClick={triggerFileInput}
                    disabled={isUploading || isProcessingPhoto}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#eaeaea",
                      border: "2px dashed #ccc",
                      borderRadius: "8px",
                      cursor: "pointer",
                      height: "100px",
                    }}
                    aria-label="Add new photo"
                  >
                    <FaCamera style={{ fontSize: "24px", color: "#555" }} />
                  </button>
                </div>
              )}

              {/* Profile Information Section - Now with better responsive layout */}
              <div className="profile-info">
                <div className="profile-header d-flex justify-content-between align-items-center flex-wrap">
                  <h2>My Profile</h2>
                  {!isEditing ? (
                    <button className="btn btn-primary" onClick={() => setIsEditing(true)} aria-label="Edit profile">
                      <FaEdit /> Edit
                    </button>
                  ) : (
                    <div className="d-flex" style={{ gap: "8px" }}>
                      <button
                        className="btn btn-outline"
                        onClick={handleCancelEdit}
                        disabled={isSubmitting}
                        aria-label="Cancel editing"
                      >
                        <FaTimes /> Cancel
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        aria-label="Save profile changes"
                      >
                        {isSubmitting ? (
                          <>
                            <span className="spinner spinner-dark"></span>
                            <span style={{ marginLeft: "8px" }}>Saving...</span>
                          </>
                        ) : (
                          <>
                            <FaCheck /> Save
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                <form className="mt-4" onSubmit={handleSubmit}>
                  <div className="info-section">
                    <h3>Basic Information</h3>
                    <div
                      className="info-grid"
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                        gap: "16px",
                      }}
                    >
                      <div className="form-group">
                        <label className="form-label" htmlFor="nickname">
                          Nickname
                        </label>
                        <input
                          type="text"
                          id="nickname"
                          name="nickname"
                          className={`form-control ${errors.nickname ? "border-danger" : ""}`}
                          value={profileData.nickname}
                          onChange={handleChange}
                          disabled={!isEditing}
                          maxLength={50}
                          aria-invalid={errors.nickname ? "true" : "false"}
                          aria-describedby={errors.nickname ? "nickname-error" : undefined}
                        />
                        {errors.nickname && (
                          <p id="nickname-error" className="error-message" style={{ color: "red", marginTop: "4px" }}>
                            <FaExclamationTriangle style={{ marginRight: "4px" }} />
                            {errors.nickname}
                          </p>
                        )}
                      </div>
                      <div className="form-group">
                        <label className="form-label" htmlFor="details.age">
                          Age
                        </label>
                        <input
                          type="number"
                          id="details.age"
                          name="details.age"
                          className={`form-control ${errors.age ? "border-danger" : ""}`}
                          value={profileData.details.age}
                          onChange={handleChange}
                          disabled={!isEditing}
                          min="18"
                          max="120"
                          aria-invalid={errors.age ? "true" : "false"}
                          aria-describedby={errors.age ? "age-error" : undefined}
                        />
                        {errors.age && (
                          <p id="age-error" className="error-message" style={{ color: "red", marginTop: "4px" }}>
                            <FaExclamationTriangle style={{ marginRight: "4px" }} />
                            {errors.age}
                          </p>
                        )}
                      </div>
                      <div className="form-group">
                        <label className="form-label" htmlFor="details.gender">
                          Gender
                        </label>
                        <select
                          id="details.gender"
                          name="details.gender"
                          className={`form-control ${errors.gender ? "border-danger" : ""}`}
                          value={profileData.details.gender}
                          onChange={handleChange}
                          disabled={!isEditing}
                          aria-invalid={errors.gender ? "true" : "false"}
                          aria-describedby={errors.gender ? "gender-error" : undefined}
                        >
                          <option value="">Select</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                        {errors.gender && (
                          <p id="gender-error" className="error-message" style={{ color: "red", marginTop: "4px" }}>
                            <FaExclamationTriangle style={{ marginRight: "4px" }} />
                            {errors.gender}
                          </p>
                        )}
                      </div>
                      <div className="form-group">
                        <label className="form-label" htmlFor="details.location">
                          Location
                        </label>
                        <input
                          type="text"
                          id="details.location"
                          name="details.location"
                          className={`form-control ${errors.location ? "border-danger" : ""}`}
                          value={profileData.details.location}
                          onChange={handleChange}
                          disabled={!isEditing}
                          maxLength={100}
                          aria-invalid={errors.location ? "true" : "false"}
                          aria-describedby={errors.location ? "location-error" : undefined}
                        />
                        {errors.location && (
                          <p id="location-error" className="error-message" style={{ color: "red", marginTop: "4px" }}>
                            <FaExclamationTriangle style={{ marginRight: "4px" }} />
                            {errors.location}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="info-section">
                    <h3>About Me</h3>
                    <textarea
                      name="details.bio"
                      rows="4"
                      className={`form-control ${errors.bio ? "border-danger" : ""}`}
                      value={profileData.details.bio || ""}
                      onChange={handleChange}
                      disabled={!isEditing}
                      style={{ resize: "vertical" }}
                      maxLength={500}
                      placeholder={isEditing ? "Tell others about yourself..." : "No bio provided"}
                      aria-invalid={errors.bio ? "true" : "false"}
                      aria-describedby={errors.bio ? "bio-error" : undefined}
                    />
                    {errors.bio && (
                      <p id="bio-error" className="error-message" style={{ color: "red", marginTop: "4px" }}>
                        <FaExclamationTriangle style={{ marginRight: "4px" }} />
                        {errors.bio}
                      </p>
                    )}
                    {isEditing && (
                      <div className="text-muted mt-1" style={{ fontSize: "0.8rem", textAlign: "right" }}>
                        {profileData.details.bio ? profileData.details.bio.length : 0}/500
                      </div>
                    )}
                  </div>

                  <div className="info-section">
                    <h3>Interests</h3>
                    {isEditing && (
                      <div className="text-muted mb-2" style={{ fontSize: "0.8rem" }}>
                        Select up to 10 interests
                      </div>
                    )}
                    <div className="interests-tags" style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {availableInterests.map((interest) => {
                        const isSelected = profileData.details.interests.includes(interest)
                        return (
                          <button
                            key={interest}
                            type="button"
                            className={`interest-tag ${isSelected ? "selected" : ""}`}
                            onClick={() => isEditing && toggleInterest(interest)}
                            disabled={!isEditing || (!isSelected && profileData.details.interests.length >= 10)}
                            style={{
                              padding: "4px 12px",
                              borderRadius: "20px",
                              backgroundColor: isSelected ? "var(--primary)" : "var(--light)",
                              color: isSelected ? "#fff" : "var(--text-medium)",
                              border: "none",
                              cursor: isEditing ? "pointer" : "default",
                              transition: "all 0.3s ease",
                            }}
                            aria-pressed={isSelected}
                            aria-label={`Interest: ${interest}`}
                          >
                            {interest}
                            {isSelected && <FaCheck style={{ marginLeft: "4px" }} />}
                          </button>
                        )
                      })}
                    </div>
                    {profileData.details.interests.length === 0 && !isEditing && (
                      <p className="text-muted fst-italic mt-2">No interests selected</p>
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
