import api from './api';

const chatService = {
  async getMessages(matchId) {
    const response = await api.get(`/api/chat/${matchId}`);
    return response.data.data;
  },

  async sendMessage(matchId, content, messageType = 'text') {
    const response = await api.post('/api/chat', { matchId, content, messageType });
    return response.data.data;
  }
};

export default chatService;
