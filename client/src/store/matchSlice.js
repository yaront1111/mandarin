// src/store/matchSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import matchService from '../services/matchService';

// Create the async thunk for fetching matches
export const fetchMatches = createAsyncThunk(
  'match/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const response = await matchService.getMatches();
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch matches');
    }
  }
);

const matchSlice = createSlice({
  name: 'match',
  initialState: {
    matches: [],
    loading: false,
    error: null
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
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
      });
  }
});

export default matchSlice.reducer;
