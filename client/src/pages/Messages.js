// client/src/pages/Messages.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  FaPaperclip
} from 'react-icons/fa';
import { useAuth, useChat, useUser } from '../context';

const Messages = () => {
  const { user } = useAuth();
  const { users, getUsers } = useUser();
  const {
    messages,
    unreadMessages,
    getMessages,
    sendMessage,
    setCurrentChat,
    sendTyping,
    typingUsers,
    initiateVideoCall
  } = useChat();

  const [selectedUser, setSelectedUser] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);

  const messagesEndRef = useRef(null);
  const chatInputRef = useRef(null);

  const commonEmojis = ['😊', '😂', '😍', '❤️', '👍', '🙌', '🔥', '✨', '🎉', '🤔', '😉', '🥰'];

  // Fetch the users list on mount.
  useEffect(() => {
    getUsers();
  }, [getUsers]);

  // Auto-scroll to the bottom whenever messages change.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus the chat input when a user is selected.
  useEffect(() => {
    if (selectedUser) {
      chatInputRef.current?.focus();
    }
  }, [selectedUser]);

  // When the component unmounts or the selected user changes, clear the current chat.
  useEffect(() => {
    return () => {
      if (selectedUser) {
        setCurrentChat(null);
      }
    };
  }, [selectedUser, setCurrentChat]);

  // When a conversation is selected, update state and fetch messages.
  const handleSelectUser = (u) => {
    setSelectedUser(u);
    setCurrentChat(u);
    getMessages(u._id);
  };

  // Send a text message.
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (newMessage.trim() && !isSending && selectedUser) {
      setIsSending(true);
      try {
        await sendMessage(selectedUser._id, 'text', newMessage.trim());
        setNewMessage('');
      } catch (error) {
        console.error('Failed to send message:', error);
      } finally {
        setIsSending(false);
      }
    }
  };

  // Handle typing: update message state and send a typing event.
  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    if (selectedUser) {
      sendTyping(selectedUser._id);
    }
  };

  // Append an emoji to the message and focus the input.
  const handleEmojiClick = (emoji) => {
    setNewMessage((prev) => prev + emoji);
    setShowEmojis(false);
    chatInputRef.current?.focus();
  };

  // Send a "wink" message.
  const handleSendWink = async () => {
    if (!isSending && selectedUser) {
      setIsSending(true);
      try {
        await sendMessage(selectedUser._id, 'wink', '😉');
      } catch (error) {
        console.error('Failed to send wink:', error);
      } finally {
        setIsSending(false);
      }
    }
  };

  // Initiate a video call.
  const handleVideoCall = () => {
    if (selectedUser) {
      initiateVideoCall(selectedUser._id);
    }
  };

  // Filter out the current user from the list and filter by search term.
  const filteredUsers = users.filter(
    (u) =>
      u._id !== user._id &&
      (u.nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.details?.location &&
          u.details.location.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  // Helpers for unread messages.
  const hasUnreadMessages = (userId) =>
    unreadMessages.some((msg) => msg.sender === userId);

  const unreadCount = (userId) =>
    unreadMessages.filter((msg) => msg.sender === userId).length;

  // Format time for display.
  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Format the message date header.
  const formatMessageDate = (timestamp) => {
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

  // Group messages by date.
  const groupMessagesByDate = () => {
    const groups = {};
    messages.forEach((message) => {
      const date = formatMessageDate(message.createdAt);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
    });
    return groups;
  };

  // Check if the selected user is typing.
  const isTyping =
    selectedUser &&
    typingUsers[selectedUser._id] &&
    Date.now() - typingUsers[selectedUser._id] < 3000;

  return (
    <div className="messages-layout">
      {/* Conversations List */}
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
        {filteredUsers.length > 0 ? (
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
                      {unreadMessages.find((msg) => msg.sender === u._id)?.createdAt
                        ? formatMessageTime(
                            unreadMessages.find((msg) => msg.sender === u._id).createdAt
                          )
                        : ''}
                    </span>
                  </div>
                  <div className="d-flex align-items-center">
                    <p className="last-message mb-0">
                      {unreadMessages.find((msg) => msg.sender === u._id)?.content ||
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

      {/* Chat Area */}
      <div className="chat-area">
        {selectedUser ? (
          <>
            {/* Chat Header */}
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

            {/* Messages Container */}
            <div className="messages-container">
              {Object.entries(groupMessagesByDate()).map(([date, msgs]) => (
                <React.Fragment key={date}>
                  <div className="message-date">{date}</div>
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
                            {message.sender === user._id &&
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
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="message-input">
              <button className="input-attachment">
                <FaPaperclip />
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
                          onClick={() => {
                            handleEmojiClick(emoji);
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
                  disabled={!newMessage.trim() || isSending}
                >
                  <FaPaperPlane />
                </button>
              </form>
              <button className="input-attachment" onClick={handleSendWink} disabled={isSending}>
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
