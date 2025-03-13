import React, { useState, useEffect } from 'react';
import { FaSearch, FaFilter, FaHeart, FaComments, FaBell, FaUserCircle, FaMapMarkerAlt, FaEllipsisH, FaChevronDown, FaSlidersH } from 'react-icons/fa';
import { useAuth, useUser } from '../context';

const Dashboard = () => {
  const { user } = useAuth();
  const { users, getUsers, loading } = useUser();
  const [activeTab, setActiveTab] = useState('discover');
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({
    ageMin: 18,
    ageMax: 50,
    distance: 50,
    online: true,
    verified: false,
    withPhotos: true,
    interests: []
  });
  const [sortBy, setSortBy] = useState('lastActive');

  // Fetch users on component mount
  useEffect(() => {
    getUsers();
  }, []);

  // Available interests for filtering
  const availableInterests = [
    'Dating', 'Casual', 'Friendship', 'Long-term', 'Travel',
    'Outdoors', 'Movies', 'Music', 'Fitness', 'Food', 'Art'
  ];

  // Toggle an interest in the filter
  const toggleInterest = (interest) => {
    setFilterValues(prev => {
      if (prev.interests.includes(interest)) {
        return { ...prev, interests: prev.interests.filter(i => i !== interest) };
      } else {
        return { ...prev, interests: [...prev.interests, interest] };
      }
    });
  };

  // Apply filters to users
  const filteredUsers = users.filter(user => {
    // Age filter
    const userAge = user.details?.age || 25;
    if (userAge < filterValues.ageMin || userAge > filterValues.ageMax) {
      return false;
    }

    // Online status filter
    if (filterValues.online && !user.isOnline) {
      return false;
    }

    // Photos filter
    if (filterValues.withPhotos && (!user.photos || user.photos.length === 0)) {
      return false;
    }

    // Interests filter (if any selected)
    if (filterValues.interests.length > 0) {
      const userInterests = user.details?.interests || [];
      const hasMatchingInterest = filterValues.interests.some(interest =>
        userInterests.includes(interest)
      );
      if (!hasMatchingInterest) {
        return false;
      }
    }

    return true;
  });

  // Sort filtered users
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    switch (sortBy) {
      case 'lastActive':
        return new Date(b.lastActive) - new Date(a.lastActive);
      case 'newest':
        return new Date(b.createdAt) - new Date(a.createdAt);
      case 'distance':
        // In a real app, this would use geolocation
        return 0;
      default:
        return 0;
    }
  });

  return (
    <div className="dashboard-page">
      {/* Modern App Header */}
      <header className="app-header">
        <div className="container header-container">
          <div className="header-left">
            <div className="logo">Mandarin</div>
          </div>

          <nav className="main-navigation">
            <button
              className={`nav-tab ${activeTab === 'discover' ? 'active' : ''}`}
              onClick={() => setActiveTab('discover')}
            >
              <span className="tab-icon"><FaSearch /></span>
              <span className="tab-text">Discover</span>
            </button>
            <button
              className={`nav-tab ${activeTab === 'matches' ? 'active' : ''}`}
              onClick={() => setActiveTab('matches')}
            >
              <span className="tab-icon"><FaHeart /></span>
              <span className="tab-text">Matches</span>
            </button>
            <button
              className={`nav-tab ${activeTab === 'messages' ? 'active' : ''}`}
              onClick={() => setActiveTab('messages')}
            >
              <span className="tab-icon"><FaComments /></span>
              <span className="tab-text">Messages</span>
              <span className="badge">3</span>
            </button>
          </nav>

          <div className="header-right">
            <button className="icon-button notification-button">
              <FaBell />
              <span className="badge">2</span>
            </button>
            <div className="user-menu">
              <button className="user-menu-button">
                {user.photos && user.photos.length > 0 ? (
                  <img src={user.photos[0].url} alt={user.nickname} className="avatar" />
                ) : (
                  <FaUserCircle className="avatar-placeholder" />
                )}
                <span className="user-name">{user.nickname}</span>
                <FaChevronDown className="dropdown-icon" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-content">
        <div className="container">
          {/* Page Header with Title and Actions */}
          <div className="page-header">
            <h1>{activeTab === 'discover' ? 'Discover People' :
                activeTab === 'matches' ? 'Your Matches' : 'Conversations'}</h1>

            <div className="page-actions">
              <div className="search-bar">
                <FaSearch className="search-icon" />
                <input type="text" placeholder="Search by name or interest..." />
              </div>

              <div className="filter-sort-actions">
                <button
                  className={`filter-button ${showFilters ? 'active' : ''}`}
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <FaFilter />
                  <span>Filters</span>
                </button>

                <div className="sort-dropdown">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="lastActive">Recently Active</option>
                    <option value="newest">Newest Members</option>
                    <option value="distance">Distance</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="filters-panel">
              <div className="filters-content">
                <div className="filter-section">
                  <h3>Age Range</h3>
                  <div className="range-slider">
                    <div className="range-labels">
                      <span>{filterValues.ageMin}</span>
                      <span>{filterValues.ageMax}</span>
                    </div>
                    <div className="slider-controls">
                      <input
                        type="range"
                        min="18"
                        max="80"
                        value={filterValues.ageMin}
                        onChange={(e) => setFilterValues({...filterValues, ageMin: parseInt(e.target.value)})}
                      />
                      <input
                        type="range"
                        min="18"
                        max="80"
                        value={filterValues.ageMax}
                        onChange={(e) => setFilterValues({...filterValues, ageMax: parseInt(e.target.value)})}
                      />
                    </div>
                  </div>
                </div>

                <div className="filter-section">
                  <h3>Distance</h3>
                  <div className="distance-slider">
                    <input
                      type="range"
                      min="5"
                      max="100"
                      value={filterValues.distance}
                      onChange={(e) => setFilterValues({...filterValues, distance: parseInt(e.target.value)})}
                    />
                    <span className="distance-value">{filterValues.distance} km</span>
                  </div>
                </div>

                <div className="filter-section">
                  <h3>Show Only</h3>
                  <div className="filter-checkboxes">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={filterValues.online}
                        onChange={() => setFilterValues({...filterValues, online: !filterValues.online})}
                      />
                      <span>Online Now</span>
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={filterValues.verified}
                        onChange={() => setFilterValues({...filterValues, verified: !filterValues.verified})}
                      />
                      <span>Verified Profiles</span>
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={filterValues.withPhotos}
                        onChange={() => setFilterValues({...filterValues, withPhotos: !filterValues.withPhotos})}
                      />
                      <span>With Photos</span>
                    </label>
                  </div>
                </div>

                <div className="filter-section">
                  <h3>Interests</h3>
                  <div className="interests-tags">
                    {availableInterests.map(interest => (
                      <button
                        key={interest}
                        className={`interest-tag ${filterValues.interests.includes(interest) ? 'active' : ''}`}
                        onClick={() => toggleInterest(interest)}
                      >
                        {interest}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="filters-footer">
                <button
                  className="btn btn-outline"
                  onClick={() => setFilterValues({
                    ageMin: 18,
                    ageMax: 50,
                    distance: 50,
                    online: true,
                    verified: false,
                    withPhotos: true,
                    interests: []
                  })}
                >
                  Reset Filters
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowFilters(false)}
                >
                  Apply Filters
                </button>
              </div>
            </div>
          )}

          {/* User Grid */}
          {activeTab === 'discover' && (
            <div className="users-grid">
              {loading ? (
                <div className="loading-indicator">
                  <div className="spinner"></div>
                  <p>Loading potential matches...</p>
                </div>
              ) : sortedUsers.length > 0 ? (
                sortedUsers.map(user => (
                  <div key={user._id} className="user-card">
                    <div className="user-card-photo">
                      {user.photos && user.photos.length > 0 ? (
                        <img src={user.photos[0].url} alt={user.nickname} />
                      ) : (
                        <div className="no-photo">
                          <FaUserCircle />
                        </div>
                      )}
                      {user.isOnline && <div className="online-indicator"></div>}
                      <button className="quick-like">
                        <FaHeart />
                      </button>
                    </div>
                    <div className="user-card-content">
                      <div className="user-info">
                        <h3>{user.nickname}, {user.details?.age || '?'}</h3>
                        <p className="user-location">
                          <FaMapMarkerAlt />
                          <span>{user.details?.location || 'Unknown location'}</span>
                        </p>
                      </div>
                      <div className="user-interests">
                        {user.details?.interests?.slice(0, 3).map(interest => (
                          <span key={interest} className="interest-badge">{interest}</span>
                        ))}
                        {user.details?.interests?.length > 3 && (
                          <span className="more-interests">+{user.details.interests.length - 3}</span>
                        )}
                      </div>
                      <div className="user-actions">
                        <button className="btn btn-outline btn-like">
                          <FaHeart />
                          <span>Like</span>
                        </button>
                        <button className="btn btn-primary btn-message">
                          <FaComments />
                          <span>Message</span>
                        </button>
                        <button className="action-options">
                          <FaEllipsisH />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-results">
                  <div className="no-results-icon">🔍</div>
                  <h3>No matches found</h3>
                  <p>Try adjusting your filters or broadening your search criteria.</p>
                  <button className="btn btn-primary" onClick={() => setShowFilters(true)}>
                    <FaSlidersH />
                    <span>Adjust Filters</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Matches Tab Content */}
          {activeTab === 'matches' && (
            <div className="matches-content">
              <div className="matches-grid">
                {/* This would show mutual matches */}
                <div className="no-results">
                  <div className="no-results-icon">❤️</div>
                  <h3>No matches yet</h3>
                  <p>Start liking profiles to create matches. When someone likes you back, they'll appear here.</p>
                  <button
                    className="btn btn-primary"
                    onClick={() => setActiveTab('discover')}
                  >
                    Discover People
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Messages Tab Content */}
          {activeTab === 'messages' && (
            <div className="messages-layout">
              <div className="conversations-list">
                <div className="conversations-header">
                  <h3>Messages</h3>
                  <button className="btn-icon">
                    <FaEllipsisH />
                  </button>
                </div>

                <div className="empty-state">
                  <div className="empty-state-icon">💌</div>
                  <h3>No conversations yet</h3>
                  <p>When you start chatting with someone, they'll appear here.</p>
                </div>
              </div>

              <div className="chat-placeholder">
                <div className="chat-placeholder-icon">
                  <FaComments />
                </div>
                <h3>Select a conversation</h3>
                <p>Choose a conversation from the list or start a new one by messaging someone.</p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Mobile Navigation */}
      <nav className="mobile-nav">
        <button
          className={`mobile-nav-item ${activeTab === 'discover' ? 'active' : ''}`}
          onClick={() => setActiveTab('discover')}
        >
          <FaSearch />
          <span>Discover</span>
        </button>
        <button
          className={`mobile-nav-item ${activeTab === 'matches' ? 'active' : ''}`}
          onClick={() => setActiveTab('matches')}
        >
          <FaHeart />
          <span>Matches</span>
        </button>
        <button
          className={`mobile-nav-item ${activeTab === 'messages' ? 'active' : ''}`}
          onClick={() => setActiveTab('messages')}
        >
          <FaComments />
          <span>Messages</span>
          <span className="mobile-badge">3</span>
        </button>
        <button className="mobile-nav-item">
          <FaUserCircle />
          <span>Profile</span>
        </button>
      </nav>
    </div>
  );
};

export default Dashboard;
