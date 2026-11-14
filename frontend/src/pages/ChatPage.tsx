import { Sidebar } from '../components/Sidebar';
import { PreviewArea } from '../components/PreviewArea';
import { StreamHUD } from '../components/StreamHUD';
import { TitleBar } from '../components/TitleBar';
import { PlatformView } from '../hooks/usePlatforms';
import { OBSStatus } from '../hooks/useOBSConnection';
import { ChatItem } from '../types';

interface ChatPageProps {
    showUI: boolean;
    showSidebar: boolean;
    onToggleSidebar: () => void;
    platforms: PlatformView[];
    isPreviewMode: boolean;
    messages: ChatItem[];
    scrollRef: React.RefObject<HTMLDivElement>;
    onStop: () => void;
    obsStatus: OBSStatus | null;
}

export function ChatPage({
    showUI,
    showSidebar,
    onToggleSidebar,
    platforms,
    isPreviewMode,
    messages,
    scrollRef,
    onStop,
    obsStatus,
}: ChatPageProps) {
    const sidebarVisible = showUI && showSidebar;
    return (
        <>
            <TitleBar
                show={showUI}
                onToggleSidebar={onToggleSidebar}
                sidebarVisible={showSidebar}
                platforms={platforms}
                isPreviewMode={isPreviewMode}
            />
            <div className={`dashboard-layout ${!sidebarVisible ? 'sidebar-hidden' : ''}`}>
                <Sidebar
                    showSidebar={sidebarVisible}
                    platforms={platforms}
                    isPreviewMode={isPreviewMode}
                    onStop={onStop}
                />
                <PreviewArea messages={messages} scrollRef={scrollRef} />
                {obsStatus?.connected && <StreamHUD status={obsStatus} />}
            </div>
        </>
    );
}
