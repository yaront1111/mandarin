"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { 
  FaTimes, FaCheck, FaSpinner, FaFont, FaPalette, 
  FaImage, FaVideo, FaInfoCircle
} from "react-icons/fa"
import { toast } from "react-toastify"
import { useAuth } from "../../context"
import { useStories } from "../../context/StoriesContext"
import styles from "../../styles/stories.module.css"

const BACKGROUND_OPTIONS = [
  { id: "gradient-1", name: "Sunset", style: "linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%)" },
  { id: "gradient-2", name: "Ocean", style: "linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)" },
  { id: "gradient-3", name: "Passion", style: "linear-gradient(135deg, #f6d365 0%, #fda085 100%)" },
  { id: "gradient-4", name: "Midnight", style: "linear-gradient(135deg, #30cfd0 0%, #330867 100%)" },
  { id: "gradient-5", name: "Forest", style: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)" },
  { id: "gradient-6", name: "Berry", style: "linear-gradient(135deg, #c471f5 0%, #fa71cd 100%)" },
  { id: "gradient-7", name: "Dusk", style: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" },
  { id: "gradient-8", name: "Fire", style: "linear-gradient(135deg, #f83600 0%, #f9d423 100%)" },
]

const FONT_OPTIONS = [
  { id: "font-1", name: "Classic", style: "'Helvetica', sans-serif" },
  { id: "font-2", name: "Elegant", style: "'Georgia', serif" },
  { id: "font-3", name: "Modern", style: "'Montserrat', sans-serif" },
  { id: "font-4", name: "Playful", style: "'Comic Sans MS', cursive" },
  { id: "font-5", name: "Bold", style: "'Impact', sans-serif" },
]

const StoryCreator = ({ onClose, onSubmit }) => {
  const { user } = useAuth()
  const { createStory } = useStories()
  const [text, setText] = useState("")
  const [selectedBackground, setSelectedBackground] = useState(BACKGROUND_OPTIONS[0])
  const [selectedFont, setSelectedFont] = useState(FONT_OPTIONS[0])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState("text")
  const [mediaFile, setMediaFile] = useState(null)
  const [mediaPreview, setMediaPreview] = useState(null)
  const [mediaType, setMediaType] = useState("text")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const previewRef = useRef(null)
  const fileInputRef = useRef(null)

  // Handle file selection
  const handleFileChange = (e) => {
    if (isSubmitting || isUploading) return

    const file = e.target.files[0]
    if (!file) return

    // Validate file type
    if (file.type.startsWith("image/")) {
      setMediaType("image")
    } else if (file.type.startsWith("video/")) {
      setMediaType("video")
    } else {
      toast.error("Unsupported file type. Please upload an image or video.")
      return
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File is too large. Maximum size is 10MB.")
      return
    }

    setMediaFile(file)

    // Create preview URL
    const reader = new FileReader()
    reader.onloadend = () => {
      setMediaPreview(reader.result)
    }
    reader.readAsDataURL(file)

    // Switch to appropriate tab
    setActiveTab(file.type.startsWith("image/") ? "image" : "video")
  }

  // This function is no longer needed but kept for potential future use
  const handleComingSoonTab = () => {}

  // Clear selected media
  const clearMedia = () => {
    if (isSubmitting || isUploading) return

    setMediaFile(null)
    setMediaPreview(null)
    setMediaType("text")
    setActiveTab("text")
  }

  // Handle text story creation with improved error handling
  const handleCreateStory = async () => {
    // Prevent duplicate submissions
    if (isSubmitting || isUploading) {
      toast.info("Please wait, your story is being created...")
      return
    }

    // Validate text content
    if (!text.trim()) {
      toast.error("Please add some text to your story")
      return
    }

    if (!user) {
      toast.error("You must be logged in to create a story")
      return
    }

    setError("")
    setIsUploading(true)
    setIsSubmitting(true)
    setUploadProgress(0)

    try {
      // Prepare text story data
      const storyData = {
        content: text.trim(),
        text: text.trim(),
        backgroundStyle: selectedBackground.style,
        backgroundColor: selectedBackground.style,
        fontStyle: selectedFont.style,
        mediaType: "text",
        type: "text",
      }

      const response = await createStory(storyData, updateProgress)

      if (response && response.success) {
        toast.success("Story created successfully!")
        if (onSubmit && response.data) {
          onSubmit(response.data)
        } else if (onSubmit) {
          onSubmit(response)
        }
        onClose?.()
      } else {
        setError(response?.message || "Failed to create story")
        // Don't close on error
      }
    } catch (error) {
      console.error("Error creating story:", error)
      setError(error.message || "An error occurred")
      toast.error(error.message || "An error occurred")
      // Don't close on error
    } finally {
      setIsUploading(false)
      setIsSubmitting(false)
    }
  }

  // Helper function for progress updates
  const updateProgress = (progressEvent) => {
    if (progressEvent && typeof progressEvent === "number") {
      setUploadProgress(progressEvent)
    } else if (progressEvent && progressEvent.total > 0) {
      const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
      setUploadProgress(percentCompleted)
    }
  }

  // Utility for background styles
  const getBackgroundStyle = useCallback((bg) => {
    return { background: bg.style }
  }, [])

  // Utility for font styles
  const getFontStyle = useCallback((font) => {
    return { fontFamily: font.style }
  }, [])

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscKey = (e) => {
      if (e.key === "Escape" && !isUploading && !isSubmitting) {
        onClose?.()
      }
    }

    document.addEventListener("keydown", handleEscKey)
    return () => document.removeEventListener("keydown", handleEscKey)
  }, [onClose, isUploading, isSubmitting])


  return (
    <div className="story-creator-container">
      <div className="story-creator-overlay" onClick={isUploading || isSubmitting ? null : onClose}></div>
      <div className="story-creator">
        <div className="creator-header">
          <h2>Create Story</h2>
          <button
            className="close-button"
            onClick={isUploading || isSubmitting ? null : onClose}
            disabled={isUploading || isSubmitting}
          >
            <FaTimes />
          </button>
        </div>

        <div className="creator-content">
          {/* Story Preview */}
          <div
            className="story-preview"
            ref={previewRef}
            style={{ ...getBackgroundStyle(selectedBackground), ...getFontStyle(selectedFont) }}
          >
            {text ? (
              <div className="story-text-content">{text}</div>
            ) : (
              <div className="story-placeholder">Type something amazing...</div>
            )}
          </div>

          {/* Tabs */}
          <div className="story-creator-tabs">
            <button
              className={`tab-button ${activeTab === "text" ? "active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                if (!isSubmitting && !isUploading) {
                  setActiveTab("text");
                  setMediaType("text");
                  setMediaFile(null);
                  setMediaPreview(null);
                }
              }}
              disabled={isSubmitting || isUploading}
            >
              <FaFont /> Text
            </button>
            <button
              className={`tab-button ${activeTab === "background" ? "active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                if (!isSubmitting && !isUploading) {
                  setActiveTab("background");
                }
              }}
              disabled={isSubmitting || isUploading}
            >
              <FaPalette /> Background
            </button>
            <button
              className={`tab-button ${activeTab === "font" ? "active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                if (!isSubmitting && !isUploading) {
                  setActiveTab("font");
                }
              }}
              disabled={isSubmitting || isUploading}
            >
              <FaFont /> Font
            </button>
          </div>

          {/* Hidden file input */}
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handleFileChange}
            accept="image/*,video/*"
            disabled={isSubmitting || isUploading}
          />

          {/* Tab Content */}
          {activeTab === "text" && (
            <div className="tab-content">
              <div className="text-tab">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="What's on your mind?"
                  maxLength={150}
                  rows={3}
                  disabled={isSubmitting || isUploading}
                />
                <small className="character-count">
                  {text.length}/150
                </small>
              </div>
            </div>
          )}

          {activeTab === "background" && mediaType === "text" && (
            <div className="tab-content">
              <div className="background-options">
                {BACKGROUND_OPTIONS.map((bg) => (
                  <div
                    key={bg.id}
                    className={`background-option ${selectedBackground.id === bg.id ? "selected" : ""}`}
                    style={getBackgroundStyle(bg)}
                    onClick={() => {
                      if (!isSubmitting && !isUploading) {
                        setSelectedBackground(bg);
                      }
                    }}
                    title={bg.name}
                  />
                ))}
              </div>
            </div>
          )}

          {activeTab === "font" && mediaType === "text" && (
            <div className="tab-content">
              <div className="font-options">
                {FONT_OPTIONS.map((font) => (
                  <div
                    key={font.id}
                    className={`font-option ${selectedFont.id === font.id ? "selected" : ""}`}
                    style={getFontStyle(font)}
                    onClick={() => {
                      if (!isSubmitting && !isUploading) {
                        setSelectedFont(font);
                      }
                    }}
                  >
                    {font.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}
        </div>

        <div className="creator-footer">
          {isUploading ? (
            <div className="upload-progress">
              <div className="progress-bar-container">
                <div className="progress-bar" style={{ width: `${uploadProgress}%` }}></div>
              </div>
              <span>{uploadProgress}%</span>
            </div>
          ) : (
            <button
              className="btn btn-primary create-button"
              onClick={handleCreateStory}
              disabled={
                isUploading ||
                isSubmitting ||
                !text.trim()
              }
            >
              {isSubmitting ? (
                <>
                  <FaSpinner className="spinner-icon" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <FaCheck />
                  <span>Create Story</span>
                </>
              )}
            </button>
          )}

          <button
            className="btn btn-outline cancel-button"
            onClick={onClose}
            disabled={isUploading || isSubmitting}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default StoryCreator