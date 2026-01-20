import { useNavigate } from 'react-router-dom';
import { TitleBar } from '../components/TitleBar';

export function VtuberPage() {
    const navigate = useNavigate();

    return (
        <>
            <TitleBar show={true} />
            <div className="dashboard-layout">
                <div style={{
                    width: '250px',
                    background: 'rgba(0, 0, 0, 0.8)',
                    padding: '2rem 1rem',
                    borderRight: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                    <button 
                        onClick={() => navigate('/')}
                        className="btn-secondary"
                        style={{ width: '100%', marginBottom: '1rem' }}
                    >
                        ← Back
                    </button>
                    <h2 style={{ 
                        color: '#fff', 
                        fontSize: '1.2rem', 
                        marginBottom: '1.5rem',
                        borderBottom: '2px solid rgba(255, 255, 255, 0.2)',
                        paddingBottom: '0.5rem'
                    }}>
                        VTuber Menu
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <button className="btn-secondary" disabled style={{ opacity: 0.5 }}>
                            Model Settings
                        </button>
                        <button className="btn-secondary" disabled style={{ opacity: 0.5 }}>
                            Expressions
                        </button>
                        <button className="btn-secondary" disabled style={{ opacity: 0.5 }}>
                            Animations
                        </button>
                        <button className="btn-secondary" disabled style={{ opacity: 0.5 }}>
                            Tracking
                        </button>
                    </div>
                </div>
                <div style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#888',
                    fontSize: '1.5rem'
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎭</div>
                        <p>VTuber feature coming soon...</p>
                    </div>
                </div>
            </div>
        </>
    );
}
