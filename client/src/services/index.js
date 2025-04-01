// client/src/services/index.js
import apiService from './apiService.jsx';
import socketService from './socketService.jsx';
import socketClient from './socketClient.jsx';
import storiesService from './storiesService.jsx';
import notificationService from './notificationService.jsx';
import settingsService from './settingsService.jsx';
import subscriptionService from './subscriptionService.jsx';
import permissionClient from './PermissionClient.jsx';
import chatService from './ChatService';

// Standard services
export {
  apiService,
  socketService,
  storiesService,
  notificationService,
  settingsService,
  subscriptionService,
  permissionClient,
  chatService
};

// Socket-specific exports (optional)
export const socket = {
  service: socketService,
  client: socketClient
};

// Chat-specific exports
export const chat = {
  service: chatService,
};
