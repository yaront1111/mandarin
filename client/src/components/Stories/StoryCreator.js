"use client"

import { useState, useRef, useCallback } from "react"
import { FaTimes, FaCheck, FaSpinner, FaFont, FaPalette } from "react-icons/fa"
import { toast } from "react-toastify"
import { useAuth } from "../../context"
import storiesService from "../../services/storiesService"
import "../../styles/stories.css"

// Background options with gradients and patterns
const BACKGROUND_OPTIONS = [
  { id: "gradient-1", name: "Sunset", style: "linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%)" },
  { id: "gradient-2", name: "Ocean", style: "linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)" },
  { id: "gradient-3", name: "Passion", style: "linear-gradient(135deg, #f6d365 0%, #fda085 100%)" },
  { id: "gradient-4", name: "Midnight", style: "linear-gradient(135deg, #30cfd0 0%, #330867 100%)" },
  { id: "gradient-5", name: "Forest", style: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)" },
  { id: "gradient-6", name: "Berry", style: "linear-gradient(135deg, #ff758c 0%, #ff7eb3 100%)" },
  { id: "gradient-7", name: "Dusk", style: "linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)" },
  { id: "gradient-8", name: "Fire", style: "linear-gradient(135deg, #f83600 0%, #f9d423 100%)" },
  {
    id: "pattern-1",
    name: "Dots",
    style: "radial-gradient(#444 1px, transparent 1px), #f8f8f8",
    extraStyles: { backgroundSize: "10px 10px" },
  },
  {
    id: "pattern-2",
    name: "Stripes",
    style: "repeating-linear-gradient(45deg, #f8f8f8, #f8f8f8 10px, #eee 10px, #eee 20px)",
  },
]

// Font options
const FONT_OPTIONS = [
  { id: "font-1", name: "Classic", style: "'Helvetica', sans-serif" },
  { id: "font-2", name: "Elegant", style: "'Georgia', serif" },
  { id: "font-3", name: "Modern", style: "'Montserrat', sans-serif" },
  { id: "font-4", name: "Playful", style: "'Comic Sans MS', cursive" },
  { id: "font-5", name: "Bold", style: "'Impact', sans-serif" },
]

const StoryCreator = ({ onClose, onStoryCreated }) => {
  const { user } = useAuth()
  const [text, setText] = useState("")
  const [selectedBackground, setSelectedBackground] = useState(BACKGROUND_OPTIONS[0])
  const [selectedFont, setSelectedFont] = useState(FONT_OPTIONS[0])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [duration, setDuration] = useState(24) // Default 24 hours
  const [activeTab, setActiveTab] = useState("text") // 'text', 'background', or 'font'

  const previewRef = useRef(null)

  // Handle story creation
  const handleCreateStory = async () => {
    if (!text.trim()) {
      toast.error("Please add some text to your story")
      return
    }

    if (!user) {
      toast.error("You must be logged in to create a story")
      return
    }

    setIsUploading(true)
    setUploadProgress(0)

    try {
      // Create story data
      const storyData = {
        text: text.trim(),
        background: selectedBackground.id,
        backgroundStyle: selectedBackground.style,
        font: selectedFont.id,
        fontStyle: selectedFont.style,
        duration: duration.toString(),
        mediaType: "text", // Set media type to text
      }

      // Upload with progress tracking
      const response = await storiesService.createTextStory(storyData, (progressEvent) => {
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

  // Get background style object
  const getBackgroundStyle = useCallback((background) => {
    const styles = { background: background.style }
    if (background.extraStyles) {
      return { ...styles, ...background.extraStyles }
    }
    return styles
  }, [])

  // Get font style object
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
              ...getFontStyle(selectedFont),
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
                  maxLength={200}
                  rows={5}
                />
                <small className="character-count">{text.length}/200</small>
              </div>
            )}

            {activeTab === "background" && (
              <div className="background-tab">
                <div className="background-options">
                  {BACKGROUND_OPTIONS.map((bg) => (
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
                  {FONT_OPTIONS.map((font) => (
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

          <div className="story-details">
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

      {/* Add CSS for new components */}
      <style jsx>{`
        .story-preview {
          width: 100%;
          height: 200px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          margin-bottom: 20px;
          text-align: center;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        
        .story-text-content {
          font-size: 24px;
          font-weight: bold;
          color: white;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
          word-wrap: break-word;
          max-width: 100%;
        }
        
        .story-placeholder {
          font-size: 18px;
          color: rgba(255, 255, 255, 0.7);
          font-style: italic;
        }
        
        .story-creator-tabs {
          display: flex;
          border-bottom: 1px solid #eee;
          margin-bottom: 15px;
        }
        
        .tab-button {
          flex: 1;
          padding: 10px;
          background: none;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          color: #777;
          transition: all 0.2s;
        }
        
        .tab-button.active {
          color: #2196F3;
          border-bottom: 2px solid #2196F3;
        }
        
        .tab-content {
          margin-bottom: 20px;
        }
        
        .text-tab textarea {
          width: 100%;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 8px;
          resize: none;
          font-size: 16px;
        }
        
        .character-count {
          display: block;
          text-align: right;
          margin-top: 5px;
          color: #777;
        }
        
        .background-options, .font-options {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-top: 10px;
        }
        
        .background-option {
          height: 60px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .background-option.selected {
          transform: scale(0.95);
          box-shadow: 0 0 0 3px #2196F3;
        }
        
        .font-option {
          padding: 10px;
          border-radius: 8px;
          background: #f5f5f5;
          cursor: pointer;
          text-align: center;
          transition: all 0.2s;
        }
        
        .font-option.selected {
          background: #e3f2fd;
          box-shadow: 0 0 0 2px #2196F3;
        }
        
        @media (max-width: 576px) {
          .background-options, .font-options {
            grid-template-columns: repeat(3, 1fr);
          }
        }
      `}</style>
    </div>
  )
}

export default StoryCreator
