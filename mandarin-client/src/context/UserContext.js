// src/context/UserContext.js
import React, {
  createContext, useState, useEffect, useCallback
} from 'react';
import PropTypes from 'prop-types';
// import { fetchUserProfile, updateUserProfile } from '@/services/userService';

export const UserContext = createContext();

export function UserProvider({ children }) {
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(null);

  // Fetch the user profile from server or local storage
  const loadProfile = useCallback(async (userId) => {
    try {
      setProfileLoading(true);
      setProfileError(null);
      // const data = await fetchUserProfile(userId);
      // setProfile(data);
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const saveProfile = useCallback(async (updatedProfile) => {
    try {
      setProfileLoading(true);
      setProfileError(null);
      // const saved = await updateUserProfile(updatedProfile);
      // setProfile(saved);
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    // Example: load profile on mount if user is authenticated
    // or if you have a user ID from AuthContext
    // loadProfile(authContext.currentUser.id);
  }, [loadProfile]);

  const contextValue = {
    profile,
    profileLoading,
    profileError,
    loadProfile,
    saveProfile,
  };

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
}

UserProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
