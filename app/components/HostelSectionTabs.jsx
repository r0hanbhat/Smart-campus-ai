export default function HostelSectionTabs({ label, sections, activeSection, onSelect }) {
    return (
        <nav className="campus-panel mx-auto flex w-full max-w-6xl gap-2 overflow-x-auto rounded-2xl p-2" aria-label={label}>
            {sections.map((section) => (
                <button
                    key={section.id}
                    type="button"
                    aria-pressed={activeSection === section.id}
                    onClick={() => onSelect(section.id)}
                    className={`shrink-0 rounded-xl px-5 py-3 text-sm font-semibold transition ${
                        activeSection === section.id
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
                    }`}
                >
                    {section.label}
                </button>
            ))}
        </nav>
    );
}
