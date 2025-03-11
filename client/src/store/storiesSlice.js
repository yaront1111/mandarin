// src/store/storiesSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {
  getFeedStories,
  getStoriesByUser,
  createStory,
  viewStory
} from '../services/storyService';

// Async thunk to fetch stories for feed
export const fetchFeedStories = createAsyncThunk(
  'stories/fetchFeed',
  async (_, { rejectWithValue }) => {
    try {
      const stories = await getFeedStories();
      return stories;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch stories');
    }
  }
);

// Async thunk to fetch stories for a specific user
export const fetchUserStories = createAsyncThunk(
  'stories/fetchUserStories',
  async (userId, { rejectWithValue }) => {
    try {
      const stories = await getStoriesByUser(userId);
      return { userId, stories };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch user stories');
    }
  }
);

// Async thunk to create a new story
export const postStory = createAsyncThunk(
  'stories/postStory',
  async (storyData, { rejectWithValue }) => {
    try {
      const story = await createStory(storyData);
      return story;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to create story');
    }
  }
);

// Async thunk to mark a story as viewed
export const markStoryAsViewed = createAsyncThunk(
  'stories/markAsViewed',
  async (storyId, { rejectWithValue }) => {
    try {
      const result = await viewStory(storyId);
      return { storyId, result };
    } catch (error) {
      // Don't reject, just log the error
      console.error('Error marking story as viewed:', error);
      return { storyId, error: error.message };
    }
  }
);

const storiesSlice = createSlice({
  name: 'stories',
  initialState: {
    feedStories: [],
    userStories: {}, // Map of userId -> stories array
    loading: false,
    error: null,
    showViewer: false,
    currentStoryUserId: null,
    currentStoryIndex: 0
  },
  reducers: {
    showViewer: (state, action) => {
      state.showViewer = true;
      state.currentStoryUserId = action.payload.userId;
      state.currentStoryIndex = 0;
    },
    hideViewer: (state) => {
      state.showViewer = false;
    },
    setCurrentStoryIndex: (state, action) => {
      state.currentStoryIndex = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      // Handle fetchFeedStories
      .addCase(fetchFeedStories.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchFeedStories.fulfilled, (state, action) => {
        state.loading = false;
        state.feedStories = action.payload;
      })
      .addCase(fetchFeedStories.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Handle fetchUserStories
      .addCase(fetchUserStories.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserStories.fulfilled, (state, action) => {
        state.loading = false;
        const { userId, stories } = action.payload;
        state.userStories[userId] = stories;
      })
      .addCase(fetchUserStories.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Handle postStory
      .addCase(postStory.fulfilled, (state, action) => {
        // Add to current user's stories if they exist in state
        const newStory = action.payload;
        if (newStory && newStory.userId && state.userStories[newStory.userId]) {
          state.userStories[newStory.userId].unshift(newStory);
        }
      });
  }
});

export const { showViewer, hideViewer, setCurrentStoryIndex } = storiesSlice.actions;
export default storiesSlice.reducer;
