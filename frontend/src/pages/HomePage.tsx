import { SetupScreen } from '../components/SetupScreen';
import { TitleBar } from '../components/TitleBar';
import { useNavigate } from 'react-router-dom';

interface HomePageProps {
    channelId: string;
    onChannelIdChange: (value: string) => void;
    onStart: () => void;
    onPreview: () => void;
    error: string | null;
}

export function HomePage({ channelId, onChannelIdChange, onStart, onPreview, error }: HomePageProps) {
    const navigate = useNavigate();

    return (
        <>
            <TitleBar show={true} />
            <SetupScreen
                channelId={channelId}
                onChannelIdChange={onChannelIdChange}
                onStart={onStart}
                onPreview={onPreview}
                onVtuber={() => navigate('/vtuber')}
                error={error}
            />
        </>
    );
}
