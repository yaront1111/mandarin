"use client"

// client/src/pages/Profile.js
import { useState, useEffect, useRef } from "react"
import {
  FaCamera,
  FaEdit,
  FaCheck,
  FaTimes,
  FaUserCircle,
  FaLock,
  FaLockOpen,
  FaTrash,
  FaStar,
  FaExclamationTriangle,
} from "react-icons/fa"
import { useNavigate } from "react-router-dom"
import { useAuth, useUser } from "../context"
import { toast } from "react-toastify"
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

  // Initialize profile state from user data.
  useEffect(() => {
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
                src={user.photos[0].url || "/placeholder.svg"}
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
          {/* Profile Photo Section */}
          <div className="profile-photo-section text-center">
            {localPhotos.length > 0 && profilePhotoIndex >= 0 ? (
              <div style={{ position: "relative", display: "inline-block" }}>
                <img
                  src={localPhotos[profilePhotoIndex].url || "/placeholder.svg"}
                  alt="Profile"
                  style={{
                    width: "200px",
                    height: "200px",
                    objectFit: "cover",
                    borderRadius: "50%",
                    boxShadow: "0 6px 16px rgba(0, 0, 0, 0.1)",
                    transition: "transform 0.3s ease",
                  }}
                />
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
                <button className="btn btn-outline" onClick={triggerFileInput} disabled={isProcessingPhoto}>
                  <FaCamera style={{ marginRight: "4px" }} /> Add Photo
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handlePhotoUpload}
                    accept="image/*"
                    style={{ display: "none" }}
                  />
                </button>
              )}
            </div>
          </div>

          {/* Photo Gallery Section */}
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
                    src={photo.url || "/placeholder.svg"}
                    alt={`Gallery`}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
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
                      disabled={isProcessingPhoto}
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
                        disabled={isProcessingPhoto}
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
                        disabled={isProcessingPhoto}
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
              >
                <FaCamera style={{ fontSize: "24px", color: "#555" }} />
              </button>
            </div>
          )}

          {/* Profile Information Section */}
          <div className="profile-info">
            <div className="profile-header d-flex justify-content-between align-items-center">
              <h2>My Profile</h2>
              {!isEditing ? (
                <button className="btn btn-primary" onClick={() => setIsEditing(true)}>
                  <FaEdit /> Edit
                </button>
              ) : (
                <div className="d-flex" style={{ gap: "8px" }}>
                  <button className="btn btn-outline" onClick={handleCancelEdit} disabled={isSubmitting}>
                    <FaTimes /> Cancel
                  </button>
                  <button className="btn btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
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
                <div className="info-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
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
                    />
                    {errors.nickname && (
                      <p className="error-message" style={{ color: "red", marginTop: "4px" }}>
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
                    />
                    {errors.age && (
                      <p className="error-message" style={{ color: "red", marginTop: "4px" }}>
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
                    >
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                    {errors.gender && (
                      <p className="error-message" style={{ color: "red", marginTop: "4px" }}>
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
                    />
                    {errors.location && (
                      <p className="error-message" style={{ color: "red", marginTop: "4px" }}>
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
                />
                {errors.bio && (
                  <p className="error-message" style={{ color: "red", marginTop: "4px" }}>
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
        </div>
      </main>
    </div>
  )
}

export default Profile
