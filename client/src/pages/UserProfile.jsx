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
import { useUser, useAuth, useStories } from "../context";
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

  const { initiateChat } = useChatContext() || {};
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
      // 1. Use BatchTool to fetch user profile and permissions in parallel
      const requests = [];
      
      // Add user profile request
      requests.push({ 
        url: `/users/${id}`,
        type: 'user-profile'
      });
      
      // Add permissions request if not own profile
      if (currentUser && currentUser._id !== id) {
        requests.push({ 
          url: `/users/${id}/photo-permissions`,
          type: 'permissions'
        });
      }
      
      // Execute all requests in a single batch with a cache buster to avoid duplicate requests
      const timestamp = Date.now();
      const results = await Promise.all(
        requests.map(req => 
          apiService.get(req.url, { _t: timestamp, _req: Math.random().toString(36).substring(2, 10) })
        )
      );
      
      if (!isMountedRef.current) return;
      
      // Process user profile result
      const userResult = results[0];
      if (!userResult.success || !userResult.data?.user) throw new Error(userResult.error || 'User not found');
      setProfileUser(userResult.data.user);
      
      // Process permissions result if available
      if (results.length > 1 && results[1].success) {
        const permResponse = results[1];
        const statusMap = {};
        (permResponse.data || []).forEach(p => { statusMap[p.photo] = p.status; });
        setPermissionStatus(statusMap);
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
   if (loading || userContextLoading) {
     return (
       <div className="min-vh-100 d-flex flex-column align-items-center justify-content-center p-5 text-center bg-light-subtle">
         <div className="bg-white rounded-lg shadow-lg p-5 max-w-md animate-pulse">
           <FaSpinner className="text-5xl text-primary mb-4 animate-spin" />
           <h3 className="font-weight-bold text-xl mb-3">Loading Profile</h3>
           <p className="text-opacity-70 mb-0">Please wait while we load this user's profile...</p>
         </div>
       </div>
     );
   }
   
   if (error || userContextError) {
     return (
       <div className="min-vh-100 d-flex flex-column align-items-center justify-content-center p-5 text-center bg-light-subtle">
         <div className="bg-white rounded-lg shadow-lg p-5 max-w-md border-danger">
           <FaExclamationTriangle className="text-5xl text-danger mb-4" />
           <h3 className="font-weight-bold text-xl mb-3">Error Loading Profile</h3>
           <p className="text-opacity-70 mb-4">{error || userContextError || "An unexpected error occurred while loading this profile."}</p>
           <button 
             onClick={() => navigate('/dashboard')}
             className="btn btn-primary rounded-pill d-inline-flex align-items-center gap-2 px-4 py-2 shadow-sm hover-scale transition-all"
           >
             <FaArrowLeft /> <span>Go to Dashboard</span>
           </button>
         </div>
       </div>
     );
   }
   
   if (!profileUser) {
     return (
       <div className="min-vh-100 d-flex flex-column align-items-center justify-content-center p-5 text-center bg-light-subtle">
         <div className="bg-white rounded-lg shadow-lg p-5 max-w-md">
           <FaUserAlt className="text-5xl text-opacity-50 mb-4" />
           <h3 className="font-weight-bold text-xl mb-3">User Not Found</h3>
           <p className="text-opacity-70 mb-4">We couldn't find the user you're looking for. They may have deactivated their account or the URL might be incorrect.</p>
           <button 
             onClick={() => navigate('/dashboard')}
             className="btn btn-primary rounded-pill d-inline-flex align-items-center gap-2 px-4 py-2 shadow-sm hover-scale transition-all"
           >
             <FaArrowLeft /> <span>Go to Dashboard</span>
           </button>
         </div>
       </div>
     );
   }

  const capitalize = (str = "") => str.charAt(0).toUpperCase() + str.slice(1);

  // --- Main JSX ---
  return (
    <div className="min-vh-100 bg-light-subtle" ref={profileRef}>
       <Navbar /> {/* Include Navbar if this is a top-level page */}
       <div className="container max-w-xl py-4 px-3">
         <button 
           className="btn btn-outline-secondary rounded-pill d-inline-flex align-items-center gap-2 mb-4 shadow-sm hover-scale transition-all"
           onClick={() => navigate(-1)}
         > 
           <FaArrowLeft /> <span>Back</span>
         </button>

         {/* Owner's Pending Requests */}
          {isOwnProfile && pendingRequests.length > 0 && (
            <div className="bg-warning-50 border border-warning-200 rounded-lg p-4 mb-4 shadow-sm animate-fade-in">
              <h2 className="font-weight-bold text-xl mb-3 d-flex align-items-center gap-2 text-warning-700">
                <FaEye /> Photo Access Requests
              </h2>
              <div className="d-flex flex-column gap-3">
                {pendingRequests.map((item) => (
                  <div key={item.user._id} className="d-flex justify-content-between align-items-center bg-white p-3 rounded-lg shadow-sm hover-shadow-md transition-all">
                    <div className="d-flex align-items-center gap-3">
                      <div className="w-50px h-50px rounded-circle overflow-hidden bg-light flex-shrink-0 d-flex align-items-center justify-content-center">
                        {item.user.photos?.[0]?.url ? 
                          <img 
                            src={normalizePhotoUrl(item.user.photos[0].url)} 
                            alt={item.user.nickname} 
                            className="w-100 h-100 object-cover"
                            onError={(e)=>{e.target.src='/placeholder.svg'}}
                          /> : 
                          <FaUserAlt className="text-xl text-opacity-50" />
                        }
                      </div>
                      <div>
                        <h4 className="font-weight-medium mb-1">{item.user.nickname}</h4>
                        <p className="text-sm text-opacity-70 mb-0">Requests: {item.requests.length}</p>
                      </div>
                    </div>
                    <div className="d-flex gap-2">
                      <button 
                        className="btn btn-sm btn-success d-flex align-items-center gap-1 rounded-pill shadow-sm hover-scale transition-all"
                        onClick={() => handleApproveAllRequests(item.user._id, item.requests)} 
                        disabled={isProcessingApproval}
                      >
                        <FaCheck /> <span>Approve</span>
                      </button>
                      <button 
                        className="btn btn-sm btn-danger d-flex align-items-center gap-1 rounded-pill shadow-sm hover-scale transition-all"
                        onClick={() => handleRejectAllRequests(item.user._id, item.requests)} 
                        disabled={isProcessingApproval}
                      >
                        <FaTimes /> <span>Reject</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

         <div className="d-grid grid-cols-1 grid-cols-lg-2 bg-white rounded-lg shadow-lg overflow-hidden">
           {/* Photos Section */}
           <div className="position-relative overflow-hidden bg-gray-100 d-flex flex-column">
             {/* Story Thumbnail */}
             {userStories?.length > 0 && hasUnviewedStories?.(profileUser._id) && (
               <div className="position-absolute top-4 left-4 z-10">
                 <StoryThumbnail user={profileUser} hasUnviewedStories={true} onClick={handleViewStories} />
               </div>
             )}
             {/* Photo Gallery */}
              {profileUser.photos?.length > 0 ? (
                 <div className="flex-grow-1 overflow-hidden position-relative w-100 bg-gradient-to-br">
                   <div className="position-relative w-100 h-100 min-h-480px d-flex align-items-center justify-content-center">
                      {/* Private Photo Placeholder */}
                      {profileUser.photos[activePhotoIndex]?.isPrivate && permissionStatus[profileUser.photos[activePhotoIndex]._id] !== 'approved' && !isOwnProfile ? (
                         <div className="w-100 h-100 d-flex flex-column align-items-center justify-content-center bg-light-subtle text-opacity-70 text-center p-5">
                            <FaLock className="text-4xl mb-4 text-opacity-60" /> 
                            <p className="mb-3 font-weight-medium">Private Photo</p>
                            {permissionStatus[profileUser.photos[activePhotoIndex]._id] === 'pending' && 
                              <p className="bg-warning text-white px-3 py-1 rounded-pill text-sm font-weight-medium">Request Pending</p>
                            }
                            {permissionStatus[profileUser.photos[activePhotoIndex]._id] === 'rejected' && 
                              <p className="bg-danger text-white px-3 py-1 rounded-pill text-sm font-weight-medium">Access Denied</p>
                            }
                            {!permissionStatus[profileUser.photos[activePhotoIndex]._id] && (
                               <button 
                                 className="btn btn-primary rounded-pill px-4 py-2 mt-4 d-inline-flex align-items-center gap-2 shadow-md hover-scale transition-all"
                                 onClick={(e) => handleRequestAccess(profileUser.photos[activePhotoIndex]._id, e)} 
                                 disabled={loadingPermissions[profileUser.photos[activePhotoIndex]._id] || isRequestingAll}
                               >
                                  {loadingPermissions[profileUser.photos[activePhotoIndex]._id] ? 
                                    <FaSpinner className="animate-spin" /> : 
                                    <><FaEye /><span>Request Access</span></>
                                  }
                               </button>
                            )}
                         </div>
                       ) : ( /* Actual Image */
                         profileUser.photos[activePhotoIndex] && 
                         <img 
                           src={normalizePhotoUrl(profileUser.photos[activePhotoIndex].url)} 
                           alt={profileUser.nickname} 
                           className="w-100 h-100 object-cover transition-transform hover-scale"
                           onError={() => handleImageError(profileUser.photos[activePhotoIndex]._id)} 
                           style={{ display: photoLoadError[profileUser.photos[activePhotoIndex]?._id] ? "none" : "block" }} 
                         />
                       )}
                       {/* Error Placeholder */}
                       {profileUser.photos[activePhotoIndex] && photoLoadError[profileUser.photos[activePhotoIndex]?._id] && 
                        <div className="w-100 h-100 d-flex flex-column align-items-center justify-content-center bg-light-subtle">
                          <FaCamera className="text-4xl mb-3 text-opacity-60" />
                          <p className="text-opacity-70">Image could not be loaded</p>
                        </div>
                       }
                       {/* Online Badge */}
                       {profileUser.isOnline && 
                        <div className="position-absolute top-4 right-4 bg-success-gradient text-white px-3 py-1 rounded-pill d-flex align-items-center gap-2 shadow-sm z-5 font-weight-medium text-sm">
                          <span className="d-inline-block w-8px h-8px rounded-circle bg-white position-relative animate-pulse"></span>
                          <span>Online</span>
                        </div>
                       }
                       {/* Nav Arrows */}
                       {profileUser.photos.length > 1 && (
                        <>
                          <button 
                            className="position-absolute top-50 transform-translateY--50 left-4 bg-white-90 text-dark border-0 w-48px h-48px rounded-circle d-flex align-items-center justify-content-center shadow-md z-5 hover-scale transition-all"
                            onClick={prevPhoto} 
                            disabled={activePhotoIndex === 0}
                          >
                            <FaChevronLeft />
                          </button> 
                          <button 
                            className="position-absolute top-50 transform-translateY--50 right-4 bg-white-90 text-dark border-0 w-48px h-48px rounded-circle d-flex align-items-center justify-content-center shadow-md z-5 hover-scale transition-all"
                            onClick={nextPhoto} 
                            disabled={activePhotoIndex === profileUser.photos.length - 1}
                          >
                            <FaChevronRight />
                          </button>
                        </>
                       )}
                   </div>
                   {/* Thumbnails */}
                   {profileUser.photos.length > 1 && (
                      <div className="d-flex p-4 gap-3 justify-content-center position-absolute bottom-0 left-0 right-0 backdrop-blur-md bg-white-80 border-top z-10">
                         {profileUser.photos.map((photo, index) => (
                            <div 
                              key={photo._id} 
                              className={`w-70px h-70px rounded-lg overflow-hidden cursor-pointer shadow-sm transition-all hover-transform-y-n3 ${index === activePhotoIndex ? "border-2 border-primary shadow-md" : "border opacity-70"}`} 
                              onClick={() => setActivePhotoIndex(index)}
                            >
                               {photo.isPrivate && permissionStatus[photo._id] !== 'approved' && !isOwnProfile ? (
                                  <div className="w-100 h-100 d-flex align-items-center justify-content-center bg-light-subtle text-opacity-60 position-relative">
                                    <FaLock />
                                    {permissionStatus[photo._id] && 
                                      <div className={`position-absolute bottom-0 left-0 right-0 p-1 text-xs text-center font-weight-medium text-white 
                                        ${permissionStatus[photo._id] === 'pending' ? 'bg-warning' : 
                                          permissionStatus[photo._id] === 'approved' ? 'bg-success' : 'bg-danger'}`}>
                                      </div>
                                    }
                                  </div>
                               ) : (
                                  <img 
                                    src={normalizePhotoUrl(photo.url)} 
                                    alt={`${index+1}`} 
                                    className="w-100 h-100 object-cover transition-transform hover-scale"
                                    onError={() => handleImageError(photo._id)} 
                                    style={{ display: photoLoadError[photo._id] ? "none" : "block" }}
                                  />
                               )}
                               {photoLoadError[photo._id] && 
                                <div className="w-100 h-100 d-flex align-items-center justify-content-center bg-light-subtle">
                                  <FaUserAlt className="text-opacity-50" />
                                </div>
                               }
                            </div>
                         ))}
                      </div>
                   )}
                 </div>
              ) : (
                <div className="w-100 h-100 min-h-480px d-flex flex-column align-items-center justify-content-center bg-light-subtle p-5">
                  <FaUserAlt className="text-5xl mb-4 text-opacity-50" />
                  <p className="text-opacity-70 font-weight-medium">No photos available</p>
                </div>
              )}

             {/* Actions */}
             <div className="position-absolute bottom-20 left-0 right-0 d-flex gap-3 justify-content-center z-20 px-4">
                {!isOwnProfile && (
                   <>
                     <button 
                       className={`btn rounded-pill d-inline-flex align-items-center gap-2 px-4 py-2 shadow-lg hover-scale transition-all font-weight-medium ${isUserLiked?.(profileUser._id) ? "btn-danger" : "btn-outline-danger"}`} 
                       onClick={handleLike} 
                       disabled={isLiking}
                     >
                       <FaHeart /> <span>{isUserLiked?.(profileUser._id) ? "Liked" : "Like"}</span>
                     </button>
                     <button 
                       className="btn btn-primary rounded-pill d-inline-flex align-items-center gap-2 px-4 py-2 shadow-lg hover-scale transition-all font-weight-medium" 
                       onClick={handleMessage} 
                       disabled={isChatInitiating}
                     >
                       <FaComment /> <span>Message</span>
                     </button>
                     {profileUser.photos?.some(p => p.isPrivate && permissionStatus[p._id] !== 'approved') && (
                       <button 
                         className="btn btn-secondary rounded-pill d-inline-flex align-items-center gap-2 px-4 py-2 shadow-lg hover-scale transition-all font-weight-medium" 
                         onClick={handleRequestAccessToAllPhotos} 
                         disabled={isRequestingAll}
                       >
                         <FaEye /> <span>Request Photos</span>
                       </button>
                     )}
                   </>
                )}
                <div className="position-relative">
                  <button 
                    className="btn btn-light rounded-circle d-flex align-items-center justify-content-center w-46px h-46px shadow-lg hover-scale transition-all" 
                    onClick={() => setShowActions(s => !s)}
                  >
                    <FaEllipsisH />
                  </button>
                  {showActions && (
                    <div className="position-absolute bottom-100 right-0 bg-white rounded-lg shadow-lg z-20 overflow-hidden border animate-fade-in w-200px">
                      <button className="d-flex align-items-center gap-3 w-100 text-left border-0 bg-transparent px-4 py-3 hover-bg-light-subtle transition-all" onClick={handleReport}>
                        <FaFlag className="text-danger" /> <span>Report</span>
                      </button>
                      {!isOwnProfile && 
                       <button className="d-flex align-items-center gap-3 w-100 text-left border-0 bg-transparent px-4 py-3 hover-bg-light-subtle transition-all" onClick={handleBlock}>
                         <FaBan className="text-danger" /> <span>Block</span>
                       </button>
                      }
                    </div>
                  )}
                </div>
             </div>
           </div>

           {/* Details Section */}
           <div className="p-5 overflow-y-auto max-h-80vh border-left">
              {/* User Header */}
              <div className="d-flex justify-content-between align-items-center mb-4 border-bottom pb-3">
                <h1 className="font-weight-bold text-3xl m-0 letter-spacing-n-1">{profileUser.nickname}, {profileUser.details?.age || "?"}</h1>
                {profileUser.accountTier !== 'FREE' && 
                  <div className="gradient-gold text-dark px-3 py-1 rounded-pill d-flex align-items-center gap-2 shadow-sm font-weight-bold text-sm">
                    <FaTrophy /> {capitalize(profileUser.accountTier)}
                  </div>
                }
              </div>
              
              {/* User Info */}
              <div className="d-flex align-items-center gap-3 mb-2 text-opacity-70">
                <FaMapMarkerAlt className="text-primary" />
                <span>{profileUser.details?.location || "N/A"}</span>
                <div className={`px-2 py-1 rounded-pill text-xs font-weight-medium ${profileUser.isOnline ? "bg-success-50 text-success-700" : "bg-gray-200 text-opacity-50"}`}>
                  {profileUser.isOnline ? "Online" : "Offline"}
                </div>
              </div>
              
              <div className="d-flex flex-wrap gap-4 mb-5 text-sm text-opacity-60">
                <div className="d-flex align-items-center gap-2">
                  <FaRegClock className="text-opacity-50" />
                  <span>Last active {profileUser.lastActive ? new Date(profileUser.lastActive).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <FaCalendarAlt className="text-opacity-50" />
                  <span>Member since {profileUser.createdAt ? new Date(profileUser.createdAt).toLocaleDateString() : 'N/A'}</span>
                </div>
              </div>
              
              {/* Compatibility */}
              {!isOwnProfile && currentUser && 
                <div className="bg-light-subtle rounded-lg p-4 mb-5 shadow-sm border">
                  <h2 className="font-weight-bold text-xl mb-3">Compatibility</h2>
                  <div className="text-center">
                    <div className="d-inline-block p-3 rounded-circle bg-primary-gradient text-white font-weight-bold text-2xl w-80px h-80px d-flex align-items-center justify-content-center mb-2 shadow-sm animate-pulse">
                      {compatibility}%
                    </div>
                  </div>
                </div>
              }
              
              {/* About */}
              {profileUser.details?.bio && 
                <div className="mb-5 animate-fade-in">
                  <h2 className="font-weight-bold text-xl mb-3 pb-2 border-bottom">About</h2>
                  <p className="line-height-relaxed text-opacity-80">{profileUser.details.bio}</p>
                </div>
              }
              
              {/* Personal Details */}
              <div className="d-grid grid-cols-1 grid-cols-md-2 gap-4 mb-5">
                {profileUser.details?.iAm && 
                  <div className="bg-white rounded-lg p-3 shadow-sm border">
                    <h3 className="font-weight-medium text-sm text-opacity-60 mb-2">I am a</h3>
                    <p className="m-0 font-weight-medium">{capitalize(profileUser.details.iAm)}</p>
                  </div>
                }
                
                {profileUser.details?.maritalStatus && 
                  <div className="bg-white rounded-lg p-3 shadow-sm border">
                    <h3 className="font-weight-medium text-sm text-opacity-60 mb-2">Status</h3>
                    <p className="m-0 font-weight-medium">{profileUser.details.maritalStatus}</p>
                  </div>
                }
              </div>
              
              {/* Looking For */}
              {profileUser.details?.lookingFor?.length > 0 && 
                <div className="mb-5 animate-fade-in">
                  <h2 className="font-weight-bold text-xl mb-3 pb-2 border-bottom">Looking For</h2>
                  <div className="d-flex flex-wrap gap-2">
                    {profileUser.details.lookingFor.map(t => 
                      <span key={t} className="bg-primary-50 text-primary border border-primary-100 px-3 py-2 rounded-pill text-sm font-weight-medium shadow-sm hover-transform-y-n1 transition-all">
                        {t}
                      </span>
                    )}
                  </div>
                </div>
              }
              
              {/* Into */}
              {profileUser.details?.intoTags?.length > 0 && 
                <div className="mb-5 animate-fade-in">
                  <h2 className="font-weight-bold text-xl mb-3 pb-2 border-bottom">Into</h2>
                  <div className="d-flex flex-wrap gap-2">
                    {profileUser.details.intoTags.map(t => 
                      <span key={t} className="bg-secondary-50 text-secondary border border-secondary-100 px-3 py-2 rounded-pill text-sm font-weight-medium shadow-sm hover-transform-y-n1 transition-all">
                        {t}
                      </span>
                    )}
                  </div>
                </div>
              }
              
              {/* Turn Ons */}
              {profileUser.details?.turnOns?.length > 0 && 
                <div className="mb-5 animate-fade-in">
                  <h2 className="font-weight-bold text-xl mb-3 pb-2 border-bottom">Turns Me On</h2>
                  <div className="d-flex flex-wrap gap-2">
                    {profileUser.details.turnOns.map(t => 
                      <span key={t} className="bg-danger-50 text-danger border border-danger-100 px-3 py-2 rounded-pill text-sm font-weight-medium shadow-sm hover-transform-y-n1 transition-all">
                        {t}
                      </span>
                    )}
                  </div>
                </div>
              }
              
              {/* Interests */}
              {profileUser.details?.interests?.length > 0 && (
                <div className="mb-5 animate-fade-in">
                  <h2 className="font-weight-bold text-xl mb-3 pb-2 border-bottom">Interests</h2>
                  <div className="d-flex flex-wrap gap-2">
                    {(showAllInterests ? profileUser.details.interests : profileUser.details.interests.slice(0, 8)).map(interest => (
                      <span key={interest} className={`px-3 py-2 rounded-pill text-sm font-weight-medium shadow-sm hover-transform-y-n1 transition-all d-inline-flex align-items-center gap-2 ${commonInterests.includes(interest) ? "bg-success-50 text-success-700 border border-success-100" : "bg-light text-opacity-70 border"}`}>
                        {interest} {commonInterests.includes(interest) && <FaCheck className="text-xs" />}
                      </span>
                    ))}
                    {!showAllInterests && profileUser.details.interests.length > 8 && 
                      <button 
                        className="border-0 bg-transparent text-primary text-sm font-weight-medium px-3 py-2 hover-bg-primary-50 rounded-pill transition-all"
                        onClick={() => setShowAllInterests(true)}
                      >
                        +{profileUser.details.interests.length - 8} more
                      </button>
                    }
                  </div>
                </div>
              )}
              
              {/* Common Interests */}
              {commonInterests.length > 0 && !isOwnProfile && 
                <div className="bg-success-50 border border-success-100 rounded-lg p-4 mb-5 shadow-sm">
                  <h2 className="font-weight-bold text-xl mb-3 d-flex align-items-center gap-2 text-success-700">
                    <FaCheck /> Common Interests
                  </h2>
                  <div className="d-flex flex-wrap gap-2">
                    {commonInterests.map(i => 
                      <div key={i} className="bg-white px-3 py-2 rounded-pill d-flex align-items-center gap-2 text-sm shadow-sm">
                        <FaCheck className="text-success text-xs" />
                        <span>{i}</span>
                      </div>
                    )}
                  </div>
                </div>
              }
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
