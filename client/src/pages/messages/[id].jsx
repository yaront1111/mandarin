import React from 'react';
import { useParams } from 'react-router-dom';
import useChat from '../../hooks/useChat';
import ChatWindow from '../../components/chat/ChatWindow';

export default function MessagePage() {
  const { id: matchId } = useParams();
  const { messages, onSendMessage, loading, error } = useChat(matchId);

  if (loading) return <p>Loading chat...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div>
      <h1>Chat with Match {matchId}</h1>
      <ChatWindow
        messages={messages}
        onSend={onSendMessage}
        title={`Match #${matchId}`}
      />
    </div>
  );
}
