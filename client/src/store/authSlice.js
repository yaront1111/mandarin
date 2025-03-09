// src/store/authSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import authService from '../services/authService';

// Helper functions for localStorage
const saveAuthState = (token, refreshToken) => {
  localStorage.setItem('token', token);
  localStorage.setItem('refreshToken', refreshToken);
};

const clearAuthState = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
};

// Async thunks
export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const data = await authService.login(email, password);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const registerUser = createAsyncThunk(
  'auth/registerUser',
  async (formData, { rejectWithValue }) => {
    try {
      const data = await authService.register(formData);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const fetchCurrentUser = createAsyncThunk(
  'auth/fetchCurrentUser',
  async (_, { rejectWithValue, getState }) => {
    try {
      // Check if we already have user data
      const { user } = getState().auth;
      if (user) return user;

      const data = await authService.getCurrentUser();
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const refreshAccessToken = createAsyncThunk(
  'auth/refreshToken',
  async (_, { rejectWithValue, getState }) => {
    try {
      const { refreshToken } = getState().auth;
      if (!refreshToken) throw new Error('No refresh token available');

      const data = await authService.refreshToken(refreshToken);
      return data;
    } catch (err) {
      // On refresh failure, force logout
      clearAuthState();
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await authService.logout();
      clearAuthState();
      return null;
    } catch (err) {
      // Even if the logout API call fails, we should still clear local state
      clearAuthState();
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// Get tokens from localStorage for initial state
const token = localStorage.getItem('token');
const refreshToken = localStorage.getItem('refreshToken');

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    token: token || null,
    refreshToken: refreshToken || null,
    loading: false,
    initialLoading: true, // Used for the initial app load check
    error: null,
    registrationSuccess: false
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    resetRegistrationSuccess: (state) => {
      state.registrationSuccess = false;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      clearAuthState();
    }
  },
  extraReducers: (builder) => {
    // Login
    builder.addCase(login.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(login.fulfilled, (state, action) => {
      state.loading = false;
      state.error = null;

      // Find user, token, and refreshToken in the response data
      const responseData = action.payload.data || action.payload;

      if (responseData.user) {
        state.user = responseData.user;
      } else if (responseData.data && responseData.data.user) {
        state.user = responseData.data.user;
      }

      // Handle token
      if (responseData.token) {
        state.token = responseData.token;
      } else if (responseData.accessToken) {
        state.token = responseData.accessToken;
      } else if (responseData.data && responseData.data.token) {
        state.token = responseData.data.token;
      } else if (responseData.data && responseData.data.accessToken) {
        state.token = responseData.data.accessToken;
      } else if (responseData.tokens && responseData.tokens.accessToken) {
        state.token = responseData.tokens.accessToken;
      }

      // Handle refresh token
      if (responseData.refreshToken) {
        state.refreshToken = responseData.refreshToken;
      } else if (responseData.data && responseData.data.refreshToken) {
        state.refreshToken = responseData.data.refreshToken;
      } else if (responseData.tokens && responseData.tokens.refreshToken) {
        state.refreshToken = responseData.tokens.refreshToken;
      }

      // Save to localStorage
      if (state.token && state.refreshToken) {
        saveAuthState(state.token, state.refreshToken);
      }
    });
    builder.addCase(login.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
      state.user = null;
      state.token = null;
      state.refreshToken = null;
    });

    // Register
    builder.addCase(registerUser.pending, (state) => {
      state.loading = true;
      state.error = null;
      state.registrationSuccess = false;
    });
    builder.addCase(registerUser.fulfilled, (state) => {
      state.loading = false;
      state.error = null;
      state.registrationSuccess = true;
    });
    builder.addCase(registerUser.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
      state.registrationSuccess = false;
    });

    // Fetch Current User
    builder.addCase(fetchCurrentUser.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchCurrentUser.fulfilled, (state, action) => {
      state.loading = false;
      state.initialLoading = false;
      state.error = null;
      state.user = action.payload;
    });
    builder.addCase(fetchCurrentUser.rejected, (state, action) => {
      state.loading = false;
      state.initialLoading = false;
      state.error = action.payload;
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      clearAuthState();
    });

    // Refresh Token
    builder.addCase(refreshAccessToken.fulfilled, (state, action) => {
      const data = action.payload.data || action.payload;

      if (data.token || data.accessToken) {
        state.token = data.token || data.accessToken;
        localStorage.setItem('token', state.token);
      }

      if (data.refreshToken) {
        state.refreshToken = data.refreshToken;
        localStorage.setItem('refreshToken', state.refreshToken);
      }
    });
    builder.addCase(refreshAccessToken.rejected, (state) => {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      clearAuthState();
    });

    // Logout
    builder.addCase(logoutUser.fulfilled, (state) => {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
    });
  }
});

export const { clearError, resetRegistrationSuccess, logout } = authSlice.actions;
export default authSlice.reducer;
