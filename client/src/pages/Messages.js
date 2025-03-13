import React, { useState, useEffect, useRef } from 'react';
import { FaSearch, FaEllipsisV, FaVideo, FaPhone, FaSmile, FaPaperPlane,
         FaHeart, FaImage, FaUserCircle, FaArrowLeft, FaTimes, FaCheck,
         FaCheckDouble, FaPaperclip } from 'react-icons/fa';
import { useAuth, useChat, useUser } from '../context';
import { Spinner } from '../components';

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

  // Common emojis for the emoji picker
  const commonEmojis = ['😊', '😂', '😍', '❤️', '👍', '🙌', '🔥', '✨', '🎉', '🤔', '😉', '🥰'];

  // Fetch all users on component mount
  useEffect(() => {
    getUsers();
  }, []);

  // Scroll to bottom of messages when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when selecting a user
  useEffect(() => {
    if (selectedUser) {
      chatInputRef.current?.focus();
    }
  }, [selectedUser]);

  // Handle selecting a user to chat with
  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setCurrentChat(user);
    getMessages(user._id);
  };

  // Handle sending a new message
  const handleSendMessage = async (e) => {
    e?.preventDefault();

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

  // Handle typing in the message input
  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    if (selectedUser) {
      sendTyping(selectedUser._id);
    }
  };

  // Handle inserting an emoji
  const handleEmojiClick = (emoji) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojis(false);
    chatInputRef.current?.focus();
  };

  // Handle sending a wink
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

  // Handle initiating a video call
  const handleVideoCall = () => {
    if (selectedUser) {
      initiateVideoCall(selectedUser._id);
    }
  };

  // Filter users based on search term
  const filteredUsers = users.filter(u =>
    u._id !== user._id &&
    (u.nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
     u.details?.location?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Check if a user has unread messages
  const hasUnreadMessages = (userId) => {
    return unreadMessages.some(msg => msg.sender === userId);
  };

  // Get count of unread messages from a user
  const unreadCount = (userId) => {
    return unreadMessages.filter(msg => msg.sender === userId).length;
  };

  // Format timestamp for messages
  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Format date for message groups
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

  // Group messages by date
  const groupMessagesByDate = () => {
    const groups = {};

    messages.forEach(message => {
      const date = formatMessageDate(message.createdAt);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
    });

    return groups;
  };

  // Check if user is typing
  const isTyping = selectedUser && typingUsers[selectedUser._id] &&
    Date.now() - typingUsers[selectedUser._id] < 3000;

  return (
    <div className="messages-page">
      <div className="messages-container">
        <div className="conversations-panel">
          <div className="conversations-header">
            <h2>Messages</h2>
            <div className="search-conversations">
              <FaSearch className="search-icon" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="conversations-list">
            {filteredUsers.length > 0 ? (
              filteredUsers.map(u => (
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
                    {u.isOnline && <span className="online-indicator"></span>}
                  </div>

                  <div className="conversation-content">
                    <div className="conversation-header">
                      <h3>{u.nickname}</h3>
                      <span className="conversation-time">
                        {unreadMessages.find(msg => msg.sender === u._id)?.createdAt
                          ? formatMessageTime(unreadMessages.find(msg => msg.sender === u._id).createdAt)
                          : u.isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>

                    <div className="conversation-preview">
                      <p>
                        {unreadMessages.find(msg => msg.sender === u._id)?.content ||
                         messages.find(msg => msg.sender === u._id || msg.recipient === u._id)?.content ||
                         'Start a conversation'}
                      </p>

                      {hasUnreadMessages(u._id) && (
                        <span className="unread-badge">{unreadCount(u._id)}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-conversations">
                <p>No conversations found</p>
                {searchTerm && <p>Try a different search term</p>}
              </div>
            )}
          </div>
        </div>

        <div className="chat-panel">
          {selectedUser ? (
            <>
              <div className="chat-header">
                <div className="chat-user-info">
                  <button className="back-button mobile-only" onClick={() => setSelectedUser(null)}>
                    <FaArrowLeft />
                  </button>

                  <div className="chat-avatar">
                    {selectedUser.photos && selectedUser.photos.length > 0 ? (
                      <img src={selectedUser.photos[0].url} alt={selectedUser.nickname} />
                    ) : (
                      <FaUserCircle className="avatar-placeholder" />
                    )}
                    {selectedUser.isOnline && <span className="online-indicator"></span>}
                  </div>

                  <div className="chat-user-details">
                    <h3>{selectedUser.nickname}</h3>
                    <p>{selectedUser.isOnline ? 'Online now' : 'Last seen recently'}</p>
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

              <div className="chat-messages">
                {messages.length === 0 ? (
                  <div className="empty-chat">
                    <div className="empty-chat-graphic">💬</div>
                    <h3>No messages yet</h3>
                    <p>Say hello to {selectedUser.nickname}!</p>
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        setNewMessage(`Hi ${selectedUser.nickname}! I'd love to chat with you.`);
                        chatInputRef.current?.focus();
                      }}
                    >
                      Start Conversation
                    </button>
                  </div>
                ) : (
                  <div className="messages-content">
                    {Object.entries(groupMessagesByDate()).map(([date, dateMessages]) => (
                      <div key={date} className="message-group">
                        <div className="message-date-divider">
                          <span>{date}</span>
                        </div>

                        {dateMessages.map((message, index) => (
                          <div
                            key={message._id || index}
                            className={`message ${message.sender === user._id ? 'outgoing' : 'incoming'}`}
                          >
                            {message.type === 'text' && (
                              <div className="message-bubble">
                                <p>{message.content}</p>
                                <div className="message-meta">
                                  <span className="message-time">
                                    {formatMessageTime(message.createdAt)}
                                  </span>
                                  {message.sender === user._id && (
                                    <span className="message-status">
                                      {message.read ? (
                                        <FaCheckDouble className="read-icon" />
                                      ) : (
                                        <FaCheck className="sent-icon" />
                                      )}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {message.type === 'wink' && (
                              <div className="special-message wink">
                                <div className="special-icon">😉</div>
                                <p>
                                  {message.sender === user._id
                                    ? `You sent a wink`
                                    : `${selectedUser.nickname} sent you a wink`}
                                </p>
                                <span className="message-time">
                                  {formatMessageTime(message.createdAt)}
                                </span>
                              </div>
                            )}

                            {message.type === 'video' && (
                              <div className="special-message video">
                                <div className="special-icon">🎥</div>
                                <p>
                                  {message.sender === user._id
                                    ? `You started a video call`
                                    : `${selectedUser.nickname} started a video call`}
                                </p>
                                <span className="message-time">
                                  {formatMessageTime(message.createdAt)}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}

                    {isTyping && (
                      <div className="typing-indicator">
                        <div className="typing-dots">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                        <p>{selectedUser.nickname} is typing...</p>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              <div className="chat-input-container">
                <button
                  className="attachment-button"
                  title="Attach a file"
                >
                  <FaPaperclip />
                </button>

                <form className="chat-input-form" onSubmit={handleSendMessage}>
                  <input
                    type="text"
                    placeholder={`Message ${selectedUser.nickname}...`}
                    value={newMessage}
                    onChange={handleTyping}
                    ref={chatInputRef}
                  />

                  <div className="input-actions">
                    <button
                      type="button"
                      className="emoji-button"
                      onClick={() => setShowEmojis(!showEmojis)}
                      title="Insert emoji"
                    >
                      <FaSmile />
                    </button>

                    {showEmojis && (
                      <div className="emoji-picker">
                        <div className="emoji-header">
                          <h4>Quick Emojis</h4>
                          <button
                            className="close-emojis"
                            onClick={() => setShowEmojis(false)}
                          >
                            <FaTimes />
                          </button>
                        </div>
                        <div className="emojis-grid">
                          {commonEmojis.map(emoji => (
                            <button
                              key={emoji}
                              className="emoji-item"
                              onClick={() => handleEmojiClick(emoji)}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="send-button"
                    disabled={!newMessage.trim() || isSending}
                    title="Send message"
                  >
                    <FaPaperPlane />
                  </button>
                </form>

                <button
                  className="special-action-button"
                  onClick={handleSendWink}
                  disabled={isSending}
                  title="Send a wink"
                >
                  <FaHeart />
                </button>

                <button
                  className="special-action-button"
                  title="Send an image"
                >
                  <FaImage />
                </button>
              </div>
            </>
          ) : (
            <div className="empty-chat-placeholder">
              <div className="placeholder-icon">💬</div>
              <h2>Select a conversation</h2>
              <p>Choose a conversation from the left to start chatting</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Messages;
