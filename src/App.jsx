// src/App.jsx
import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';

function App() {
  const [stealthMode, setStealthMode] = useState(false);
  const location = useLocation();

  // Determine the active tab based on the current pathname.
  const path = location.pathname;
  let activeTab = '';
  if (path.startsWith('/discover')) activeTab = 'discover';
  else if (path.startsWith('/map')) activeTab = 'map';
  else if (path.startsWith('/matches')) activeTab = 'matches';
  else if (path.startsWith('/messages')) activeTab = 'messages';
  else if (path.startsWith('/stories')) activeTab = 'stories';
  else if (path.startsWith('/profile')) activeTab = 'profile';

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="app-logo">
          <h1 className="app-title">ConnectX</h1>
          <span className="premium-badge">Premium</span>
        </div>
        <div className="header-actions">
          <button
            className="btn btn-icon"
            onClick={() => setStealthMode(!stealthMode)}
            aria-label="Toggle stealth mode"
          >
            {stealthMode ? <span>👁️‍🗨️</span> : <span>👁️</span>}
          </button>
          <button className="btn btn-icon relative" aria-label="Notifications">
            <span>🔔</span>
            <span className="badge">3</span>
          </button>
        </div>
      </header>

      {/* Main content rendered via routing */}
      <main className="main">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="nav">
        <ul className="nav-list">
          <li className="nav-item">
            <Link
              to="/discover"
              className={`nav-link ${activeTab === 'discover' ? 'active' : ''}`}
            >
              <span>🔍</span>
              <span className="nav-link-text">Discover</span>
            </Link>
          </li>
          <li className="nav-item">
            <Link
              to="/map"
              className={`nav-link ${activeTab === 'map' ? 'active' : ''}`}
            >
              <span>🗺️</span>
              <span className="nav-link-text">Map</span>
            </Link>
          </li>
          <li className="nav-item">
            <Link
              to="/matches"
              className={`nav-link ${activeTab === 'matches' ? 'active' : ''}`}
            >
              <span>❤️</span>
              <span className="nav-link-text">Matches</span>
            </Link>
          </li>
          <li className="nav-item">
            <Link
              to="/messages"
              className={`nav-link ${activeTab === 'messages' ? 'active' : ''}`}
            >
              <span>💬</span>
              <span className="badge">5</span>
              <span className="nav-link-text">Chats</span>
            </Link>
          </li>
          <li className="nav-item">
            <Link
              to="/stories"
              className={`nav-link ${activeTab === 'stories' ? 'active' : ''}`}
            >
              <span>📷</span>
              <span className="nav-link-text">Stories</span>
            </Link>
          </li>
          <li className="nav-item">
            <Link
              to="/profile"
              className={`nav-link ${activeTab === 'profile' ? 'active' : ''}`}
            >
              <span>👤</span>
              <span className="nav-link-text">Profile</span>
            </Link>
          </li>
        </ul>
      </nav>

      {/* Stealth Mode Indicator */}
      {stealthMode && (
        <div className="stealth-mode-indicator">
          <div className="stealth-mode-header">
            <span className="stealth-mode-icon">🛡️</span>
            <span className="stealth-mode-text">Stealth Mode Active</span>
          </div>
          <p className="stealth-mode-description">
            Your profile is hidden from other users
          </p>
        </div>
      )}
    </div>
  );
}

export default App;
