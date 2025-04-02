"use client"

// client/src/pages/Messages.jsx
import { useState, useEffect, useCallback, useRef } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useAuth } from "../context"
import { Navbar } from "../components/LayoutComponents"
import { EmbeddedChat } from "../components"
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
      // Import ChatService for proper initialization
      const chatService = require('../services/ChatService').default;
        
      // First, make sure ChatService is initialized
      if (user?._id) {
        log.info(`Ensuring ChatService is initialized for user ${user._id}`);
        chatService.initialize(user);
      }
      
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
    <div className="messages-page-layout d-flex flex-column vh-100 overflow-hidden">
      <Navbar />
      <div className="messages-main-content d-flex flex-grow-1 overflow-hidden bg-light-subtle">
        <div className="conversations-panel-wrapper w-320px flex-shrink-0 d-flex flex-column border-right bg-white" style={{ 
          transform: isChatPanelVisible && window.innerWidth < 768 ? 'translateX(-100%)' : 'none',
          pointerEvents: isChatPanelVisible && window.innerWidth < 768 ? 'none' : 'auto'
        }}>
          <div className="conversations-header p-4 border-bottom flex-shrink-0">
            <h2 className="font-weight-bold font-size-lg mb-3">Messages</h2>
            <div className="search-container position-relative">
              <FaSearch className="search-icon position-absolute left-3 top-50 transform-translateY--50 text-opacity-60" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={handleSearchChange}
                ref={searchInputRef}
                className="search-input w-100 py-2 px-4 pl-9 rounded-pill border focus-ring bg-light-subtle"
                aria-label="Search conversations"
              />
              {searchQuery && (
                <button 
                  className="clear-search position-absolute right-3 top-50 transform-translateY--50 bg-transparent border-0 text-opacity-60 cursor-pointer text-lg" 
                  onClick={handleClearSearch} 
                  aria-label="Clear search"
                >
                  &times;
                </button>
              )}
            </div>
          </div>
          <div className="conversations-list flex-grow-1 overflow-y-auto p-2 custom-scrollbar" ref={conversationListRef}>
            {loading ? (
              <div className="d-flex flex-column align-items-center justify-content-center p-5 text-opacity-70 h-100 text-center">
                <FaSpinner className="fa-spin text-primary text-xl mb-4" />
                <p className="mb-2">Loading conversations...</p>
                {retryCount > 0 && <p className="text-xs text-opacity-60 mt-2">Attempt {retryCount} - Please wait...</p>}
                {retryCount > 2 && (
                  <div className="mt-5 p-4 bg-light rounded-lg shadow-sm w-90 max-w-md">
                    <p className="mb-3 font-weight-medium">This is taking longer than expected.</p>
                    <div className="d-flex gap-2 flex-wrap justify-content-center">
                      <button onClick={handleRetry} className="btn btn-primary btn-sm d-flex align-items-center gap-2 rounded-pill shadow-sm">
                        <FaSync /> <span>Retry</span>
                      </button>
                      <button onClick={handleResetSession} className="btn btn-danger btn-sm d-flex align-items-center gap-2 rounded-pill shadow-sm">
                        <span>Reset Session</span>
                      </button>
                      {process.env.NODE_ENV === "development" && (
                        <button onClick={createMockConversations} className="btn btn-warning btn-sm d-flex align-items-center gap-2 rounded-pill shadow-sm">
                          <span>Use Mock Data</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : error ? (
              <div className="d-flex flex-column align-items-center justify-content-center p-5 text-danger h-100 text-center">
                <FaExclamationTriangle className="text-danger text-3xl mb-4" />
                <p className="mb-4 max-w-80 font-weight-medium">{error || "Failed to load conversations"}</p>
                <div className="d-flex gap-2 flex-wrap justify-content-center">
                  <button onClick={handleRetry} className="btn btn-primary btn-sm d-flex align-items-center gap-2 rounded-pill shadow-sm hover-scale transition-all">
                    <FaSync className={loading ? "fa-spin" : ""} /> <span>Retry</span>
                  </button>

                  <button onClick={handleResetSession} className="btn btn-danger btn-sm d-flex align-items-center gap-2 rounded-pill shadow-sm hover-scale transition-all">
                    <span>Reset Session</span>
                  </button>
                  
                  {process.env.NODE_ENV === "development" && (
                    <button onClick={createMockConversations} className="btn btn-warning btn-sm d-flex align-items-center gap-2 rounded-pill shadow-sm hover-scale transition-all">
                      <span>Use Mock Data</span>
                    </button>
                  )}
                </div>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="d-flex flex-column align-items-center justify-content-center p-5 text-opacity-70 h-100 text-center">
                <p className="mb-4">{searchQuery ? "No conversations match search" : "No conversations yet"}</p>
                {!searchQuery && (
                  <button 
                    className="btn btn-primary btn-sm d-flex align-items-center gap-2 rounded-pill shadow-sm hover-scale transition-all px-4 py-2"
                    onClick={() => navigate("/dashboard")}
                  >
                    <span>Find Users</span>
                  </button>
                )}
                {process.env.NODE_ENV === "development" && (
                  <button 
                    onClick={createMockConversations} 
                    className="btn btn-warning btn-sm d-flex align-items-center gap-2 rounded-pill shadow-sm hover-scale transition-all mt-3"
                  >
                    <span>Use Mock Data</span>
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
                      "d-flex p-3 rounded-lg mb-1 cursor-pointer transition-all hover-bg-light-subtle",
                      isSelected ? "bg-primary-50" : "",
                      conversation.unreadCount > 0 ? "font-weight-medium" : "",
                    )}
                    onClick={() => handleSelectConversation(userData)}
                    role="button"
                    tabIndex={0}
                    aria-selected={isSelected}
                  >
                    <div className="position-relative mr-3 flex-shrink-0">
                      {userData?.photos?.length > 0 ? (
                        <img
                          src={normalizePhotoUrl(userData.photos[0].url) || "/placeholder.svg?height=50&width=50"}
                          alt={userData.nickname || `User ${recipientId}`}
                          className="w-50px h-50px rounded-circle object-cover shadow-sm"
                          onError={(e) => {
                            e.target.onerror = null
                            e.target.src = "/placeholder.svg?height=50&width=50"
                          }}
                        />
                      ) : (
                        <FaUserCircle className="w-50px h-50px text-opacity-60" />
                      )}
                      {userData?.isOnline && (
                        <span className="position-absolute bottom-0 right-0 w-12px h-12px bg-success rounded-circle border-2 border-white" />
                      )}
                    </div>
                    <div className="flex-grow-1 overflow-hidden d-flex flex-column justify-content-center min-width-0">
                      <div className="d-flex justify-content-between align-items-baseline mb-1">
                        <h3 className="font-weight-medium font-size-sm text-truncate m-0">{userData.nickname || "User"}</h3>
                        <span className="text-xs text-opacity-60 ml-2 flex-shrink-0">{formatTimestamp(conversation.lastMessage?.createdAt)}</span>
                      </div>
                      <div className="d-flex align-items-center gap-1 min-width-0">
                        {getMessageTypeIcon(conversation.lastMessage)}
                        <p className="text-sm text-opacity-70 text-truncate m-0 flex-grow-1">{formatPreview(conversation.lastMessage)}</p>
                        {conversation.unreadCount > 0 && (
                          <span className="flex-shrink-0 bg-primary text-white text-xs font-weight-bold px-2 py-1 rounded-pill ml-2">
                            {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="position-relative ml-2">
                      <button
                        className="bg-transparent border-0 text-opacity-60 cursor-pointer p-1 rounded-circle hover-bg-light-subtle transition-all d-flex align-items-center justify-content-center w-30px h-30px"
                        onClick={(e) => toggleConversationMenu(e, recipientId)}
                        aria-label="Conversation options"
                      >
                        <FaEllipsisV />
                      </button>
                      {conversationMenuOpen === recipientId && (
                        <div className="position-absolute right-0 top-35px bg-white rounded-lg shadow-md z-10 overflow-hidden min-w-120px border" onClick={(e) => e.stopPropagation()}>
                          <button 
                            className="d-flex align-items-center gap-2 w-100 py-2 px-3 text-left bg-transparent border-0 cursor-pointer text-sm text-opacity-70 hover-bg-light-subtle transition-all"
                            onClick={(e) => handleToggleMute(e, conversation._id, muted)}
                          >
                            {muted ? <FaBell className="text-primary" /> : <FaBellSlash className="text-primary" />} {muted ? "Unmute" : "Mute"}
                          </button>
                          <button 
                            className="d-flex align-items-center gap-2 w-100 py-2 px-3 text-left bg-transparent border-0 cursor-pointer text-sm text-danger hover-bg-danger-50 transition-all"
                            onClick={(e) => handleDeleteConversation(e, recipientId)}
                          >
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
        <div className="flex-grow-1" style={{ position: 'relative', height: '100%' }}>
          {selectedConversationRecipient ? (
            <EmbeddedChat
              key={selectedConversationRecipient._id}
              recipient={selectedConversationRecipient}
              isOpen={true}
              onClose={handleCloseChatPanel}
              embedded={false}
            />
          ) : (
            <div className="d-flex flex-column align-items-center justify-content-center h-100 text-center text-opacity-70 p-5 bg-white">
              <FaChevronLeft className="text-3xl text-opacity-40 mb-4 animate-pulse" />
              <h3 className="font-weight-medium mb-2 text-lg">Select a conversation</h3>
              <p className="text-sm max-w-xs">Choose someone from the list to start chatting.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MessagesPage
