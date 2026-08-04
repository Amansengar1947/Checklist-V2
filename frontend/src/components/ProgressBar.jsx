/**
 * components/ProgressBar.jsx
 */
export default function ProgressBar({ completed, total, status }) {
    const pct = total > 0 ? Math.min(100, (completed / total) * 100) : 0;
    const isRunning = status === 'running';

    return (
        <div style={{ marginTop: 'var(--sp-3)' }}>
            <div className="progress-bar-track">
                <div
                    className="progress-bar-fill"
                    style={{
                        width: `${pct}%`,
                        // Stop shimmer when not running
                        '--shimmer': isRunning ? undefined : 'none',
                    }}
                    role="progressbar"
                    aria-valuenow={completed}
                    aria-valuemin={0}
                    aria-valuemax={total || 1}
                    aria-label={`${completed} of ${total} tasks completed`}
                />
            </div>
            <div className="progress-label">
                {status === 'idle'
                    ? 'Not started'
                    : status === 'done'
                    ? `✓ All ${total} tasks completed`
                    : status === 'error'
                    ? `Error after ${completed} task${completed !== 1 ? 's' : ''}`
                    : status === 'stopped'
                    ? `Stopped — ${completed}/${total} done`
                    : total > 0
                    ? `${completed} / ${total} tasks — ${pct.toFixed(0)}%`
                    : 'Scanning for tasks…'}
            </div>
        </div>
    );
}
