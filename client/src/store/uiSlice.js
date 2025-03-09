import { createSlice } from '@reduxjs/toolkit';

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    modalOpen: false
  },
  reducers: {
    openModal: (state) => {
      state.modalOpen = true;
    },
    closeModal: (state) => {
      state.modalOpen = false;
    }
  }
});

export const { openModal, closeModal } = uiSlice.actions;
export default uiSlice.reducer;
