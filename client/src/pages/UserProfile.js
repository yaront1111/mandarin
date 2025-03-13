import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaHeart, FaComment, FaEllipsisH, FaShieldAlt, FaMapMarkerAlt,
         FaCalendarAlt, FaRegClock, FaCheck, FaChevronRight, FaChevronLeft,
         FaLock, FaUserAlt, FaTrophy } from 'react-icons/fa';
import { useUser, useChat, useAuth } from '../context';
import { PhotoGallery, ChatBox } from '../components';

const UserProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { getUser, currentUser: profileUser, loading, requestPhotoPermission } = useUser();
  const { messages, getMessages, sendMessage } = useChat();

  const [showChat, setShowChat] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [showActions, setShowActions] = useState(false);

  useEffect(() => {
    // Fetch the user profile
    if (id) {
      getUser(id);
      getMessages(id);
    }
  }, [id]);

  // Go back to previous page
  const handleBack = () => {
    navigate('/dashboard');
  };

  // Like the user
  const handleLike = () => {
    // This would call a like API in a real implementation
    console.log('Liked user:', profileUser?._id);
  };

  // Message the user
  const handleMessage = () => {
    setShowChat(true);
  };

  // Request access to private photo
  const handleRequestAccess = (photoId) => {
    if (profileUser) {
      requestPhotoPermission(photoId, profileUser._id);
    }
  };

  // Navigate photo gallery
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

  // Calculate compatibility score (in a real app this would be more sophisticated)
  const calculateCompatibility = () => {
    if (!profileUser || !profileUser.details || !currentUser || !currentUser.details) return 0;

    let score = 0;

    // Location match
    if (profileUser.details.location === currentUser.details.location) {
      score += 25;
    }

    // Age proximity (simplified)
    const ageDiff = Math.abs((profileUser.details.age || 0) - (currentUser.details.age || 0));
    if (ageDiff <= 5) score += 25;
    else if (ageDiff <= 10) score += 15;
    else score += 5;

    // Interests match
    const profileInterests = profileUser.details.interests || [];
    const userInterests = currentUser.details.interests || [];

    const commonInterests = profileInterests.filter(interest =>
      userInterests.includes(interest)
    );

    score += Math.min(50, commonInterests.length * 10);

    return Math.min(100, score);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading profile...</p>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="not-found-container">
        <h2>User not found</h2>
        <p>The user you're looking for may have deleted their account or doesn't exist.</p>
        <button className="btn btn-primary" onClick={handleBack}>Go Back</button>
      </div>
    );
  }

  const compatibility = calculateCompatibility();
  const commonInterests = profileUser.details?.interests?.filter(
    interest => currentUser.details?.interests?.includes(interest)
  ) || [];

  return (
    <div className="user-profile-page">
      <div className="profile-header-bar">
        <button className="back-button" onClick={handleBack}>
          <FaArrowLeft />
          <span>Back</span>
        </button>
        <div className="profile-actions-menu">
          <button
            className="menu-button"
            onClick={() => setShowActions(!showActions)}
          >
            <FaEllipsisH />
          </button>
          {showActions && (
            <div className="actions-dropdown">
              <button className="dropdown-item">
                <span>Block User</span>
              </button>
              <button className="dropdown-item">
                <span>Report User</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="profile-content">
        <div className="profile-main">
          <div className="profile-photos-section">
            <div className="photo-gallery-container">
              <div className="main-photo">
                {profileUser.photos && profileUser.photos.length > 0 ? (
                  <img
                    src={profileUser.photos[activePhotoIndex].url}
                    alt={profileUser.nickname}
                  />
                ) : (
                  <div className="no-photo">
                    <FaUserAlt />
                    <p>No photos available</p>
                  </div>
                )}

                {profileUser.photos && profileUser.photos.length > 1 && (
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
                  <div className="online-badge">Online Now</div>
                )}
              </div>

              {profileUser.photos && profileUser.photos.length > 1 && (
                <div className="photo-thumbnails">
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
                        <img src={photo.url} alt={`${profileUser.nickname} ${index + 1}`} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="quick-actions">
              <button className="action-button like-button" onClick={handleLike}>
                <FaHeart />
                <span>Like</span>
              </button>
              <button className="action-button message-button" onClick={handleMessage}>
                <FaComment />
                <span>Message</span>
              </button>
            </div>
          </div>

          <div className="profile-info-section">
            <div className="profile-header">
              <div className="name-badge">
                <h1>{profileUser.nickname}, {profileUser.details?.age || '?'}</h1>
                {profileUser.role === 'premium' && (
                  <div className="premium-badge">
                    <FaTrophy />
                    <span>Premium</span>
                  </div>
                )}
              </div>

              <div className="verified-badge">
                <FaShieldAlt />
                <span>Verified</span>
              </div>
            </div>

            <div className="profile-meta">
              <div className="meta-item">
                <FaMapMarkerAlt />
                <span>{profileUser.details?.location || 'Unknown location'}</span>
              </div>
              <div className="meta-item">
                <FaRegClock />
                <span>
                  {profileUser.isOnline
                    ? 'Online now'
                    : `Last active ${new Date(profileUser.lastActive).toLocaleDateString()}`}
                </span>
              </div>
              <div className="meta-item">
                <FaCalendarAlt />
                <span>Member since {new Date(profileUser.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            {profileUser.details?.bio && (
              <div className="bio-section">
                <h2>About Me</h2>
                <p>{profileUser.details.bio}</p>
              </div>
            )}

            {profileUser.details?.interests && profileUser.details.interests.length > 0 && (
              <div className="interests-section">
                <h2>Interests</h2>
                <div className="interests-tags">
                  {profileUser.details.interests.map(interest => (
                    <span
                      key={interest}
                      className={`interest-tag ${commonInterests.includes(interest) ? 'common' : ''}`}
                    >
                      {interest}
                      {commonInterests.includes(interest) && <FaCheck className="common-icon" />}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="compatibility-section">
              <h2>Compatibility</h2>
              <div className="compatibility-meter">
                <div className="meter-bar">
                  <div
                    className="meter-fill"
                    style={{width: `${compatibility}%`}}
                  ></div>
                </div>
                <div className="compatibility-score">{compatibility}%</div>
              </div>

              <div className="compatibility-details">
                <h3>You both share:</h3>
                {commonInterests.length > 0 ? (
                  <ul className="common-interests">
                    {commonInterests.map(interest => (
                      <li key={interest}>
                        <FaCheck className="check-icon" />
                        <span>{interest}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="no-common">No common interests yet. You might still be a great match!</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {showChat && (
          <div className="chat-container">
            <div className="chat-header">
              <h2>Chat with {profileUser.nickname}</h2>
              <button className="close-button" onClick={() => setShowChat(false)}>×</button>
            </div>
            <ChatBox recipient={profileUser} />
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfile;
