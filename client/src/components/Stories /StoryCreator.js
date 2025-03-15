"use client"

import { useState, useRef, useCallback } from "react"
import { FaTimes, FaCamera, FaVideo, FaImage, FaCheck, FaSpinner } from "react-icons/fa"
import { toast } from "react-toastify"
import { useAuth } from "../../context"
import storiesService from "../../services/storiesService"

const StoryCreator = ({ onClose, onStoryCreated }) => {
  const { user } = useAuth()
  const [mediaFile, setMediaFile] = useState(null)
  const [mediaPreview, setMediaPreview] = useState(null)
  const [mediaType, setMediaType] = useState(null) // 'image' or 'video'
  const [caption, setCaption] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [duration, setDuration] = useState(24) // Default 24 hours

  const fileInputRef = useRef(null)
  const videoRef = useRef(null)

  // Handle file selection
  const handleFileChange = useCallback((e) => {
    const file = e.target.files[0]
    if (!file) return

    // Check file type
    if (file.type.startsWith("image/")) {
      setMediaType("image")
    } else if (file.type.startsWith("video/")) {
      setMediaType("video")

      // Check video duration (max 30 seconds)
      const video = document.createElement("video")
      video.preload = "metadata"

      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src)
        if (video.duration > 30) {
          toast.error("Video must be 30 seconds or less")
          setMediaFile(null)
          setMediaPreview(null)
          setMediaType(null)
          return
        }
      }

      video.src = URL.createObjectURL(file)
    } else {
      toast.error("Unsupported file type. Please upload an image or video.")
      return
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB")
      return
    }

    setMediaFile(file)
    setMediaPreview(URL.createObjectURL(file))
  }, [])

  // Trigger file input click
  const handleSelectFile = (type) => {
    if (fileInputRef.current) {
      // Set accept attribute based on type
      if (type === "image") {
        fileInputRef.current.accept = "image/*"
      } else if (type === "video") {
        fileInputRef.current.accept = "video/*"
      }

      fileInputRef.current.click()
    }
  }

  // Clear selected media
  const handleClearMedia = () => {
    setMediaFile(null)
    setMediaPreview(null)
    setMediaType(null)

    // Revoke object URL to avoid memory leaks
    if (mediaPreview) {
      URL.revokeObjectURL(mediaPreview)
    }
  }

  // Handle story upload
  const handleUploadStory = async () => {
    if (!mediaFile) {
      toast.error("Please select a media file")
      return
    }

    if (!user) {
      toast.error("You must be logged in to create a story")
      return
    }

    setIsUploading(true)
    setUploadProgress(0)

    try {
      // Create form data
      const formData = new FormData()
      formData.append("media", mediaFile)
      formData.append("mediaType", mediaType)
      formData.append("caption", caption)
      formData.append("duration", duration.toString())

      // Upload with progress tracking
      const response = await storiesService.createStory(formData, (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
        setUploadProgress(percentCompleted)
      })

      if (response.success) {
        toast.success("Story created successfully!")

        // Call callback if provided
        if (onStoryCreated) {
          onStoryCreated(response.data)
        }

        // Close creator
        onClose()
      } else {
        toast.error(response.message || "Failed to create story")
      }
    } catch (error) {
      console.error("Error creating story:", error)
      toast.error(error.message || "An error occurred while creating your story")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="story-creator-container">
      <div className="story-creator-overlay" onClick={onClose}></div>
      <div className="story-creator">
        <div className="creator-header">
          <h2>Create Story</h2>
          <button className="close-button" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className="creator-content">
          {!mediaFile ? (
            <div className="media-selector">
              <div className="selector-heading">
                <h3>Select Media</h3>
                <p>Choose an image or video for your story</p>
              </div>

              <div className="media-options">
                <button className="media-option-button" onClick={() => handleSelectFile("image")}>
                  <FaImage className="option-icon" />
                  <span>Upload Image</span>
                </button>

                <button className="media-option-button" onClick={() => handleSelectFile("video")}>
                  <FaVideo className="option-icon" />
                  <span>Upload Video</span>
                  <small>Max 30 seconds</small>
                </button>

                <button className="media-option-button" onClick={() => handleSelectFile("image")}>
                  <FaCamera className="option-icon" />
                  <span>Take Photo</span>
                </button>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                onChange={handleFileChange}
                accept="image/*,video/*"
              />
            </div>
          ) : (
            <div className="media-preview">
              <div className="preview-container">
                {mediaType === "image" ? (
                  <img src={mediaPreview || "/placeholder.svg"} alt="Story preview" className="preview-media" />
                ) : (
                  <video ref={videoRef} src={mediaPreview} className="preview-media" controls muted playsInline />
                )}

                <button className="clear-media-button" onClick={handleClearMedia}>
                  <FaTimes />
                </button>
              </div>

              <div className="story-details">
                <div className="form-group">
                  <label htmlFor="caption">Caption</label>
                  <textarea
                    id="caption"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Add a caption to your story..."
                    maxLength={200}
                    rows={3}
                  />
                  <small className="character-count">{caption.length}/200</small>
                </div>

                <div className="form-group">
                  <label htmlFor="duration">Duration</label>
                  <select id="duration" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                    <option value={24}>24 hours</option>
                    <option value={48}>48 hours</option>
                    <option value={72}>72 hours</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="creator-footer">
          {mediaFile && (
            <>
              {isUploading ? (
                <div className="upload-progress">
                  <div className="progress-bar-container">
                    <div className="progress-bar" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                  <span>{uploadProgress}%</span>
                </div>
              ) : (
                <button className="btn btn-primary create-button" onClick={handleUploadStory} disabled={isUploading}>
                  {isUploading ? (
                    <>
                      <FaSpinner className="spinner-icon" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <FaCheck />
                      <span>Create Story</span>
                    </>
                  )}
                </button>
              )}
            </>
          )}

          <button className="btn btn-outline cancel-button" onClick={onClose} disabled={isUploading}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default StoryCreator
