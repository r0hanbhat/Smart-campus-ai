'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import HostelMessAdminPanel from '@/app/components/HostelMessAdminPanel.jsx';
import HostelOutpassPanel from '@/app/components/HostelOutpassPanel.jsx';
import HostelRegistrationRequestsPanel from '@/app/components/HostelRegistrationRequestsPanel.jsx';
import FacilityManagementPanel from '@/app/components/FacilityManagementPanel.jsx';
import HostelSectionTabs from '@/app/components/HostelSectionTabs.jsx';

async function requestJson(url, options = {}) {
    const response = await fetch(url, {
        credentials: 'same-origin',
        ...options,
    });
    const payload = await response.json().catch(() => ({ error: 'The request could not be completed.' }));
    if (!response.ok) {
        throw new Error(payload.error || 'The request could not be completed.');
    }
    return payload;
}

function Panel({ title, description, children }) {
    return (
        <section className="campus-panel rounded-[1.7rem] p-6">
            <h2 className="text-xl font-bold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
            <div className="mt-5">{children}</div>
        </section>
    );
}

export default function HostelAdminPage() {
    const [data, setData] = useState({ blocks: [], wardens: [], students: [], residents: [] });
    const [activeSection, setActiveSection] = useState('facilities');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [blockName, setBlockName] = useState('');
    const [wardenId, setWardenId] = useState('');
    const [wardenName, setWardenName] = useState('');
    const [wardenPasscode, setWardenPasscode] = useState('');
    const [wardenBlockIds, setWardenBlockIds] = useState([]);
    const [residentUserId, setResidentUserId] = useState('');
    const [residentBlockId, setResidentBlockId] = useState('');
    const [roomNumber, setRoomNumber] = useState('');

    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            setData(await requestJson('/api/hostel/admin'));
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Unable to load hostel administration data.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const submit = async (event, url, body, successMessage, reset) => {
        event.preventDefault();
        setSubmitting(true);
        setError('');
        setNotice('');
        try {
            await requestJson(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            reset();
            setNotice(successMessage);
            await loadData();
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : 'Unable to save hostel data.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleWardenBlockChange = (event) => {
        setWardenBlockIds(Array.from(event.target.selectedOptions, (option) => option.value));
    };

    return (
        <div className="campus-shell min-h-screen px-4 py-8 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl space-y-6">
                <div className="campus-panel-strong rounded-[2rem] p-7 sm:p-8">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <div className="campus-kicker">Hostel Administration</div>
                            <h1 className="mt-3 text-3xl font-bold text-slate-900">Hostel operations</h1>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Manage hostel facilities, blocks, wardens, hostellers, dining, and requests from the sections below.</p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => void loadData()} disabled={loading} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Refresh</button>
                            <Link href="/hostel" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Hostel portal</Link>
                        </div>
                    </div>
                </div>
                {error ? (
                    <div role="alert" className="rounded-2xl border border-red-300/60 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                        {error === 'Unauthorized.' || error === 'Admin access required.' ? (
                            <Link href="/auth?role=admin&mode=login" className="ml-2 font-semibold underline">Sign in as admin</Link>
                        ) : null}
                    </div>
                ) : null}
                {notice ? <div role="status" className="rounded-2xl border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div> : null}

                <HostelSectionTabs
                    label="Hostel administration sections"
                    sections={[
                        { id: 'facilities', label: 'Hostel facilities' },
                        { id: 'blocks', label: 'Blocks & wardens' },
                        { id: 'hostellers', label: 'Hostellers' },
                        { id: 'dining', label: 'Hostel dining' },
                        { id: 'outpasses', label: 'Leave & outpass requests' },
                    ]}
                    activeSection={activeSection}
                    onSelect={setActiveSection}
                />

                <section aria-label="Selected hostel administration section">
                    {activeSection === 'facilities' ? (
                        <FacilityManagementPanel scope="hostel" />
                    ) : activeSection === 'blocks' ? (
                        <div className="grid gap-6 lg:grid-cols-2">
                            <Panel title="Create a hostel block" description="Use a block name that residents and wardens will recognize.">
                                <form onSubmit={(event) => void submit(event, '/api/hostel/admin/blocks', { name: blockName }, 'Hostel block created.', () => setBlockName(''))} className="flex flex-col gap-3 sm:flex-row">
                                    <input value={blockName} onChange={(event) => setBlockName(event.target.value)} required maxLength={80} className="campus-input min-w-0 flex-1 rounded-xl px-4 py-3" placeholder="For example, Block A" />
                                    <button disabled={submitting} className="campus-button rounded-xl px-5 py-3 font-semibold text-white disabled:opacity-50">Add block</button>
                                </form>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {data.blocks.map((block) => <span key={block.id} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700">{block.name}</span>)}
                                    {!loading && data.blocks.length === 0 ? <span className="text-sm text-slate-500">No blocks yet.</span> : null}
                                </div>
                            </Panel>

                            <Panel title="Create a warden account" description="Passcodes are hashed before storage. Assign at least one block.">
                                <form onSubmit={(event) => void submit(event, '/api/hostel/admin/wardens', { wardenId, displayName: wardenName, passcode: wardenPasscode, blockIds: wardenBlockIds }, 'Warden account created.', () => { setWardenId(''); setWardenName(''); setWardenPasscode(''); setWardenBlockIds([]); })} className="space-y-3">
                                    <input value={wardenId} onChange={(event) => setWardenId(event.target.value)} required maxLength={64} className="campus-input w-full rounded-xl px-4 py-3" placeholder="Warden ID" autoComplete="off" />
                                    <input value={wardenName} onChange={(event) => setWardenName(event.target.value)} required maxLength={120} className="campus-input w-full rounded-xl px-4 py-3" placeholder="Warden name" autoComplete="name" />
                                    <input type="password" value={wardenPasscode} onChange={(event) => setWardenPasscode(event.target.value)} required minLength={8} maxLength={72} className="campus-input w-full rounded-xl px-4 py-3" placeholder="Temporary passcode (at least 8 characters)" autoComplete="new-password" />
                                    <label className="block text-sm font-medium text-slate-700">
                                        Assigned blocks
                                        <select multiple value={wardenBlockIds} onChange={handleWardenBlockChange} required className="campus-input mt-2 min-h-28 w-full rounded-xl px-3 py-2">
                                            {data.blocks.map((block) => <option key={block.id} value={block.id}>{block.name}</option>)}
                                        </select>
                                    </label>
                                    <p className="text-xs text-slate-500">Hold Ctrl (Windows) or Command (Mac) to select multiple blocks.</p>
                                    <button disabled={submitting || data.blocks.length === 0} className="campus-button rounded-xl px-5 py-3 font-semibold text-white disabled:opacity-50">Create warden</button>
                                </form>
                            </Panel>

                            <Panel title="Current wardens" description="Wardens can view residents only in their assigned blocks.">
                                {loading ? <p className="text-sm text-slate-500">Loading…</p> : data.wardens.length === 0 ? <p className="text-sm text-slate-500">No wardens have been created.</p> : (
                                    <div className="space-y-3">
                                        {data.wardens.map((warden) => (
                                            <div key={warden.id} className="rounded-xl border border-slate-200 bg-white/70 px-4 py-3">
                                                <div className="flex flex-wrap justify-between gap-2">
                                                    <span className="font-semibold text-slate-900">{warden.displayName}</span>
                                                    <span className="text-sm text-slate-600">{warden.wardenId}</span>
                                                </div>
                                                <div className="mt-2 text-xs text-slate-500">Blocks: {warden.blocks.map((block) => block.name).join(', ') || 'None'}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Panel>
                        </div>
                    ) : activeSection === 'hostellers' ? (
                        <div className="space-y-6">
                            <HostelRegistrationRequestsPanel />
                            <div className="grid gap-6 lg:grid-cols-2">
                                <Panel title="Assign a hosteller" description="Select an existing student account, then assign its block and room.">
                                    <form onSubmit={(event) => void submit(event, '/api/hostel/admin/residents', { userId: residentUserId, blockId: residentBlockId, roomNumber }, 'Hosteller assignment saved.', () => { setResidentUserId(''); setResidentBlockId(''); setRoomNumber(''); })} className="space-y-3">
                                        <select value={residentUserId} onChange={(event) => setResidentUserId(event.target.value)} required className="campus-input w-full rounded-xl px-3 py-3">
                                            <option value="">Choose a student by roll number</option>
                                            {data.students.map((student) => <option key={student.userId} value={student.userId}>{student.rollNumber} — {student.name}</option>)}
                                        </select>
                                        <select value={residentBlockId} onChange={(event) => setResidentBlockId(event.target.value)} required className="campus-input w-full rounded-xl px-3 py-3">
                                            <option value="">Choose a block</option>
                                            {data.blocks.map((block) => <option key={block.id} value={block.id}>{block.name}</option>)}
                                        </select>
                                        <input value={roomNumber} onChange={(event) => setRoomNumber(event.target.value)} required maxLength={32} className="campus-input w-full rounded-xl px-4 py-3" placeholder="Room number" />
                                        <button disabled={submitting || data.students.length === 0 || data.blocks.length === 0} className="campus-button rounded-xl px-5 py-3 font-semibold text-white disabled:opacity-50">Save assignment</button>
                                    </form>
                                </Panel>

                                <Panel title="Current hosteller assignments" description="Each student account has one active block and room assignment.">
                                    {loading ? <p className="text-sm text-slate-500">Loading…</p> : data.residents.length === 0 ? <p className="text-sm text-slate-500">No hostellers have been assigned yet.</p> : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full min-w-[32rem] text-left text-sm">
                                                <thead className="text-xs uppercase tracking-wide text-slate-500">
                                                    <tr><th className="px-3 py-2">Roll number</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Block</th><th className="px-3 py-2">Room</th></tr>
                                                </thead>
                                                <tbody>
                                                    {data.residents.map((resident) => (
                                                        <tr key={resident.userId} className="border-t border-slate-200">
                                                            <td className="px-3 py-3 font-medium text-slate-900">{resident.rollNumber}</td>
                                                            <td className="px-3 py-3 text-slate-700">{resident.name}</td>
                                                            <td className="px-3 py-3 text-slate-700">{resident.blockName}</td>
                                                            <td className="px-3 py-3 text-slate-700">{resident.roomNumber}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </Panel>
                            </div>
                        </div>
                    ) : activeSection === 'dining' ? (
                        <HostelMessAdminPanel />
                    ) : (
                        <HostelOutpassPanel />
                    )}
                </section>
                <Link href="/" className="inline-flex text-sm font-medium text-sky-800 hover:underline">Back to Smart Campus</Link>
            </div>
        </div>
    );
}
