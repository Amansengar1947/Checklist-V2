/**
 * components/LiveFeed.jsx
 * Displays the real-time browser screenshot from the bot.
 */
export default function LiveFeed({ screenshot, status, username }) {
    const isRunning = status === 'running';

    return (
        <div className="panel" style={{ flex: 1 }}>
            <div className="panel-header">
                <h3 className="panel-title">
                    <span>📷</span> Live Feed
                    {username && (
                        <span className="text-secondary" style={{ fontWeight: 400 }}>— {username}</span>
                    )}
                </h3>
                {isRunning && (
                    <div className="live-indicator" aria-label="Bot is running">
                        <span className="live-dot" aria-hidden="true" />
                        LIVE
                    </div>
                )}
            </div>

            <div className="panel-body" style={{ padding: 'var(--sp-4)' }}>
                <div className="live-feed-panel">
                    {screenshot ? (
                        <>
                            <img
                                className="live-feed-img"
                                src={`data:image/png;base64,${screenshot}`}
                                alt="Live bot browser view"
                            />
                            {isRunning && (
                                <div className="live-indicator" style={{ position: 'absolute', top: '8px', right: '8px' }}>
                                    <span className="live-dot" />
                                    LIVE
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="live-feed-placeholder">
                            <div className="live-feed-placeholder-icon" aria-hidden="true">
                                {isRunning ? '⏳' : '🤖'}
                            </div>
                            <p className="live-feed-placeholder-text">
                                {isRunning
                                    ? 'Starting browser…'
                                    : status === 'done'
                                    ? 'Session complete'
                                    : status === 'error'
                                    ? 'Bot encountered an error'
                                    : 'Select a user and start the bot to see the live feed.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
