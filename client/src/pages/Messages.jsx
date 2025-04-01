"use client"

// client/src/pages/Messages.jsx
import { useState, useEffect, useCallback, useRef } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useAuth } from "../context"
import { Navbar } from "../components/LayoutComponents"
import { chat } from "../components"
import {
  FaSearch,
  FaSpinner,
  FaRegTrashAlt,
  FaBellSlash,
  FaBell,
  FaEllipsisV,
  FaChevronLeft,
  FaUserCircle,
  FaExclamationTriangle,
  FaSync,
} from "react-icons/fa"
import { formatDistanceToNowStrict } from "date-fns"
import { formatMessagePreview, classNames, normalizePhotoUrl, resetUserSession, logger } from "../utils"
import { toast } from "react-toastify"
import { useApi } from "../hooks/useApi"

// Create a logger for this component
const log = logger.create("Messages")

const MessagesPage = () => {
  // Get auth state and API client
  const { user, authChecked, isAuthenticated, token } = useAuth()
  const api = useApi()
  const navigate = useNavigate()
  const { userId: selectedUserIdFromParams } = useParams()

  // State for conversations and UI
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedConversationRecipient, setSelectedConversationRecipient] = useState(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [filteredConversations, setFilteredConversations] = useState([])
  const [conversationMenuOpen, setConversationMenuOpen] = useState(null)
  const [isChatPanelVisible, setIsChatPanelVisible] = useState(false)
  const [activeConversation, setActiveConversation] = useState(null)
  const [retryCount, setRetryCount] = useState(0)

  // Refs
  const searchInputRef = useRef(null)
  const conversationListRef = useRef(null)
  const retryTimeoutRef = useRef(null)
  const initialLoadAttemptedRef = useRef(false)
  const initialLoadCompletedRef = useRef(false)

  // Load conversations when authenticated
  const getConversations = useCallback(
    async (forceRetry = false) => {
      // Skip if not authenticated or no user ID
      if (!isAuthenticated || !user?._id) {
        log.debug("Not authenticated or missing user ID, skipping conversation fetch")
        setLoading(false)
        return
      }

      // Skip if already loading unless forced
      if (loading && !forceRetry) {
        log.debug("Already loading conversations, skipping duplicate fetch")
        return
      }

      // Set a timeout to ensure loading state doesn't get stuck indefinitely
      const timeoutId = setTimeout(() => {
        log.warn('Conversation loading timeout reached, resetting loading state');
        setLoading(false);
        setError('Loading conversations timed out. Please try again.');
        // Allow for retry
        initialLoadAttemptedRef.current = false;
      }, 15000); // 15 second timeout for initial load

      setLoading(true)
      setError(null)

      try {
        log.info(`Fetching conversations for user ${user._id}...`)

        // Fetch with timeout protection
        const fetchWithTimeout = (timeoutMs = 10000) => {
          return Promise.race([
            api.get("/messages/conversations"),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Request timed out')), timeoutMs)
            )
          ]);
        };

        // Make the API request with timeout protection
        const response = await fetchWithTimeout();
        
        // Clear the timeout since we got a response
        clearTimeout(timeoutId);

        if (!response || !response.success) {
          log.warn(`API returned unsuccessful response:`, response);
          throw new Error(response?.error || "Failed to load conversations")
        }

        const conversationData = Array.isArray(response.data) ? response.data : [];
        log.info(`Loaded ${conversationData.length} conversations`);

        // Successfully loaded, update state
        setConversations(conversationData)
        setFilteredConversations(conversationData)
        setLoading(false)
        setRetryCount(0)
        initialLoadCompletedRef.current = true;

        // Clear any retry timeout
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current)
          retryTimeoutRef.current = null
        }

        return conversationData
      } catch (err) {
        log.error("Error fetching conversations:", err)
        
        // Clear the timeout since we got a response
        clearTimeout(timeoutId);
        
        setError(err.message || "Failed to load conversations")
        setLoading(false)

        // Increment retry count
        const newRetryCount = retryCount + 1
        setRetryCount(newRetryCount)

        // Set up automatic retry with exponential backoff, but limit total retries
        if (newRetryCount <= 3) {
          const retryDelay = Math.min(3000 * Math.pow(1.5, newRetryCount - 1), 10000)
          log.debug(`Will retry in ${retryDelay / 1000} seconds (attempt ${newRetryCount})`)

          retryTimeoutRef.current = setTimeout(() => {
            log.debug(`Auto-retrying conversation fetch (attempt ${newRetryCount})...`)
            getConversations(true)
          }, retryDelay)
        } else {
          log.warn("Maximum retry attempts reached");
          // Reset initialLoadAttemptedRef to false to allow manual retry
          initialLoadAttemptedRef.current = false;
        }

        return []
      }
    },
    [isAuthenticated, user, api, loading, retryCount],
  )

  // Load conversations on mount and when auth state changes
  useEffect(() => {
    // Create a reference to track if the component is mounted
    let isMounted = true;
    
    // Define an initialization function
    const initializeConversations = async () => {
      // Only attempt to load conversations once authentication is checked
      if (!authChecked) {
        return;
      }
      
      if (isAuthenticated && user?._id) {
        // Check if we've already attempted to load
        if (!initialLoadAttemptedRef.current && isMounted) {
          log.info(`Initial conversations load for user ${user._id}`);
          initialLoadAttemptedRef.current = true;
          
          // Add a small safety delay to ensure auth is fully processed
          await new Promise(resolve => setTimeout(resolve, 500));
          
          if (isMounted) {
            getConversations();
          }
        }
      } else if (isMounted) {
        // Not authenticated, stop loading
        setLoading(false);
      }
    };
    
    // Call the initialization function
    initializeConversations();
    
    // Setup a safety timeout to ensure we're never stuck in loading
    const safetyTimeoutId = setTimeout(() => {
      if (isMounted && loading) {
        log.warn("Safety timeout triggered - forcing loading state reset");
        setLoading(false);
      }
    }, 20000); // 20 second safety timeout
    
    // Cleanup function for unmounting
    return () => {
      isMounted = false;
      
      // Clear all timeouts
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      
      clearTimeout(safetyTimeoutId);
    };
  }, [authChecked, isAuthenticated, user, getConversations, loading])

  // Mark a conversation as read
  const markConversationRead = useCallback(
    async (recipientId) => {
      if (!recipientId || !user?._id) return

      try {
        await api.put(`/messages/conversation/${recipientId}/read`)

        // Update local state to reflect read status
        setConversations((prev) =>
          prev.map((convo) => {
            const convoUserId = convo.user?._id
            if (convoUserId === recipientId) {
              return { ...convo, unreadCount: 0 }
            }
            return convo
          }),
        )
      } catch (err) {
        log.error("Error marking conversation as read:", err)
      }
    },
    [user, api],
  )

  // Delete a conversation
  const deleteConversation = useCallback(
    async (conversationId) => {
      if (!conversationId) return

      try {
        // This is a placeholder - the actual API endpoint might be different
        await api.delete(`/messages/conversation/${conversationId}`)

        // Update local state
        setConversations((prev) => prev.filter((c) => c._id !== conversationId))
        setFilteredConversations((prev) => prev.filter((c) => c._id !== conversationId))

        return true
      } catch (err) {
        log.error("Error deleting conversation:", err)
        throw err
      }
    },
    [api],
  )

  // Select conversation based on URL parameter
  useEffect(() => {
    if (!Array.isArray(conversations) || conversations.length === 0) return

    if (selectedUserIdFromParams) {
      const convo = conversations.find((c) => c.user?._id === selectedUserIdFromParams)

      if (convo) {
        const recipientData = convo.user

        if (recipientData && recipientData._id) {
          setSelectedConversationRecipient(recipientData)
          setActiveConversation(recipientData._id)

          if (convo.unreadCount > 0) {
            markConversationRead(recipientData._id)
          }

          setIsChatPanelVisible(true)
        } else {
          log.warn("Found conversation but recipient data is invalid:", convo)
          setSelectedConversationRecipient(null)
          setActiveConversation(null)
          navigate("/messages", { replace: true })
        }
      } else {
        setSelectedConversationRecipient(null)
        setActiveConversation(null)

        if (location.pathname !== "/messages") {
          navigate("/messages", { replace: true })
        }
      }
    } else if (!selectedUserIdFromParams) {
      if (activeConversation) {
        const activeConvo = conversations.find((c) => c.user?._id === activeConversation)
        const recipientData = activeConvo?.user

        if (recipientData?._id) {
          setSelectedConversationRecipient(recipientData)
          setIsChatPanelVisible(true)
        } else {
          setSelectedConversationRecipient(null)
          setActiveConversation(null)
        }
      } else {
        setSelectedConversationRecipient(null)
      }
    }
  }, [selectedUserIdFromParams, conversations, navigate, markConversationRead, activeConversation])

  // Filter conversations based on search query
  useEffect(() => {
    if (!Array.isArray(conversations)) {
      setFilteredConversations([])
      return
    }

    const query = searchQuery.toLowerCase().trim()

    if (!query) {
      setFilteredConversations(conversations)
      return
    }

    const filtered = conversations.filter((convo) => {
      const userData = convo?.user
      return (
        userData?.nickname?.toLowerCase().includes(query) || convo?.lastMessage?.content?.toLowerCase().includes(query)
      )
    })

    setFilteredConversations(filtered)
  }, [searchQuery, conversations])

  // Handle selecting a conversation from the list
  const handleSelectConversation = useCallback(
    (recipient) => {
      if (!recipient || !recipient._id) {
        log.warn("Attempted to select conversation with invalid recipient:", recipient)
        return
      }

      setSelectedConversationRecipient(recipient)
      setActiveConversation(recipient._id)
      navigate(`/messages/${recipient._id}`, { replace: true })

      const conversation = conversations.find((c) => c.user?._id === recipient._id)

      if (conversation?.unreadCount > 0) {
        markConversationRead(recipient._id)
      }

      setIsChatPanelVisible(true)
      setConversationMenuOpen(null)
    },
    [conversations, navigate, markConversationRead],
  )

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value)
  }

  // Clear search input
  const handleClearSearch = () => {
    setSearchQuery("")
    searchInputRef.current?.focus()
  }

  // Toggle conversation action menu
  const toggleConversationMenu = (e, conversationId) => {
    e.stopPropagation()
    setConversationMenuOpen((prevId) => (prevId === conversationId ? null : conversationId))
  }

  // Handle deleting a conversation
  const handleDeleteConversation = async (e, recipientId) => {
    e.stopPropagation()
    if (!recipientId) return

    const conversationToDelete = conversations.find((c) => c.user?._id === recipientId)
    const conversationId = conversationToDelete?._id

    if (!conversationId) {
      log.error("Conversation ID not found for recipient:", recipientId)
      toast.error("Could not find conversation to delete")
      return
    }

    if (window.confirm("Are you sure you want to delete this conversation?")) {
      try {
        await deleteConversation(conversationId)
        setConversationMenuOpen(null)
        log.info("Conversation deleted successfully")

        // Update local state immediately
        setFilteredConversations((prev) => prev.filter((c) => c._id !== conversationId))

        if (selectedConversationRecipient?._id === recipientId) {
          setSelectedConversationRecipient(null)
          setActiveConversation(null)
          navigate("/messages", { replace: true })
        }
      } catch (error) {
        log.error("Delete conversation error:", error)
        toast.error("Failed to delete conversation")
      }
    }
  }

  // Handle muting/unmuting (Placeholder)
  const handleToggleMute = async (e, conversationId, currentMuteStatus) => {
    e.stopPropagation()
    try {
      log.debug(`Toggling mute for ${conversationId}. Current: ${currentMuteStatus}`)
      toast.info("Mute functionality not yet implemented.")
      setConversationMenuOpen(null)
    } catch (error) {
      log.error("Failed to update mute status:", error)
      toast.error("Failed to update mute status")
    }
  }

  // Format message preview
  const formatPreview = (message) => {
    if (message?.type === "file" && message.metadata?.mimeType) {
      const modifiedMessage = {
        ...message,
        metadata: {
          ...message.metadata,
          fileType: message.metadata.mimeType,
        },
      }
      return formatMessagePreview(modifiedMessage, user?._id)
    }
    return formatMessagePreview(message, user?._id)
  }

  // Format timestamp relative to now
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return ""
    try {
      return formatDistanceToNowStrict(new Date(timestamp), { addSuffix: true })
    } catch (e) {
      log.warn("Error formatting timestamp:", timestamp, e)
      return ""
    }
  }

  // Mobile: Handle closing the chat panel
  const handleCloseChatPanel = () => {
    setIsChatPanelVisible(false)
    // Navigate back to the base /messages URL when closing on mobile
    if (window.innerWidth <= 768) {
      navigate("/messages", { replace: true })
    }
    setActiveConversation(null)
    setSelectedConversationRecipient(null)
  }

  // Render message type icon based on type
  const getMessageTypeIcon = (message) => {
    if (!message || message.sender === user?._id) return null

    // Import icons dynamically based on message type
    const IconMap = {
      wink: (
        <span className="message-type-icon wink" title="Wink">
          😉
        </span>
      ),
      file: message.metadata?.mimeType?.startsWith("image/") ? (
        <span className="message-type-icon image" title="Image">
          🖼️
        </span>
      ) : (
        <span className="message-type-icon file" title="File">
          📎
        </span>
      ),
      video: (
        <span className="message-type-icon video" title="Video">
          📹
        </span>
      ),
    }

    // Return the icon for this message type or null
    return IconMap[message.type] || null
  }

  // Handle retry button click
  const handleRetry = () => {
    getConversations(true)
  }

  // Handle session reset
  const handleResetSession = () => {
    if (window.confirm("This will log you out. You'll need to sign in again. Continue?")) {
      resetUserSession()
    }
  }

  // Create mock conversations for development/testing
  const createMockConversations = () => {
    const mockData = [
      {
        _id: "mock1",
        user: {
          _id: "user1",
          nickname: "John Doe",
          isOnline: true,
          photos: [],
        },
        lastMessage: {
          content: "Hey, how are you?",
          createdAt: new Date(Date.now() - 1000 * 60 * 5),
          sender: "user1",
        },
        unreadCount: 2,
      },
      {
        _id: "mock2",
        user: {
          _id: "user2",
          nickname: "Jane Smith",
          isOnline: false,
          photos: [],
        },
        lastMessage: {
          content: "Let's meet tomorrow",
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
          sender: user?._id,
        },
        unreadCount: 0,
      },
      {
        _id: "mock3",
        user: {
          _id: "user3",
          nickname: "Test Bot",
          isOnline: true,
          photos: [],
        },
        lastMessage: {
          content: "This is a test message. Click to see the full conversation.",
          createdAt: new Date(),
          sender: "user3",
        },
        unreadCount: 1,
      },
    ]

    setConversations(mockData)
    setFilteredConversations(mockData)
    setLoading(false)
    setError(null)
    toast.info("Loaded mock conversations for testing")
    initialLoadCompletedRef.current = true;
  }
  
  // Optionally show mock data in development if nothing is loaded after some time
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const autoMockTimeout = setTimeout(() => {
        // If we have no conversations after loading has completed, show mock data
        if (conversations.length === 0 && !loading && !error && initialLoadCompletedRef.current) {
          log.info("Auto-generating mock conversations for development");
          createMockConversations();
        }
      }, 5000);
      
      return () => {
        clearTimeout(autoMockTimeout);
      };
    }
  }, [conversations.length, loading, error]);

  return (
    <div className="messages-page-layout">
      <Navbar />
      <div className="messages-main-content">
        <div className={classNames("conversations-panel-wrapper", isChatPanelVisible ? "mobile-hidden" : "")}>
          <div className="conversations-header">
            <h2>Messages</h2>
            <div className="search-container">
              <FaSearch className="search-icon" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={handleSearchChange}
                ref={searchInputRef}
                className="search-input"
                aria-label="Search conversations"
              />
              {searchQuery && (
                <button className="clear-search" onClick={handleClearSearch} aria-label="Clear search">
                  &times;
                </button>
              )}
            </div>
          </div>
          <div className="conversations-list" ref={conversationListRef}>
            {loading ? (
              <div className="loading-state">
                <FaSpinner className="fa-spin" />
                <p>Loading conversations...</p>
                {retryCount > 0 && <p className="retry-info">Attempt {retryCount} - Please wait...</p>}
                {retryCount > 2 && (
                  <div className="loading-fallback">
                    <p>This is taking longer than expected.</p>
                    <div className="error-actions">
                      <button onClick={handleRetry} className="retry-button">
                        <FaSync /> Retry
                      </button>
                      <button onClick={handleResetSession} className="reset-button">
                        Reset Session
                      </button>
                      {process.env.NODE_ENV === "development" && (
                        <button onClick={createMockConversations} className="mock-button">
                          Use Mock Data
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : error ? (
              <div className="error-state">
                <FaExclamationTriangle className="error-icon" />
                <p>{error || "Failed to load conversations"}</p>
                <div className="error-actions">
                  <button onClick={handleRetry} className="retry-button">
                    <FaSync className={loading ? "fa-spin" : ""} /> Retry
                  </button>

                  <button onClick={handleResetSession} className="reset-button">
                    Reset Session
                  </button>
                  
                  {process.env.NODE_ENV === "development" && (
                    <button onClick={createMockConversations} className="mock-button">
                      Use Mock Data
                    </button>
                  )}
                </div>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="empty-state">
                <p>{searchQuery ? "No conversations match search" : "No conversations yet"}</p>
                {!searchQuery && (
                  <button className="start-chat-btn" onClick={() => navigate("/dashboard")}>
                    Find Users
                  </button>
                )}
                {process.env.NODE_ENV === "development" && (
                  <button onClick={createMockConversations} className="mock-button mt-2">
                    Use Mock Data
                  </button>
                )}
              </div>
            ) : (
              filteredConversations.map((conversation) => {
                // Get the user data from the conversation
                const userData = conversation?.user
                if (!conversation?._id || !userData?._id) {
                  log.warn("Skipping invalid conversation:", conversation)
                  return null
                }
                const recipientId = userData._id
                const isSelected = selectedConversationRecipient?._id === recipientId
                const muted = conversation.muted || false

                return (
                  <div
                    key={conversation._id}
                    className={classNames(
                      "conversation-item",
                      isSelected ? "selected" : "",
                      conversation.unreadCount > 0 ? "unread" : "",
                    )}
                    onClick={() => handleSelectConversation(userData)}
                    role="button"
                    tabIndex={0}
                    aria-selected={isSelected}
                  >
                    <div className="avatar-container">
                      {userData?.photos?.length > 0 ? (
                        <img
                          src={normalizePhotoUrl(userData.photos[0].url) || "/placeholder.svg?height=50&width=50"}
                          alt={userData.nickname || `User ${recipientId}`}
                          className="avatar"
                          onError={(e) => {
                            e.target.onerror = null
                            e.target.src = "/placeholder.svg?height=50&width=50"
                          }}
                        />
                      ) : (
                        <FaUserCircle className="avatar-placeholder" />
                      )}
                      {userData?.isOnline && <span className="online-indicator" />}
                    </div>
                    <div className="conversation-info">
                      <div className="conversation-info-header">
                        <h3 className="recipient-name">{userData.nickname || "User"}</h3>
                        <span className="timestamp">{formatTimestamp(conversation.lastMessage?.createdAt)}</span>
                      </div>
                      <div className="last-message">
                        {getMessageTypeIcon(conversation.lastMessage)}
                        <p className="message-preview">{formatPreview(conversation.lastMessage)}</p>
                        {conversation.unreadCount > 0 && (
                          <span className="unread-badge">
                            {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="conversation-actions">
                      <button
                        className="conversation-menu-btn"
                        onClick={(e) => toggleConversationMenu(e, recipientId)}
                        aria-label="Conversation options"
                      >
                        <FaEllipsisV />
                      </button>
                      {conversationMenuOpen === recipientId && (
                        <div className="conversation-menu" onClick={(e) => e.stopPropagation()}>
                          <button onClick={(e) => handleToggleMute(e, conversation._id, muted)}>
                            {muted ? <FaBell /> : <FaBellSlash />} {muted ? "Unmute" : "Mute"}
                          </button>
                          <button className="delete-btn" onClick={(e) => handleDeleteConversation(e, recipientId)}>
                            <FaRegTrashAlt /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
        <div className={classNames("chat-panel-wrapper", !isChatPanelVisible ? "mobile-hidden" : "")}>
          {selectedConversationRecipient ? (
            <chat.EmbeddedChat
              key={selectedConversationRecipient._id} // Force re-mount on recipient change
              recipient={selectedConversationRecipient}
              isOpen={true}
              onClose={handleCloseChatPanel}
              embedded={false}
            />
          ) : (
            <div className="no-chat-selected">
              <FaChevronLeft className="select-arrow-icon" />
              <h3>Select a conversation</h3>
              <p>Choose someone from the list to start chatting.</p>
            </div>
          )}
        </div>
      </div>
      <style>{`
        .messages-page-layout {
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow: hidden;
        }
        .messages-main-content {
          display: flex;
          flex-grow: 1;
          overflow: hidden;
          background-color: var(--bg-light);
        }
        .conversations-panel-wrapper {
          width: 320px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          border-right: 1px solid var(--border-color);
          background-color: var(--white);
        }
        .chat-panel-wrapper {
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          background-color: var(--bg-card);
          overflow: hidden;
        }

        /* Override EmbeddedChat styles */
        .chat-panel-wrapper > :global(.embedded-chat) {
          position: relative !important;
          height: 100% !important;
          width: 100% !important;
          max-width: none !important;
          max-height: none !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          border: none !important;
          animation: none !important;
          bottom: auto !important;
          right: auto !important;
          z-index: 1 !important;
          display: flex !important;
          flex-direction: column !important;
          flex-grow: 1 !important;
          overflow: hidden;
        }
        /* Ensure inner chat container also takes full height */
        .chat-panel-wrapper > :global(.embedded-chat > div:first-child) {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .conversations-header {
          padding: 16px;
          border-bottom: 1px solid var(--border-color);
          flex-shrink: 0;
        }
        .conversations-header h2 {
          font-size: 1.1rem;
          font-weight: 600;
          margin: 0 0 12px 0;
        }
        .search-container {
          position: relative;
        }
        .search-icon {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-light);
        }
        .search-input {
          width: 100%;
          padding: 8px 12px 8px 35px;
          border-radius: 20px;
          border: 1px solid var(--border-color);
          background-color: var(--bg-light);
        }
        .clear-search {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: var(--text-light);
          cursor: pointer;
          font-size: 1.2rem;
        }
        .conversations-list {
          flex-grow: 1;
          overflow-y: auto;
          padding: 8px;
          scrollbar-width: thin;
          scrollbar-color: var(--border-color) transparent;
        }
        .conversations-list::-webkit-scrollbar {
          width: 5px;
        }
        .conversations-list::-webkit-scrollbar-thumb {
          background-color: var(--border-color);
          border-radius: 10px;
        }
        .conversation-item {
          display: flex;
          padding: 12px 8px;
          border-radius: 8px;
          margin-bottom: 4px;
          cursor: pointer;
          transition: background-color 0.2s ease;
          position: relative;
        }
        .conversation-item:hover {
          background-color: var(--bg-light);
        }
        .conversation-item.selected {
          background-color: var(--primary-subtle);
        }
        .conversation-item.unread .recipient-name,
        .conversation-item.unread .message-preview {
          font-weight: 600;
          color: var(--text-dark);
        }
        .conversation-item.unread .message-type-icon {
          color: var(--text-dark);
        }
        .avatar-container {
          position: relative;
          margin-right: 12px;
          flex-shrink: 0;
        }
        .avatar {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          object-fit: cover;
        }
        .avatar-placeholder {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background-color: var(--light);
          color: var(--text-light);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
        }
        .online-indicator {
          position: absolute;
          bottom: 2px;
          right: 2px;
          width: 12px;
          height: 12px;
          background-color: var(--success);
          border-radius: 50%;
          border: 2px solid var(--white);
        }
        .conversation-info {
          flex-grow: 1;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .conversation-info-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
        }
        .recipient-name {
          font-weight: 500;
          font-size: 0.9rem;
          color: var(--text-dark);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin: 0;
        }
        .timestamp {
          font-size: 0.7rem;
          color: var(--text-light);
          flex-shrink: 0;
          margin-left: 8px;
        }
        .last-message {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 2px;
          max-width: 100%;
        }
        .message-type-icon {
          font-size: 0.8rem;
          color: var(--text-light);
          flex-shrink: 0;
        }
        .message-preview {
          font-size: 0.8rem;
          color: var(--text-light);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin: 0;
          flex-grow: 1;
        }
        .unread-badge {
          background-color: var(--primary);
          color: white;
          font-size: 0.7rem;
          font-weight: bold;
          padding: 1px 6px;
          border-radius: 10px;
          margin-left: 8px;
          flex-shrink: 0;
        }
        .conversation-actions {
          position: relative;
        }
        .conversation-menu-btn {
          background: none;
          border: none;
          color: var(--text-light);
          cursor: pointer;
          padding: 5px;
          margin-left: 5px;
          border-radius: 50%;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.2s;
        }
        .conversation-menu-btn:hover {
          background-color: var(--bg-light);
        }
        .conversation-menu {
          position: absolute;
          right: 0;
          top: 35px;
          background-color: var(--white);
          border-radius: 8px;
          box-shadow: var(--shadow);
          z-index: 10;
          overflow: hidden;
          min-width: 120px;
          border: 1px solid var(--border-color);
        }
        .conversation-menu button {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 8px 12px;
          text-align: left;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 0.85rem;
          color: var(--text-medium);
        }
        .conversation-menu button:hover {
          background-color: var(--bg-light);
        }
        .conversation-menu button.delete-btn {
          color: var(--danger);
        }
        .conversation-menu button.delete-btn:hover {
          background-color: var(--danger-light);
        }
        .no-chat-selected {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          text-align: center;
          color: var(--text-light);
          background-color: var(--bg-card);
          padding: 20px;
        }
        .no-chat-selected h3 {
          margin-top: 16px;
          font-size: 1.1rem;
          color: var(--text-medium);
        }
        .select-arrow-icon {
          font-size: 2rem;
          color: var(--border-color);
          margin-bottom: 16px;
          animation: bounce-left 1.5s infinite;
        }
        @keyframes bounce-left {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(-10px); }
        }

        .loading-state, .error-state, .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px;
          color: var(--text-light);
          height: calc(100% - 100px);
          text-align: center;
        }
        
        .loading-fallback {
          margin-top: 1.5rem;
          padding: 1rem;
          background-color: var(--bg-light);
          border-radius: 8px;
          width: 90%;
          max-width: 300px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.1);
        }
        .error-icon {
          font-size: 2rem;
          color: var(--danger);
          margin-bottom: 16px;
        }
        .error-state p {
          max-width: 80%;
          margin-bottom: 16px;
          color: var(--danger);
        }
        .retry-info {
          font-size: 0.8rem;
          color: var(--text-light);
          margin-top: 8px;
        }
        .error-actions {
          display: flex;
          gap: 10px;
          margin-top: 10px;
          flex-wrap: wrap;
          justify-content: center;
        }
        .retry-button, .reset-button, .mock-button {
          padding: 8px 16px;
          border-radius: 20px;
          cursor: pointer;
          font-weight: 500;
          border: none;
          transition: background-color 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .retry-button {
          background-color: var(--primary);
          color: white;
        }
        .retry-button:hover {
          background-color: var(--primary-dark);
        }
        .reset-button {
          background-color: var(--danger);
          color: white;
        }
        .reset-button:hover {
          background-color: var(--danger-dark);
        }
        .mock-button {
          background-color: var(--warning);
          color: var(--dark);
        }
        .mock-button:hover {
          background-color: var(--warning-dark);
        }
        .mt-2 {
          margin-top: 8px;
        }
        .start-chat-btn {
          margin-top: 16px;
          padding: 8px 16px;
          background-color: var(--primary);
          color: white;
          border: none;
          border-radius: 20px;
          cursor: pointer;
        }

        /* Loading spinner animation */
        .fa-spin {
          animation: fa-spin 2s infinite linear;
        }
        @keyframes fa-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(359deg); }
        }

        /* Mobile adjustments */
        @media (max-width: 768px) {
          .messages-main-content {
            position: relative;
            overflow: hidden;
          }
          .conversations-panel-wrapper, .chat-panel-wrapper {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            transition: transform 0.3s ease-in-out;
            backface-visibility: hidden;
            background-color: var(--bg-color);
          }
          .conversations-panel-wrapper {
            transform: translateX(0);
            z-index: 2;
          }
          .conversations-panel-wrapper.mobile-hidden {
            transform: translateX(-100%);
            pointer-events: none;
          }
          .chat-panel-wrapper {
            transform: translateX(100%);
            z-index: 1;
          }
          .chat-panel-wrapper:not(.mobile-hidden) {
            transform: translateX(0);
            z-index: 3;
          }
          /* Add mobile back button style */
          :global(.embedded-chat .mobile-back-button) {
            display: flex !important;
            align-items: center;
            justify-content: center;
            position: absolute;
            left: 10px;
            top: 50%;
            transform: translateY(-50%);
            background: rgba(255, 255, 255, 0.15);
            border: none;
            font-size: 1.2rem;
            color: white;
            cursor: pointer;
            z-index: 10;
            padding: 0;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            backdrop-filter: blur(5px);
          }
          :global(.embedded-chat .mobile-back-button:hover) {
            background: rgba(255, 255, 255, 0.25);
          }
          /* Adjust header padding for back button */
          .chat-panel-wrapper > :global(.embedded-chat .chat-header) {
            padding-left: 60px;
            position: relative;
          }
        }

        /* Dark mode adjustments */
        .dark .conversations-panel-wrapper {
          background-color: var(--medium);
          border-color: var(--border-dark);
        }
        .dark .chat-panel-wrapper {
          background-color: var(--dark);
        }
        .dark .search-input {
          background-color: var(--dark);
          border-color: var(--border-dark);
          color: var(--text-dark);
        }
        .dark .conversation-item:hover {
          background-color: rgba(255, 255, 255, 0.05);
        }
        .dark .conversation-item.selected {
          background-color: rgba(var(--primary-rgb), 0.15);
        }
        .dark .conversation-menu {
          background-color: var(--dark);
          border-color: var(--border-dark);
        }
        .dark .conversation-menu button {
          color: var(--text-medium);
        }
        .dark .conversation-menu button:hover {
          background-color: rgba(255, 255, 255, 0.05);
        }
        .dark .conversation-menu button.delete-btn {
          color: var(--danger);
        }
        .dark .conversation-menu button.delete-btn:hover {
          background-color: var(--danger-light);
        }
        .dark .no-chat-selected {
          background-color: var(--dark);
          color: var(--text-light);
        }
        .dark .select-arrow-icon {
          color: var(--border-dark);
        }
        /* Ensure EmbeddedChat in dark mode inherits background */
        .dark .chat-panel-wrapper > :global(.embedded-chat) {
          background-color: inherit;
        }
      `}</style>
    </div>
  )
}

export default MessagesPage
