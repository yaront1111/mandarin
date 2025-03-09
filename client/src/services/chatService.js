// src/services/chatService.js
import api from './api';

const chatService = {
  async getMessages(matchId) {
    const response = await api.get(`api/chat/${matchId}`);
    // { success: true, data: [ ...messages ] }
    return response.data.data;
  },

  async sendMessage(matchId, content, messageType = 'text') {
    const response = await api.post('/chat', { matchId, content, messageType });
    // { success: true, data: { ...newMessage } }
    return response.data.data;
  }
};

export default chatService;
