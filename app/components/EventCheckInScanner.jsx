'use client';

import { useEffect, useRef, useState } from 'react';

const CAMERA_ERRORS = {
    NotAllowedError: 'Camera access was denied. Allow this site in your browser and allow camera access for desktop apps in Windows settings, then refresh.',
    NotFoundError: 'No camera was found. Connect or enable a camera, then try again.',
    NotReadableError: 'The camera could not be opened. Close other apps or tabs using it and try again.',
    AbortError: 'The camera stopped while opening. Try starting it again.',
};

function releaseCamera(video, session) {
    session?.controls?.stop();
    session?.stream?.getTracks().forEach((track) => track.stop());
    if (session?.stream && video?.srcObject === session.stream) {
        video.srcObject = null;
    }
}

export default function EventCheckInScanner({ eventId, eventTitle, gateDirection }) {
    const videoRef = useRef(null);
    const cameraRef = useRef(null);
    const processingRef = useRef(false);
    const [scanning, setScanning] = useState(false);
    const [ticketToken, setTicketToken] = useState('');
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        const video = videoRef.current;
        return () => {
            releaseCamera(video, cameraRef.current);
            cameraRef.current = null;
        };
    }, []);

    const stopCamera = () => {
        releaseCamera(videoRef.current, cameraRef.current);
        cameraRef.current = null;
        setScanning(false);
    };

    const checkIn = async (value) => {
        const token = value.trim();
        if (!token || processingRef.current) return;

        processingRef.current = true;
        stopCamera();
        setError('');
        setResult(null);

        try {
            const response = await fetch(gateDirection ? '/api/hostel/gate' : '/api/events/check-in', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(gateDirection ? { action: 'scan', direction: gateDirection, token } : { eventId, ticketToken: token }),
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
        const video = videoRef.current;
        if (!video || cameraRef.current || processingRef.current) return;
        if (!navigator.mediaDevices?.getUserMedia) {
            setError('Camera scanning requires HTTPS or localhost. You can enter the ticket code manually.');
            return;
        }

        setError('');
        setResult(null);
        const session = {};
        cameraRef.current = session;
        setScanning(true);

        try {
            session.stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'environment' } },
                audio: false,
            });
            if (cameraRef.current !== session) {
                releaseCamera(video, session);
                return;
            }
        } catch (cameraError) {
            if (cameraRef.current === session) {
                stopCamera();
                setError(CAMERA_ERRORS[cameraError?.name] || 'Could not open the camera. Try again or enter the ticket code manually.');
            }
            return;
        }

        try {
            video.srcObject = session.stream;
            await video.play();
            if (cameraRef.current !== session) return;

            const { BrowserQRCodeReader } = await import('@zxing/browser');
            if (cameraRef.current !== session) return;

            const reader = new BrowserQRCodeReader();
            session.controls = await reader.decodeFromVideoElement(
                video,
                (decoded) => {
                    if (decoded && cameraRef.current === session) {
                        void checkIn(decoded.getText());
                    }
                },
            );
            if (cameraRef.current !== session) {
                releaseCamera(video, session);
            }
        } catch {
            if (cameraRef.current === session) {
                stopCamera();
                setError('Camera access was granted, but the QR scanner could not start. Refresh the page and try again, or enter the ticket code manually.');
            }
        }
    };

    return (
        <section className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4">
            <div className="font-semibold text-slate-900">{gateDirection ? `Scan for ${gateDirection}` : `Event check-in: ${eventTitle}`}</div>
            <p className="mt-1 text-sm text-slate-600">{gateDirection ? 'Scan the QR shown on the hostel pass.' : 'Scan a registered student’s QR ticket. Each ticket can be checked in once.'}</p>

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
                    {gateDirection ? 'Record scan' : 'Check in'}
                </button>
            </form>

            {result && (
                <div className={`mt-3 rounded-xl border px-3 py-2 text-sm ${result.alreadyCheckedIn ? 'border-amber-300 bg-amber-100 text-amber-900' : 'border-emerald-300 bg-emerald-100 text-emerald-900'}`}>
                    <div className="font-semibold">{gateDirection ? `Recorded ${gateDirection}` : result.alreadyCheckedIn ? 'Already checked in' : 'Check-in successful'}</div>
                    <div>{result.attendee?.name}{result.attendee?.rollNumber ? ` · ${result.attendee.rollNumber}` : ''}</div>
                    {result.checkedInAt && <div className="mt-1 text-xs">{new Date(result.checkedInAt).toLocaleString()}</div>}
                </div>
            )}
            {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        </section>
    );
}
