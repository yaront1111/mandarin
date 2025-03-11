// src/components/discover/UserGrid.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import PropTypes from 'prop-types'; // Add PropTypes import
import UserCard from './UserCard';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs'; // Remove unused TabsContent
import Spinner from '../ui/Spinner';
import { fetchUsers } from '../../store/userSlice';
import { likeUser, sendWink } from '../../services/matchService';
import { getStoriesByUser } from '../../services/storyService';
import useDebounce from '../../hooks/useDebounce';

const UserGrid = ({ onSelectUser }) => {
  const dispatch = useDispatch();
  const { user: currentUser } = useSelector(state => state.auth);
  const { users, onlineUsers, loading, error } = useSelector(state => state.user);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Get user subscription status from auth store
  const isPremium = currentUser?.subscription === 'premium';

  // Get daily likes remaining from user stats
  const userStats = useSelector(state => state.user.stats);
  const dailyLikesRemaining = isPremium ? Infinity : (userStats?.dailyLikesRemaining || 3);

  // Fetch users with current filter and search params
  const fetchUserData = useCallback(() => {
    const params = {
      page,
      limit: 20,
      filter,
      search: debouncedSearchQuery,
    };

    dispatch(fetchUsers(params))
      .then(result => {
        // Check if we've reached the end of the list
        if (result.payload.length < 20) {
          setHasMore(false);
        }
      });
  }, [dispatch, page, filter, debouncedSearchQuery]);

  // Fetch initial data
  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // Reset pagination when filter or search changes
  useEffect(() => {
    setPage(1);
    setHasMore(true);
  }, [filter, debouncedSearchQuery]);

  const handleLikeUser = async (userId) => {
    if (!isPremium && dailyLikesRemaining <= 0) {
      // Show premium upgrade modal
      dispatch({ type: 'ui/showUpgradeModal', payload: 'likes' });
      return;
    }

    try {
      await likeUser(userId);

      // Update local state to show liked status
      dispatch({
        type: 'user/setUserLiked',
        payload: { userId, liked: true }
      });

      // Decrement daily likes for free users
      if (!isPremium) {
        dispatch({
          type: 'user/decrementDailyLikes'
        });
      }
    } catch (error) {
      console.error('Error liking user:', error);
      // Show error toast
      dispatch({
        type: 'ui/showToast',
        payload: {
          type: 'error',
          message: 'Failed to like user. Please try again.'
        }
      });
    }
  };

  const handleSendWink = async (userId) => {
    try {
      await sendWink(userId);

      // Show success toast
      dispatch({
        type: 'ui/showToast',
        payload: {
          type: 'success',
          message: 'Wink sent successfully!'
        }
      });
    } catch (error) {
      console.error('Error sending wink:', error);
      // Show error toast
      dispatch({
        type: 'ui/showToast',
        payload: {
          type: 'error',
          message: 'Failed to send wink. Please try again.'
        }
      });
    }
  };

  const handleSendMessage = (userId) => {
    const targetUser = users.find(user => user.id === userId);
    const hasMatch = targetUser?.hasMatch || false;

    // Check if free user can message
    if (!isPremium && !hasMatch) {
      // Show premium upgrade modal
      dispatch({ type: 'ui/showUpgradeModal', payload: 'messaging' });
      return;
    }

    // Find and provide user data to parent component
    if (targetUser && onSelectUser) {
      onSelectUser(targetUser);
    }
  };

  const handleViewStories = async (userId) => {
    try {
      // Fetch stories for this user
      const stories = await getStoriesByUser(userId);

      // Show stories viewer
      dispatch({
        type: 'stories/showViewer',
        payload: { userId, stories }
      });
    } catch (error) {
      console.error('Error fetching stories:', error);
      dispatch({
        type: 'ui/showToast',
        payload: {
          type: 'error',
          message: 'Failed to load stories. Please try again.'
        }
      });
    }
  };

  const handleRequestPrivatePhotos = (userId) => {
    dispatch({
      type: 'photos/requestAccess',
      payload: { userId }
    });
  };

  // Load more users when scrolling to bottom
  const loadMore = () => {
    if (!loading && hasMore) {
      setPage(prevPage => prevPage + 1);
    }
  };

  const getFilteredUsers = () => {
    switch (filter) {
      case 'online':
        return onlineUsers;
      case 'new':
        return [...users].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      case 'matches':
        return users.filter(user => user.hasMatch);
      default:
        return users;
    }
  };

  return (
    <div className="w-full">
      {/* Filter tabs and search */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-4">
          <Tabs defaultValue="all" onValueChange={setFilter}>
            <TabsList className="grid grid-cols-4">
              <TabsTrigger value="all" className="text-sm">All Users</TabsTrigger>
              <TabsTrigger value="online" className="text-sm">Online Now ({onlineUsers.length})</TabsTrigger>
              <TabsTrigger value="new" className="text-sm">New Users</TabsTrigger>
              <TabsTrigger value="matches" className="text-sm">My Matches</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              className="w-full sm:w-64 px-4 py-2 bg-bg-input rounded-full text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-pink"
            />
            <svg className="w-5 h-5 absolute right-3 top-2.5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* For free users, show daily likes counter */}
        {!isPremium && (
          <div className="mb-4 text-sm text-text-secondary">
            Daily likes remaining:
            <span className={dailyLikesRemaining > 0 ? "text-brand-pink font-bold ml-1" : "text-error font-bold ml-1"}>
              {dailyLikesRemaining}
            </span>
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading && page === 1 && (
        <div className="flex justify-center items-center h-64">
          <Spinner size="lg" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="text-center p-6 bg-bg-card rounded-lg shadow-lg">
          <p className="text-error mb-4">{error}</p>
          <button
            onClick={fetchUserData}
            className="px-4 py-2 bg-brand-pink text-white rounded-md hover:bg-opacity-90"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && getFilteredUsers().length === 0 && (
        <div className="text-center p-8 bg-bg-card rounded-lg shadow-lg">
          <div className="w-16 h-16 mx-auto mb-4 bg-bg-input rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-text-primary mb-2">No users found</h3>
          <p className="text-text-secondary mb-4">
            {filter === 'matches'
              ? "You don't have any matches yet. Try liking more profiles!"
              : "Try adjusting your search or filters to find more people."}
          </p>
          {filter !== 'all' && (
            <button
              onClick={() => setFilter('all')}
              className="px-4 py-2 bg-brand-pink text-white rounded-md hover:bg-opacity-90"
            >
              Show All Users
            </button>
          )}
        </div>
      )}

      {/* User grid */}
      {!loading && getFilteredUsers().length > 0 && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {getFilteredUsers().map(user => (
              <UserCard
                key={user.id}
                user={user}
                isPremium={isPremium}
                onLike={handleLikeUser}
                onSendWink={handleSendWink}
                onSendMessage={handleSendMessage}
                onViewStories={handleViewStories}
                onRequestPrivatePhotos={handleRequestPrivatePhotos}
              />
            ))}
          </div>

          {/* Load more indicator */}
          {loading && page > 1 && (
            <div className="flex justify-center my-6">
              <Spinner size="md" />
            </div>
          )}

          {/* Load more button */}
          {!loading && hasMore && (
            <div className="flex justify-center mt-8">
              <button
                onClick={loadMore}
                className="px-6 py-2 bg-bg-input text-text-primary rounded-md hover:bg-opacity-80"
              >
                Load More
              </button>
            </div>
          )}
        </div>
      )}

      {/* Upgrade prompt for free users */}
      {!isPremium && (
        <div className="mt-10 p-6 bg-bg-card rounded-lg shadow-md border border-brand-pink border-opacity-50">
          <h3 className="text-lg font-bold text-brand-pink mb-2">Upgrade to Premium</h3>
          <p className="text-text-secondary mb-4">
            Get unlimited messaging, video calls, and likes. Connect with more people and boost your chances of finding the perfect match!
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 p-4 bg-bg-dark rounded-lg">
              <h4 className="font-bold mb-2">Free</h4>
              <ul className="text-sm space-y-2">
                <li className="flex items-center">
                  <span className="w-5 h-5 mr-2 text-error">✕</span>
                  Limited messaging
                </li>
                <li className="flex items-center">
                  <span className="w-5 h-5 mr-2 text-error">✕</span>
                  No video calls
                </li>
                <li className="flex items-center">
                  <span className="w-5 h-5 mr-2 text-green-500">✓</span>
                  Send winks
                </li>
                <li className="flex items-center">
                  <span className="w-5 h-5 mr-2 text-error">✕</span>
                  Only 3 likes per day
                </li>
              </ul>
            </div>
            <div className="flex-1 p-4 bg-brand-pink bg-opacity-10 rounded-lg border border-brand-pink">
              <h4 className="font-bold text-brand-pink mb-2">Premium</h4>
              <ul className="text-sm space-y-2">
                <li className="flex items-center">
                  <span className="w-5 h-5 mr-2 text-green-500">✓</span>
                  Unlimited messaging
                </li>
                <li className="flex items-center">
                  <span className="w-5 h-5 mr-2 text-green-500">✓</span>
                  Video calls
                </li>
                <li className="flex items-center">
                  <span className="w-5 h-5 mr-2 text-green-500">✓</span>
                  Send winks & messages
                </li>
                <li className="flex items-center">
                  <span className="w-5 h-5 mr-2 text-green-500">✓</span>
                  Unlimited daily likes
                </li>
              </ul>
            </div>
          </div>
          <button
            onClick={() => dispatch({ type: 'ui/showSubscriptionModal' })}
            className="w-full mt-4 py-3 bg-brand-pink text-white rounded-md hover:bg-opacity-90 transition-colors font-bold"
          >
            Upgrade Now
          </button>
        </div>
      )}
    </div>
  );
};

// Add PropTypes validation for onSelectUser
UserGrid.propTypes = {
  onSelectUser: PropTypes.func
};

// Add default prop value
UserGrid.defaultProps = {
  onSelectUser: () => {}
};

export default UserGrid;
