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
    compatibilityTitle: t('userProfile.compatibility'),
    location: t('userProfile.location'),
    age: t('userProfile.age'),
    interests: t('userProfile.interests'),
    aboutMe: t('userProfile.aboutMe'),
    iAm: t('userProfile.iAm'),
    maritalStatus: t('userProfile.maritalStatus'),
    lookingFor: t('userProfile.lookingFor'),
    imInto: t('userProfile.imInto'),
    itTurnsMeOn: t('userProfile.itTurnsMeOn'),
    onlineNow: t('userProfile.onlineNow'),
    offline: t('userProfile.offline'),
    lastActive: t('userProfile.lastActive'),
    memberSince: t('userProfile.memberSince')
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

  // Simple function to allow viewing private photos
  const handleAllowPrivatePhotos = async (userId) => {
    if (!userId || !profileUser || userPhotoAccess.isLoading) {
      log.warn("Cannot allow private photos: missing user ID or already loading");
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
      log.debug(`Allowing private photos access for user ${userId}`);
      
      // Make API call to update user's privacy settings
      const response = await api.post(`/users/${userId}/allow-private-photos`);

      if (!isMounted()) return;

      if (response && response.success) {
        // Update local state to reflect the change
        setUserPhotoAccess({
          status: "approved",
          isLoading: false
        });
        
        toast.success("Private photos access allowed");
        log.debug("Private photos access allowed successfully");
        
        // Force refresh of photos
        clearCache();
        window.dispatchEvent(new CustomEvent('avatar:refresh'));
      } else {
        log.warn("Failed to allow private photos access:", response);
        setUserPhotoAccess({
          status: null,
          isLoading: false
        });
        toast.error("Failed to allow private photos access");
      }
    } catch (error) {
      if (!isMounted()) return;
      
      log.error("Error allowing private photos access:", error);
      setUserPhotoAccess({
        status: null,
        isLoading: false
      });
      toast.error("Failed to allow private photos access");
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
  
  // Helper to translate tags - looks for translations first, falls back to original
  const translateTag = useCallback((tag) => {
    if (!tag) return '';
    
    // Normalize the tag - remove extra spaces, lowercase for lookup
    const normalizedTag = tag.trim().toLowerCase();
    
    // Handle special case transformations
    let lookupKey = normalizedTag
      .replace(/[\/\\]/g, '_')     // Replace slashes with underscores
      .replace(/\s+/g, '_')        // Replace spaces with underscores
      .replace(/[&+]/g, 'and')     // Replace & or + with "and"
      .replace(/[^\w_]/g, '');     // Remove other special chars
    
    // Special case mappings for tags that might have variations
    const specialCaseMappings = {
      'online': 'online_fun',
      'camera': 'camera_chat',
      'public': 'in_a_public_place',
      'leather': 'leather_latex_clothing',
      'latex': 'leather_latex_clothing',
      'power': 'power_play',
      'massage': 'sensual_massage',
      'sensual': 'sensual_massage',
      'risk': 'risktaking',
      'taking risks': 'risktaking',
      'talk': 'dirty_talk',
      'dirty': 'dirty_talk',
      'במקום ציבורי': 'in_a_public_place',
      'דיבור מלוכלך': 'dirty_talk',
      'מוזיקה': 'music',
      'תחומי עניין': 'interests',
      'אני אוהב/ת': 'imInto',
      'מחפש/ת': 'lookingFor',
      'מדליק אותי': 'itTurnsMeOn'
    };
    
    // Check if it's a special case partial match
    for (const [partial, fullKey] of Object.entries(specialCaseMappings)) {
      if (normalizedTag.includes(partial)) {
        lookupKey = fullKey;
        break;
      }
    }
    
    // Handle special section headers that are tags themselves
    if (lookupKey === 'interests' || lookupKey === 'imInto' || lookupKey === 'lookingFor' || lookupKey === 'itTurnsMeOn') {
      return translations[lookupKey] || tag;
    }
    
    // Try to find a translation using the normalized tag as a key
    const translationKey = `userProfile.tags.${lookupKey}`;
    const translated = t(translationKey);
    
    // If the translation key doesn't exist, it will return the key itself
    // In that case, fall back to the original tag with proper capitalization
    if (translationKey === translated) {
      // Preserve original capitalization
      return tag;
    }
    
    return translated;
  }, [t]);

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
          <LoadingSpinner text={t('userProfile.loadingProfile')} size="large" centered />
        </div>
      </Modal>
    );
  }

  if (error) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} size="small">
        <div className={styles.errorContainer}>
          <h3 className={styles.errorTitle}>{t('userProfile.errorTitle')}</h3>
          <p className={styles.errorText}>{error}</p>
          <Button variant="primary" onClick={onClose}>
            {t('userProfile.close')}
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
          <h3 className={styles.notFoundTitle}>{t('userProfile.notFoundTitle')}</h3>
          <p className={styles.notFoundText}>{t('userProfile.notFoundText')}</p>
          <Button variant="primary" onClick={onClose}>
            {t('userProfile.close')}
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
                      <FaLock className={styles.lockIcon} />
                      <p>{t('userProfile.privatePhoto')}</p>

                      <button
                        className={styles.requestAccessBtn}
                        onClick={() => handleAllowPrivatePhotos(displayUser._id)}
                        disabled={userPhotoAccess.isLoading}
                      >
                        {userPhotoAccess.isLoading ? <FaSpinner className={styles.spinner} /> : <FaEye />}
                        {t('userProfile.allowPrivatePhotos')}
                      </button>
                    </div>
                  ) : (
                    displayUser.photos[activePhotoIndex] && (
                      <div className={styles.imageContainer}>
                        <img
                          src={normalizePhotoUrl(displayUser.photos[activePhotoIndex].url, true)} // Add cache busting
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
                      {t('userProfile.onlineNow')}
                    </div>
                  )}

                  {/* Gallery navigation */}
                  {displayUser.photos.length > 1 && (
                    <>
                      <button
                        className={`${styles.nav} ${styles.navPrev}`}
                        onClick={prevPhoto}
                        disabled={activePhotoIndex === 0}
                        aria-label={t('userProfile.previous')}
                      >
                        <FaChevronLeft />
                      </button>
                      <button
                        className={`${styles.nav} ${styles.navNext}`}
                        onClick={nextPhoto}
                        disabled={activePhotoIndex === displayUser.photos.length - 1}
                        aria-label={t('userProfile.next')}
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
                            <FaLock />
                            {userPhotoAccess.status && (
                              <div className={`${styles.permissionStatus} ${styles[userPhotoAccess.status]}`}>
                                {userPhotoAccess.status === "pending" && t('userProfile.requestAccessPending')}
                                {userPhotoAccess.status === "approved" && t('userProfile.approve')}
                                {userPhotoAccess.status === "rejected" && t('userProfile.reject')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <img
                            src={normalizePhotoUrl(photo.url, true)} // Add cache busting
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
                <Avatar
                  user={displayUser}
                  size="xlarge"
                  alt={displayUser.nickname}
                  status={displayUser.isOnline ? "online" : null}
                  showOnlineStatus={true}
                />
                <p>{t('userProfile.noPhotosAvailable')}</p>
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
                    {isUserLiked && isUserLiked(displayUser._id) ? t('userProfile.liked') : t('userProfile.like')}
                  </button>
                  <button
                    className={`${styles.actionBtn} ${styles.messageBtn}`}
                    onClick={() => setShowChat(true)}
                    disabled={isChatInitiating}
                  >
                    {isChatInitiating ? <FaSpinner className={styles.spinner} /> : <FaComment />}
                    {t('userProfile.message')}
                  </button>
                </>
              )}
              <div className={styles.moreActions}>
                <button
                  className={`${styles.toggleBtn} ${theme === 'dark' ? styles.darkToggleBtn : ''}`}
                  onClick={() => setShowActions(!showActions)}
                  aria-label={t('userProfile.moreActions')}
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
                      {t('userProfile.reportUser')}
                    </button>
                    <button
                      className={`${styles.dropdownItem} ${theme === 'dark' ? styles.darkDropdownItem : ''}`}
                      onClick={handleBlock}
                    >
                      <FaBan className={theme === 'dark' ? styles.darkDropdownIcon : ''} />
                      {t('userProfile.blockUser')}
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
                  <FaTrophy /> {t('userProfile.premium', 'Premium')}
                </div>
              )}
            </div>

            {/* User location */}
            <div className={styles.location}>
              <FaMapMarkerAlt className={styles.icon} />
              <span>{displayUser.details?.location || t('userProfile.unknownLocation')}</span>
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
                      <span className={`${styles.factorLabel} ${theme === 'dark' ? styles.darkFactorLabel : ''}`}>{t('userProfile.location')}</span>
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
                      <span className={`${styles.factorLabel} ${theme === 'dark' ? styles.darkFactorLabel : ''}`}>{t('userProfile.age')}</span>
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
                      <span className={`${styles.factorLabel} ${theme === 'dark' ? styles.darkFactorLabel : ''}`}>{t('userProfile.interests')}</span>
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
                    {capitalize(translateTag(displayUser.details.iAm))}
                  </span>
                  </div>
                </div>
            )}

            {displayUser.details?.maritalStatus && (
                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>{translations.maritalStatus}</h2>
                  <div className={styles.tagsContainer}>
                  <span className={`${styles.tag} ${styles.statusTag} ${theme === 'dark' ? styles.darkTag + ' ' + styles.darkStatusTag : ''}`}>
                    {translateTag(displayUser.details.maritalStatus)}
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
                      {translateTag(item)}
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
                      {translateTag(item)}
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
                      {translateTag(item)}
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
                      {translateTag(interest)}
                      {commonInterests.includes(interest) && <FaCheck className={`${styles.commonIcon} ${theme === 'dark' ? styles.darkCommonIcon : ''}`} />}
                    </span>
                  ))}
                  {!showAllInterests && displayUser.details.interests.length > 8 && (
                    <button
                      className={`${styles.showMoreBtn} ${theme === 'dark' ? styles.darkShowMoreBtn : ''}`}
                      onClick={() => setShowAllInterests(true)}
                    >
                      +{displayUser.details.interests.length - 8} {t('userProfile.showMore')}
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
