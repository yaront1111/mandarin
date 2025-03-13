import React, { createContext, useReducer, useContext } from 'react';
import axios from 'axios';

const UserContext = createContext();

const userReducer = (state, action) => {
  switch (action.type) {
    case 'GET_USERS':
      return { ...state, users: action.payload, loading: false };
    case 'GET_USER':
      return { ...state, currentUser: action.payload.user, messages: action.payload.messages, loading: false };
    case 'USER_ONLINE':
      return {
        ...state,
        users: state.users.map(user =>
          user._id === action.payload.userId ? { ...user, isOnline: true, lastActive: Date.now() } : user
        )
      };
    case 'USER_OFFLINE':
      return {
        ...state,
        users: state.users.map(user =>
          user._id === action.payload.userId ? { ...user, isOnline: false, lastActive: Date.now() } : user
        )
      };
    case 'UPLOAD_PHOTO':
      return {
        ...state,
        user: { ...state.user, photos: [...state.user.photos, action.payload] }
      };
    case 'PHOTO_PERMISSION_REQUESTED':
      return {
        ...state,
        photoPermissions: [...state.photoPermissions, action.payload]
      };
    case 'PHOTO_PERMISSION_UPDATED':
      return {
        ...state,
        photoPermissions: state.photoPermissions.map(permission =>
          permission._id === action.payload._id ? action.payload : permission
        )
      };
    case 'USER_ERROR':
      return { ...state, error: action.payload };
    default:
      return state;
  }
};

export const UserProvider = ({ children }) => {
  const initialState = {
    users: [],
    currentUser: null,
    photoPermissions: [],
    loading: true,
    error: null,
  };

  const [state, dispatch] = useReducer(userReducer, initialState);

  const getUsers = async () => {
    try {
      const res = await axios.get('/users');
      dispatch({ type: 'GET_USERS', payload: res.data.data });
    } catch (err) {
      dispatch({ type: 'USER_ERROR', payload: err.response?.data.error || 'Server Error' });
    }
  };

  const getUser = async (id) => {
    try {
      const res = await axios.get(`/users/${id}`);
      dispatch({ type: 'GET_USER', payload: res.data.data });
    } catch (err) {
      dispatch({ type: 'USER_ERROR', payload: err.response?.data.error || 'Server Error' });
    }
  };

  const uploadPhoto = async (file, isPrivate) => {
    try {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('isPrivate', isPrivate);
      const res = await axios.post('/users/photos', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      dispatch({ type: 'UPLOAD_PHOTO', payload: res.data.data });
      return res.data.data;
    } catch (err) {
      dispatch({ type: 'USER_ERROR', payload: err.response?.data.error || 'Server Error' });
      return null;
    }
  };

  const requestPhotoPermission = async (photoId, userId) => {
    try {
      const res = await axios.post(`/photos/${photoId}/request`, { userId });
      dispatch({ type: 'PHOTO_PERMISSION_REQUESTED', payload: res.data.data });
      return res.data.data;
    } catch (err) {
      dispatch({ type: 'USER_ERROR', payload: err.response?.data.error || 'Server Error' });
      return null;
    }
  };

  const updatePhotoPermission = async (permissionId, status) => {
    try {
      const res = await axios.put(`/photos/permissions/${permissionId}`, { status });
      dispatch({ type: 'PHOTO_PERMISSION_UPDATED', payload: res.data.data });
      return res.data.data;
    } catch (err) {
      dispatch({ type: 'USER_ERROR', payload: err.response?.data.error || 'Server Error' });
      return null;
    }
  };

  return (
    <UserContext.Provider
      value={{
        users: state.users,
        currentUser: state.currentUser,
        messages: state.messages,
        photoPermissions: state.photoPermissions,
        loading: state.loading,
        error: state.error,
        getUsers,
        getUser,
        uploadPhoto,
        requestPhotoPermission,
        updatePhotoPermission,
        dispatch,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
