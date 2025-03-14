// client/src/pages/UserProfile.js
import React, { useEffect, useState } from 'react';
import {
  FaArrowLeft, FaHeart, FaComment, FaEllipsisH,
  FaMapMarkerAlt, FaCalendarAlt, FaRegClock,
  FaCheck, FaChevronRight, FaChevronLeft, FaLock,
  FaUserAlt, FaTrophy
} from 'react-icons/fa';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser, useChat, useAuth } from '../context';
import EmbeddedChat from '../components/EmbeddedChat';
import { toast } from 'react-toastify';

const UserProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { getUser, currentUser: profileUser, loading, requestPhotoPermission } = useUser();
  const { messages, getMessages, sendMessage } = useChat();

  const [showChat, setShowChat] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [showActions, setShowActions] = useState(false);

  // Load user data and messages when component mounts
  useEffect(() => {
    if (id) {
      getUser(id);
    }
  }, [id, getUser]);

  // Redirect if user not found after loading
  useEffect(() => {
    if (!loading && !profileUser && id) {
      toast.error('User profile not found');
      navigate('/dashboard');
    }
  }, [loading, profileUser, id, navigate]);

  const handleBack = () => {
    navigate('/dashboard');
  };

  const handleLike = () => {
    console.log('Liked user:', profileUser?._id);
    toast.success(`You liked ${profileUser?.nickname}`);
  };

  const handleMessage = () => {
    setShowChat(true);
  };

  const handleCloseChat = () => {
    setShowChat(false);
  };

  const handleRequestAccess = (photoId) => {
    if (profileUser) {
      requestPhotoPermission(photoId, profileUser._id);
    }
  };

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

  const calculateCompatibility = () => {
    if (!profileUser || !profileUser.details || !currentUser || !currentUser.details) return 0;

    let score = 0;
    // Location
    if (profileUser.details.location === currentUser.details.location) {
      score += 25;
    }
    // Age proximity
    const ageDiff = Math.abs((profileUser.details.age || 0) - (currentUser.details.age || 0));
    if (ageDiff <= 5) score += 25;
    else if (ageDiff <= 10) score += 15;
    else score += 5;
    // Interests
    const profileInterests = profileUser.details?.interests || [];
    const userInterests = currentUser.details?.interests || [];
    const commonInterests = profileInterests.filter((i) => userInterests.includes(i));
    score += Math.min(50, commonInterests.length * 10);

    return Math.min(100, score);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner spinner-dark"></div>
        <p className="loading-text">Loading profile...</p>
      </div>
    );
  }

  if (!profileUser) {
    return null;
  }

  const compatibility = calculateCompatibility();
  const commonInterests = profileUser.details?.interests?.filter(
    (interest) => currentUser.details?.interests?.includes(interest)
  ) || [];

  return (
    <div className="modern-user-profile">
      <div className="container profile-content">
        <button className="back-button" onClick={handleBack}>
          <FaArrowLeft /> Back
        </button>

        <div className="profile-layout">
          {/* Left: Photos */}
          <div className="profile-photos-section">
            {profileUser.photos && profileUser.photos.length > 0 ? (
              <div>
                <div className="gallery-photo">
                  <img
                    src={profileUser.photos[activePhotoIndex].url}
                    alt={profileUser.nickname}
                  />
                  {profileUser.photos.length > 1 && (
                    <>
                      <button
                        className="gallery-nav prev"
                        onClick={prevPhoto}
                        disabled={activePhotoIndex === 0}
                      >
                        <FaChevronLeft />
                      </button>
                      <button
                        className="gallery-nav next"
                        onClick={nextPhoto}
                        disabled={activePhotoIndex === profileUser.photos.length - 1}
                      >
                        <FaChevronRight />
                      </button>
                    </>
                  )}
                  {profileUser.isOnline && (
                    <div className="online-badge">
                      Online Now
                    </div>
                  )}
                </div>
                {profileUser.photos.length > 1 && (
                  <div className="photo-thumbnails mt-3">
                    {profileUser.photos.map((photo, index) => (
                      <div
                        key={index}
                        className={`photo-thumbnail ${index === activePhotoIndex ? 'active' : ''}`}
                        onClick={() => setActivePhotoIndex(index)}
                      >
                        {photo.isPrivate ? (
                          <div className="private-thumbnail">
                            <FaLock />
                          </div>
                        ) : (
                          <img
                            src={photo.url}
                            alt={`${profileUser.nickname} ${index + 1}`}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="no-photo-placeholder">
                <FaUserAlt />
                <p>No photos available</p>
              </div>
            )}
            <div className="quick-actions">
              <button className="btn btn-outline" onClick={handleLike}>
                <FaHeart />
                <span>Like</span>
              </button>
              <button className="btn btn-primary" onClick={handleMessage}>
                <FaComment />
                <span>Message</span>
              </button>
              <button
                className="btn btn-subtle"
                onClick={() => setShowActions(!showActions)}
              >
                <FaEllipsisH />
              </button>
              {showActions && (
                <div className="actions-dropdown">
                  <button className="dropdown-item">
                    Block User
                  </button>
                  <button className="dropdown-item">
                    Report User
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right: Details */}
          <div className="profile-details-section">
            <div className="user-headline">
              <h1>
                {profileUser.nickname}, {profileUser.details?.age || '?'}
              </h1>
              {profileUser.role === 'premium' && (
                <div className="premium-badge">
                  <FaTrophy /> Premium
                </div>
              )}
            </div>
            <div className="user-location">
              <FaMapMarkerAlt />
              <span>{profileUser.details?.location || 'Unknown location'}</span>
            </div>
            <div className="user-activity">
              <div className="activity-item">
                <FaRegClock />
                <span>
                  {profileUser.isOnline
                    ? 'Online now'
                    : `Last active ${new Date(profileUser.lastActive).toLocaleDateString()}`}
                </span>
              </div>
              <div className="activity-item">
                <FaCalendarAlt />
                <span>Member since {new Date(profileUser.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
            {profileUser.details?.bio && (
              <div className="profile-section">
                <h2>About Me</h2>
                <p>{profileUser.details.bio}</p>
              </div>
            )}
            {profileUser.details?.interests?.length > 0 && (
              <div className="profile-section">
                <h2>Interests</h2>
                <div className="interests-tags">
                  {profileUser.details.interests.map((interest) => (
                    <span
                      key={interest}
                      className={`interest-tag ${
                        commonInterests.includes(interest) ? 'common' : ''
                      }`}
                    >
                      {interest}
                      {commonInterests.includes(interest) && (
                        <FaCheck className="common-icon" />
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="compatibility-section">
              <h2>Compatibility</h2>
              <div className="compatibility-score">
                <div className="score-circle">
                  <svg viewBox="0 0 100 100">
                    <circle className="score-bg" cx="50" cy="50" r="45" />
                    <circle
                      className="score-fill"
                      cx="50"
                      cy="50"
                      r="45"
                      strokeDasharray="283"
                      strokeDashoffset={283 - (283 * compatibility) / 100}
                    />
                  </svg>
                  <div className="score-value">{compatibility}%</div>
                </div>
                <div className="compatibility-details">
                  <h4>Common Interests</h4>
                  {commonInterests.length > 0 ? (
                    <ul className="common-interests-list">
                      {commonInterests.map((interest) => (
                        <li key={interest}>{interest}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>No common interests yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Embedded Chat */}
        {showChat && (
          <>
            <div className="chat-overlay" onClick={handleCloseChat}></div>
            <EmbeddedChat
              recipient={profileUser}
              isOpen={showChat}
              onClose={handleCloseChat}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default UserProfile;
