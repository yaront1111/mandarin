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
import chatService from "../services/ChatService";

// Lazy load the embedded chat component for better performance
const EmbeddedChat = lazy(() => import("../components/EmbeddedChat"));

// Create a logger for this component
const log = logger.create("Messages");

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
 * ConnectionStatusIndicator - Shows socket connection status
 */
const ConnectionStatusIndicator = ({ isConnected }) => (
  <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'} px-2 py-1 rounded-pill d-flex align-items-center gap-1`}>
    <FaCircle size={8} />
    <span className="text-xs">{isConnected ? 'Connected' : 'Offline'}</span>
  </div>
);

/**
 * ConversationFilters - Filter controls for conversation list
 */
const ConversationFilters = ({ onToggleFilter, isFilterOpen }) => (
  <button 
    className={`filter-button d-flex align-items-center gap-1 text-xs bg-transparent border-0 ${isFilterOpen ? 'text-primary' : 'text-muted'}`}
    onClick={onToggleFilter}
  >
    <FaFilter size={12} />
    <span>Filter</span>
  </button>
);

/**
 * FilterPanel - Expanded filter options
 */
const FilterPanel = ({ onClose, onFilterChange, filters }) => (
  <motion.div 
    className="filter-panel p-3 border-bottom"
    initial={{ height: 0, opacity: 0 }}
    animate={{ height: 'auto', opacity: 1 }}
    exit={{ height: 0, opacity: 0 }}
    transition={{ duration: 0.2 }}
  >
    <div className="d-flex justify-content-between align-items-center mb-2">
      <h6 className="m-0 font-weight-bold text-sm">Filter Conversations</h6>
      <button onClick={onClose} className="bg-transparent border-0 text-muted">
        <FaTimes size={14} />
      </button>
    </div>
    
    <div className="filter-options d-flex flex-wrap gap-2 mt-2">
      <button 
        className={`filter-chip px-2 py-1 rounded-pill text-xs ${filters.unread ? 'bg-primary-50 text-primary' : 'bg-light-subtle text-muted'}`}
        onClick={() => onFilterChange('unread', !filters.unread)}
      >
        Unread
      </button>
      <button 
        className={`filter-chip px-2 py-1 rounded-pill text-xs ${filters.online ? 'bg-primary-50 text-primary' : 'bg-light-subtle text-muted'}`}
        onClick={() => onFilterChange('online', !filters.online)}
      >
        Online
      </button>
    </div>
  </motion.div>
);

/**
 * ConversationItem - Single conversation in the list
 */
