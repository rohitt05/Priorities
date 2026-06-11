// src/contexts/ProfileVideoUploadContext.tsx
import React, { createContext, useContext, useRef, useState, useCallback } from 'react';

export type VideoUploadStatus = 'idle' | 'compressing' | 'uploading' | 'done' | 'error';

interface ProfileVideoUploadContextType {
    uploadStatus: VideoUploadStatus;
    setUploadStatus: (s: VideoUploadStatus) => void;
    /** Profile.tsx registers this so it can update currentUser when upload finishes or video is deleted */
    onVideoReadyRef: React.MutableRefObject<((url: string | null) => void) | null>;
}

const ProfileVideoUploadContext = createContext<ProfileVideoUploadContextType>({
    uploadStatus: 'idle',
    setUploadStatus: () => {},
    onVideoReadyRef: { current: null },
});

export const ProfileVideoUploadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [uploadStatus, setUploadStatus] = useState<VideoUploadStatus>('idle');
    const onVideoReadyRef = useRef<((url: string | null) => void) | null>(null);

    return (
        <ProfileVideoUploadContext.Provider value={{ uploadStatus, setUploadStatus, onVideoReadyRef }}>
            {children}
        </ProfileVideoUploadContext.Provider>
    );
};

export const useProfileVideoUpload = () => useContext(ProfileVideoUploadContext);
