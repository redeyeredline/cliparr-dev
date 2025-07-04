// Frontend API client providing HTTP methods for backend communication.
// Handles requests to health, shows, Sonarr, and settings endpoints with error interceptors.

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
  async getShows() {
    const response = await api.get('/shows');
    return response.data;
  }

  async getImportedShows() {
    const response = await api.get('/shows');
    return response.data.shows;
  }

  async getShow(id) {
    const response = await api.get(`/shows/${id}`);
    return response.data;
  }

  // Get show with complete season/episode details
  async getShowWithDetails(id) {
    const response = await api.get(`/shows/${id}?details=true`);
    return response.data;
  }

  // Get files for a specific episode
  async getEpisodeFiles(episodeId) {
    const response = await api.get(`/shows/episodes/${episodeId}/files`);
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

  async importShows(showIds) {
    const response = await api.post('/sonarr/import', { showIds });
    return response.data;
  }

  // Settings endpoints
  async getImportMode() {
    const response = await api.get('/settings/import-mode');
    return response.data;
  }

  async setImportMode(mode) {
    const response = await api.post('/settings/import-mode', { mode });
    return response.data;
  }

  async getPollingInterval() {
    const response = await api.get('/settings/polling-interval');
    return response.data;
  }

  async setPollingInterval(interval) {
    const response = await api.post('/settings/polling-interval', { interval });
    return response.data;
  }

  async getAllSettings() {
    const response = await api.get('/settings/all');
    return response.data;
  }

  async setAllSettings(settings) {
    const response = await api.post('/settings/all', settings);
    return response.data;
  }

  async deleteShows(ids) {
    const response = await api.post('/shows/delete', { ids });
    return response.data;
  }

  async scanShows(showIds) {
    const response = await api.post('/shows/scan', { showIds });
    return response.data;
  }

  async rescanShows(showIds) {
    const response = await api.post('/shows/rescan', { showIds });
    return response.data;
  }

  // Hardware endpoints
  async detectHardware() {
    const response = await api.post('/hardware/detect');
    return response.data;
  }

  async getHardwareInfo() {
    const response = await api.get('/hardware/info');
    return response.data;
  }

  async getBenchmarkResults() {
    const response = await api.get('/hardware/benchmark/results');
    return response.data;
  }

  async runHardwareBenchmark() {
    const response = await api.post('/hardware/benchmark', {}, { timeout: 300000 }); // 5 minutes
    return response.data;
  }

  // Worker pause/resume endpoints
  async pauseCpuWorkers() {
    const response = await api.post('/settings/queue/pause-cpu');
    return response.data;
  }

  async resumeCpuWorkers() {
    const response = await api.post('/settings/queue/resume-cpu');
    return response.data;
  }

  async pauseGpuWorkers() {
    const response = await api.post('/settings/queue/pause-gpu');
    return response.data;
  }

  async resumeGpuWorkers() {
    const response = await api.post('/settings/queue/resume-gpu');
    return response.data;
  }

  // Validate temp directory
  async validateTempDir(temp_dir) {
    const response = await api.post('/settings/validate-temp-dir', { temp_dir });
    return response.data;
  }

  async cleanupTempFiles() {
    const response = await api.post('/processing/cleanup-temp-files');
    return response.data;
  }

  // Queue status endpoint
  async getQueueStatus() {
    const response = await api.get('/processing/queue/status');
    return response.data;
  }

  // Processing status endpoint
  async getProcessingStatus() {
    const response = await api.get('/processing/status');
    return response.data;
  }

  // Detection segments endpoint
  async getDetectionSegments(showId, seasonNumber) {
    let url = `/shows/${showId}/segments`;
    if (seasonNumber) {
      url += `?season=${seasonNumber}`;
    }
    const response = await api.get(url);
    return response.data;
  }

  // Bulk delete processing jobs endpoint
  async bulkDeleteProcessingJobs(payload) {
    const response = await api.post('/processing/jobs/bulk-delete', payload);
    return response.data;
  }
}

export const apiClient = new ApiClient();
export { api };
