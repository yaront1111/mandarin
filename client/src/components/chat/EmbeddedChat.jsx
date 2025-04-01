import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context';
import { toast } from 'react-toastify';
import { logger } from '../../utils';
import useChat from '../../hooks/useChat';
import VideoCall from '../VideoCall';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import { ErrorMessage, withErrorBoundary } from '../common';
import socketService from '../../services/socketService.jsx';

// Create a logger for this component
const log = logger.create('EmbeddedChat');

/**
 * EmbeddedChat component - Main chat interface component
 * 
 * @param {Object} props - Component props
 * @param {Object} props.recipient - Recipient user object
 * @param {boolean} props.isOpen - Whether the chat is open
 * @param {Function} props.onClose - Function to call when chat is closed
 * @param {boolean} props.embedded - Whether the chat is embedded in another component
 * @returns {React.ReactElement} The chat component
 */
const EmbeddedChat = ({ 
  recipient, 
  isOpen = true, 
  onClose, 
  embedded = true 
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Use the chat hook
  const {
    messages,
    loading,
    sending,
    error,
    sendMessage,
    sendTyping,
    typingStatus,
    refresh
  } = useChat(recipient?._id);
  
  // Local state
  const [newMessage, setNewMessage] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Video call state
  const [activeCall, setActiveCall] = useState(false);
  const [isCallInitiator, setIsCallInitiator] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  
  // Socket reference for call handling
  const socketRef = useRef(null);
  
  // Set up socket reference on mount
  useEffect(() => {
    if (socketService.socket) {
      log.debug('Socket reference obtained');
      socketRef.current = socketService.socket;
      
      // Handle call events
      const handleCallAnswered = (data) => {
        log.debug('Call answer received:', data);
        if (!data.accept && activeCall) {
          setActiveCall(false);
          toast.info('Call was declined');
        }
      };
      
      const handleIncomingCall = (data) => {
        try {
          if (!data) {
            log.error('Received empty call data');
            return;
          }
          
          const callerId = (data.caller && (data.caller.userId || data.caller._id)) || 
                          data.userId || 
                          (data.from && data.from.userId);
          
          if (!callerId) {
            log.error('Caller ID not found in incoming call data', data);
            return;
          }
          
          // Only handle calls from current recipient
          if (callerId === recipient?._id) {
            setIncomingCall(data);
            log.debug('Incoming call state set from recipient', data);
          }
        } catch (error) {
          log.error('Error handling incoming call:', error);
        }
      };
      
      // Set up event listeners
      socketRef.current.on('callAnswered', handleCallAnswered);
      socketRef.current.on('incomingCall', handleIncomingCall);
      
      return () => {
        if (socketRef.current) {
          socketRef.current.off('callAnswered', handleCallAnswered);
          socketRef.current.off('incomingCall', handleIncomingCall);
        }
      };
    } else {
      log.warn('Socket connection not available');
    }
  }, [activeCall, recipient]);
  
  // Handle text message sending
  const handleSendMessage = async () => {
    if (attachment) {
      await handleSendFileMessage();
      return;
    }
    
    if (!newMessage.trim()) return;
    
    try {
      log.debug(`Sending text message to ${recipient?.nickname || recipient?._id}`);
      await sendMessage(newMessage, 'text');
      setNewMessage('');
    } catch (error) {
      log.error('Failed to send message:', error);
      toast.error('Failed to send message. Please try again.');
    }
  };
  
  // Handle file message sending
  const handleSendFileMessage = async () => {
    if (!attachment) return;
    
    try {
      setIsUploading(true);
      
      // First upload the file
      const formData = new FormData();
      formData.append('file', attachment);
      
      // Upload progress tracking
      const onUploadProgress = (event) => {
        const progress = Math.round((event.loaded * 100) / event.total);
        setUploadProgress(progress);
      };
      
      log.debug(`Uploading file: ${attachment.name}`);
      
      // Use your API service to upload the file
      const response = await fetch(`/api/messages/attachments`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload file');
      }
      
      const fileData = await response.json();
      
      if (!fileData.success) {
        throw new Error(fileData.error || 'Failed to upload file');
      }
      
      // Prepare file metadata
      const metadata = {
        fileUrl: fileData.data.url,
        fileName: fileData.data.fileName || attachment.name,
        fileSize: fileData.data.fileSize || attachment.size,
        mimeType: fileData.data.mimeType || attachment.type,
        ...fileData.data.metadata
      };
      
      // Send the message with file attachment
      await sendMessage(fileData.data.fileName || attachment.name, 'file', metadata);
      
      // Clear attachment after sending
      setAttachment(null);
      setUploadProgress(0);
      
    } catch (error) {
      log.error('Failed to send file message:', error);
      toast.error('Failed to send file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };
  
  // Handle video call initiation
  const handleVideoCall = () => {
    if (!socketRef.current) {
      log.error('Cannot start call: No connection available');
      toast.error('Cannot connect to video service');
      return;
    }
    
    if (activeCall) {
      log.debug('Call already in progress');
      return;
    }
    
    if (recipient?._id) {
      log.debug(`Starting video call with ${recipient.nickname}...`);
      setIsCallInitiator(true);
      setActiveCall(true);
      
      // Emit call initiation
      socketRef.current.emit('initiateCall', {
        recipientId: recipient._id,
        callType: 'video',
        userId: user._id,
        callId: `call-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        caller: { userId: user._id, name: user.nickname || 'User' }
      });
      
      // Send a message about the call
      sendMessage('Video Call', 'video').catch(error => {
        log.error('Failed to send video call message:', error);
      });
    } else {
      log.error('Cannot start call: recipient information is missing');
      toast.error('Cannot start call: missing recipient information');
    }
  };
  
  // Handle accepting an incoming call
  const handleAcceptCall = () => {
    log.debug('Accepting incoming call', incomingCall);
    if (!incomingCall || !socketRef.current) return;
    
    const callerId = incomingCall.caller?.userId || incomingCall.userId;
    const callId = incomingCall.callId;
    
    // Emit acceptance
    socketRef.current.emit('answerCall', {
      callerId,
      accept: true,
      callId,
      userId: user._id
    });
    
    // Set call state
    setIsCallInitiator(false);
    setActiveCall(true);
    setIncomingCall(null);
  };
  
  // Handle declining an incoming call
  const handleDeclineCall = () => {
    log.debug('Declining incoming call');
    if (!incomingCall || !socketRef.current) return;
    
    const callerId = incomingCall.caller?.userId || incomingCall.userId;
    const callId = incomingCall.callId;
    
    // Emit declination
    socketRef.current.emit('answerCall', {
      callerId,
      accept: false,
      callId,
      userId: user._id
    });
    
    // Clear incoming call state
    setIncomingCall(null);
  };
  
  // Handle ending an active call
  const handleEndCall = () => {
    log.debug('Ending call');
    setActiveCall(false);
    setIsCallInitiator(false);
  };
  
  // Handle selecting a file attachment
  const handleFileSelect = (file) => {
    if (!file) return;
    
    // Validate file size
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File is too large (max 5MB)');
      return;
    }
    
    // Validate file type
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png', 
      'image/gif',
      'application/pdf',
      'text/plain',
      'audio/mpeg',
      'audio/wav',
      'video/mp4',
      'video/quicktime'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      toast.error('Unsupported file type');
      return;
    }
    
    setAttachment(file);
  };
  
  // Clear file attachment
  const handleClearAttachment = () => {
    if (isUploading) return;
    setAttachment(null);
    setUploadProgress(0);
  };
  
  // If the chat is closed or no recipient, don't render
  if (!isOpen || !recipient) return null;
  
  return (
    <div className={`embedded-chat ${embedded ? 'embedded' : 'full-page'}`}>
      <div className="chat-container">
        <ChatHeader 
          recipient={recipient}
          onClose={onClose}
          onVideoCall={handleVideoCall}
          embedded={embedded}
        />
        
        <MessageList 
          messages={messages}
          currentUser={user}
          isLoading={loading}
          error={error}
          onRetry={refresh}
          typingIndicator={typingStatus}
          recipient={recipient}
        />
        
        <MessageInput 
          value={newMessage}
          onChange={setNewMessage}
          onSend={handleSendMessage}
          onTyping={sendTyping}
          onFileSelect={handleFileSelect}
          attachment={attachment}
          onClearAttachment={handleClearAttachment}
          isUploading={isUploading}
          uploadProgress={uploadProgress}
        />
      </div>
      
      {/* Incoming call dialog */}
      {incomingCall && (
        <div className="incoming-call-dialog">
          <div className="incoming-call-content">
            <div className="incoming-caller">
              <div className="call-avatar">
                {(incomingCall.caller?.name || 'User').charAt(0)}
              </div>
              <div className="caller-info">
                <h3>{incomingCall.caller?.name || 'User'}</h3>
                <p>Incoming video call...</p>
              </div>
            </div>
            <div className="call-actions">
              <button className="decline-button" onClick={handleDeclineCall}>
                Decline
              </button>
              <button className="accept-button" onClick={handleAcceptCall}>
                Accept
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Video call component */}
      {activeCall && (
        <VideoCall 
          recipient={recipient}
          isInitiator={isCallInitiator}
          onEnd={handleEndCall}
        />
      )}
      
      {/* Add styling */}
      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        
        .pulse {
          animation: pulse 1s infinite;
        }
        
        .embedded-chat {
          display: flex;
          flex-direction: column;
          height: 500px;
          width: 350px;
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 1000;
          border-radius: 10px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          background-color: var(--bg-card);
          animation: slide-in-bottom 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
        }
        
        .embedded-chat.full-page {
          position: relative;
          width: 100%;
          height: 100%;
          bottom: auto;
          right: auto;
          border-radius: 0;
          box-shadow: none;
          animation: none;
        }
        
        .chat-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          width: 100%;
        }
        
        .incoming-call-dialog {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.75);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
        }
        
        .incoming-call-content {
          background-color: var(--bg-card);
          border-radius: 12px;
          padding: 1.5rem;
          width: 90%;
          max-width: 300px;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        
        .incoming-caller {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        
        .call-avatar {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background-color: var(--primary);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.8rem;
          font-weight: bold;
        }
        
        .caller-info h3 {
          margin: 0;
          font-size: 1.2rem;
          font-weight: 600;
        }
        
        .caller-info p {
          margin: 0.25rem 0 0;
          font-size: 0.9rem;
          color: var(--text-light);
        }
        
        .call-actions {
          display: flex;
          gap: 1rem;
        }
        
        .call-actions button {
          flex: 1;
          padding: 0.75rem;
          border-radius: 8px;
          border: none;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .decline-button {
          background-color: var(--danger-light);
          color: var(--danger);
        }
        
        .accept-button {
          background-color: var(--success);
          color: white;
        }
        
        .decline-button:hover {
          background-color: var(--danger);
          color: white;
        }
        
        .accept-button:hover {
          background-color: var(--success-dark);
        }
        
        @keyframes slide-in-bottom {
          0% {
            transform: translateY(100px);
            opacity: 0;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }
        
        /* Dark mode */
        .dark .incoming-call-content {
          background-color: var(--dark);
        }
        
        .dark .decline-button {
          background-color: rgba(220, 53, 69, 0.2);
        }
        
        @media (max-width: 768px) {
          .embedded-chat {
            width: 100%;
            height: 100%;
            bottom: 0;
            right: 0;
            border-radius: 0;
            box-shadow: none;
          }
        }
      `}</style>
    </div>
  );
};

// Wrap component with error boundary
const WrappedEmbeddedChat = withErrorBoundary(EmbeddedChat);

// Default export
export default WrappedEmbeddedChat;

// Named export for consistent imports with index.js
export { WrappedEmbeddedChat as EmbeddedChat };