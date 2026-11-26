'use client';

import { useEffect, useRef, useState } from 'react';

export default function EventCheckInScanner({ eventId, eventTitle }) {
    const videoRef = useRef(null);
    const controlsRef = useRef(null);
    const processingRef = useRef(false);
    const mountedRef = useRef(false);
    const scanningRef = useRef(false);
    const [scanning, setScanning] = useState(false);
    const [ticketToken, setTicketToken] = useState('');
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            scanningRef.current = false;
            controlsRef.current?.stop();
        };
    }, []);

    const checkIn = async (value) => {
        const token = value.trim();
        if (!token || processingRef.current) return;

        processingRef.current = true;
        scanningRef.current = false;
        controlsRef.current?.stop();
        controlsRef.current = null;
        setScanning(false);
        setError('');
        setResult(null);

        try {
            const response = await fetch('/api/events/check-in', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId, ticketToken: token }),
            });
            const data = await response.json();
            if (response.ok || response.status === 409 && data.alreadyCheckedIn) {
                setResult(data);
                setTicketToken('');
            } else {
                setError(data.error || 'Could not check in this ticket.');
            }
        } catch {
            setError('Network error. Please try again.');
        } finally {
            processingRef.current = false;
        }
    };

    const startCamera = async () => {
        if (scanningRef.current) return;
        if (!navigator.mediaDevices?.getUserMedia) {
            setError('Camera scanning requires HTTPS or localhost. You can enter the ticket code manually.');
            return;
        }

        setError('');
        setResult(null);
        scanningRef.current = true;
        setScanning(true);
        try {
            const { BrowserQRCodeReader } = await import('@zxing/browser');
            const reader = new BrowserQRCodeReader();
            const controls = await reader.decodeFromConstraints(
                { video: { facingMode: { ideal: 'environment' } } },
                videoRef.current,
                (decoded) => {
                    if (decoded && !processingRef.current) {
                        void checkIn(decoded.getText());
                    }
                },
            );
            if (!mountedRef.current || !scanningRef.current) {
                controls.stop();
                return;
            }
            controlsRef.current = controls;
        } catch {
            scanningRef.current = false;
            controlsRef.current?.stop();
            controlsRef.current = null;
            setScanning(false);
            setError('Could not start the camera. Check camera permission or enter the ticket code manually.');
        }
    };

    const stopCamera = () => {
        scanningRef.current = false;
        controlsRef.current?.stop();
        controlsRef.current = null;
        setScanning(false);
    };

    return (
        <section className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4">
            <div className="font-semibold text-slate-900">Event check-in: {eventTitle}</div>
            <p className="mt-1 text-sm text-slate-600">Scan a registered student&apos;s QR ticket. Each ticket can be checked in once.</p>

            <video
                ref={videoRef}
                className={`mt-3 max-h-72 w-full rounded-xl bg-slate-950 object-cover ${scanning ? '' : 'hidden'}`}
                muted
                playsInline
            />
            <div className="mt-3 flex flex-wrap gap-2">
                {scanning ? (
                    <button type="button" onClick={stopCamera} className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700">
                        Stop camera
                    </button>
                ) : (
                    <button type="button" onClick={() => void startCamera()} className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white">
                        Start camera
                    </button>
                )}
            </div>

            <form
                className="mt-3 flex flex-wrap gap-2"
                onSubmit={(submitEvent) => {
                    submitEvent.preventDefault();
                    void checkIn(ticketToken);
                }}
            >
                <input
                    value={ticketToken}
                    onChange={(changeEvent) => setTicketToken(changeEvent.target.value)}
                    placeholder="Or enter the ticket code"
                    aria-label="Event ticket code"
                    className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
                <button type="submit" disabled={!ticketToken.trim()} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50">
                    Check in
                </button>
            </form>

            {result && (
                <div className={`mt-3 rounded-xl border px-3 py-2 text-sm ${result.alreadyCheckedIn ? 'border-amber-300 bg-amber-100 text-amber-900' : 'border-emerald-300 bg-emerald-100 text-emerald-900'}`}>
                    <div className="font-semibold">{result.alreadyCheckedIn ? 'Already checked in' : 'Check-in successful'}</div>
                    <div>{result.attendee?.name}{result.attendee?.rollNumber ? ` · ${result.attendee.rollNumber}` : ''}</div>
                    {result.checkedInAt && <div className="mt-1 text-xs">{new Date(result.checkedInAt).toLocaleString()}</div>}
                </div>
            )}
            {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        </section>
    );
}
