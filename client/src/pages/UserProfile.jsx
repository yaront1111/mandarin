// src/pages/UserProfile.jsx
"use client";

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  FaArrowLeft, FaHeart, FaComment, FaEllipsisH, FaMapMarkerAlt,
  FaCalendarAlt, FaRegClock, FaCheck, FaChevronRight, FaChevronLeft,
  FaLock, FaUserAlt, FaTrophy, FaFlag, FaBan, FaCamera, FaSpinner, FaEye,
  FaExclamationTriangle // Added for error state
} from "react-icons/fa";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

// Contexts
import { useUser, useAuth, useStories, useLanguage } from "../context";

// Components
import { Navbar, EmbeddedChat } from "../components"; // Assuming Navbar is desired on the page
import StoriesViewer from "../components/Stories/StoriesViewer";
import StoryThumbnail from "../components/Stories/StoryThumbnail";
import { Button, Avatar, LoadingSpinner } from "../components/common"; // Ensure common components are imported

// Services and Utils
import { toast } from "react-toastify";
import { permissionClient, apiService } from "../services";
import { useApi, useMounted } from "../hooks"; // Ensure hooks are correctly imported
import { formatDate, logger, markUrlAsFailed, normalizePhotoUrl } from "../utils";

// Import the MODAL's CSS module for styling consistency
import styles from "../styles/userprofilemodal.module.css"; // Use modal styles

// Helper to safely get translations (same as in modal)
const safeTranslate = (t, key, defaultValue = "") => {
  // ... (keep the safeTranslate function as defined in UserProfileModal.jsx) ...
   try {
    const parts = key.split('.');
    if (parts.length > 1) {
      try {
        const parentKey = parts[0];
        const childPath = parts.slice(1);
        const parent = t(parentKey, { returnObjects: true });
        if (typeof parent === 'object' && parent !== null) {
          let value = parent;
          for (const pathPart of childPath) {
            if (value && typeof value === 'object' && pathPart in value) {
              value = value[pathPart];
            } else {
              value = null; break;
            }
          }
          if (typeof value === 'string') return value;
        }
      } catch (e) {}
      const flatKey = key.replace('.', '_');
       try {
        const flatTranslation = t(flatKey);
        if (typeof flatTranslation === 'string' && flatTranslation !== flatKey) return flatTranslation;
      } catch (e) {}
       if (parts.length > 2) {
         try {
          const twoLevelKey = `${parts[0]}_${parts[1]}_${parts[2]}`;
          const twoLevelTranslation = t(twoLevelKey);
          if (typeof twoLevelTranslation === 'string' && twoLevelTranslation !== twoLevelKey) return twoLevelTranslation;
        } catch (e) {}
      }
    }
     const translated = t(key);
    if (typeof translated === 'string' && translated !== key) return translated;
    if (typeof translated === 'object' && translated !== null) {
       if (translated.toString && typeof translated.toString === 'function' && translated.toString() !== '[object Object]') {
        return translated.toString();
      }
      return defaultValue;
    }
    return translated || defaultValue;
  } catch (error) {
    logger.error(`Translation error for key '${key}':`, error);
    return defaultValue;
  }
};


