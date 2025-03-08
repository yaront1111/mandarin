// src/pages/Discovery/MapDiscovery.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// Import icons from lucide-react (or wherever you're storing icons)
import { Filter } from 'lucide-react';

// Components
import ErrorBoundary from '../../components/common/ErrorBoundary';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Header from '../../components/layout/Header';
import Navigation from '../../components/layout/Navigation';
import MapView from '../../components/mapDiscovery/MapView';
import DiscoverGrid from '../../components/screens/DiscoverGrid';
import ReportModal from '../../components/moderation/ReportModal';
import IcebreakerModal from '../../components/icebreakers/IcebreakerModal';

// Services
import { mapService } from '../../services/mapService';
import { userService } from '../../services/userService';
import { moderationService } from '../../services/moderationService';

// Context (assuming you have a custom hook like useAppContext)
import { AppContext } from '../../context/AppContext';

// Config
import { DEFAULT_SEARCH_RADIUS, REPORT_REASONS } from '../../config/constants';

function MapDiscoveryPage() {
  // State
  const [viewMode, setViewMode] = useState('grid');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [mapPins, setMapPins] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [showIcebreaker, setShowIcebreaker] = useState(false);
  const [location, setLocation] = useState(null);
  const [searchRadius, setSearchRadius] = useState(DEFAULT_SEARCH_RADIUS);

  // Context & Navigation
  const { stealthMode, toggleStealthMode } = React.useContext(AppContext);
  const navigate = useNavigate();

  // ========= Fetch Users =========
  useEffect(() => {
    async function fetchUsers() {
      try {
        setLoading(true);
        let userData = [];

        // If in map view AND we have a location, use mapService
        if (viewMode === 'map' && location) {
          userData = await mapService.getNearbyUsers(
            location.latitude,
            location.longitude,
            searchRadius
          );
          // Convert user data to pin format
          const pins = userData.map(user => ({
            id: user.id,
            label: user.name.charAt(0).toUpperCase(),
            top: `${Math.random() * 80 + 10}%`,   // (Demo) random placement
            left: `${Math.random() * 80 + 10}%`,
            user,
          }));
          setMapPins(pins);
        } else {
          // Otherwise, get recommended users for grid view
          userData = await userService.getRecommendedUsers({ distance: searchRadius });
        }

        setUsers(userData);
        setError(null);
      } catch (err) {
        console.error('Error fetching users:', err);
        setError('Failed to load users. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    // If map view is selected but we don't yet have a location, request it
    if (viewMode === 'map' && !location) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
        (geoErr) => {
          console.error('Location error:', geoErr);
          setError('Please enable location services to use map view.');
        }
      );
    }

    fetchUsers();
  }, [viewMode, location, searchRadius]);

  // ========= Handlers =========
  const handleReportUser = (user) => {
    setSelectedUser(user);
    setShowReport(true);
  };

  const handleSendIcebreaker = (user) => {
    setSelectedUser(user);
    setShowIcebreaker(true);
  };

  const handlePinClick = (pin) => {
    // On pin click, you could open a detail modal or just navigate
    setSelectedUser(pin.user);
    // For example, go to their profile:
    navigate(`/profiles/${pin.user.id}`);
  };

  // Filter
  const handleFilter = () => {
    setFilterOpen(false);
    // You might do more advanced filters here
  };

  // Submit a report (calls moderationService, not userService!)
  const handleSubmitReport = async (reportData) => {
    if (!selectedUser) return;
    try {
      await moderationService.reportUser(selectedUser.id, reportData);
      // Show success or handle UI feedback
      console.log('Report submitted successfully!');
    } catch (err) {
      console.error('Error submitting report:', err);
    }
  };

  // ========= Render =========
  return (
    <div className="app-container">
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
        {/* Section Header */}
        <div className="section-header">
          <h2 className="section-title">Discover</h2>
          <div className="flex space-x-2">
            <button
              className="btn btn-secondary flex items-center"
              onClick={() => setFilterOpen(!filterOpen)}
            >
              <Filter size={16} className="mr-1" />
              <span className="text-sm">Filters</span>
            </button>
            <div className="view-toggle">
              <button
                className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
              >
                Grid
              </button>
              <button
                className={`view-toggle-btn ${viewMode === 'map' ? 'active' : ''}`}
                onClick={() => setViewMode('map')}
              >
                Map
              </button>
            </div>
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
              <div className="filter-item">
                <label htmlFor="compatibility">Compatibility</label>
                <select id="compatibility" className="filter-select">
                  <option>Any</option>
                  <option>50%+</option>
                  <option>75%+</option>
                  <option>90%+</option>
                </select>
              </div>
              {/* Other filters can go here */}
            </div>
            <div className="filter-actions">
              <button
                className="btn btn-primary"
                onClick={handleFilter}
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}

        {/* Main Content */}
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
        ) : viewMode === 'grid' ? (
          <ErrorBoundary>
            <DiscoverGrid
              users={users}
              onReportUser={handleReportUser}
              onSendIcebreaker={handleSendIcebreaker}
            />
          </ErrorBoundary>
        ) : (
          <ErrorBoundary>
            <MapView
              mapImageUrl="/images/map-placeholder.jpg"
              pins={mapPins}
              onPinClick={handlePinClick}
            />
          </ErrorBoundary>
        )}
      </main>

      {/* Bottom Navigation */}
      <ErrorBoundary>
        <Navigation
          activeTab="discover"
          onTabChange={(tab) => navigate(`/${tab}`)}
          chatCount={5}
        />
      </ErrorBoundary>

      {/* Report Modal */}
      {showReport && selectedUser && (
        <ReportModal
          isOpen={showReport}
          onClose={() => setShowReport(false)}
          userName={selectedUser?.name}
          onSubmitReport={handleSubmitReport}
          reasons={Object.values(REPORT_REASONS)}
        />
      )}

      {/* Icebreaker Modal */}
      {showIcebreaker && selectedUser && (
        <IcebreakerModal
          isOpen={showIcebreaker}
          onClose={() => setShowIcebreaker(false)}
          onSendQuestion={(question) => {
            console.log(`Sending icebreaker to ${selectedUser?.name}: ${question}`);
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

export default MapDiscoveryPage;
