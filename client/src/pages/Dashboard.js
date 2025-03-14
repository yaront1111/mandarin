// client/src/pages/Dashboard.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaSearch,
  FaFilter,
  FaHeart,
  FaComments,
  FaBell,
  FaUserCircle,
  FaTimes
} from 'react-icons/fa';
import { useAuth, useUser, useChat } from '../context';
import EmbeddedChat from '../components/EmbeddedChat';
import { toast } from 'react-toastify';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { users, getUsers, loading } = useUser();
  const { unreadMessages } = useChat();

  const [activeTab, setActiveTab] = useState('discover');
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({
    ageMin: 18,
    ageMax: 99,
    distance: 100,
    online: false,
    verified: false,
    withPhotos: false,
    interests: []
  });

  // New state for chat functionality
  const [chatUser, setChatUser] = useState(null);
  const [showChat, setShowChat] = useState(false);

  // Fetch users on mount and set up periodic refresh
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

    // Cleanup on unmount
    return () => {
      clearInterval(refreshInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [getUsers]);

  // Filter users based on filterValues
  const filteredUsers = users.filter(u => {
    // Don't show current user
    if (u._id === user?._id) return false;

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

  // Custom sorting: online users first, then by lastActive descending
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

  const handleMessageUser = (e, user) => {
    e.stopPropagation(); // Prevent card click navigation
    setChatUser(user);
    setShowChat(true);
  };

  const closeChat = () => {
    setShowChat(false);
    setChatUser(null);
  };

  const navigateToProfile = () => {
    navigate('/profile');
  };

  // Check if a user has unread messages - with proper null/undefined checks
  const hasUnreadMessages = (userId) => {
    return Array.isArray(unreadMessages) &&
           unreadMessages.some(msg => msg.sender === userId);
  };

  // Count unread messages for a user - with proper null/undefined checks
  const unreadCount = (userId) => {
    return Array.isArray(unreadMessages)
           ? unreadMessages.filter(msg => msg.sender === userId).length
           : 0;
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
          </div>
          <div className="header-actions d-flex align-items-center">
            <button className="header-action-button">
              <FaBell />
              {unreadMessages && unreadMessages.length > 0 && (
                <span className="notification-badge">{unreadMessages.length}</span>
              )}
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
              : 'Your Matches'}
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
                  min="18"
                  max="99"
                  value={filterValues.ageMin}
                  onChange={(e) =>
                    setFilterValues({ ...filterValues, ageMin: parseInt(e.target.value) })
                  }
                />
                <label>Max: {filterValues.ageMax}</label>
                <input
                  type="range"
                  min="18"
                  max="99"
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
                    ageMin: 18,
                    ageMax: 99,
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
        <div className="users-grid mt-4">
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
                <div className="user-card-photo">
                  {matchedUser.photos && matchedUser.photos.length > 0 ? (
                    <img
                      src={matchedUser.photos[0].url}
                      alt={matchedUser.nickname}
                    />
                  ) : (
                    <FaUserCircle className="avatar-placeholder" />
                  )}
                  {matchedUser.isOnline && (
                    <div className="online-indicator"></div>
                  )}
                </div>
                <div className="user-card-info">
                  <div className="d-flex justify-content-between align-items-center">
                    <h3>
                      {matchedUser.nickname}, {matchedUser.details?.age || '?'}
                    </h3>
                    {hasUnreadMessages(matchedUser._id) && (
                      <span className="unread-badge">{unreadCount(matchedUser._id)}</span>
                    )}
                  </div>
                  <p>{matchedUser.details?.location || 'Unknown location'}</p>

                  {/* We replace the dual action buttons with a single chat button */}
                  <button
                    className="user-card-chat-btn"
                    onClick={(e) => handleMessageUser(e, matchedUser)}
                  >
                    <FaComments /> Chat Now
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="no-results">
              <p>No users found matching your criteria.</p>
              <button
                className="btn btn-primary mt-2"
                onClick={() => {
                  setFilterValues({
                    ageMin: 18,
                    ageMax: 99,
                    distance: 100,
                    online: false,
                    verified: false,
                    withPhotos: false,
                    interests: []
                  });
                }}
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Embedded Chat */}
      {showChat && chatUser && (
        <>
          <div className="chat-overlay" onClick={closeChat}></div>
          <EmbeddedChat
            recipient={chatUser}
            isOpen={showChat}
            onClose={closeChat}
          />
        </>
      )}
    </div>
  );
};

export default Dashboard;
