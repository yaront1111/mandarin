import { createSlice } from '@reduxjs/toolkit';

const matchSlice = createSlice({
  name: 'match',
  initialState: {
    matches: [],
    loading: false,
    error: null
  },
  reducers: {}
});

export default matchSlice.reducer;
