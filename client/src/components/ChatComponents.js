import React, { useState, useEffect, useRef } from 'react';
import { useAuth, useChat } from '../context';
import {
  FaHeart,
  FaVideo,
  FaEnvelope,
  FaSpinner,
  FaTimes,
  FaSmile,
  FaPaperPlane,
  FaPaperclip,
  FaImage,
  FaArrowLeft,
  FaCheckDouble,
  FaCheck
} from 'react-icons/fa';

// Define commonEmojis at the top so it's available throughout the file.
const commonEmojis = ['😊', '😂', '😍', '❤️', '👍', '🙌', '🔥', '✨', '🎉', '🤔', '😉', '🥰'];

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
    clearError
  } = useChat();

  const [newMessage, setNewMessage] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const messagesEndRef = useRef(null);
  const chatInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    chatInputRef.current?.focus();
  }, []);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (newMessage.trim() && !sendingMessage && recipient) {
      try {
        await sendMessage(recipient._id, 'text', newMessage.trim());
        setNewMessage('');
      } catch (error) {
        console.error('Failed to send message:', error);
      }
    }
  };

  const handleSendWink = async () => {
    if (!sendingMessage && recipient) {
      try {
        await sendMessage(recipient._id, 'wink', '😉');
      } catch (error) {
        console.error('Failed to send wink:', error);
      }
    }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (e.target.value.trim() && recipient) {
        sendTyping(recipient._id);
      }
    }, 300);
  };

  const isTyping =
    recipient &&
    typingUsers[recipient._id] &&
    Date.now() - typingUsers[recipient._id] < 3000;

  // Group messages by date
  const groupMessagesByDate = () => {
    const groups = {};
    messages.forEach((message) => {
      const date = new Date(message.createdAt).toLocaleDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
    });
    return groups;
  };

  const messageGroups = groupMessagesByDate();

  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

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
          Object.entries(messageGroups).map(([date, msgs]) => (
            <div key={date} className="message-group">
              <div className="message-date">
                <span>{date}</span>
              </div>
              {msgs.map((message) => (
                <div
                  key={message._id}
                  className={`message ${message.sender === user._id ? 'sent' : 'received'}`}
                >
                  {message.type === 'text' && (
                    <>
                      <p className="message-content">{message.content}</p>
                      <span className="message-time">
                        {formatMessageTime(message.createdAt)}
                      </span>
                    </>
                  )}
                  {message.type === 'wink' && (
                    <p className="message-content">😉 (Wink)</p>
                  )}
                  {message.type === 'video' && (
                    <p className="video-msg">
                      <FaVideo /> Video Call
                    </p>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
        {isTyping && (
          <div className="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        )}
        {messageError && (
          <div className="message-error">
            <p>{messageError}</p>
            <button onClick={clearError}>
              <FaTimes />
            </button>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="message-form" onSubmit={handleSendMessage}>
        <button type="button" className="input-attachment">
          <FaPaperclip />
        </button>
        <input
          type="text"
          placeholder="Type a message..."
          value={newMessage}
          onChange={handleTyping}
          disabled={sendingMessage}
          ref={chatInputRef}
        />
        <button
          type="button"
          className="input-emoji"
          onClick={() => setShowEmojis(!showEmojis)}
        >
          <FaSmile />
        </button>
        {showEmojis && (
          <div className="emoji-picker">
            <div className="emoji-header d-flex justify-content-between align-items-center mb-2">
              <h4>Emojis</h4>
              <button className="close-emojis" onClick={() => setShowEmojis(false)}>
                <FaTimes />
              </button>
            </div>
            <div className="d-flex flex-wrap" style={{ gap: '8px' }}>
              {commonEmojis.map((emoji) => (
                <button
                  key={emoji}
                  className="btn btn-sm btn-subtle"
                  type="button"
                  onClick={() => {
                    setNewMessage((prev) => prev + emoji);
                    setShowEmojis(false);
                    chatInputRef.current?.focus();
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
        <button
          type="submit"
          className="input-send"
          disabled={!newMessage.trim() || sendingMessage}
        >
          {sendingMessage ? <FaSpinner className="fa-spin" /> : <FaPaperPlane />}
        </button>
      </form>
    </div>
  );
};

export const VideoCall = ({ peer, isIncoming, onAnswer, onDecline, onEnd }) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    const setupMediaStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
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
      if (localStream) localStream.getTracks().forEach(track => track.stop());
      if (remoteStream) remoteStream.getTracks().forEach(track => track.stop());
    };
  }, []);

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
              <p>
                {connectionStatus === 'connecting'
                  ? 'Connecting...'
                  : connectionStatus === 'awaiting'
                  ? 'Waiting for connection...'
                  : 'Connection failed'}
              </p>
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
            <button className="answer-btn" onClick={onAnswer} disabled={connectionStatus === 'error'}>
              Answer
            </button>
            <button className="decline-btn" onClick={onDecline}>
              Decline
            </button>
          </>
        ) : (
          <button className="end-call-btn" onClick={onEnd}>
            End Call
          </button>
        )}
      </div>
    </div>
  );
};

export const Spinner = () => (
  <div className="spinner-container">
    <div className="spinner"></div>
  </div>
);
