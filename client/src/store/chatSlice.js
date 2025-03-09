// src/store/chatSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import chatService from '../services/chatService';

// Create the async thunk for fetching messages
export const fetchMessages = createAsyncThunk(
  'chat/fetchMessages',
  async (matchId, { rejectWithValue }) => {
    try {
      const response = await chatService.getMessages(matchId);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch messages');
    }
  }
);

// Create the async thunk for sending messages
export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async ({ matchId, content }, { rejectWithValue }) => {
    try {
      const response = await chatService.sendMessage(matchId, content);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to send message');
    }
  }
);

const chatSlice = createSlice({
  name: 'chat',
  initialState: {
    messages: [],
    loading: false,
    error: null
  },
  reducers: {
    // Action to add a new message (used with socket.io)
    addMessage: (state, action) => {
      state.messages.push(action.payload);
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMessages.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        state.loading = false;
        state.messages = action.payload;
      })
      .addCase(fetchMessages.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        // The socket will handle adding the message to the state
      });
  }
});

export const { addMessage } = chatSlice.actions;
export default chatSlice.reducer;
