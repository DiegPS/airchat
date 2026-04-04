import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom';
import './App.css';
import { SettingsProvider } from './context/SettingsContext';
import { useChat } from './hooks/useChat';
import { useTTS } from './hooks/useTTS';
import { HomePage } from './pages/HomePage';
import { ChatPage } from './pages/ChatPage';
import { SetClickThrough } from '../wailsjs/go/main/App';

function AppContent() {
    const navigate = useNavigate();
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

    useTTS(isStarted);

    const [showUI, setShowUI] = useState(true);
    const isSetup = !isStarted && !isPreviewMode;

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
                        onStart={startChat}
                        onPreview={startPreview}
                        error={error}
                    />
                } 
            />
            <Route 
                path="/chat" 
                element={
                    <ChatPage
                        showUI={showUI}
                        channelId={channelId}
                        liveId={liveId}
                        isPreviewMode={isPreviewMode}
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
                <AppContent />
            </SettingsProvider>
        </HashRouter>
    );
}

export default App;
