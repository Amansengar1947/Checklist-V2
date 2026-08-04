/**
 * components/ActivityLog.jsx
 * Real-time SSE log stream rendered as a terminal-style feed.
 */
import { useEffect, useRef } from 'react';

const LEVEL_LABELS = {
    info: 'INFO',
    success: 'DONE',
    warn: 'WARN',
    error: 'ERR ',
};

export default function ActivityLog({ logs, onClear }) {
    const bottomRef = useRef(null);

    // Auto-scroll to bottom on new log entry
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    return (
        <div className="panel" style={{ flex: 1 }}>
            <div className="panel-header">
                <h3 className="panel-title">
                    <span>📋</span> Activity Log
                    <span className="text-muted text-xs" style={{ fontWeight: 400 }}>
                        ({logs.length} entries)
                    </span>
                </h3>
                <button
                    className="btn btn-ghost btn-sm"
                    onClick={onClear}
                    disabled={!logs.length}
                    aria-label="Clear activity log"
                >
                    Clear
                </button>
            </div>

            <div className="panel-body" style={{ padding: 'var(--sp-4)' }}>
                <div
                    className="activity-log"
                    role="log"
                    aria-live="polite"
                    aria-label="Bot activity log"
                >
                    {logs.length === 0 ? (
                        <p style={{
                            color: 'var(--ink-muted)',
                            fontSize: 'var(--text-xs)',
                            padding: 'var(--sp-4) 0',
                            textAlign: 'center',
                            fontFamily: 'inherit',
                        }}>
                            No activity yet — start the bot to see logs here.
                        </p>
                    ) : (
                        logs.map(entry => (
                            <div key={entry.id} className="log-entry">
                                <span className="log-time">{entry.time}</span>
                                <span className={`log-level log-level-${entry.level}`}>
                                    {LEVEL_LABELS[entry.level] || entry.level}
                                </span>
                                <span className="log-message">{entry.message}</span>
                            </div>
                        ))
                    )}
                    <div ref={bottomRef} aria-hidden="true" />
                </div>
            </div>
        </div>
    );
}
