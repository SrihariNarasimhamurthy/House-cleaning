import { addWeeks, addDays, format } from "date-fns";

export default function WeekNavigator({ weekStart, setWeekStart, weekKey }) {
  const toPrev = () => setWeekStart((d) => addWeeks(d, -1));
  const toNext = () => setWeekStart((d) => addWeeks(d, 1));
  const toThis = () =>
    setWeekStart(() => {
      const now = new Date();
      const day = now.getDay();
      const diff = (day === 0 ? -6 : 1) - day; // shift to Monday
      const monday = new Date(now);
      monday.setDate(now.getDate() + diff);
      monday.setHours(0, 0, 0, 0);
      return monday;
    });

  const range = `${format(weekStart, "MMM d")} – ${format(
    addDays(weekStart, 6),
    "MMM d, yyyy"
  )}`;

  return (
    <div
      className="row card"
      style={{ alignItems: "center", justifyContent: "space-between" }}
    >
      <div>
        <div style={{ fontWeight: 700 }}>Week {weekKey}</div>
        <div className="date">{range}</div>
      </div>
      <div className="row">
        <button className="btn" onClick={toPrev}>
          ◀ Prev
        </button>
        <button className="btn ghost" onClick={toThis}>
          This Week
        </button>
        <button className="btn" onClick={toNext}>
          Next ▶
        </button>
      </div>
    </div>
  );
}
