// client/src/components/UserCard.jsx
"use client";

import { useState, useCallback, useRef, memo } from "react"; // Added memo
import { useNavigate } from "react-router-dom";
import { HeartIcon, ChatBubbleLeftIcon, UserIcon, MapPinIcon } from "@heroicons/react/24/outline"; // Changed MapMarkerAltIcon
import { HeartIcon as HeartIconSolid } from "@heroicons/react/24/solid";
import { normalizePhotoUrl } from "../utils/index.js";

/**
 * UserCard component - receives liked status as a prop.
 */
const UserCard = memo(({ user, isLiked, onLike, viewMode = "grid", onMessage, onClick }) => {
  // Note: Removed internal call to useUser().isUserLiked
  const navigate = useNavigate();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  if (!user) return null;

  // Use a stable ref for the photo URL getter function
  const getProfilePhotoUrlRef = useRef(() => normalizePhotoUrl(user?.photos?.[0]?.url));
  useEffect(() => {
      getProfilePhotoUrlRef.current = () => normalizePhotoUrl(user?.photos?.[0]?.url);
  }, [user?.photos]);
  const getProfilePhotoUrl = getProfilePhotoUrlRef.current;


  const handleCardClick = () => {
    // Use the onClick prop if provided (for modal opening)
    // otherwise navigate to the full profile page
    if (onClick) {
      onClick();
    } else {
      navigate(`/user/${user._id}`);
    }
  };

  // Use the onLike prop passed from Dashboard
  const handleLikeClick = (e) => {
    e.stopPropagation(); // Prevent card click navigation/modal opening
    if (onLike) {
      onLike(user._id, user.nickname); // Call the handler passed from parent
    }
  };

  // Use the onMessage prop passed from Dashboard
  const handleMessageClick = (e) => {
    e.stopPropagation();
    if (onMessage) {
      onMessage(e, user); // Pass event and user if needed by handler in Dashboard
    }
  };

  const handleImageLoad = () => setImageLoaded(true);
  const handleImageError = () => { setImageError(true); setImageLoaded(true); };

  // Helper to format subtitle
  const getSubtitle = () => {
    const parts = [];
    if (user.details?.age) parts.push(`${user.details.age}`);
    if (user.details?.location) parts.push(user.details.location);
    // Removed "I am a..." as it might make the card too busy
    return parts.join(" • ");
  };

  const renderPlaceholder = () => (
     <div className="absolute inset-0 bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
       <UserIcon className="h-12 w-12 text-gray-300 dark:text-gray-500" />
     </div>
  );

  // --- GRID VIEW ---
  if (viewMode === "grid") {
    return (
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 ease-in-out transform hover:-translate-y-1 h-full overflow-hidden border border-gray-200 dark:border-gray-700 flex flex-col cursor-pointer" // Added flex flex-col and cursor
        onClick={handleCardClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        role="link" // Indicate it's interactive like a link
        tabIndex={0} // Make it focusable
        aria-label={`View profile for ${user.nickname || 'User'}`}
      >
        <div className="aspect-w-1 aspect-h-1 relative">
          {!imageLoaded && !imageError && renderPlaceholder()}
          {imageError ? (
             <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-700">
               <UserIcon className="h-16 w-16 text-gray-400 dark:text-gray-500" />
             </div>
          ) : (
            <img
              src={getProfilePhotoUrl() || "/placeholder.svg"}
              alt={`${user.nickname || "User"}'s profile`}
              className={`w-full h-full object-cover transition-all duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              style={{ transform: isHovered ? "scale(1.05)" : "scale(1)" }}
              onLoad={handleImageLoad}
              onError={handleImageError}
              loading="lazy" // Add lazy loading
            />
          )}
          {/* Gradient overlay */}
          <div className={`absolute inset-0 bg-gradient-to-t from-black/60 to-transparent transition-opacity duration-300 ${isHovered ? 'opacity-80' : 'opacity-0'}`} />
          {/* Online indicator */}
          {user.isOnline && ( <div className="absolute top-2 right-2 z-10"><span className="flex h-3 w-3"><span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span></span></div> )}
        </div>

        <div className="p-4 flex flex-col flex-grow"> {/* Added flex-grow */}
          <div className="flex justify-between items-start mb-1">
             <h3 className="font-medium text-gray-900 dark:text-white text-lg truncate">
               {user.nickname || "User"}
               {user.details?.age ? `, ${user.details.age}` : ""}
             </h3>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center mb-2 truncate">
             {user.details?.location && <MapPinIcon className="h-4 w-4 mr-1 inline-block flex-shrink-0" />}
             {getSubtitle()}
          </p>

           {/* Interests (Optional - can make card crowded) */}
           {user.details?.interests?.length > 0 && (
             <div className="mt-1 flex flex-wrap gap-1 mb-3">
               {user.details.interests.slice(0, 2).map((interest) => (
                 <span key={interest} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                   {interest}
                 </span>
               ))}
               {user.details.interests.length > 2 && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-600 dark:bg-gray-700 dark:text-gray-300">+{user.details.interests.length - 2}</span>}
             </div>
           )}

          {/* Action Buttons - Pushed to bottom */}
          <div className="mt-auto flex space-x-2 pt-3"> {/* mt-auto pushes to bottom */}
            <button
              onClick={handleLikeClick}
              className={`flex-1 flex items-center justify-center py-2 px-3 rounded-lg transition-colors duration-200 ${
                isLiked // Use the isLiked prop here
                  ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400"
                  : "bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-red-900/40 dark:hover:text-red-400"
              }`}
              aria-label={isLiked ? "Unlike" : "Like"}
            >
              {isLiked ? <HeartIconSolid className="h-5 w-5" /> : <HeartIcon className="h-5 w-5" />}
            </button>
            <button
              onClick={handleMessageClick}
              className="flex-1 flex items-center justify-center py-2 px-3 rounded-lg bg-gray-100 hover:bg-blue-100 text-gray-500 hover:text-blue-600 transition-colors duration-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-blue-900/40 dark:hover:text-blue-400"
              aria-label="Message"
            >
              <ChatBubbleLeftIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- LIST VIEW ---
  // (Assuming List View structure is similar, just apply the isLiked prop logic)
  return (
     <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden cursor-pointer transition-all duration-300 transform hover:-translate-y-1 flex flex-row" // Use flex-row for list
        onClick={handleCardClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        role="link" tabIndex={0} aria-label={`View profile for ${user.nickname || 'User'}`}
     >
        {/* Image container fixed width */}
        <div className="relative w-32 h-32 flex-shrink-0"> {/* Adjust size as needed */}
            {!imageLoaded && !imageError && renderPlaceholder()}
            {imageError ? (
                <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-700"><UserIcon className="h-10 w-10 text-gray-400 dark:text-gray-500" /></div>
            ) : (
                <img src={getProfilePhotoUrl() || "/placeholder.svg"} alt={`${user.nickname}'s profile`} className={`w-full h-full object-cover transition-opacity duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`} onLoad={handleImageLoad} onError={handleImageError} loading="lazy"/>
            )}
            {user.isOnline && ( <div className="absolute top-1 right-1 z-10"><span className="flex h-2.5 w-2.5"><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span></span></div> )}
        </div>

        <div className="p-3 flex-1 flex flex-col justify-between">
            <div>
                <h3 className="font-medium text-gray-900 dark:text-white text-base truncate">
                    {user.nickname || "User"}{user.details?.age ? `, ${user.details.age}` : ""}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center mb-1 truncate">
                    {user.details?.location && <MapPinIcon className="h-3 w-3 mr-1 inline-block flex-shrink-0" />}
                    {getSubtitle()}
                </p>
                {/* Optional: Interests or Bio snippet */}
                {user.details?.bio && <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-1 mb-2">{user.details.bio}</p>}
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-2 mt-1">
                <button
                    onClick={handleLikeClick}
                    className={`flex-1 flex items-center justify-center py-1.5 px-2 rounded-md text-xs transition-colors duration-200 ${
                        isLiked // Use prop
                        ? "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                        : "bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                    }`} aria-label={isLiked ? "Unlike" : "Like"}
                 >
                    {isLiked ? <HeartIconSolid className="h-4 w-4" /> : <HeartIcon className="h-4 w-4" />}
                 </button>
                 <button
                    onClick={handleMessageClick}
                    className="flex-1 flex items-center justify-center py-1.5 px-2 rounded-md text-xs bg-gray-100 hover:bg-blue-50 text-gray-500 hover:text-blue-600 transition-colors duration-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-blue-900/30 dark:hover:text-blue-400"
                    aria-label="Message"
                 >
                    <ChatBubbleLeftIcon className="h-4 w-4" />
                 </button>
            </div>
        </div>
     </div>
   );

});

export default UserCard;
