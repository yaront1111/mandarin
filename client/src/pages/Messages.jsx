// client/src/pages/Messages.jsx
import { useState, useEffect, useCallback, useRef, Suspense, lazy } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context";
import { Navbar } from "../components/LayoutComponents";
import { LoadingSpinner } from "../components/common";
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
  FaArrowUp,
  FaFilter,
  FaPlus,
  FaTimes,
  FaCircle,
  FaInbox
} from "react-icons/fa";
import { formatDistanceToNowStrict } from "date-fns";
import { formatMessagePreview, classNames, normalizePhotoUrl, logger } from "../utils";
import { toast } from "react-toastify";
import { useApi } from "../hooks/useApi";
import { AnimatePresence, motion } from "framer-motion";

// Create a logger for this component
const log = logger.create("Messages");

// Lazy load the embedded chat component for better performance
const EmbeddedChat = lazy(() => import("../components/EmbeddedChat"));

/**
 * ConversationSkeleton - Loading placeholder for conversation items
 */
const ConversationSkeleton = () => (
  <div className="d-flex p-3 rounded-lg mb-1 animate-pulse">
    <div className="position-relative mr-3 flex-shrink-0">
      <div className="w-50px h-50px rounded-circle bg-light-subtle"></div>
    </div>
    <div className="flex-grow-1 overflow-hidden d-flex flex-column justify-content-center">
      <div className="d-flex justify-content-between align-items-baseline mb-1">
        <div className="bg-light-subtle h-16px w-120px rounded"></div>
        <div className="bg-light-subtle h-12px w-40px rounded ml-2"></div>
      </div>
      <div className="bg-light-subtle h-14px w-75% rounded"></div>
    </div>
  </div>
);

/**
 * EmptyStateDisplay - Component shown when no conversations exist
 */
const EmptyStateDisplay = ({ searchQuery, onFindUsers, onCreateMock }) => (
  <div className="d-flex flex-column align-items-center justify-content-center p-5 text-opacity-70 h-100 text-center">
    <FaInbox size={48} className="text-opacity-30 mb-3" />
    <p className="mb-4">{searchQuery ? "No conversations match your search" : "No conversations yet"}</p>
    {!searchQuery && (
      <div className="d-flex flex-column gap-2">
        <button
          className="btn btn-primary btn-sm d-flex align-items-center gap-2 rounded-pill shadow-sm hover-scale transition-all px-4 py-2"
          onClick={onFindUsers}
        >
          <FaPlus size={12} /> <span>Start a Conversation</span>
        </button>

        {process.env.NODE_ENV === "development" && (
          <button
            onClick={onCreateMock}
            className="btn btn-warning btn-sm d-flex align-items-center gap-2 rounded-pill shadow-sm hover-scale transition-all mt-2"
          >
            <span>Use Mock Data</span>
          </button>
        )}
      </div>
    )}
  </div>
);

/**
 * Error display component
 */
const ErrorDisplay = ({ error, onRetry, onReset, onCreateMock }) => (
  <div className="d-flex flex-column align-items-center justify-content-center p-5 text-danger h-100 text-center">
    <FaExclamationTriangle className="text-danger text-3xl mb-4" />
    <p className="mb-4 max-w-80 font-weight-medium">{error || "Failed to load conversations"}</p>
    <div className="d-flex gap-2 flex-wrap justify-content-center">
      <button
        onClick={onRetry}
        className="btn btn-primary btn-sm d-flex align-items-center gap-2 rounded-pill shadow-sm hover-scale transition-all"
      >
        <FaSync /> <span>Retry</span>
      </button>

      <button
        onClick={onReset}
        className="btn btn-danger btn-sm d-flex align-items-center gap-2 rounded-pill shadow-sm hover-scale transition-all"
      >
        <span>Reset Session</span>
      </button>

      {process.env.NODE_ENV === "development" && (
        <button
          onClick={onCreateMock}
          className="btn btn-warning btn-sm d-flex align-items-center gap-2 rounded-pill shadow-sm hover-scale transition-all"
        >
          <span>Use Mock Data</span>
        </button>
      )}
    </div>
  </div>
);

/**
 * Loading state component
 */
