/**
 * components/AddUserModal.jsx
 * Modal to add a new bot credential / user.
 */
import { useState } from 'react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AddUserModal({ onClose, onSave, getAuthHeaders }) {
    const [form, setForm] = useState({
        label: '',
        username: '',
        password: '',
        scheduleTime: '',
        scheduleDays: [],
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

    const toggleDay = (day) => {
        setForm(prev => ({
            ...prev,
            scheduleDays: prev.scheduleDays.includes(day)
                ? prev.scheduleDays.filter(d => d !== day)
                : [...prev.scheduleDays, day],
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.username || !form.password) {
            setError('Username and password are required.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(getAuthHeaders ? getAuthHeaders() : {}) },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to add user');
            onSave();
            onClose();
        } catch (err) {
            setError(err.message);
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
            aria-labelledby="add-user-title"
        >
            <div className="modal">
                <div className="modal-header">
                    <h2 className="modal-title" id="add-user-title">Add Bot User</h2>
                    <button
                        className="btn btn-ghost btn-icon btn-sm"
                        onClick={onClose}
                        aria-label="Close"
                    >✕</button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {error && (
                            <div className="error-inline">{error}</div>
                        )}

                        <div className="form-group">
                            <label className="form-label" htmlFor="add-label">Label (optional)</label>
                            <input
                                id="add-label"
                                className="form-input"
                                placeholder="e.g. Aman's Account"
                                value={form.label}
                                onChange={e => set('label', e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="add-username">
                                Username <span style={{ color: 'var(--rose)' }}>*</span>
                            </label>
                            <input
                                id="add-username"
                                className="form-input"
                                placeholder="VFP859"
                                value={form.username}
                                onChange={e => set('username', e.target.value)}
                                autoComplete="off"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="add-password">
                                Password <span style={{ color: 'var(--rose)' }}>*</span>
                            </label>
                            <input
                                id="add-password"
                                className="form-input"
                                type="password"
                                placeholder="••••••••"
                                value={form.password}
                                onChange={e => set('password', e.target.value)}
                                autoComplete="new-password"
                                required
                            />
                        </div>

                        <div className="divider" />

                        <p className="text-xs text-muted mb-3">
                            Optional: schedule the bot to run automatically.
                        </p>

                        <div className="form-group">
                            <label className="form-label" htmlFor="add-time">Schedule Time</label>
                            <input
                                id="add-time"
                                className="form-input"
                                type="time"
                                value={form.scheduleTime}
                                onChange={e => set('scheduleTime', e.target.value)}
                            />
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Schedule Days</label>
                            <div className="day-toggles">
                                {DAYS.map((day, i) => (
                                    <button
                                        key={day}
                                        type="button"
                                        className={`day-toggle ${form.scheduleDays.includes(i) ? 'active' : ''}`}
                                        onClick={() => toggleDay(i)}
                                        aria-pressed={form.scheduleDays.includes(i)}
                                        title={day}
                                    >
                                        {day[0]}
                                    </button>
                                ))}
                            </div>
                            {form.scheduleDays.length > 0 && (
                                <p className="text-xs text-muted mt-2">
                                    {form.scheduleDays.map(d => DAYS[d]).join(', ')}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? 'Adding…' : 'Add User'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
