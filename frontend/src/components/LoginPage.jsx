/**
 * LoginPage.jsx
 * Premium glassmorphism login page for admin authentication.
 */
import { useState } from 'react';

export default function LoginPage({ onLogin }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!username.trim() || !password.trim()) {
            setError('Please enter both username and password.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username.trim(), password: password.trim() }),
            });
            const data = await res.json();

            if (!res.ok || !data.ok) {
                setError(data.error || 'Invalid credentials.');
                setLoading(false);
                return;
            }

            // Save token
            localStorage.setItem('mi-bot-token', data.token);
            localStorage.setItem('mi-bot-user', data.username);
            onLogin(data.token, data.username);
        } catch (err) {
            setError('Connection failed. Is the server running?');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            {/* Animated background orbs */}
            <div className="login-bg-orb login-bg-orb-1" />
            <div className="login-bg-orb login-bg-orb-2" />
            <div className="login-bg-orb login-bg-orb-3" />

            <form className="login-card" onSubmit={handleSubmit}>
                {/* Brand */}
                <div className="login-brand">
                    <div className="login-brand-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2L2 7l10 5 10-5-10-5z" />
                            <path d="M2 17l10 5 10-5" />
                            <path d="M2 12l10 5 10-5" />
                        </svg>
                    </div>
                    <h1 className="login-title">MI Bot</h1>
                    <p className="login-subtitle">Checklist Automation Dashboard</p>
                </div>

                {/* Error */}
                {error && (
                    <div className="login-error">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="15" y1="9" x2="9" y2="15" />
                            <line x1="9" y1="9" x2="15" y2="15" />
                        </svg>
                        {error}
                    </div>
                )}

                {/* Username */}
                <div className="login-field">
                    <label className="login-label" htmlFor="login-user">Username</label>
                    <div className="login-input-wrap">
                        <svg className="login-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                        </svg>
                        <input
                            id="login-user"
                            type="text"
                            className="login-input"
                            placeholder="Enter admin username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            autoComplete="username"
                            autoFocus
                        />
                    </div>
                </div>

                {/* Password */}
                <div className="login-field">
                    <label className="login-label" htmlFor="login-pass">Password</label>
                    <div className="login-input-wrap">
                        <svg className="login-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        <input
                            id="login-pass"
                            type="password"
                            className="login-input"
                            placeholder="Enter password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                        />
                    </div>
                </div>

                {/* Submit */}
                <button
                    type="submit"
                    className="login-btn"
                    disabled={loading}
                >
                    {loading ? (
                        <>
                            <span className="login-spinner" />
                            Signing in...
                        </>
                    ) : (
                        <>
                            Sign In
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 12h14" />
                                <path d="m12 5 7 7-7 7" />
                            </svg>
                        </>
                    )}
                </button>

                <p className="login-footer">
                    Secure admin access only
                </p>
            </form>
        </div>
    );
}
