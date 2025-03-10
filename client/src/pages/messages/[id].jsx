import React from 'react';
import { useParams } from 'react-router-dom';
import useChat from '../../hooks/useChat';
import ChatWindow from '../../components/chat/ChatWindow';

export default function MessagePage() {
  const { id: matchId } = useParams();
  const { messages, sendMessage, loading, error } = useChat(matchId);

  if (loading) return <p>Loading chat...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div className="min-h-screen bg-bg-dark">
      <h1 className="p-4 text-xl text-white">Chat with Match {matchId}</h1>
      <ChatWindow
        match={{ id: matchId, currentUserId: /* Insert current user ID here or derive from state */, userA: {}, userB: {} }}
        messages={messages}
        onSendMessage={sendMessage}
      />
    </div>
  );
}