const LoadingState = ({ onRetry, onReset, onCreateMock }) => (
  <div className="d-flex flex-column align-items-center justify-content-center p-5 text-opacity-70 h-100 text-center">
    <FaSpinner className="fa-spin text-primary text-xl mb-4" />
    <p className="mb-2">Loading conversations...</p>
    <div className="mt-5 p-4 bg-light rounded-lg shadow-sm w-90 max-w-md">
      <p className="mb-3 font-weight-medium">Taking longer than expected?</p>
      <div className="d-flex gap-2 flex-wrap justify-content-center">
        <button
          onClick={onRetry}
          className="btn btn-primary btn-sm d-flex align-items-center gap-2 rounded-pill shadow-sm"
        >
          <FaSync /> <span>Retry</span>
        </button>
        <button
          onClick={onReset}
          className="btn btn-danger btn-sm d-flex align-items-center gap-2 rounded-pill shadow-sm"
        >
          <span>Reset Session</span>
        </button>
        {process.env.NODE_ENV === "development" && (
          <button
            onClick={onCreateMock}
            className="btn btn-warning btn-sm d-flex align-items-center gap-2 rounded-pill shadow-sm"
          >
            <span>Use Mock Data</span>
          </button>
        )}
      </div>
    </div>
  </div>
);

/**
 * No selected conversation placeholder
 */
const NoSelectedConversation = () => (
  <div className="d-flex flex-column align-items-center justify-content-center h-100 text-center text-opacity-70 p-5 bg-white">
    <FaChevronLeft className="text-3xl text-opacity-40 mb-4 animate-pulse" />
    <h3 className="font-weight-medium mb-2 text-lg">Select a conversation</h3>
    <p className="text-sm max-w-xs">Choose someone from the list to start chatting.</p>
  </div>
);

/**
 * Main Messages Page Component
 */
