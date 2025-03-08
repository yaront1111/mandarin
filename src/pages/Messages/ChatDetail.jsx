// src/pages/Messages/ChatDetail.jsx

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';

// Components
import ErrorBoundary from '../../components/common/ErrorBoundary';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Header from '../../components/layout/Header';
import Navigation from '../../components/layout/Navigation';

// Services
import { messageService } from '../../services/messageService';

// Context
import { AppContext } from '../../context/AppContext';

// Config/Constants (optional)
import { API_TIMEOUT } from '../../config/constants';

function ChatDetailPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { stealthMode } = React.useContext(AppContext);

  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [newMessage, setNewMessage] = useState('');

  const messagesEndRef = useRef(null);

  useEffect(() => {
    async function fetchConversation() {
      try {
        setLoading(true);
        const conv = await messageService.getConversation(conversationId);
        setConversation(conv);
        setMessages(conv.messages || []);
        // Scroll to bottom
        setTimeout(() => scrollToBottom(), 100);
      } catch (err) {
        console.error('Error loading conversation:', err);
        setError('Failed to load conversation. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    fetchConversation();
  }, [conversationId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    setSending(true);
    try {
      const msg = await messageService.sendMessage(conversationId, newMessage);
      setMessages((prev) => [...prev, msg]);
      setNewMessage('');
      setTimeout(() => scrollToBottom(), 100);
    } catch (err) {
      console.error('Error sending message:', err);
      // Optionally show an error
    } finally {
      setSending(false);
    }
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
          <Navigation activeTab="messages" onTabChange={(tab) => navigate(`/${tab}`)} />
        </ErrorBoundary>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="app-container">
        <Header />
        <div className="main p-4 text-center">
          <p className="text-red-500 mb-4">{error || 'No conversation found'}</p>
          <button
            className="btn btn-primary"
            onClick={() => navigate(-1)}
          >
            Go Back
          </button>
        </div>
        <Navigation activeTab="messages" onTabChange={(tab) => navigate(`/${tab}`)} />
      </div>
    );
  }

  // Render chat
  return (
    <div className="app-container">
      <ErrorBoundary>
        <Header />
      </ErrorBoundary>

      <main className="main relative p-0">
        {/* Chat Header */}
        <div className="flex items-center p-4 bg-gray-800 border-b border-gray-700">
          <button className="btn-icon mr-3" onClick={() => navigate(-1)}>
            <ArrowLeft size={24} />
          </button>
          <div>
            <h2 className="text-lg font-bold">{conversation.userName}</h2>
            {/* Possibly show online status or last active */}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-900" style={{ minHeight: 'calc(100vh - 12rem)' }}>
          {messages.length === 0 ? (
            <p className="text-center text-gray-400 mt-4">No messages yet</p>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`mb-2 flex ${msg.sentByMe ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`p-2 rounded-lg max-w-xs 
                    ${msg.sentByMe ? 'bg-pink-600' : 'bg-gray-800'} 
                    text-white`}
                  title={new Date(msg.createdAt).toLocaleTimeString()}
                >
                  {msg.content}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 bg-gray-800 flex">
          <input
            type="text"
            className="flex-1 bg-gray-700 rounded-l-md p-2 focus:outline-none focus:ring-1
                       focus:ring-pink-500 text-white"
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            disabled={sending}
          />
          <button
            className="btn btn-primary rounded-r-md"
            onClick={handleSend}
            disabled={sending || !newMessage.trim()}
          >
            {sending ? '...' : <Send size={20} />}
          </button>
        </div>
      </main>

      <ErrorBoundary>
        <Navigation
          activeTab="messages"
          onTabChange={(tab) => navigate(`/${tab}`)}
        />
      </ErrorBoundary>

      {stealthMode && (
        <div className="stealth-mode-indicator">
          <div className="stealth-mode-header">
            <span className="stealth-mode-icon">🛡️</span>
            <span className="stealth-mode-text">Stealth Mode Active</span>
          </div>
          <p className="stealth-mode-description">
            Your online status may be hidden
          </p>
        </div>
      )}
    </div>
  );
}

export default ChatDetailPage;
