// src/store/userSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../services/api';
import { getUserStats } from '../services/matchService';

// Async thunk to fetch users
export const fetchUsers = createAsyncThunk(
  'user/fetchUsers',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/api/users', { params });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch users');
    }
  }
);

// Async thunk to fetch online users
export const fetchOnlineUsers = createAsyncThunk(
  'user/fetchOnlineUsers',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/api/users/online');
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch online users');
    }
  }
);

// Async thunk to fetch user stats
export const fetchUserStats = createAsyncThunk(
  'user/fetchUserStats',
  async (_, { rejectWithValue }) => {
    try {
      const stats = await getUserStats();
      return stats;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch user stats');
    }
  }
);

// Async thunk to fetch liked users
export const fetchLikedUsers = createAsyncThunk(
  'user/fetchLikedUsers',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/api/matches/likes/sent');
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch liked users');
    }
  }
);

const userSlice = createSlice({
  name: 'user',
  initialState: {
    users: [],
    onlineUsers: [],
    likedUsers: [],
    stats: {
      viewCount: 0,
      likeCount: 0,
      matchCount: 0,
      messageCount: 0,
      profileCompleteness: 0,
      responseRate: 0,
      dailyLikesRemaining: 3
    },
    loading: false,
    error: null
  },
  reducers: {
    setUserLiked: (state, action) => {
      const { userId, liked } = action.payload;
      if (liked && !state.likedUsers.includes(userId)) {
        state.likedUsers.push(userId);
      }
    },
    decrementDailyLikes: (state) => {
      if (state.stats.dailyLikesRemaining > 0) {
        state.stats.dailyLikesRemaining -= 1;
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // Handle fetchUsers
      .addCase(fetchUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.loading = false;
        // If it's first page, replace users; otherwise append
        if (!action.meta.arg.page || action.meta.arg.page === 1) {
          state.users = action.payload;
        } else {
          // Filter out duplicates
          const existingIds = new Set(state.users.map(user => user.id));
          const newUsers = action.payload.filter(user => !existingIds.has(user.id));
          state.users = [...state.users, ...newUsers];
        }
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to fetch users';
      })

      // Handle fetchOnlineUsers
      .addCase(fetchOnlineUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchOnlineUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.onlineUsers = action.payload;
      })
      .addCase(fetchOnlineUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to fetch online users';
      })

      // Handle fetchUserStats
      .addCase(fetchUserStats.fulfilled, (state, action) => {
        state.stats = action.payload;
      })

      // Handle fetchLikedUsers
      .addCase(fetchLikedUsers.fulfilled, (state, action) => {
        state.likedUsers = action.payload.map(like => like.targetId);
      });
  }
});

export const { setUserLiked, decrementDailyLikes } = userSlice.actions;
export default userSlice.reducer;
