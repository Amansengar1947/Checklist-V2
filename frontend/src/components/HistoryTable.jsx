/**
 * components/HistoryTable.jsx
 * Full run history log with timestamps, user, tasks, status, and duration.
 */
import { useState, useEffect, useCallback } from 'react';

function formatDuration(startIso, endIso) {
    if (!startIso || !endIso) return '—';
    const diff = (new Date(endIso) - new Date(startIso)) / 1000;
    if (diff < 60) return `${Math.round(diff)}s`;
    const m = Math.floor(diff / 60);
    const s = Math.round(diff % 60);
    return `${m}m ${s}s`;
}

function formatTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
}

export default function HistoryTable({ addToast, getAuthHeaders }) {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchHistory = useCallback(async () => {
        try {
            const res = await fetch('/api/history', { headers: { ...(getAuthHeaders ? getAuthHeaders() : {}) } });
            const data = await res.json();
            setHistory(data);
        } catch (_) {} finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchHistory();
        // Refresh history every 10 seconds
        const id = setInterval(fetchHistory, 10000);
        return () => clearInterval(id);
    }, [fetchHistory]);

    const clearHistory = async () => {
        if (!confirm('Clear all run history? This cannot be undone.')) return;
        await fetch('/api/history', { method: 'DELETE', headers: { ...(getAuthHeaders ? getAuthHeaders() : {}) } });
        setHistory([]);
        addToast('History cleared', 'info');
    };

    return (
        <div className="panel">
            <div className="panel-header">
                <h3 className="panel-title">
                    <span>📜</span> Run History
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={fetchHistory}
                        aria-label="Refresh history"
                        title="Refresh"
                    >
                        ↺
                    </button>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={clearHistory}
                        disabled={!history.length}
                        style={{ color: history.length ? 'var(--rose)' : undefined }}
                        aria-label="Clear history"
                    >
                        Clear All
                    </button>
                </div>
            </div>

            <div className="history-table-wrap">
                {loading ? (
                    <p className="history-empty">Loading…</p>
                ) : history.length === 0 ? (
                    <p className="history-empty">No runs recorded yet.</p>
                ) : (
                    <table className="history-table" aria-label="Run history">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Started</th>
                                <th>Finished</th>
                                <th>Duration</th>
                                <th>Tasks Found</th>
                                <th>Completed</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map(run => (
                                <tr key={run.id}>
                                    <td>
                                        <span style={{ fontFamily: 'var(--font-mono)' }}>
                                            {run.username}
                                        </span>
                                    </td>
                                    <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'var(--text-xs)' }}>
                                        {formatTime(run.startTime)}
                                    </td>
                                    <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'var(--text-xs)' }}>
                                        {formatTime(run.endTime)}
                                    </td>
                                    <td style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                                        {formatDuration(run.startTime, run.endTime)}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>{run.total ?? '—'}</td>
                                    <td style={{ textAlign: 'center', color: 'var(--mint)', fontWeight: 600 }}>
                                        {run.completed ?? '—'}
                                    </td>
                                    <td>
                                        <span className={`badge badge-${run.status}`}>
                                            <span className="badge-dot" />
                                            {run.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
