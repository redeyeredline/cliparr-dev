import { api } from '../../integration/api-client';
import { apiClient } from '../../integration/api-client';

export interface ProcessingJob {
  id?: string | number;
  media_file_id: string | number;
  profile_id?: string | number;
  status: 'detected' | 'verified' | 'processing' | 'completed' | 'failed' | 'scanning';
  confidence_score: number;
  intro_start?: number;
  intro_end?: number;
  credits_start?: number;
  credits_end?: number;
  manual_verified?: boolean;
  processing_notes?: string;
  created_date: string;
  updated_date?: string;
}

export class ProcessingJobEntity {
  static async list(sortBy?: string, page?: number, limit?: number): Promise<{ jobs: ProcessingJob[], total: number, page: number, limit: number, totalPages: number }> {
    try {
      const params = new URLSearchParams();
      if (sortBy) {
        params.append('sortBy', sortBy);
      }
      if (page) {
        params.append('page', page.toString());
      }
      if (limit) {
        params.append('limit', limit.toString());
      }

      const response = await api.get(`/processing/jobs?${params.toString()}`);
      return {
        jobs: response.data.jobs || [],
        total: response.data.total || 0,
        page: response.data.page || 1,
        limit: response.data.limit || 50,
        totalPages: response.data.totalPages || 1,
      };
    } catch (error) {
      console.error('Error fetching processing jobs:', error);
      return { jobs: [], total: 0, page: 1, limit: 50, totalPages: 1 };
    }
  }

  static async update(id: string | number, data: Partial<ProcessingJob>): Promise<void> {
    try {
      await api.put(`/processing/jobs/${id}`, data);
    } catch (error) {
      console.error('Error updating processing job:', error);
      throw error;
    }
  }

  static async getById(id: string | number): Promise<ProcessingJob | null> {
    try {
      const response = await api.get(`/processing/jobs/${id}`);
      return response.data.job || null;
    } catch (error) {
      console.error('Error fetching processing job:', error);
      return null;
    }
  }

  static async delete(id: string | number): Promise<void> {
    try {
      await api.delete(`/processing/jobs/${id}`);
    } catch (error) {
      console.error('Error deleting processing job:', error);
      throw error;
    }
  }

  static async getAllIds(status?: string): Promise<(string | number)[]> {
    try {
      let url = '/processing/jobs/ids';
      if (status && status !== 'all') {
        url += `?status=${encodeURIComponent(status)}`;
      }
      const response = await api.get(url);
      return response.data.ids || [];
    } catch (error) {
      console.error('Error fetching all processing job IDs:', error);
      return [];
    }
  }

  static async bulkDelete({ jobIds, all, filter }: { jobIds?: (string | number)[], all?: boolean, filter?: any }): Promise<any> {
    try {
      const payload: any = {};
      if (all) {
        payload.all = true;
      }
      if (jobIds) {
        payload.jobIds = jobIds;
      }
      if (filter) {
        payload.filter = filter;
      }
      console.log('bulkDelete payload:', payload);
      const response = await apiClient.bulkDeleteProcessingJobs(payload);
      return response;
    } catch (error) {
      console.error('Error bulk deleting jobs:', error);
      throw error;
    }
  }
}
