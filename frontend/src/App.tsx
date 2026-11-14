import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom';
import './App.css';
import { SettingsProvider } from './context/SettingsContext';
import { useChat } from './hooks/useChat';
import { useTTS } from './hooks/useTTS';
import { SupertonicProvider } from './hooks/supertonic2/useSupertonic';
import { HomePage } from './pages/HomePage';
import { ChatPage } from './pages/ChatPage';
import { SetClickThrough } from '../wailsjs/go/main/App';

function AppContent() {
    const navigate = useNavigate();
    const {
        messages,
        isStarted,
        isTwitchStarted,
        isKickStarted,
        error,
        twitchError,
        kickError,
        liveId,
        isPreviewMode,
        channelId,
        setChannelId,
        clearYoutubeChannel,
        twitchChannel,
        setTwitchChannel,
        clearTwitchChannel,
        kickChannel,
        setKickChannel,
        clearKickChannel,
        startChat,
        startPreview,
        stopChat,
        scrollToBottomRef,
        obsStatus
    } = useChat();

    useTTS(isStarted || isTwitchStarted || isKickStarted);

    const [showUI, setShowUI] = useState(true);
    const [showSidebar, setShowSidebar] = useState(true);
    const isSetup = !isStarted && !isTwitchStarted && !isKickStarted && !isPreviewMode;

    // Navigate based on setup state
    useEffect(() => {
        if (isSetup) {
            navigate('/');
        } else {
            navigate('/chat');
        }
    }, [isSetup, navigate]);

    // Reset UI visibility when entering setup mode or starting a new session
    useEffect(() => {
        if (isSetup) {
            setShowUI(true);
            setShowSidebar(true);
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

    return (
        <Routes>
            <Route 
                path="/" 
                element={
                    <HomePage
                        channelId={channelId}
                        onChannelIdChange={setChannelId}
                        onClearYoutube={clearYoutubeChannel}
                        twitchChannel={twitchChannel}
                        onTwitchChannelChange={setTwitchChannel}
                        onClearTwitch={clearTwitchChannel}
                        kickChannel={kickChannel}
                        onKickChannelChange={setKickChannel}
                        onClearKick={clearKickChannel}
                        onStart={startChat}
                        onPreview={startPreview}
                        error={error}
                        twitchError={twitchError}
                        kickError={kickError}
                    />
                } 
            />
            <Route 
                path="/chat" 
                element={
                    <ChatPage
                        showUI={showUI}
                        showSidebar={showSidebar}
                        onToggleSidebar={() => setShowSidebar(p => !p)}
                        channelId={channelId}
                        liveId={liveId}
                        isPreviewMode={isPreviewMode}
                        isStarted={isStarted}
                        isTwitchStarted={isTwitchStarted}
                        isKickStarted={isKickStarted}
                        twitchChannel={twitchChannel}
                        kickChannel={kickChannel}
                        error={error}
                        twitchError={twitchError}
                        kickError={kickError}
                        messages={messages}
                        scrollRef={scrollToBottomRef}
                        onStop={stopChat}
                        obsStatus={obsStatus}
                    />
                } 
            />
        </Routes>
    );
}

function App() {
    return (
        <HashRouter>
            <SettingsProvider>
                <SupertonicProvider>
                    <AppContent />
                </SupertonicProvider>
            </SettingsProvider>
        </HashRouter>
    );
}

export default App;
