// src/store/matchSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getMatches, getMutualMatches, likeUser, sendWink } from '../services/matchService';

// Create the async thunk for fetching matches
export const fetchMatches = createAsyncThunk(
  'match/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      return await getMatches();
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch matches');
    }
  }
);

// Create the async thunk for fetching mutual matches
export const fetchMutualMatches = createAsyncThunk(
  'match/fetchMutual',
  async (options, { rejectWithValue }) => {
    try {
      return await getMutualMatches(options);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch mutual matches');
    }
  }
);

// Create the async thunk for liking a user
export const likeUserAction = createAsyncThunk(
  'match/likeUser',
  async (userId, { rejectWithValue }) => {
    try {
      return await likeUser(userId);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to like user');
    }
  }
);

// Create the async thunk for sending a wink
export const sendWinkAction = createAsyncThunk(
  'match/sendWink',
  async (userId, { rejectWithValue }) => {
    try {
      return await sendWink(userId);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to send wink');
    }
  }
);

const matchSlice = createSlice({
  name: 'match',
  initialState: {
    matches: [],
    mutualMatches: [],
    loading: false,
    error: null,
    likeSuccess: false,
    winkSuccess: false
  },
  reducers: {
    resetLikeStatus: (state) => {
      state.likeSuccess = false;
    },
    resetWinkStatus: (state) => {
      state.winkSuccess = false;
    }
  },
  extraReducers: (builder) => {
    builder
      // Handle fetchMatches
      .addCase(fetchMatches.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMatches.fulfilled, (state, action) => {
        state.loading = false;
        state.matches = action.payload;
      })
      .addCase(fetchMatches.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Handle fetchMutualMatches
      .addCase(fetchMutualMatches.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMutualMatches.fulfilled, (state, action) => {
        state.loading = false;
        state.mutualMatches = action.payload;
      })
      .addCase(fetchMutualMatches.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Handle likeUserAction
      .addCase(likeUserAction.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.likeSuccess = false;
      })
      .addCase(likeUserAction.fulfilled, (state) => {
        state.loading = false;
        state.likeSuccess = true;
      })
      .addCase(likeUserAction.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.likeSuccess = false;
      })

      // Handle sendWinkAction
      .addCase(sendWinkAction.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.winkSuccess = false;
      })
      .addCase(sendWinkAction.fulfilled, (state) => {
        state.loading = false;
        state.winkSuccess = true;
      })
      .addCase(sendWinkAction.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.winkSuccess = false;
      });
  }
});

export const { resetLikeStatus, resetWinkStatus } = matchSlice.actions;
export default matchSlice.reducer;
