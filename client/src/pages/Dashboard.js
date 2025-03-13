import React, { useState, useEffect } from 'react';
import { useAuth, useUser, useChat } from '../context';
import {
  Navbar,
  Alert,
  UserCard,
  PhotoGallery,
  ChatBox,
  VideoCall,
  UserDetails,
  Spinner
} from '../components';

const Dashboard = () => {
  const { user } = useAuth();
  const { users, getUsers, getUser, currentUser, loading: userLoading } = useUser();
  const { setCurrentChat, currentChat, getMessages, incomingCall, callAnswered, answerVideoCall, endCall } = useChat();
  const [alert, setAlert] = useState(null);
  const [showVideoCall, setShowVideoCall] = useState(false);

  useEffect(() => {
    getUsers();
  }, []);

  useEffect(() => {
    if (incomingCall && !callAnswered) {
      setAlert({
        type: 'info',
        message: `Incoming call from ${incomingCall.userId}`,
        actions: [
          {
            label: 'Answer',
            action: () => {
              answerVideoCall(incomingCall.userId, true);
              setShowVideoCall(true);
            }
          },
          {
            label: 'Decline',
            action: () => {
              answerVideoCall(incomingCall.userId, false);
              endCall();
            }
          }
        ]
      });
    }
  }, [incomingCall, callAnswered]);

  useEffect(() => {
    if (callAnswered) {
      setShowVideoCall(true);
    }
  }, [callAnswered]);

  const handleUserSelect = async selectedUser => {
    await getUser(selectedUser._id);
    setCurrentChat(selectedUser);
    getMessages(selectedUser._id);
  };

  const handleUploadPhoto = (file, isPrivate) => {
    setAlert({ type: 'success', message: 'Photo uploaded successfully!' });
  };

  const handleRequestPhotoAccess = photoId => {
    setAlert({ type: 'info', message: 'Access request sent!' });
  };

  const handleEndCall = () => {
    endCall();
    setShowVideoCall(false);
  };

  if (userLoading) {
    return <Spinner />;
  }

  return (
    <div className="dashboard-page">
      <Navbar />
      {alert && (
        <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} actions={alert.actions} />
      )}
      {showVideoCall && (
        <div className="video-call-overlay">
          <VideoCall
            peer={currentChat || { nickname: 'User' }}
            isIncoming={!!incomingCall && !callAnswered}
            onAnswer={() => answerVideoCall(incomingCall.userId, true)}
            onDecline={() => {
              answerVideoCall(incomingCall.userId, false);
              endCall();
              setShowVideoCall(false);
            }}
            onEnd={handleEndCall}
          />
        </div>
      )}
      <div className="dashboard-container">
        <div className="users-sidebar">
          <h2>Online Users</h2>
          <div className="users-list">
            {users.length > 0 ? (
              users.map(u => <UserCard key={u._id} user={u} onClick={handleUserSelect} />)
            ) : (
              <p className="no-users">No users online</p>
            )}
          </div>
        </div>
        <div className="content-area">
          {currentUser ? (
            <div className="user-profile">
              <div className="profile-header">
                <h2>{currentUser.nickname}'s Profile</h2>
              </div>
              <div className="profile-content">
                <div className="profile-main">
                  <PhotoGallery
                    photos={currentUser.photos || []}
                    isOwnProfile={currentUser._id === user._id}
                    onUpload={handleUploadPhoto}
                    onRequestAccess={handleRequestPhotoAccess}
                  />
                  <UserDetails user={currentUser} />
                </div>
                {currentChat && currentChat._id !== user._id && (
                  <div className="chat-container">
                    <ChatBox recipient={currentChat} />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="welcome-message">
              <h2>Welcome to Mandarin, {user.nickname}!</h2>
              <p>Select a user from the sidebar to view their profile and start chatting.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
