import { SetupScreen } from '../components/SetupScreen';
import { TitleBar } from '../components/TitleBar';
import { PlatformId } from '../platforms';
import { PlatformView } from '../hooks/usePlatforms';

interface HomePageProps {
    platforms: PlatformView[];
    notice: string;
    onInputChange: (id: PlatformId, value: string) => void;
    onClear: (id: PlatformId) => void;
    onStart: () => void;
    onPreview: () => void;
}

export function HomePage(props: HomePageProps) {
    return (
        <>
            <TitleBar show={true} />
            <SetupScreen {...props} />
        </>
    );
}
