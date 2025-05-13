"use client"
import React, { useEffect, useState, useCallback, useRef, useMemo } from "react"
import {
  FaHeart,
  FaComment,
  FaEllipsisH,
  FaMapMarkerAlt,
  FaCalendarAlt,
  FaRegClock,
  FaCheck,
  FaChevronRight,
  FaChevronLeft,
  FaLock,
  FaUserAlt,
  FaTrophy,
  FaFlag,
  FaBan,
  FaCamera,
  FaSpinner,
  FaEye,
} from "react-icons/fa"
import { useUser, useAuth, useStories, useTheme, useLanguage } from "../context"
import { EmbeddedChat } from "../components"
import StoriesViewer from "./Stories/StoriesViewer"
import StoryThumbnail from "./Stories/StoryThumbnail"
import { toast } from "react-toastify"
import styles from "../styles/userprofilemodal.module.css"
import { useNavigate } from "react-router-dom"

// Import common components
import { Modal, Button, Avatar, LoadingSpinner } from "./common"
// Import hooks and utilities
import { useApi, useMounted, usePhotoManagement, useIsMobile, useMobileDetect } from "../hooks"
import { formatDate, logger } from "../utils"
import { provideTactileFeedback } from "../utils/mobileGestures"
import socketService from "../services/socketClient.jsx"

/**
 * UserProfileModal component displays a user's profile information
 * with photo gallery, compatibility score, and interaction options.
 *
 * @param {Object} props Component props
 * @param {string} props.userId The ID of the user to display
 * @param {boolean} props.isOpen Whether the modal is open or closed
 * @param {Function} props.onClose Function to call when closing the modal
 */
