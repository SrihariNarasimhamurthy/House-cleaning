import { format } from "date-fns";
import { useState } from "react";
import { useAppStore } from "../store";

export default function DayCard({ chore, weekKey, dayIndex, date, assignee }) {
  const { getEntry, uploadProof, removeProof, setDone, fetchProofB64 } =
    useAppStore();
  const entry = getEntry(chore, dayIndex);
  const hasProof = !!entry?.proofExists;
  const done = !!entry?.doneBy;

  const [viewing, setViewing] = useState(false);
  const [imgB64, setImgB64] = useState(null);
  const [loadingView, setLoadingView] = useState(false);

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadProof(chore, weekKey, dayIndex, file);
  };

  const onRemoveProof = async () => {
    await removeProof(chore, weekKey, dayIndex);
    if (done) await setDone(chore, weekKey, dayIndex, false); // removing proof un-does completion
    setViewing(false);
    setImgB64(null);
  };

  const onToggleView = async () => {
    if (!hasProof) return;
    if (!viewing && !imgB64) {
      setLoadingView(true);
      const b64 = await fetchProofB64(chore, weekKey, dayIndex);
      setImgB64(b64 || null);
      setLoadingView(false);
    }
    setViewing((v) => !v);
  };

  const toggleDone = async () => {
    if (!hasProof) return; // guard
    await setDone(chore, weekKey, dayIndex, !done);
  };

  return (
    <div className="card">
      <div className="date">{format(date, "EEEE, MMM d")}</div>
      <div style={{ fontWeight: 700, marginTop: 6 }}>
        Responsible: {assignee}
      </div>

      <div style={{ marginTop: 10 }}>
        <label style={{ display: "block", marginBottom: 6 }}>
          Upload proof photo:
        </label>
        <input type="file" accept="image/*" onChange={onUpload} />
        {hasProof && (
          <div
            className="row"
            style={{ marginTop: 8, gap: 8, alignItems: "center" }}
          >
            <span className="date">Photo uploaded</span>
            <button
              className="btn ghost"
              onClick={onToggleView}
              disabled={loadingView}
            >
              {viewing ? "Hide Photo" : loadingView ? "Loading…" : "View Photo"}
            </button>
            <button className="btn ghost" onClick={onRemoveProof}>
              Remove Photo
            </button>
          </div>
        )}
        {viewing && imgB64 && (
          <div style={{ marginTop: 8 }}>
            <img className="preview" src={imgB64} alt="Proof" />
            <div style={{ marginTop: 6 }}>
              <a href={imgB64} target="_blank" rel="noreferrer">
                Open in new tab
              </a>
            </div>
          </div>
        )}
      </div>

      <button
        className={`btn ${done ? "ok" : ""}`}
        style={{ marginTop: 10, opacity: hasProof ? 1 : 0.6 }}
        onClick={toggleDone}
        disabled={!hasProof}
        title={!hasProof ? "Upload a photo to enable" : "Toggle completion"}
      >
        {done ? "Done ✅" : "Mark Done"}
      </button>
    </div>
  );
}