const ConversationItem = ({ 
  conversation, 
  isSelected, 
  onSelect, 
  onToggleMenu, 
  menuOpen, 
  onDelete, 
  onToggleMute,
  formatTimestamp,
  formatPreview,
  getMessageTypeIcon
}) => {
  const userData = conversation?.user;
  if (!conversation?._id || !userData?._id) return null;
  
  const recipientId = userData._id;
  const muted = conversation.muted || false;
  
  return (
    <div
      className={classNames(
        "conversation-item d-flex p-3 rounded-lg mb-1 cursor-pointer transition-all hover-bg-light-subtle",
        isSelected ? "bg-primary-50" : "",
        conversation.unreadCount > 0 ? "font-weight-medium" : "",
      )}
      onClick={() => onSelect(userData)}
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
            onToggleMenu(recipientId);
          }}
          aria-label="Conversation options"
        >
          <FaEllipsisV />
        </button>
        {menuOpen === recipientId && (
          <div 
            className="conversation-menu position-absolute right-0 top-35px bg-white rounded-lg shadow-md z-10 overflow-hidden min-w-120px border" 
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              className="d-flex align-items-center gap-2 w-100 py-2 px-3 text-left bg-transparent border-0 cursor-pointer text-sm text-opacity-70 hover-bg-light-subtle transition-all"
              onClick={(e) => {
                e.stopPropagation();
                onToggleMute(conversation._id, muted);
              }}
            >
              {muted ? <FaBell className="text-primary" /> : <FaBellSlash className="text-primary" />} {muted ? "Unmute" : "Mute"}
            </button>
            <button 
              className="d-flex align-items-center gap-2 w-100 py-2 px-3 text-left bg-transparent border-0 cursor-pointer text-sm text-danger hover-bg-danger-50 transition-all"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(recipientId);
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

/**
 * ConversationList - Standard list of conversations
 */
const ConversationList = ({ 
  conversations, 
  selectedRecipientId, 
  onSelectConversation,
  conversationMenuOpen,
  toggleConversationMenu,
  handleDeleteConversation,
  handleToggleMute,
  formatTimestamp,
  formatPreview,
  getMessageTypeIcon,
}) => (
  <div className="conversation-list h-100 overflow-auto">
    {conversations.map(conversation => (
      <ConversationItem
        key={conversation._id}
        conversation={conversation}
        isSelected={selectedRecipientId === conversation.user?._id}
        onSelect={onSelectConversation}
        onToggleMenu={toggleConversationMenu}
        menuOpen={conversationMenuOpen}
        onDelete={handleDeleteConversation}
        onToggleMute={handleToggleMute}
        formatTimestamp={formatTimestamp}
        formatPreview={formatPreview}
        getMessageTypeIcon={getMessageTypeIcon}
      />
    ))}
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
const LoadingState = ({ retryCount, onRetry, onReset, onCreateMock }) => (
  <div className="d-flex flex-column align-items-center justify-content-center p-5 text-opacity-70 h-100 text-center">
    <FaSpinner className="fa-spin text-primary text-xl mb-4" />
    <p className="mb-2">Loading conversations...</p>
    {retryCount > 0 && <p className="text-xs text-opacity-60 mt-2">Attempt {retryCount} - Please wait...</p>}
    {retryCount > 2 && (
      <div className="mt-5 p-4 bg-light rounded-lg shadow-sm w-90 max-w-md">
        <p className="mb-3 font-weight-medium">This is taking longer than expected.</p>
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
    )}
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
 * Scroll to top button component
 */
const ScrollToTopButton = ({ show, onClick }) => (
  <motion.button
    className="scroll-top-btn position-absolute bottom-20px right-20px bg-primary text-white rounded-circle shadow-md border-0 d-flex align-items-center justify-content-center z-10 w-40px h-40px"
    onClick={onClick}
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: show ? 1 : 0, scale: show ? 1 : 0.8 }}
    exit={{ opacity: 0, scale: 0.8 }}
    whileHover={{ scale: 1.1 }}
    whileTap={{ scale: 0.9 }}
    transition={{ duration: 0.2 }}
    aria-label="Scroll to top"
  >
    <FaArrowUp />
  </motion.button>
);

/**
 * Main Messages Page Component
 */
const MessagesPage = () => {
  // Get auth state and API client
  const { user, authChecked, isAuthenticated, token } = useAuth();
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
  const [retryCount, setRetryCount] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({ unread: false, online: false });
  const [socketConnected, setSocketConnected] = useState(false);
  const [chatInitialized, setChatInitialized] = useState(false);

  // Refs
  const searchInputRef = useRef(null);
  const conversationListRef = useRef(null);
  const retryTimeoutRef = useRef(null);
  const initialLoadAttemptedRef = useRef(false);
  const initialLoadCompletedRef = useRef(false);

  // Initialize ChatService and monitor connection status
  useEffect(() => {
    // Only try to initialize if we have authentication
    if (isAuthenticated && user?._id) {
      // Initialize ChatService
      log.info(`Initializing chat service for user ${user._id}`);
      
      chatService.initialize(user)
        .then(() => {
          log.info('Chat service initialized successfully');
          setChatInitialized(true);
          setSocketConnected(chatService.isConnected());
        })
        .catch(err => {
          log.error('Failed to initialize chat service:', err);
          setChatInitialized(false);
        });
      
      // Monitor chat service connection status
      const connectionListener = chatService.on('connectionChanged', ({ connected }) => {
        log.debug(`Connection status changed: ${connected}`);
        setSocketConnected(connected);
        
        // If connection was restored and we have data, refresh
        if (connected && initialLoadCompletedRef.current) {
          log.info('Connection restored, refreshing conversations');
          getConversations(true);
        }
      });
      
      // Return cleanup function
      return () => {
        if (typeof connectionListener === 'function') {
          connectionListener();
        }
      };
    }
  }, [isAuthenticated, user]);

  // Load conversations using ChatService
  const getConversations = useCallback(async (forceRefresh = false) => {
    // Skip if not authenticated or no user ID
    if (!isAuthenticated || !user?._id) {
      log.debug("Not authenticated or missing user ID, skipping conversation fetch");
      setLoading(false);
      return [];
    }

    // Skip if already loading and not forcing refresh
    if (loading && !forceRefresh) {
      log.debug("Already loading conversations, skipping duplicate fetch");
      return [];
    }

    // Set a timeout to ensure loading state doesn't get stuck indefinitely
    const timeoutId = setTimeout(() => {
      log.warn('Conversation loading timeout reached, resetting loading state');
      setLoading(false);
      setError('Loading conversations timed out. Please try again.');
      initialLoadAttemptedRef.current = false;
    }, 12000); // Reduced from 15s to 12s

    setLoading(true);
    setError(null);

    try {
      log.info(`Fetching conversations using ChatService for user ${user._id}`);
      
      // Get conversations from ChatService
      const conversations = await chatService.getConversations();
      
      // Clear timeout
      clearTimeout(timeoutId);
      
      // Ensure we have an array
      const conversationData = Array.isArray(conversations) ? conversations : [];
      log.info(`Loaded ${conversationData.length} conversations`);

      // Update state
      setConversations(conversationData);
      applyFiltersToConversations(conversationData, searchQuery, filters);
      setLoading(false);
      setRetryCount(0);
      initialLoadCompletedRef.current = true;

      // Clear any retry timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }

      return conversationData;
    } catch (err) {
      log.error("Error fetching conversations:", err);
      
      // Clear timeout
      clearTimeout(timeoutId);
      
      // Multi-level fallback approach - try different endpoints
      
      // First fallback: Direct API call to standard endpoint
      try {
        log.info("Fallback 1: Using direct API call for conversations");
        const response = await api.get("/messages/conversations");
        
        if (response && response.success) {
          const conversationData = Array.isArray(response.data) ? response.data : [];
          log.info(`API fallback loaded ${conversationData.length} conversations`);
          
          setConversations(conversationData);
          applyFiltersToConversations(conversationData, searchQuery, filters);
          setLoading(false);
          setRetryCount(0);
          initialLoadCompletedRef.current = true;
          
          return conversationData;
        } else {
          throw new Error(response?.error || "Failed to load conversations");
        }
      } catch (fallbackErr) {
        log.error("First API fallback failed:", fallbackErr);
        
        // Second fallback: Try special diagnostic endpoint with direct fetch
        try {
          log.info("Fallback 2: Trying diagnostic endpoint with direct fetch");
          
          // Use direct fetch to bypass API service which might have issues
          const response = await fetch('/api/diagnostic/conversations', {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token') || ''}`,
              'Content-Type': 'application/json'
            }
          });
          
          const diagnosticResponse = await response.json();
          
          if (diagnosticResponse && diagnosticResponse.success) {
            const diagnosticData = Array.isArray(diagnosticResponse.data) ? diagnosticResponse.data : [];
            log.info(`Diagnostic endpoint returned ${diagnosticData.length} test conversations`);
            
            // If we received diagnostic data, use it
            if (diagnosticData.length > 0) {
              setConversations(diagnosticData);
              applyFiltersToConversations(diagnosticData, searchQuery, filters);
              setLoading(false);
              setRetryCount(0);
              initialLoadCompletedRef.current = true;
              
              // Add a notification that we're using test data
              toast.info("Using test data for conversations. Refresh to try loading real data.");
              
              return diagnosticData;
            }
          }
          
          // If diagnostic endpoint didn't help, throw error for final fallback
          throw new Error("Diagnostic endpoint did not provide usable data");
        } catch (diagnosticErr) {
          log.error("Second API fallback (diagnostic) also failed:", diagnosticErr);
          
          // Third and final fallback: Create mock data
          // This ensures the UI is never stuck in a loading state
          if (retryCount >= 2) {
            log.info("Fallback 3: Creating mock conversation data after multiple failures");
            const mockData = [
              {
                _id: "fallback1",
                user: {
                  _id: "mock-user-1",
                  nickname: "Support",
                  isOnline: true,
                  photos: []
                },
                lastMessage: {
                  content: "The server appears to be offline. Please try refreshing the page later.",
                  createdAt: new Date(),
                  sender: "mock-user-1"
                },
                unreadCount: 1
              }
            ];
            
            setConversations(mockData);
            applyFiltersToConversations(mockData, searchQuery, filters);
            setLoading(false);
            initialLoadCompletedRef.current = true;
            
            // Show error notification but proceed with mock data
            toast.error("Could not load real conversations. Using fallback data.", {
              autoClose: 7000
            });
            
            return mockData;
          }
        }
        
        // If all fallbacks failed and we're not at max retry count
        setError(err.message || fallbackErr.message || "Failed to load conversations");
        setLoading(false);

        // Increment retry count
        const newRetryCount = retryCount + 1;
        setRetryCount(newRetryCount);

        // Set up retry with exponential backoff
        if (newRetryCount <= 3) {
          const retryDelay = Math.min(3000 * Math.pow(1.5, newRetryCount - 1), 10000);
          log.debug(`Will retry in ${retryDelay / 1000} seconds (attempt ${newRetryCount})`);

          retryTimeoutRef.current = setTimeout(() => {
            log.debug(`Auto-retrying conversation fetch (attempt ${newRetryCount})...`);
            getConversations(true);
          }, retryDelay);
        } else {
          log.warn("Maximum retry attempts reached");
          initialLoadAttemptedRef.current = false;
        }
      }
      
      return [];
    }
  }, [isAuthenticated, user, api, loading, retryCount, searchQuery, filters]);

  // Initial load of conversations
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
          
          // Check if chat service is initialized
          if (!chatInitialized) {
            log.info("Waiting for chat service to initialize before loading conversations");
            try {
              // Wait for chat service to initialize with timeout
              let attempts = 0;
              const maxAttempts = 3;
              
              while (!chatService.isReady() && attempts < maxAttempts) {
                attempts++;
                log.info(`Attempt ${attempts} to initialize chat service`);
                
                try {
                  // Try to initialize chat service
                  await chatService.initialize(user);
                  if (chatService.isReady()) {
                    setChatInitialized(true);
                    setSocketConnected(chatService.isConnected());
                    log.info("Chat service initialized successfully");
                    break;
                  }
                } catch (err) {
                  log.error(`Chat initialization attempt ${attempts} failed:`, err);
                }
                
                // Wait before next attempt
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
              
              if (!chatService.isReady() && attempts >= maxAttempts) {
                // Force initialization successful to continue even without a socket
                log.warn("Forcing initialization state to continue with API fallback");
                setChatInitialized(true);
              }
            } catch (err) {
              log.error("Failed to initialize chat service:", err);
              // Continue anyway, as we'll fall back to direct API calls
              setChatInitialized(true);
            }
          }
          
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
    
    // Safety timeout to ensure we're never stuck in loading
    const safetyTimeoutId = setTimeout(() => {
      if (isMounted && loading) {
        log.warn("Safety timeout triggered - forcing loading state reset");
        setLoading(false);
        
        // Force conversations load even if stuck
        if (initialLoadAttemptedRef.current && !initialLoadCompletedRef.current && isAuthenticated && user?._id) {
          log.warn("Forcing conversations load after timeout");
          
          // Use mock data directly instead of trying API calls that might fail
          log.info("Using mock data to recover from stuck loading state");
          const mockData = [
            {
              _id: "fallback1",
              user: {
                _id: "mock-user-1",
                nickname: "Support",
                isOnline: true,
                photos: []
              },
              lastMessage: {
                content: "The server appears to be experiencing issues. Try refreshing the page.",
                createdAt: new Date().toISOString(),
                sender: "mock-user-1"
              },
              unreadCount: 1
            }
          ];
          
          setConversations(mockData);
          setFilteredConversations(mockData);
          setLoading(false);
          initialLoadCompletedRef.current = true;
          
          // Try diagnostic endpoint in the background
          try {
            // Use direct fetch to bypass API service which might have issues
            fetch('/api/diagnostic/conversations', {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token') || ''}`,
                'Content-Type': 'application/json'
              }
            })
            .then(res => res.json())
            .then(diagnosticResponse => {
              if (diagnosticResponse && diagnosticResponse.success && 
                  Array.isArray(diagnosticResponse.data) && diagnosticResponse.data.length > 0) {
                log.info("Diagnostic endpoint returned valid data, updating UI");
                setConversations(diagnosticResponse.data);
                setFilteredConversations(diagnosticResponse.data);
              }
            })
            .catch(diagnosticErr => {
              log.error("Diagnostic endpoint also failed:", diagnosticErr);
            });
          } catch (fetchErr) {
            log.error("Error setting up diagnostic fetch:", fetchErr);
          }
        }
      }
    }, 15000); // Reduced to 15 seconds for faster recovery
    
    // Cleanup function
    return () => {
      isMounted = false;
      
      // Clear timeouts
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      
      clearTimeout(safetyTimeoutId);
    };
  }, [authChecked, isAuthenticated, user, getConversations, loading, api, chatInitialized]);

  // Monitor scroll position to show/hide scroll to top button
  useEffect(() => {
    const listElement = conversationListRef.current;
    
    if (!listElement) return;
    
    const handleScroll = () => {
      if (listElement.scrollTop > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    
    listElement.addEventListener('scroll', handleScroll);
    
    return () => {
      listElement.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Mark a conversation as read
  const markConversationRead = useCallback(async (recipientId) => {
    if (!recipientId || !user?._id) return;

    try {
      // Use ChatService to mark conversation as read
      await chatService.markConversationRead(recipientId);

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
      log.error("Error marking conversation as read:", err);
      
      // Fallback to direct API call
      try {
        await api.put(`/messages/conversation/${recipientId}/read`);
        
        // Update state
        setConversations((prev) =>
          prev.map((convo) => {
            const convoUserId = convo.user?._id;
            if (convoUserId === recipientId) {
              return { ...convo, unreadCount: 0 };
            }
            return convo;
          }),
        );
        
        setFilteredConversations((prev) =>
          prev.map((convo) => {
            const convoUserId = convo.user?._id;
            if (convoUserId === recipientId) {
              return { ...convo, unreadCount: 0 };
            }
            return convo;
          }),
        );
      } catch (fallbackErr) {
        log.error("API fallback also failed:", fallbackErr);
      }
    }
  }, [user, api]);

  // Delete a conversation
  const deleteConversation = useCallback(async (conversationId) => {
    if (!conversationId) return;

    try {
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
      log.error("Error deleting conversation:", err);
      toast.error("Failed to delete conversation");
      throw err;
    }
  }, [api]);

  // Apply filters to conversations
  const applyFiltersToConversations = useCallback((conversations, query, activeFilters) => {
    if (!Array.isArray(conversations)) {
      setFilteredConversations([]);
      return;
    }

    let filtered = [...conversations];
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

    // Apply unread filter if enabled
    if (activeFilters.unread) {
      filtered = filtered.filter(convo => convo.unreadCount > 0);
    }

    // Apply online filter if enabled
    if (activeFilters.online) {
      filtered = filtered.filter(convo => convo.user?.isOnline);
    }

    setFilteredConversations(filtered);
  }, []);

  // Re-apply filters when filters or conversations change
  useEffect(() => {
    applyFiltersToConversations(conversations, searchQuery, filters);
  }, [searchQuery, conversations, filters, applyFiltersToConversations]);

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
          log.warn("Found conversation but recipient data is invalid:", convo);
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

  // Handle selecting a conversation
  const handleSelectConversation = useCallback((recipient) => {
    if (!recipient || !recipient._id) {
      log.warn("Attempted to select conversation with invalid recipient:", recipient);
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

  // Search input handlers
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    searchInputRef.current?.focus();
  };

  // Toggle conversation action menu
  const toggleConversationMenu = useCallback((conversationId) => {
    setConversationMenuOpen((prevId) => (prevId === conversationId ? null : conversationId));
  }, []);

  // Handle deleting a conversation
  const handleDeleteConversation = useCallback(async (recipientId) => {
    if (!recipientId) return;

    const conversationToDelete = conversations.find((c) => c.user?._id === recipientId);
    const conversationId = conversationToDelete?._id;

    if (!conversationId) {
      log.error("Conversation ID not found for recipient:", recipientId);
      toast.error("Could not find conversation to delete");
      return;
    }

    if (window.confirm("Are you sure you want to delete this conversation?")) {
      try {
        await deleteConversation(conversationId);
        setConversationMenuOpen(null);
        log.info("Conversation deleted successfully");

        // Update local state immediately
        setFilteredConversations((prev) => prev.filter((c) => c._id !== conversationId));

        if (selectedConversationRecipient?._id === recipientId) {
          setSelectedConversationRecipient(null);
          setActiveConversation(null);
          navigate("/messages", { replace: true });
        }
      } catch (error) {
        log.error("Delete conversation error:", error);
        toast.error("Failed to delete conversation");
      }
    }
  }, [conversations, deleteConversation, navigate, selectedConversationRecipient]);

  // Handle conversation muting
  const handleToggleMute = useCallback(async (conversationId, currentMuteStatus) => {
    try {
      log.debug(`Toggling mute for ${conversationId}. Current: ${currentMuteStatus}`);
      toast.info("Mute functionality not yet implemented.");
      setConversationMenuOpen(null);
    } catch (error) {
      log.error("Failed to update mute status:", error);
      toast.error("Failed to update mute status");
    }
  }, []);

  // Format message preview
  const formatPreview = useCallback((message) => {
    if (message?.type === "file" && message.metadata?.mimeType) {
      const modifiedMessage = {
        ...message,
        metadata: {
          ...message.metadata,
          fileType: message.metadata.mimeType,
        },
      };
      return formatMessagePreview(modifiedMessage, user?._id);
    }
    return formatMessagePreview(message, user?._id);
  }, [user]);

  // Format timestamp
  const formatTimestamp = useCallback((timestamp) => {
    if (!timestamp) return "";
    try {
      return formatDistanceToNowStrict(new Date(timestamp), { addSuffix: true });
    } catch (e) {
      log.warn("Error formatting timestamp:", timestamp, e);
      return "";
    }
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

  // Get icon for message type
  const getMessageTypeIcon = useCallback((message) => {
    if (!message || message.sender === user?._id) return null;

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
    };

    // Return the icon for this message type or null
    return IconMap[message.type] || null;
  }, [user]);

  // Retry loading conversations
  const handleRetry = useCallback(() => {
    getConversations(true);
  }, [getConversations]);

  // Handle filter changes
  const handleFilterChange = useCallback((filterName, value) => {
    setFilters(prev => {
      const updatedFilters = { ...prev, [filterName]: value };
      return updatedFilters;
    });
  }, []);

  // Toggle filter panel
  const toggleFilterPanel = useCallback(() => {
    setIsFilterOpen(prev => !prev);
  }, []);

  // Scroll to top
  const handleScrollToTop = useCallback(() => {
    if (conversationListRef.current) {
      conversationListRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  }, []);

  // Reset session (logout)
  const handleResetSession = useCallback(() => {
    if (window.confirm("This will log you out. You'll need to sign in again. Continue?")) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = "/login";
    }
  }, []);

  // Navigate to find users
  const handleFindUsers = useCallback(() => {
    navigate("/dashboard");
  }, [navigate]);

  // Create mock conversations for development
  const createMockConversations = useCallback(() => {
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
    ];

    setConversations(mockData);
    setFilteredConversations(mockData);
    setLoading(false);
    setError(null);
    toast.info("Loaded mock conversations for testing");
    initialLoadCompletedRef.current = true;
  }, [user]);
  
  // Show mock data in development mode if no conversations load
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
  }, [conversations.length, loading, error, createMockConversations]);

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
            pointerEvents: isChatPanelVisible && window.innerWidth < 768 ? 'none' : 'auto'
          }}
        >
          <div className="conversations-header p-4 border-bottom flex-shrink-0">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="font-weight-bold font-size-lg m-0">Messages</h2>
              <ConnectionStatusIndicator isConnected={socketConnected} />
            </div>
            
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div className="search-container position-relative flex-grow-1">
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
              <div className="ml-2">
                <ConversationFilters 
                  onToggleFilter={toggleFilterPanel} 
                  isFilterOpen={isFilterOpen} 
                />
              </div>
            </div>
            
            <AnimatePresence>
              {isFilterOpen && (
                <FilterPanel 
                  onClose={toggleFilterPanel} 
                  onFilterChange={handleFilterChange} 
                  filters={filters} 
                />
              )}
            </AnimatePresence>
          </div>
          
          <div className="conversations-list flex-grow-1 overflow-y-auto p-2 custom-scrollbar position-relative" ref={conversationListRef}>
            {loading ? (
              <LoadingState 
                retryCount={retryCount} 
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
              <>
                {filteredConversations.length > 5 && (
                  <AnimatePresence>
                    {showScrollTop && (
                      <ScrollToTopButton 
                        show={showScrollTop} 
                        onClick={handleScrollToTop} 
                      />
                    )}
                  </AnimatePresence>
                )}
                
                <ConversationList
                  conversations={filteredConversations}
                  selectedRecipientId={selectedConversationRecipient?._id}
                  onSelectConversation={handleSelectConversation}
                  conversationMenuOpen={conversationMenuOpen}
                  toggleConversationMenu={toggleConversationMenu}
                  handleDeleteConversation={handleDeleteConversation}
                  handleToggleMute={handleToggleMute}
                  formatTimestamp={formatTimestamp}
                  formatPreview={formatPreview}
                  getMessageTypeIcon={getMessageTypeIcon}
                />
              </>
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
        .messages-page {
          --conversation-panel-width: 320px;
        }
        
        .conversations-panel {
          width: var(--conversation-panel-width);
          max-width: 100%;
        }
        
        .connection-status {
          font-size: 0.75rem;
        }
        
        .connection-status.connected {
          color: var(--bs-success);
        }
        
        .connection-status.disconnected {
          color: var(--bs-danger);
        }
        
        .filter-chip {
          border: 1px solid transparent;
          transition: all 0.2s ease;
        }
        
        .filter-chip:hover {
          background-color: var(--bs-primary-bg-subtle);
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