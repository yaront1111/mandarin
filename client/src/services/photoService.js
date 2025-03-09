// src/services/photoService.js
import api from './api';

const photoService = {
  async uploadPhoto(file, isPrivate = false) {
    const formData = new FormData();
    formData.append('photo', file);
    formData.append('isPrivate', isPrivate);

    const response = await api.post('/photos', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    // { success: true, data: { ...newPhoto } }
    return response.data.data;
  },

  async getUserPhotos(userId) {
    const response = await api.get(`/photos/${userId}`);
    // { success: true, data: [ ...photos ] }
    return response.data.data;
  },

  async deletePhoto(photoId) {
    const response = await api.delete(`/photos/${photoId}`);
    // { success: true, message: 'Photo deleted' }
    return response.data;
  }
};

export default photoService;
