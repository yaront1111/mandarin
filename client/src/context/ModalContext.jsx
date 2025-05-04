"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect
} from "react"
import { UI } from "../config"
import { logger } from "../utils/logger"

const log = logger.create("ModalContext")

// Create the context
const ModalContext = createContext(undefined)

/**
 * Modal Provider Component
 * Manages all modal states and logic for the application
 */
export function ModalProvider({ children }) {
  // Chat state
  const [chatRecipient, setChatRecipient] = useState(null)
  const [isChatOpen, setIsChatOpen] = useState(false)

  // Profile modal state
  const [profileModalUserId, setProfileModalUserId] = useState(null)

  // Computed value for profile modal open state
  const isProfileModalOpen = Boolean(profileModalUserId)

  // Open chat with recipient
  const openChat = useCallback((recipient) => {
    log.debug("Opening chat with recipient:", recipient?.nickname || recipient?._id)
    setChatRecipient(recipient)
    setTimeout(() => setIsChatOpen(true), UI.ANIMATIONS.CHAT_OPEN_DELAY_MS)
  }, [])

  // Close chat
  const closeChat = useCallback(() => {
    log.debug("Closing chat")
    setIsChatOpen(false)
    // Optional: Clear recipient after animation
    // setTimeout(() => setChatRecipient(null), 300)
  }, [])

  // Open profile modal with user ID
  const openProfileModal = useCallback((userId) => {
    log.debug("Opening profile modal for user:", userId)
    setProfileModalUserId(userId)
  }, [])

  // Close profile modal
  const closeProfileModal = useCallback(() => {
    log.debug("Closing profile modal")
    setProfileModalUserId(null)
  }, [])

  // Listen for custom events
  useEffect(() => {
    const handleOpenChat = (event) => {
      const { recipient } = event.detail
      if (recipient && recipient._id) {
        openChat(recipient)
      }
    }

    // Add event listener
    window.addEventListener("openChat", handleOpenChat)

    // Clean up on unmount
    return () => {
      window.removeEventListener("openChat", handleOpenChat)
    }
  }, [openChat])

  // Create the context value object
  const contextValue = {
    // Chat state and handlers
    chatRecipient,
    isChatOpen,
    openChat,
    closeChat,
    
    // Profile modal state and handlers
    profileModalUserId,
    isProfileModalOpen,
    openProfileModal,
    closeProfileModal,
  }

  // Return the provider with the context value
  return (
    <ModalContext.Provider value={contextValue}>
      {children}
    </ModalContext.Provider>
  )
}

/**
 * Hook for using the modal context
 * @returns {Object} Modal context value
 */
export function useModals() {
  const context = useContext(ModalContext)
  
  if (context === undefined) {
    throw new Error("useModals must be used within a ModalProvider")
  }
  
  return context
}

export default ModalContext