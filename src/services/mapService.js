// src/services/mapService.js
import { api } from './api';
import { authService } from './authService';

export const mapService = {
  /** Fetch users near a certain latitude/longitude within a radius */
  getNearbyUsers: async (latitude, longitude, radius) => {
    const token = authService.getToken();
    // Example endpoint: /map/nearby?lat=xx&lng=xx&radius=yy
    return api.get(`/map/nearby?lat=${latitude}&lng=${longitude}&radius=${radius}`, { token });
  },

  /** Reverse geocode: get city/country from coordinates (if your API supports it) */
  reverseGeocode: async (latitude, longitude) => {
    const token = authService.getToken();
    // Example: /map/reverse-geocode?lat=xx&lng=yy
    return api.get(`/map/reverse-geocode?lat=${latitude}&lng=${longitude}`, { token });
  },
};
