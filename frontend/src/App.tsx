import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom';
import './App.css';
import { SettingsProvider } from './context/SettingsContext';
import { useChat } from './hooks/useChat';
import { useTTS } from './hooks/useTTS';
import { useTTSProviderReset } from './hooks/useTTSProviderReset';
import { SupertonicProvider } from './hooks/supertonic2/useSupertonic';
import { HomePage } from './pages/HomePage';
import { ChatPage } from './pages/ChatPage';
import { SetClickThrough } from '../wailsjs/go/main/App';

function AppContent() {
    const navigate = useNavigate();
    const chat = useChat();
    const { isSetup } = chat;

    useTTS(chat.isLive);
    useTTSProviderReset();

    const [showUI, setShowUI] = useState(true);
    const [showSidebar, setShowSidebar] = useState(true);

    // Navigate based on setup state
    useEffect(() => {
        navigate(isSetup ? '/' : '/chat');
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
                        platforms={chat.platforms}
                        notice={chat.notice}
                        onInputChange={chat.setInput}
                        onClear={chat.clearInput}
                        onStart={chat.startChat}
                        onPreview={chat.startPreview}
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
                        platforms={chat.platforms}
                        isPreviewMode={chat.isPreviewMode}
                        messages={chat.messages}
                        scrollRef={chat.scrollRef}
                        onStop={chat.stopChat}
                        obsStatus={chat.obsStatus}
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
