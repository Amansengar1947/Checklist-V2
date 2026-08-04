/**
 * components/ScheduleModal.jsx
 * Edit the schedule for an existing user.
 */
import { useState } from 'react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ScheduleModal({ user, onClose, onSave, getAuthHeaders }) {
    const [scheduleTime, setScheduleTime] = useState(user.scheduleTime || '');
    const [scheduleDays, setScheduleDays] = useState(user.scheduleDays || []);
    const [saving, setSaving] = useState(false);

    const toggleDay = (i) => {
        setScheduleDays(prev =>
            prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i]
        );
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await fetch(`/api/users/${user.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...(getAuthHeaders ? getAuthHeaders() : {}) },
                body: JSON.stringify({ scheduleTime, scheduleDays }),
            });
            onSave();
            onClose();
        } finally {
            setSaving(false);
        }
    };

    const clearSchedule = async () => {
        setSaving(true);
        try {
            await fetch(`/api/users/${user.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...(getAuthHeaders ? getAuthHeaders() : {}) },
                body: JSON.stringify({ scheduleTime: '', scheduleDays: [] }),
            });
            onSave();
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            className="modal-backdrop"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sched-title"
        >
            <div className="modal">
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title" id="sched-title">Schedule</h2>
                        <p className="text-xs text-secondary mt-1">{user.label || user.username}</p>
                    </div>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close">✕</button>
                </div>

                <div className="modal-body">
                    <div className="form-group">
                        <label className="form-label" htmlFor="sched-time">Run at (IST)</label>
                        <input
                            id="sched-time"
                            className="form-input"
                            type="time"
                            value={scheduleTime}
                            onChange={e => setScheduleTime(e.target.value)}
                        />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Days of Week</label>
                        <div className="day-toggles">
                            {DAYS.map((day, i) => (
                                <button
                                    key={day}
                                    type="button"
                                    className={`day-toggle ${scheduleDays.includes(i) ? 'active' : ''}`}
                                    onClick={() => toggleDay(i)}
                                    aria-pressed={scheduleDays.includes(i)}
                                    title={day}
                                >
                                    {day[0]}
                                </button>
                            ))}
                        </div>
                        {scheduleDays.length > 0 && (
                            <p className="text-xs text-muted mt-2">
                                Runs {scheduleTime ? `at ${scheduleTime}` : ''} on: {scheduleDays.map(d => DAYS[d]).join(', ')}
                            </p>
                        )}
                        {!scheduleTime && (
                            <p className="text-xs text-secondary mt-2">Set a time above to activate scheduling.</p>
                        )}
                    </div>
                </div>

                <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                    {(user.scheduleTime || scheduleTime) && (
                        <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={clearSchedule}
                            disabled={saving}
                            style={{ color: 'var(--rose)' }}
                        >
                            Clear Schedule
                        </button>
                    )}
                    <div style={{ display: 'flex', gap: 'var(--sp-3)', marginLeft: 'auto' }}>
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                            {saving ? 'Saving…' : 'Save Schedule'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
