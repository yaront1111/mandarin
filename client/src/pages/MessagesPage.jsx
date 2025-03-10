// src/pages/MessagesPage.jsx
import React, { useState } from 'react';
import MainLayout from '../components/layouts/MainLayout';
import MatchList from '../components/matches/MatchList';
import ChatWindow from '../components/chat/ChatWindow';
import useChat from '../hooks/useChat';

const MessagesPage = () => {
  const [selectedMatch, setSelectedMatch] = useState(null);
  const { messages, sendMessage } = useChat(selectedMatch?.id);

  // Handle selecting a match
  const handleSelectMatch = (match) => {
    setSelectedMatch(match);
  };

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto h-screen pt-6 pb-24">
        <h1 className="text-2xl font-bold text-text-primary px-4 mb-4">Messages</h1>

        <div className="flex h-[calc(100vh-200px)] bg-bg-card rounded-lg overflow-hidden shadow-lg">
          {/* Match List - Left Sidebar */}
          <div className="w-1/3 border-r border-gray-800 h-full overflow-hidden flex flex-col">
            <div className="h-full overflow-hidden">
              <MatchList onSelectMatch={handleSelectMatch} />
            </div>
          </div>

          {/* Chat Window - Right Side */}
          <div className="w-2/3 h-full overflow-hidden">
            {selectedMatch ? (
              <ChatWindow
                match={selectedMatch}
                messages={messages}
                onSendMessage={sendMessage}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <div className="w-16 h-16 bg-bg-input rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-text-primary mb-2">Select a conversation</h2>
                <p className="text-text-secondary">Choose a match from the list to start chatting</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default MessagesPage;
