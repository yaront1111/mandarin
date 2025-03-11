// src/store/index.js
import { configureStore } from '@reduxjs/toolkit';
import authSlice from './authSlice';
import chatSlice from './chatSlice';
import matchSlice from './matchSlice';
import profileSlice from './profileSlice';
import userSlice from './userSlice';
import storiesSlice from './storiesSlice';
import uiSlice from './uiSlice';

const store = configureStore({
  reducer: {
    auth: authSlice,
    chat: chatSlice,
    match: matchSlice,
    profile: profileSlice,
    user: userSlice,
    stories: storiesSlice,
    ui: uiSlice
  },
  devTools: process.env.NODE_ENV !== 'production'
});

export default store;
