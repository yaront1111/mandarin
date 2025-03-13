// client/src/components/ChatComponents.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth, useChat } from '../context';
import { FaHeart, FaVideo, FaEnvelope, FaSpinner } from 'react-icons/fa';

// Chat Box Component
export const ChatBox = ({ recipient }) => {
  const { user } = useAuth();
  const { messages, sendMessage, sendTyping, typingUsers, initiateVideoCall } = useChat();
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Debounced typing indicator
  const debouncedTyping = useCallback(
    (() => {
      let timeout;
      return (recipientId) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          if (newMessage.trim()) {
            sendTyping(recipientId);
          }
        }, 300); // 300ms debounce
      };
    })(),
    [newMessage, sendTyping]
  );

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (newMessage.trim() && !isSending) {
      setIsSending(true);
      try {
        await sendMessage(recipient._id, 'text', newMessage.trim());
        setNewMessage('');
      } catch (error) {
        console.error('Failed to send message:', error);
      } finally {
        setIsSending(false);
      }
    }
  };

  const handleSendWink = async () => {
    if (!isSending) {
      setIsSending(true);
      try {
        await sendMessage(recipient._id, 'wink', '😉');
      } catch (error) {
        console.error('Failed to send wink:', error);
      } finally {
        setIsSending(false);
      }
    }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    debouncedTyping(recipient._id);
  };

  const isTyping = typingUsers[recipient._id] &&
    Date.now() - typingUsers[recipient._id] < 3000;

  return (
    <div className="chat-box">
      <div className="chat-header">
        <h3>{recipient.nickname}</h3>
        <div className="chat-actions">
          <button
            className="action-btn wink-btn"
            onClick={handleSendWink}
            disabled={isSending}
            title="Send Wink"
          >
            <FaHeart />
          </button>
          <button
            className="action-btn video-btn"
            onClick={() => initiateVideoCall(recipient._id)}
            disabled={isSending}
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
          messages.map((message, index) => (
            <div
              key={index}
              className={`message ${message.sender === user._id ? 'sent' : 'received'}`}
            >
              {message.type === 'text' && <p>{message.content}</p>}
              {message.type === 'wink' && <p className="wink">😉</p>}
              {message.type === 'video' && <p className="video-msg"><FaVideo /> Video Call</p>}
              <span className="message-time">
                {new Date(message.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          ))
        )}
        {isTyping && (
          <div className="typing-indicator">
            <p>{recipient.nickname} is typing...</p>
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
          disabled={isSending}
        />
        <button 
          type="submit" 
          className="send-btn"
          disabled={isSending || !newMessage.trim()}
        >
          {isSending ? <FaSpinner className="fa-spin" /> : <FaEnvelope />}
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
        setConnectionStatus('awaiting');
      } catch (err) {
        console.error('Error accessing media devices:', err);
        setConnectionStatus('error');
      }
    };

    setupMediaStream();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

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
