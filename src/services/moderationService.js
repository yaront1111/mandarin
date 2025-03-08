// src/services/moderationService.js
import { api } from './api';
import { authService } from './authService';

export const moderationService = {
  /** Submit a user report (harassment, catfishing, etc.) */
  reportUser: async (userId, reportData) => {
    const token = authService.getToken();
    // e.g., POST /moderation/reports
    // Body could be { userId, reason, details }
    return api.post('/moderation/reports', { userId, ...reportData }, { token });
  },

  /** Fetch a list of all open reports (for admin or moderator users) */
  fetchReports: async () => {
    const token = authService.getToken();
    return api.get('/moderation/reports', { token });
  },

  /** Block a user from seeing or contacting you */
  blockUser: async (userId) => {
    const token = authService.getToken();
    // e.g., POST /moderation/block
    return api.post('/moderation/block', { userId }, { token });
  },

  /** Admin or moderator resolves a report with an action (ban, warning, etc.) */
  resolveReport: async (reportId, action) => {
    const token = authService.getToken();
    // e.g., POST /moderation/reports/:reportId/resolve
    return api.post(`/moderation/reports/${reportId}/resolve`, { action }, { token });
  },
};
