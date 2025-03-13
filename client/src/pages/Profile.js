import React, { useState } from 'react';
import { Navbar, Alert, PhotoGallery } from '../components';
import { useAuth, useUser } from '../context';

const Profile = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    nickname: user?.nickname || '',
    bio: user?.details?.bio || '',
    age: user?.details?.age || '',
    gender: user?.details?.gender || '',
    location: user?.details?.location || '',
    interests: user?.details?.interests?.join(', ') || ''
  });
  const [alert, setAlert] = useState(null);
  const { uploadPhoto } = useUser();
  const { nickname, bio, age, gender, location, interests } = formData;

  const onChange = e => setFormData({ ...formData, [e.target.name]: e.target.value });
  const onSubmit = e => {
    e.preventDefault();
    setAlert({ type: 'success', message: 'Profile updated successfully!' });
  };

  const handleUploadPhoto = async (file, isPrivate) => {
    const result = await uploadPhoto(file, isPrivate);
    if (result) {
      setAlert({ type: 'success', message: 'Photo uploaded successfully!' });
    }
  };

  return (
    <div className="profile-page">
      <Navbar />
      <div className="profile-container">
        <h1>My Profile</h1>
        {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}
        <div className="profile-content">
          <div className="photos-section">
            <PhotoGallery photos={user?.photos || []} isOwnProfile={true} onUpload={handleUploadPhoto} />
          </div>
          <div className="details-section">
            <h2>Edit Profile</h2>
            <form className="profile-form" onSubmit={onSubmit}>
              <div className="form-group">
                <label htmlFor="nickname">Nickname</label>
                <input type="text" id="nickname" name="nickname" value={nickname} onChange={onChange} />
              </div>
              <div className="form-group">
                <label htmlFor="bio">About Me</label>
                <textarea id="bio" name="bio" value={bio} onChange={onChange} rows="4" maxLength="500"></textarea>
              </div>
              <div className="form-group">
                <label htmlFor="age">Age</label>
                <input type="number" id="age" name="age" value={age} onChange={onChange} min="18" max="120" />
              </div>
              <div className="form-group">
                <label htmlFor="gender">Gender</label>
                <select id="gender" name="gender" value={gender} onChange={onChange}>
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="location">Location</label>
                <input type="text" id="location" name="location" value={location} onChange={onChange} />
              </div>
              <div className="form-group">
                <label htmlFor="interests">Interests (comma-separated)</label>
                <input type="text" id="interests" name="interests" value={interests} onChange={onChange} placeholder="e.g. music, hiking, movies" />
              </div>
              <button type="submit" className="btn btn-primary">Save Changes</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
