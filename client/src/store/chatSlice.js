import { createSlice } from '@reduxjs/toolkit';

const chatSlice = createSlice({
  name: 'chat',
  initialState: {
    messagesByMatch: {},
    loading: false,
    error: null
  },
  reducers: {}
});

export default chatSlice.reducer;
