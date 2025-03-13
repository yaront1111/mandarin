// client/src/pages/UserProfile.js
import React, { useEffect, useState } from 'react';
import { FaArrowLeft, FaHeart, FaComment, FaEllipsisH,
  FaShieldAlt, FaMapMarkerAlt, FaCalendarAlt, FaRegClock,
  FaCheck, FaChevronRight, FaChevronLeft, FaLock, FaUserAlt, FaTrophy
} from 'react-icons/fa';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser, useChat, useAuth } from '../context';
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

  useEffect(() => {
    if (id) {
      getUser(id);
      getMessages(id);
    }
  }, [id, getUser, getMessages]);

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
  };

  const handleMessage = () => {
    setShowChat(true);
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

        <div className="profile-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
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
                    <div className="online-badge" style={{
                      position: 'absolute',
                      top: '16px',
                      left: '16px',
                      background: '#33D685',
                      color: '#fff',
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '0.8rem'
                    }}>
                      Online Now
                    </div>
                  )}
                </div>
                {profileUser.photos.length > 1 && (
                  <div className="photo-thumbnails mt-3" style={{ display: 'flex', gap: '8px' }}>
                    {profileUser.photos.map((photo, index) => (
                      <div
                        key={index}
                        className={`photo-thumbnail ${index === activePhotoIndex ? 'active' : ''}`}
                        onClick={() => setActivePhotoIndex(index)}
                        style={{ cursor: 'pointer' }}
                      >
                        {photo.isPrivate ? (
                          <div
                            style={{
                              width: '60px',
                              height: '60px',
                              background: '#eee',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '8px'
                            }}
                          >
                            <FaLock />
                          </div>
                        ) : (
                          <img
                            src={photo.url}
                            alt={`${profileUser.nickname} ${index + 1}`}
                            style={{
                              width: '60px',
                              height: '60px',
                              objectFit: 'cover',
                              borderRadius: '8px'
                            }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '400px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#f0f0f0'
                }}
              >
                <FaUserAlt style={{ fontSize: '80px', color: '#ccc' }} />
                <p style={{ marginLeft: '8px' }}>No photos available</p>
              </div>
            )}
            <div className="quick-actions d-flex align-items-center mt-3" style={{ gap: '8px' }}>
              <button className="btn btn-outline" onClick={handleLike}>
                <FaHeart />
                <span style={{ marginLeft: '8px' }}>Like</span>
              </button>
              <button className="btn btn-primary" onClick={handleMessage}>
                <FaComment />
                <span style={{ marginLeft: '8px' }}>Message</span>
              </button>
              <button
                className="btn btn-subtle"
                onClick={() => setShowActions(!showActions)}
                style={{ marginLeft: 'auto' }}
              >
                <FaEllipsisH />
              </button>
              {showActions && (
                <div
                  style={{
                    position: 'absolute',
                    background: '#fff',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                    borderRadius: '8px',
                    right: '0',
                    padding: '8px',
                    marginTop: '40px',
                    zIndex: 10
                  }}
                >
                  <button className="btn btn-link" style={{ display: 'block', width: '100%', textAlign: 'left' }}>
                    Block User
                  </button>
                  <button className="btn btn-link" style={{ display: 'block', width: '100%', textAlign: 'left' }}>
                    Report User
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right: Details */}
          <div className="profile-details-section">
            <div className="user-headline d-flex align-items-center">
              <h1 style={{ marginRight: '8px' }}>
                {profileUser.nickname}, {profileUser.details?.age || '?'}
              </h1>
              {profileUser.role === 'premium' && (
                <div
                  className="d-flex align-items-center"
                  style={{
                    background: '#ff3366',
                    color: '#fff',
                    padding: '4px 8px',
                    borderRadius: '8px',
                    fontSize: '0.8rem'
                  }}
                >
                  <FaTrophy style={{ marginRight: '4px' }} /> Premium
                </div>
              )}
            </div>
            <div className="user-location d-flex align-items-center mb-2">
              <FaMapMarkerAlt />
              <span>{profileUser.details?.location || 'Unknown location'}</span>
            </div>
            <div className="d-flex align-items-center text-light mb-4" style={{ gap: '16px' }}>
              <div className="d-flex align-items-center" style={{ gap: '4px' }}>
                <FaRegClock />
                <span>
                  {profileUser.isOnline
                    ? 'Online now'
                    : `Last active ${new Date(profileUser.lastActive).toLocaleDateString()}`}
                </span>
              </div>
              <div className="d-flex align-items-center" style={{ gap: '4px' }}>
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
                <div className="d-flex flex-wrap" style={{ gap: '8px' }}>
                  {profileUser.details.interests.map((interest) => (
                    <span
                      key={interest}
                      className={`interest-tag ${
                        commonInterests.includes(interest) ? 'selected' : ''
                      }`}
                    >
                      {interest}
                      {commonInterests.includes(interest) && (
                        <FaCheck style={{ marginLeft: '4px' }} />
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="compatibility-section mt-4">
              <h2>Compatibility</h2>
              <div
                className="compatibility-score d-flex align-items-center"
                style={{
                  background: 'rgba(255, 51, 102, 0.08)',
                  padding: '16px',
                  borderRadius: '8px',
                  marginTop: '8px'
                }}
              >
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
                <div className="compatibility-details ml-4">
                  <h4 style={{ marginBottom: '8px' }}>Common Interests</h4>
                  {commonInterests.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
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

        {showChat && (
          <div
            style={{
              position: 'fixed',
              bottom: '0',
              right: '0',
              width: '400px',
              backgroundColor: '#fff',
              boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
              borderTopLeftRadius: '8px',
              borderTopRightRadius: '8px',
              zIndex: 999
            }}
          >
            <div className="d-flex justify-content-between align-items-center p-3 border-bottom">
              <h4 className="mb-0">Chat with {profileUser.nickname}</h4>
              <button className="btn btn-link" onClick={() => setShowChat(false)}>
                Close
              </button>
            </div>
            <div style={{ padding: '16px' }}>
              {/* Example chatbox placeholder or real ChatBox component */}
              <p>ChatBox goes here...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfile;
