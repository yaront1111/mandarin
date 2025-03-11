// src/pages/MessagesPage.jsx
import React, { useState, useEffect } from 'react';
import MainLayout from '../components/layouts/MainLayout';
import MatchCard from '../components/matches/MatchCard';
import ChatWindow from '../components/chat/ChatWindow';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { Link } from 'react-router-dom';

const MessagesPage = () => {
  const { token, user } = useSelector(state => state.auth);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [matches, setMatches] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch matches from API
  useEffect(() => {
    const fetchMatches = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/matches', {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.data.success) {
          setMatches(response.data.data || []);
        } else {
          setMatches([]);
        }
        // Clear any previous errors
        setError(null);
      } catch (err) {
        console.error('Error fetching matches:', err);
        // Only set error if it's not just empty matches
        if (err.response && err.response.status !== 200) {
          setError('Failed to load conversations');
        } else {
          // If it's a 200 status but empty data, don't show an error
          setMatches([]);
        }
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchMatches();
    }
  }, [token]);

  // Fetch messages when a match is selected
  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedMatch?.id) return;

      try {
        const response = await axios.get(`/api/chat/${selectedMatch.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.data.success) {
          setMessages(response.data.data || []);
        } else {
          setMessages([]);
        }
      } catch (err) {
        console.error('Error fetching messages:', err);
        // Continue with empty messages array
        setMessages([]);
      }
    };

    if (selectedMatch) {
      fetchMessages();
    }
  }, [selectedMatch, token]);

  // Handle selecting a match
  const handleSelectMatch = (match) => {
    setSelectedMatch(match);
  };

  // Handle sending a message
  const handleSendMessage = async (content) => {
    if (!selectedMatch?.id || !content.trim()) return;

    try {
      const response = await axios.post('/api/chat', {
        matchId: selectedMatch.id,
        content,
        messageType: 'text'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        // Add the new message to the list
        setMessages(prev => [...prev, response.data.data]);
      }
    } catch (err) {
      console.error('Error sending message:', err);
      alert('Failed to send message. Please try again.');
    }
  };

  // Filter matches based on search query
  const filteredMatches = matches.filter(match => {
    if (!searchQuery.trim()) return true;

    // Determine which user is the other person
    const otherUser = match.userA?.id !== user?.id ? match.userA : match.userB;
    if (!otherUser?.firstName) return false;

    return otherUser.firstName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto h-screen pt-6 pb-24">
        <h1 className="text-2xl font-bold text-text-primary px-4 mb-4">Messages</h1>

        <div className="flex h-[calc(100vh-200px)] bg-bg-card rounded-lg overflow-hidden shadow-lg">
          {/* Match List - Left Sidebar */}
          <div className="w-1/3 border-r border-gray-800 h-full overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-800">
              <h2 className="text-lg font-semibold mb-3">Your Matches</h2>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search conversations..."
                  aria-label="Search matches"
                  className="w-full bg-bg-input rounded-full py-2 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-brand-pink text-text-primary"
                />
                <svg
                  className="absolute right-3 top-2.5 h-4 w-4 text-text-secondary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading && (
                <div className="p-4 text-center">
                  <div className="w-8 h-8 mx-auto border-2 border-brand-pink border-t-transparent rounded-full animate-spin"></div>
                  <p className="mt-2 text-text-secondary text-sm">Loading conversations...</p>
                </div>
              )}

              {error && (
                <div className="p-4 text-center text-error">
                  <p>{error}</p>
                  <button
                    className="mt-2 px-3 py-1 bg-brand-pink text-white rounded-md text-sm hover:bg-opacity-90"
                    onClick={() => window.location.reload()}
                  >
                    Retry
                  </button>
                </div>
              )}

              {!loading && !error && matches.length === 0 && (
                <div className="p-8 text-center text-text-secondary">
                  <svg
                    className="w-12 h-12 mx-auto mb-4 text-text-secondary opacity-50"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                    />
                  </svg>
                  <p>No conversations found.</p>
                  <p className="mt-1 text-sm">You need to match with people first.</p>
                  <Link
                    to="/discover"
                    className="mt-4 px-4 py-2 bg-brand-pink text-white rounded-md inline-block hover:bg-opacity-90 transition-colors"
                  >
                    Discover People
                  </Link>
                </div>
              )}

              {!loading && filteredMatches.length > 0 && (
                filteredMatches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    currentUserId={user?.id}
                    isActive={selectedMatch?.id === match.id}
                    onClick={() => handleSelectMatch(match)}
                  />
                ))
              )}

              {!loading && !error && searchQuery && filteredMatches.length === 0 && matches.length > 0 && (
                <div className="p-8 text-center text-text-secondary">
                  <p>No results for &ldquo;{searchQuery}&rdquo;</p>
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-2 px-3 py-1 bg-brand-pink text-white rounded-md text-sm hover:bg-opacity-90"
                  >
                    Clear Search
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Chat Window - Right Side */}
          <div className="w-2/3 h-full overflow-hidden">
            {selectedMatch ? (
              <ChatWindow
                match={{
                  ...selectedMatch,
                  otherUserName: (selectedMatch.userA?.id !== user?.id
                    ? selectedMatch.userA?.firstName
                    : selectedMatch.userB?.firstName) || 'Chat',
                  otherUserAvatar: (selectedMatch.userA?.id !== user?.id
                    ? selectedMatch.userA?.avatar
                    : selectedMatch.userB?.avatar),
                  currentUserId: user?.id
                }}
                messages={messages}
                onSendMessage={handleSendMessage}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <div className="w-16 h-16 bg-bg-input rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-text-primary mb-2">No Conversations Yet</h2>
                {matches.length === 0 ? (
                  <>
                    <p className="text-text-secondary mb-4">You need to match with people before you can chat.</p>
                    <Link
                      to="/discover"
                      className="px-4 py-2 bg-brand-pink text-white rounded-md inline-block hover:bg-opacity-90 transition-colors"
                    >
                      Discover People
                    </Link>
                  </>
                ) : (
                  <p className="text-text-secondary">Select a match from the list to start chatting</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default MessagesPage;
