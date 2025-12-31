import React, { useState, useEffect } from 'react';
import { GetYoutubeStats } from '../../wailsjs/go/main/App';
import { useSettings } from '../context/SettingsContext';

interface SubscriberGoalProps {
    channelId: string;
    isPreviewMode: boolean;
}

export const SubscriberGoal: React.FC<SubscriberGoalProps> = ({ channelId, isPreviewMode }) => {
    const { settings } = useSettings();
    const [currentSubs, setCurrentSubs] = useState(0);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!settings.showSubGoal) return;

        if (isPreviewMode) {
            // In preview mode, show logic based on target (e.g. 75% of target)
            setCurrentSubs(Math.floor(settings.subGoalTarget * 0.75));
            setError(false);
            return;
        }

        if (!channelId) return;

        const fetchStats = async () => {
            try {
                const stats = await GetYoutubeStats(channelId);
                if (stats && stats.success) {
                    setCurrentSubs(stats.followerCount);
                    setError(false);
                }
            } catch (err) {
                console.error("Error fetching stats:", err);
                setError(true);
            }
        };

        fetchStats();
        const interval = setInterval(fetchStats, 5000);

        return () => clearInterval(interval);
    }, [settings.showSubGoal, channelId, isPreviewMode, settings.subGoalTarget]);

    if (!settings.showSubGoal) return null;

    const percentage = Math.min(Math.round((currentSubs / settings.subGoalTarget) * 100), 100);

    return (
        <div className="sub-goal-overlay">
            <div className="sub-goal-header">
                <span className="sub-goal-title">{settings.subGoalTitle}</span>
                <span className="sub-goal-count">
                    {currentSubs.toLocaleString()}
                    <span style={{ fontSize: '0.8rem', opacity: 0.5, marginLeft: '4px' }}>
                        / {settings.subGoalTarget.toLocaleString()}
                    </span>
                </span>
            </div>

            <div className="sub-goal-progress-bg">
                <div
                    className="sub-goal-progress-bar"
                    style={{ width: `${percentage}%` }}
                />
            </div>

            <div className="sub-goal-footer">
                <span>{percentage}% complete</span>
                {error && <span style={{ color: '#ff4d4d' }}>Connection Error</span>}
            </div>
        </div>
    );
};
