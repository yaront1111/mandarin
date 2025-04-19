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
import { useTranslation } from "react-i18next"
import { useUser, useAuth, useStories, useLanguage } from "../context"
import { EmbeddedChat } from "../components"
import StoriesViewer from "./Stories/StoriesViewer"
import StoryThumbnail from "./Stories/StoryThumbnail"
import { toast } from "react-toastify"
import styles from "../styles/userprofilemodal.module.css"
import { useNavigate } from "react-router-dom"

// Import common components
import { Modal, Button, Avatar, LoadingSpinner } from "./common"
// Import hooks and utilities
import { useApi, useMounted } from "../hooks"
import { formatDate, logger, markUrlAsFailed, normalizePhotoUrl } from "../utils"

/**
 * Safely gets a translation string, handling cases where the translation might return an object
 * @param {Function} t - Translation function from useTranslation
 * @param {String} key - Translation key
 * @param {String} defaultValue - Default value if translation is missing or invalid
 * @returns {String} The translated string or default value
 */
const safeTranslate = (t, key, defaultValue = "") => {
  try {
    // For the problematic nested path keys, try flat format first
    const flatKey = key.replace('.', '_');
    
    // Handle two-level and three-level nested keys
    const parts = key.split('.');
    
    // Try to use paths in different ways to ensure we get strings
    if (parts.length > 1) {
      // Try getting direct access from parent object
      try {
        // Get the parent object (e.g., 'profile' from 'profile.maritalStatus')
        const parentKey = parts[0];
        // Get the rest of the path as array
        const childPath = parts.slice(1);
        
        // Get the parent object from i18n
        const parent = t(parentKey, { returnObjects: true });
        
        // If parent is an object, try to access the child path directly
        if (typeof parent === 'object' && parent !== null) {
          // Navigate to the final value through the object structure
          let value = parent;
          for (const pathPart of childPath) {
            if (value && typeof value === 'object' && pathPart in value) {
              value = value[pathPart];
            } else {
              // Path doesn't exist, break out
              value = null;
              break;
            }
          }
          
          // If we found a string value, return it
          if (typeof value === 'string') {
            return value;
          }
        }
      } catch (e) {
        // Ignore errors in alternative lookup
      }
      
      // Try flat key format (e.g., 'profile_maritalStatus')
      try {
        const flatTranslation = t(flatKey);
        if (typeof flatTranslation === 'string' && flatTranslation !== flatKey) {
          return flatTranslation;
        }
      } catch (e) {
        // Ignore errors in alternative lookup
      }
      
      // For three-level nesting, also try two-level format
      if (parts.length > 2) {
        try {
          const twoLevelKey = `${parts[0]}_${parts[1]}_${parts[2]}`;
          const twoLevelTranslation = t(twoLevelKey);
          if (typeof twoLevelTranslation === 'string' && twoLevelTranslation !== twoLevelKey) {
            return twoLevelTranslation;
          }
        } catch (e) {
          // Ignore errors in alternative lookup
        }
      }
    }
    
    // Try direct translation
    const translated = t(key);
    
    // If it's a string and not just returning the key, use it
    if (typeof translated === 'string' && translated !== key) {
      return translated;
    }
    
    // If it's an object, likely a nested translation object - try to get a string representation or use default
    if (typeof translated === 'object' && translated !== null) {
      // Try to find a string representation
      if (translated.toString && typeof translated.toString === 'function' && 
          translated.toString() !== '[object Object]') {
        return translated.toString();
      }
      
      // If it's a valid translation object with string representation, use that
      return defaultValue;
    }
    
    // Return translated or default
    return translated || defaultValue;
  } catch (error) {
    logger.error(`Translation error for key '${key}':`, error);
    return defaultValue;
  }
};

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
  // Hooks for translation and RTL support
  const { t } = useTranslation();
  const { isRTL, language } = useLanguage();

  // Auth context
  const { user: currentUser } = useAuth();

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

  // SIMPLIFIED ACCESS CONTROL - one state variable for user-level access
  const [userPhotoAccess, setUserPhotoAccess] = useState({
    status: null, // Can be null, "pending", "approved", or "rejected"
    isLoading: false
  });

  // Refs
  const profileRef = useRef(null);
  const storiesLoadingRef = useRef(false);
  const accessStatusLoadingRef = useRef(false);
  const requestsLoadingRef = useRef(false);

  // Hooks
  const navigate = useNavigate();
  const api = useApi();
  const { isMounted } = useMounted();

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
  const canViewPrivatePhotos = userPhotoAccess.status === "approved";

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
        const userData = await getUser(userId);

        if (!isMounted()) return;

        log.debug("User data received:", userData);
        setUser(userData);
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
  }, [userId, isOpen, isMounted]);

  // IMPORTANT: We're not using this callback anymore - it's replaced with a direct API call
  // in the useEffect to prevent loops. Keep this here just for reference and documentation.
  const fetchUserPhotoAccess = useCallback(() => {
    console.log("This function is no longer used - direct API call is made instead");
    // No-op
  }, []);

  // Fetch pending photo access requests
  const fetchPendingRequests = useCallback(async () => {
    // Skip if no currentUser, already loading, or component unmounted
    if (!currentUser || requestsLoadingRef.current || !isMounted()) {
      return;
    }

    // Set loading state
    requestsLoadingRef.current = true;
    setIsLoadingRequests(true);

    try {
      log.debug("Fetching pending photo access requests");
      const response = await api.get("/users/photos/permissions?status=pending");

      // If component unmounted during the request, bail out
      if (!isMounted()) return;

      // Process valid response data
      if (response && response.success) {
        // Get the data array, handling different response formats
        const requestsData = Array.isArray(response) ? response :
                           (Array.isArray(response.data) ? response.data : null);

        if (requestsData) {
          // Group requests by user
          const requestsByUser = {};

          requestsData.forEach((request) => {
            if (request && request.requestedBy && request.requestedBy._id) {
              const userId = request.requestedBy._id;

              if (!requestsByUser[userId]) {
                requestsByUser[userId] = {
                  user: request.requestedBy,
                  requests: [],
                };
              }

              requestsByUser[userId].requests.push(request);
            }
          });

          // Convert to array
          const groupedRequests = Object.values(requestsByUser);

          // Only update state if it actually changed
          setPendingRequests(prevRequests => {
            // Simple length check first
            if (prevRequests.length !== groupedRequests.length) {
              return groupedRequests;
            }

            // Deep comparison using JSON stringify
            try {
              const prevJson = JSON.stringify(prevRequests);
              const newJson = JSON.stringify(groupedRequests);
              return prevJson === newJson ? prevRequests : groupedRequests;
            } catch (err) {
              // If JSON stringify fails, just return the new data
              log.warn("JSON comparison failed:", err);
              return groupedRequests;
            }
          });

          log.debug(`Processed ${groupedRequests.length} pending request groups`);
        } else {
          log.warn("No valid requests data in response:", response);
          // Only update if we don't already have an empty array
          setPendingRequests(prev => prev.length > 0 ? [] : prev);
        }
      } else {
        log.warn("Failed to fetch pending requests:", response);
        // Only update if we don't already have an empty array
        setPendingRequests(prev => prev.length > 0 ? [] : prev);
      }
    } catch (error) {
      // Skip if component unmounted during the request
      if (!isMounted()) return;

      log.error("Error fetching pending requests:", error);
      // Only show error toast if this is a true network error, not just empty data
      if (error.message && !error.message.includes("no pending requests")) {
        toast.error("Failed to load photo access requests");
      }
      // Only update if we don't already have an empty array
      setPendingRequests(prev => prev.length > 0 ? [] : prev);
    } finally {
      // Skip if component unmounted during the request
      if (isMounted()) {
        setIsLoadingRequests(false);
        requestsLoadingRef.current = false;
      }
    }
  }, [currentUser, api, isMounted]);

  // Track whether we've loaded data for this userId and whether the component is mounted
  const dataLoadedRef = useRef(false);
  const calledApiRef = useRef(false);

  // Track modal open/close status with a separate ref to fix infinite update loop
  const isModalOpenRef = useRef(false);
  // Track if we've fetched photo access to avoid redundant calls
  const photoAccessFetchedRef = useRef(false);

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

        log.debug(`Modal cleanup ran for userId: ${userId}`);
      }
      return;
    }

    // Only run when the modal is truly opening (not just re-rendering)
    if (!isModalOpenRef.current) {
      isModalOpenRef.current = true;
      log.debug(`Modal opened for userId: ${userId}, dataLoadedRef: ${dataLoadedRef.current}`);

      // Reset UI state when opening
      setActivePhotoIndex(0);
      setShowAllInterests(false);
      setShowActions(false);
      setPhotoLoadError({});
      setShowChat(false);
      setShowStories(false);

      // Reset permission-related states
      setUserPhotoAccess({
        status: null,
        isLoading: false
      });

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
                  if (prev.status !== statusValue) {
                    return {
                      status: statusValue,
                      isLoading: false
                    };
                  }
                  return prev;
                });
              }
            } else {
              // Got a success response but no status value (default to "none")
              setUserPhotoAccess({
                status: "none",
                isLoading: false
              });
              log.debug("No status value in response, defaulting to 'none'");
            }
          } else if (response) {
            // Handle non-success response
            log.warn("Unsuccessful photo access status response:", response);
            // Default to "none" on error
            setUserPhotoAccess({
              status: "none",
              isLoading: false
            });
          } else {
            // Handle undefined/empty response
            log.warn("Empty photo access status response");
            setUserPhotoAccess({
              status: "none",
              isLoading: false
            });
          }
        })
        .catch(error => {
          if (isMounted()) {
            log.error(`Error loading photo access status:`, error);
            // Reset the loading state on error and provide a default status
            setUserPhotoAccess({
              status: "none",
              isLoading: false
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

  // Request access to all photos
  const handleRequestAccessToAllPhotos = async () => {
    // Prevent multiple requests
    if (!profileUser || !profileUser._id || userPhotoAccess.isLoading) {
      log.warn("Cannot request photo access: missing user ID or already loading");
      return;
    }

    // Track request in progress to prevent duplicate requests
    const requestInProgress = userPhotoAccess.isLoading;
    if (requestInProgress) return;

    // Update loading state
    setUserPhotoAccess(prev => ({
      ...prev,
      isLoading: true
    }));

    try {
      log.debug(`Requesting photo access for user ${profileUser._id}`);

      // ALWAYS set UI to pending state for better UX
      setUserPhotoAccess({
        status: "pending",
        isLoading: false
      });
      toast.success(safeTranslate(t, "profile.accessRequestSent", "Access to photos requested"));

      try {
        // Make a single API call to request access to all photos (but don't block UI)
        const response = await api.post(`/users/${profileUser._id}/request-photo-access`);

        if (!isMounted()) return;

        if (response && response.success) {
          log.debug("Photo access request successful:", response.message || "Request processed");
        } else if (response) {
          // Log the partial success or warning
          log.info("Photo access request partially successful:", response);
        } else {
          // Log empty response but don't change the UI
          log.warn("Photo access request returned empty response but UI shows success");
        }
      } catch (apiError) {
        // Log but don't affect UI - user already sees success toast
        log.error("Backend error in photo access request (UI unaffected):", apiError);
      }
    } catch (error) {
      if (!isMounted()) return;

      log.error("Error in photo access request flow:", error);

      // Always show success to user and set to pending state
      setUserPhotoAccess({
        status: "pending",
        isLoading: false
      });
      toast.success(safeTranslate(t, "profile.accessRequestSent", "Access to photos requested"));
    }
  };

  // Handle approving all requests from a specific user
  const handleApproveAllRequests = async (userId, requests) => {
    if (!userId || !isValidObjectId(userId) ||
        !requests || !Array.isArray(requests) || requests.length === 0) {
      log.warn("Invalid user ID or empty requests array for approval");
      return;
    }

    if (isProcessingApproval) {
      log.warn("Already processing approval/rejection request");
      return;
    }

    setIsProcessingApproval(true);

    try {
      log.debug(`Approving all photo requests from user ${userId}`);
      // Single API call to approve all requests from this user
      const response = await api.put(`/users/${userId}/approve-photo-access`);

      if (!isMounted()) return;

      if (response && response.success) {
        toast.success(safeTranslate(t, "profile.approvedAllRequests", "Approved all photo requests from this user"));
        log.debug("Successfully approved photo requests");

        // Remove this user from pending requests without refetching
        setPendingRequests(prev => prev.filter(item =>
          !item.user || item.user._id !== userId
        ));
      } else {
        log.warn("Failed to approve photo requests:", response);
        toast.error(response?.error || safeTranslate(t, "errors.approvalFailed", "Failed to approve photo requests"));
      }
    } catch (error) {
      if (!isMounted()) return;

      log.error("Error approving requests:", error);
      toast.error(error?.error || safeTranslate(t, "errors.approvalFailed", "Failed to approve photo requests"));
    } finally {
      if (isMounted()) {
        setIsProcessingApproval(false);
      }
    }
  };

  // Handle rejecting all requests from a specific user
  const handleRejectAllRequests = async (userId, requests) => {
    if (!userId || !isValidObjectId(userId) ||
        !requests || !Array.isArray(requests) || requests.length === 0) {
      log.warn("Invalid user ID or empty requests array for rejection");
      return;
    }

    if (isProcessingApproval) {
      log.warn("Already processing approval/rejection request");
      return;
    }

    setIsProcessingApproval(true);

    try {
      log.debug(`Rejecting all photo requests from user ${userId}`);
      // Single API call to reject all requests from this user
      const response = await api.put(`/users/${userId}/reject-photo-access`);

      if (!isMounted()) return;

      if (response && response.success) {
        toast.success(safeTranslate(t, "profile.rejectedAllRequests", "Rejected all photo requests from this user"));
        log.debug("Successfully rejected photo requests");

        // Remove this user from pending requests without refetching
        setPendingRequests(prev => prev.filter(item =>
          !item.user || item.user._id !== userId
        ));
      } else {
        log.warn("Failed to reject photo requests:", response);
        toast.error(response?.error || safeTranslate(t, "errors.rejectionFailed", "Failed to reject photo requests"));
      }
    } catch (error) {
      if (!isMounted()) return;

      log.error("Error rejecting requests:", error);
      toast.error(error?.error || safeTranslate(t, "errors.rejectionFailed", "Failed to reject photo requests"));
    } finally {
      if (isMounted()) {
        setIsProcessingApproval(false);
      }
    }
  };

  // Handle image loading errors
  const handleImageError = useCallback((photoId) => {
    log.debug(`Image with ID ${photoId} failed to load`);
    setPhotoLoadError(prev => ({
      ...prev,
      [photoId]: true,
    }));

    // Mark any unsplash URLs as failed to prevent retries
    const failedImage = profileUser?.photos?.find(p => p._id === photoId);
    if (failedImage && failedImage.url && (
      failedImage.url.includes('unsplash.com') ||
      !failedImage.url.startsWith(window.location.origin)
    )) {
      markUrlAsFailed(failedImage.url);
    }
  }, [profileUser]);

  // Handle liking/unliking users
  const handleLike = async () => {
    if (!profileUser || isLiking) return;

    setIsLiking(true);

    try {
      if (isUserLiked && isUserLiked(profileUser._id)) {
        await unlikeUser(profileUser._id, profileUser.nickname);
      } else {
        await likeUser(profileUser._id, profileUser.nickname);
      }
    } catch (error) {
      log.error("Error toggling like:", error);
      toast.error(safeTranslate(t, "errors.likeUpdateFailed", "Failed to update like status"));
    } finally {
      if (isMounted()) {
        setIsLiking(false);
      }
    }
  };

  // Handle blocking a user
  const handleBlock = async () => {
    if (!userId) return;

    try {
      await blockUser(userId);
      toast.success(safeTranslate(t, "profile.userBlocked", "User blocked successfully"));
      onClose();
    } catch (error) {
      log.error("Error blocking user:", error);
      toast.error(safeTranslate(t, "errors.blockFailed", "Failed to block user"));
    }
  };

  // Handle reporting a user
  const handleReport = async () => {
    if (!userId) return;

    // Create a simple prompt for the report reason
    const reason = prompt(safeTranslate(t, "profile.reportPrompt", "Please provide a reason for reporting this user:"));

    // If user cancels, abort the report
    if (reason === null) {
      return;
    }

    try {
      await reportUser(userId, reason);
      toast.success(safeTranslate(t, "profile.userReported", "User reported successfully"));
      onClose();
    } catch (error) {
      log.error("Error reporting user:", error);
      toast.error(safeTranslate(t, "errors.reportFailed", "Failed to report user"));
    }
  };

  // Handle starting a chat
  const handleMessage = async () => {
    if (!userId) return;

    setIsChatInitiating(true);

    try {
      await sendMessage(userId);
      navigate("/messages");
      onClose();
    } catch (error) {
      log.error("Error sending message:", error);
      toast.error(safeTranslate(t, "errors.conversationFailed", "Failed to start conversation"));
    } finally {
      if (isMounted()) {
        setIsChatInitiating(false);
      }
    }
  };

  // View and close story handlers
  const handleViewStories = () => setShowStories(true);
  const handleCloseStories = () => setShowStories(false);
  const handleCloseChat = () => setShowChat(false);

  // Photo navigation
  const nextPhoto = () => {
    if (profileUser?.photos && activePhotoIndex < profileUser.photos.length - 1) {
      setActivePhotoIndex(activePhotoIndex + 1);
    }
  };

  const prevPhoto = () => {
    if (activePhotoIndex > 0) {
      setActivePhotoIndex(activePhotoIndex - 1);
    }
  };

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

  // Helper to translate profile data (identity, lookingFor, etc.)
  const getTranslatedTag = useCallback((namespace, tag) => {
    if (!tag) return "";
    
    // Format the tag key according to the patterns we've been supporting
    // Method 1: Direct nested access
    const nestedKey = `${namespace}.${tag.toLowerCase().replace(/\s+/g, '_')}`;
    
    // Method 2: Special prefixed key format for common patterns
    let prefixKey = null;
    
    if (namespace === 'profile.intoTags') {
      prefixKey = `profile.intoTag_${tag.toLowerCase().replace(/\s+/g, '_')}`;
    } else if (namespace === 'profile.turnOns') {
      prefixKey = `profile.turnOn_${tag.toLowerCase().replace(/\s+/g, '_')}`;
    } else if (namespace === 'profile.interests') {
      prefixKey = `profile.interests${capitalize(tag.replace(/\s+/g, '_'))}`;
    }
    
    // Method 3: Direct flat access for key section values
    const directKey = `profile_${namespace.split('.').pop()}_${tag.toLowerCase().replace(/\s+/g, '_')}`;
    
    // Method 4: Flattened key
    const flatKey = nestedKey.replace(/\./g, '_');
    
    // Method 5: Simple key format
    const simpleKey = `profile_${tag.toLowerCase().replace(/\s+/g, '_')}`;
    
    // Debug key resolution (uncomment for debugging)
    // console.log('Translation tag lookup:', { namespace, tag, nestedKey, prefixKey, directKey, flatKey, simpleKey });
    
    // Try each of the key formats in order
    // First try the direct flat format for section values (most specific)
    try {
      const directTranslation = t(directKey);
      if (typeof directTranslation === 'string' && directTranslation !== directKey) {
        return directTranslation;
      }
    } catch (e) {
      // Ignore errors in lookup
    }
    
    // Then try the special prefixed format
    if (prefixKey) {
      try {
        const prefixTranslation = t(prefixKey);
        if (typeof prefixTranslation === 'string' && prefixTranslation !== prefixKey) {
          return prefixTranslation;
        }
      } catch (e) {
        // Ignore errors in lookup
      }
    }
    
    // Next try the simple key format 
    try {
      const simpleTranslation = t(simpleKey);
      if (typeof simpleTranslation === 'string' && simpleTranslation !== simpleKey) {
        return simpleTranslation;
      }
    } catch (e) {
      // Ignore errors in lookup
    }
    
    // Then try the direct path access through safeTranslate
    const safeResult = safeTranslate(t, nestedKey, null);
    if (safeResult && safeResult !== nestedKey) {
      return safeResult;
    }
    
    // Then try the flat key
    try {
      const flatTranslation = t(flatKey);
      if (typeof flatTranslation === 'string' && flatTranslation !== flatKey) {
        return flatTranslation;
      }
    } catch (e) {
      // Ignore errors in lookup
    }
    
    // Fallback 1: Try to get the tag directly from translations
    try {
      const directTagTranslation = t(tag.toLowerCase().replace(/\s+/g, '_'));
      if (typeof directTagTranslation === 'string' && 
          directTagTranslation !== tag.toLowerCase().replace(/\s+/g, '_')) {
        return directTagTranslation;
      }
    } catch (e) {
      // Ignore errors in lookup
    }
    
    // Fallback 2: Just clean up and return the tag
    return capitalize(tag.replace(/_/g, ' '));
  }, [t]);

  // Text formatter
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
          <LoadingSpinner text={safeTranslate(t, 'common.loadingProfile', 'Loading profile...')} size="large" centered />
        </div>
      </Modal>
    );
  }

  if (error) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} size="small">
        <div className={styles.errorContainer}>
          <h3 className={styles.errorTitle}>{safeTranslate(t, 'common.errorLoadingProfile', 'Error Loading Profile')}</h3>
          <p className={styles.errorText}>{error}</p>
          <Button variant="primary" onClick={onClose}>
            {safeTranslate(t, 'common.close', 'Close')}
          </Button>
        </div>
      </Modal>
    );
  }

  if (!profileUser) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} size="small">
        <div className={styles.notFoundContainer}>
          <h3 className={styles.notFoundTitle}>{safeTranslate(t, 'common.userNotFound', 'User Not Found')}</h3>
          <p className={styles.notFoundText}>{safeTranslate(t, 'common.userNotFoundDesc', 'This user profile could not be found or has been removed.')}</p>
          <Button variant="primary" onClick={onClose}>
            {safeTranslate(t, 'common.close', 'Close')}
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
      size="xlarge"
      className={`${styles.modalContainer} ${isRTL ? 'rtl-layout' : ''}`}
      showCloseButton={true}
      headerClassName={`${styles.modalHeader} ${isRTL ? 'rtl-layout' : ''}`}
      bodyClassName={`modern-user-profile ${isRTL ? 'rtl-layout' : ''}`}
      closeOnClickOutside={true}
      data-force-rtl={isRTL ? 'true' : undefined}
      data-language={language || 'en'}
    >
      <div className={`${styles.profileContent} ${isRTL ? 'rtl-layout' : ''}`} ref={profileRef} data-force-rtl={isRTL ? 'true' : undefined} data-language={language || 'en'}>
        {/* Pending requests notification */}
        {!isOwnProfile && hasPendingRequestFromUser && currentUserRequests && (
          <div className={styles.requestNotification}>
            <div className={styles.notificationContent}>
              <FaEye className={styles.notificationIcon} />
              <p className={styles.notificationText}>
                <strong>{profileUser.nickname}</strong> {safeTranslate(t, 'profile.requestedPhotoAccess', 'requested access to your photos')}
              </p>
            </div>
            <div className={styles.notificationActions}>
              <button
                className={styles.approveBtn}
                onClick={() => handleApproveAllRequests(profileUser._id, currentUserRequests.requests)}
                disabled={isProcessingApproval}
              >
                {isProcessingApproval ? <FaSpinner className={styles.spinner} /> : <FaCheck />}
                {safeTranslate(t, 'common.approve', 'Approve')}
              </button>
              <button
                className={styles.rejectBtn}
                onClick={() => handleRejectAllRequests(profileUser._id, currentUserRequests.requests)}
                disabled={isProcessingApproval}
              >
                {isProcessingApproval ? <FaSpinner className={styles.spinner} /> : <FaBan />}
                {safeTranslate(t, 'common.reject', 'Reject')}
              </button>
            </div>
          </div>
        )}

        <div className={styles.profileLayout}>
          {/* Left: Photos */}
          <div className={styles.photosSection}>
            {/* Stories Thumbnail */}
            {userStories && userStories.length > 0 && (
              <div className={styles.storiesThumbnail}>
                <StoryThumbnail
                  user={profileUser}
                  hasUnviewedStories={hasUnviewedStories && hasUnviewedStories(profileUser._id)}
                  onClick={handleViewStories}
                />
              </div>
            )}

            {/* Photo Gallery */}
            {profileUser && profileUser.photos && profileUser.photos.length > 0 ? (
              <div className={styles.galleryContainer}>
                <div className={styles.gallery}>
                  {profileUser.photos[activePhotoIndex] &&
                  profileUser.photos[activePhotoIndex].isPrivate &&
                  !canViewPrivatePhotos ? (
                    <div className={styles.privatePhoto}>
                      <FaLock className={styles.lockIcon} />
                      <p>{safeTranslate(t, 'profile.privatePhoto', 'This photo is private')}</p>

                      {userPhotoAccess.status === "pending" && (
                        <p className={`${styles.permissionStatus} ${styles.pending}`}>{safeTranslate(t, 'profile.accessRequestPending', 'Access request pending')}</p>
                      )}

                      {userPhotoAccess.status === "rejected" && (
                        <p className={`${styles.permissionStatus} ${styles.rejected}`}>{safeTranslate(t, 'profile.accessDenied', 'Access request denied')}</p>
                      )}

                      {(!userPhotoAccess.status || userPhotoAccess.status === "none") && (
                        <button
                          className={styles.requestAccessBtn}
                          onClick={handleRequestAccessToAllPhotos}
                          disabled={userPhotoAccess.isLoading}
                        >
                          {userPhotoAccess.isLoading ? <FaSpinner className={styles.spinner} /> : null}
                          {safeTranslate(t, 'profile.requestPhotoAccess', 'Request Access')}
                        </button>
                      )}
                    </div>
                  ) : (
                    profileUser.photos[activePhotoIndex] && (
                      <div className={styles.imageContainer}>
                        <img
                          src={normalizePhotoUrl(profileUser.photos[activePhotoIndex].url)}
                          alt={`${profileUser.nickname}'s photo`}
                          className={styles.galleryImage}
                          onError={() => handleImageError(profileUser.photos[activePhotoIndex]._id)}
                        />
                      </div>
                    )
                  )}

                  {/* Online badge */}
                  {profileUser.isOnline && (
                    <div className={styles.onlineBadge}>
                      <span className={styles.pulse}></span>
                      {safeTranslate(t, 'common.onlineNow', 'Online Now')}
                    </div>
                  )}

                  {/* Gallery navigation */}
                  {profileUser.photos.length > 1 && (
                    <>
                      <button
                        className={`${styles.nav} ${styles.navPrev} ${isRTL ? 'rtl-nav' : ''}`}
                        onClick={prevPhoto}
                        disabled={activePhotoIndex === 0}
                        aria-label={safeTranslate(t, 'profile.previousPhoto', 'Previous photo')}
                      >
                        {isRTL ? <FaChevronRight /> : <FaChevronLeft />}
                      </button>
                      <button
                        className={`${styles.nav} ${styles.navNext} ${isRTL ? 'rtl-nav' : ''}`}
                        onClick={nextPhoto}
                        disabled={activePhotoIndex === profileUser.photos.length - 1}
                        aria-label={safeTranslate(t, 'profile.nextPhoto', 'Next photo')}
                      >
                        {isRTL ? <FaChevronLeft /> : <FaChevronRight />}
                      </button>
                    </>
                  )}
                </div>

                {/* Photo thumbnails */}
                {profileUser.photos.length > 1 && (
                  <div className={styles.thumbnails}>
                    {profileUser.photos.map((photo, index) => (
                      <div
                        key={photo._id || index}
                        className={`${styles.thumbnail} ${index === activePhotoIndex ? styles.thumbnailActive : ""}`}
                        onClick={() => setActivePhotoIndex(index)}
                      >
                        {photo.isPrivate && !canViewPrivatePhotos ? (
                          <div className={styles.privateThumbnail}>
                            <FaLock />
                            {userPhotoAccess.status && (
                              <div className={`${styles.permissionStatus} ${styles[userPhotoAccess.status]}`}>
                                {userPhotoAccess.status === "pending" && safeTranslate(t, 'common.pending', 'Pending')}
                                {userPhotoAccess.status === "approved" && safeTranslate(t, 'common.granted', 'Granted')}
                                {userPhotoAccess.status === "rejected" && safeTranslate(t, 'common.denied', 'Denied')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <img
                            src={normalizePhotoUrl(photo.url)}
                            alt={`${profileUser.nickname} ${index + 1}`}
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
                <Avatar
                  size="xlarge"
                  placeholder={normalizePhotoUrl("/default-avatar.png")}
                  alt={profileUser.nickname}
                  status={profileUser.isOnline ? "online" : null}
                />
                <p>{safeTranslate(t, 'profile.noPhotosAvailable', 'No photos available')}</p>
              </div>
            )}

            {/* Profile actions */}
            <div className={styles.actions}>
              {!isOwnProfile && (
                <>
                  <button
                    className={`${styles.actionBtn} ${isUserLiked && isUserLiked(profileUser._id) ? styles.likedBtn : styles.likeBtn}`}
                    onClick={handleLike}
                    disabled={isLiking}
                  >
                    {isLiking ? <FaSpinner className={styles.spinner} /> : <FaHeart />}
                    {isUserLiked && isUserLiked(profileUser._id)
                      ? safeTranslate(t, 'common.liked', 'Liked')
                      : safeTranslate(t, 'common.like', 'Like')}
                  </button>
                  <button
                    className={`${styles.actionBtn} ${styles.messageBtn}`}
                    onClick={handleMessage}
                    disabled={isChatInitiating}
                  >
                    {isChatInitiating ? <FaSpinner className={styles.spinner} /> : <FaComment />}
                    {safeTranslate(t, 'common.message', 'Message')}
                  </button>
                </>
              )}
              <div className={styles.moreActions}>
                <button
                  className={styles.toggleBtn}
                  onClick={() => setShowActions(!showActions)}
                  aria-label="More actions"
                >
                  <FaEllipsisH />
                </button>
                {showActions && (
                  <div className={styles.dropdown}>
                    <button
                      className={styles.dropdownItem}
                      onClick={handleReport}
                    >
                      <FaFlag />
                      {safeTranslate(t, 'profile.reportUser', 'Report User')}
                    </button>
                    <button
                      className={styles.dropdownItem}
                      onClick={handleBlock}
                    >
                      <FaBan />
                      {safeTranslate(t, 'profile.blockUser', 'Block User')}
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
                {profileUser.nickname}, {profileUser.details?.age || "?"}
              </h1>
              {profileUser.role === "premium" && (
                <div className={styles.premiumBadge}>
                  <FaTrophy /> {safeTranslate(t, 'common.premium', 'Premium')}
                </div>
              )}
            </div>

            {/* User location */}
            <div className={styles.location}>
              <FaMapMarkerAlt className={styles.icon} />
              <span>{profileUser.details?.location || safeTranslate(t, 'profile.unknownLocation', 'Unknown location')}</span>
              <div className={`${styles.onlineStatus} ${profileUser.isOnline ? styles.isOnline : ""}`}>
                {profileUser.isOnline
                  ? safeTranslate(t, 'common.onlineNow', 'Online Now')
                  : safeTranslate(t, 'common.offline', 'Offline')}
              </div>
            </div>

            {/* User activity */}
            <div className={styles.activity}>
              <div className={styles.activityItem}>
                <FaRegClock className={styles.icon} />
                <span>
                  {profileUser.isOnline
                    ? safeTranslate(t, 'common.activeNow', 'Active now')
                    : safeTranslate(t, 'profile.lastActive', 'פעילות אחרונה: {{date}}', { 
                        date: profileUser.lastActive 
                          ? formatDate(profileUser.lastActive, { showTime: false, locale: language === 'he' ? 'he-IL' : 'en-US' }) 
                          : 'N/A' 
                      })}
                </span>
              </div>
              <div className={styles.activityItem}>
                <FaCalendarAlt className={styles.icon} />
                <span>{safeTranslate(t, 'profile.memberSince', 'חבר מאז: {{date}}', { 
                  date: profileUser.createdAt 
                    ? formatDate(profileUser.createdAt, { showTime: false, locale: language === 'he' ? 'he-IL' : 'en-US' }) 
                    : 'N/A' 
                })}</span>
              </div>
            </div>

            {/* Compatibility section */}
            {!isOwnProfile && (
              <div className={styles.compatibilitySection}>
                <h2 className={styles.sectionTitle}>{t('profile.compatibility', 'Compatibility')}</h2>
                <div className={styles.compatibilityScore}>
                  <div className={styles.scoreCircle}>
                    <svg viewBox="0 0 100 100">
                      <defs>
                        <linearGradient id="compatibility-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#ff3366" />
                          <stop offset="100%" stopColor="#ff6b98" />
                        </linearGradient>
                      </defs>
                      <circle className={styles.scoreBg} cx="50" cy="50" r="45" />
                      <circle
                        className={styles.scoreFill}
                        cx="50"
                        cy="50"
                        r="45"
                        strokeDasharray="283"
                        strokeDashoffset={283 - (283 * compatibility) / 100}
                      />
                    </svg>
                    <div className={styles.scoreValue}>{compatibility}%</div>
                  </div>
                  <div className={styles.compatibilityDetails}>
                    <div className={styles.compatibilityFactor}>
                      <span className={styles.factorLabel}>{safeTranslate(t, 'profile.location', 'Location')}</span>
                      <div className={styles.factorBar}>
                        <div
                          className={styles.factorFill}
                          style={{
                            width:
                              profileUser.details?.location === currentUser?.details?.location ? "100%" : "30%",
                          }}
                        ></div>
                      </div>
                    </div>
                    <div className={styles.compatibilityFactor}>
                      <span className={styles.factorLabel}>{safeTranslate(t, 'profile.age', 'Age')}</span>
                      <div className={styles.factorBar}>
                        <div
                          className={styles.factorFill}
                          style={{
                            width:
                              Math.abs((profileUser.details?.age || 0) - (currentUser?.details?.age || 0)) <= 5
                                ? "90%"
                                : Math.abs((profileUser.details?.age || 0) - (currentUser?.details?.age || 0)) <= 10
                                  ? "60%"
                                  : "30%",
                          }}
                        ></div>
                      </div>
                    </div>
                    <div className={styles.compatibilityFactor}>
                      <span className={styles.factorLabel}>{safeTranslate(t, 'profile.interests', 'Interests')}</span>
                      <div className={styles.factorBar}>
                        <div
                          className={styles.factorFill}
                          style={{
                            width: `${Math.min(100, commonInterests.length * 20)}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* User details sections */}
            {profileUser.details?.bio && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>{t('profile.aboutMe', 'About Me')}</h2>
                <p className={styles.aboutText}>{profileUser.details.bio}</p>
              </div>
            )}

            {profileUser.details?.iAm && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>{t('profile.iAm', 'I am')}</h2>
                <div className={styles.tagsContainer}>
                  <span className={`${styles.tag} ${styles.identityTag}`}>
                    {getTranslatedTag('profile.identity', profileUser.details.iAm)}
                  </span>
                </div>
              </div>
            )}

            {profileUser.details?.maritalStatus && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>{t('profile.maritalStatusLabel', 'Marital Status')}</h2>
                <div className={styles.tagsContainer}>
                  <span className={`${styles.tag} ${styles.statusTag}`}>
                    {getTranslatedTag('profile.maritalStatus', profileUser.details.maritalStatus)}
                  </span>
                </div>
              </div>
            )}

            {profileUser.details?.lookingFor && profileUser.details.lookingFor.length > 0 && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>{t('profile.lookingForLabel', 'Looking For')}</h2>
                <div className={styles.tagsContainer}>
                  {profileUser.details.lookingFor.map((item, index) => (
                    <span key={index} className={`${styles.tag} ${styles.lookingForTag}`}>
                      {getTranslatedTag('profile.lookingFor', item)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {profileUser.details?.intoTags && profileUser.details.intoTags.length > 0 && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>{t('profile.imIntoLabel', "I'm Into")}</h2>
                <div className={styles.tagsContainer}>
                  {profileUser.details.intoTags.map((item, index) => (
                    <span key={index} className={`${styles.tag} ${styles.intoTag}`}>
                      {getTranslatedTag('profile.intoTags', item)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {profileUser.details?.turnOns && profileUser.details.turnOns.length > 0 && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>{t('profile.turnOnsLabel', 'Turn Ons')}</h2>
                <div className={styles.tagsContainer}>
                  {profileUser.details.turnOns.map((item, index) => (
                    <span key={index} className={`${styles.tag} ${styles.turnOnTag}`}>
                      {item === 'leather_latex_clothing' ? 
                        t('leather_latex_clothing', 'Leather/latex clothing') : 
                        getTranslatedTag('profile.turnOns', item)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Interests section */}
            {profileUser.details?.interests?.length > 0 && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>{t('profile.interests', 'Interests')}</h2>
                <div className={styles.interestsTags}>
                  {(showAllInterests
                    ? profileUser.details.interests
                    : profileUser.details.interests.slice(0, 8)
                  ).map((interest) => (
                    <span
                      key={interest}
                      className={`${styles.interestTag} ${commonInterests.includes(interest) ? styles.commonTag : ""}`}
                    >
                      {getTranslatedTag('profile.interests', interest)}
                      {commonInterests.includes(interest) && <FaCheck className={styles.commonIcon} />}
                    </span>
                  ))}
                  {!showAllInterests && profileUser.details.interests.length > 8 && (
                    <button
                      className={styles.showMoreBtn}
                      onClick={() => setShowAllInterests(true)}
                    >
                      +{profileUser.details.interests.length - 8} {safeTranslate(t, 'common.more', 'more')}
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
            <EmbeddedChat recipient={profileUser} isOpen={showChat} onClose={handleCloseChat} />
          </>
        )}

        {/* Stories Viewer */}
        {showStories && <StoriesViewer userId={profileUser._id} onClose={handleCloseStories} />}
      </div>
    </Modal>
  );
};

export default UserProfileModal;
