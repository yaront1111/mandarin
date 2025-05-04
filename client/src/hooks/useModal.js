"use client"

import { useState, useCallback, useEffect } from "react"
import { logger } from "../utils/logger"

const log = logger.create("useModal")

/**
 * Custom hook for managing modal state
 * 
 * This hook provides a consistent way to manage modal state throughout the application,
 * including handling open/close, data, and animations.
 * 
 * @param {boolean} initialState - Initial open state of the modal
 * @param {Object} options - Configuration options
 * @param {number} options.closeDelay - Delay in ms before clearing data on close (for animations)
 * @param {Function} options.onOpen - Callback function called when modal opens
 * @param {Function} options.onClose - Callback function called when modal closes
 * @returns {Object} Modal state and methods
 */
export function useModal(initialState = false, options = {}) {
  const {
    closeDelay = 300, // Default close delay for animations
    onOpen,
    onClose,
  } = options

  // Core modal state
  const [isOpen, setIsOpen] = useState(initialState)
  const [modalData, setModalData] = useState(null)
  const [isClosing, setIsClosing] = useState(false) // For animations

  // Open modal with optional data
  const openModal = useCallback((data = null) => {
    log.debug("Opening modal with data:", data)
    setModalData(data)
    setIsOpen(true)
    setIsClosing(false)
    
    if (onOpen && typeof onOpen === "function") {
      onOpen(data)
    }
  }, [onOpen])

  // Close modal with animation delay for data cleanup
  const closeModal = useCallback(() => {
    log.debug("Closing modal")
    setIsClosing(true)
    
    if (onClose && typeof onClose === "function") {
      onClose()
    }
    
    // First set isOpen to false immediately
    setIsOpen(false)
    
    // Then clear data after animation completes
    if (closeDelay > 0) {
      setTimeout(() => {
        setModalData(null)
        setIsClosing(false)
      }, closeDelay)
    } else {
      setModalData(null)
      setIsClosing(false)
    }
  }, [closeDelay, onClose])

  // Toggle modal state
  const toggleModal = useCallback((data = null) => {
    if (!isOpen) {
      openModal(data)
    } else {
      closeModal()
    }
  }, [isOpen, openModal, closeModal])

  // Update modal data without changing open state
  const updateModalData = useCallback((data) => {
    log.debug("Updating modal data:", data)
    setModalData(prevData => {
      if (typeof data === 'function') {
        return data(prevData)
      }
      return data
    })
  }, [])

  // Close modal on escape key
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === "Escape" && isOpen) {
        closeModal()
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscKey)
    }

    return () => {
      document.removeEventListener("keydown", handleEscKey)
    }
  }, [isOpen, closeModal])

  return {
    isOpen,
    isClosing,
    modalData,
    openModal,
    closeModal,
    toggleModal,
    updateModalData
  }
}

export default useModal