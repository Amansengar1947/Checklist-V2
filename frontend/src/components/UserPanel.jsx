/**
 * components/UserPanel.jsx
 * Sidebar user list: shows each bot user with status, controls, and schedule info.
 * Also hosts the "Add User" and "Schedule" modal triggers.
 */
import { useState } from 'react';
import AddUserModal from './AddUserModal.jsx';
import ScheduleModal from './ScheduleModal.jsx';
import ProgressBar from './ProgressBar.jsx';

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function UserCard({ user, sessionStatus, isSelected, onSelect, onStart, onStop, onDelete, onSchedule }) {
    const status = sessionStatus?.status || 'idle';
    const completed = sessionStatus?.completed || 0;
    const total = sessionStatus?.total || 0;
    const isRunning = status === 'running';

    const initials = (user.label || user.username).slice(0, 2).toUpperCase();

    const handleStart = (e) => {
        e.stopPropagation();
        onStart(user.id);
    };

    const handleStop = (e) => {
        e.stopPropagation();
        onStop(user.id);
    };

    return (
        <div
            className="user-card"
            onClick={() => onSelect(user.id)}
            style={{
                cursor: 'pointer',
                borderColor: isSelected ? 'var(--primary-border)' : undefined,
                background: isSelected ? 'var(--primary-surface)' : undefined,
                boxShadow: isSelected ? '0 0 0 3px var(--primary-surface)' : undefined,
            }}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onSelect(user.id); }}
            aria-pressed={isSelected}
            aria-label={`${user.label || user.username} — ${status}`}
        >
            <div className="user-card-header">
                <div className={`user-avatar${isRunning ? ' running' : ''}`}>
                    {initials}
                </div>
                <div className="user-info">
                    <div className="user-name">{user.label || user.username}</div>
                    <div className="user-username">{user.username}</div>
                </div>
                <span className={`badge badge-${status}`}>
                    <span className="badge-dot" />
                    {status}
                </span>
            </div>

            {/* Schedule chip */}
            {user.scheduleTime && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--sp-2)',
                    marginBottom: 'var(--sp-3)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--amber)',
                }}>
                    <span>⏰</span>
                    <span className="font-mono">{user.scheduleTime}</span>
                    {user.scheduleDays?.length > 0 && (
                        <span style={{ color: 'var(--ink-muted)' }}>
                            {user.scheduleDays.map(d => DAYS[d]).join(' ')}
                        </span>
                    )}
                </div>
            )}

            {/* Progress (only when active or done) */}
            {(isRunning || status === 'done' || status === 'error') && (
                <ProgressBar completed={completed} total={total} status={status} />
            )}

            <div className="user-card-actions" style={{ marginTop: 'var(--sp-3)' }}>
                {isRunning ? (
                    <button
                        className="btn btn-rose btn-sm"
                        onClick={handleStop}
                        id={`stop-btn-${user.id}`}
                    >
                        ⏹ Stop
                    </button>
                ) : (
                    <button
                        className="btn btn-mint btn-sm"
                        onClick={handleStart}
                        id={`start-btn-${user.id}`}
                    >
                        ▶ Run Now
                    </button>
                )}
                <button
                    className="btn btn-ghost btn-sm"
                    onClick={(e) => { e.stopPropagation(); onSchedule(user); }}
                    title="Configure schedule"
                    aria-label={`Schedule for ${user.label || user.username}`}
                >
                    ⏰
                </button>
                <button
                    className="btn btn-ghost btn-sm"
                    onClick={(e) => { e.stopPropagation(); onDelete(user.id, user.label || user.username); }}
                    title="Delete user"
                    aria-label={`Delete ${user.label || user.username}`}
                    style={{ color: 'var(--rose)', borderColor: 'var(--rose-border)', marginLeft: 'auto' }}
                >
                    ✕
                </button>
            </div>
        </div>
    );
}

export default function UserPanel({ users, allStatuses, selectedId, onSelect, onRefreshUsers, onStart, onStop, addToast, getAuthHeaders }) {
    const [showAddModal, setShowAddModal] = useState(false);
    const [scheduleUser, setScheduleUser] = useState(null);

    const handleDelete = async (id, name) => {
        if (!confirm(`Remove "${name}" from the bot? This cannot be undone.`)) return;
        try {
            const res = await fetch(`/api/users/${id}`, { method: 'DELETE', headers: { ...getAuthHeaders() } });
            if (!res.ok) throw new Error('Delete failed');
            onRefreshUsers();
            addToast(`Removed ${name}`, 'info');
        } catch (err) {
            addToast(err.message, 'error');
        }
    };

    return (
        <aside className="sidebar" aria-label="Bot users">
            {/* Header */}
            <div className="sidebar-section" style={{ paddingBottom: 'var(--sp-4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="section-title" style={{ marginBottom: 0 }}>Bot Users</span>
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={() => setShowAddModal(true)}
                        id="add-user-btn"
                    >
                        + Add
                    </button>
                </div>
            </div>

            {/* User list */}
            <div className="sidebar-section" style={{ flex: 1, overflowY: 'auto' }}>
                {users.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon" aria-hidden="true">👤</div>
                        <p>No users added yet.</p>
                        <p>Click <strong>+ Add</strong> to get started.</p>
                    </div>
                ) : (
                    users.map(user => (
                        <UserCard
                            key={user.id}
                            user={user}
                            sessionStatus={allStatuses[user.id]}
                            isSelected={selectedId === user.id}
                            onSelect={onSelect}
                            onStart={onStart}
                            onStop={onStop}
                            onDelete={handleDelete}
                            onSchedule={setScheduleUser}
                        />
                    ))
                )}
            </div>

            {/* Modals */}
            {showAddModal && (
                <AddUserModal
                    onClose={() => setShowAddModal(false)}
                    onSave={() => {
                        onRefreshUsers();
                        addToast('User added!', 'success');
                    }}
                    getAuthHeaders={getAuthHeaders}
                />
            )}

            {scheduleUser && (
                <ScheduleModal
                    user={scheduleUser}
                    onClose={() => setScheduleUser(null)}
                    onSave={() => {
                        onRefreshUsers();
                        addToast('Schedule saved!', 'success');
                    }}
                    getAuthHeaders={getAuthHeaders}
                />
            )}
        </aside>
    );
}
