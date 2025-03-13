// client/src/components/ChatComponents.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth, useChat } from '../context';
import { FaHeart, FaVideo, FaEnvelope, FaSpinner, FaTimes } from 'react-icons/fa';

// Chat Box Component
export const ChatBox = ({ recipient }) => {
  const { user } = useAuth();
  const {
    messages,
    sendMessage,
    sendTyping,
    typingUsers,
    initiateVideoCall,
    sendingMessage,
    messageError,
    clearError  // Added this to handle messageError
  } = useChat();

  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);
  const chatInputRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when component mounts
  useEffect(() => {
    chatInputRef.current?.focus();
  }, []);

  // Debounced typing indicator with proper dependencies
  const debouncedTyping = useCallback((recipientId) => {
    let timeout;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      if (newMessage.trim()) {
        sendTyping(recipientId);
      }
    }, 300); // 300ms debounce
  }, [newMessage, sendTyping]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (newMessage.trim() && !sendingMessage) {
      try {
        await sendMessage(recipient._id, 'text', newMessage.trim());
        setNewMessage('');
      } catch (error) {
        console.error('Failed to send message:', error);
      }
    }
  };

  const handleSendWink = async () => {
    if (!sendingMessage) {
      try {
        await sendMessage(recipient._id, 'wink', '😉');
      } catch (error) {
        console.error('Failed to send wink:', error);
      }
    }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    debouncedTyping(recipient._id);
  };

  const isTyping = typingUsers[recipient._id] &&
    Date.now() - typingUsers[recipient._id] < 3000;

  // Group messages by date for better display
  const groupMessagesByDate = () => {
    const groups = {};

    messages.forEach(message => {
      const date = new Date(message.createdAt).toLocaleDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
    });

    return groups;
  };

  const messageGroups = groupMessagesByDate();

  return (
    <div className="chat-box">
      <div className="chat-header">
        <h3>{recipient.nickname}</h3>
        <div className="chat-actions">
          <button
            className="action-btn wink-btn"
            onClick={handleSendWink}
            disabled={sendingMessage}
            title="Send Wink"
          >
            <FaHeart />
          </button>
          <button
            className="action-btn video-btn"
            onClick={() => initiateVideoCall(recipient._id)}
            disabled={sendingMessage}
            title="Start Video Call"
          >
            <FaVideo />
          </button>
        </div>
      </div>

      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="no-messages">
            <p>No messages yet. Say hello!</p>
          </div>
        ) : (
          Object.entries(messageGroups).map(([date, dateMessages]) => (
            <div key={date} className="message-group">
              <div className="message-date">
                <span>{date}</span>
              </div>

              {dateMessages.map((message, index) => (
                <div
                  key={message._id || index}
                  className={`message ${message.sender === user._id ? 'sent' : 'received'}`}
                >
                  {message.type === 'text' && <p>{message.content}</p>}
                  {message.type === 'wink' && <p className="wink">😉</p>}
                  {message.type === 'video' && (
                    <p className="video-msg"><FaVideo /> Video Call</p>
                  )}

                  <span className="message-time">
                    {new Date(message.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              ))}
            </div>
          ))
        )}

        {isTyping && (
          <div className="typing-indicator">
            <p>{recipient.nickname} is typing...</p>
          </div>
        )}

        {messageError && (
          <div className="message-error">
            <p>{messageError}</p>
            <button onClick={() => clearError()}><FaTimes /></button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form className="message-form" onSubmit={handleSendMessage}>
        <input
          type="text"
          placeholder="Type a message..."
          value={newMessage}
          onChange={handleTyping}
          disabled={sendingMessage}
          ref={chatInputRef}
        />
        <button
          type="submit"
          className="send-btn"
          disabled={sendingMessage || !newMessage.trim()}
        >
          {sendingMessage ? <FaSpinner className="fa-spin" /> : <FaEnvelope />}
        </button>
      </form>
    </div>
  );
};

// Video Call Component
export const VideoCall = ({ peer, isIncoming, onAnswer, onDecline, onEnd }) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Set up media stream
  useEffect(() => {
    const setupMediaStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });

        setLocalStream(stream);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Setup peer connection would go here in a complete implementation
        // This would use the peer parameter to establish connection
        // and would call setRemoteStream when remote stream is available

        setConnectionStatus('awaiting');
      } catch (err) {
        console.error('Error accessing media devices:', err);
        setConnectionStatus('error');
      }
    };

    setupMediaStream();

    return () => {
      // Clean up media streams
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);  // Empty dependency array is fine here as this runs once on mount

  // Update remote video reference when remote stream changes
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return (
    <div className="video-call-container">
      <div className="video-grid">
        <div className="remote-video">
          {remoteStream ? (
            <video ref={remoteVideoRef} autoPlay playsInline />
          ) : (
            <div className="connecting">
              <p>{connectionStatus === 'connecting' ? 'Connecting...' :
                 connectionStatus === 'awaiting' ? 'Waiting for connection...' :
                 'Connection failed'}</p>
            </div>
          )}
        </div>
        <div className="local-video">
          <video ref={localVideoRef} autoPlay playsInline muted />
        </div>
      </div>

      <div className="call-controls">
        {isIncoming ? (
          <>
            <button
              className="answer-btn"
              onClick={onAnswer}
              disabled={connectionStatus === 'error'}
            >
              Answer
            </button>
            <button className="decline-btn" onClick={onDecline}>Decline</button>
          </>
        ) : (
          <button className="end-call-btn" onClick={onEnd}>End Call</button>
        )}
      </div>
    </div>
  );
};

// Loading Spinner Component
export const Spinner = () => {
  return (
    <div className="spinner-container">
      <div className="spinner"></div>
    </div>
  );
};
