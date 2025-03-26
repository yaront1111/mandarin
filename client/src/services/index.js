// client/src/services/index.js - Refactored
import apiService from './apiService.jsx';
import socketService from './socketService.jsx';
import socketClient from './socketClient.jsx'; // Add direct access to socketClient
import storiesService from './storiesService.jsx';
import notificationService from './notificationService.jsx';
import settingsService from './settingsService.jsx';
import subscriptionService from './subscriptionService.jsx';

// Standard services
export {
  apiService,
  socketService,
  storiesService,
  notificationService,
  settingsService,
  subscriptionService
};

// Socket-specific exports (optional)
export const socket = {
  service: socketService,
  client: socketClient
};
