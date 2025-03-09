import React, { useState } from 'react';
import MainLayout from '../components/layouts/MainLayout';
import MatchList from '../components/matches/MatchList';
import ChatWindow from '../components/chat/ChatWindow';
import ProfileView from '../components/profile/ProfileView';
import useChat from '../hooks/useChat';

const MatchesPage = () => {
  const [selectedMatch, setSelectedMatch] = useState(null);
  const { messages, sendMessage } = useChat(selectedMatch?.id);

  return (
    <MainLayout
      leftSidebar={<MatchList onSelectMatch={setSelectedMatch} />}
      rightSidebar={<ProfileView profile={selectedMatch} />}
    >
      <ChatWindow
        match={selectedMatch}
        messages={messages}
        onSendMessage={sendMessage}
      />
    </MainLayout>
  );
};

export default MatchesPage;
