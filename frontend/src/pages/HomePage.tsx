import { SetupScreen } from '../components/SetupScreen';
import { TitleBar } from '../components/TitleBar';

interface HomePageProps {
    channelId: string;
    onChannelIdChange: (value: string) => void;
    twitchChannel: string;
    onTwitchChannelChange: (value: string) => void;
    kickChannel: string;
    onKickChannelChange: (value: string) => void;
    onStart: () => void;
    onPreview: () => void;
    error: string | null;
    twitchError: string;
    kickError: string;
}

export function HomePage({ channelId, onChannelIdChange, twitchChannel, onTwitchChannelChange, kickChannel, onKickChannelChange, onStart, onPreview, error, twitchError, kickError }: HomePageProps) {
    return (
        <>
            <TitleBar show={true} />
            <SetupScreen
                channelId={channelId}
                onChannelIdChange={onChannelIdChange}
                twitchChannel={twitchChannel}
                onTwitchChannelChange={onTwitchChannelChange}
                kickChannel={kickChannel}
                onKickChannelChange={onKickChannelChange}
                onStart={onStart}
                onPreview={onPreview}
                error={error}
                twitchError={twitchError}
                kickError={kickError}
            />
        </>
    );
}
