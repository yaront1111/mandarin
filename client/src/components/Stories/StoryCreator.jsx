"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { 
  FaTimes, FaCheck, FaSpinner, FaFont, FaPalette
} from "react-icons/fa"
import { toast } from "react-toastify"
import { useTranslation } from "react-i18next"
import { useAuth, useLanguage } from "../../context"
import { useStories } from "../../context/StoriesContext"
import styles from "../../styles/StoryCreator.module.css"

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
  const { t } = useTranslation()
  const { isRTL } = useLanguage()
  const [text, setText] = useState("")
  const [selectedBackground, setSelectedBackground] = useState(BACKGROUND_OPTIONS[0])
  const [selectedFont, setSelectedFont] = useState(FONT_OPTIONS[0])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState("text")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Handle text story creation with improved error handling
  const handleCreateStory = async () => {
    // Prevent duplicate submissions
    if (isSubmitting || isUploading) {
      toast.info(t('stories.waitForStoryCreation'))
      return
    }

    // Validate text content
    if (!text.trim()) {
      toast.error(t('stories.addTextError'))
      return
    }

    if (!user) {
      toast.error(t('stories.loginRequired'))
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

      // Handle different response formats for compatibility
      if (response && (response.success === true || response._id || (response.data && response.data._id))) {
        toast.success(t('stories.createStorySuccess'))
        
        // Determine what to pass to onSubmit based on response format
        if (onSubmit) {
          if (response.data) {
            onSubmit(response.data)
          } else if (response._id) {
            onSubmit(response)
          } else {
            onSubmit(response)
          }
        }
        onClose?.()
      } else {
        setError(response?.message || response?.error || t('stories.createStoryError'))
      }
    } catch (error) {
      console.error("Error creating story:", error)
      setError(error.message || t('errors.somethingWentWrong'))
      toast.error(error.message || t('errors.somethingWentWrong'))
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
    <div className={`${styles.container} ${isRTL ? 'rtl-layout' : ''}`}>
      <div
        className={styles.overlay}
        onClick={isUploading || isSubmitting ? undefined : onClose}
      />
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>{t('stories.createStory')}</h2>
          <button
            className={styles.closeButton}
            onClick={isUploading || isSubmitting ? undefined : onClose}
            disabled={isUploading || isSubmitting}
            aria-label="Close"
          >
            <FaTimes />
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.previewContainer}>
            <div
              className={styles.preview}
              style={{ ...getBackgroundStyle(selectedBackground), ...getFontStyle(selectedFont) }}
            >
              {text ? (
                <div className={styles.textContent}>{text}</div>
              ) : (
                <div className={styles.placeholder}>{t('stories.typeSomething')}</div>
              )}
            </div>
          </div>

          <div className={styles.editorContainer}>
            <div className={styles.tabs}>
              <button
                className={`${styles.tabButton} ${activeTab === "text" ? styles.activeTab : ""}`}
                onClick={() => setActiveTab("text")}
                disabled={isSubmitting || isUploading}
              >
                <span style={{ fontSize: '20px' }}>A</span> {t('stories.text')}
              </button>
              <button
                className={`${styles.tabButton} ${activeTab === "background" ? styles.activeTab : ""}`}
                onClick={() => setActiveTab("background")}
                disabled={isSubmitting || isUploading}
              >
                <FaPalette /> {t('stories.background')}
              </button>
            </div>

            {activeTab === "text" && (
              <div className={styles.tabContent}>
                <div className={styles.textTab}>
                  <textarea
                    className={styles.textarea}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={t('stories.whatsOnYourMind')}
                    maxLength={150}
                    disabled={isSubmitting || isUploading}
                  />
                  <small className={styles.characterCount}>
                    {text.length}/150
                  </small>
                </div>
              </div>
            )}

            {activeTab === "background" && (
              <div className={styles.tabContent}>
                <div className={styles.backgroundOptions}>
                  {BACKGROUND_OPTIONS.map((bg) => (
                    <div
                      key={bg.id}
                      className={`${styles.backgroundOption} ${selectedBackground.id === bg.id ? styles.selected : ""}`}
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

            {error && <div className={styles.errorMessage}>{error}</div>}
          </div>
        </div>

        <div className={styles.footer}>
          {isUploading ? (
            <div className={styles.uploadProgress}>
              <div className={styles.progressBarContainer}>
                <div
                  className={styles.progressBar}
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <span>{uploadProgress}%</span>
            </div>
          ) : (
            <>
              <button
                className={`${styles.button} ${styles.outlineButton}`}
                onClick={onClose}
                disabled={isUploading || isSubmitting}
              >
                {t('common.cancel')}
              </button>
              <button
                className={`${styles.button} ${styles.primaryButton}`}
                onClick={handleCreateStory}
                disabled={
                  isUploading ||
                  isSubmitting ||
                  !text.trim()
                }
              >
                {isSubmitting ? (
                  <>
                    <FaSpinner className={styles.spinner} />
                    <span>{t('stories.creating')}</span>
                  </>
                ) : (
                  <>
                    <FaCheck />
                    <span>{t('stories.createStory')}</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default StoryCreator
