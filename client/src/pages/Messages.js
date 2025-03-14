// client/src/pages/Messages.js

import React, { useState, useEffect, useRef } from 'react';
import {
  FaSearch,
  FaEllipsisV,
  FaVideo,
  FaPhone,
  FaSmile,
  FaPaperPlane,
  FaHeart,
  FaImage,
  FaUserCircle,
  FaArrowLeft,
  FaTimes,
  FaCheckDouble,
  FaCheck,
  FaPaperclip,
  FaMapMarkerAlt
} from 'react-icons/fa';
import { useAuth, useChat, useUser } from '../context';
import { toast } from 'react-toastify';

const Messages = () => {
  const { user } = useAuth();
  const { users, getUsers, loading: usersLoading } = useUser();
  const {
    messages,
    unreadMessages = [], // Provide default empty array
    getMessages,
    sendMessage,
    sendLocationMessage,
    setCurrentChat,
    sendTyping,
    typingUsers = {}, // Provide default empty object
    initiateVideoCall,
    sending: sendingMessage,
    error: messageError
  } = useChat();

  const [selectedUser, setSelectedUser] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const messagesEndRef = useRef(null);
  const chatInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Safely access or initialize arrays/objects
  const safeUsers = Array.isArray(users) ? users : [];
  const safeMessages = Array.isArray(messages) ? messages : [];
  const safeUnreadMessages = Array.isArray(unreadMessages) ? unreadMessages : [];

  useEffect(() => {
    getUsers();
  }, [getUsers]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [safeMessages]);

  useEffect(() => {
    if (selectedUser) chatInputRef.current?.focus();
  }, [selectedUser]);

  useEffect(() => {
    return () => {
      if (selectedUser) setCurrentChat?.(null);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [selectedUser, setCurrentChat]);

  const handleSelectUser = (u) => {
    setSelectedUser(u);
    if (setCurrentChat) setCurrentChat(u);
    if (getMessages) getMessages(u._id);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (newMessage.trim() && !sendingMessage && selectedUser) {
      try {
        await sendMessage(selectedUser._id, 'text', newMessage.trim());
        setNewMessage('');
      } catch (error) {
        console.error('Failed to send message:', error);
        toast.error(error.message || 'Failed to send message');
      }
    }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (selectedUser && e.target.value.trim() && sendTyping) {
        sendTyping(selectedUser._id);
      }
    }, 300);
  };

  const handleEmojiClick = (emoji) => {
    setNewMessage((prev) => prev + emoji);
    setShowEmojis(false);
    chatInputRef.current?.focus();
  };

  const handleSendWink = async () => {
    if (!sendingMessage && selectedUser) {
      try {
        await sendMessage(selectedUser._id, 'wink', '😉');
      } catch (error) {
        console.error('Failed to send wink:', error);
        toast.error(error.message || 'Failed to send wink');
      }
    }
  };

  const handleShareLocation = async () => {
    if (!sendingMessage && selectedUser) {
      try {
        if (!navigator.geolocation) {
          toast.error('Geolocation is not supported by your browser');
          return;
        }

        toast.info('Getting your location...');

        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              const locationData = {
                coordinates: [position.coords.longitude, position.coords.latitude],
                name: 'My Current Location'
              };

              // Use the specialized sendLocationMessage function
              const result = await sendLocationMessage(selectedUser._id, locationData);

              if (!result) {
                toast.error('Failed to share location');
              } else {
                toast.success('Location shared successfully');
              }
            } catch (err) {
              console.error('Location sharing error:', err);
              toast.error(err.message || 'Failed to share location');
            }
          },
          (err) => {
            let errorMessage = 'Could not get your location';

            switch(err.code) {
              case err.PERMISSION_DENIED:
                errorMessage = 'Location access was denied';
                break;
              case err.POSITION_UNAVAILABLE:
                errorMessage = 'Location information is unavailable';
                break;
              case err.TIMEOUT:
                errorMessage = 'Location request timed out';
                break;
            }

            toast.error(errorMessage);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        );
      } catch (error) {
        console.error('Failed to share location:', error);
        toast.error(error.message || 'Failed to share location');
      }
    }
  };

  const handleVideoCall = () => {
    if (initiateVideoCall && selectedUser) {
      initiateVideoCall(selectedUser._id);
    }
  };

  // Filter users safely
  const filteredUsers = safeUsers.filter(
    (u) => {
      if (!u || !user) return false;

      return (
        u._id !== user._id &&
        (u.nickname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (u.details?.location &&
            u.details.location.toLowerCase().includes(searchTerm.toLowerCase())))
      );
    }
  );

  // Safely determine if a user has unread messages
  const hasUnreadMessages = (userId) => {
    return safeUnreadMessages.some((msg) => msg.sender === userId);
  };

  // Safely count unread messages
  const unreadCount = (userId) => {
    return safeUnreadMessages.filter((msg) => msg.sender === userId).length;
  };

  const formatMessageTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatMessageDate = (timestamp) => {
    if (!timestamp) return 'Unknown date';
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  // Safely group messages by date
  const groupMessagesByDate = () => {
    const groups = {};
    safeMessages.forEach((message) => {
      if (message && message.createdAt) {
        const date = formatMessageDate(message.createdAt);
        if (!groups[date]) {
          groups[date] = [];
        }
        groups[date].push(message);
      }
    });
    return groups;
  };

  // Safely check if a user is typing
  const isTyping = selectedUser &&
                  typingUsers &&
                  typingUsers[selectedUser._id] &&
                  Date.now() - typingUsers[selectedUser._id] < 3000;

  // Common emoji list
  const commonEmojis = ['😊', '😂', '😍', '❤️', '👍', '🙌', '🔥', '✨', '🎉', '🤔', '😉', '🥰'];

  return (
    <div className="messages-layout">
      <div className="conversations-list">
        <div className="conversations-header d-flex justify-content-between align-items-center p-3 border-bottom">
          <h3 style={{ margin: 0 }}>Messages</h3>
          <div style={{ cursor: 'pointer' }}>
            <FaEllipsisV />
          </div>
        </div>
        <div className="p-3">
          <div className="input-with-icon">
            <FaSearch className="field-icon" />
            <input
              type="text"
              placeholder="Search..."
              className="form-control"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        {usersLoading ? (
          <div className="p-3 text-center">
            <div className="spinner-border spinner-border-sm" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mb-0 mt-2">Loading users...</p>
          </div>
        ) : filteredUsers.length > 0 ? (
          <div style={{ overflowY: 'auto' }}>
            {filteredUsers.map((u) => (
              <div
                key={u._id}
                className={`conversation-item ${selectedUser?._id === u._id ? 'active' : ''}`}
                onClick={() => handleSelectUser(u)}
              >
                <div className="conversation-avatar">
                  {u.photos && u.photos.length > 0 ? (
                    <img src={u.photos[0].url} alt={u.nickname} />
                  ) : (
                    <FaUserCircle className="avatar-placeholder" />
                  )}
                  {u.isOnline && <span className="online-indicator small"></span>}
                </div>
                <div className="conversation-details">
                  <div className="d-flex justify-content-between align-items-center">
                    <h4>{u.nickname}</h4>
                    <span className="conversation-time">
                      {safeUnreadMessages.find((msg) => msg.sender === u._id)?.createdAt
                        ? formatMessageTime(
                            safeUnreadMessages.find((msg) => msg.sender === u._id).createdAt
                          )
                        : ''}
                    </span>
                  </div>
                  <div className="d-flex align-items-center">
                    <p className="last-message mb-0">
                      {safeUnreadMessages.find((msg) => msg.sender === u._id)?.content ||
                        'Start a conversation'}
                    </p>
                    {hasUnreadMessages(u._id) && (
                      <span className="badge badge-primary" style={{ marginLeft: '8px' }}>
                        {unreadCount(u._id)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-conversations p-3">
            <p>No conversations found.</p>
          </div>
        )}
      </div>
      <div className="chat-area">
        {selectedUser ? (
          <>
            <div className="chat-header">
              <div className="chat-user">
                <button
                  className="back-button mobile-only"
                  onClick={() => setSelectedUser(null)}
                >
                  <FaArrowLeft />
                </button>
                {selectedUser.photos && selectedUser.photos.length > 0 ? (
                  <img
                    src={selectedUser.photos[0].url}
                    alt={selectedUser.nickname}
                    className="chat-avatar"
                  />
                ) : (
                  <FaUserCircle className="chat-avatar avatar-placeholder" />
                )}
                <div>
                  <h3>{selectedUser.nickname}</h3>
                  <p>{selectedUser.isOnline ? 'Online' : 'Offline'}</p>
                </div>
              </div>
              <div className="chat-actions">
                <button className="chat-action-button" onClick={handleVideoCall}>
                  <FaVideo />
                </button>
                <button className="chat-action-button">
                  <FaPhone />
                </button>
                <button className="chat-action-button">
                  <FaEllipsisV />
                </button>
              </div>
            </div>
            <div className="messages-container">
              {Object.entries(groupMessagesByDate()).map(([date, msgs]) => (
                <React.Fragment key={date}>
                  <div className="message-date">{date}</div>
                  {msgs.map((message) => (
                    <div
                      key={message._id}
                      className={`message ${message.sender === user?._id ? 'sent' : 'received'}`}
                    >
                      {message.type === 'text' && (
                        <>
                          <p className="message-content">{message.content}</p>
                          <span className="message-time">
                            {formatMessageTime(message.createdAt)}
                            {message.sender === user?._id &&
                              (message.read ? (
                                <FaCheckDouble style={{ marginLeft: '4px' }} />
                              ) : (
                                <FaCheck style={{ marginLeft: '4px' }} />
                              ))}
                          </span>
                        </>
                      )}
                      {message.type === 'wink' && <p className="message-content">😉 (Wink)</p>}
                      {message.type === 'location' && (
                        <div className="location-message">
                          <div className="location-icon">
                            <FaMapMarkerAlt />
                          </div>
                          <p className="message-content">
                            {message.content || 'Shared location'}
                          </p>
                          <div className="location-link">
                            <a
                              href={`https://www.google.com/maps?q=${message.metadata?.location?.coordinates[1]},${message.metadata?.location?.coordinates[0]}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              View on map
                            </a>
                          </div>
                          <span className="message-time">
                            {formatMessageTime(message.createdAt)}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </React.Fragment>
              ))}
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
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="message-input">
              <button
                className="input-attachment"
                onClick={handleShareLocation}
                title="Share location"
              >
                <FaMapMarkerAlt />
              </button>
              <form className="d-flex flex-grow-1" onSubmit={handleSendMessage}>
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={handleTyping}
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
                          onClick={() => handleEmojiClick(emoji)}
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
                  <FaPaperPlane />
                </button>
              </form>
              <button className="input-attachment" onClick={handleSendWink} disabled={sendingMessage}>
                <FaHeart />
              </button>
              <button className="input-attachment">
                <FaImage />
              </button>
            </div>
          </>
        ) : (
          <div className="empty-chat-placeholder d-flex flex-column align-items-center justify-content-center h-100">
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>💬</div>
            <h4>Select a conversation</h4>
            <p>Choose a conversation from the left or start a new one!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;
