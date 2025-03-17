"use client"
import { FaHeart } from "react-icons/fa"
import { useUser } from "../context/UserContext"

const UserCard = ({ user }) => {
  const { isUserLiked, likeUser, unlikeUser } = useUser()

  const handleLikeClick = async (e) => {
    e.preventDefault()
    e.stopPropagation()

    if (isUserLiked(user._id)) {
      await unlikeUser(user._id, user.nickname)
    } else {
      await likeUser(user._id, user.nickname)
    }
  }

  return (
    <div className="bg-white shadow rounded-lg p-4 flex flex-col">
      <img
        src={user.avatar || "/placeholder.svg"}
        alt={`${user.nickname}'s avatar`}
        className="w-24 h-24 rounded-full mx-auto mb-2"
      />
      <h3 className="text-lg font-semibold text-center">{user.nickname}</h3>
      <p className="text-gray-600 text-center">{user.bio}</p>
      <div className="mt-2 flex justify-between items-center">
        <span className="text-sm text-gray-500">{user.location}</span>
        <button
          onClick={handleLikeClick}
          className={`like-button ${isUserLiked(user._id) ? "liked" : ""}`}
          aria-label={isUserLiked(user._id) ? "Unlike" : "Like"}
        >
          <FaHeart className={isUserLiked(user._id) ? "text-red-500" : "text-gray-400"} />
        </button>
      </div>
    </div>
  )
}

export default UserCard
