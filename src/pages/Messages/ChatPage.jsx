// src/pages/Messages/ChatPage.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Check, CheckCheck } from 'lucide-react';

// Components
import ErrorBoundary from '../../components/common/ErrorBoundary';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Header from '../../components/layout/Header';
import Navigation from '../../components/layout/Navigation';

// Services
import { messageService } from '../../services/messageService';

// Context
import { AppContext } from '../../context/AppContext';

// Config/Helpers

function ChatPage() {
  const navigate = useNavigate();
  const { stealthMode } = React.useContext(AppContext);

  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchConversations() {
      try {
        setLoading(true);
        const data = await messageService.getConversations();
        setConversations(data);
      } catch (err) {
        console.error('Error loading conversations:', err);
        setError('Failed to load conversations. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchConversations();
  }, []);

  // Filter by search term
  const filteredConversations = conversations.filter((conv) =>
    conv.userName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Format timestamp
  const formatMessageTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();

    // If today, show e.g. "10:30 AM"
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // If within the week, show weekday
    const diffDays = (now - date) / (1000 * 60 * 60 * 24);
    if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }

    // Otherwise show e.g. "Aug 18"
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Handlers
  const handleSelectChat = (conversationId) => {
    navigate(`/messages/${conversationId}`);
  };

  if (loading) {
    return (
      <div className="app-container">
        <ErrorBoundary>
          <Header />
        </ErrorBoundary>
        <div className="main flex justify-center items-center">
          <LoadingSpinner size={40} color="var(--color-primary)" />
        </div>
        <ErrorBoundary>
          <Navigation
            activeTab="messages"
            onTabChange={(tab) => navigate(`/${tab}`)}
          />
        </ErrorBoundary>
      </div>
    );
  }

  return (
    <div className="app-container">
      <ErrorBoundary>
        <Header />
      </ErrorBoundary>

      <main className="main">
        <div className="p-4">
          <h1 className="text-xl font-bold mb-4">Messages</h1>

          {/* Search */}
          <div className="relative mb-4">
            <input
              type="text"
              className="w-full bg-gray-800 rounded-lg border-0 py-2 pl-10 pr-4
                         focus:outline-none focus:ring-1 focus:ring-pink-500"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="absolute left-3 top-2.5">
              <Search size={18} className="text-gray-500" />
            </div>
          </div>

          {error ? (
            <div className="text-center py-8">
              <p className="text-red-500 mb-4">{error}</p>
              <button
                className="btn btn-primary"
                onClick={() => window.location.reload()}
              >
                Try Again
              </button>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-8">
              {searchTerm ? (
                <p className="text-gray-400">No conversations match your search</p>
              ) : (
                <>
                  <p className="text-gray-400 mb-4">No messages yet</p>
                  <button
                    className="btn btn-primary"
                    onClick={() => navigate('/discover')}
                  >
                    Find People to Message
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  className="p-3 rounded-lg hover:bg-gray-800 cursor-pointer transition"
                  onClick={() => handleSelectChat(conv.id)}
                >
                  <div className="flex items-center">
                    <div className="relative">
                      <img
                        src={conv.avatarUrl}
                        alt={conv.userName}
                        className="w-12 h-12 rounded-full object-cover mr-3"
                      />
                      {conv.online && (
                        <div className="absolute bottom-0 right-2 w-3 h-3
                                       bg-green-500 rounded-full border-2 border-gray-900"
                          title="Online now"
                        />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline">
                        <h3 className="font-medium truncate">{conv.userName}</h3>
                        <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                          {formatMessageTime(conv.lastMessageTime)}
                        </span>
                      </div>

                      <div className="flex items-center">
                        {/* If I sent the last message, show single/double check */}
                        {conv.lastMessageSentByMe && (
                          <div className="mr-1">
                            {conv.lastMessageRead ? (
                              <CheckCheck size={14} className="text-blue-400" />
                            ) : (
                              <Check size={14} className="text-gray-400" />
                            )}
                          </div>
                        )}
                        <p className="text-sm text-gray-400 truncate">
                          {conv.lastMessageText || 'No message yet'}
                        </p>

                        {conv.unreadCount > 0 && (
                          <div className="ml-2 bg-pink-600 text-xs rounded-full px-2 py-0.5 flex-shrink-0">
                            {conv.unreadCount}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <ErrorBoundary>
        <Navigation
          activeTab="messages"
          onTabChange={(tab) => navigate(`/${tab}`)}
          chatCount={conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0)}
        />
      </ErrorBoundary>

      {/* Stealth Mode Overlay */}
      {stealthMode && (
        <div className="stealth-mode-indicator">
          <div className="stealth-mode-header">
            <span className="stealth-mode-icon">🛡️</span>
            <span className="stealth-mode-text">Stealth Mode Active</span>
          </div>
          <p className="stealth-mode-description">Your online status may be hidden.</p>
        </div>
      )}
    </div>
  );
}

export default ChatPage;
