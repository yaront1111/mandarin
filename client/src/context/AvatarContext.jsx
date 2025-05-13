import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import logger from '../utils/logger';

const log = logger.create('AvatarContext');
const AvatarContext = createContext();

export const AvatarProvider = ({ children }) => {
  const { user } = useAuth();
  const [avatar, setAvatar] = useState(null);
  const [loading, setLoading] = useState(true);

  // Get gender-specific default avatar based on user's information
  const getDefaultAvatar = (user) => {
    if (!user) {
      return '/default-avatar.png';
    }

    // First try from user.details.iAm
    if (user.details && user.details.iAm) {
      if (user.details.iAm === 'woman') {
        log.debug('Using women-avatar based on details.iAm');
        return '/women-avatar.png';
      } else if (user.details.iAm === 'man') {
        log.debug('Using man-avatar based on details.iAm');
        return '/man-avatar.png';
      } else if (user.details.iAm === 'couple') {
        log.debug('Using couple-avatar based on details.iAm');
        return '/couple-avatar.png';
      }
    }
    
    // Fallback to gender field for backward compatibility
    if (user.gender) {
      if (user.gender === 'female' || user.gender === 'FEMALE') {
        log.debug('Using women-avatar based on gender field');
        return '/women-avatar.png';
      } else if (user.gender === 'male' || user.gender === 'MALE') {
        log.debug('Using man-avatar based on gender field');
        return '/man-avatar.png';
      } else if (user.gender === 'couple' || user.gender === 'COUPLE') {
        log.debug('Using couple-avatar based on gender field');
        return '/couple-avatar.png';
      }
    }
    
    // If no specific gender/identity or it's not one of the recognized values
    return '/default-avatar.png';
  };

  useEffect(() => {
    if (user?.profilePhoto) {
      setAvatar(user.profilePhoto);
      setLoading(false);
    } else {
      // Use gender-specific default avatar
      setAvatar(getDefaultAvatar(user));
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