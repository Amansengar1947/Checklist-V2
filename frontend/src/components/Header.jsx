/**
 * components/Header.jsx
 */
import { useState, useEffect } from 'react';

function StatusDot({ allStatuses }) {
    const values = Object.values(allStatuses);
    const running = values.some(s => s.status === 'running');
    const error = values.some(s => s.status === 'error');
    const label = running ? 'running' : error ? 'error' : 'idle';
    return (
        <span className={`badge badge-${label}`}>
            <span className="badge-dot" />
            {running ? 'Bot Running' : error ? 'Error' : 'All Idle'}
        </span>
    );
}

export default function Header({ allStatuses, adminUser, onLogout }) {
    const [time, setTime] = useState('');

    useEffect(() => {
        const tick = () => {
            setTime(new Date().toLocaleTimeString('en-IN', {
                hour12: false,
                timeZone: 'Asia/Kolkata',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
            }));
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, []);

    return (
        <header className="site-header">
            <div className="header-brand">
                <div className="brand-icon" aria-hidden="true">🤖</div>
                <div>
                    <div className="brand-name">MI Bot</div>
                    <div className="brand-sub">Digital Autopilot</div>
                </div>
            </div>

            <div className="header-right">
                <StatusDot allStatuses={allStatuses} />
                <time className="time-display" dateTime={time}>{time} IST</time>
                {adminUser && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', borderLeft: '1px solid var(--border)', paddingLeft: 'var(--sp-4)' }}>
                        <span className="text-sm" style={{ color: 'var(--ink-secondary)' }}>👤 {adminUser}</span>
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={onLogout}
                            title="Sign out"
                            aria-label="Sign out"
                        >
                            Sign Out
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
}
