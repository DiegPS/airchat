import { SetupScreen } from '../components/SetupScreen';
import { TitleBar } from '../components/TitleBar';

interface HomePageProps {
    channelId: string;
    onChannelIdChange: (value: string) => void;
    onStart: () => void;
    onPreview: () => void;
    error: string | null;
}

export function HomePage({ channelId, onChannelIdChange, onStart, onPreview, error }: HomePageProps) {
    return (
        <>
            <TitleBar show={true} />
            <SetupScreen
                channelId={channelId}
                onChannelIdChange={onChannelIdChange}
                onStart={onStart}
                onPreview={onPreview}
                error={error}
            />
        </>
    );
}
