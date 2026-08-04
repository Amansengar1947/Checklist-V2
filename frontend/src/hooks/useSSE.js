/**
 * hooks/useSSE.js
 * Connect to a Server-Sent Events stream for a specific credential ID.
 * Returns { logs, screenshot, progress, status }.
 */
import { useState, useEffect, useRef } from 'react';

export function useSSE(credentialId) {
    const [logs, setLogs] = useState([]);
    const [screenshot, setScreenshot] = useState(null);
    const [progress, setProgress] = useState({ completed: 0, total: 0 });
    const [status, setStatus] = useState('idle');
    const esRef = useRef(null);

    useEffect(() => {
        if (!credentialId) return;

        // Clean up previous connection
        if (esRef.current) {
            esRef.current.close();
        }

        const url = `/api/stream/${credentialId}`;
        const es = new EventSource(url);
        esRef.current = es;

        es.addEventListener('log', (e) => {
            const entry = JSON.parse(e.data);
            setLogs(prev => {
                const next = [...prev, entry];
                return next.slice(-200); // keep last 200
            });
        });

        es.addEventListener('screenshot', (e) => {
            const { data } = JSON.parse(e.data);
            setScreenshot(data);
        });

        es.addEventListener('progress', (e) => {
            setProgress(JSON.parse(e.data));
        });

        es.addEventListener('status', (e) => {
            const { status: s } = JSON.parse(e.data);
            setStatus(s);
        });

        es.addEventListener('heartbeat', () => {});

        es.onerror = () => {
            // SSE will auto-reconnect; just ignore transient errors
        };

        return () => {
            es.close();
            esRef.current = null;
        };
    }, [credentialId]);

    const clearLogs = () => setLogs([]);

    return { logs, screenshot, progress, status, clearLogs };
}
