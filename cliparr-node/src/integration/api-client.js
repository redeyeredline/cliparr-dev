// src/integration/api-client.js - API client for React frontend
import axios from 'axios';

const API_BASE = 'http://localhost:8485';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 5000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API request failed:', error);
    return Promise.reject(error);
  },
);

class ApiClient {
  // Health endpoints
  async checkHealth() {
    const response = await api.get('/health/status');
    return response.data;
  }

  async testDatabase() {
    const response = await api.get('/health/db-test');
    return response.data;
  }

  // Shows endpoints
  async getShows(page = 1, pageSize = 10) {
    const response = await api.get('/shows', { params: { page, pageSize } });
    return response.data;
  }

  async getShow(id) {
    const response = await api.get(`/shows/${id}`);
    return response.data;
  }

  async createShow(showData) {
    const response = await api.post('/shows', showData);
    return response.data;
  }

  async updateShow(id, showData) {
    const response = await api.put(`/shows/${id}`, showData);
    return response.data;
  }

  async deleteShow(id) {
    const response = await api.delete(`/shows/${id}`);
    return response.data;
  }

  // Sonarr endpoints
  async getUnimportedShows() {
    const response = await api.get('/sonarr/unimported');
    return response.data;
  }

  async importShow(sonarrId) {
    const response = await api.post(`/sonarr/import/${sonarrId}`);
    return response.data;
  }

  async getSeriesDetails(sonarrId) {
    const response = await api.get(`/sonarr/series/${sonarrId}`);
    return response.data;
  }

  async getEpisodes(sonarrId) {
    const response = await api.get(`/sonarr/series/${sonarrId}/episodes`);
    return response.data;
  }
}

export const apiClient = new ApiClient();
