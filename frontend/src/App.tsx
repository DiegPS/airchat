import { useState, useEffect } from 'react';
import './App.css';
import { SettingsProvider } from './context/SettingsContext';
import { useChat } from './hooks/useChat';
import { SetupScreen } from './components/SetupScreen';
import { Sidebar } from './components/Sidebar';
import { PreviewArea } from './components/PreviewArea';
import { TitleBar } from './components/TitleBar';



import { StreamHUD } from './components/StreamHUD';
import { SetClickThrough } from '../wailsjs/go/main/App';

function AppContent() {
    const {
        messages,
        isStarted,
        error,
        liveId,
        isPreviewMode,
        channelId,
        setChannelId,
        startChat,
        startPreview,
        stopChat,
        scrollToBottomRef,
        obsStatus
    } = useChat();

    const [showUI, setShowUI] = useState(true);
    const isSetup = !isStarted && !isPreviewMode;

    // Reset UI visibility when entering setup mode or starting a new session
    useEffect(() => {
        if (isSetup) {
            setShowUI(true);
            SetClickThrough(false);
        }
    }, [isSetup]);

    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            // Disable shortcut on setup screen
            if (isSetup) return;

            if (e.ctrlKey && e.key.toLowerCase() === 'b') {
                setShowUI(prev => {
                    const next = !prev;
                    SetClickThrough(!next);
                    return next;
                });
            }
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [isSetup]);

    if (isSetup) {
        return (
            <>
                <TitleBar show={true} />
                <SetupScreen
                    channelId={channelId}
                    onChannelIdChange={setChannelId}
                    onStart={startChat}
                    onPreview={startPreview}
                    error={error}
                />
            </>
        );
    }

    return (
        <>
            <TitleBar show={showUI} />
            <div className={`dashboard-layout ${!showUI ? 'sidebar-hidden' : ''}`}>
                <Sidebar
                    showSidebar={showUI}
                    channelId={channelId}
                    liveId={liveId}
                    isPreviewMode={isPreviewMode}
                    onStop={stopChat}
                />
                <PreviewArea
                    messages={messages}
                    scrollRef={scrollToBottomRef}
                    channelId={channelId}
                    isPreviewMode={isPreviewMode}
                />
                {!showUI && obsStatus && obsStatus.connected && (
                    <StreamHUD status={obsStatus} />
                )}
            </div>
        </>
    );
}

function App() {
    return (
        <SettingsProvider>
            <AppContent />
        </SettingsProvider>
    );
}

export default App;
