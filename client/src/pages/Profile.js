// client/src/pages/Profile.js
import React, { useState, useEffect, useRef } from 'react';
import {
  FaCamera,
  FaEdit,
  FaCheck,
  FaTimes,
  FaUserCircle,
  FaLock,
  FaChevronLeft,
  FaChevronRight
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { useAuth, useUser } from '../context';

const Profile = () => {
  const { user } = useAuth();
  const { updateProfile, uploadPhoto } = useUser();

  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    nickname: '',
    details: {
      age: '',
      gender: '',
      location: '',
      bio: '',
      interests: []
    }
  });
  const [availableInterests] = useState([
    'Dating', 'Casual', 'Friendship', 'Long-term', 'Travel',
    'Outdoors', 'Movies', 'Music', 'Fitness', 'Food', 'Art',
    'Reading', 'Gaming', 'Photography', 'Dancing', 'Cooking'
  ]);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Local copy of photos to allow toggling privacy.
  const [localPhotos, setLocalPhotos] = useState([]);
  const [profilePhotoIndex, setProfilePhotoIndex] = useState(0);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      setProfileData({
        nickname: user.nickname || '',
        details: {
          age: user.details?.age || '',
          gender: user.details?.gender || '',
          location: user.details?.location || '',
          bio: user.details?.bio || '',
          interests: user.details?.interests || []
        }
      });
      if (user.photos) {
        // Initialize localPhotos with a default privacy flag if not present
        setLocalPhotos(
          user.photos.map(photo => ({
            ...photo,
            isPrivate: photo.isPrivate ?? false
          }))
        );
        setProfilePhotoIndex(0);
      }
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setProfileData(prev => ({
        ...prev,
        [parent]: { ...prev[parent], [child]: value }
      }));
    } else {
      setProfileData(prev => ({ ...prev, [name]: value }));
    }
  };

  const toggleInterest = (interest) => {
    const interests = profileData.details.interests;
    const updated = interests.includes(interest)
      ? interests.filter(i => i !== interest)
      : [...interests, interest];
    setProfileData(prev => ({
      ...prev,
      details: { ...prev.details, interests: updated }
    }));
  };

  const validateForm = () => {
    const validationErrors = {};
    if (!profileData.nickname.trim()) {
      validationErrors.nickname = 'Nickname is required';
    }
    if (!profileData.details.age) {
      validationErrors.age = 'Age is required';
    } else if (profileData.details.age < 18) {
      validationErrors.age = 'You must be at least 18 years old';
    }
    if (!profileData.details.gender) {
      validationErrors.gender = 'Gender is required';
    }
    if (!profileData.details.location.trim()) {
      validationErrors.location = 'Location is required';
    }
    return validationErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setIsSubmitting(true);
    try {
      await updateProfile(profileData);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      // Here, we assume new uploads are public by default.
      await uploadPhoto(file, false);
      // Optionally, update localPhotos if your API doesn't auto-update the user object.
    } catch (error) {
      console.error('Failed to upload photo:', error);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Toggle privacy for a photo in local state.
  const handleTogglePhotoPrivacy = (index, e) => {
    e.stopPropagation(); // Prevent thumbnail click
    setLocalPhotos(prev =>
      prev.map((photo, i) =>
        i === index ? { ...photo, isPrivate: !photo.isPrivate } : photo
      )
    );
    // Optionally, trigger an API call here to update the photo's privacy.
  };

  // Set the selected photo as the profile photo.
  const handleSetProfilePhoto = (index) => {
    setProfilePhotoIndex(index);
    console.log('Set profile photo to index:', index);
  };

  return (
    <div className="modern-dashboard">
      {/* Header */}
      <header className="modern-header">
        <div className="container d-flex justify-content-between align-items-center">
          <div className="logo" style={{ cursor: 'pointer' }} onClick={() => navigate('/dashboard')}>
            Mandarin
          </div>
          <div className="d-none d-md-flex main-tabs">
            <button className="tab-button" onClick={() => navigate('/dashboard')}>
              Dashboard
            </button>
            <button className="tab-button" onClick={() => navigate('/messages')}>
              Messages
            </button>
          </div>
          <div className="header-actions d-flex align-items-center">
            {user?.photos?.[0] ? (
              <img
                src={user.photos[0].url}
                alt={user.nickname}
                className="user-avatar"
                onClick={() => navigate('/profile')}
              />
            ) : (
              <FaUserCircle
                className="user-avatar"
                style={{ fontSize: '32px' }}
                onClick={() => navigate('/profile')}
              />
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-content">
        <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Profile Photo Section */}
          <div className="profile-photo-section text-center">
            {localPhotos.length > 0 ? (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img
                  src={localPhotos[profilePhotoIndex].url}
                  alt="Profile"
                  style={{
                    width: '200px',
                    height: '200px',
                    objectFit: 'cover',
                    borderRadius: '50%',
                    boxShadow: '0 6px 16px rgba(0, 0, 0, 0.1)',
                    transition: 'transform var(--transition-normal)'
                  }}
                />
                {localPhotos[profilePhotoIndex].isPrivate && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      background: 'rgba(0,0,0,0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <FaLock style={{ fontSize: '32px', color: '#fff' }} />
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                width: '200px',
                height: '200px',
                borderRadius: '50%',
                background: '#f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <FaUserCircle style={{ fontSize: '80px', color: '#ccc' }} />
              </div>
            )}
            <div style={{ marginTop: '16px' }}>
              <button className="btn btn-outline" onClick={triggerFileInput}>
                <FaCamera style={{ marginRight: '4px' }} /> Add Photo
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoUpload}
                  accept="image/*"
                  style={{ display: 'none' }}
                />
              </button>
            </div>
          </div>

          {/* Photo Gallery Section */}
          {localPhotos.length > 1 && (
            <div className="photo-gallery" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
              gap: '16px'
            }}>
              {localPhotos.map((photo, index) => (
                <div
                  key={index}
                  className="gallery-item"
                  style={{
                    position: 'relative',
                    cursor: 'pointer',
                    border: index === profilePhotoIndex ? '2px solid var(--primary)' : '2px solid transparent',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    transition: 'transform var(--transition-normal)'
                  }}
                  onClick={() => handleSetProfilePhoto(index)}
                >
                  <img
                    src={photo.url}
                    alt={`Gallery ${index + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  {/* Small lock icon toggle button */}
                  <button
                    onClick={(e) => handleTogglePhotoPrivacy(index, e)}
                    style={{
                      position: 'absolute',
                      bottom: '4px',
                      right: '4px',
                      background: 'rgba(0,0,0,0.6)',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '2px',
                      cursor: 'pointer'
                    }}
                  >
                    <FaLock style={{ fontSize: '14px', color: '#fff' }} />
                  </button>
                </div>
              ))}
              {/* Add Photo Button in Gallery */}
              <button
                type="button"
                className="gallery-item add"
                onClick={triggerFileInput}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#eaeaea',
                  border: '2px dashed #ccc',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  height: '100px'
                }}
              >
                <FaCamera style={{ fontSize: '24px', color: '#555' }} />
              </button>
            </div>
          )}

          {/* Profile Information Section */}
          <div className="profile-info">
            <div className="profile-header d-flex justify-content-between align-items-center">
              <h2>My Profile</h2>
              {!isEditing ? (
                <button className="btn btn-primary" onClick={() => setIsEditing(true)}>
                  <FaEdit /> Edit
                </button>
              ) : (
                <div className="d-flex" style={{ gap: '8px' }}>
                  <button className="btn btn-outline" onClick={() => setIsEditing(false)} disabled={isSubmitting}>
                    <FaTimes /> Cancel
                  </button>
                  <button className="btn btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <span className="spinner spinner-dark"></span>
                        <span style={{ marginLeft: '8px' }}>Saving...</span>
                      </>
                    ) : (
                      <>
                        <FaCheck /> Save
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            <form className="mt-4" onSubmit={handleSubmit}>
              <div className="info-section">
                <h3>Basic Information</h3>
                <div className="info-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="nickname">Nickname</label>
                    <input
                      type="text"
                      id="nickname"
                      name="nickname"
                      className={`form-control ${errors.nickname ? 'border-danger' : ''}`}
                      value={profileData.nickname}
                      onChange={handleChange}
                      disabled={!isEditing}
                    />
                    {errors.nickname && <p className="error-message" style={{ color: 'red', marginTop: '4px' }}>{errors.nickname}</p>}
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="details.age">Age</label>
                    <input
                      type="number"
                      id="details.age"
                      name="details.age"
                      className={`form-control ${errors.age ? 'border-danger' : ''}`}
                      value={profileData.details.age}
                      onChange={handleChange}
                      disabled={!isEditing}
                    />
                    {errors.age && <p className="error-message" style={{ color: 'red', marginTop: '4px' }}>{errors.age}</p>}
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="details.gender">Gender</label>
                    <select
                      id="details.gender"
                      name="details.gender"
                      className={`form-control ${errors.gender ? 'border-danger' : ''}`}
                      value={profileData.details.gender}
                      onChange={handleChange}
                      disabled={!isEditing}
                    >
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                    {errors.gender && <p className="error-message" style={{ color: 'red', marginTop: '4px' }}>{errors.gender}</p>}
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="details.location">Location</label>
                    <input
                      type="text"
                      id="details.location"
                      name="details.location"
                      className={`form-control ${errors.location ? 'border-danger' : ''}`}
                      value={profileData.details.location}
                      onChange={handleChange}
                      disabled={!isEditing}
                    />
                    {errors.location && <p className="error-message" style={{ color: 'red', marginTop: '4px' }}>{errors.location}</p>}
                  </div>
                </div>
              </div>

              <div className="info-section">
                <h3>About Me</h3>
                <textarea
                  name="details.bio"
                  rows="4"
                  className="form-control"
                  value={profileData.details.bio}
                  onChange={handleChange}
                  disabled={!isEditing}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div className="info-section">
                <h3>Interests</h3>
                <div className="interests-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {availableInterests.map((interest) => {
                    const isSelected = profileData.details.interests.includes(interest);
                    return (
                      <button
                        key={interest}
                        type="button"
                        className={`interest-tag ${isSelected ? 'selected' : ''}`}
                        onClick={() => isEditing && toggleInterest(interest)}
                        disabled={!isEditing}
                        style={{
                          padding: '4px 12px',
                          borderRadius: '20px',
                          backgroundColor: isSelected ? 'var(--primary)' : 'var(--light)',
                          color: isSelected ? '#fff' : 'var(--text-medium)',
                          border: 'none',
                          cursor: isEditing ? 'pointer' : 'default',
                          transition: 'all var(--transition-normal)'
                        }}
                      >
                        {interest}
                        {isSelected && <FaCheck style={{ marginLeft: '4px' }} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Profile;
