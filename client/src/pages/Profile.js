// client/src/pages/Profile.js
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaCamera, FaEdit, FaCheck, FaTimes, FaUserCircle } from 'react-icons/fa';
import { useAuth, useUser } from '../context';
import { Navbar } from '../components';

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
  const [availableInterests, setAvailableInterests] = useState([
    'Dating', 'Casual', 'Friendship', 'Long-term', 'Travel',
    'Outdoors', 'Movies', 'Music', 'Fitness', 'Food', 'Art',
    'Reading', 'Gaming', 'Photography', 'Dancing', 'Cooking'
  ]);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPublicPhotos, setShowPublicPhotos] = useState(true);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  // Initialize profile data from user
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
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setProfileData({
        ...profileData,
        [parent]: {
          ...profileData[parent],
          [child]: value
        }
      });
    } else {
      setProfileData({
        ...profileData,
        [name]: value
      });
    }
  };

  const toggleInterest = (interest) => {
    const interests = [...profileData.details.interests];

    if (interests.includes(interest)) {
      const filtered = interests.filter(i => i !== interest);
      setProfileData({
        ...profileData,
        details: {
          ...profileData.details,
          interests: filtered
        }
      });
    } else {
      setProfileData({
        ...profileData,
        details: {
          ...profileData.details,
          interests: [...interests, interest]
        }
      });
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!profileData.nickname.trim()) {
      errors.nickname = 'Nickname is required';
    }

    if (!profileData.details.age) {
      errors.age = 'Age is required';
    } else if (profileData.details.age < 18) {
      errors.age = 'You must be at least 18 years old';
    }

    if (!profileData.details.gender) {
      errors.gender = 'Gender is required';
    }

    if (!profileData.details.location.trim()) {
      errors.location = 'Location is required';
    }

    return errors;
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
      await uploadPhoto(file, !showPublicPhotos);
    } catch (error) {
      console.error('Failed to upload photo:', error);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="profile-page">
      <Navbar />

      <div className="container profile-container">
        <div className="profile-header">
          <h1>My Profile</h1>
          {!isEditing ? (
            <button
              className="btn btn-primary"
              onClick={() => setIsEditing(true)}
            >
              <FaEdit /> Edit Profile
            </button>
          ) : (
            <div className="edit-actions">
              <button
                className="btn btn-outline"
                onClick={() => setIsEditing(false)}
                disabled={isSubmitting}
              >
                <FaTimes /> Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner"></span> Saving...
                  </>
                ) : (
                  <>
                    <FaCheck /> Save Changes
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        <div className="profile-grid">
          <div className="profile-photos-section">
            <div className="photos-header">
              <h2>My Photos</h2>
              <div className="photo-tabs">
                <button
                  className={`tab-button ${showPublicPhotos ? 'active' : ''}`}
                  onClick={() => setShowPublicPhotos(true)}
                >
                  Public
                </button>
                <button
                  className={`tab-button ${!showPublicPhotos ? 'active' : ''}`}
                  onClick={() => setShowPublicPhotos(false)}
                >
                  Private
                </button>
              </div>
            </div>

            <div className="photos-grid">
              {user?.photos?.filter(photo => photo.isPrivate !== showPublicPhotos).length > 0 ? (
                user.photos
                  .filter(photo => photo.isPrivate !== showPublicPhotos)
                  .map((photo, index) => (
                    <div key={index} className="photo-item">
                      <img src={photo.url} alt={`${user.nickname} ${index + 1}`} />
                    </div>
                  ))
              ) : (
                <div className="no-photos">
                  <p>No {showPublicPhotos ? 'public' : 'private'} photos yet.</p>
                </div>
              )}

              <div className="photo-upload-btn" onClick={triggerFileInput}>
                <FaCamera />
                <span>Add Photo</span>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoUpload}
                  accept="image/*"
                  style={{ display: 'none' }}
                />
              </div>
            </div>
          </div>

          <div className="profile-details-section">
            <form className="profile-form">
              <div className="form-group">
                <label htmlFor="nickname">Nickname</label>
                <input
                  type="text"
                  id="nickname"
                  name="nickname"
                  value={profileData.nickname}
                  onChange={handleChange}
                  disabled={!isEditing}
                  className={errors.nickname ? 'error' : ''}
                />
                {errors.nickname && <p className="error-message">{errors.nickname}</p>}
              </div>

              <div className="form-group">
                <label htmlFor="details.age">Age</label>
                <input
                  type="number"
                  id="details.age"
                  name="details.age"
                  value={profileData.details.age}
                  onChange={handleChange}
                  disabled={!isEditing}
                  min="18"
                  className={errors.age ? 'error' : ''}
                />
                {errors.age && <p className="error-message">{errors.age}</p>}
              </div>

              <div className="form-group">
                <label htmlFor="details.gender">Gender</label>
                <select
                  id="details.gender"
                  name="details.gender"
                  value={profileData.details.gender}
                  onChange={handleChange}
                  disabled={!isEditing}
                  className={errors.gender ? 'error' : ''}
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
                {errors.gender && <p className="error-message">{errors.gender}</p>}
              </div>

              <div className="form-group">
                <label htmlFor="details.location">Location</label>
                <input
                  type="text"
                  id="details.location"
                  name="details.location"
                  value={profileData.details.location}
                  onChange={handleChange}
                  disabled={!isEditing}
                  className={errors.location ? 'error' : ''}
                />
                {errors.location && <p className="error-message">{errors.location}</p>}
              </div>

              <div className="form-group">
                <label htmlFor="details.bio">About Me</label>
                <textarea
                  id="details.bio"
                  name="details.bio"
                  value={profileData.details.bio}
                  onChange={handleChange}
                  disabled={!isEditing}
                  rows="4"
                ></textarea>
              </div>

              <div className="form-group">
                <label>Interests</label>
                <div className="interests-grid">
                  {availableInterests.map(interest => (
                    <button
                      key={interest}
                      type="button"
                      className={`interest-tag ${profileData.details.interests.includes(interest) ? 'selected' : ''}`}
                      onClick={() => isEditing && toggleInterest(interest)}
                      disabled={!isEditing}
                    >
                      {interest}
                      {profileData.details.interests.includes(interest) && <FaCheck className="tag-check" />}
                    </button>
                  ))}
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
