import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Play,
  Pause,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileVideo,
  List,
  Trash2,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProcessingJob, MediaFile, ProcessingProfile } from '../entities/all';
import { ProcessingJobEntity } from '../entities/ProcessingJob';
import { apiClient } from '../../integration/api-client';

interface ProcessingQueueProps {
  jobs: ProcessingJob[];
  mediaFiles: MediaFile[];
  profiles: ProcessingProfile[];
  onStopProcessing: (jobId: string | number) => Promise<void>;
  isLoading: boolean;
  onDeleteJob: (jobId: string | number) => Promise<void>;
  selected: (string | number)[];
  setSelected: (ids: (string | number)[]) => void;
  onBulkDelete?: () => Promise<void>;
  bulkDeleteLoading?: boolean;
  totalJobs: number;
}

export default function ProcessingQueue({
  jobs,
  mediaFiles,
  profiles,
  onStopProcessing,
  isLoading,
  onDeleteJob,
  selected,
  setSelected,
  onBulkDelete,
  bulkDeleteLoading,
  totalJobs,
}: ProcessingQueueProps) {
  const [filter, setFilter] = useState<string>('all');
  const [selectAllLoading, setSelectAllLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [jobsPerPage] = useState<number>(50);

  const jobsWithId = jobs.filter((job) => job.id !== undefined && job.id !== null);
  // Comment out noisy logging
  // console.log('Job IDs in queue:', jobsWithId.map((j) => j.id));
  const filteredJobs = jobsWithId.filter((job) => filter === 'all' || job.status === filter);

  // Pagination
  const totalPages = Math.ceil(filteredJobs.length / jobsPerPage);
  const startIndex = (currentPage - 1) * jobsPerPage;
  const endIndex = startIndex + jobsPerPage;
  const currentJobs = filteredJobs.slice(startIndex, endIndex);

  // Track if select all is active (backend-driven)
  const [selectAllActive, setSelectAllActive] = useState(false);

  // Use totalJobs for select all label
  const totalJobsFromBackend = totalJobs || filteredJobs.length;
  // If jobs are paginated, pass total from parent as a prop for accuracy

  // Select all logic
  const allSelected = selectAllActive;

  const [cpuLimit, setCpuLimit] = useState<number>(2);
  const [gpuLimit, setGpuLimit] = useState<number>(1);
  const [cpuPaused, setCpuPaused] = useState(false);
  const [gpuPaused, setGpuPaused] = useState(false);
  const [prevCpuLimit, setPrevCpuLimit] = useState<number>(2);
  const [prevGpuLimit, setPrevGpuLimit] = useState<number>(1);
  const [workerSaving, setWorkerSaving] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Fetch worker limits on mount
  useEffect(() => {
    const fetchWorkerLimits = async () => {
      try {
        const settings = await apiClient.getAllSettings();
        const cpu = parseInt(settings.cpu_worker_limit, 10) || 2;
        const gpu = parseInt(settings.gpu_worker_limit, 10) || 1;
        setCpuLimit(cpu);
        setPrevCpuLimit(cpu);
        setGpuLimit(gpu);
        setPrevGpuLimit(gpu);
        setCpuPaused(cpu === 0);
        setGpuPaused(gpu === 0);
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
    } catch (err) {
      setWorkerSaving('idle');
    }
  };

  const getMediaFile = (mediaFileId: string | number): MediaFile | undefined => {
    return mediaFiles.find((f) => f.id === mediaFileId);
  };

  const statusConfig = {
    processing: { color: 'bg-blue-100 text-blue-700', icon: Play },
    verified: { color: 'bg-amber-100 text-amber-700', icon: Clock },
    completed: { color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
    failed: { color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  };

  // Handle select all for ALL jobs (backend-driven)
  const handleSelectAll = () => {
    if (selectAllActive) {
      setSelectAllActive(false);
      setSelected([]);
    } else {
      setSelectAllActive(true);
      setSelected([]); // Don't try to select all IDs in frontend
    }
  };

  const handleRowSelect = (jobId: string | number) => {
    if (jobId === undefined || jobId === null) {
      return;
    }
    if (selected.includes(jobId)) {
      setSelected(selected.filter((id) => id !== jobId));
    } else {
      setSelected([...selected, jobId]);
    }
  };

  // Handlers for custom controls
  const handleCpuChange = (val: number) => {
    setCpuLimit(val);
    setPrevCpuLimit(val);
    saveWorkerLimits(val, gpuLimit);
  };
  const handleGpuChange = (val: number) => {
    setGpuLimit(val);
    setPrevGpuLimit(val);
    saveWorkerLimits(cpuLimit, val);
  };
  const toggleCpuPause = async () => {
    if (cpuPaused) {
      await apiClient.resumeCpuWorkers();
      setCpuPaused(false);
    } else {
      await apiClient.pauseCpuWorkers();
      setCpuPaused(true);
    }
  };
  const toggleGpuPause = async () => {
    if (gpuPaused) {
      await apiClient.resumeGpuWorkers();
      setGpuPaused(false);
    } else {
      await apiClient.pauseGpuWorkers();
      setGpuPaused(true);
    }
  };

  // Bulk delete handler
  const handleBulkDelete = async () => {
    if (selectAllActive) {
      await ProcessingJobEntity.bulkDelete({ all: true, filter: filter !== 'all' ? { status: filter } : undefined });
      setSelectAllActive(false);
      setSelected([]);
    } else {
      await ProcessingJobEntity.bulkDelete({ jobIds: selected });
      setSelected([]);
    }
    // Optionally, reload jobs after delete
  };

  return (
    <Card className="border-0 rounded-2xl shadow-lg bg-slate-800/90 backdrop-blur-md flex flex-col min-h-0">
      <CardHeader>
        <div className="relative flex items-center justify-between">
          {/* Left group: title, select all, delete */}
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2 text-lg font-bold text-white">
              <List className="w-5 h-5" />
              Job Queue
            </CardTitle>
            <div className="flex items-center gap-2 ml-4">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={handleSelectAll}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2 transition-all duration-200"
                id="select-all-jobs"
                disabled={selectAllLoading}
              />
              {selectAllLoading && (
                <span className="text-xs text-blue-400 animate-pulse ml-1">Loading all…</span>
              )}
              <label htmlFor="select-all-jobs" className="text-slate-200 text-xs">
                Select all ({totalJobsFromBackend})
              </label>
            </div>
            {(selected.length > 0 || selectAllActive) && onBulkDelete && (
              <div className="flex items-center gap-2 ml-4">
                <span className="text-xs text-slate-300">
                  {allSelected ? totalJobsFromBackend : selected.length} selected
                </span>
                <Button
                  onClick={handleBulkDelete}
                  size="sm"
                  variant="destructive"
                  className="h-7 px-3 text-xs bg-red-500/90 hover:bg-red-500 text-white rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={bulkDeleteLoading}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  <span>{bulkDeleteLoading ? 'Deleting...' : 'Delete'}</span>
                  {bulkDeleteLoading && (
                    <svg className="animate-spin ml-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
                  )}
                </Button>
              </div>
            )}
          </div>
          {/* Centered worker controls */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-4 z-10">
            {/* CPU Controls */}
            <div className="flex items-center gap-1">
              <button
                className={`rounded-full p-1 bg-slate-700 hover:bg-blue-700 transition text-xs ${cpuPaused ? 'opacity-50' : ''}`}
                style={{ minWidth: 22, height: 22 }}
                onClick={() => !cpuPaused && handleCpuChange(Math.max(1, cpuLimit - 1))}
                disabled={cpuPaused || cpuLimit <= 1}
                tabIndex={-1}
                aria-label="Decrease CPU workers"
              >
                –
              </button>
              <span className="text-xs text-slate-300 font-semibold ml-1">CPU</span>
              <span className="w-5 text-center text-xs font-bold text-white select-none mx-1">
                {cpuLimit}
              </span>
              <button
                className={`rounded-full p-1 bg-slate-700 hover:bg-blue-700 transition text-xs ${cpuPaused ? 'opacity-50' : ''}`}
                style={{ minWidth: 22, height: 22 }}
                onClick={() => !cpuPaused && handleCpuChange(Math.min(16, cpuLimit + 1))}
                disabled={cpuPaused || cpuLimit >= 16}
                tabIndex={-1}
                aria-label="Increase CPU workers"
              >
                +
              </button>
              <button
                className={`ml-1 rounded-full p-1 ${cpuPaused ? 'bg-green-600 hover:bg-green-700' : 'bg-yellow-600 hover:bg-yellow-700'} transition`}
                style={{ minWidth: 22, height: 22 }}
                onClick={toggleCpuPause}
                aria-label={cpuPaused ? 'Resume CPU workers' : 'Pause CPU workers'}
                title={cpuPaused ? 'Resume CPU workers' : 'Pause CPU workers'}
              >
                {cpuPaused ? <Play className="w-3 h-3 text-white" /> : <Pause className="w-3 h-3 text-white" />}
              </button>
            </div>
            {/* GPU Controls */}
            <div className="flex items-center gap-1">
              <button
                className={`rounded-full p-1 bg-slate-700 hover:bg-blue-700 transition text-xs ${gpuPaused ? 'opacity-50' : ''}`}
                style={{ minWidth: 22, height: 22 }}
                onClick={() => !gpuPaused && handleGpuChange(Math.max(1, gpuLimit - 1))}
                disabled={gpuPaused || gpuLimit <= 1}
                tabIndex={-1}
                aria-label="Decrease GPU workers"
              >
                –
              </button>
              <span className="text-xs text-slate-300 font-semibold ml-1">GPU</span>
              <span className="w-5 text-center text-xs font-bold text-white select-none mx-1">
                {gpuLimit}
              </span>
              <button
                className={`rounded-full p-1 bg-slate-700 hover:bg-blue-700 transition text-xs ${gpuPaused ? 'opacity-50' : ''}`}
                style={{ minWidth: 22, height: 22 }}
                onClick={() => !gpuPaused && handleGpuChange(Math.min(8, gpuLimit + 1))}
                disabled={gpuPaused || gpuLimit >= 8}
                tabIndex={-1}
                aria-label="Increase GPU workers"
              >
                +
              </button>
              <button
                className={`ml-1 rounded-full p-1 ${gpuPaused ? 'bg-green-600 hover:bg-green-700' : 'bg-yellow-600 hover:bg-yellow-700'} transition`}
                style={{ minWidth: 22, height: 22 }}
                onClick={toggleGpuPause}
                aria-label={gpuPaused ? 'Resume GPU workers' : 'Pause GPU workers'}
                title={gpuPaused ? 'Resume GPU workers' : 'Pause GPU workers'}
              >
                {gpuPaused ? <Play className="w-3 h-3 text-white" /> : <Pause className="w-3 h-3 text-white" />}
              </button>
            </div>
            {/* Save/Loading indicator with fixed width */}
            <div className="w-6 flex items-center justify-center">
              {workerSaving === 'saving' && <Loader2 className="w-4 h-4 animate-spin text-blue-400" />}
              {workerSaving === 'saved' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
            </div>
          </div>
          {/* Right group: filter dropdown */}
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48 rounded-lg bg-slate-900 text-slate-200 border-slate-700">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 text-slate-200 border-slate-700">
              <SelectItem value="all">All Jobs</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="verified">Queued (Verified)</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 max-h-[60vh] overflow-y-auto flex-1 min-h-0">

        {isLoading && filteredJobs.length === 0 ? (
          <p className="text-slate-400">Loading...</p>
        ) : filteredJobs.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <p>No jobs in this category.</p>
          </div>
        ) : (
          <AnimatePresence>
            {currentJobs.map((job) => {
              const mediaFile = getMediaFile(job.media_file_id);
              const config = statusConfig[job.status as keyof typeof statusConfig] || {
                color: 'bg-slate-700 text-slate-200',
                icon: Clock,
              };
              const StatusIcon = config.icon;
              return (
                <motion.div
                  key={job.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="p-5 border-0 rounded-xl shadow-md bg-slate-900/80 hover:scale-[1.01] transition-transform duration-200 cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={selectAllActive || selected.includes(job.id!)}
                      onChange={() => handleRowSelect(job.id!)}
                      className="w-4 h-4 mt-2 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2 transition-all duration-200"
                      title="Select job"
                      disabled={selectAllActive}
                    />
                    <div className="flex-1 space-y-2">
                      <h3 className="font-semibold text-white text-base">
                        {mediaFile?.file_name || 'Loading...'}
                      </h3>
                      <div className="flex items-center gap-2">
                        <Badge className={`${config.color} capitalize rounded-full px-3 py-1 text-xs font-semibold border border-slate-700`}> <StatusIcon className="w-3 h-3 mr-1.5" /> {job.status}
                        </Badge>
                        <Badge variant="outline" className="rounded-full px-3 py-1 text-xs border-slate-700 text-slate-200">
                          Profile: {profiles.find((p) => p.id === job.profile_id)?.name || 'Auto'}
                        </Badge>
                      </div>
                      {job.status === 'processing' && (
                        <Progress value={50} className="h-2 mt-2 rounded-full bg-slate-700" />
                      )}
                    </div>
                    {job.status === 'processing' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onStopProcessing(job.id!)}
                        className="rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200"
                      >
                        <Pause className="w-5 h-5" />
                      </Button>
                    )}
                    {job.status === 'completed' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDeleteJob(job.id!)}
                        className="rounded-full bg-slate-800 hover:bg-red-700 text-red-400"
                        title="Remove job"
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-slate-700">
            <div className="text-sm text-slate-400">
              Showing {startIndex + 1}-{Math.min(endIndex, filteredJobs.length)} of {filteredJobs.length} jobs
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="text-slate-300 border-slate-600 hover:bg-slate-700"
              >
                Previous
              </Button>
              <span className="text-sm text-slate-300 px-3">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="text-slate-300 border-slate-600 hover:bg-slate-700"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
