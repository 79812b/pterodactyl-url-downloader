import React, { useState, useEffect } from 'react';
import { Dialog } from '@/components/elements/dialog';
import { Button } from '@/components/elements/button';
import useFileManagerSwr from '@/plugins/useFileManagerSwr';
import { ServerContext } from '@/state/server';
import http from '@/api/http';
import { bytesToString } from '@/lib/formatters';
import Spinner from '@/components/elements/Spinner';

interface Props {
    visible: boolean;
    onClose: () => void;
    directory: string;
}

const UrlDownloadModal: React.FC<Props> = ({ visible, onClose, directory }) => {
    const [url, setUrl] = useState('');
    const [downloadState, setDownloadState] = useState({
        progress: 0,
        totalSize: 0,
        downloaded: 0,
        status: 'idle' as 'idle' | 'validating' | 'downloading' | 'error' | 'completed',
        error: '',
        jobId: '',
    });

    const { mutate } = useFileManagerSwr();

    useEffect(() => {
        if (downloadState.status === 'downloading' && downloadState.jobId) {
            const interval = setInterval(() => updateProgress(), 1000);
            return () => clearInterval(interval);
        }
        return undefined;
    }, [downloadState.status]);

    const updateProgress = async () => {
        try {
            const { data } = await http.get(`/api/client/servers/:server/files/download/${downloadState.jobId}/progress`);
            setDownloadState({
                ...data,
                status: data.progress === 100 ? 'completed' : 'downloading',
            });

            if (data.progress === 100) {
                mutate();
                setTimeout(() => onClose(), 2000);
            }
        } catch (error) {
            setDownloadState({
                ...downloadState,
                status: 'error',
                error: 'Failed to fetch progress updates',
            });
        }
    };

    return (
        <Dialog open={visible} onClose={onClose} hideCloseIcon>
            <div className="p-6">
                <h2 className="text-2xl mb-4">Download from URL</h2>
                <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/file.zip"
                    className="w-full p-2 border rounded mb-4"
                />
                <Button onClick={onClose}>Close</Button>
            </div>
        </Dialog>
    );
};

export default UrlDownloadModal;
