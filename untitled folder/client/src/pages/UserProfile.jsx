// client/src/pages/UserProfile.jsx
"use client";

// Add useMemo to the import list
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  FaArrowLeft,
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
  FaTimes,
  FaEye,
} from "react-icons/fa";
import { useParams, useNavigate } from "react-router-dom";
import { useUser, useChat, useAuth, useStories } from "../context";
import { EmbeddedChat, Navbar } from "../components"; // Import Navbar if needed
import StoriesViewer from "../components/Stories/StoriesViewer";
import StoryThumbnail from "../components/Stories/StoryThumbnail";
import { toast } from "react-toastify";
import { permissionClient, apiService } from "../services"; // Import permissionClient and apiService
// Ensure you have a separate CSS file for UserProfile page styles if needed
// import "../styles/UserProfile.css"; // Example

// Simple local Spinner component
const Spinner = () => (
  <div className="spinner">
    <FaSpinner className="spinner-icon" size={32} />
  </div>
);

// Helper function to normalize photo URLs
const normalizePhotoUrl = (url) => {
  if (!url) return "/placeholder.svg";
  if (url.startsWith("http")) return url;
  if (url.includes("/images/") || url.includes("/photos/")) {
     return url.startsWith("/uploads") ? url : `/uploads${url.startsWith("/") ? "" : "/"}${url}`;
  }
   if (url.startsWith("/uploads/")) {
       return url;
   }
   return `/uploads/images/${url.split('/').pop()}`;
};

