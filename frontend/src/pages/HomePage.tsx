import { SetupScreen } from '../components/SetupScreen';
import { TitleBar } from '../components/TitleBar';

interface HomePageProps {
    channelId: string;
    onChannelIdChange: (value: string) => void;
    onClearYoutube: () => void;
    twitchChannel: string;
    onTwitchChannelChange: (value: string) => void;
    onClearTwitch: () => void;
    kickChannel: string;
    onKickChannelChange: (value: string) => void;
    onClearKick: () => void;
    tiktokChannel: string;
    onTikTokChannelChange: (value: string) => void;
    onClearTikTok: () => void;
    onStart: () => void;
    onPreview: () => void;
    error: string | null;
    twitchError: string;
    kickError: string;
    tiktokError: string;
    isTikTokConnecting: boolean;
    tiktokConnectionStatus: string;
}

export function HomePage({ channelId, onChannelIdChange, onClearYoutube, twitchChannel, onTwitchChannelChange, onClearTwitch, kickChannel, onKickChannelChange, onClearKick, tiktokChannel, onTikTokChannelChange, onClearTikTok, onStart, onPreview, error, twitchError, kickError, tiktokError, isTikTokConnecting, tiktokConnectionStatus }: HomePageProps) {
    return (
        <>
            <TitleBar show={true} />
            <SetupScreen
                channelId={channelId}
                onChannelIdChange={onChannelIdChange}
                onClearYoutube={onClearYoutube}
                twitchChannel={twitchChannel}
                onTwitchChannelChange={onTwitchChannelChange}
                onClearTwitch={onClearTwitch}
                kickChannel={kickChannel}
                onKickChannelChange={onKickChannelChange}
                onClearKick={onClearKick}
                tiktokChannel={tiktokChannel}
                onTikTokChannelChange={onTikTokChannelChange}
                onClearTikTok={onClearTikTok}
                onStart={onStart}
                onPreview={onPreview}
                error={error}
                twitchError={twitchError}
                kickError={kickError}
                tiktokError={tiktokError}
                isTikTokConnecting={isTikTokConnecting}
                tiktokConnectionStatus={tiktokConnectionStatus}
            />
        </>
    );
}