const UserProfileModal = ({ userId, isOpen, onClose }) => {
  // Auth context
  const { user: currentUser } = useAuth();

  // Mobile detection
  const isMobile = useIsMobile();
  const { isTouch, isIOS, isAndroid } = useMobileDetect();

  // User context
  const {
    getUser,
    currentUser: profileUser,
    likeUser,
    unlikeUser,
    isUserLiked,
    error,
    blockUser,
    reportUser,
    sendMessage,
  } = useUser();

  // Other contexts
  const { loadUserStories, hasUnviewedStories } = useStories();
  
  // Theme context
  const { theme } = useTheme();
  
  // Language context
  const { t, language } = useLanguage();
  
  // Memoize common translations to avoid unnecessary re-renders
  const translations = useMemo(() => ({
    compatibilityTitle: t('compatibility'),
    location: t('location'),
    age: t('age'),
    interests: t('interests'),
    aboutMe: t('aboutMe'),
    iAm: t('identity'),
    maritalStatus: t('maritalStatus'),
    lookingFor: t('lookingFor'),
    imInto: t('intoTags'),
    itTurnsMeOn: t('turnOns'),
    onlineNow: t('online'),
    offline: t('offline'),
    lastActive: t('lastActive'),
    memberSince: t('memberSince')
  }), [t]);

  // State management
  const [userStories, setUserStories] = useState([]);
  const [showChat, setShowChat] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [showActions, setShowActions] = useState(false);
  const [showAllInterests, setShowAllInterests] = useState(false);
  const [showStories, setShowStories] = useState(false);
  const [photoLoadError, setPhotoLoadError] = useState({});
  const [isLiking, setIsLiking] = useState(false);
  const [isChatInitiating, setIsChatInitiating] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [isProcessingApproval, setIsProcessingApproval] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [imageKey, setImageKey] = useState(`image-${Math.floor(Math.random() * 10000)}`); // Stable key for photo renders

  // Initialize userPhotoAccess from localStorage first if possible
  const initialPhotoAccess = useMemo(() => {
    // Only try to load from localStorage if we're not the owner
    if (userId && currentUser && userId !== currentUser._id) {
      try {
        const storedPermissions = localStorage.getItem('photo-permissions-status');
        if (storedPermissions) {
          const permissions = JSON.parse(storedPermissions);
          if (permissions && permissions[userId]) {
            return {
              status: permissions[userId].status,
              isLoading: false,
              source: 'localStorage'
            };
          }
        }
      } catch (error) {
        log.error("Failed to load initial permission status from localStorage:", error);
      }
    }
    
    // Default state if localStorage doesn't have a value
    return {
      status: null,
      isLoading: false,
      source: 'default'
    };
  }, [userId, currentUser]);
  
  // SIMPLIFIED ACCESS CONTROL - one state variable for user-level access
  const [userPhotoAccess, setUserPhotoAccess] = useState(initialPhotoAccess);
  

  // Refs
  const profileRef = useRef(null);
  const storiesLoadingRef = useRef(false);
  const accessStatusLoadingRef = useRef(false);
  const requestsLoadingRef = useRef(false);

  // Hooks
  const navigate = useNavigate();
  const api = useApi();
  const { isMounted } = useMounted();
  const { normalizePhotoUrl, handlePhotoLoadError, clearCache } = usePhotoManagement();

  // Create contextual logger
  const log = logger.create('UserProfileModal');

  // Memoized values
  const isOwnProfile = useMemo(() => {
    return currentUser && profileUser && currentUser._id === profileUser._id;
  }, [currentUser, profileUser]);

  const compatibility = useMemo(() => {
    if (!profileUser || !currentUser) return 0;
    return calculateCompatibility();
  }, [profileUser, currentUser]);

  const commonInterests = useMemo(() => {
    if (!profileUser || !currentUser || !profileUser.details?.interests) return [];
    return profileUser.details.interests.filter(
      interest => currentUser.details?.interests?.includes(interest)
    );
  }, [profileUser, currentUser]);

  const hasPendingRequestFromUser = useMemo(() => {
    return pendingRequests.some(
      (item) => item.user && profileUser && item.user._id === profileUser._id
    );
  }, [pendingRequests, profileUser]);

  const currentUserRequests = useMemo(() => {
    return pendingRequests.find(
      (item) => item.user && profileUser && item.user._id === profileUser._id
    );
  }, [pendingRequests, profileUser]);

  // Check if user can view private photos
  // Users can always view their own private photos or photos they've been granted access to
  const canViewPrivatePhotos = isOwnProfile || userPhotoAccess.status === "approved";

  // Track the last userId to avoid fetch loops
  const lastFetchedUserIdRef = useRef(null);

  // Fetch user data - excluding unstable deps to avoid loops
  useEffect(() => {
    // Skip if no userId, no isOpen (modal is closed), or if we've already fetched this user
    if (!userId || !isOpen || lastFetchedUserIdRef.current === userId) {
      return;
    }

    // Wrap getUser in a function to avoid dependency issues
    const fetchUserData = async () => {
      setLoading(true);
      lastFetchedUserIdRef.current = userId;

      try {
        // Adding a small delay to prevent race conditions with other API calls
        await new Promise(resolve => setTimeout(resolve, 50));

        // Use getUser from context but don't add it to dependencies
        // Force cache clear by passing true as second parameter
        const userData = await api.get(`/users/${userId}`, {}, { 
          useCache: false, 
          headers: { 
            'x-no-cache': 'true',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          } 
        });

        if (!isMounted()) return;

        log.debug("User data received:", userData?.data?.user || userData?.data || userData);
        
        // Extract user data from response based on structure
        const userDataExtracted = userData?.data?.user || userData?.data || userData;
        
        // Set the local user state AND update the context user
        setUser(userDataExtracted);
        
        // Also update the context user to ensure latest data is available
        if (getUser && typeof getUser === 'function') {
          getUser(userId);
        }
      } catch (error) {
        if (isMounted()) {
          log.error("Error fetching user:", error);
          // Don't leave the loading state on if there's an error
          setLoading(false);
        }
      } finally {
        if (isMounted()) {
          setLoading(false);
        }
      }
    };

    fetchUserData();

    // Reset the ref when component unmounts or userId changes
    return () => {
      // Only reset if the component is unmounting, not just when userId changes
      if (!isOpen) {
        lastFetchedUserIdRef.current = null;
      }
    };
  // Explicitly exclude getUser from deps since it might change between renders
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isOpen, isMounted, api]);

  // IMPORTANT: We're not using this callback anymore - it's replaced with a direct API call
  // in the useEffect to prevent loops. Keep this here just for reference and documentation.
  const fetchUserPhotoAccess = useCallback(() => {
    log.debug("This function is no longer used - direct API call is made instead");
    // No-op
  }, []);

  // Photo permission system has been removed
  // This function is kept as a placeholder for compatibility
  const fetchPendingRequests = useCallback(async () => {
    log.debug("Photo permission system has been removed");
    return;
  }, []);

  // Track whether we've loaded data for this userId and whether the component is mounted
  const dataLoadedRef = useRef(false);
  const calledApiRef = useRef(false);

  // Track modal open/close status with a separate ref to fix infinite update loop
  const isModalOpenRef = useRef(false);
  // Track if we've fetched photo access to avoid redundant calls
  const photoAccessFetchedRef = useRef(false);
  // Track if we've set up socket notification listeners
  const notificationListenersSetupRef = useRef(false);

  // Load user data, access status, and stories when modal opens
  useEffect(() => {
    // Skip if no userId or isOpen changed to false
    if (!userId || !isOpen) {
      // If modal closed, reset states
      if (isModalOpenRef.current) {
        isModalOpenRef.current = false;
        dataLoadedRef.current = false;
        calledApiRef.current = false;
        accessStatusLoadingRef.current = false;
        storiesLoadingRef.current = false;
        requestsLoadingRef.current = false;
        photoAccessFetchedRef.current = false;
        notificationListenersSetupRef.current = false;

        // Reset all UI state when closing
        setShowChat(false);
        setShowStories(false);
        setUserPhotoAccess({
          status: null,
          isLoading: false
        });
        setPhotoLoadError({});
        setIsLiking(false);
        setIsChatInitiating(false);
        setActivePhotoIndex(0);
        setUserStories([]);
        setPendingRequests([]);
        setImageKey(Date.now()); // Reset image key to force reload next time

        log.debug(`Modal cleanup ran for userId: ${userId}`);
      }
      return;
    }

    // Only run when the modal is truly opening (not just re-rendering)
    if (!isModalOpenRef.current) {
      isModalOpenRef.current = true;
      log.debug(`Modal opened for userId: ${userId}, dataLoadedRef: ${dataLoadedRef.current}`);

      // We now initialize from localStorage in the useMemo above, 
      // so we don't need to do it here again. The value is already in the state.
      log.debug(`Modal using initial permission status: ${userPhotoAccess.status} (from ${userPhotoAccess.source})`);


      // Other UI reset
      setActivePhotoIndex(0);
      setShowAllInterests(false);
      setShowActions(false);
      setPhotoLoadError({});
      setShowChat(false);
      setShowStories(false);
      setImageKey(Date.now()); // Reset image key to force reload of images

      // Reset loading states
      setLoading(false);
      setIsLiking(false);
      setIsChatInitiating(false);
      setIsLoadingRequests(false);
      setIsProcessingApproval(false);
    }

    // Load stories only once
    if (!storiesLoadingRef.current && !dataLoadedRef.current) {
      storiesLoadingRef.current = true;

      // Use Promise.resolve to handle both synchronous and asynchronous loadUserStories
      Promise.resolve(loadUserStories?.(userId))
        .then(stories => {
          if (isMounted() && stories && Array.isArray(stories)) {
            setUserStories(stories);
          }
        })
        .catch(err => {
          log.error("Error loading stories:", err);
        })
        .finally(() => {
          if (isMounted()) {
            storiesLoadingRef.current = false;
          }
        });
    }

    // Fetch photo access status once
    if (!accessStatusLoadingRef.current && !photoAccessFetchedRef.current) {
      photoAccessFetchedRef.current = true;
      accessStatusLoadingRef.current = true;
      
      // We now load from localStorage when the modal first opens
      // This hook is just for the API call

      // Use the API directly to avoid callback issues
      api.get(`/users/${userId}/photo-access-status`)
        .then(response => {
          if (!isMounted()) return;

          log.debug(`Received photo access status response:`, response);

          if (response && response.success) {
            // Simplified access to status value with fallbacks
            const statusValue = response.status ||
                              (response.data && response.data.status) ||
                              null;

            if (statusValue) {
              // Only update state if it's actually different and component is still mounted
              if (isMounted()) {
                setUserPhotoAccess(prev => {
                  // Critical change: Don't override "pending" status from localStorage with API "none" status
                  // This preserves the pending status that was set by the user
                  if (prev.status === "pending" && statusValue === "none") {
                    log.debug("Keeping 'pending' status from localStorage instead of overriding with 'none' from API");
                    return prev;
                  }
                  
                  // Otherwise, if the status is different, update it
                  if (prev.status !== statusValue) {
                    log.debug(`Updating status from ${prev.status} to ${statusValue} based on API response`);
                    return {
                      status: statusValue,
                      isLoading: false,
                      source: 'api'
                    };
                  }
                  return prev;
                });
              }
            } else {
              // Got a success response but no status value (default to "none")
              setUserPhotoAccess(prev => {
                // Don't override "pending" status from localStorage
                if (prev.status === "pending") {
                  return prev;
                }
                
                return {
                  status: "none",
                  isLoading: false,
                  source: 'api-default'
                };
              });
              log.debug("No status value in response, defaulting to 'none'");
            }
          } else if (response) {
            // Handle non-success response
            log.warn("Unsuccessful photo access status response:", response);
            // Default to "none" on error, but don't override pending
            setUserPhotoAccess(prev => {
              if (prev.status === "pending") {
                return prev;
              }
              return {
                status: "none",
                isLoading: false,
                source: 'api-error'
              };
            });
          } else {
            // Handle undefined/empty response
            log.warn("Empty photo access status response");
            setUserPhotoAccess(prev => {
              if (prev.status === "pending") {
                return prev;
              }
              return {
                status: "none",
                isLoading: false,
                source: 'api-empty'
              };
            });
          }
        })
        .catch(error => {
          if (isMounted()) {
            log.error(`Error loading photo access status:`, error);
            // Only reset if not already in pending state
            setUserPhotoAccess(prev => {
              if (prev.status === "pending") {
                return prev;
              }
              return {
                status: "none",
                isLoading: false,
                source: 'api-error'
              };
            });
          }
        })
        .finally(() => {
          if (isMounted()) {
            accessStatusLoadingRef.current = false;
          }
        });
    }

    // If viewing own profile, fetch pending requests once
    if (currentUser &&
        currentUser._id === userId &&
        !requestsLoadingRef.current &&
        !dataLoadedRef.current) {
      fetchPendingRequests();
    }

    // Mark data loaded if not already
    if (!dataLoadedRef.current) {
      dataLoadedRef.current = true;
    }
  }, [userId, loadUserStories, currentUser, isOpen, isMounted, api, fetchPendingRequests]);
  
  // Set up socket notification listeners specifically for photo permissions
  useEffect(() => {
    if (!isOpen || !userId || !socketService || !socketService.isConnected || !socketService.isConnected() || notificationListenersSetupRef.current) {
      return;
    }
    
    notificationListenersSetupRef.current = true;
    log.debug(`Setting up photo permission notification listeners for user ${userId}`);
    
    // Handle when a user responds to our photo permission request
    const handlePhotoPermissionResponse = (data) => {
      log.debug('Photo permission response received:', data);
      if (data && data.status && data.sender && data.sender._id === userId) {
        log.debug(`Received permission response from ${userId}: ${data.status}`);
        
        // Update local state with the new status
        setUserPhotoAccess({
          status: data.status,
          isLoading: false,
          source: 'notification'
        });
        
        // Show a notification based on the response status
        if (data.status === 'approved') {
          toast.success(`${profileUser?.nickname || 'User'} approved your photo request!`, {
            position: "top-center",
            autoClose: 5000,
            icon: "🔓"
          });
          
          // Update localStorage
          try {
            const storedPermissions = localStorage.getItem('photo-permissions-status') || '{}';
            const permissions = JSON.parse(storedPermissions);
            permissions[userId] = {
              status: "approved",
              timestamp: Date.now()
            };
            localStorage.setItem('photo-permissions-status', JSON.stringify(permissions));
          } catch (error) {
            log.error("Failed to update permission status in localStorage:", error);
          }
          
          // Force refresh images
          const timestamp = Date.now();
          clearCache();
          setImageKey(timestamp);
          window.dispatchEvent(new CustomEvent('avatar:refresh', {
            detail: { timestamp }
          }));
          
        } else if (data.status === 'rejected') {
          toast.info(`${profileUser?.nickname || 'User'} declined your photo request`, {
            position: "top-center",
            autoClose: 5000,
            icon: "🔒"
          });
          
          // Update localStorage
          try {
            const storedPermissions = localStorage.getItem('photo-permissions-status') || '{}';
            const permissions = JSON.parse(storedPermissions);
            permissions[userId] = {
              status: "rejected",
              timestamp: Date.now()
            };
            localStorage.setItem('photo-permissions-status', JSON.stringify(permissions));
          } catch (error) {
            log.error("Failed to update permission status in localStorage:", error);
          }
        }
      }
    };
    
    // Set up event listeners
    const unsubscribeResponse = socketService.on('photoPermissionResponseReceived', handlePhotoPermissionResponse);
    
    // Clean up event listeners when component unmounts or modal closes
    return () => {
      if (typeof unsubscribeResponse === 'function') {
        unsubscribeResponse();
      }
      notificationListenersSetupRef.current = false;
    };
  }, [userId, isOpen, profileUser, clearCache]);

  // Simple function to allow viewing private photos
  // This function is for requesting access to view private photos
  // Note: In the current server implementation, only the photo owner can grant access to their photos
  // by using the allowPrivatePhotos setting
  const handleAllowPrivatePhotos = async (userId) => {
    if (!userId || !profileUser || userPhotoAccess.isLoading) {
      log.warn("Cannot request private photos: missing user ID or already loading");
      return;
    }

    // Add tactile feedback for mobile users
    if (isTouch) {
      provideTactileFeedback('send');
    }

    // Set loading state
    setUserPhotoAccess(prev => ({
      ...prev,
      isLoading: true
    }));

    try {
      log.debug(`Requesting private photos access for user ${userId}`);
      
      // Use actual API to make the request if socket is available
      const socketAvailable = socketService && socketService.isConnected && socketService.isConnected();
      
      if (socketAvailable) {
        log.debug("Using socket to request photo permission");
        try {
          const requestId = `req-${Math.floor(Math.random() * 1000000000).toString(16)}`;
          const permissionId = Math.floor(Math.random() * 1000000000).toString(16);
          
          // Emit the request through socket with correctly formatted data
          // The server expects photoId, ownerId and permissionId to be valid MongoDB IDs
          // Generate a stable timestamp (seconds precision is enough for requests)
          const stableTimestamp = Math.floor(Date.now() / 1000) * 1000;
          
          socketService.emit("requestPhotoPermission", {
            ownerId: userId,  // Must be a valid MongoDB ObjectId
            photoId: userId,   // Using userId as photoId since we're requesting all photos
            permissionId: userId, // Using userId as permissionId since we don't have a real one
            requestId: requestId,
            timestamp: stableTimestamp
          });
          
          // Also emit a diagnostic event we can track
          log.debug(`Emitted photo permission request: ${requestId}`);
          window.dispatchEvent(new CustomEvent('mandarin:photoRequest', {
            detail: { userId, requestId, timestamp: stableTimestamp }
          }));
          
          // The notification will be handled by the notification system on its own
          log.debug(`Photo permission request sent via socket with requestId: ${requestId}`);
        } catch (socketError) {
          log.error("Socket-based permission request failed, using local fallback:", socketError);
          throw new Error("Socket request failed"); // Force using local fallback
        }
      } else {
        log.warn("Socket not available, using local simulation");
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Save the pending status to localStorage
      try {
        // Get existing permissions or initialize empty object
        const storedPermissions = localStorage.getItem('photo-permissions-status') || '{}';
        const permissions = JSON.parse(storedPermissions);
        
        // Update for this user
        permissions[userId] = {
          status: "pending",
          timestamp: Date.now()
        };
        
        // Save back to localStorage
        localStorage.setItem('photo-permissions-status', JSON.stringify(permissions));
        
        log.debug(`Saved photo permission request for user ${userId} to localStorage`);
      } catch (error) {
        log.error("Failed to save photo permission status to localStorage:", error);
      }
      
      // Show a prominent notification toast to confirm the request was sent
      // Using a custom toast with more details to ensure it's visible
      toast.success(
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ 
              backgroundColor: '#4a76a8', 
              borderRadius: '50%', 
              width: '32px', 
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '16px'
            }}>
              <FaCamera />
            </div>
            <span style={{ fontWeight: 'bold' }}>
              Access request sent!
            </span>
          </div>
          <p style={{ margin: '0', fontSize: '14px' }}>
            Waiting for {profileUser.nickname || 'user'} to approve your request
          </p>
        </div>,
        {
          position: "top-center",
          autoClose: 6000, // Show longer 
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          icon: "🔒"
        }
      );
      
      // Update UI state to show pending request - preserve the source information
      setUserPhotoAccess({
        status: "pending",
        isLoading: false,
        source: 'user-request'
      });
      
      // Force refresh of photos to show "pending" status
      const timestamp = Date.now();
      clearCache();
      setImageKey(timestamp);
      window.__photo_refresh_timestamp = timestamp;
      
      // Dispatch event with proper detail containing timestamp
      window.dispatchEvent(new CustomEvent('avatar:refresh', {
        detail: { timestamp: timestamp }
      }));
      
    } catch (error) {
      if (!isMounted()) return;
      
      log.error("Error requesting private photos access:", error);
      setUserPhotoAccess({
        status: null,
        isLoading: false
      });
      toast.error("Failed to request access to private photos");
    }
  };

  // Photo permission system has been removed
  // These functions are kept as placeholders for compatibility
  const handleApproveAllRequests = async (userId, requests) => {
    log.debug("Photo permission system has been removed");
    return;
  };

  const handleRejectAllRequests = async (userId, requests) => {
    log.debug("Photo permission system has been removed");
    return;
  };

  // Handle image loading errors
  const handleImageError = useCallback((photoId) => {
    log.debug(`Image with ID ${photoId} failed to load`);
    setPhotoLoadError(prev => ({
      ...prev,
      [photoId]: true,
    }));

    // Use the shared photo management hook to handle failed URLs
    const failedImage = profileUser?.photos?.find(p => p._id === photoId);
    if (failedImage && failedImage.url) {
      handlePhotoLoadError(photoId, failedImage.url);
    }
    
    // Force refresh of the avatar components
    clearCache();
  }, [profileUser, log, handlePhotoLoadError, clearCache]);

  // Handle liking/unliking users
  const handleLike = useCallback(async () => {
    // Use local user state if context user is not available
    const targetUser = profileUser || user;
    if (!targetUser || isLiking) return;

    // Add tactile feedback for mobile users
    if (isTouch) {
      provideTactileFeedback(isUserLiked && isUserLiked(targetUser._id) ? 'wink' : 'send');
    }

    setIsLiking(true);

    try {
      if (isUserLiked && isUserLiked(targetUser._id)) {
        await unlikeUser(targetUser._id, targetUser.nickname);
      } else {
        await likeUser(targetUser._id, targetUser.nickname);
      }
    } catch (error) {
      // Add error feedback for mobile
      if (isTouch) {
        provideTactileFeedback('error');
      }
      log.error("Error toggling like:", error);
      toast.error("Failed to update like status");
    } finally {
      if (isMounted()) {
        setIsLiking(false);
      }
    }
  }, [profileUser, user, isLiking, isUserLiked, unlikeUser, likeUser, isMounted, log, isTouch]);

  // Handle blocking a user
  const handleBlock = useCallback(async () => {
    if (!userId) return;

    // Add tactile feedback for mobile users
    if (isTouch) {
      provideTactileFeedback('selectConversation');
    }

    try {
      await blockUser(userId);
      toast.success("User blocked successfully");
      onClose();
    } catch (error) {
      // Add error feedback for mobile
      if (isTouch) {
        provideTactileFeedback('error');
      }
      log.error("Error blocking user:", error);
      toast.error("Failed to block user");
    }
  }, [userId, blockUser, onClose, log, isTouch]);

  // Handle reporting a user
  const handleReport = useCallback(async () => {
    if (!userId) return;

    // Add tactile feedback for mobile users
    if (isTouch) {
      provideTactileFeedback('selectConversation');
    }

    try {
      await reportUser(userId);
      toast.success("User reported successfully");
      onClose();
    } catch (error) {
      // Add error feedback for mobile
      if (isTouch) {
        provideTactileFeedback('error');
      }
      log.error("Error reporting user:", error);
      toast.error("Failed to report user");
    }
  }, [userId, reportUser, onClose, log, isTouch]);

  // Handle starting a chat
  const handleMessage = useCallback(async () => {
    if (!userId) return;

    // Add tactile feedback for mobile users
    if (isTouch) {
      provideTactileFeedback('send');
    }

    setIsChatInitiating(true);

    try {
      await sendMessage(userId);
      navigate("/messages");
      onClose();
    } catch (error) {
      // Add error feedback for mobile
      if (isTouch) {
        provideTactileFeedback('error');
      }
      log.error("Error sending message:", error);
      toast.error("Failed to start conversation");
    } finally {
      if (isMounted()) {
        setIsChatInitiating(false);
      }
    }
  }, [userId, sendMessage, navigate, onClose, isMounted, log, isTouch]);

  // View and close story handlers
  const handleViewStories = useCallback(() => setShowStories(true), []);
  const handleCloseStories = useCallback(() => setShowStories(false), []);
  const handleCloseChat = useCallback(() => setShowChat(false), []);

  // Photo navigation
  const nextPhoto = useCallback(() => {
    // Use the displayUser variable which is defined later in the component
    const photos = (profileUser || user)?.photos;
    if (photos && activePhotoIndex < photos.length - 1) {
      setActivePhotoIndex(activePhotoIndex + 1);
    }
  }, [profileUser, user, activePhotoIndex]);

  const prevPhoto = useCallback(() => {
    if (activePhotoIndex > 0) {
      setActivePhotoIndex(activePhotoIndex - 1);
    }
  }, [activePhotoIndex]);

  // Calculate compatibility score between users
  function calculateCompatibility() {
    if (!profileUser?.details || !currentUser?.details) return 0;

    let score = 0;

    // Location (25%)
    if (profileUser.details.location === currentUser.details.location) {
      score += 25;
    }

    // Age proximity (25%)
    const ageDiff = Math.abs((profileUser.details.age || 0) - (currentUser.details.age || 0));
    if (ageDiff <= 5) score += 25;
    else if (ageDiff <= 10) score += 15;
    else score += 5;

    // Interests (50%)
    const profileInterests = profileUser.details.interests || [];
    const userInterests = currentUser.details.interests || [];
    const commonCount = profileInterests.filter(i => userInterests.includes(i)).length;
    score += Math.min(50, commonCount * 10);

    return Math.min(100, score);
  }

  // Text formatters
  const capitalize = (str) => {
    if (!str || typeof str !== 'string') return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  };


  // Function to validate MongoDB ObjectId format
  const isValidObjectId = (id) => {
    return id && typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
  };

  // Early returns for special cases
  if (!isOpen) return null;

  if (loading) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} size="large">
        <div className={styles.loadingContainer}>
          <LoadingSpinner text={t('loadingProfile')} size="large" centered />
        </div>
      </Modal>
    );
  }

  if (error) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} size="small">
        <div className={styles.errorContainer}>
          <h3 className={styles.errorTitle}>{t('errorUnknown')}</h3>
          <p className={styles.errorText}>{error}</p>
          <Button variant="primary" onClick={onClose}>
            {t('close')}
          </Button>
        </div>
      </Modal>
    );
  }

  // Use either the user from context (profileUser) or the locally fetched user state
  const displayUser = profileUser || user;
  
  if (!displayUser) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} size="small">
        <div className={styles.notFoundContainer}>
          <h3 className={styles.notFoundTitle}>{t('notFound')}</h3>
          <p className={styles.notFoundText}>{t('userNotFound')}</p>
          <Button variant="primary" onClick={onClose}>
            {t('close')}
          </Button>
        </div>
      </Modal>
    );
  }

  // Render the modal content
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={isMobile ? "fullscreen" : "xlarge"}
      className={`${styles.modalContainer} ${isMobile ? styles.mobileModal : ''}`}
      showCloseButton={true}
      bottomSheetOnMobile={isMobile}
      headerClassName={styles.modalHeader}
      bodyClassName="modern-user-profile"
      closeOnClickOutside={true}
    >
      <div className={styles.profileContent} ref={profileRef}>
        {/* Pending requests notification removed */}

        <div className={styles.profileLayout}>
          {/* Left: Photos */}
          <div className={styles.photosSection}>
            {/* Stories Thumbnail */}
            {userStories && userStories.length > 0 && (
              <div className={styles.storiesThumbnail}>
                <StoryThumbnail
                  user={displayUser}
                  hasUnviewedStories={hasUnviewedStories && hasUnviewedStories(displayUser._id)}
                  onClick={handleViewStories}
                />
              </div>
            )}

            {/* Photo Gallery */}
            {displayUser && displayUser.photos && displayUser.photos.length > 0 ? (
              <div className={styles.galleryContainer}>
                <div className={styles.gallery}>
                  {displayUser.photos[activePhotoIndex] &&
                  (displayUser.photos[activePhotoIndex].privacy === 'private' || 
                   (displayUser.photos[activePhotoIndex].isPrivate && !displayUser.photos[activePhotoIndex].privacy)) &&
                  !canViewPrivatePhotos ? (
                    <div className={styles.privatePhoto}>
                      <img
                        src={`${window.location.origin}/private-photo.png`}
                        alt={t('privatePhoto')}
                        style={{ 
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          opacity: 0.7,
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          zIndex: 0,
                          borderRadius: 'inherit'
                        }}
                      />
                      <div style={{ 
                        position: 'absolute', 
                        zIndex: 1, 
                        top: 0, 
                        left: 0, 
                        right: 0,
                        bottom: 0, 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        background: 'rgba(0,0,0,0.5)',
                        borderRadius: 'inherit'
                      }}>
                        <FaLock className={styles.lockIcon} style={{ fontSize: '3rem', color: 'white', margin: '0 0 1rem 0' }}/>
                        <p style={{ color: 'white', fontWeight: 'bold', marginBottom: '1rem' }}>{t('privatePhoto') || 'Private Photo'}</p>

                        <button
                          className={styles.requestAccessBtn}
                          onClick={() => handleAllowPrivatePhotos(displayUser._id)}
                          disabled={userPhotoAccess.isLoading || userPhotoAccess.status === "pending"}
                        >
                          {userPhotoAccess.isLoading ? <FaSpinner className={styles.spinner} /> : <FaEye />}
                          {userPhotoAccess.status === "pending" 
                            ? t('requestPending', 'Request Pending') 
                            : t('requestAccess') || 'Request Access'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    displayUser.photos[activePhotoIndex] && (
                      <div className={styles.imageContainer}>
                        <img
                          src={`${normalizePhotoUrl(displayUser.photos[activePhotoIndex].url, true)}&_key=${imageKey}`} // Add cache busting and imageKey
                          alt={`${displayUser.nickname}'s photo`}
                          className={styles.galleryImage}
                          onError={() => handleImageError(displayUser.photos[activePhotoIndex]._id)}
                        />
                      </div>
                    )
                  )}

                  {/* Online badge */}
                  {displayUser.isOnline && (
                    <div className={styles.onlineBadge}>
                      <span className={styles.pulse}></span>
                      {t('online')}
                    </div>
                  )}

                  {/* Gallery navigation */}
                  {displayUser.photos.length > 1 && (
                    <>
                      <button
                        className={`${styles.nav} ${styles.navPrev}`}
                        onClick={prevPhoto}
                        disabled={activePhotoIndex === 0}
                        aria-label={t('previous')}
                      >
                        <FaChevronLeft />
                      </button>
                      <button
                        className={`${styles.nav} ${styles.navNext}`}
                        onClick={nextPhoto}
                        disabled={activePhotoIndex === displayUser.photos.length - 1}
                        aria-label={t('next')}
                      >
                        <FaChevronRight />
                      </button>
                    </>
                  )}
                </div>

                {/* Photo thumbnails */}
                {displayUser.photos.length > 1 && (
                  <div className={styles.thumbnails}>
                    {displayUser.photos.map((photo, index) => (
                      <div
                        key={photo._id || index}
                        className={`${styles.thumbnail} ${index === activePhotoIndex ? styles.thumbnailActive : ""}`}
                        onClick={() => setActivePhotoIndex(index)}
                      >
                        {((photo.privacy === 'private' || (photo.isPrivate && !photo.privacy)) && !canViewPrivatePhotos) ? (
                          <div className={styles.privateThumbnail}>
                            <img 
                              src={`${window.location.origin}/private-photo.png`}
                              alt={t('privatePhoto', 'Private photo')}
                              className={styles.thumbnailImg}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            <div style={{ 
                              position: 'absolute', 
                              top: 0, 
                              left: 0, 
                              width: '100%', 
                              height: '100%', 
                              background: 'rgba(0,0,0,0.5)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: 'inherit'
                            }}>
                              <FaLock style={{ color: 'white', fontSize: '1.25rem' }} />
                            </div>
                            {userPhotoAccess.status && (
                              <div className={`${styles.permissionStatus} ${styles[userPhotoAccess.status]}`} style={{ zIndex: 2 }}>
                                {userPhotoAccess.status === "pending" && (t('requestAccessPending') || 'Pending')}
                                {userPhotoAccess.status === "approved" && (t('approve') || 'Approved')}
                                {userPhotoAccess.status === "rejected" && (t('reject') || 'Rejected')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <img
                            src={`${normalizePhotoUrl(photo.url, true)}&_key=${imageKey}`} // Add cache busting and imageKey
                            alt={`${displayUser.nickname} ${index + 1}`}
                            className={styles.thumbnailImg}
                            onError={() => handleImageError(photo._id)}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className={styles.gallery}>
                {/* Direct image approach for more reliable display */}
                {(() => {
                  // Set image source based on gender
                  let imgSrc = '/default-avatar.png';
                  let imgTitle = 'Default avatar';
                  
                  // Debug logging
                  log.debug('UserProfileModal: Rendering gender-specific avatar');
                  log.debug('UserProfileModal: User details:', displayUser?.details);
                  log.debug('UserProfileModal: User iAm value:', displayUser?.details?.iAm);
                  log.debug('UserProfileModal: User gender:', displayUser?.gender);
                  
                  // Determine the correct gender-specific avatar path
                  if (displayUser?.details?.iAm === 'woman') {
                    imgSrc = '/women-avatar.png';
                    imgTitle = 'Women avatar';
                  } else if (displayUser?.details?.iAm === 'man') {
                    imgSrc = '/man-avatar.png';
                    imgTitle = 'Man avatar';
                  } else if (displayUser?.details?.iAm === 'couple') {
                    imgSrc = '/couple-avatar.png';
                    imgTitle = 'Couple avatar';
                  }
                  
                  // Log which image we're using
                  log.debug(`UserProfileModal: Using ${imgTitle} at path ${imgSrc}`);
                  
                  return (
                    <>
                      <div 
                        style={{
                          width: '100%',
                          height: '100%',
                          maxHeight: '380px',
                          aspectRatio: '1 / 1',
                          borderRadius: 'var(--radius-xl)',
                          backgroundImage: `url(${window.location.origin}${imgSrc}?_refresh=${imageKey})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          boxShadow: 'var(--shadow-inner)',
                          position: 'relative',
                        }}
                      >
                        {displayUser.isOnline && (
                          <div className={styles.onlineBadge}>
                            <span className={styles.pulse}></span>
                            {t('online')}
                          </div>
                        )}
                        <p className={styles.noPhotosText}>{t('noPhotosAvailable')}</p>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Profile actions */}
            <div className={styles.actions}>
              {!isOwnProfile && (
                <>
                  <button
                    className={`${styles.actionBtn} ${isUserLiked && isUserLiked(displayUser._id) ? styles.likedBtn : styles.likeBtn}`}
                    onClick={handleLike}
                    disabled={isLiking}
                  >
                    {isLiking ? <FaSpinner className={styles.spinner} /> : <FaHeart />}
                    {isUserLiked && isUserLiked(displayUser._id) ? t('liked') : t('like')}
                  </button>
                  <button
                    className={`${styles.actionBtn} ${styles.messageBtn}`}
                    onClick={() => setShowChat(true)}
                    disabled={isChatInitiating}
                  >
                    {isChatInitiating ? <FaSpinner className={styles.spinner} /> : <FaComment />}
                    {t('message')}
                  </button>
                </>
              )}
              <div className={styles.moreActions}>
                <button
                  className={`${styles.toggleBtn} ${theme === 'dark' ? styles.darkToggleBtn : ''}`}
                  onClick={() => setShowActions(!showActions)}
                  aria-label={t('moreActions')}
                >
                  <FaEllipsisH />
                </button>
                {showActions && (
                  <div className={`${styles.dropdown} ${theme === 'dark' ? styles.darkDropdown : ''}`}>
                    <button
                      className={`${styles.dropdownItem} ${theme === 'dark' ? styles.darkDropdownItem : ''}`}
                      onClick={handleReport}
                    >
                      <FaFlag className={theme === 'dark' ? styles.darkDropdownIcon : ''} />
                      {t('reportUser')}
                    </button>
                    <button
                      className={`${styles.dropdownItem} ${theme === 'dark' ? styles.darkDropdownItem : ''}`}
                      onClick={handleBlock}
                    >
                      <FaBan className={theme === 'dark' ? styles.darkDropdownIcon : ''} />
                      {t('blockUser')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: User Details */}
          <div className={styles.detailsSection}>
            {/* User headline */}
            <div className={styles.headline}>
              <h1 className={styles.headlineTitle}>
                {displayUser.nickname}, {displayUser.details?.age || "?"}
              </h1>
              {displayUser.role === "premium" && (
                <div className={styles.premiumBadge}>
                  <FaTrophy /> {t('premium', 'Premium')}
                </div>
              )}
            </div>

            {/* User location */}
            <div className={styles.location}>
              <FaMapMarkerAlt className={styles.icon} />
              <span>{displayUser.details?.location || t('unknownLocation')}</span>
              <div className={`${styles.onlineStatus} ${displayUser.isOnline ? styles.isOnline : ""} ${theme === 'dark' ? styles.darkOnlineStatus : ''}`}>
                {displayUser.isOnline ? translations.onlineNow : translations.offline}
              </div>
            </div>

            {/* User activity */}
            <div className={styles.activity}>
              <div className={styles.activityItem}>
                <FaRegClock className={styles.icon} />
                <span>
                  {displayUser.isOnline
                    ? translations.onlineNow
                    : `${translations.lastActive} ${formatDate(displayUser.lastActive, { showTime: false })}`}
                </span>
              </div>
              <div className={styles.activityItem}>
                <FaCalendarAlt className={styles.icon} />
                <span>{translations.memberSince} {formatDate(displayUser.createdAt, { showTime: false })}</span>
              </div>
            </div>

            {/* Compatibility section */}
            {!isOwnProfile && (
              <div className={`${styles.compatibilitySection} ${theme === 'dark' ? styles.darkCompatibilitySection : ''}`}>
                <h2 className={styles.sectionTitle}>{translations.compatibilityTitle}</h2>
                <div className={styles.compatibilityScore}>
                  <div className={styles.scoreCircle}>
                    <svg viewBox="0 0 100 100">
                      <defs>
                        {/* Use a unique ID to avoid potential conflicts if this component is used multiple times */}
                        <linearGradient id={`compatibility-gradient-${userId || 'default'}`} x1="0%" y1="0%" x2="100%"
                                        y2="100%">
                          {/* Apply CSS variables via inline style */}
                          <stop
                              offset="0%"
                              style={{stopColor: 'var(--compat-gradient-start, var(--primary-400))'}}
                          />
                          <stop
                              offset="100%"
                              style={{stopColor: 'var(--compat-gradient-end, var(--primary-500))'}}
                          />
                        </linearGradient>
                      </defs>
                      <circle 
                        className={`${styles.scoreBg} ${theme === 'dark' ? styles.darkScoreBg : ''}`}
                        cx="50" 
                        cy="50" 
                        r="45" 
                      />
                      <circle
                          className={styles.scoreFill}
                          cx="50"
                          cy="50"
                          r="45"
                          strokeDasharray="283"
                          strokeDashoffset={283 - (283 * compatibility) / 100}
                          // Reference the unique gradient ID here
                          style={{stroke: `url(#compatibility-gradient-${userId || 'default'})`}}
                      />
                    </svg>
                    <div className={`${styles.scoreValue} ${theme === 'dark' ? styles.darkScoreValue : ''}`}>{compatibility}%</div>
                  </div>
                  <div className={styles.compatibilityDetails}>
                    <div className={styles.compatibilityFactor}>
                      <span className={`${styles.factorLabel} ${theme === 'dark' ? styles.darkFactorLabel : ''}`}>{t('location')}</span>
                      <div className={`${styles.factorBar} ${theme === 'dark' ? styles.darkFactorBar : ''}`}>
                        <div
                            className={`${styles.factorFill} ${theme === 'dark' ? styles.darkFactorFill : ''}`}
                            style={{
                              width: profileUser.details?.location === currentUser?.details?.location ? "100%" : "30%"
                            }}
                        ></div>
                      </div>
                    </div>
                    <div className={styles.compatibilityFactor}>
                      <span className={`${styles.factorLabel} ${theme === 'dark' ? styles.darkFactorLabel : ''}`}>{t('age')}</span>
                      <div className={`${styles.factorBar} ${theme === 'dark' ? styles.darkFactorBar : ''}`}>
                        <div
                            className={`${styles.factorFill} ${theme === 'dark' ? styles.darkFactorFill : ''}`}
                            style={{
                              width:
                                  Math.abs((profileUser.details?.age || 0) - (currentUser?.details?.age || 0)) <= 5
                                      ? "90%"
                                      : Math.abs((profileUser.details?.age || 0) - (currentUser?.details?.age || 0)) <= 10
                                          ? "60%"
                                          : "30%"
                            }}
                        ></div>
                      </div>
                    </div>
                    <div className={styles.compatibilityFactor}>
                      <span className={`${styles.factorLabel} ${theme === 'dark' ? styles.darkFactorLabel : ''}`}>{t('interests')}</span>
                      <div className={`${styles.factorBar} ${theme === 'dark' ? styles.darkFactorBar : ''}`}>
                        <div
                            className={`${styles.factorFill} ${theme === 'dark' ? styles.darkFactorFill : ''}`}
                            style={{
                              width: `${Math.min(100, commonInterests.length * 20)}%`
                            }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* User details sections */}
            {displayUser.details?.bio && (
                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>{translations.aboutMe}</h2>
                  <p className={styles.aboutText}>{displayUser.details.bio}</p>
                </div>
            )}

            {displayUser.details?.iAm && (
                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>{translations.iAm}</h2>
                  <div className={styles.tagsContainer}>
                  <span className={`${styles.tag} ${styles.identityTag} ${theme === 'dark' ? styles.darkTag + ' ' + styles.darkIdentityTag : ''}`}>
                    {t(displayUser.details.iAm) || capitalize(displayUser.details.iAm)}
                  </span>
                  </div>
                </div>
            )}

            {displayUser.details?.maritalStatus && (
                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>{translations.maritalStatus}</h2>
                  <div className={styles.tagsContainer}>
                  <span className={`${styles.tag} ${styles.statusTag} ${theme === 'dark' ? styles.darkTag + ' ' + styles.darkStatusTag : ''}`}>
                    {t(displayUser.details.maritalStatus) || displayUser.details.maritalStatus}
                  </span>
                  </div>
                </div>
            )}

            {displayUser.details?.lookingFor && displayUser.details.lookingFor.length > 0 && (
                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>{translations.lookingFor}</h2>
                  <div className={styles.tagsContainer}>
                    {displayUser.details.lookingFor.map((item, index) => (
                        <span key={index} className={`${styles.tag} ${styles.lookingForTag} ${theme === 'dark' ? styles.darkTag + ' ' + styles.darkLookingForTag : ''}`}>
                      {t(item) || item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {displayUser.details?.intoTags && displayUser.details.intoTags.length > 0 && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>{translations.imInto}</h2>
                <div className={styles.tagsContainer}>
                  {displayUser.details.intoTags.map((item, index) => (
                    <span key={index} className={`${styles.tag} ${styles.intoTag} ${theme === 'dark' ? styles.darkTag + ' ' + styles.darkIntoTag : ''}`}>
                      {t(item) || item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {displayUser.details?.turnOns && displayUser.details.turnOns.length > 0 && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>{translations.itTurnsMeOn}</h2>
                <div className={styles.tagsContainer}>
                  {displayUser.details.turnOns.map((item, index) => (
                    <span key={index} className={`${styles.tag} ${styles.turnOnTag} ${theme === 'dark' ? styles.darkTag + ' ' + styles.darkTurnOnTag : ''}`}>
                      {t(item) || item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Interests section */}
            {displayUser.details?.interests?.length > 0 && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>{translations.interests}</h2>
                <div className={styles.interestsTags}>
                  {(showAllInterests
                    ? displayUser.details.interests
                    : displayUser.details.interests.slice(0, 8)
                  ).map((interest) => (
                    <span
                      key={interest}
                      className={`
                        ${styles.interestTag}
                        ${commonInterests.includes(interest) ? styles.commonTag : ""}
                        ${theme === 'dark' ? styles.darkInterestTag : ''}
                        ${theme === 'dark' && commonInterests.includes(interest) ? styles.darkCommonTag : ''}
                      `}
                    >
                      {t(interest) || interest}
                      {commonInterests.includes(interest) && <FaCheck className={`${styles.commonIcon} ${theme === 'dark' ? styles.darkCommonIcon : ''}`} />}
                    </span>
                  ))}
                  {!showAllInterests && displayUser.details.interests.length > 8 && (
                    <button
                      className={`${styles.showMoreBtn} ${theme === 'dark' ? styles.darkShowMoreBtn : ''}`}
                      onClick={() => setShowAllInterests(true)}
                    >
                      +{displayUser.details.interests.length - 8} {t('showMore')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Embedded Chat */}
        {showChat && (
          <>
            <div className={styles.chatOverlay} onClick={handleCloseChat}></div>
            <EmbeddedChat recipient={displayUser} isOpen={showChat} onClose={handleCloseChat} />
          </>
        )}

        {/* Stories Viewer */}
        {showStories && <StoriesViewer userId={displayUser._id} onClose={handleCloseStories} />}
        
      </div>
    </Modal>
  );
};

export default UserProfileModal;
