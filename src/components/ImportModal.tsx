// Modal component for importing shows from Sonarr with multi-select functionality.
// Provides a searchable interface for selecting and importing unimported shows with shift-select support.
import React, { useCallback, useEffect, useRef, useMemo } from 'react';
import { Download, X, Check, ChevronUp, ChevronDown } from 'lucide-react';
import { useShiftSelect } from '../utils/selectionUtils';
import { Card, CardHeader, CardContent, CardFooter, CardTitle } from '@/components/ui/card';

export interface Show {
  id: number;
  title: string;
  path: string;
  episodeCount?: number;
  episodeFileCount?: number;
}

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (selectedIds: number[]) => void;
  shows: Show[];
  loading?: boolean;
  error?: string | null;
}

// Helper function to get the sortable title (removes leading articles) - same as HomePage
const getSortableTitle = (title: string): string => {
  const articles = ['the ', 'a ', 'an '];
  const lowerTitle = title.toLowerCase();

  for (const article of articles) {
    if (lowerTitle.startsWith(article)) {
      return title.substring(article.length).trim();
    }
  }

  return title;
};

export default function ImportModal({
  open,
  onClose,
  onImport,
  shows,
  loading = false,
  error = null,
}: ImportModalProps) {
  // Sort shows by title using the same logic as the main table
  const sortedShows = useMemo(() => {
    return [...shows].sort((a, b) => {
      const aVal = getSortableTitle(a.title);
      const bVal = getSortableTitle(b.title);

      return aVal.localeCompare(bVal, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    });
  }, [shows]);

  const shiftSelect = useShiftSelect({
    items: sortedShows,
    getId: (show) => show.id,
  });

  const { selected, handleToggle, selectAll, deselectAll, isSelected } = shiftSelect;
  const modalRef = useRef<HTMLDivElement>(null);

  const handleOk = useCallback(() => {
    onImport(selected as number[]);
  }, [onImport, selected]);

  useEffect(() => {
    deselectAll();
  }, [shows, open, deselectAll]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && selected.length > 0) {
        handleOk();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, selected.length, handleOk]);

  if (!open) {
    return null;
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  const handleSelectAll = () => {
    if (selected.length === sortedShows.length) {
      deselectAll();
    } else {
      selectAll();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onMouseDown={handleOverlayClick}
    >
      <Card
        ref={modalRef}
        className="w-full max-w-6xl h-[85vh] flex flex-col relative overflow-hidden rounded-2xl shadow-2xl border border-white/10 bg-gray-900/80 backdrop-blur-xl"
      >
        <CardHeader className="flex flex-row items-center justify-between p-0 border-b border-white/10 bg-gray-900/90 backdrop-blur-xl">
          <div className="flex items-center space-x-3 p-6">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-white">Import Shows</CardTitle>
              <p className="text-sm text-gray-200/80">Select shows to import from Sonarr</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-gray-800/60 hover:bg-gray-700/80 rounded-xl flex items-center justify-center transition-all duration-200 text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 ml-4 mt-6 mr-6 backdrop-blur-xl"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden flex flex-col p-0">
          {/* Error Message */}
          {error && (
            <div className="mx-6 mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}
          {/* Table Container */}
          <div className="flex-1 overflow-hidden">
            <div className="h-full overflow-hidden">
              <div className="h-full overflow-auto">
                {loading && (
                  <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-xl z-10 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
                <table className="w-full" role="grid" aria-label="Shows list">
                  <thead className="sticky top-0 bg-gray-900/80 backdrop-blur-xl border-b border-white/10">
                    <tr>
                      <th className="w-16 px-6 py-4 text-center">
                        <div className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={sortedShows.length > 0 && selected.length === sortedShows.length}
                            onChange={handleSelectAll}
                            className="w-4 h-4 text-blue-600 bg-gray-900/40 border-white/20 rounded focus:ring-blue-500 focus:ring-2 transition-all duration-200"
                            aria-label="Select all shows"
                          />
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-200/80 uppercase tracking-wider">
                        <span>Title</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {sortedShows.map((show) => (
                      <tr
                        key={show.id}
                        className={`group transition-all duration-200 hover:bg-gray-800/40 ${
                          isSelected(show.id)
                            ? 'bg-blue-500/10 border-l-4 border-blue-500'
                            : ''
                        }`}
                        role="row"
                        aria-selected={isSelected(show.id)}
                      >
                        <td className="w-16 px-6 py-4 text-center">
                          <div className="flex items-center justify-center">
                            <input
                              type="checkbox"
                              checked={isSelected(show.id)}
                              onChange={(e) => handleToggle(show.id, e.nativeEvent as unknown as React.MouseEvent)}
                              className="w-4 h-4 text-blue-600 bg-gray-900/40 border-white/20 rounded focus:ring-blue-500 focus:ring-2 transition-all duration-200"
                            />
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center">
                              <div className="w-2 h-8 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full mr-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                              <div className="text-white font-medium text-lg drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]">{show.title}</div>
                            </div>
                            {show.episodeFileCount === 0 && (
                              <span className="text-red-400 text-sm font-semibold whitespace-nowrap drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]">No downloaded files in Sonarr</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Empty State */}
                {sortedShows.length === 0 && !loading && (
                  <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                    <div className="w-16 h-16 bg-gray-900/60 rounded-full flex items-center justify-center mb-4 backdrop-blur-xl">
                      <Download className="w-8 h-8" />
                    </div>
                    <p className="text-lg font-medium">No shows available</p>
                    <p className="text-sm">Check your Sonarr connection</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between p-0 border-t border-white/10 bg-gray-900/90 backdrop-blur-xl">
          <div className="text-sm text-gray-400">
            {/* Removed redundant show count - only shown in button now */}
          </div>
          <div className="flex items-center space-x-3 p-6">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-gray-800/60 hover:bg-gray-700/80 text-gray-200 hover:text-white font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500/50 backdrop-blur-xl"
            >
              Cancel
            </button>
            <button
              onClick={handleOk}
              disabled={selected.length === 0}
              className={`px-6 py-2.5 font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 backdrop-blur-xl ${
                selected.length === 0
                  ? 'bg-gray-800/60 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-105'
              }`}
            >
              <span className="flex items-center space-x-2">
                <Download className="w-4 h-4" />
                <span>Import Selected ({selected.length})</span>
              </span>
            </button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
