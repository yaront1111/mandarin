"use client"

import { useState } from "react"
import { UserIcon, HeartIcon } from "@heroicons/react/24/outline"
import { useNavigate } from "react-router-dom"

// Replace the existing UserCard component with this responsive version
const UserCard = ({ user, viewMode, onLike }) => {
  const navigate = useNavigate()
  const [imageLoaded, setImageLoaded] = useState(false)

  const handleCardClick = () => {
    navigate(`/profile/${user._id}`)
  }

  const handleLikeClick = (e) => {
    e.stopPropagation()
    onLike(user._id)
  }

  if (viewMode === "grid") {
    return (
      <div
        className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200 cursor-pointer"
        onClick={handleCardClick}
      >
        {/* Image container with aspect ratio */}
        <div className="relative pb-[100%]">
          {/* Placeholder while image loads */}
          {!imageLoaded && (
            <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
              <UserIcon className="h-12 w-12 text-gray-300" />
            </div>
          )}

          <img
            src={user.profilePhoto || "/placeholder.svg?height=300&width=300"}
            alt={`${user.firstName}'s profile`}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setImageLoaded(true)}
          />
        </div>

        <div className="p-4">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-medium text-gray-900 truncate">
                {user.firstName}, {user.age}
              </h3>
              <p className="text-sm text-gray-500 truncate">{user.location?.city || "Unknown location"}</p>
            </div>
            <button
              className={`p-2 rounded-full ${user.isLiked ? "text-red-500 bg-red-50" : "text-gray-400 hover:bg-gray-50"}`}
              onClick={handleLikeClick}
              aria-label={user.isLiked ? "Unlike" : "Like"}
            >
              <HeartIcon className="h-5 w-5" />
            </button>
          </div>

          {user.bio && <p className="mt-2 text-sm text-gray-600 line-clamp-2">{user.bio}</p>}

          {user.interests?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {user.interests.slice(0, 3).map((interest) => (
                <span
                  key={interest}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700"
                >
                  {interest}
                </span>
              ))}
              {user.interests.length > 3 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-600">
                  +{user.interests.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // List view
  return (
    <div
      className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200 cursor-pointer"
      onClick={handleCardClick}
    >
      <div className="flex flex-col sm:flex-row">
        {/* Image container with fixed dimensions on mobile, aspect ratio on desktop */}
        <div className="relative w-full sm:w-40 h-48 sm:h-auto">
          {!imageLoaded && (
            <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
              <UserIcon className="h-12 w-12 text-gray-300" />
            </div>
          )}

          <img
            src={user.profilePhoto || "/placeholder.svg?height=300&width=300"}
            alt={`${user.firstName}'s profile`}
            className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setImageLoaded(true)}
          />
        </div>

        <div className="p-4 flex-1">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-medium text-gray-900">
                {user.firstName}, {user.age}
              </h3>
              <p className="text-sm text-gray-500">{user.location?.city || "Unknown location"}</p>
            </div>
            <button
              className={`p-2 rounded-full ${user.isLiked ? "text-red-500 bg-red-50" : "text-gray-400 hover:bg-gray-50"}`}
              onClick={handleLikeClick}
              aria-label={user.isLiked ? "Unlike" : "Like"}
            >
              <HeartIcon className="h-5 w-5" />
            </button>
          </div>

          {user.bio && <p className="mt-2 text-sm text-gray-600 line-clamp-3">{user.bio}</p>}

          {user.interests?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {user.interests.map((interest) => (
                <span
                  key={interest}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700"
                >
                  {interest}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default UserCard
