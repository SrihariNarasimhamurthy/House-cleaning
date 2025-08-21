export default function ChoreTabs({ chores, active, onChange }) {
  return (
    <div className="tabs card">
      {chores.map((c) => (
        <button
          key={c}
          className={`tab ${active === c ? "active" : ""}`}
          onClick={() => onChange(c)}
          aria-pressed={active === c}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
