/**
 * App.jsx
 * Root application component. Manages:
 *  - Admin authentication (login page / dashboard)
 *  - Users list (fetched from API)
 *  - Selected user for the live panel
 *  - SSE subscription for the selected user
 *  - Global status polling
 *  - Toast notifications
 */
import { useState, useEffect, useCallback } from 'react';
import LoginPage from './components/LoginPage.jsx';
import Header from './components/Header.jsx';
import UserPanel from './components/UserPanel.jsx';
import LiveFeed from './components/LiveFeed.jsx';
import ActivityLog from './components/ActivityLog.jsx';
import HistoryTable from './components/HistoryTable.jsx';
import Toast from './components/Toast.jsx';
import { useSSE } from './hooks/useSSE.js';
import { useToast } from './hooks/useToast.js';

// ─── Auth token helper ────────────────────────────────────────────────────────
function getAuthHeaders() {
    const token = localStorage.getItem('mi-bot-token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// ─── API helpers ──────────────────────────────────────────────────────────────
async function apiPost(path, body) {
    const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('SESSION_EXPIRED');
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
}

async function apiGet(path) {
    const res = await fetch(path, {
        headers: { ...getAuthHeaders() },
    });
    if (res.status === 401) throw new Error('SESSION_EXPIRED');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
}

async function apiDelete(path) {
    const res = await fetch(path, {
        method: 'DELETE',
        headers: { ...getAuthHeaders() },
    });
    if (res.status === 401) throw new Error('SESSION_EXPIRED');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
}

export default function App() {
    // ── Auth state ─────────────────────────────────────────────────────────
    const [authToken, setAuthToken] = useState(() => localStorage.getItem('mi-bot-token'));
    const [authUser, setAuthUser] = useState(() => localStorage.getItem('mi-bot-user'));
    const [authChecked, setAuthChecked] = useState(false);

    // Verify token on mount
    useEffect(() => {
        if (!authToken) {
            setAuthChecked(true);
            return;
        }
        fetch('/api/auth/check', {
            headers: { 'Authorization': `Bearer ${authToken}` },
        })
            .then(res => {
                if (!res.ok) {
                    localStorage.removeItem('mi-bot-token');
                    localStorage.removeItem('mi-bot-user');
                    setAuthToken(null);
                    setAuthUser(null);
                }
                setAuthChecked(true);
            })
            .catch(() => {
                setAuthChecked(true);
            });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleLogin = useCallback((token, username) => {
        setAuthToken(token);
        setAuthUser(username);
    }, []);

    const handleLogout = useCallback(async () => {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${authToken}` },
            });
        } catch (_) {}
        localStorage.removeItem('mi-bot-token');
        localStorage.removeItem('mi-bot-user');
        setAuthToken(null);
        setAuthUser(null);
    }, [authToken]);

    // ── Dashboard state ────────────────────────────────────────────────────
    const [users, setUsers] = useState([]);
    const [allStatuses, setAllStatuses] = useState({});
    const [selectedId, setSelectedId] = useState(null);
    const { toasts, addToast, removeToast } = useToast();

    // SSE for the selected user
    const { logs, screenshot, progress, status: sseStatus, clearLogs } = useSSE(selectedId);

    // ── Fetch users ────────────────────────────────────────────────────────
    const fetchUsers = useCallback(async () => {
        if (!authToken) return;
        try {
            const data = await apiGet('/api/users');
            setUsers(data);
            setSelectedId(prev => prev || (data.length > 0 ? data[0].id : null));
        } catch (err) {
            if (err.message === 'SESSION_EXPIRED') handleLogout();
        }
    }, [authToken, handleLogout]);

    // ── Fetch all statuses (polling fallback for non-selected users) ────────
    const fetchStatuses = useCallback(async () => {
        if (!authToken) return;
        try {
            const data = await apiGet('/api/bot/status');
            setAllStatuses(data);
        } catch (err) {
            if (err.message === 'SESSION_EXPIRED') handleLogout();
        }
    }, [authToken, handleLogout]);

    useEffect(() => {
        if (!authToken) return;
        fetchUsers();
        fetchStatuses();
        const id = setInterval(fetchStatuses, 4000);
        return () => clearInterval(id);
    }, [authToken, fetchUsers, fetchStatuses]);

    // Update allStatuses with the SSE status for the selected user
    useEffect(() => {
        if (!selectedId) return;
        setAllStatuses(prev => ({
            ...prev,
            [selectedId]: {
                ...(prev[selectedId] || {}),
                status: sseStatus,
                completed: progress.completed,
                total: progress.total,
            },
        }));
    }, [sseStatus, progress, selectedId]);

    // ── Bot controls ───────────────────────────────────────────────────────
    const handleStart = useCallback(async (userId) => {
        try {
            clearLogs();
            await apiPost(`/api/bot/start/${userId}`, { headless: true });
            addToast('Bot started!', 'success');
            fetchStatuses();
        } catch (err) {
            if (err.message === 'SESSION_EXPIRED') return handleLogout();
            addToast(err.message, 'error');
        }
    }, [addToast, clearLogs, fetchStatuses, handleLogout]);

    const handleStop = useCallback(async (userId) => {
        try {
            await apiPost(`/api/bot/stop/${userId}`, {});
            addToast('Stop requested.', 'info');
        } catch (err) {
            if (err.message === 'SESSION_EXPIRED') return handleLogout();
            addToast(err.message, 'error');
        }
    }, [addToast, handleLogout]);

    // ── Derived selected user ──────────────────────────────────────────────
    const selectedUser = users.find(u => u.id === selectedId);
    const selectedStatus = allStatuses[selectedId]?.status || 'idle';

    // ── Show login if not authenticated ────────────────────────────────────
    if (!authChecked) {
        return (
            <div className="app-loading">
                <div className="login-spinner" />
            </div>
        );
    }

    if (!authToken) {
        return <LoginPage onLogin={handleLogin} />;
    }

    return (
        <div className="app-layout">
            <Header allStatuses={allStatuses} adminUser={authUser} onLogout={handleLogout} />

            <div className="main-grid">
                {/* ── Sidebar ──────────────────────────────────────────── */}
                <UserPanel
                    users={users}
                    allStatuses={allStatuses}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    onRefreshUsers={fetchUsers}
                    onStart={handleStart}
                    onStop={handleStop}
                    addToast={addToast}
                    getAuthHeaders={getAuthHeaders}
                />

                {/* ── Main content ─────────────────────────────────────── */}
                <main className="main-content">
                    {/* Row 1: Live Feed + Activity Log */}
                    <div className="content-row">
                        <LiveFeed
                            screenshot={screenshot}
                            status={selectedStatus}
                            username={selectedUser?.label || selectedUser?.username}
                        />
                        <ActivityLog
                            logs={logs}
                            onClear={clearLogs}
                        />
                    </div>

                    {/* Row 2: History Table */}
                    <HistoryTable addToast={addToast} getAuthHeaders={getAuthHeaders} />
                </main>
            </div>

            <Toast toasts={toasts} onRemove={removeToast} />
        </div>
    );
}