const MessagesPage = () => {
  // Get auth state and API client
  const { user, authChecked, isAuthenticated } = useAuth();
  const api = useApi();
  const navigate = useNavigate();
  const { userId: selectedUserIdFromParams } = useParams();

  // State for conversations
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedConversationRecipient, setSelectedConversationRecipient] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredConversations, setFilteredConversations] = useState([]);
  const [conversationMenuOpen, setConversationMenuOpen] = useState(null);
  const [isChatPanelVisible, setIsChatPanelVisible] = useState(false);
  const [activeConversation, setActiveConversation] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);

  // Refs
  const searchInputRef = useRef(null);
  const conversationListRef = useRef(null);
  const safetyTimeoutRef = useRef(null);
  const initialLoadAttemptedRef = useRef(false);

  // 1. First define helper functions in the correct order
  const createMockConversations = useCallback(() => {
    console.log("Creating mock conversations");

    const mockData = [
      {
        _id: "mock1",
        user: {
          _id: "user1",
          nickname: "Connection Error",
          isOnline: true,
          photos: [],
        },
        lastMessage: {
          content: "Server connection issues detected. Please try refreshing the page.",
          createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
          sender: "user1",
        },
        unreadCount: 1,
      },
      {
        _id: "mock2",
        user: {
          _id: "user2",
          nickname: "Support Team",
          isOnline: true,
          photos: [],
        },
        lastMessage: {
          content: "Welcome! The API is experiencing issues. Try refreshing in a few minutes.",
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
          sender: "user2",
        },
        unreadCount: 1,
      },
      {
        _id: "mock3",
        user: {
          _id: "user3",
          nickname: "Demo User",
          isOnline: false,
          photos: [],
        },
        lastMessage: {
          content: "This is a test message using mock data.",
          createdAt: new Date().toISOString(),
          sender: user?._id || "unknown",
        },
        unreadCount: 0,
      },
    ];

    setConversations(mockData);
    setFilteredConversations(mockData);
    setLoading(false);
    setError(null);
    toast.info("Using mock conversations", { autoClose: 3000 });
    return mockData;
  }, [user]);

  // 2. Define applyFiltersToConversations before it's used in getConversations
  const applyFiltersToConversations = useCallback((conversationsToFilter, query) => {
    if (!Array.isArray(conversationsToFilter)) {
      setFilteredConversations([]);
      return;
    }

    let filtered = [...conversationsToFilter];
    const searchTerm = query.toLowerCase().trim();

    // Apply search filter if present
    if (searchTerm) {
      filtered = filtered.filter((convo) => {
        const userData = convo?.user;
        return (
          userData?.nickname?.toLowerCase().includes(searchTerm) ||
          convo?.lastMessage?.content?.toLowerCase().includes(searchTerm)
        );
      });
    }

    setFilteredConversations(filtered);
  }, []);

  // 3. Now define getConversations after its dependencies
  const getConversations = useCallback(async (forceRefresh = false) => {
    // Skip if not authenticated or no user ID
    if (!isAuthenticated || !user?._id) {
      console.log("Not authenticated or missing user ID, skipping conversation fetch");
      setLoading(false);
      return [];
    }

    // Set up safety timeout to ensure loading state doesn't get stuck
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
    }

    safetyTimeoutRef.current = setTimeout(() => {
      console.log('Conversation loading timeout reached, resetting loading state');
      setLoading(false);
      setError('Loading conversations timed out. Please try again.');
    }, 10000);

    setLoading(true);
    setError(null);

    try {
      console.log("Fetching conversations from API");

      // Direct API call approach for reliability
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await fetch('/api/messages/conversations', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      clearTimeout(safetyTimeoutRef.current);

      if (!response.ok) {
        console.error(`API returned status ${response.status}`);
        throw new Error(`Server returned error: ${response.status}`);
      }

      const data = await response.json();

      if (data && data.success && Array.isArray(data.data)) {
        console.log(`Loaded ${data.data.length} conversations successfully`);

        // Update state
        setConversations(data.data);
        applyFiltersToConversations(data.data, searchQuery);
        setLoading(false);

        return data.data;
      } else {
        throw new Error("Invalid data structure received from server");
      }
    } catch (err) {
      console.error("Error fetching conversations:", err);
      clearTimeout(safetyTimeoutRef.current);

      setLoading(false);
      setError(err.message || "Failed to load conversations");

      // Try fallback API if direct call fails
      try {
        const apiResponse = await api.get("/messages/conversations");

        if (apiResponse && apiResponse.success && Array.isArray(apiResponse.data)) {
          console.log("Fallback API call successful");

          setConversations(apiResponse.data);
          applyFiltersToConversations(apiResponse.data, searchQuery);
          setError(null);

          return apiResponse.data;
        }
      } catch (fallbackErr) {
        console.error("Fallback API also failed:", fallbackErr);
        // Leave error state as is
      }

      return [];
    }
  }, [isAuthenticated, user, api, searchQuery, applyFiltersToConversations]);

  // 4. Define remaining callback functions after their dependencies
  const handleRetry = useCallback(() => {
    getConversations(true);
  }, [getConversations]);

  const handleResetSession = useCallback(() => {
    if (window.confirm("This will log you out. You'll need to sign in again. Continue?")) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = "/login";
    }
  }, []);

  const handleFindUsers = useCallback(() => {
    navigate("/dashboard");
  }, [navigate]);

  // Format timestamp helper
  const formatTimestamp = useCallback((timestamp) => {
    if (!timestamp) return "";
    try {
      return formatDistanceToNowStrict(new Date(timestamp), { addSuffix: true });
    } catch (e) {
      console.warn("Error formatting timestamp:", e);
      return "";
    }
  }, []);

  // Format message preview helper
  const formatPreview = useCallback((message) => {
    return formatMessagePreview(message, user?._id);
  }, [user]);

  // Get icon for message type
  const getMessageTypeIcon = useCallback((message) => {
    if (!message || message.sender === user?._id) return null;

    // Icons based on message type
    const IconMap = {
      wink: <span title="Wink">😉</span>,
      file: message.metadata?.mimeType?.startsWith("image/") ?
        <span title="Image">🖼️</span> :
        <span title="File">📎</span>,
      video: <span title="Video">📹</span>
    };

    return IconMap[message.type] || null;
  }, [user]);

  // Mark conversation as read
  const markConversationRead = useCallback(async (recipientId) => {
    if (!recipientId || !user?._id) return;

    try {
      console.log(`Marking conversation with ${recipientId} as read`);

      await api.put(`/messages/conversation/${recipientId}/read`);

      // Update local state to reflect read status
      setConversations((prev) =>
        prev.map((convo) => {
          const convoUserId = convo.user?._id;
          if (convoUserId === recipientId) {
            return { ...convo, unreadCount: 0 };
          }
          return convo;
        }),
      );

      // Also update filtered conversations
      setFilteredConversations((prev) =>
        prev.map((convo) => {
          const convoUserId = convo.user?._id;
          if (convoUserId === recipientId) {
            return { ...convo, unreadCount: 0 };
          }
          return convo;
        }),
      );
    } catch (err) {
      console.error("Error marking conversation as read:", err);
    }
  }, [user, api]);

  // Delete a conversation
  const deleteConversation = useCallback(async (conversationId) => {
    if (!conversationId) return;

    try {
      console.log(`Deleting conversation ${conversationId}`);
      const response = await api.delete(`/messages/conversation/${conversationId}`);

      if (response && response.success) {
        // Update local state
        setConversations((prev) => prev.filter((c) => c._id !== conversationId));
        setFilteredConversations((prev) => prev.filter((c) => c._id !== conversationId));
        return true;
      } else {
        throw new Error(response?.error || "Failed to delete conversation");
      }
    } catch (err) {
      console.error("Error deleting conversation:", err);
      toast.error("Failed to delete conversation");
      throw err;
    }
  }, [api]);

  // Toggle conversation menu
  const toggleConversationMenu = useCallback((conversationId) => {
    setConversationMenuOpen((prevId) => (prevId === conversationId ? null : conversationId));
  }, []);

  // Handle selecting a conversation
  const handleSelectConversation = useCallback((recipient) => {
    if (!recipient || !recipient._id) {
      console.warn("Attempted to select conversation with invalid recipient:", recipient);
      return;
    }

    setSelectedConversationRecipient(recipient);
    setActiveConversation(recipient._id);
    navigate(`/messages/${recipient._id}`, { replace: true });

    const conversation = conversations.find((c) => c.user?._id === recipient._id);

    if (conversation?.unreadCount > 0) {
      markConversationRead(recipient._id);
    }

    setIsChatPanelVisible(true);
    setConversationMenuOpen(null);
  }, [conversations, navigate, markConversationRead]);

  // Handle deleting a conversation
  const handleDeleteConversation = useCallback(async (recipientId) => {
    if (!recipientId) return;

    const conversationToDelete = conversations.find((c) => c.user?._id === recipientId);
    const conversationId = conversationToDelete?._id;

    if (!conversationId) {
      console.error("Conversation ID not found for recipient:", recipientId);
      toast.error("Could not find conversation to delete");
      return;
    }

    if (window.confirm("Are you sure you want to delete this conversation?")) {
      try {
        await deleteConversation(conversationId);
        setConversationMenuOpen(null);
        console.log("Conversation deleted successfully");

        // Update local state immediately
        setFilteredConversations((prev) => prev.filter((c) => c._id !== conversationId));

        if (selectedConversationRecipient?._id === recipientId) {
          setSelectedConversationRecipient(null);
          setActiveConversation(null);
          navigate("/messages", { replace: true });
        }
      } catch (error) {
        console.error("Delete conversation error:", error);
        toast.error("Failed to delete conversation");
      }
    }
  }, [conversations, deleteConversation, navigate, selectedConversationRecipient]);

  // Handle muting a conversation
  const handleToggleMute = useCallback(() => {
    toast.info("Mute functionality not yet implemented.");
    setConversationMenuOpen(null);
  }, []);

  // Close chat panel (mobile)
  const handleCloseChatPanel = useCallback(() => {
    setIsChatPanelVisible(false);
    // Navigate back to the base /messages URL when closing on mobile
    if (window.innerWidth <= 768) {
      navigate("/messages", { replace: true });
    }
    setActiveConversation(null);
    setSelectedConversationRecipient(null);
  }, [navigate]);

  // Search input handlers
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    searchInputRef.current?.focus();
  };

  // Check socket connection status
  useEffect(() => {
    const checkSocketStatus = () => {
      try {
        const isConnected = window.socketService?.isConnected?.() || false;
        setSocketConnected(isConnected);
      } catch (err) {
        console.error("Error checking socket status:", err);
        setSocketConnected(false);
      }
    };

    checkSocketStatus();
    const intervalId = setInterval(checkSocketStatus, 10000);

    return () => clearInterval(intervalId);
  }, []);

  // Initial load of conversations
  useEffect(() => {
    let isMounted = true;

    const initializeConversations = async () => {
      if (!authChecked) return;

      if (isAuthenticated && user?._id) {
        if (!initialLoadAttemptedRef.current && isMounted) {
          console.log(`Initial conversations load for user ${user._id}`);
          initialLoadAttemptedRef.current = true;

          // Small delay to ensure auth is fully processed
          await new Promise(resolve => setTimeout(resolve, 500));

          if (isMounted) {
            console.log("Calling getConversations now");
            getConversations(true);
          }
        }
      } else if (isMounted) {
        setLoading(false);
      }
    };

    initializeConversations();

    // Safety timeout
    const safetyTimeoutId = setTimeout(() => {
      if (isMounted && loading) {
        console.log("Safety timeout triggered - forcing loading state reset");
        setLoading(false);

        // Show mock data if needed
        if (conversations.length === 0) {
          console.log("No conversations loaded, creating mock data");
          createMockConversations();
        }
      }
    }, 15000);

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeoutId);
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
      }
    };
  }, [authChecked, isAuthenticated, user, getConversations, loading, conversations.length, createMockConversations]);

  // Apply search filter when search query or conversations change
  useEffect(() => {
    applyFiltersToConversations(conversations, searchQuery);
  }, [searchQuery, conversations, applyFiltersToConversations]);

  // Select conversation from URL parameter
  useEffect(() => {
    if (!Array.isArray(conversations) || conversations.length === 0) return;

    if (selectedUserIdFromParams) {
      const convo = conversations.find((c) => c.user?._id === selectedUserIdFromParams);

      if (convo) {
        const recipientData = convo.user;

        if (recipientData && recipientData._id) {
          setSelectedConversationRecipient(recipientData);
          setActiveConversation(recipientData._id);

          if (convo.unreadCount > 0) {
            markConversationRead(recipientData._id);
          }

          setIsChatPanelVisible(true);
        } else {
          console.warn("Found conversation but recipient data is invalid");
          setSelectedConversationRecipient(null);
          setActiveConversation(null);
          navigate("/messages", { replace: true });
        }
      } else {
        setSelectedConversationRecipient(null);
        setActiveConversation(null);

        if (location.pathname !== "/messages") {
          navigate("/messages", { replace: true });
        }
      }
    } else if (activeConversation) {
      const activeConvo = conversations.find((c) => c.user?._id === activeConversation);
      const recipientData = activeConvo?.user;

      if (recipientData?._id) {
        setSelectedConversationRecipient(recipientData);
        setIsChatPanelVisible(true);
      } else {
        setSelectedConversationRecipient(null);
        setActiveConversation(null);
      }
    } else {
      setSelectedConversationRecipient(null);
    }
  }, [selectedUserIdFromParams, conversations, navigate, markConversationRead, activeConversation]);

  // Render each conversation item
  const renderConversationItem = (conversation) => {
    if (!conversation) return null;

    const userData = conversation.user || {};

    if (!userData._id) {
      return (
        <div className="conversation-item d-flex p-3 rounded-lg mb-1 bg-light-subtle">
          <div className="position-relative mr-3 flex-shrink-0">
            <div className="w-50px h-50px rounded-circle text-opacity-60 bg-light d-flex align-items-center justify-content-center">
              <span>?</span>
            </div>
          </div>
          <div className="flex-grow-1 overflow-hidden d-flex flex-column justify-content-center min-width-0">
            <div className="d-flex justify-content-between align-items-baseline mb-1">
              <h3 className="font-weight-medium font-size-sm text-truncate m-0">{userData.nickname || "Unknown User"}</h3>
              <span className="text-xs text-opacity-60 ml-2 flex-shrink-0">{formatTimestamp(conversation.lastMessage?.createdAt)}</span>
            </div>
            <p className="text-sm text-opacity-70 text-truncate m-0 flex-grow-1">
              {conversation.lastMessage?.content || "No messages yet"}
            </p>
          </div>
        </div>
      );
    }

    const recipientId = userData._id;
    const muted = conversation.muted || false;
    const isSelected = selectedConversationRecipient?._id === recipientId;

    return (
      <div
        className={classNames(
          "conversation-item d-flex p-3 rounded-lg mb-1 cursor-pointer transition-all hover-bg-light-subtle",
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
                e.target.onerror = null;
                e.target.src = "/placeholder.svg?height=50&width=50";
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
            onClick={(e) => {
              e.stopPropagation();
              toggleConversationMenu(recipientId);
            }}
            aria-label="Conversation options"
          >
            <FaEllipsisV />
          </button>
          {conversationMenuOpen === recipientId && (
            <div
              className="conversation-menu position-absolute right-0 top-35px bg-white rounded-lg shadow-md z-10 overflow-hidden min-w-120px border"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="d-flex align-items-center gap-2 w-100 py-2 px-3 text-left bg-transparent border-0 cursor-pointer text-sm text-opacity-70 hover-bg-light-subtle transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleMute();
                }}
              >
                {muted ? <FaBell className="text-primary" /> : <FaBellSlash className="text-primary" />} {muted ? "Unmute" : "Mute"}
              </button>
              <button
                className="d-flex align-items-center gap-2 w-100 py-2 px-3 text-left bg-transparent border-0 cursor-pointer text-sm text-danger hover-bg-danger-50 transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteConversation(recipientId);
                }}
              >
                <FaRegTrashAlt /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="messages-page d-flex flex-column vh-100 overflow-hidden">
      <Navbar />
      <div className="messages-main-content d-flex flex-grow-1 overflow-hidden bg-light-subtle">
        {/* Conversation List Panel */}
        <div
          className="conversations-panel flex-shrink-0 d-flex flex-column border-right bg-white"
          style={{
            transform: isChatPanelVisible && window.innerWidth < 768 ? 'translateX(-100%)' : 'none',
            transition: 'transform 0.3s ease',
            pointerEvents: isChatPanelVisible && window.innerWidth < 768 ? 'none' : 'auto',
            width: "320px",
            maxWidth: "100%"
          }}
        >
          <div className="conversations-header p-4 border-bottom flex-shrink-0">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="font-weight-bold font-size-lg m-0">Messages</h2>
              <div className={`connection-status ${socketConnected ? 'connected' : 'disconnected'} px-2 py-1 rounded-pill d-flex align-items-center gap-1`}>
                <FaCircle size={8} />
                <span className="text-xs">{socketConnected ? 'Connected' : 'Offline'}</span>
              </div>
            </div>

            <div className="search-container position-relative w-100">
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

          <div className="conversations-list flex-grow-1 overflow-y-auto p-2 custom-scrollbar position-relative" ref={conversationListRef}>
            {loading ? (
              <LoadingState
                onRetry={handleRetry}
                onReset={handleResetSession}
                onCreateMock={createMockConversations}
              />
            ) : error ? (
              <ErrorDisplay
                error={error}
                onRetry={handleRetry}
                onReset={handleResetSession}
                onCreateMock={createMockConversations}
              />
            ) : filteredConversations.length === 0 ? (
              <EmptyStateDisplay
                searchQuery={searchQuery}
                onFindUsers={handleFindUsers}
                onCreateMock={createMockConversations}
              />
            ) : (
              <div className="conversation-list h-100 overflow-auto">
                {filteredConversations.map((conversation, index) => (
                  <div key={conversation._id || `conversation-${index}-${Date.now()}`}>
                    {renderConversationItem(conversation)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat Display Panel */}
        <div className="flex-grow-1" style={{ position: 'relative', height: '100%' }}>
          {selectedConversationRecipient ? (
            <Suspense fallback={<LoadingSpinner />}>
              <EmbeddedChat
                key={selectedConversationRecipient._id}
                recipient={selectedConversationRecipient}
                isOpen={true}
                onClose={handleCloseChatPanel}
                embedded={false}
              />
            </Suspense>
          ) : (
            <NoSelectedConversation />
          )}
        </div>
      </div>

      {/* Styles for this component */}
      <style jsx="true">{`
        .connection-status.connected {
          color: var(--bs-success);
        }
        
        .connection-status.disconnected {
          color: var(--bs-danger);
        }
        
        @media (max-width: 767.98px) {
          .conversations-panel, .chat-panel {
            position: absolute;
            top: 0;
            bottom: 0;
            width: 100%;
            max-width: 100%;
          }
          
          .conversations-panel {
            left: 0;
            z-index: 10;
          }
          
          .chat-panel {
            right: 0;
          }
        }
        
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(0, 0, 0, 0.1);
          border-radius: 20px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(0, 0, 0, 0.2);
        }
        
        .conversation-item {
          transition: all 0.2s ease;
          border-radius: 8px;
        }
        
        .conversation-item:hover {
          background-color: rgba(0, 0, 0, 0.03);
        }
      `}</style>
    </div>
  );
};

export default MessagesPage;
