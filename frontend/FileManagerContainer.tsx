// frontend/FileManagerContainer.tsx
import React from 'react';
import { ServerContext } from '@/state/server';
import { Button } from '@/components/elements/button';
import UrlDownloadModal from './UrlDownloadModal';

export default () => {
    const [showDownloadModal, setShowDownloadModal] = React.useState(false);
    const selectedDirectory = ServerContext.useStoreState((state) => state.files.selectedDirectory);

    return (
        <div>
            {/* Add the Download button to the toolbar */}
            <Button onClick={() => setShowDownloadModal(true)} className="ml-4">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download from URL
            </Button>

            {/* Render the download modal */}
            <UrlDownloadModal
                visible={showDownloadModal}
                onClose={() => setShowDownloadModal(false)}
                directory={selectedDirectory}
            />
        </div>
    );
};
