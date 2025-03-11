// src/store/uiSlice.js
import { createSlice } from '@reduxjs/toolkit';

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    modalOpen: false,
    modalType: null,
    modalData: null,
    toast: {
      show: false,
      type: 'info', // 'info', 'success', 'error', 'warning'
      message: '',
      duration: 3000 // ms
    },
    upgradeModal: {
      show: false,
      feature: null // 'messaging', 'likes', 'photos', etc.
    },
    subscriptionModal: {
      show: false
    }
  },
  reducers: {
    openModal: (state, action) => {
      state.modalOpen = true;
      state.modalType = action.payload.type;
      state.modalData = action.payload.data || null;
    },
    closeModal: (state) => {
      state.modalOpen = false;
      state.modalType = null;
      state.modalData = null;
    },
    showToast: (state, action) => {
      state.toast = {
        show: true,
        type: action.payload.type || 'info',
        message: action.payload.message,
        duration: action.payload.duration || 3000
      };
    },
    hideToast: (state) => {
      state.toast.show = false;
    },
    showUpgradeModal: (state, action) => {
      state.upgradeModal = {
        show: true,
        feature: action.payload
      };
    },
    hideUpgradeModal: (state) => {
      state.upgradeModal.show = false;
    },
    showSubscriptionModal: (state) => {
      state.subscriptionModal.show = true;
    },
    hideSubscriptionModal: (state) => {
      state.subscriptionModal.show = false;
    }
  }
});

export const { 
  openModal, 
  closeModal, 
  showToast, 
  hideToast,
  showUpgradeModal,
  hideUpgradeModal,
  showSubscriptionModal,
  hideSubscriptionModal
} = uiSlice.actions;

export default uiSlice.reducer;
