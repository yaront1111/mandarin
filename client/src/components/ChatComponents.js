// client/src/components/ChatComponents.js

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  memo
} from 'react';
import { useAuth, useChat } from '../context';
import {
  FaHeart,
  FaVideo,
  FaCheckDouble,
  FaCheck,
  FaTimes,
  FaSmile,
  FaPaperPlane,
  FaPaperclip,
  FaSpinner
} from 'react-icons/fa';
import { toast } from 'react-toastify';

// Common emojis available for the emoji picker.
const commonEmojis = ['😊', '😂', '😍', '❤️', '👍', '🙌', '🔥', '✨', '🎉', '🤔', '😉', '🥰'];

/**
 * Individual message component, memoized to avoid unnecessary re-renders.
 */
const Message = memo(({ message, currentUserId, formattedTime }) => {
  const isSentByCurrentUser = message.sender === currentUserId;
  return (
    <div className={`message ${isSentByCurrentUser ? 'sent' : 'received'}`}>
      {message.type === 'text' && (
        <>
          <p className="message-content">{message.content}</p>
          <span className="message-time">
            {formattedTime}
            {isSentByCurrentUser &&
              (message.read ? (
                <FaCheckDouble style={{ marginLeft: '4px' }} />
              ) : (
                <FaCheck style={{ marginLeft: '4px' }} />
              ))}
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
  );
});

/**
 * Date divider for grouping messages.
 */
const MessageDateDivider = memo(({ date }) => (
  <div className="message-date">
    <span>{date}</span>
  </div>
));

/**
 * Typing indicator component.
 */
const TypingIndicator = memo(() => (
  <div className="typing-indicator">
    <span></span>
    <span></span>
    <span></span>
  </div>
));

/**
 * ChatBox component with virtualized scrolling.
 */
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
  const [visibleMessages, setVisibleMessages] = useState([]);
  const [scrollPosition, setScrollPosition] = useState(0);

  const messagesEndRef = useRef(null);
  const chatInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const messageContainerRef = useRef(null);

  // Memoized formatting for message time to avoid recalculation on each render.
  const formatMessageTime = useCallback((timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  // Throttled scroll handler updates the scroll position state.
  const handleScroll = useCallback(() => {
    if (messageContainerRef.current) {
      setScrollPosition(messageContainerRef.current.scrollTop);
    }
  }, []);

  // Setup throttled scroll listener.
  useEffect(() => {
    const container = messageContainerRef.current;
    if (!container) return;
    let scrollTimeout;
    const throttledScroll = () => {
      if (!scrollTimeout) {
        scrollTimeout = setTimeout(() => {
          handleScroll();
          scrollTimeout = null;
        }, 100);
      }
    };
    container.addEventListener('scroll', throttledScroll);
    return () => {
      container.removeEventListener('scroll', throttledScroll);
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  }, [handleScroll]);

  // Virtualize messages: calculate and render only the messages in view (with a buffer).
  useEffect(() => {
    if (!messageContainerRef.current || messages.length === 0) return;
    const container = messageContainerRef.current;
    const containerHeight = container.clientHeight;
    const messageHeight = 80; // Approximate height (in pixels) per message.
    const buffer = 5; // Extra messages above and below the view.
    const startIndex = Math.max(
      0,
      Math.floor(scrollPosition / messageHeight) - buffer
    );
    const endIndex = Math.min(
      messages.length - 1,
      Math.ceil((scrollPosition + containerHeight) / messageHeight) + buffer
    );
    setVisibleMessages(messages.slice(startIndex, endIndex + 1));
  }, [messages, scrollPosition]);

  // Auto-scroll to bottom when new messages arrive, if user is near the bottom.
  useEffect(() => {
    if (messageContainerRef.current) {
      const { scrollHeight, scrollTop, clientHeight } = messageContainerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;
      if (isNearBottom) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages]);

  // Handler for sending text messages.
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

  // Handler for sending a wink.
  const handleSendWink = async () => {
    if (!sendingMessage && recipient) {
      try {
        await sendMessage(recipient._id, 'wink', '😉');
      } catch (error) {
        console.error('Failed to send wink:', error);
      }
    }
  };

  // Handler for typing events, with a debounce to avoid too many calls.
  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (e.target.value.trim() && recipient) {
        sendTyping(recipient._id);
      }
    }, 300);
  };

  // Check if the recipient is currently typing.
  const isTyping =
    recipient &&
    typingUsers[recipient._id] &&
    Date.now() - typingUsers[recipient._id] < 3000;

  /**
   * Render visible messages while inserting date dividers when the date changes.
   */
  const renderMessages = () => {
    let lastDate = '';
    return visibleMessages.map((message) => {
      const messageDate = new Date(message.createdAt).toLocaleDateString();
      const divider =
        messageDate !== lastDate ? (
          <MessageDateDivider key={`divider-${message._id}`} date={messageDate} />
        ) : null;
      lastDate = messageDate;
      return (
        <React.Fragment key={message._id}>
          {divider}
          <Message
            message={message}
            currentUserId={user._id}
            formattedTime={formatMessageTime(message.createdAt)}
          />
        </React.Fragment>
      );
    });
  };

  return (
    <div className="chat-box">
      {/* Chat header */}
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

      {/* Messages container with virtualization */}
      <div className="messages-container" ref={messageContainerRef}>
        {messages.length === 0 ? (
          <div className="no-messages">
            <p>No messages yet. Say hello!</p>
          </div>
        ) : (
          renderMessages()
        )}
        {isTyping && <TypingIndicator />}
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

      {/* Message input form */}
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
            <div className="emoji-header">
              <h4>Emojis</h4>
              <button onClick={() => setShowEmojis(false)}>
                <FaTimes />
              </button>
            </div>
            <div className="emoji-list">
              {commonEmojis.map((emoji) => (
                <button
                  key={emoji}
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

/**
 * VideoCall component to manage local/remote streams and call controls.
 */
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

/**
 * Spinner component to indicate loading.
 */
export const Spinner = () => (
  <div className="spinner-container">
    <div className="spinner"></div>
  </div>
);
