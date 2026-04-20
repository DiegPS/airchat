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
    messages,
    scrollRef,
    onStop,
    obsStatus
}: ChatPageProps) {
    const sidebarVisible = showUI && showSidebar;
    return (
        <>
            <TitleBar show={showUI} onToggleSidebar={onToggleSidebar} sidebarVisible={showSidebar} />
            <div className={`dashboard-layout ${!sidebarVisible ? 'sidebar-hidden' : ''}`}>
                <Sidebar
                    showSidebar={sidebarVisible}
                    channelId={channelId}
                    liveId={liveId}
                    isPreviewMode={isPreviewMode}
                    onStop={onStop}
                />
                <PreviewArea
                    messages={messages}
                    scrollRef={scrollRef}
                    channelId={channelId}
                    isPreviewMode={isPreviewMode}
                />
                {obsStatus && obsStatus.connected && (
                    <StreamHUD status={obsStatus} />
                )}
            </div>
        </>
    );
}
