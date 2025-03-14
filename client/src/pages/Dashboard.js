// client/src/pages/Dashboard.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaSearch,
  FaFilter,
  FaHeart,
  FaComments,
  FaBell,
  FaUserCircle
} from 'react-icons/fa';
import { useAuth, useUser } from '../context';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { users, getUsers, loading } = useUser();
  const [activeTab, setActiveTab] = useState('discover');
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({
    ageMin: 0,
    ageMax: 150,
    distance: 100,
    online: false,
    verified: false,
    withPhotos: false,
    interests: []
  });

  // Fetch users on mount and set up periodic refresh and visibility listener.
  useEffect(() => {
    getUsers();

    const refreshInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        getUsers();
      }
    }, 60000); // Refresh every minute when visible

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        getUsers(); // Refresh immediately when tab becomes visible
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup on unmount.
    return () => {
      clearInterval(refreshInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [getUsers]);

  // Filter users based on filterValues.
  const filteredUsers = users.filter(u => {
    const userAge = u.details?.age || 25;
    if (userAge < filterValues.ageMin || userAge > filterValues.ageMax) return false;
    if (filterValues.online && !u.isOnline) return false;
    if (filterValues.withPhotos && (!u.photos || u.photos.length === 0)) return false;
    if (filterValues.interests.length > 0) {
      const userInterests = u.details?.interests || [];
      const hasMatchingInterest = filterValues.interests.some(i => userInterests.includes(i));
      if (!hasMatchingInterest) return false;
    }
    return true;
  });

  // Custom sorting: online users first, then by lastActive descending.
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (a.isOnline && !b.isOnline) return -1;
    if (!a.isOnline && b.isOnline) return 1;
    return new Date(b.lastActive) - new Date(a.lastActive);
  });

  const availableInterests = [
    'Dating', 'Casual', 'Friendship', 'Long-term', 'Travel',
    'Outdoors', 'Movies', 'Music', 'Fitness', 'Food', 'Art'
  ];

  const toggleInterest = (interest) => {
    setFilterValues(prev => {
      if (prev.interests.includes(interest)) {
        return { ...prev, interests: prev.interests.filter(i => i !== interest) };
      } else {
        return { ...prev, interests: [...prev.interests, interest] };
      }
    });
  };

  const navigateToUserProfile = (userId) => {
    navigate(`/user/${userId}`);
  };

  const navigateToMessages = (e) => {
    e?.stopPropagation();
    navigate('/messages');
  };

  const navigateToProfile = () => {
    navigate('/profile');
  };

  return (
    <div className="modern-dashboard">
      {/* Header */}
      <header className="modern-header">
        <div className="container d-flex justify-content-between align-items-center">
          <div className="logo">Mandarin</div>
          <div className="main-tabs d-none d-md-flex">
            <button
              className={`tab-button ${activeTab === 'discover' ? 'active' : ''}`}
              onClick={() => setActiveTab('discover')}
            >
              <FaSearch className="tab-icon" />
              <span>Discover</span>
            </button>
            <button
              className={`tab-button ${activeTab === 'matches' ? 'active' : ''}`}
              onClick={() => setActiveTab('matches')}
            >
              <FaHeart className="tab-icon" />
              <span>Matches</span>
            </button>
            <button
              className={`tab-button ${activeTab === 'messages' ? 'active' : ''}`}
              onClick={navigateToMessages}
            >
              <FaComments className="tab-icon" />
              <span>Messages</span>
              <span className="notification-badge">3</span>
            </button>
          </div>
          <div className="header-actions d-flex align-items-center">
            <button className="header-action-button">
              <FaBell />
              <span className="notification-badge">2</span>
            </button>
            <div className="user-avatar-dropdown">
              {user?.photos?.length > 0 ? (
                <img
                  src={user.photos[0].url}
                  alt={user.nickname}
                  className="user-avatar"
                  onClick={navigateToProfile}
                />
              ) : (
                <FaUserCircle
                  className="user-avatar"
                  style={{ fontSize: '32px' }}
                  onClick={navigateToProfile}
                />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="dashboard-content">
        <div className="content-header d-flex justify-content-between align-items-center">
          <h1>
            {activeTab === 'discover'
              ? 'Discover People'
              : activeTab === 'matches'
              ? 'Your Matches'
              : 'Messages'}
          </h1>
          <div className="content-actions d-flex align-items-center">
            <div className="filter-button d-none d-md-flex" onClick={() => setShowFilters(!showFilters)}>
              <FaFilter />
              <span>Filters</span>
            </div>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="filter-panel">
            <div className="filter-section">
              <h3>Age Range</h3>
              <div className="filter-options">
                <label>Min: {filterValues.ageMin}</label>
                <input
                  type="range"
                  min="0"
                  max="150"
                  value={filterValues.ageMin}
                  onChange={(e) =>
                    setFilterValues({ ...filterValues, ageMin: parseInt(e.target.value) })
                  }
                />
                <label>Max: {filterValues.ageMax}</label>
                <input
                  type="range"
                  min="0"
                  max="150"
                  value={filterValues.ageMax}
                  onChange={(e) =>
                    setFilterValues({ ...filterValues, ageMax: parseInt(e.target.value) })
                  }
                />
              </div>
            </div>

            <div className="filter-section">
              <h3>Distance</h3>
              <div className="filter-options">
                <label>{filterValues.distance} km</label>
                <input
                  type="range"
                  min="5"
                  max="100"
                  value={filterValues.distance}
                  onChange={(e) =>
                    setFilterValues({ ...filterValues, distance: parseInt(e.target.value) })
                  }
                />
              </div>
            </div>

            <div className="filter-section">
              <h3>Show Only</h3>
              <div className="filter-options d-flex flex-column">
                <label className="filter-option">
                  <input
                    type="checkbox"
                    checked={filterValues.online}
                    onChange={() => setFilterValues({ ...filterValues, online: !filterValues.online })}
                  />
                  <span>Online Now</span>
                </label>
                <label className="filter-option">
                  <input
                    type="checkbox"
                    checked={filterValues.verified}
                    onChange={() =>
                      setFilterValues({ ...filterValues, verified: !filterValues.verified })
                    }
                  />
                  <span>Verified Profiles</span>
                </label>
                <label className="filter-option">
                  <input
                    type="checkbox"
                    checked={filterValues.withPhotos}
                    onChange={() =>
                      setFilterValues({ ...filterValues, withPhotos: !filterValues.withPhotos })
                    }
                  />
                  <span>With Photos</span>
                </label>
              </div>
            </div>

            <div className="filter-section">
              <h3>Interests</h3>
              <div className="tags-container">
                {availableInterests.map((interest) => (
                  <button
                    key={interest}
                    className={`filter-tag ${filterValues.interests.includes(interest) ? 'active' : ''}`}
                    onClick={() => toggleInterest(interest)}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-actions">
              <button
                className="btn btn-outline"
                onClick={() =>
                  setFilterValues({
                    ageMin: 0,
                    ageMax: 150,
                    distance: 100,
                    online: false,
                    verified: false,
                    withPhotos: false,
                    interests: []
                  })
                }
              >
                Reset
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setShowFilters(false)}
              >
                Apply
              </button>
            </div>
          </div>
        )}

        {/* Users Grid */}
        <div className="users-grid mt-4" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
          gap: '24px'
        }}>
          {loading ? (
            <div className="loading-container">
              <div className="spinner spinner-dark"></div>
              <p className="loading-text">Loading users...</p>
            </div>
          ) : sortedUsers.length > 0 ? (
            sortedUsers.map(matchedUser => (
              <div
                key={matchedUser._id}
                className="user-card"
                onClick={() => navigateToUserProfile(matchedUser._id)}
              >
                <div className="user-card-photo" style={{ position: 'relative', height: '280px', overflow: 'hidden' }}>
                  {matchedUser.photos && matchedUser.photos.length > 0 ? (
                    <img
                      src={matchedUser.photos[0].url}
                      alt={matchedUser.nickname}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease' }}
                    />
                  ) : (
                    <FaUserCircle style={{ fontSize: '80px', color: '#ccc', margin: '50px auto' }} />
                  )}
                  {matchedUser.isOnline && (
                    <div className="online-indicator" style={{
                      position: 'absolute',
                      top: '16px',
                      right: '16px',
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--success)',
                      border: '2px solid var(--white)'
                    }}></div>
                  )}
                </div>
                <div className="user-card-info" style={{ padding: '16px' }}>
                  <h3 style={{ fontSize: '1.125rem', marginBottom: '8px', color: 'var(--text-dark)' }}>
                    {matchedUser.nickname}, {matchedUser.details?.age || '?'}
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-light)' }}>
                    {matchedUser.details?.location || 'Unknown location'}
                  </p>
                  <div className="user-actions" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto' }}>
                    <button
                      className="card-action-button like"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: '48%',
                        padding: '8px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--light)',
                        color: 'var(--text-medium)',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <FaHeart />
                    </button>
                    <button
                      className="card-action-button message"
                      onClick={(e) => { e.stopPropagation(); navigateToMessages(); }}
                      style={{
                        width: '48%',
                        padding: '8px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--light)',
                        color: 'var(--text-medium)',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <FaComments />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="loading-container">
              <p>No users found.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
