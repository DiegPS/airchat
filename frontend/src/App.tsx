import { useState, useEffect } from 'react';
import './App.css';
import { SettingsProvider } from './context/SettingsContext';
import { useChat } from './hooks/useChat';
import { SetupScreen } from './components/SetupScreen';
import { Sidebar } from './components/Sidebar';
import { PreviewArea } from './components/PreviewArea';

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
        scrollToBottomRef
    } = useChat();

    const [showSidebar, setShowSidebar] = useState(true);

    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key.toLowerCase() === 'b') {
                setShowSidebar(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, []);

    if (!isStarted && !isPreviewMode) {
        return (
            <SetupScreen
                channelId={channelId}
                onChannelIdChange={setChannelId}
                onStart={startChat}
                onPreview={startPreview}
                error={error}
            />
        );
    }

    return (
        <div className={`dashboard-layout ${!showSidebar ? 'sidebar-hidden' : ''}`}>
            <Sidebar
                showSidebar={showSidebar}
                channelId={channelId}
                liveId={liveId}
                isPreviewMode={isPreviewMode}
                onStop={stopChat}
            />
            <PreviewArea
                messages={messages}
                scrollRef={scrollToBottomRef}
            />
        </div>
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
