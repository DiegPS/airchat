import { SetupScreen } from '../components/SetupScreen';
import { TitleBar } from '../components/TitleBar';

interface HomePageProps {
    channelId: string;
    onChannelIdChange: (value: string) => void;
    twitchChannel: string;
    onTwitchChannelChange: (value: string) => void;
    onStart: () => void;
    onPreview: () => void;
    error: string | null;
    twitchError: string;
}

export function HomePage({ channelId, onChannelIdChange, twitchChannel, onTwitchChannelChange, onStart, onPreview, error, twitchError }: HomePageProps) {
    return (
        <>
            <TitleBar show={true} />
            <SetupScreen
                channelId={channelId}
                onChannelIdChange={onChannelIdChange}
                twitchChannel={twitchChannel}
                onTwitchChannelChange={onTwitchChannelChange}
                onStart={onStart}
                onPreview={onPreview}
                error={error}
                twitchError={twitchError}
            />
        </>
    );
}
