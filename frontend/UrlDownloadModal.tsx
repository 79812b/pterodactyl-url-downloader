// resources/scripts/components/server/files/UrlDownloadModal.tsx
import React, { useState, useEffect } from 'react';
import { Dialog } from '@/components/elements/dialog';
import { Button } from '@/components/elements/button';
import useFileManagerSwr from '@/plugins/useFileManagerSwr';
import { ServerContext } from '@/state/server';
import { http } from '@/api/http';
import { bytesToString } from '@/lib/formatters';
import Spinner from '@/components/elements/Spinner';

interface DownloadState {
    progress: number;
    totalSize: number;
    downloaded: number;
    status: 'idle' | 'validating' | 'downloading' | 'error' | 'completed';
    error?: string;
    jobId?: string;
}

export default () => {
    const [visible, setVisible] = useState(false);
    const [url, setUrl] = useState('');
    const [downloadState, setDownloadState] = useState<DownloadState>({
        progress: 0,
        totalSize: 0,
        downloaded: 0,
        status: 'idle',
    });
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const { mutate } = useFileManagerSwr();

    useEffect(() => {
        if (downloadState.status === 'downloading' && downloadState.jobId) {
            const interval = setInterval(() => updateProgress(), 1000);
            return () => clearInterval(interval);
        }
    }, [downloadState.status]);

    const validateUrl = async () => {
        setDownloadState({ ...downloadState, status: 'validating' });
        
        try {
            const { data } = await http.post(`/api/client/servers/${uuid}/files/validate-url`, { url });
            
            if (data.size > 1073741824 * 2) { // 2GB limit
                throw new Error('File size exceeds maximum allowed limit (2GB)');
            }

            setDownloadState({
                ...downloadState,
                totalSize: data.size,
                status: 'idle',
            });
        } catch (error) {
            setDownloadState({
                progress: 0,
                totalSize: 0,
                downloaded: 0,
                status: 'error',
                error: error.response?.data.error || 'Invalid URL or unreachable resource',
            });
        }
    };

    const startDownload = async () => {
        try {
            const { data } = await http.post(`/api/client/servers/${uuid}/files/download`, { url });
            
            setDownloadState({
                progress: 0,
                totalSize: data.size,
                downloaded: 0,
                status: 'downloading',
                jobId: data.jobId,
            });
        } catch (error) {
            setDownloadState({
                ...downloadState,
                status: 'error',
                error: error.response?.data.error || 'Failed to start download',
            });
        }
    };

    const updateProgress = async () => {
        try {
            const { data } = await http.get(
                `/api/client/servers/${uuid}/files/download/${downloadState.jobId}/progress`
            );

            setDownloadState({
                ...data,
                status: data.progress === 100 ? 'completed' : 'downloading',
            });

            if (data.progress === 100) {
                mutate();
                setTimeout(() => setVisible(false), 2000);
            }
        } catch (error) {
            setDownloadState({
                ...downloadState,
                status: 'error',
                error: 'Failed to fetch progress updates',
            });
        }
    };

    const cancelDownload = async () => {
        try {
            await http.delete(`/api/client/servers/${uuid}/files/download/${downloadState.jobId}`);
            setDownloadState({
                progress: 0,
                totalSize: 0,
                downloaded: 0,
                status: 'idle',
            });
        } catch (error) {
            setDownloadState({
                ...downloadState,
                status: 'error',
                error: 'Failed to cancel download',
            });
        }
    };

    return (
        <>
            <Button onClick={() => setVisible(true)} className="ml-4">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download from URL
            </Button>

            <Dialog
                open={visible}
                onClose={() => {
                    setVisible(false);
                    setDownloadState({
                        progress: 0,
                        totalSize: 0,
                        downloaded: 0,
                        status: 'idle',
                    });
                }}
                hideCloseIcon
            >
                <div className="p-6">
                    <h2 className="text-2xl mb-4">Download from URL</h2>
                    
                    <div className="space-y-4">
                        <input
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://example.com/file.zip"
                            className="w-full p-2 border rounded bg-transparent"
                            disabled={downloadState.status === 'downloading'}
                        />

                        {downloadState.status === 'validating' && (
                            <div className="flex items-center text-gray-400">
                                <Spinner className="w-4 h-4 mr-2" />
                                Validating URL...
                            </div>
                        )}

                        {downloadState.totalSize > 0 && downloadState.status !== 'downloading' && (
                            <div className="bg-gray-700 p-3 rounded">
                                File size: {bytesToString(downloadState.totalSize)}
                            </div>
                        )}

                        {downloadState.status === 'downloading' && (
                            <div className="space-y-2">
                                <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-cyan-500 transition-all duration-300"
                                        style={{ width: `${downloadState.progress}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>
                                        {bytesToString(downloadState.downloaded)} / {bytesToString(downloadState.totalSize)}
                                    </span>
                                    <span>{downloadState.progress.toFixed(1)}%</span>
                                </div>
                            </div>
                        )}

                        {downloadState.status === 'error' && (
                            <div className="bg-red-500 text-white p-3 rounded">
                                Error: {downloadState.error}
                            </div>
                        )}

                        {downloadState.status === 'completed' && (
                            <div className="bg-green-500 text-white p-3 rounded">
                                Download completed successfully!
                            </div>
                        )}

                        <div className="flex justify-end space-x-4 mt-4">
                            <Button.Text
                                onClick={() => {
                                    setVisible(false);
                                    downloadState.status === 'downloading' && cancelDownload();
                                }}
                            >
                                {downloadState.status === 'downloading' ? 'Cancel' : 'Close'}
                            </Button.Text>
                            
                            {downloadState.status === 'idle' && (
                                <Button
                                    onClick={downloadState.totalSize > 0 ? startDownload : validateUrl}
                                    disabled={!url.trim().length}
                                >
                                    {downloadState.totalSize > 0 ? 'Start Download' : 'Validate URL'}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </Dialog>
        </>
    );
};
