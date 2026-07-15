import { Sidebar } from '../components/Sidebar';
import { PreviewArea } from '../components/PreviewArea';
import { StreamHUD } from '../components/StreamHUD';
import { TitleBar } from '../components/TitleBar';
import { ChatItem } from '../types';

interface ChatPageProps {
    showUI: boolean;
    showSidebar: boolean;
    onToggleSidebar: () => void;
    channelId: string;
    liveId: string;
    isPreviewMode: boolean;
    isStarted: boolean;
    isTwitchStarted: boolean;
    isKickStarted: boolean;
    isTikTokStarted: boolean;
    twitchChannel: string;
    kickChannel: string;
    tiktokChannel: string;
    error: string;
    twitchError: string;
    kickError: string;
    tiktokError: string;
    messages: ChatItem[];
    scrollRef: React.RefObject<HTMLDivElement>;
    onStop: () => void;
    obsStatus: any;
}

export function ChatPage({
    showUI,
    showSidebar,
    onToggleSidebar,
    channelId,
    liveId,
    isPreviewMode,
    isStarted,
    isTwitchStarted,
    isKickStarted,
    isTikTokStarted,
    twitchChannel,
    kickChannel,
    tiktokChannel,
    error,
    twitchError,
    kickError,
    tiktokError,
    messages,
    scrollRef,
    onStop,
    obsStatus
}: ChatPageProps) {
    const sidebarVisible = showUI && showSidebar;
    return (
        <>
            <TitleBar show={showUI} onToggleSidebar={onToggleSidebar} sidebarVisible={showSidebar} isStarted={isStarted} isTwitchStarted={isTwitchStarted} isKickStarted={isKickStarted} isPreviewMode={isPreviewMode} />
            <div className={`dashboard-layout ${!sidebarVisible ? 'sidebar-hidden' : ''}`}>
                <Sidebar
                    showSidebar={sidebarVisible}
                    channelId={channelId}
                    liveId={liveId}
                    isPreviewMode={isPreviewMode}
                    isStarted={isStarted}
                    isTwitchStarted={isTwitchStarted}
                    isKickStarted={isKickStarted}
                    isTikTokStarted={isTikTokStarted}
                    twitchChannel={twitchChannel}
                    kickChannel={kickChannel}
                    tiktokChannel={tiktokChannel}
                    error={error}
                    twitchError={twitchError}
                    kickError={kickError}
                    tiktokError={tiktokError}
                    onStop={onStop}
                />
                <PreviewArea
                    messages={messages}
                    scrollRef={scrollRef}
                />
                {obsStatus && obsStatus.connected && (
                    <StreamHUD status={obsStatus} />
                )}
            </div>
        </>
    );
}
