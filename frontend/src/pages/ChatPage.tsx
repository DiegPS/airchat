import { Sidebar } from '../components/Sidebar';
import { PreviewArea } from '../components/PreviewArea';
import { StreamHUD } from '../components/StreamHUD';
import { TitleBar } from '../components/TitleBar';
import { ChatItem } from '../types';

interface ChatPageProps {
    showUI: boolean;
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
    channelId, 
    liveId, 
    isPreviewMode, 
    messages, 
    scrollRef, 
    onStop,
    obsStatus 
}: ChatPageProps) {
    return (
        <>
            <TitleBar show={showUI} />
            <div className={`dashboard-layout ${!showUI ? 'sidebar-hidden' : ''}`}>
                <Sidebar
                    showSidebar={showUI}
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
