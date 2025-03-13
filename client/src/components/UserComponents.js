import React, { useState, useRef } from 'react';
import { FaUser, FaCamera, FaLock } from 'react-icons/fa';

// User Card Component
export const UserCard = ({ user, onClick }) => {
  return (
    <div className="user-card" onClick={() => onClick(user)}>
      <div className="user-avatar">
        {user.photos && user.photos.length > 0 ? (
          // eslint-disable-next-line jsx-a11y/img-redundant-alt
          <img src={user.photos[0].url} alt={user.nickname} />
        ) : (
          <FaUser />
        )}
        <span className={`status-indicator ${user.isOnline ? 'online' : 'offline'}`}></span>
      </div>
      <div className="user-info">
        <h3>{user.nickname}</h3>
        <p>{user.details?.location}</p>
        <p>{user.details?.age} {user.details?.gender}</p>
      </div>
    </div>
  );
};

// Photo Gallery Component
export const PhotoGallery = ({ photos, isOwnProfile, onUpload, onRequestAccess }) => {
  const [showPrivate, setShowPrivate] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = e => {
    if (e.target.files.length > 0) {
      onUpload(e.target.files[0], showPrivate);
    }
  };

  return (
    <div className="photo-gallery">
      <div className="gallery-header">
        <h2>Photos</h2>
        {isOwnProfile && (
          <div className="gallery-controls">
            <button
              className={`tab-btn ${!showPrivate ? 'active' : ''}`}
              onClick={() => setShowPrivate(false)}
            >
              Public
            </button>
            <button
              className={`tab-btn ${showPrivate ? 'active' : ''}`}
              onClick={() => setShowPrivate(true)}
            >
              Private
            </button>
            <button
              className="upload-btn"
              onClick={() => fileInputRef.current.click()}
            >
              <FaCamera /> Upload {showPrivate ? 'Private' : 'Public'}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept="image/*"
              onChange={handleFileChange}
            />
          </div>
        )}
      </div>

      <div className="photos-grid">
        {photos
          .filter(photo => photo.isPrivate === showPrivate)
          .map((photo, index) => (
            <div key={index} className="photo-item">
              {photo.isPrivate && !isOwnProfile ? (
                <div className="private-photo">
                  <FaLock size={48} />
                  <button
                    className="request-btn"
                    onClick={() => onRequestAccess(photo._id)}
                  >
                    Request Access
                  </button>
                </div>
              ) : (
                <img src={photo.url} alt={`Photo ${index + 1}`} />
              )}
            </div>
          ))}
        {photos.filter(photo => photo.isPrivate === showPrivate).length === 0 && (
          <div className="no-photos">
            {isOwnProfile ? (
              <p>You haven't uploaded any {showPrivate ? 'private' : 'public'} photos yet.</p>
            ) : (
              <p>No {showPrivate ? 'private' : 'public'} photos available.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// User Details Component
export const UserDetails = ({ user }) => {
  return (
    <div className="user-details">
      <h2>{user.nickname}</h2>
      <div className="details-section">
        <p>
          <strong>Age:</strong> {user.details?.age || 'Not specified'}
        </p>
        <p>
          <strong>Gender:</strong> {user.details?.gender || 'Not specified'}
        </p>
        <p>
          <strong>Location:</strong> {user.details?.location || 'Not specified'}
        </p>
        <p>
          <strong>Last Active:</strong>{' '}
          {user.isOnline ? 'Online Now' : new Date(user.lastActive).toLocaleString()}
        </p>
      </div>

      {user.details?.bio && (
        <div className="bio-section">
          <h3>About Me</h3>
          <p>{user.details.bio}</p>
        </div>
      )}

      {user.details?.interests && user.details.interests.length > 0 && (
        <div className="interests-section">
          <h3>Interests</h3>
          <div className="interests-list">
            {user.details.interests.map((interest, index) => (
              <span key={index} className="interest-tag">
                {interest}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
