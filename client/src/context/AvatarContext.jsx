import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const AvatarContext = createContext();

export const AvatarProvider = ({ children }) => {
  const { user } = useAuth();
  const [avatar, setAvatar] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.profilePhoto) {
      setAvatar(user.profilePhoto);
      setLoading(false);
    } else {
      setAvatar('/default-avatar.png');
      setLoading(false);
    }
  }, [user]);

  const updateAvatar = (newAvatarUrl) => {
    setAvatar(newAvatarUrl);
  };

  return (
    <AvatarContext.Provider value={{ avatar, updateAvatar, loading }}>
      {children}
    </AvatarContext.Provider>
  );
};

export const useAvatar = () => {
  const context = useContext(AvatarContext);
  if (context === undefined) {
    throw new Error('useAvatar must be used within an AvatarProvider');
  }
  return context;
};