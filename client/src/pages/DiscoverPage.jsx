// src/pages/DiscoverPage.jsx
import React, { useState } from 'react';
import MainLayout from '../components/layouts/MainLayout';
import UserGrid from '../components/discover/UserGrid';
import ChatWindow from '../components/chat/ChatWindow';
import ProfileView from '../components/profile/ProfileView';
import useChat from '../hooks/useChat';

const DiscoverPage = () => {
  const [selectedUser, setSelectedUser] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  // Use our chat hook for the selected user
  const { messages, sendMessage } = useChat(selectedUser?.id);

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    // By default show profile when a user is selected
    setShowProfile(true);
    setShowChat(false);
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
  };

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 pt-6 pb-20">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Main grid area */}
          <div className={`${(showChat || showProfile) ? 'hidden md:block md:w-2/3' : 'w-full'}`}>
            <h1 className="text-3xl font-bold mb-6 text-text-primary">Discover</h1>
            <UserGrid onSelectUser={handleSelectUser} />
          </div>

          {/* User details area - only visible when a user is selected */}
          {(showChat || showProfile) && (
            <div className="w-full md:w-1/3 bg-bg-card rounded-xl shadow-lg overflow-hidden">
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
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>

              {/* Profile View */}
              {showProfile && selectedUser && (
                <ProfileView profile={selectedUser} />
              )}

              {/* Chat View */}
              {showChat && selectedUser && (
                <ChatWindow
                  match={{
                    id: selectedUser?.id,
                    otherUserName: selectedUser?.firstName,
                    otherUserAvatar: selectedUser?.avatar,
                    otherUserIsOnline: selectedUser?.isOnline,
                  }}
                  messages={messages}
                  onSendMessage={sendMessage}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default DiscoverPage;
