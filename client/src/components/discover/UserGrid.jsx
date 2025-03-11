// src/components/discover/UserGrid.jsx
import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import UserCard from './UserCard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import Spinner from '../ui/Spinner';

const UserGrid = ({ onSelectUser }) => {
  const { user: currentUser } = useSelector(state => state.auth);
  const [users, setUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'online', 'new', 'matches'
  const [isPremium, setIsPremium] = useState(false); // Should come from user subscription status
  const [dailyLikesRemaining, setDailyLikesRemaining] = useState(3); // For free users

  // Fetch all users with their online status
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        // This would be your actual API call
        // const response = await fetch('/api/users');
        // const data = await response.json();

        // Mock data for development
        const mockUsers = generateMockUsers(24);

        // Sort with online users first
        const sortedUsers = [...mockUsers].sort((a, b) => {
          if (a.isOnline && !b.isOnline) return -1;
          if (!a.isOnline && b.isOnline) return 1;
          return 0;
        });

        setUsers(sortedUsers);
        setOnlineUsers(sortedUsers.filter(user => user.isOnline));

        // Check if current user is premium (would come from auth state in real app)
        setIsPremium(currentUser?.subscription === 'premium' || false);

        // Get remaining daily likes (would come from user stats in real app)
        setDailyLikesRemaining(3); // Mock value for free users

      } catch (err) {
        console.error('Error fetching users:', err);
        setError('Failed to load users. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [currentUser]);

  // Generate mock user data for development
  const generateMockUsers = (count) => {
    const interestOptions = [
      'Photography', 'Travel', 'Music', 'Art', 'Movies', 'Reading', 'Fitness',
      'Cooking', 'Dancing', 'Gaming', 'Yoga', 'Hiking', 'Fashion', 'Technology'
    ];

    return Array.from({ length: count }, (_, i) => {
      const isOnline = Math.random() > 0.7; // 30% of users are online
      const randomInterests = [];
      const interestCount = Math.floor(Math.random() * 5) + 1; // 1-5 interests

      for (let j = 0; j < interestCount; j++) {
        const randomInterest = interestOptions[Math.floor(Math.random() * interestOptions.length)];
        if (!randomInterests.includes(randomInterest)) {
          randomInterests.push(randomInterest);
        }
      }

      return {
        id: `user-${i + 1}`,
        firstName: ['Sophia', 'Emma', 'Olivia', 'Ava', 'Mia', 'Liam', 'Noah', 'Ethan', 'Lucas', 'Mason'][i % 10],
        age: Math.floor(Math.random() * 15) + 25, // 25-40
        bio: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla facilisi.",
        avatar: '/images/default-avatar.png',
        isOnline,
        interests: randomInterests,
        hasStories: Math.random() > 0.7,
        hasPrivatePhotos: Math.random() > 0.6,
        lastMessage: Math.random() > 0.5 ? 'Hey there! How are you doing?' : null,
        lastActive: new Date(Date.now() - Math.random() * 10000000)
      };
    });
  };

  const handleLikeUser = (userId) => {
    if (!isPremium && dailyLikesRemaining <= 0) {
      alert("You've reached your daily limit of likes. Upgrade to premium for unlimited likes!");
      return;
    }

    // Handle like action
    console.log(`Liked user ${userId}`);

    // Decrease daily likes for free users
    if (!isPremium) {
      setDailyLikesRemaining(prev => prev - 1);
    }
  };

  const handleSendWink = (userId) => {
    // Handle sending a wink
    console.log(`Sent wink to user ${userId}`);
  };

  const handleSendMessage = (userId) => {
    // If free user and no match, show upgrade prompt
    const targetUser = users.find(user => user.id === userId);
    const hasMatch = true; // This would be determined by checking matches state

    if (!isPremium && !hasMatch) {
      alert("You need to match with this user first or upgrade to premium to send messages!");
      return;
    }

    // Handle sending message or navigate to chat
    console.log(`Sending message to user ${userId}`);
    if (onSelectUser) {
      onSelectUser(targetUser);
    }
  };

  const handleViewStories = (userId) => {
    // Handle viewing stories
    console.log(`Viewing stories for user ${userId}`);
    // This would typically open a stories modal/view
  };

  const handleRequestPrivatePhotos = (userId) => {
    // Handle requesting private photos
    console.log(`Requesting private photos from user ${userId}`);
  };

  const getFilteredUsers = () => {
    switch (filter) {
      case 'online':
        return users.filter(user => user.isOnline);
      case 'new':
        // In a real app, you'd filter based on join date
        return users.sort((a, b) => b.lastActive - a.lastActive);
      case 'matches':
        // In a real app, you'd filter for matched users
        return users.filter((_, index) => index % 3 === 0); // Mock matches
      default:
        return users;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-6 bg-bg-card rounded-lg shadow-lg">
        <p className="text-error mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-brand-pink text-white rounded-md hover:bg-opacity-90"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Filter tabs */}
      <Tabs defaultValue="all" className="mb-6" onValueChange={setFilter}>
        <TabsList className="grid grid-cols-4 mb-4">
          <TabsTrigger value="all" className="text-sm">All Users</TabsTrigger>
          <TabsTrigger value="online" className="text-sm">Online Now ({onlineUsers.length})</TabsTrigger>
          <TabsTrigger value="new" className="text-sm">New Users</TabsTrigger>
          <TabsTrigger value="matches" className="text-sm">My Matches</TabsTrigger>
        </TabsList>

        {/* For free users, show daily likes counter */}
        {!isPremium && (
          <div className="mb-4 text-sm text-text-secondary">
            Daily likes remaining:
            <span className={dailyLikesRemaining > 0 ? "text-brand-pink font-bold ml-1" : "text-error font-bold ml-1"}>
              {dailyLikesRemaining}
            </span>
          </div>
        )}

        <TabsContent value="all" className="mt-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
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
        </TabsContent>

        <TabsContent value="online" className="mt-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
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
        </TabsContent>

        <TabsContent value="new" className="mt-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
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
        </TabsContent>

        <TabsContent value="matches" className="mt-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
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
        </TabsContent>
      </Tabs>

      {/* Upgrade prompt for free users */}
      {!isPremium && (
        <div className="mt-6 p-4 bg-bg-card rounded-lg shadow-md border border-brand-pink border-opacity-50">
          <h3 className="text-lg font-bold text-brand-pink mb-2">Upgrade to Premium</h3>
          <p className="text-text-secondary mb-4">Get unlimited messaging, video calls, and likes!</p>
          <button className="w-full py-2 bg-brand-pink text-white rounded-md hover:bg-opacity-90 transition-colors">
            Upgrade Now
          </button>
        </div>
      )}
    </div>
  );
};

export default UserGrid;
