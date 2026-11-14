import { useCallback, useState } from 'react';
import { StartPreviewChat } from '../../wailsjs/go/main/App';
import { usePlatforms } from './usePlatforms';
import { useMessages } from './useMessages';
import { useOBSConnection } from './useOBSConnection';

export type { OBSStatus } from './useOBSConnection';

/**
 * Composes the app's live state: platform connections, the message feed, the
 * design preview and OBS. This is the only hook that talks to the backend
 * about chat.
 */
export function useChat() {
    const platforms = usePlatforms();
    const obsStatus = useOBSConnection();
    const [isPreviewMode, setIsPreviewMode] = useState(false);
    const [previewError, setPreviewError] = useState('');

    const isActive = platforms.anyActive || isPreviewMode;
    const feed = useMessages(isActive);

    const startChat = useCallback(async () => {
        setPreviewError('');
        feed.open();
        await platforms.startAll();
    }, [feed.open, platforms.startAll]);

    const startPreview = useCallback(() => {
        setPreviewError('');
        feed.open();
        setIsPreviewMode(true);
        StartPreviewChat().catch((err) => {
            setPreviewError(`Preview failed: ${err}`);
            setIsPreviewMode(false);
            feed.clear();
        });
    }, [feed.open, feed.clear]);

    const stopChat = useCallback(async () => {
        await platforms.stopAll();
        setIsPreviewMode(false);
        setPreviewError('');
        feed.clear();
    }, [platforms.stopAll, feed.clear]);

    return {
        platforms: platforms.platforms,
        setInput: platforms.setInput,
        clearInput: platforms.clearInput,
        notice: previewError || platforms.notice,
        messages: feed.messages,
        scrollRef: feed.scrollRef,
        isPreviewMode,
        /** Nothing is running: show the setup screen. */
        isSetup: !isActive,
        /** A chat platform (not the preview) is connected: text-to-speech may run. */
        isLive: platforms.anyActive,
        obsStatus,
        startChat,
        startPreview,
        stopChat,
    };
}
