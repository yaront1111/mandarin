// src/services/messageService.js
import { api } from './api';
import { authService } from './authService';

export const messageService = {
  async getConversations() {
    const token = authService.getToken();
    return api.get('/messages/conversations', { token });
  },
  async getConversation(conversationId) {
    const token = authService.getToken();
    return api.get(`/messages/conversations/${conversationId}`, { token });
  },
  async sendMessage(conversationId, content) {
    const token = authService.getToken();
    return api.post(`/messages/conversations/${conversationId}`, { content }, { token });
  },
  async createConversation(recipientId) {
    const token = authService.getToken();
    return api.post(`/messages/conversations?recipientId=${recipientId}`, null, { token });
  },
};
