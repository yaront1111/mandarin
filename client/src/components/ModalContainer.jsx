"use client"

import React from "react"
import { useModals } from "../context/ModalContext"
import EmbeddedChat from "./EmbeddedChat"
import UserProfileModal from "./UserProfileModal"
import { logger } from "../utils/logger"

const log = logger.create("ModalContainer")

/**
 * ModalContainer
 * 
 * A central component that manages rendering all modals and overlays
 * in the application. This keeps the App component cleaner by moving
 * all modal-related rendering to a single component.
 */
const ModalContainer = () => {
  // Get all modal-related state and handlers from context
  const {
    // Chat
    chatRecipient,
    isChatOpen,
    closeChat,
    
    // Profile modal
    profileModalUserId,
    isProfileModalOpen,
    closeProfileModal,
  } = useModals()

  // Rendering logic can be expanded here if we add more modals
  const hasAnyModals = isChatOpen || isProfileModalOpen

  // Debug when modals change
  React.useEffect(() => {
    if (hasAnyModals) {
      log.debug("Active modals:", {
        chat: isChatOpen ? chatRecipient?.nickname || chatRecipient?._id : false,
        profile: isProfileModalOpen ? profileModalUserId : false
      })
    }
  }, [isChatOpen, isProfileModalOpen, chatRecipient, profileModalUserId, hasAnyModals])

  return (
    <>
      {/* Embedded Chat modal */}
      {isChatOpen && chatRecipient && (
        <EmbeddedChat
          recipient={chatRecipient}
          isOpen={isChatOpen}
          onClose={closeChat}
        />
      )}

      {/* User Profile Modal */}
      <UserProfileModal
        userId={profileModalUserId}
        isOpen={isProfileModalOpen}
        onClose={closeProfileModal}
      />
      
      {/* Add future modals here */}
    </>
  )
}

export default React.memo(ModalContainer)