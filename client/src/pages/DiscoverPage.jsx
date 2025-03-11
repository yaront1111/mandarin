// src/pages/DiscoverPage.jsx
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import MainLayout from '../components/layouts/MainLayout';
import UserGrid from '../components/discover/UserGrid';
import ChatWindow from '../components/chat/ChatWindow';
import ProfileView from '../components/profile/ProfileView';
import StoriesViewer from '../components/stories/StoriesViewer';
import useChat from '../hooks/useChat';
import useWindowSize from '../hooks/useWindowSize';
import { fetchUserProfile } from '../store/profileSlice';

const DiscoverPage = () => {
  const dispatch = useDispatch();
  const { width } = useWindowSize();
  const isMobile = width < 768; // 768px is typical md breakpoint

  const [selectedUser, setSelectedUser] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  // Get stories viewer state from Redux
  const { showViewer, currentStoryUserId } = useSelector(state => state.stories);

  // Use our chat hook for the selected user
  const { messages, sendMessage, loading: messagesLoading } = useChat(selectedUser?.id);

  // Fetch full profile when a user is selected
  useEffect(() => {
    if (selectedUser?.id) {
      dispatch(fetchUserProfile(selectedUser.id))
        .then(action => {
          if (action.payload) {
            // Update selected user with full profile data
            setSelectedUser(prev => ({
              ...prev,
              ...action.payload
            }));
          }
        });
    }
  }, [selectedUser?.id, dispatch]);

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    // By default show profile when a user is selected
    setShowProfile(true);
    setShowChat(false);

    // On mobile, automatically scroll to the detail view
    if (isMobile) {
      setTimeout(() => {
        document.getElementById('user-detail-view')?.scrollIntoView({
          behavior: 'smooth'
        });
      }, 100);
    }
  };

  const handleShowChat = () => {
    if (selectedUser) {
      setShowChat(true);
      setShowProfile(false);
    }
  };

  const handleShowProfile = () => {
    if (selectedUser) {
      setShowProfile(true);
      setShowChat(false);
    }
  };

  const handleCloseDetails = () => {
    setShowChat(false);
    setShowProfile(false);
    setSelectedUser(null);
  };

  const handleSendMessage = (content) => {
    if (selectedUser?.id) {
      sendMessage(content);
    }
  };

  const handleCloseStories = () => {
    dispatch({ type: 'stories/hideViewer' });
  };

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 pt-6 pb-24">
        {/* Title */}
        <h1 className="text-2xl md:text-3xl font-bold mb-6 text-text-primary">Discover</h1>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Main grid area */}
          <div className={`${(showChat || showProfile) && !isMobile ? 'md:w-2/3' : 'w-full'}`}>
            <UserGrid onSelectUser={handleSelectUser} />
          </div>

          {/* User details area - only visible when a user is selected */}
          {(showChat || showProfile) && (
            <div
              id="user-detail-view"
              className="w-full md:w-1/3 bg-bg-card rounded-xl shadow-lg overflow-hidden mt-6 md:mt-0"
            >
              {/* Toggle between profile and chat */}
              <div className="bg-bg-dark p-4 flex items-center justify-between border-b border-gray-800">
                <div className="flex items-center space-x-2">
                  <button
                    className={`px-4 py-2 rounded-md ${showProfile ? 'bg-brand-pink text-white' : 'text-text-secondary'}`}
                    onClick={handleShowProfile}
                  >
                    Profile
                  </button>
                  <button
                    className={`px-4 py-2 rounded-md ${showChat ? 'bg-brand-pink text-white' : 'text-text-secondary'}`}
                    onClick={handleShowChat}
                  >
                    Chat
                  </button>
                </div>
                <button
                  onClick={handleCloseDetails}
                  className="h-8 w-8 rounded-full bg-bg-input flex items-center justify-center text-text-secondary"
                  aria-label="Close details"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>

              {/* Profile View */}
              {showProfile && selectedUser && (
                <div className="h-[calc(100vh-200px)] md:h-[calc(100vh-240px)] overflow-y-auto">
                  <ProfileView
                    profile={selectedUser}
                    onSendMessage={handleShowChat}
                  />
                </div>
              )}

              {/* Chat View */}
              {showChat && selectedUser && (
                <div className="h-[calc(100vh-200px)] md:h-[calc(100vh-240px)]">
                  <ChatWindow
                    match={{
                      id: selectedUser?.id,
                      otherUserName: selectedUser?.firstName,
                      otherUserAvatar: selectedUser?.avatar,
                      otherUserIsOnline: selectedUser?.isOnline,
                    }}
                    messages={messages}
                    onSendMessage={handleSendMessage}
                    loading={messagesLoading}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stories viewer */}
        {showViewer && currentStoryUserId && (
          <StoriesViewer
            userId={currentStoryUserId}
            onClose={handleCloseStories}
          />
        )}

        {/* Back to top button (only on mobile) */}
        {isMobile && (showChat || showProfile) && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-20 right-4 h-10 w-10 rounded-full bg-brand-pink text-white flex items-center justify-center shadow-lg"
            aria-label="Back to top"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 15l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </div>
    </MainLayout>
  );
};

export default DiscoverPage;