const UserProfilePage = () => {
  const { id: userId } = useParams(); // Get userId from URL params
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isRTL, language } = useLanguage() || {};
  const { user: currentUser } = useAuth();
  const {
    getUser, // We'll use this for fetching
    // profileUser: contextProfileUser, // Avoid potential naming conflict with local state
    likeUser, unlikeUser, isUserLiked, blockUser, reportUser, sendMessage,
    error: userContextError // Capture context error if needed
  } = useUser() || {};
  const { loadUserStories, hasUnviewedStories } = useStories() || {};

  // State management (similar to modal)
  const [profileUser, setProfileUser] = useState(null); // Local state for the fetched profile
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userStories, setUserStories] = useState([]);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [showActions, setShowActions] = useState(false);
  const [showAllInterests, setShowAllInterests] = useState(false);
  const [showStories, setShowStories] = useState(false);
  const [photoLoadError, setPhotoLoadError] = useState({});
  const [isLiking, setIsLiking] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [isProcessingApproval, setIsProcessingApproval] = useState(false);
  const [userPhotoAccess, setUserPhotoAccess] = useState({ status: null, isLoading: false });

  // Refs
  const profileRef = useRef(null);
  const storiesLoadingRef = useRef(false);
  const accessStatusLoadingRef = useRef(false);
  const requestsLoadingRef = useRef(false);
  const isMountedRef = useRef(true); // Mounted check ref
  const lastFetchedUserIdRef = useRef(null); // Prevent fetch loops

  // Hooks
  const api = useApi(); // If direct API calls are needed (like in modal)
  const { isMounted } = useMounted(); // Use mounted hook

  // Create contextual logger
  const log = logger.create('UserProfilePage'); // Changed logger name

  // --- Mounted Ref Effect ---
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // --- Memoized values (same as modal) ---
  const isOwnProfile = useMemo(() => currentUser?._id === userId, [currentUser, userId]);

  const compatibility = useMemo(() => {
    // ... (keep compatibility calculation logic) ...
     if (!profileUser?.details || !currentUser?.details) return 0;
    let score = 0;
    if (profileUser.details.location?.toLowerCase() === currentUser.details.location?.toLowerCase()) score += 25;
    const ageDiff = Math.abs((profileUser.details.age || 0) - (currentUser.details.age || 0));
    if (ageDiff <= 5) score += 25; else if (ageDiff <= 10) score += 15; else score += 5;
    const commonCount = (profileUser.details.interests || []).filter(i => (currentUser.details.interests || []).includes(i)).length;
    score += Math.min(50, commonCount * 10); // Adjusted score weight for interests
    return Math.min(100, Math.max(0, score));
  }, [profileUser, currentUser]);

  const commonInterests = useMemo(() => {
    // ... (keep common interests calculation logic) ...
     if (!profileUser?.details?.interests || !currentUser?.details?.interests) return [];
     return profileUser.details.interests.filter(interest => currentUser.details.interests.includes(interest));
  }, [profileUser, currentUser]);

   // --- Data Fetching ---
  // Combined fetch function for user, permissions, stories
  const fetchPageData = useCallback(async () => {
    if (!userId || lastFetchedUserIdRef.current === userId) {
      log.debug("Skipping fetch: No userId or already fetched.");
      return;
    }

    setLoading(true);
    setError(null); // Reset error on new fetch
    setProfileUser(null); // Reset profile on new fetch
    setUserPhotoAccess({ status: null, isLoading: false }); // Reset access
    setUserStories([]); // Reset stories
    setActivePhotoIndex(0); // Reset photo index
    lastFetchedUserIdRef.current = userId; // Mark as fetching this user
    log.info(`Workspaceing page data for userId: ${userId}`);

    try {
       // Fetch User Profile using getUser from context
      const userData = await getUser(userId); // Use context's getUser
      if (!isMountedRef.current) return; // Check mount status after async call
      if (!userData) { // getUser might return null on error
          throw new Error(userContextError || 'User not found or failed to fetch');
      }
      setProfileUser(userData.user); // Assuming getUser returns { user: ..., messages: ... }

       // Fetch Photo Access Status (only if not own profile)
      if (!isOwnProfile) {
          setUserPhotoAccess(prev => ({ ...prev, isLoading: true }));
          accessStatusLoadingRef.current = true;
           try {
              const response = await api.get(`/users/${userId}/photo-access-status`);
              if (isMountedRef.current) {
                  const statusValue = response?.success ? (response.status || (response.data && response.data.status) || "none") : "none";
                   setUserPhotoAccess({ status: statusValue, isLoading: false });
              }
          } catch (accessError) {
              log.error("Error fetching photo access status:", accessError);
              if (isMountedRef.current) setUserPhotoAccess({ status: "none", isLoading: false });
          } finally {
               accessStatusLoadingRef.current = false;
          }
      }

       // Fetch Stories
       storiesLoadingRef.current = true;
       try {
           const stories = await loadUserStories?.(userId);
           if (isMountedRef.current && Array.isArray(stories)) {
               setUserStories(stories);
           }
       } catch (storyError) {
           log.error("Error loading stories:", storyError);
       } finally {
           storiesLoadingRef.current = false;
       }

       // Fetch Pending Requests (if viewing own profile)
      if (isOwnProfile) {
          await fetchPendingRequests(); // Call this function defined below
      }

    } catch (err) {
        log.error("Error fetching page data:", err);
        if (isMountedRef.current) {
            setError(err.message || 'Failed to load profile data.');
        }
    } finally {
        if (isMountedRef.current) {
            setLoading(false);
        }
    }
  }, [userId, getUser, isOwnProfile, api, loadUserStories, userContextError]); // Added dependencies

  // Fetch pending requests (for owner's view) - same as modal
  const fetchPendingRequests = useCallback(async () => {
    // ... (keep fetchPendingRequests implementation as defined in modal/previous step) ...
     if (!currentUser || !isOwnProfile || requestsLoadingRef.current) return;
    requestsLoadingRef.current = true;
    setIsLoadingRequests(true);
    try {
      const response = await api.get("/users/photos/permissions?status=pending");
       if (response.success && isMountedRef.current) {
         const requestsByUser = {};
         (response.data || []).forEach(req => {
            if (!req?.requestedBy?._id) return;
           const reqUserId = req.requestedBy._id;
           if (!requestsByUser[reqUserId]) requestsByUser[reqUserId] = { user: req.requestedBy, requests: [] };
           requestsByUser[reqUserId].requests.push(req);
         });
         setPendingRequests(Object.values(requestsByUser));
       }
    } catch (error) {
        log.error("Error fetching pending requests:", error);
        toast.error("Failed to load photo access requests");
    } finally {
        if (isMountedRef.current) setIsLoadingRequests(false);
        requestsLoadingRef.current = false;
    }
  }, [currentUser, isOwnProfile, api]); // Removed isMounted dependency, checks inside

  // --- Trigger Data Fetch on Mount/userId Change ---
  useEffect(() => {
    fetchPageData();

    // Reset ref when component unmounts or userId changes, allowing refetch
    return () => {
      lastFetchedUserIdRef.current = null;
    };
  }, [userId, fetchPageData]); // Depend on userId and the fetch function instance

  // --- Handlers (mostly same as modal) ---
  const handleRequestAccessToAllPhotos = async () => {
    // ... (keep logic from modal, ensure it uses profileUser state) ...
    if (!profileUser || !profileUser._id || userPhotoAccess.isLoading) return;
    setUserPhotoAccess(prev => ({ ...prev, isLoading: true }));
    try {
      setUserPhotoAccess({ status: "pending", isLoading: false });
      toast.success(safeTranslate(t, "profile.accessRequestSent", "Access to photos requested"));
      await api.post(`/users/${profileUser._id}/request-photo-access`);
      // No UI update needed here, success is optimistic
    } catch (error) {
      log.error("Error requesting all photo access:", error);
      // UI already shows pending/success optimistically
    }
    // Don't reset loading here, let status drive UI
  };

   const handleApprovalAction = async (targetUserId, requests, status) => {
    // ... (keep logic from modal) ...
    if (!targetUserId || !requests?.length || isProcessingApproval) return;
    setIsProcessingApproval(true);
    const endpoint = status === 'approved' ? 'approve' : 'reject';
    try {
        const response = await api.put(`/users/${targetUserId}/${endpoint}-photo-access`);
        if (response?.success) {
            toast.success(`Successfully ${status} ${requests.length} request(s).`);
            setPendingRequests(prev => prev.filter(item => item.user._id !== targetUserId)); // Optimistic UI update
        } else {
            toast.error(response?.error || `Failed to ${status} requests.`);
        }
    } catch (error) {
        log.error(`Error ${status}ing requests:`, error);
        toast.error(error?.error || `Failed to ${status} requests.`);
    } finally {
        if (isMountedRef.current) setIsProcessingApproval(false);
    }
  };
  const handleApproveAllRequests = (targetUserId, requests) => handleApprovalAction(targetUserId, requests, 'approved');
  const handleRejectAllRequests = (targetUserId, requests) => handleApprovalAction(targetUserId, requests, 'rejected');
  const handleImageError = useCallback((photoId) => {
    // ... (keep logic from modal) ...
    log.debug(`Image with ID ${photoId} failed to load`);
    setPhotoLoadError(prev => ({ ...prev, [photoId]: true }));
    const failedImage = profileUser?.photos?.find(p => p._id === photoId);
    if (failedImage?.url) markUrlAsFailed(failedImage.url);
  }, [profileUser]);

  const handleLike = async () => {
    // ... (keep logic from modal, ensure it uses profileUser state) ...
    if (!profileUser || isLiking || !likeUser || !unlikeUser || !isUserLiked) return;
    setIsLiking(true);
    try {
        const currentlyLiked = isUserLiked(profileUser._id);
        await (currentlyLiked ? unlikeUser : likeUser)(profileUser._id, profileUser.nickname);
    } catch (error) {
        log.error("Error toggling like:", error);
        toast.error(safeTranslate(t, "errors.likeUpdateFailed", "Failed to update like status"));
    } finally {
        if (isMountedRef.current) setIsLiking(false);
    }
  };
  const handleBlock = async () => {
    // ... (keep logic from modal) ...
    if (!profileUser || !blockUser) return;
    if (window.confirm(safeTranslate(t, 'profile.confirmBlock', `Block ${profileUser.nickname}?`, { name: profileUser.nickname }))) {
        try {
            await blockUser(profileUser._id);
            toast.info(safeTranslate(t, 'profile.userBlocked', `${profileUser.nickname} blocked.`, { name: profileUser.nickname }));
            navigate('/dashboard'); // Navigate away after blocking
        } catch (err) {
            toast.error(err.message || safeTranslate(t, 'errors.blockFailed', "Block failed."));
        }
    }
  };
  const handleReport = async () => {
    // ... (keep logic from modal) ...
    if (!profileUser || !reportUser) return;
    const reason = prompt(safeTranslate(t, 'profile.reportPrompt', `Reason for reporting ${profileUser.nickname}:`, { name: profileUser.nickname }));
    if (reason?.trim()) {
        try {
            await reportUser(profileUser._id, reason);
            toast.success(safeTranslate(t, 'profile.userReported', `${profileUser.nickname} reported.`, { name: profileUser.nickname }));
            navigate('/dashboard'); // Navigate away
        } catch (err) {
            toast.error(err.message || safeTranslate(t, 'errors.reportFailed', "Report failed."));
        }
    } else if (reason !== null) { // Only show warning if prompt wasn't cancelled
        toast.warning(safeTranslate(t, 'errors.reportReasonRequired', "A reason is required to report."));
    }
  };
  const handleMessage = async () => {
    // ... (keep logic from previous step, using sendMessage from useUser) ...
    if (!profileUser || !sendMessage) return;
    setIsSendingMessage(true);
    try {
        const chatData = await sendMessage(profileUser._id);
        if (chatData) {
            navigate(`/messages/${profileUser._id}`);
        } else {
            toast.error(safeTranslate(t, 'errors.conversationFailed', "Could not start chat."));
        }
    } catch (err) {
        log.error("Error initiating chat via handleMessage:", err);
        toast.error(err.message || safeTranslate(t, 'errors.conversationFailed', "Failed to start chat."));
    } finally {
        if (isMountedRef.current) setIsSendingMessage(false);
    }
  };
  const handleViewStories = () => { if (userStories?.length > 0) setShowStories(true); };
  const handleCloseStories = () => setShowStories(false);
  const nextPhoto = () => { if (profileUser?.photos && activePhotoIndex < profileUser.photos.length - 1) setActivePhotoIndex(i => i + 1); };
  const prevPhoto = () => { if (activePhotoIndex > 0) setActivePhotoIndex(i => i - 1); };

  // Helper to translate profile data tags (same as modal)
  const getTranslatedTag = useCallback((namespace, tag) => {
    // ... (keep getTranslatedTag function as defined in modal) ...
     if (!tag) return "";
    const keysToTry = [
        `${namespace}.${tag.toLowerCase().replace(/\s+/g, '_')}`, // profile.interests.reading
        `${namespace.split('.')[0]}_${tag.toLowerCase().replace(/\s+/g, '_')}`, // profile_reading (less likely)
         tag.toLowerCase().replace(/\s+/g, '_') // reading
    ];
    for (const key of keysToTry) {
        try {
            const translated = t(key);
            if (translated !== key) return translated;
        } catch (e) {}
    }
    return capitalize(tag.replace(/_/g, ' ')); // Fallback
  }, [t]);

  // Capitalize helper (same as modal)
  const capitalize = (str = "") => str ? str.charAt(0).toUpperCase() + str.slice(1) : "";

  // Check if user can view private photos (same as modal)
  const canViewPrivatePhotos = useMemo(() => isOwnProfile || userPhotoAccess.status === "approved", [isOwnProfile, userPhotoAccess.status]);


  // --- Render Logic ---
  if (loading && !profileUser) { // Show full page loading only if no user data is present yet
    return (
      <div className="min-vh-100 d-flex flex-column">
        <Navbar />
        <div className="flex-grow-1 d-flex align-items-center justify-content-center">
            <LoadingSpinner text={safeTranslate(t, 'common.loadingProfile', 'Loading profile...')} size="large" centered />
        </div>
      </div>
    );
  }

  if (error) { // Show full page error
     return (
       <div className="min-vh-100 d-flex flex-column">
         <Navbar />
          <div className="flex-grow-1 d-flex align-items-center justify-content-center text-center p-4">
             <div className="bg-white p-5 rounded shadow">
                 <FaExclamationTriangle className="text-danger text-4xl mb-3" />
                <h3 className="text-xl font-bold mb-2">{safeTranslate(t, 'common.errorLoadingProfile', 'Error Loading Profile')}</h3>
                <p className="text-muted mb-4">{error}</p>
                <Button variant="primary" onClick={() => navigate('/dashboard')}>
                    {safeTranslate(t, 'common.backToDashboard', 'Back to Dashboard')}
                </Button>
             </div>
          </div>
       </div>
     );
  }

  if (!profileUser) { // Show full page not found
     return (
       <div className="min-vh-100 d-flex flex-column">
         <Navbar />
          <div className="flex-grow-1 d-flex align-items-center justify-content-center text-center p-4">
             <div className="bg-white p-5 rounded shadow">
                <FaUserAlt className="text-gray-400 text-4xl mb-3" />
                <h3 className="text-xl font-bold mb-2">{safeTranslate(t, 'common.userNotFound', 'User Not Found')}</h3>
                <p className="text-muted mb-4">{safeTranslate(t, 'common.userNotFoundDesc', 'This user profile could not be found.')}</p>
                 <Button variant="primary" onClick={() => navigate('/dashboard')}>
                     {safeTranslate(t, 'common.backToDashboard', 'Back to Dashboard')}
                 </Button>
             </div>
          </div>
       </div>
     );
  }

  // --- Main Page JSX (Using Modal's Structure & Styles) ---
  return (
    <div className={`min-vh-100 bg-light-subtle ${isRTL ? 'rtl-layout' : ''}`} ref={profileRef} data-force-rtl={isRTL ? 'true' : null} data-language={language}>
       <Navbar /> {/* Page includes Navbar */}
       <div className={`container max-w-screen-lg mx-auto py-4 px-3`}> {/* Adjust container width if needed */}
         <Button
           variant="outline-secondary"
           className="rounded-pill d-inline-flex align-items-center gap-2 mb-4 shadow-sm hover-scale transition-all"
           onClick={() => navigate(-1)}
           aria-label={t('common.back', 'Back')}
         >
           <FaArrowLeft /> <span>{t('common.back', 'Back')}</span>
         </Button>

          {/* --- Content mirroring UserProfileModal --- */}
          {/* Apply the modal's main content class and layout */}
          <div className={`${styles.profileContent} ${isRTL ? 'rtl-layout' : ''} bg-white rounded-lg shadow-lg overflow-hidden`}>

            {/* Pending requests notification (if applicable) */}
            {!isOwnProfile && pendingRequests.find(item => item.user._id === profileUser._id) && (
                // ... (render pending request notification bar as in modal) ...
                 <div className={styles.requestNotification}>
                     <div className={styles.notificationContent}>
                         <FaEye className={styles.notificationIcon} />
                         <p className={styles.notificationText}>
                             <strong>{profileUser.nickname}</strong> {safeTranslate(t, 'profile.requestedPhotoAccess', 'requested access to your photos')}
                         </p>
                     </div>
                    {/* Approval buttons would likely go on the *requester's* profile, not here */}
                 </div>
            )}
            {/* Owner's view of pending requests */}
            {isOwnProfile && pendingRequests.length > 0 && (
                <div className={`${styles.section} bg-yellow-50 border border-yellow-200 p-3 rounded mb-4`}>
                    <h2 className={`${styles.sectionTitle} text-yellow-800`}>{safeTranslate(t, 'profile.pendingRequestsTitle', 'Pending Photo Requests')} ({pendingRequests.length})</h2>
                    <div className="space-y-2">
                        {pendingRequests.map(item => (
                            <div key={item.user._id} className="flex items-center justify-between bg-white p-2 rounded shadow-sm">
                                <div className="flex items-center gap-2">
                                    <Avatar src={normalizePhotoUrl(item.user.photos?.[0]?.url)} alt={item.user.nickname} size="small" />
                                    <span>{item.user.nickname} ({item.requests.length})</span>
                                </div>
                                <div className="flex gap-2">
                                    <Button size="x-small" variant="success" onClick={() => handleApproveAllRequests(item.user._id, item.requests)} disabled={isProcessingApproval} icon={<FaCheck />}>
                                        {safeTranslate(t, 'common.approve', 'Approve')}
                                    </Button>
                                    <Button size="x-small" variant="danger" onClick={() => handleRejectAllRequests(item.user._id, item.requests)} disabled={isProcessingApproval} icon={<FaBan />}>
                                         {safeTranslate(t, 'common.reject', 'Reject')}
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}


            {/* Main Layout (Photos | Details) using modal's structure */}
            <div className={styles.profileLayout}>

              {/* Left: Photos Section (Copy from Modal) */}
              <div className={styles.photosSection}>
                 {/* Stories Thumbnail */}
                {userStories?.length > 0 && (
                  <div className={styles.storiesThumbnail}>
                    <StoryThumbnail
                      user={profileUser}
                      hasUnviewedStories={hasUnviewedStories?.(profileUser._id)}
                      onClick={handleViewStories}
                    />
                  </div>
                )}
                 {/* Photo Gallery */}
                {profileUser.photos?.length > 0 ? (
                  <div className={styles.galleryContainer}>
                    <div className={styles.gallery}>
                       {/* Private Photo Placeholder / Image Display */}
                       {profileUser.photos[activePhotoIndex]?.isPrivate && !canViewPrivatePhotos ? (
                          <div className={styles.privatePhoto}>
                              <FaLock className={styles.lockIcon} />
                              <p>{safeTranslate(t, 'profile.privatePhoto', 'This photo is private')}</p>
                              {userPhotoAccess.status === "pending" && <p className={`${styles.permissionStatus} ${styles.pending}`}>{safeTranslate(t, 'profile.accessRequestPending', 'Access request pending')}</p>}
                              {userPhotoAccess.status === "rejected" && <p className={`${styles.permissionStatus} ${styles.rejected}`}>{safeTranslate(t, 'profile.accessDenied', 'Access request denied')}</p>}
                              {(!userPhotoAccess.status || userPhotoAccess.status === "none") && !isOwnProfile && (
                                 <button className={styles.requestAccessBtn} onClick={handleRequestAccessToAllPhotos} disabled={userPhotoAccess.isLoading}>
                                      {userPhotoAccess.isLoading ? <FaSpinner className={styles.spinner} /> : <FaEye />}
                                      {safeTranslate(t, 'profile.requestPhotoAccess', 'Request Access')}
                                  </button>
                              )}
                          </div>
                      ) : (
                          profileUser.photos[activePhotoIndex] && (
                               <div className={styles.imageContainer}>
                                  <img src={normalizePhotoUrl(profileUser.photos[activePhotoIndex].url)} alt={`${profileUser.nickname} - Photo ${activePhotoIndex + 1}`} className={styles.galleryImage} onError={() => handleImageError(profileUser.photos[activePhotoIndex]._id)} />
                              </div>
                          )
                      )}
                       {/* Online badge */}
                      {profileUser.isOnline && <div className={styles.onlineBadge}><span className={styles.pulse}></span> {safeTranslate(t, 'common.onlineNow', 'Online Now')}</div>}
                       {/* Gallery navigation */}
                      {profileUser.photos.length > 1 && (
                          <>
                              <button className={`${styles.nav} ${styles.navPrev} ${isRTL ? 'rtl-nav' : ''}`} onClick={prevPhoto} disabled={activePhotoIndex === 0} aria-label={safeTranslate(t, 'profile.previousPhoto', 'Previous photo')}>{isRTL ? <FaChevronRight /> : <FaChevronLeft />}</button>
                              <button className={`${styles.nav} ${styles.navNext} ${isRTL ? 'rtl-nav' : ''}`} onClick={nextPhoto} disabled={activePhotoIndex === profileUser.photos.length - 1} aria-label={safeTranslate(t, 'profile.nextPhoto', 'Next photo')}>{isRTL ? <FaChevronLeft /> : <FaChevronRight />}</button>
                          </>
                      )}
                    </div>
                     {/* Photo thumbnails */}
                    {profileUser.photos.length > 1 && (
                      <div className={styles.thumbnails}>
                         {profileUser.photos.map((photo, index) => (
                            <div key={photo._id || index} className={`${styles.thumbnail} ${index === activePhotoIndex ? styles.thumbnailActive : ""}`} onClick={() => setActivePhotoIndex(index)}>
                               {photo.isPrivate && !canViewPrivatePhotos ? (
                                  <div className={styles.privateThumbnail}><FaLock />
                                      {/* Optional: Show mini status on thumb */}
                                      {userPhotoAccess.status && userPhotoAccess.status !== 'approved' && <div className={`${styles.permissionStatusMini} ${styles[userPhotoAccess.status]}`}></div>}
                                  </div>
                              ) : (
                                  <img src={normalizePhotoUrl(photo.url)} alt={`${profileUser.nickname} ${index + 1}`} className={styles.thumbnailImg} onError={() => handleImageError(photo._id)} loading="lazy"/>
                              )}
                            </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={styles.gallery}> {/* No photos state */}
                     <Avatar size="xlarge" placeholder={normalizePhotoUrl("/default-avatar.png")} alt={profileUser.nickname} status={profileUser.isOnline ? "online" : null} />
                     <p className="mt-3 text-muted">{safeTranslate(t, 'profile.noPhotosAvailable', 'No photos available')}</p>
                  </div>
                )}
                 {/* Profile actions (same as modal) */}
                <div className={styles.actions}>
                    {!isOwnProfile && (
                        <>
                            <button className={`${styles.actionBtn} ${isUserLiked?.(profileUser._id) ? styles.likedBtn : styles.likeBtn}`} onClick={handleLike} disabled={isLiking}>
                                {isLiking ? <FaSpinner className={styles.spinner} /> : <FaHeart />} {isUserLiked?.(profileUser._id) ? safeTranslate(t, 'common.liked', 'Liked') : safeTranslate(t, 'common.like', 'Like')}
                            </button>
                            <button className={`${styles.actionBtn} ${styles.messageBtn}`} onClick={handleMessage} disabled={isSendingMessage}>
                                {isSendingMessage ? <FaSpinner className={styles.spinner} /> : <FaComment />} {safeTranslate(t, 'common.message', 'Message')}
                            </button>
                        </>
                    )}
                    <div className={styles.moreActions}>
                        <button className={styles.toggleBtn} onClick={() => setShowActions(!showActions)} aria-label="More actions"><FaEllipsisH /></button>
                        {showActions && (
                            <div className={styles.dropdown}>
                                <button className={styles.dropdownItem} onClick={handleReport}><FaFlag /> {safeTranslate(t, 'profile.reportUser', 'Report User')}</button>
                                {!isOwnProfile && <button className={styles.dropdownItem} onClick={handleBlock}><FaBan /> {safeTranslate(t, 'profile.blockUser', 'Block User')}</button>}
                            </div>
                        )}
                    </div>
                </div>
              </div>

              {/* Right: Details Section (Copy from Modal) */}
              <div className={styles.detailsSection}>
                {/* User headline */}
                <div className={styles.headline}>
                  <h1 className={styles.headlineTitle}>{profileUser.nickname}, {profileUser.details?.age || "?"}</h1>
                   {profileUser.accountTier && profileUser.accountTier !== 'FREE' && (
                      <div className={styles.premiumBadge}><FaTrophy /> {capitalize(t(`tiers.${profileUser.accountTier.toLowerCase()}`, profileUser.accountTier))}</div>
                  )}
                </div>
                 {/* Location */}
                <div className={styles.location}>
                  <FaMapMarkerAlt className={styles.icon} />
                  <span>{profileUser.details?.location || safeTranslate(t, 'profile.unknownLocation', 'Unknown location')}</span>
                  <div className={`${styles.onlineStatus} ${profileUser.isOnline ? styles.isOnline : ""}`}>{profileUser.isOnline ? safeTranslate(t, 'common.onlineNow', 'Online Now') : safeTranslate(t, 'common.offline', 'Offline')}</div>
                </div>
                 {/* Activity */}
                <div className={styles.activity}>
                  {/* ... (render last active and member since as in modal, using formatDate and t) ... */}
                   <div className={styles.activityItem}><FaRegClock className={styles.icon} /><span>{profileUser.isOnline ? safeTranslate(t, 'common.activeNow', 'Active now') : safeTranslate(t, 'profile.lastActive', 'Last active: {{date}}', { date: profileUser.lastActive ? formatDate(profileUser.lastActive, { showRelative: true, locale: language }) : 'N/A' })}</span></div>
                   <div className={styles.activityItem}><FaCalendarAlt className={styles.icon} /><span>{safeTranslate(t, 'profile.memberSince', 'Member since: {{date}}', { date: profileUser.createdAt ? formatDate(profileUser.createdAt, { dateOnly: true, locale: language }) : 'N/A' })}</span></div>
                </div>
                 {/* Compatibility */}
                {!isOwnProfile && (
                  <div className={styles.compatibilitySection}>
                      <h2 className={styles.sectionTitle}>{t('profile.compatibility', 'Compatibility')}</h2>
                      {/* ... (render compatibility score circle and details as in modal) ... */}
                       <div className={styles.compatibilityScore}>
                           <div className={styles.scoreCircle}><svg viewBox="0 0 100 100"><defs><linearGradient id="compatibility-gradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#ff3366" /><stop offset="100%" stopColor="#ff6b98" /></linearGradient></defs><circle className={styles.scoreBg} cx="50" cy="50" r="45" /><circle className={styles.scoreFill} cx="50" cy="50" r="45" strokeDasharray="283" strokeDashoffset={283 - (283 * compatibility) / 100}/></svg><div className={styles.scoreValue}>{compatibility}%</div></div>
                           {/* ... details bars ... */}
                       </div>
                  </div>
                )}
                 {/* Details Sections (About, I Am, Marital Status, Looking For, Into, Turn Ons, Interests) */}
                 {/* Copy the rendering logic for each section from the modal, using styles.* and t() or getTranslatedTag */}
                {profileUser.details?.bio && <div className={styles.section}><h2 className={styles.sectionTitle}>{t('profile.aboutMe', 'About Me')}</h2><p className={styles.aboutText}>{profileUser.details.bio}</p></div>}
                {profileUser.details?.iAm && <div className={styles.section}><h2 className={styles.sectionTitle}>{t('profile.iAm', 'I am')}</h2><div className={styles.tagsContainer}><span className={`${styles.tag} ${styles.identityTag}`}>{getTranslatedTag('profile.identity', profileUser.details.iAm)}</span></div></div>}
                {profileUser.details?.maritalStatus && <div className={styles.section}><h2 className={styles.sectionTitle}>{t('profile.maritalStatusLabel', 'Marital Status')}</h2><div className={styles.tagsContainer}><span className={`${styles.tag} ${styles.statusTag}`}>{getTranslatedTag('profile.maritalStatus', profileUser.details.maritalStatus)}</span></div></div>}
                {profileUser.details?.lookingFor?.length > 0 && <div className={styles.section}><h2 className={styles.sectionTitle}>{t('profile.lookingForLabel', 'Looking For')}</h2><div className={styles.tagsContainer}>{profileUser.details.lookingFor.map((item, index) => <span key={index} className={`${styles.tag} ${styles.lookingForTag}`}>{getTranslatedTag('profile.lookingFor', item)}</span>)}</div></div>}
                {profileUser.details?.intoTags?.length > 0 && <div className={styles.section}><h2 className={styles.sectionTitle}>{t('profile.imIntoLabel', "I'm Into")}</h2><div className={styles.tagsContainer}>{profileUser.details.intoTags.map((item, index) => <span key={index} className={`${styles.tag} ${styles.intoTag}`}>{getTranslatedTag('profile.intoTags', item)}</span>)}</div></div>}
                {profileUser.details?.turnOns?.length > 0 && <div className={styles.section}><h2 className={styles.sectionTitle}>{t('profile.turnOnsLabel', 'Turn Ons')}</h2><div className={styles.tagsContainer}>{profileUser.details.turnOns.map((item, index) => <span key={index} className={`${styles.tag} ${styles.turnOnTag}`}>{getTranslatedTag('profile.turnOns', item)}</span>)}</div></div>}
                {profileUser.details?.interests?.length > 0 && (
                    <div className={styles.section}>
                        <h2 className={styles.sectionTitle}>{t('profile.interests', 'Interests')}</h2>
                        <div className={styles.interestsTags}>
                            {(showAllInterests ? profileUser.details.interests : profileUser.details.interests.slice(0, 8)).map((interest) => (
                                <span key={interest} className={`${styles.interestTag} ${commonInterests.includes(interest) ? styles.commonTag : ""}`}>
                                    {getTranslatedTag('profile.interests', interest)} {commonInterests.includes(interest) && <FaCheck className={styles.commonIcon} />}
                                </span>
                            ))}
                            {!showAllInterests && profileUser.details.interests.length > 8 && (
                                <button className={styles.showMoreBtn} onClick={() => setShowAllInterests(true)}>+{profileUser.details.interests.length - 8} {safeTranslate(t, 'common.more', 'more')}</button>
                            )}
                        </div>
                    </div>
                )}
              </div>
            </div>
          </div>

          {/* Render StoriesViewer conditionally (same as modal) */}
          {showStories && profileUser && <StoriesViewer userId={profileUser._id} onClose={handleCloseStories} />}

       </div>
    </div>
  );
};

export default UserProfilePage; // Renamed component for clarity
