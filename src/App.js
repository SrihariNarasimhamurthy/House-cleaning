import { useEffect, useMemo, useState } from "react";
import { startOfWeek } from "date-fns";
import "./index.css";
import { useAppStore } from "./store";
import { getAssignments, getWeekKey } from "./utils/rotation";
import WeekNavigator from "./components/WeekNavigator";
import ChoreTabs from "./components/ChoreTabs";
import DayCard from "./components/DayCard";
import Settings from "./components/Settings";

export default function App() {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [activeChore, setActiveChore] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const { initSession, subscribeWeek, householdId, housemates, chores } =
    useAppStore();

  const weekKey = useMemo(() => getWeekKey(weekStart), [weekStart]);
  const assignments = useMemo(
    () => getAssignments(weekStart, housemates),
    [weekStart, housemates]
  );

  const chosenChore = activeChore || chores[0];

  useEffect(() => {
    initSession();
  }, [initSession]);
  useEffect(() => {
    subscribeWeek(weekKey);
  }, [subscribeWeek, weekKey, householdId]);

  return (
    <div className="container">
      <header className="header">
        <div className="h1">435 Walnut Ave #6</div>
        <div className="row">
          <button className="btn" onClick={() => setShowSettings((s) => !s)}>
            {showSettings ? "Hide Settings" : "Settings"}
          </button>
        </div>
      </header>
      <WeekNavigator
        weekStart={weekStart}
        setWeekStart={setWeekStart}
        weekKey={weekKey}
      />
      <ChoreTabs
        chores={chores}
        active={chosenChore}
        onChange={setActiveChore}
      />

      <div className="grid">
        {assignments.map(({ date, dayIndex, assignee }) => (
          <DayCard
            key={dayIndex}
            chore={chosenChore}
            weekKey={weekKey}
            dayIndex={dayIndex}
            date={date}
            assignee={assignee}
          />
        ))}
      </div>
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}

      <div className="footer">
        Photos saved privately in Firestore (no Firebase Storage/billing).
        Upload required before Mark Done.
      </div>
    </div>
  );
}
