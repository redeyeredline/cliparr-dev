import React, { useState, useEffect, useRef } from 'react';
import {
  ProcessingJob,
  ProcessingJobEntity,
  MediaFile,
  MediaFileEntity,
  AudioAnalysis,
  AudioAnalysisEntity,
} from '@/components/entities/all';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProcessingQueue from '../components/processing/ProcessingQueue';
import AudioAnalyzer from '../components/processing/AudioAnalyzer';
import ProcessingMonitor from '../components/processing/ProcessingMonitor';
import BatchProcessor from '../components/processing/BatchProcessor';
import QueueStatus from '../components/processing/QueueStatus';
import { wsClient } from '../services/websocket.frontend.js';
import { useToast } from '../components/ToastContext';
import { Trash2, Loader2, CheckCircle2 } from 'lucide-react';
import { apiClient } from '../integration/api-client';
import { logger } from '../services/logger.frontend.js';
import { Button } from '@/components/ui/button';

export default function Processing() {
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [audioAnalyses, setAudioAnalyses] = useState<AudioAnalysis[]>([]);
  const [activeProcesses, setActiveProcesses] = useState<ProcessingJob[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [queueStatus, setQueueStatus] = useState<any>(null);
  const [selected, setSelected] = useState<(string | number)[]>([]);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const toast = useToast();
  const [cpuLimit, setCpuLimit] = useState<number>(2);
  const [gpuLimit, setGpuLimit] = useState<number>(1);
  const [workerSaving, setWorkerSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [jobProgress, setJobProgress] = useState<Record<string, { progress: number, fps: number, currentFile: any, updated: number }>>({});

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalJobs, setTotalJobs] = useState<number>(0);
  const [jobsPerPage] = useState<number>(50);

  const loadData = async (page: number = 1) => {
    if (isLoading) {
      setIsLoading(true);
    }
    try {
      const [jobsResponse, filesData, audioData] = await Promise.all([
        ProcessingJobEntity.list('-created_date', page, 100),
        MediaFileEntity.list('-created_date'),
        AudioAnalysisEntity.list('-created_date', 20),
      ]);

      setJobs(jobsResponse.jobs);
      setTotalPages(jobsResponse.totalPages);
      setTotalJobs(jobsResponse.total);
      setCurrentPage(jobsResponse.page);
      setMediaFiles(filesData);
      setAudioAnalyses(audioData);

      // Debug: Log job status distribution
      const statusCounts = jobsResponse.jobs.reduce((acc, job) => {
        acc[job.status] = (acc[job.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      // console.log('[loadData] Job status distribution:', statusCounts);

      const processing = jobsResponse.jobs.filter(
        (j: ProcessingJob) => j.status === 'processing' || j.status === 'scanning',
      );
      setActiveProcesses(processing);
      // console.log('[loadData] jobsData:', jobsResponse.jobs);
      // console.log('[loadData] processing:', processing);
    } catch (error) {
      console.error('Error loading processing data:', error);
    } finally {
      if (isLoading) {
        setIsLoading(false);
      }
    }
  };

  // Load all active jobs for monitor tab
  const loadActiveJobs = async () => {
    try {
      // Load more jobs to find active ones (up to 200 jobs)
      const jobsResponse = await ProcessingJobEntity.list('-created_date', 1, 200);
      const activeJobs = jobsResponse.jobs.filter(
        (j: ProcessingJob) => j.status === 'processing' || j.status === 'scanning',
      );
      setActiveProcesses(activeJobs);
      // console.log('[loadActiveJobs] Active jobs found:', activeJobs.length);
    } catch (error) {
      console.error('Error loading active jobs:', error);
    }
  };

  // WebSocket event handlers
  useEffect(() => {
    // logger.info('Monitor tab mounted');

    // Add a simple message logger to debug all incoming messages
    const handleAllMessages = (data: any) => {
      // console.log('[Processing] ALL WebSocket messages received:', data);
      // logger.info('[Processing] ALL WebSocket messages received:', data);
    };

    // Helper to normalize job IDs (strip 'epjob-' prefix)
    const normalizeId = (id: string | number | undefined) => (id ? id.toString().replace(/^epjob-/, '') : '');

    const handleJobUpdate = (data: any) => {
      // logger.info('[Processing] WebSocket message received:', data);
      // logger.info('[Processing] Message type check:', {
      //   hasJobId: !!data.jobId,
      //   hasStatus: !!data.status,
      //   hasType: !!data.type,
      //   jobId: data.jobId,
      //   dbJobId: data.dbJobId,
      //   status: data.status,
      // });

      // Helper: should we update the jobs array?
      const isStatusChange = data.status && [
        'completed', 'failed', 'active', 'verified', 'queued', 'detected', 'scanning', 'waiting', 'paused', 'cancelled',
      ].includes(data.status);
      // Helper: is this a real-time progress event only?
      const isProgressOnly = data.status === 'processing' && data.progress !== undefined;

      // Always update jobProgress for monitor (if progress event)
      if (isProgressOnly) {
        setJobProgress((prev) => ({
          ...prev,
          [normalizeId(data.dbJobId) || '']: {
            progress: data.progress,
            fps: data.fps,
            currentFile: data.currentFile,
            updated: Date.now(),
          },
        }));
      }

      // Only update jobs array for status changes (not for every progress event)
      if (isStatusChange) {
        const existingJob = jobs.find((j) => normalizeId(j.id) === normalizeId(data.dbJobId));
        if (!existingJob) {
          // logger.info('[Processing] Job not found in current jobs array, will be added on next loadData:', data.dbJobId);
          return;
        }
        // Compute updated jobs array
        const updatedJobs = jobs.map((job) => {
          if (!job) {
            return job;
          }
          if (normalizeId(job.id) === normalizeId(data.dbJobId)) {
            return {
              ...job,
              status: data.status,
              processing_notes: data.error || data.result?.message || job.processing_notes,
              updated_date: new Date().toISOString(),
            };
          }
          return job;
        });
        setJobs(updatedJobs);
        // Remove progress for jobs that are completed/failed
        if (['completed', 'failed'].includes(data.status)) {
          setJobProgress((prev) => {
            const copy = { ...prev };
            delete copy[normalizeId(data.dbJobId) || ''];
            return copy;
          });
        }
        // Show toast notification for important updates
        if (data.status === 'completed') {
          toast({
            type: 'success',
            message: `Job ${data.dbJobId} completed successfully`,
          });
        } else if (data.status === 'failed') {
          toast({
            type: 'error',
            message: `Job ${data.dbJobId} failed: ${data.error || data.message}`,
          });
        } else if (data.status === 'active') {
          toast({
            type: 'info',
            message: `Job ${data.dbJobId} started processing`,
          });
        }
      }

      // Handle legacy job_update type messages (for backward compatibility)
      if (data.type === 'job_update') {
        // logger.info('[Processing] Processing legacy job_update message:', data);

        // Check if this job exists in our current jobs array (normalize IDs)
        const existingJob = jobs.find((j) => normalizeId(j.id) === normalizeId(data.dbJobId));

        // If job doesn't exist in our array, reload data to get latest jobs
        if (!existingJob) {
          // logger.info('[Processing] Job not found in current jobs array (legacy), will be added on next loadData:', data.dbJobId);
          return; // Exit early, will be added on next loadData
        }

        // Track real-time progress/fps for processing jobs
        if (data.status === 'processing' && data.progress !== undefined) {
          setJobProgress((prev) => ({
            ...prev,
            [normalizeId(data.dbJobId) || '']: {
              progress: data.progress,
              fps: data.fps,
              currentFile: data.currentFile,
              updated: Date.now(),
            },
          }));
        }
        // Remove progress for jobs that are completed/failed
        if (['completed', 'failed'].includes(data.status)) {
          setJobProgress((prev) => {
            const copy = { ...prev };
            delete copy[normalizeId(data.dbJobId) || ''];
            return copy;
          });
        }

        // Only update the jobs array if this is a status change (not just progress)
        const isLegacyStatusChange = data.status && [
          'completed', 'failed', 'active', 'verified', 'queued', 'detected', 'scanning', 'waiting', 'paused', 'cancelled',
        ].includes(data.status);

        if (isLegacyStatusChange) {
          // Update the specific job in the state
          setJobs((prevJobs) => {
            return prevJobs.map((job) => {
              if (!job) {
                return job;
              }
              if (normalizeId(job.id) === normalizeId(data.dbJobId)) {
                return {
                  ...job,
                  status: data.status,
                  processing_notes: data.error || data.result?.message || job.processing_notes,
                  updated_date: new Date().toISOString(),
                };
              }
              return job;
            });
          });

          // Show toast notification for important updates
          if (data.status === 'completed') {
            toast({
              type: 'success',
              message: `Job ${data.dbJobId} completed successfully`,
            });
          } else if (data.status === 'failed') {
            toast({
              type: 'error',
              message: `Job ${data.dbJobId} failed: ${data.error}`,
            });
          } else if (data.status === 'active') {
            toast({
              type: 'info',
              message: `Job ${data.dbJobId} started processing`,
            });
          }
        }
      }
    };

    const handleQueueStatus = (data: any) => {
      // logger.info('[Processing] Queue status update:', data);
      if (data.type === 'queue_status') {
        setQueueStatus(data.queues);
      }
    };

    const handleProcessingStatus = (data: any) => {
      // logger.info('[Processing] Processing status update:', data);
      if (data.type === 'processing_status') {
        // Update processing status
        setQueueStatus(data);
      }
    };

    // Add WebSocket event listeners
    wsClient.addEventListener('message', handleAllMessages);
    wsClient.addEventListener('message', handleJobUpdate);
    wsClient.addEventListener('message', handleQueueStatus);
    wsClient.addEventListener('message', handleProcessingStatus);
    wsClient.addEventListener('open', () => logger.info('WebSocket connected'));
    wsClient.addEventListener('close', () => logger.info('WebSocket disconnected'));
    wsClient.addEventListener('error', (e: Event) => logger.error('WebSocket error', e));

    // Ensure WebSocket is connected
    wsClient.connect();

    return () => {
      // Clean up event listeners
      wsClient.removeEventListener('message', handleAllMessages);
      wsClient.removeEventListener('message', handleJobUpdate);
      wsClient.removeEventListener('message', handleQueueStatus);
      wsClient.removeEventListener('message', handleProcessingStatus);
    };
  }, [toast, jobs, loadData]);

  // Update activeProcesses whenever jobs change
  useEffect(() => {
    const processing = jobs.filter(
      (j: ProcessingJob) => j.status === 'processing' || j.status === 'scanning',
    );
    setActiveProcesses(processing);
    // console.log('[Processing] Updated activeProcesses:', processing);
  }, [jobs]);

  useEffect(() => {
    loadData();
    loadActiveJobs(); // Load active jobs for monitor tab
    const intervalId = setInterval(() => {
      loadData();
      loadActiveJobs(); // Keep active jobs updated
    }, 10000); // Poll every 10 seconds for updates
    return () => clearInterval(intervalId);
  }, []);

  // Function to handle tab changes
  const handleTabChange = (tab: string) => {
    if (tab === 'monitor') {
      loadActiveJobs(); // Load active jobs when monitor tab is accessed
    }
  };

  const startBatchProcessing = async (
    jobIds: (string | number)[],
    profileId: string | number,
  ) => {
    try {
      await Promise.all(
        jobIds.map((id) =>
          ProcessingJobEntity.update(id, {
            status: 'processing',
            processing_notes: `Batch processing started with profile ${profileId}`,
          }),
        ),
      );
      await loadData();
    } catch (error) {
      console.error('Error starting batch processing:', error);
    }
  };

  const stopProcessing = async (jobId: string | number) => {
    try {
      await ProcessingJobEntity.update(jobId, {
        status: 'detected',
        processing_notes: 'Processing stopped by user',
      });
      await loadData();
    } catch (error) {
      console.error('Error stopping processing:', error);
    }
  };

  const getProcessingStats = () => {
    const processing = jobs.filter((j) => j.status === 'processing').length;
    const queued = jobs.filter((j) => j.status === 'verified' && j.manual_verified).length;
    const completed = jobs.filter((j) => j.status === 'completed').length;
    const failed = jobs.filter((j) => j.status === 'failed').length;
    return { processing, queued, completed, failed };
  };

  const stats = getProcessingStats();

  // Update handleDeleteJob to use selected
  const handleDeleteJob = async (jobId: string | number) => {
    try {
      await ProcessingJobEntity.delete(jobId);
      setSelected((ids) => ids.filter((id) => id !== jobId));
      await loadData();
      toast({ type: 'success', message: 'Job deleted' });
    } catch (error) {
      toast({ type: 'error', message: 'Failed to delete job' });
    }
  };

  // Bulk delete for selected jobs
  const handleBulkDelete = async () => {
    // console.log('Selected jobs at delete:', selected);
    if (selected.length === jobs.length && jobs.length > 0) {
      // console.log('Sending { all: true } to bulkDelete');
      await ProcessingJobEntity.bulkDelete({ all: true });
      setSelected([]);
      await loadData();
      toast({ type: 'success', message: 'All jobs deleted' });
      // Trigger background temp file cleanup
      try {
        await apiClient.cleanupTempFiles();
      } catch (cleanupErr) {
        // Ignore cleanup errors, just log
        // console.error('Temp file cleanup error:', cleanupErr);
      }
    } else {
      // console.log('Sending jobIds to bulkDelete:', selected);
      await ProcessingJobEntity.bulkDelete({ jobIds: selected });
      setSelected([]);
      await loadData();
      toast({ type: 'success', message: 'Selected jobs deleted' });
    }
  };

  // Fetch worker limits on mount
  useEffect(() => {
    const fetchWorkerLimits = async () => {
      try {
        const settings = await apiClient.getAllSettings();
        setCpuLimit(parseInt(settings.cpu_worker_limit, 10) || 2);
        setGpuLimit(parseInt(settings.gpu_worker_limit, 10) || 1);
      } catch (err) {
        // ignore
      }
    };
    fetchWorkerLimits();
  }, []);

  // Save worker limits
  const saveWorkerLimits = async (cpu: number, gpu: number) => {
    setWorkerSaving('saving');
    try {
      await apiClient.setAllSettings({ cpu_worker_limit: cpu, gpu_worker_limit: gpu });
      setWorkerSaving('saved');
      setTimeout(() => setWorkerSaving('idle'), 1200);
      toast({ type: 'success', message: 'Worker limits updated' });
    } catch (err) {
      setWorkerSaving('idle');
      toast({ type: 'error', message: 'Failed to update worker limits' });
    }
  };

  // Only show jobs with status 'processing' and a recent progress update (last 30s)
  const now = Date.now();
  const activeJobs = Object.keys(jobProgress)
    .map((id) => jobs.find((j) => j.id?.toString() === id))
    .filter((j) => j && now - jobProgress[j.id as string | number].updated < 30000);

  // console.log('[Processing] ActiveJobs result:', {
  //   totalJobs: jobs.length,
  //   activeJobsCount: activeJobs.length,
  //   jobProgressKeys: Object.keys(jobProgress),
  //   activeJobs: activeJobs.map((j) => j ? { id: j.id, status: j.status, progress: jobProgress[j.id as string | number]?.progress } : null),
  // });

  return (
    <div className="container mx-auto p-6 space-y-6 min-h-screen overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-white">Processing</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              // console.log('[Processing] Sending test WebSocket message');
              wsClient.send({ type: 'test', message: 'Test from Processing page' });
            }}
            variant="outline"
            size="sm"
            className="text-white border-slate-600 hover:bg-slate-700"
          >
            Test WebSocket
          </Button>
        </div>
      </div>
      {/* Queue Status Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <QueueStatus queueStatus={queueStatus} />
        </div>
        <div className="space-y-6">
          {/* Active Processes Summary */}
          <Card className="border-0 rounded-2xl shadow-lg bg-slate-800/90 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-white">
                Active Processes ({activeProcesses.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeProcesses.length === 0 ? (
                <p className="text-slate-500 text-center py-4">No active processes</p>
              ) : (
                <div className="space-y-3">
                  {activeProcesses.slice(0, 5).map((process) => (
                    <div
                      key={process.id}
                      className="p-3 bg-slate-900/50 rounded-lg border border-slate-700"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-white font-medium">
                          {mediaFiles.find((f) => f.id === process.media_file_id)?.file_name || 'Unknown'}
                        </span>
                        <span className="text-xs text-slate-400">
                          {process.status}
                        </span>
                      </div>
                      {process.processing_notes && (
                        <p className="text-xs text-slate-500 mt-1">
                          {process.processing_notes}
                        </p>
                      )}
                    </div>
                  ))}
                  {activeProcesses.length > 5 && (
                    <p className="text-xs text-slate-500 text-center">
                      +{activeProcesses.length - 5} more processes
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="queue" className="space-y-6 h-full" onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-4 bg-slate-800/90 backdrop-blur-md border border-slate-700">
          <TabsTrigger value="queue" className="text-white">Queue</TabsTrigger>
          <TabsTrigger value="monitor" className="text-white">Monitor</TabsTrigger>
          <TabsTrigger value="analyzer" className="text-white">Analyzer</TabsTrigger>
          <TabsTrigger value="batch" className="text-white">Batch</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="space-y-6 h-100 pb-32">
          <ProcessingQueue
            jobs={jobs}
            mediaFiles={mediaFiles}
            profiles={profiles}
            onStopProcessing={stopProcessing}
            isLoading={isLoading}
            onDeleteJob={handleDeleteJob}
            selected={selected}
            setSelected={setSelected}
            onBulkDelete={handleBulkDelete}
            bulkDeleteLoading={bulkDeleteLoading}
            totalJobs={totalJobs}
          />
        </TabsContent>

        <TabsContent value="monitor" className="space-y-6">
          <ProcessingMonitor
            activeProcesses={activeProcesses}
            mediaFiles={mediaFiles}
            jobProgress={jobProgress}
          />
        </TabsContent>

        <TabsContent value="analyzer" className="space-y-6">
          <AudioAnalyzer
            audioAnalyses={audioAnalyses}
            mediaFiles={mediaFiles}
            onRefresh={loadData}
          />
        </TabsContent>

        <TabsContent value="batch" className="space-y-6">
          <BatchProcessor
            jobs={jobs}
            mediaFiles={mediaFiles}
            profiles={profiles}
            onStartBatch={startBatchProcessing}
          />
        </TabsContent>
      </Tabs>
      {/* Fixed bottom bar for deletion */}
      {selected.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="bg-gray-800/90 backdrop-blur-lg border border-gray-700/50 rounded-2xl shadow-2xl p-4 flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-gray-300">
              <span className="font-medium">{selected.length} selected</span>
            </div>
            <button
              onClick={handleBulkDelete}
              className="bg-red-500/90 hover:bg-red-500 text-white font-semibold py-2 px-6 rounded-xl shadow-lg shadow-red-500/25 transition-all duration-200 hover:shadow-red-500/40 hover:scale-105 flex items-center space-x-2 disabled:opacity-60 disabled:cursor-not-allowed"
              aria-label={`Delete ${selected.length} selected jobs`}
              disabled={bulkDeleteLoading}
            >
              <Trash2 className="w-4 h-4" />
              <span>{bulkDeleteLoading ? 'Deleting...' : 'Delete'}</span>
              {bulkDeleteLoading && (
                <svg className="animate-spin ml-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
