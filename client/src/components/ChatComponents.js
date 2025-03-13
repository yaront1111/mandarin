import React, { useState, useEffect, useRef } from 'react';
import { useAuth, useChat } from '../context';
import { FaHeart, FaVideo, FaEnvelope } from 'react-icons/fa';

// Chat Box Component
export const ChatBox = ({ recipient }) => {
  const { user } = useAuth();
  const { messages, sendMessage, sendTyping, typingUsers, initiateVideoCall } = useChat();
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = e => {
    e.preventDefault();
    if (newMessage.trim()) {
      sendMessage(recipient._id, 'text', newMessage);
      setNewMessage('');
    }
  };

  const handleSendWink = () => {
    sendMessage(recipient._id, 'wink', '😉');
  };

  const handleTyping = e => {
    setNewMessage(e.target.value);
    sendTyping(recipient._id);
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
            title="Send Wink"
          >
            <FaHeart />
          </button>
          <button
            className="action-btn video-btn"
            onClick={() => initiateVideoCall(recipient._id)}
            title="Start Video Call"
          >
            <FaVideo />
          </button>
        </div>
      </div>

      <div className="messages-container">
        {messages.map((message, index) => (
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
        ))}
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
        />
        <button type="submit" className="send-btn">
          <FaEnvelope />
        </button>
      </form>
    </div>
  );
};

// Video Call Component
export const VideoCall = ({ peer, isIncoming, onAnswer, onDecline, onEnd }) => {
  const [localStream, setLocalStream] = useState(null);
  // remoteStream removed since it is unused
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

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
      } catch (err) {
        console.error('Error accessing media devices:', err);
      }
    };

    setupMediaStream();

    // We only want to run this on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isIncoming]);

  return (
    <div className="video-call-container">
      <div className="video-grid">
        <div className="remote-video">
          {/* Always show connecting placeholder */}
          <div className="connecting">
            <p>Connecting...</p>
          </div>
        </div>
        <div className="local-video">
          <video ref={localVideoRef} autoPlay playsInline muted />
        </div>
      </div>

      <div className="call-controls">
        {isIncoming ? (
          <>
            <button className="answer-btn" onClick={onAnswer}>Answer</button>
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
