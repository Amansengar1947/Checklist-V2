/**
 * components/Toast.jsx
 */
export default function Toast({ toasts, onRemove }) {
    if (!toasts.length) return null;
    return (
        <div className="toast-container" role="status" aria-live="polite">
            {toasts.map(t => (
                <div
                    key={t.id}
                    className={`toast toast-${t.type}`}
                    onClick={() => onRemove(t.id)}
                    style={{ cursor: 'pointer' }}
                >
                    <span>
                        {t.type === 'success' ? '✓' : t.type === 'error' ? '✗' : 'ℹ'}
                    </span>
                    <span>{t.message}</span>
                </div>
            ))}
        </div>
    );
}
