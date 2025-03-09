// src/pages/DashboardPage.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import MainLayout from '../components/layouts/MainLayout';
import matchService from '../services/matchService';
import photoService from '../services/photoService';

const DashboardPage = () => {
  const { user } = useSelector((state) => state.auth);

  const [matches, setMatches] = useState([]);
  const [stats, setStats] = useState({
    viewCount: 0,
    likeCount: 0,
    matchCount: 0,
    messageCount: 0,
  });
  const [photos, setPhotos] = useState([]);
  const [photoRequests, setPhotoRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        // For now, implement fallbacks for API methods that might not exist yet
        let matchesResponse = [];
        let photosResponse = [];
        let statsResponse = {
          viewCount: 0,
          likeCount: 0,
          matchCount: 0,
          messageCount: 0,
        };
        let requestsResponse = [];

        // Attempt to fetch data - use try/catch for each call to prevent one failure from affecting others
        try {
          matchesResponse = await matchService.getMutualMatches({ limit: 5 });
        } catch (err) {
          console.log('getMutualMatches not implemented yet');
        }

        try {
          photosResponse = await photoService.getUserPhotos();
        } catch (err) {
          console.log('getUserPhotos not implemented yet');
        }

        try {
          statsResponse = await matchService.getUserStats();
        } catch (err) {
          console.log('getUserStats not implemented yet');
        }

        try {
          requestsResponse = await photoService.getPhotoAccessRequests();
        } catch (err) {
          console.log('getPhotoAccessRequests not implemented yet');
        }

        setMatches(matchesResponse);
        setPhotos(photosResponse);
        setStats(statsResponse);
        setPhotoRequests(requestsResponse);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const handleAcceptPhotoRequest = async (requestId) => {
    try {
      await photoService.grantPhotoAccess(requestId);
      // Remove the request from the list by its 'id'
      setPhotoRequests((prev) => prev.filter((req) => req.id !== requestId));
    } catch (err) {
      console.error('Error accepting photo request:', err);
    }
  };

  const handleRejectPhotoRequest = async (requestId) => {
    try {
      await photoService.rejectPhotoAccess(requestId);
      // Remove the request from the list by its 'id'
      setPhotoRequests((prev) => prev.filter((req) => req.id !== requestId));
    } catch (err) {
      console.error('Error rejecting photo request:', err);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-12 h-12 rounded-full border-4 border-brand-pink border-t-transparent animate-spin"></div>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen p-6">
          <div className="bg-error bg-opacity-10 text-error p-6 rounded-lg max-w-md text-center">
            <p className="mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-error text-white rounded-md hover:bg-opacity-90"
            >
              Retry
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 py-6 mb-24">

        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary">
            Welcome back, {user?.firstName || 'there'}!
          </h1>
          <p className="text-text-secondary">
            Here&apos;s what&apos;s happening with your profile today.
          </p>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-bg-card p-4 rounded-lg">
            <p className="text-text-secondary text-sm">Profile Views</p>
            <p className="text-2xl font-bold text-brand-pink">{stats.viewCount}</p>
          </div>
          <div className="bg-bg-card p-4 rounded-lg">
            <p className="text-text-secondary text-sm">Likes Received</p>
            <p className="text-2xl font-bold text-brand-pink">{stats.likeCount}</p>
          </div>
          <div className="bg-bg-card p-4 rounded-lg">
            <p className="text-text-secondary text-sm">Matches</p>
            <p className="text-2xl font-bold text-brand-pink">{stats.matchCount}</p>
          </div>
          <div className="bg-bg-card p-4 rounded-lg">
            <p className="text-text-secondary text-sm">Messages</p>
            <p className="text-2xl font-bold text-brand-pink">{stats.messageCount}</p>
          </div>
        </div>

        {/* Photos Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-text-primary">Your Photos</h2>
            <Link to="/profile" className="text-brand-pink text-sm">
              Manage Photos
            </Link>
          </div>

          {photos.length === 0 ? (
            <div className="bg-bg-card p-6 rounded-lg text-center">
              <p className="text-text-secondary mb-4">
                You haven&apos;t added any photos yet. Add photos to increase your chances of getting matches!
              </p>
              <Link
                to="/profile"
                className="px-4 py-2 bg-brand-pink text-white rounded-md hover:bg-opacity-90 inline-block"
              >
                Add Photos
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {photos.slice(0, 4).map((photo) => (
                <div
                  key={photo.id}
                  className="aspect-square rounded-lg overflow-hidden bg-bg-card relative"
                >
                  <img
                    src={photo.url}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                  {photo.isPrivate && (
                    <div className="absolute top-1 right-1 w-6 h-6 bg-bg-dark bg-opacity-60 rounded-full flex items-center justify-center">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M19 11H5C3.89543 11 3 11.8954 3 13V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V13C21 11.8954 20.1046 11 19 11Z"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M7 11V7C7 5.67392 7.52678 4.40215 8.46447 3.46447C9.40215 2.52678 10.6739 2 12 2C13.3261 2 14.5979 2.52678 15.5355 3.46447C16.4732 4.40215 17 5.67392 17 7V11"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
              {photos.length > 4 && (
                <Link
                  to="/profile"
                  className="aspect-square rounded-lg bg-bg-card flex items-center justify-center"
                >
                  <div className="text-text-secondary">
                    <span className="text-2xl">+{photos.length - 4}</span>
                    <p className="text-xs">View All</p>
                  </div>
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Matches Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-text-primary">Recent Matches</h2>
            <Link to="/matches" className="text-brand-pink text-sm">
              View All
            </Link>
          </div>

          {matches.length === 0 ? (
            <div className="bg-bg-card p-6 rounded-lg text-center">
              <p className="text-text-secondary mb-4">
                No matches yet. Visit the Discover page to find potential matches!
              </p>
              <Link
                to="/discover"
                className="px-4 py-2 bg-brand-pink text-white rounded-md hover:bg-opacity-90 inline-block"
              >
                Discover
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {matches.map((match) => (
                <Link
                  key={match.id}
                  to={`/messages/${match.id}`}
                  className="block group"
                >
                  <div className="aspect-square rounded-lg overflow-hidden mb-2">
                    <img
                      src={match.avatar || '/images/default-avatar.png'}
                      alt={match.firstName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <p className="text-center text-text-primary font-medium truncate">
                    {match.firstName}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Private Photo Requests */}
        {photoRequests.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-text-primary mb-4">
              Photo Access Requests
            </h2>

            <div className="space-y-4">
              {photoRequests.map((request) => (
                <div
                  key={request.id}
                  className="bg-bg-card p-4 rounded-lg flex items-center"
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden mr-4">
                    <img
                      src={request.requester.avatar || '/images/default-avatar.png'}
                      alt={request.requester.firstName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-grow">
                    <p className="text-text-primary">
                      <span className="font-medium">{request.requester.firstName}</span>{' '}
                      wants to see your private photos
                    </p>
                    {request.message && (
                      <p className="text-text-secondary text-sm italic">
                        &quot;{request.message}&quot;
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 ml-2">
                    <button
                      onClick={() => handleRejectPhotoRequest(request.id)}
                      className="p-2 text-text-secondary hover:text-error"
                      aria-label="Reject"
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M18 6L6 18M6 6L18 18"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleAcceptPhotoRequest(request.id)}
                      className="p-2 text-text-secondary hover:text-brand-pink"
                      aria-label="Accept"
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M5 12L10 17L19 8"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div>
          <h2 className="text-xl font-bold text-text-primary mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              to="/discover"
              className="bg-bg-card p-4 rounded-lg text-center hover:border hover:border-brand-pink transition-all"
            >
              <div className="w-10 h-10 mx-auto mb-2 bg-brand-pink bg-opacity-10 rounded-full flex items-center justify-center">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="text-brand-pink"
                >
                  <path
                    d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="text-text-primary font-medium">Discover</p>
            </Link>

            <Link
              to="/matches"
              className="bg-bg-card p-4 rounded-lg text-center hover:border hover:border-brand-pink transition-all"
            >
              <div className="w-10 h-10 mx-auto mb-2 bg-brand-pink bg-opacity-10 rounded-full flex items-center justify-center">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="text-brand-pink"
                >
                  <path
                    d="M19.5 12.5719L12 19.9999L4.5 12.5719C2.5 10.5719 2.5 7.07192 4.5 5.07192C6.5 3.07192 10 3.07192 12 5.07192C14 3.07192 17.5 3.07192 19.5 5.07192C21.5 7.07192 21.5 10.5719 19.5 12.5719Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="text-text-primary font-medium">Matches</p>
            </Link>

            <Link
              to="/messages"
              className="bg-bg-card p-4 rounded-lg text-center hover:border hover:border-brand-pink transition-all"
            >
              <div className="w-10 h-10 mx-auto mb-2 bg-brand-pink bg-opacity-10 rounded-full flex items-center justify-center">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="text-brand-pink"
                >
                  <path
                    d="M8 10H8.01M12 10H12.01M16 10H16.01M9 16H5C3.89543 16 3 15.1046 3 14V6C3 4.89543 3.89543 4 5 4H19C20.1046 4 21 4.89543 21 6V14C21 15.1046 20.1046 16 19 16H14L9 21V16Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="text-text-primary font-medium">Messages</p>
            </Link>

            <Link
              to="/profile"
              className="bg-bg-card p-4 rounded-lg text-center hover:border hover:border-brand-pink transition-all"
            >
              <div className="w-10 h-10 mx-auto mb-2 bg-brand-pink bg-opacity-10 rounded-full flex items-center justify-center">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="text-brand-pink"
                >
                  <path
                    d="M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M12 14C8.13401 14 5 17.134 5 21H19C19 17.134 15.866 14 12 14Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="text-text-primary font-medium">Profile</p>
            </Link>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default DashboardPage;
