// src/pages/Discovery/DiscoverPage.jsx

import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter } from 'lucide-react';

// Components
import ErrorBoundary from '../../components/common/ErrorBoundary';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Header from '../../components/layout/Header';
import Navigation from '../../components/layout/Navigation';
import DiscoverGrid from '../../components/screens/DiscoverGrid';
import ReportModal from '../../components/moderation/ReportModal';
import IcebreakerModal from '../../components/icebreakers/IcebreakerModal';

// Services
import { userService } from '../../services/userService';
import { moderationService } from '../../services/moderationService';

// Context (assuming you have this context set up)
import { AppContext } from '../../context/AppContext';

// Config
import { DEFAULT_SEARCH_RADIUS, REPORT_REASONS } from '../../config/constants';

function DiscoverPage() {
  const [users, setUsers] = useState([]);
  const [searchRadius, setSearchRadius] = useState(DEFAULT_SEARCH_RADIUS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter panel
  const [filterOpen, setFilterOpen] = useState(false);

  // Modals
  const [selectedUser, setSelectedUser] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [showIcebreaker, setShowIcebreaker] = useState(false);

  // Context
  const { stealthMode, toggleStealthMode } = useContext(AppContext);

  // Navigation
  const navigate = useNavigate();

  // ========= Fetch Recommended Users =========
  useEffect(() => {
    async function fetchRecommended() {
      try {
        setLoading(true);
        // e.g. fetch recommended users based on some criteria
        const recommended = await userService.getRecommendedUsers({ distance: searchRadius });
        setUsers(recommended);
        setError(null);
      } catch (err) {
        console.error('Error fetching users:', err);
        setError('Failed to load users. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    fetchRecommended();
  }, [searchRadius]);

  // ========= Handlers =========
  const handleReportUser = (user) => {
    setSelectedUser(user);
    setShowReport(true);
  };

  const handleSendIcebreaker = (user) => {
    setSelectedUser(user);
    setShowIcebreaker(true);
  };

  const handleSubmitReport = async (reportData) => {
    if (!selectedUser) return;
    try {
      await moderationService.reportUser(selectedUser.id, reportData);
      console.log('Report submitted successfully!');
      // Close the modal or display success message
    } catch (err) {
      console.error('Error submitting report:', err);
    }
  };

  // Filter logic (distance, etc.)
  const handleFilterToggle = () => {
    setFilterOpen(!filterOpen);
  };

  const handleApplyFilters = () => {
    // Could add more advanced filtering logic if needed
    setFilterOpen(false);
  };

  return (
    <div className="app-container">
      {/* Top Header */}
      <ErrorBoundary>
        <Header
          appTitle="MandarinApp"
          showPremiumBadge={true}
          stealthMode={stealthMode}
          toggleStealthMode={toggleStealthMode}
          notificationsCount={3}
        />
      </ErrorBoundary>

      <main className="main">
        {/* Page Title and Actions */}
        <div className="section-header">
          <h2 className="section-title">Discover</h2>
          <div className="flex space-x-2">
            {/* Filter Button */}
            <button
              className="btn btn-secondary flex items-center"
              onClick={handleFilterToggle}
            >
              <Filter size={16} className="mr-1" />
              <span className="text-sm">Filters</span>
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        {filterOpen && (
          <div className="filter-panel">
            <h3 className="filter-title">Filter Options</h3>
            <div className="filter-grid">
              <div className="filter-item">
                <label htmlFor="distance">Distance</label>
                <select
                  id="distance"
                  className="filter-select"
                  onChange={(e) => setSearchRadius(Number(e.target.value))}
                  value={searchRadius}
                >
                  <option value="5">5 miles</option>
                  <option value="10">10 miles</option>
                  <option value="25">25 miles</option>
                  <option value="50">50 miles</option>
                </select>
              </div>
              {/* Add more filter controls as needed */}
            </div>

            <div className="filter-actions">
              <button className="btn btn-primary" onClick={handleApplyFilters}>
                Apply Filters
              </button>
            </div>
          </div>
        )}

        {/* Main Content: Grid of Users */}
        {loading ? (
          <div className="flex justify-center py-10">
            <LoadingSpinner size={40} color="var(--color-primary)" />
          </div>
        ) : error ? (
          <div className="p-4 text-center">
            <p className="text-red-500">{error}</p>
            <button
              className="btn btn-primary mt-2"
              onClick={() => window.location.reload()}
            >
              Try Again
            </button>
          </div>
        ) : (
          <ErrorBoundary>
            <DiscoverGrid
              users={users}
              onReportUser={handleReportUser}
              onSendIcebreaker={handleSendIcebreaker}
            />
          </ErrorBoundary>
        )}
      </main>

      {/* Bottom Navigation */}
      <ErrorBoundary>
        <Navigation
          activeTab="discover"           // or "map" if you want to highlight map
          onTabChange={(tab) => navigate(`/${tab}`)}
          chatCount={5}
        />
      </ErrorBoundary>

      {/* Modals */}
      {showReport && selectedUser && (
        <ReportModal
          isOpen={showReport}
          onClose={() => setShowReport(false)}
          userName={selectedUser.name}
          onSubmitReport={handleSubmitReport}
          reasons={Object.values(REPORT_REASONS)}
        />
      )}

      {showIcebreaker && selectedUser && (
        <IcebreakerModal
          isOpen={showIcebreaker}
          onClose={() => setShowIcebreaker(false)}
          onSendQuestion={(question) => {
            console.log(`Sending icebreaker to ${selectedUser.name}: ${question}`);
            // Possibly call chat service or userService
            setShowIcebreaker(false);
          }}
        />
      )}

      {/* Stealth Mode Overlay */}
      {stealthMode && (
        <div className="stealth-mode-indicator">
          <div className="stealth-mode-header">
            <span className="stealth-mode-icon">🛡️</span>
            <span className="stealth-mode-text">Stealth Mode Active</span>
          </div>
          <p className="stealth-mode-description">Your profile is hidden from other users</p>
        </div>
      )}
    </div>
  );
}

export default DiscoverPage;
