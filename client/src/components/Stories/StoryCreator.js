"use client"

import { useState, useRef, useCallback } from "react"
import { FaTimes, FaCheck, FaSpinner, FaFont, FaPalette } from "react-icons/fa"
import { toast } from "react-toastify"
import { useAuth } from "../../context"
import { useStories } from "../../context/StoriesContext"
import "../../styles/stories.css"

const BACKGROUND_OPTIONS = [
  { id: "gradient-1", name: "Sunset", style: "linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%)" },
  { id: "gradient-2", name: "Ocean", style: "linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)" },
  { id: "gradient-3", name: "Passion", style: "linear-gradient(135deg, #f6d365 0%, #fda085 100%)" },
  { id: "gradient-4", name: "Midnight", style: "linear-gradient(135deg, #30cfd0 0%, #330867 100%)" }
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

  const previewRef = useRef(null)

  // Handle story creation with improved error handling
  const handleCreateStory = async () => {
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
    setUploadProgress(0)

    try {
      const storyData = {
        content: text.trim(),
        text: text.trim(),
        backgroundStyle: selectedBackground.style,
        backgroundColor: selectedBackground.style,
        fontStyle: selectedFont.style,
        mediaType: "text" // text story
      }

      const updateProgress = (progressEvent) => {
        if (progressEvent.total > 0) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          setUploadProgress(percentCompleted)
        }
      }

      const response = await createStory(storyData, updateProgress)

      if (response.success) {
        toast.success("Story created successfully!")
        if (onSubmit && response.data) {
          onSubmit(response.data)
        } else if (onSubmit) {
          onSubmit(response)
        }
        onClose?.()
      } else {
        setError(response.message || "Failed to create story")
        toast.error(response.message || "Failed to create story")
      }
    } catch (error) {
      console.error("Error creating story:", error)
      setError(error.message || "An error occurred")
      toast.error(error.message || "An error occurred")
    } finally {
      setIsUploading(false)
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
          {/* Story Preview */}
          <div
            className="story-preview"
            ref={previewRef}
            style={{
              ...getBackgroundStyle(selectedBackground),
              ...getFontStyle(selectedFont)
            }}
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
              onClick={() => setActiveTab("text")}
            >
              <FaFont /> Text
            </button>
            <button
              className={`tab-button ${activeTab === "background" ? "active" : ""}`}
              onClick={() => setActiveTab("background")}
            >
              <FaPalette /> Background
            </button>
            <button
              className={`tab-button ${activeTab === "font" ? "active" : ""}`}
              onClick={() => setActiveTab("font")}
            >
              <FaFont /> Font
            </button>
          </div>

          {/* Tab Content */}
          <div className="tab-content">
            {activeTab === "text" && (
              <div className="text-tab">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="What's on your mind?"
                  maxLength={50}
                  rows={2}
                />
                <small className="character-count">{text.length}/50</small>
              </div>
            )}

            {activeTab === "background" && (
              <div className="background-tab">
                <div className="background-options">
                  {BACKGROUND_OPTIONS.map(bg => (
                    <div
                      key={bg.id}
                      className={`background-option ${selectedBackground.id === bg.id ? "selected" : ""}`}
                      style={getBackgroundStyle(bg)}
                      onClick={() => setSelectedBackground(bg)}
                      title={bg.name}
                    />
                  ))}
                </div>
              </div>
            )}

            {activeTab === "font" && (
              <div className="font-tab">
                <div className="font-options">
                  {FONT_OPTIONS.map(font => (
                    <div
                      key={font.id}
                      className={`font-option ${selectedFont.id === font.id ? "selected" : ""}`}
                      style={getFontStyle(font)}
                      onClick={() => setSelectedFont(font)}
                    >
                      {font.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

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
              disabled={isUploading || !text.trim()}
            >
              {isUploading ? (
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

          <button className="btn btn-outline cancel-button" onClick={onClose} disabled={isUploading}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default StoryCreator