const UserProfile = () => {
  const { id } = useParams(); // User ID from URL
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const {
    // Use context methods, but fetch profile data locally using apiService for this specific page view
    loading: userContextLoading, // Context loading might be different
    likeUser,
    unlikeUser,
    isUserLiked,
    error: userContextError, // Context error
    blockUser,
    reportUser,
  } = useUser() || {};

  const { initiateChat } = useChat() || {};
  const { loadUserStories, hasUnviewedStories } = useStories() || {};

  // Local state for the viewed profile
  const [profileUser, setProfileUser] = useState(null);
  const [loading, setLoading] = useState(true); // Page's loading state
  const [error, setError] = useState(null); // Page's error state

  const [userStories, setUserStories] = useState([]);
  const [showChat, setShowChat] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [showActions, setShowActions] = useState(false);
  const [showAllInterests, setShowAllInterests] = useState(false);
  const [showStories, setShowStories] = useState(false);
  const [loadingPermissions, setLoadingPermissions] = useState({});
  const [permissionStatus, setPermissionStatus] = useState({}); // Local permission state
  const [photoLoadError, setPhotoLoadError] = useState({});
  const [isLiking, setIsLiking] = useState(false);
  const [isChatInitiating, setIsChatInitiating] = useState(false);
  const profileRef = useRef(null);
  const [isRequestingAll, setIsRequestingAll] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]); // For owner's view
  const [isLoadingRequests, setIsLoadingRequests] = useState(false); // For owner's view
  const [isProcessingApproval, setIsProcessingApproval] = useState(false); // For owner's view

  const isOwnProfile = currentUser && profileUser && currentUser._id === profileUser._id;

  // Mounted ref
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // --- Fetch Initial User Data and Permissions ---
  const fetchInitialData = useCallback(async () => {
    if (!id) {
       setError("No user ID provided in URL.");
       setLoading(false);
       return;
    };

    setLoading(true); setError(null); setProfileUser(null); setPermissionStatus({});
    console.log(`UserProfile page fetching data for user: ${id}`);

    try {
      // 1. Fetch User Profile via apiService
      const userResult = await apiService.get(`/users/${id}`);
      if (!userResult.success || !userResult.data?.user) throw new Error(userResult.error || 'User not found');
      if (!isMountedRef.current) return;
      setProfileUser(userResult.data.user);

      // 2. Fetch Initial Photo Permissions (if not own profile)
      if (currentUser && currentUser._id !== id) {
        try {
          const permResponse = await apiService.get(`/users/${id}/photo-permissions`);
          if (permResponse.success && isMountedRef.current) {
             const statusMap = {};
             (permResponse.data || []).forEach(p => { statusMap[p.photo] = p.status; });
             setPermissionStatus(statusMap);
          }
        } catch (permError) { console.error("Error fetching initial permissions:", permError); }
      }

      // 3. Fetch User Stories
      if (loadUserStories) {
        try {
          const stories = await loadUserStories(id);
          if (isMountedRef.current && Array.isArray(stories)) setUserStories(stories);
        } catch (storyError) { console.error("Error loading stories:", storyError); }
      }

      // 4. Fetch Pending Requests (if viewing own profile)
      if (currentUser && currentUser._id === id) fetchPendingRequests();

    } catch (err) {
      console.error(`Error fetching initial data for user ${id}:`, err);
      if (isMountedRef.current) setError(err.message || 'Failed to load profile');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [id, currentUser, loadUserStories]); // Removed getUser dependency

  // Trigger fetch on mount or ID change
  useEffect(() => {
    fetchInitialData();
    // Reset state on ID change
    setActivePhotoIndex(0);
    setShowAllInterests(false);
    setShowActions(false);
    setPhotoLoadError({});
    setPendingRequests([]);
    setShowChat(false);
    setShowStories(false);
  }, [id, fetchInitialData]);

  // Fetch pending requests (for owner's view)
  const fetchPendingRequests = useCallback(async () => {
    if (!currentUser || !isOwnProfile) return;
    setIsLoadingRequests(true);
    try {
      const response = await apiService.get("/users/photos/permissions?status=pending");
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
    } catch (error) { toast.error("Failed to load photo access requests"); }
    finally { if (isMountedRef.current) setIsLoadingRequests(false); }
  }, [currentUser, isOwnProfile]);


  // --- Socket-based Actions ---
  const handleRequestAccess = async (photoId, e) => {
    if (e) e.stopPropagation();
    if (!profileUser || !photoId || !currentUser || isOwnProfile) return;
    setLoadingPermissions(prev => ({ ...prev, [photoId]: true }));
    try {
      const res = await permissionClient.requestPhotoPermission(profileUser._id, photoId);
       if (isMountedRef.current) {
           if (res.success) {
               setPermissionStatus(prev => ({ ...prev, [photoId]: res.status || 'pending' }));
               toast.info(res.message || "Request sent/pending.");
           } else toast.error(res.error || "Failed request.");
       }
    } catch (err) {
       if (isMountedRef.current) {
           if (err.message?.includes("already")) {
               setPermissionStatus(prev => ({ ...prev, [photoId]: 'pending' }));
               toast.info("Request already sent.");
           } else toast.error(err.message || "Failed request.");
       }
    } finally { if (isMountedRef.current) setLoadingPermissions(prev => ({ ...prev, [photoId]: false })); }
  };

  const handleRequestAccessToAllPhotos = async () => {
     if (!profileUser?.photos || !currentUser || isOwnProfile) return;
     const toRequest = profileUser.photos.filter(p => p.isPrivate && permissionStatus[p._id] !== 'approved' && permissionStatus[p._id] !== 'pending');
     if (toRequest.length === 0) { toast.info("No new requests needed."); return; }
     setIsRequestingAll(true);
     let success = 0, pending = 0, errors = 0;
     const results = await Promise.allSettled(toRequest.map(p => permissionClient.requestPhotoPermission(profileUser._id, p._id)));
     results.forEach((result, index) => {
         const photo = toRequest[index];
         if (result.status === 'fulfilled') {
             if (result.value.success) {
                 if (isMountedRef.current) setPermissionStatus(prev => ({ ...prev, [photo._id]: 'pending' }));
                 if (result.value.message?.includes("already")) pending++; else success++;
             } else errors++;
         } else errors++;
     });
     if (isMountedRef.current) {
         if (success > 0) toast.success(`Requested ${success} photo(s).` + (pending > 0 ? ` ${pending} pending.` : ''));
         else if (pending > 0) toast.info(`Requests pending/sent for ${pending} photos.`);
         if (errors > 0) toast.error(`Failed for ${errors} photo(s).`);
        setIsRequestingAll(false);
     }
   };

   const handleApprovalAction = async (targetUserId, requests, status) => {
       if (!isOwnProfile || !requests?.length) return;
       setIsProcessingApproval(true);
       try {
           let count = 0;
           await Promise.allSettled(requests.map(req => permissionClient.respondToPhotoPermission(req._id, status)))
               .then(results => results.forEach(r => { if (r.status === 'fulfilled' && r.value.success) count++; }));
           if (count > 0) toast.success(`Successfully ${status} ${count} request(s).`);
           else if (requests.length > 0) toast.error(`Failed to ${status} requests.`);
           fetchPendingRequests();
       } catch (error) { toast.error(`Server error processing ${status}.`); }
       finally { if (isMountedRef.current) setIsProcessingApproval(false); }
   };
   const handleApproveAllRequests = (targetUserId, requests) => handleApprovalAction(targetUserId, requests, 'approved');
   const handleRejectAllRequests = (targetUserId, requests) => handleApprovalAction(targetUserId, requests, 'rejected');


  // --- Other Handlers ---
   const handleImageError = useCallback((photoId) => {
      if (isMountedRef.current) setPhotoLoadError(prev => ({ ...prev, [photoId]: true }));
   }, []);
   const handleLike = async () => {
       if (!profileUser || isLiking || !likeUser || !unlikeUser || !isUserLiked) return;
       setIsLiking(true);
       try { await (isUserLiked(profileUser._id) ? unlikeUser : likeUser)(profileUser._id, profileUser.nickname); }
       catch (err) { toast.error(err.message || "Like failed."); }
       finally { if (isMountedRef.current) setIsLiking(false); }
   };
   const handleBlock = async () => {
       if (!profileUser || !blockUser) return;
       if (window.confirm(`Block ${profileUser.nickname}?`)) {
         try { await blockUser(profileUser._id); toast.info(`${profileUser.nickname} blocked.`); navigate('/dashboard'); } // Navigate away after blocking
         catch (err) { toast.error(err.message || "Block failed."); }
       }
   };
   const handleReport = async () => {
      if (!profileUser || !reportUser) return;
      const reason = prompt(`Reason for reporting ${profileUser.nickname}:`);
      if (reason?.trim()) {
         try { await reportUser(profileUser._id, reason); toast.success(`${profileUser.nickname} reported.`); navigate('/dashboard'); } // Navigate away
         catch (err) { toast.error(err.message || "Report failed."); }
      } else if (reason !== null) { toast.warning("Reason required."); }
   };
   const handleMessage = async () => {
       if (!profileUser || !initiateChat) return;
       setIsChatInitiating(true);
       try { await initiateChat(profileUser); navigate('/messages'); } // Navigate to messages page
       catch (err) { toast.error(err.message || "Chat start failed."); }
       finally { if (isMountedRef.current) setIsChatInitiating(false); }
   };
   const handleViewStories = () => { if (userStories?.length > 0) setShowStories(true); };
   const handleCloseStories = () => setShowStories(false);
   const nextPhoto = () => { if (profileUser?.photos?.length > activePhotoIndex + 1) setActivePhotoIndex(i => i + 1); };
   const prevPhoto = () => { if (activePhotoIndex > 0) setActivePhotoIndex(i => i - 1); };

  // --- Listener for Real-time Permission Updates ---
   useEffect(() => {
        const handlePermissionUpdate = (event) => {
          const { photoId, status } = event.detail;
          if (profileUser?.photos?.some(p => p._id === photoId)) {
             if (isMountedRef.current) setPermissionStatus(prev => ({ ...prev, [photoId]: status }));
          }
        };
        window.addEventListener('permissionStatusUpdated', handlePermissionUpdate);
        return () => window.removeEventListener('permissionStatusUpdated', handlePermissionUpdate);
      }, [profileUser]);


  // Calculate compatibility & common interests using useMemo
  const compatibility = useMemo(() => {
    if (!profileUser?.details || !currentUser?.details) return 0;
    let score = 0;
    if (profileUser.details.location?.toLowerCase() === currentUser.details.location?.toLowerCase()) score += 25;
    const ageDiff = Math.abs((profileUser.details.age || 0) - (currentUser.details.age || 0));
    if (ageDiff <= 5) score += 25; else if (ageDiff <= 10) score += 15; else score += 5;
    const commonCount = (profileUser.details.interests || []).filter(i => (currentUser.details.interests || []).includes(i)).length;
    score += Math.min(45, commonCount * 10);
    return Math.min(100, Math.max(0, score));
  }, [profileUser, currentUser]);

  const commonInterests = useMemo(() => {
     if (!profileUser?.details?.interests || !currentUser?.details?.interests) return [];
     return profileUser.details.interests.filter(interest => currentUser.details.interests.includes(interest));
   }, [profileUser, currentUser]);

   // --- Render Logic ---
   if (loading || userContextLoading) return <div className="loading-container"><Spinner /><p>Loading...</p></div>;
   if (error || userContextError) return <div className="error-container"><h3>Error</h3><p>{error || userContextError}</p><button onClick={() => navigate('/dashboard')}>Back</button></div>;
   if (!profileUser) return <div className="not-found-container"><h3>Not Found</h3><p>User not found.</p><button onClick={() => navigate('/dashboard')}>Back</button></div>;

  const capitalize = (str = "") => str.charAt(0).toUpperCase() + str.slice(1);

  // --- Main JSX ---
  return (
    <div className="modern-user-profile" ref={profileRef}>
       <Navbar /> {/* Include Navbar if this is a top-level page */}
       <div className="container profile-content">
         <button className="back-button" onClick={() => navigate(-1)}> {/* More robust back navigation */}
           <FaArrowLeft /> Back
         </button>

         {/* Owner's Pending Requests */}
          {isOwnProfile && pendingRequests.length > 0 && (
            <div className="pending-requests-section">
              <h2>Photo Access Requests</h2>
              <div className="requests-list">
                {pendingRequests.map((item) => (
                  <div key={item.user._id} className="request-item">
                    <div className="request-user-info">
                      <div className="request-user-photo">
                        {item.user.photos?.[0]?.url ? <img src={normalizePhotoUrl(item.user.photos[0].url)} alt={item.user.nickname} onError={(e)=>{e.target.src='/placeholder.svg'}}/> : <FaUserAlt />}
                      </div>
                      <div className="request-user-details">
                        <h4>{item.user.nickname}</h4>
                        <p>Requests: {item.requests.length}</p>
                      </div>
                    </div>
                    <div className="request-actions">
                      <button className="btn btn-sm btn-success" onClick={() => handleApproveAllRequests(item.user._id, item.requests)} disabled={isProcessingApproval}><FaCheck /> Approve</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleRejectAllRequests(item.user._id, item.requests)} disabled={isProcessingApproval}><FaTimes /> Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

         <div className="profile-layout">
           {/* Photos Section */}
           <div className="profile-photos-section">
             {/* Story Thumbnail */}
             {userStories?.length > 0 && hasUnviewedStories?.(profileUser._id) && (
               <div className="profile-stories">
                 <StoryThumbnail user={profileUser} hasUnviewedStories={true} onClick={handleViewStories} />
               </div>
             )}
             {/* Photo Gallery */}
              {profileUser.photos?.length > 0 ? (
                 <div className="photo-gallery-container">
                   <div className="gallery-photo">
                      {/* Private Photo Placeholder */}
                      {profileUser.photos[activePhotoIndex]?.isPrivate && permissionStatus[profileUser.photos[activePhotoIndex]._id] !== 'approved' && !isOwnProfile ? (
                         <div className="private-photo-placeholder">
                            <FaLock className="lock-icon" /> <p>Private</p>
                            {permissionStatus[profileUser.photos[activePhotoIndex]._id] === 'pending' && <p className="permission-status pending">Pending</p>}
                            {permissionStatus[profileUser.photos[activePhotoIndex]._id] === 'rejected' && <p className="permission-status rejected">Denied</p>}
                            {!permissionStatus[profileUser.photos[activePhotoIndex]._id] && (
                               <button className="request-access-btn" onClick={(e) => handleRequestAccess(profileUser.photos[activePhotoIndex]._id, e)} disabled={loadingPermissions[profileUser.photos[activePhotoIndex]._id] || isRequestingAll}>
                                  {loadingPermissions[profileUser.photos[activePhotoIndex]._id] ? <FaSpinner className="spinner-icon" /> : "Request"}
                               </button>
                            )}
                         </div>
                       ) : ( /* Actual Image */
                         profileUser.photos[activePhotoIndex] && <img src={normalizePhotoUrl(profileUser.photos[activePhotoIndex].url)} alt={profileUser.nickname} onError={() => handleImageError(profileUser.photos[activePhotoIndex]._id)} style={{ display: photoLoadError[profileUser.photos[activePhotoIndex]?._id] ? "none" : "block" }} />
                       )}
                       {/* Error Placeholder */}
                       {profileUser.photos[activePhotoIndex] && photoLoadError[profileUser.photos[activePhotoIndex]?._id] && <div className="image-error-placeholder"><FaCamera size={48}/><p>Error</p></div>}
                       {/* Online Badge */}
                       {profileUser.isOnline && <div className="online-badge"><span className="pulse"></span>Online</div>}
                       {/* Nav Arrows */}
                       {profileUser.photos.length > 1 && (<> <button className="gallery-nav prev" onClick={prevPhoto} disabled={activePhotoIndex === 0}><FaChevronLeft /></button> <button className="gallery-nav next" onClick={nextPhoto} disabled={activePhotoIndex === profileUser.photos.length - 1}><FaChevronRight /></button> </>)}
                   </div>
                   {/* Thumbnails */}
                   {profileUser.photos.length > 1 && (
                      <div className="photo-thumbnails">
                         {profileUser.photos.map((photo, index) => (
                            <div key={photo._id} className={`photo-thumbnail ${index === activePhotoIndex ? "active" : ""}`} onClick={() => setActivePhotoIndex(index)}>
                               {photo.isPrivate && permissionStatus[photo._id] !== 'approved' && !isOwnProfile ? (
                                  <div className="private-thumbnail"><FaLock />{permissionStatus[photo._id] && <div className={`permission-status ${permissionStatus[photo._id]}`}></div>}</div>
                               ) : (
                                  <img src={normalizePhotoUrl(photo.url)} alt={`${index+1}`} onError={() => handleImageError(photo._id)} style={{ display: photoLoadError[photo._id] ? "none" : "block" }}/>
                               )}
                               {photoLoadError[photo._id] && <div className="thumbnail-error"><FaUserAlt /></div>}
                            </div>
                         ))}
                      </div>
                   )}
                 </div>
              ) : ( <div className="no-photo-placeholder"><FaUserAlt size={64} /><p>No photos</p></div> )}

             {/* Actions */}
              <div className="profile-actions">
                {!isOwnProfile && (
                   <>
                     <button className={`btn profile-action-btn ${isUserLiked?.(profileUser._id) ? "liked" : ""}`} onClick={handleLike} disabled={isLiking}><FaHeart /> <span>{isUserLiked?.(profileUser._id) ? "Liked" : "Like"}</span></button>
                     <button className="btn btn-primary profile-action-btn" onClick={handleMessage} disabled={isChatInitiating}><FaComment /> <span>Message</span></button>
                     {profileUser.photos?.some(p => p.isPrivate && permissionStatus[p._id] !== 'approved') && (
                       <button className="btn btn-secondary profile-action-btn" onClick={handleRequestAccessToAllPhotos} disabled={isRequestingAll}><FaEye /> <span>Request Photos</span></button>
                     )}
                   </>
                )}
                 <div className="more-actions-dropdown">
                   <button className="btn btn-subtle profile-action-btn" onClick={() => setShowActions(s => !s)}><FaEllipsisH /></button>
                   {showActions && (
                      <div className="actions-dropdown">
                         <button className="dropdown-item" onClick={handleReport}><FaFlag /> Report</button>
                         {!isOwnProfile && <button className="dropdown-item" onClick={handleBlock}><FaBan /> Block</button>}
                      </div>
                    )}
                 </div>
              </div>
           </div>

           {/* Details Section */}
           <div className="profile-details-section">
              <div className="user-headline"><h1>{profileUser.nickname}, {profileUser.details?.age || "?"}</h1>{profileUser.accountTier !== 'FREE' && <div className={`premium-badge tier-${profileUser.accountTier?.toLowerCase()}`}><FaTrophy /> {capitalize(profileUser.accountTier)}</div>}</div>
              <div className="user-location"><FaMapMarkerAlt /><span>{profileUser.details?.location || "N/A"}</span><div className={`online-status ${profileUser.isOnline ? "online" : ""}`}>{profileUser.isOnline ? "Online" : "Offline"}</div></div>
              <div className="user-activity"><div className="activity-item"><FaRegClock /><span>Last active {profileUser.lastActive ? new Date(profileUser.lastActive).toLocaleDateString() : 'N/A'}</span></div><div className="activity-item"><FaCalendarAlt /><span>Member since {profileUser.createdAt ? new Date(profileUser.createdAt).toLocaleDateString() : 'N/A'}</span></div></div>
              {!isOwnProfile && currentUser && <div className="compatibility-section"><h2>Compatibility</h2><div className="compatibility-score">{/* Score */}</div></div>}
              {profileUser.details?.bio && <div className="profile-section"><h2>About</h2><p className="about-text">{profileUser.details.bio}</p></div>}
              {profileUser.details?.iAm && <div className="profile-section"><h2>I am a</h2><p>{capitalize(profileUser.details.iAm)}</p></div>}
              {profileUser.details?.maritalStatus && <div className="profile-section"><h2>Status</h2><p>{profileUser.details.maritalStatus}</p></div>}
              {profileUser.details?.lookingFor?.length > 0 && <div className="profile-section"><h2>Looking For</h2><div className="tags-container">{profileUser.details.lookingFor.map(t=><span key={t} className="tag looking-for-tag">{t}</span>)}</div></div>}
              {profileUser.details?.intoTags?.length > 0 && <div className="profile-section"><h2>Into</h2><div className="tags-container">{profileUser.details.intoTags.map(t=><span key={t} className="tag into-tag">{t}</span>)}</div></div>}
              {profileUser.details?.turnOns?.length > 0 && <div className="profile-section"><h2>Turns Me On</h2><div className="tags-container">{profileUser.details.turnOns.map(t=><span key={t} className="tag turn-on-tag">{t}</span>)}</div></div>}
              {profileUser.details?.interests?.length > 0 && (
                 <div className="profile-section">
                    <h2>Interests</h2>
                    <div className="interests-tags">
                       {(showAllInterests ? profileUser.details.interests : profileUser.details.interests.slice(0, 8)).map(interest => (
                          <span key={interest} className={`interest-tag ${commonInterests.includes(interest) ? "common" : ""}`}>
                             {interest} {commonInterests.includes(interest) && <FaCheck className="common-icon" />}
                          </span>
                       ))}
                       {!showAllInterests && profileUser.details.interests.length > 8 && <button className="show-more-interests" onClick={() => setShowAllInterests(true)}>+{profileUser.details.interests.length - 8} more</button>}
                    </div>
                 </div>
              )}
              {commonInterests.length > 0 && !isOwnProfile && <div className="profile-section"><h2>Common Interests</h2><div className="common-interests">{commonInterests.map(i => <div key={i} className="common-interest-item"><FaCheck /><span>{i}</span></div>)}</div></div>}
           </div>
         </div>

         {/* Modals */}
         {showChat && !isOwnProfile && <EmbeddedChat recipient={profileUser} isOpen={showChat} onClose={() => setShowChat(false)} />}
         {showStories && profileUser && <StoriesViewer userId={profileUser._id} onClose={handleCloseStories} />}

       </div>
    </div>
  );
};

export default UserProfile;
