import { useState } from "react";
import { useAppStore } from "../store";

export default function Settings({ onClose }) {
  const {
    housemates,
    setHousemate,
    chores,
    setChores,
    householdId,
    setHouseholdId,
    emails,
    setEmails,
  } = useAppStore();
  const [newChore, setNewChore] = useState("");
  const [code, setCode] = useState(householdId);

  const addChore = () => {
    const name = newChore.trim();
    if (!name) return;
    setChores([...chores, name]);
    setNewChore("");
  };
  const removeChore = (name) => setChores(chores.filter((c) => c !== name));

  const applyCode = () => setHouseholdId(code);

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h3 style={{ margin: 0 }}>Settings</h3>
        <button className="btn" onClick={onClose}>
          Close
        </button>
      </div>

      <h4>Household</h4>
      <div className="row" style={{ alignItems: "center" }}>
        <input
          className="input"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Household Code (share with members)"
        />
        <button className="btn" onClick={applyCode}>
          Create/Join
        </button>
      </div>
      <div className="date" style={{ marginTop: 6 }}>
        Current: <strong>{householdId}</strong>
      </div>

      <h4 style={{ marginTop: 16 }}>Housemates (fixed Mon→#1, Tue→#2, ...)</h4>
      <div className="form-row">
        {housemates.map((n, i) => (
          <div key={i}>
            <label>Person {i + 1}</label>
            <input
              value={n}
              onChange={(e) => setHousemate(i, e.target.value)}
              placeholder={`Person ${i + 1} name`}
            />
          </div>
        ))}
      </div>

      <h4 style={{ marginTop: 16 }}>Email Notifications</h4>
      <div className="date" style={{ marginBottom: 8 }}>
        Configure emails to receive automatic reminders for pending chores
      </div>
      <div className="form-row">
        {housemates.map((n, i) => (
          <div key={i}>
            <label>{n || `Person ${i + 1}`} Email</label>
            <input
              type="email"
              value={emails?.[i] || ""}
              onChange={(e) => setEmails(i, e.target.value)}
              placeholder={`${n || `Person ${i + 1}`} email address`}
            />
          </div>
        ))}
      </div>

      <h4 style={{ marginTop: 16 }}>Chores</h4>
      <div className="row" style={{ alignItems: "center" }}>
        <input
          className="input"
          placeholder="Add chore (e.g., Living Room)"
          value={newChore}
          onChange={(e) => setNewChore(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              addChore();
            }
          }}
        />
        <button className="btn" onClick={addChore}>
          Add
        </button>
      </div>
      <div className="row" style={{ marginTop: 10, flexWrap: "wrap" }}>
        {chores.map((c) => (
          <span
            key={c}
            className="tab"
            style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            {c}
            <button
              className="btn ghost"
              onClick={() => removeChore(c)}
              aria-label={`Remove ${c}`}
            >
              ✕
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
