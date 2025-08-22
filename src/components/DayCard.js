import { format } from "date-fns";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAppStore } from "../store";

// Constants
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const SUPPORTED_FORMATS = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];
const STATE_UPDATE_DELAY = 100; // ms

export default function DayCard({ chore, weekKey, dayIndex, date, assignee }) {
  const { getEntry, uploadProof, removeProof, setDone, fetchProofB64 } =
    useAppStore();

  // Use ref to track if component is mounted to prevent state updates after unmount
  const mountedRef = useRef(true);

  // State management - ALL HOOKS MUST BE CALLED FIRST
  const [viewing, setViewing] = useState(false);
  const [imgB64, setImgB64] = useState(null);
  const [loadingView, setLoadingView] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [toggling, setToggling] = useState(false);

  // ALL useEffect and useCallback hooks BEFORE any conditional logic
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      setImgB64(null); // Always clean up
    };
  }, []);

  // Safe state setter that checks if component is still mounted
  const safeSetState = useCallback((setter) => {
    if (mountedRef.current) {
      setter();
    }
  }, []);

  // File validation
  const validateFile = useCallback((file) => {
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file (JPEG, PNG, GIF, or WebP)");
      return false;
    }

    if (!SUPPORTED_FORMATS.includes(file.type)) {
      alert(
        `Unsupported image format. Please use: ${SUPPORTED_FORMATS.join(", ")}`
      );
      return false;
    }

    if (file.size > MAX_FILE_SIZE) {
      alert(
        `Image size must be less than ${Math.round(
          MAX_FILE_SIZE / 1024 / 1024
        )}MB`
      );
      return false;
    }

    return true;
  }, []);

  // Upload handler with comprehensive error handling
  const onUpload = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!validateFile(file)) {
        e.target.value = "";
        return;
      }

      safeSetState(() => setUploading(true));

      try {
        // Clear old image data before uploading new one
        setImgB64(null);
        setViewing(false);

        await uploadProof(chore, weekKey, dayIndex, file);

        // Wait for state to update
        await new Promise((resolve) => setTimeout(resolve, STATE_UPDATE_DELAY));

        // Verify upload succeeded
        const updatedEntry = getEntry(chore, dayIndex);
        if (!updatedEntry?.proofExists) {
          throw new Error("Upload verification failed");
        }
      } catch (error) {
        console.error("Upload failed:", error);
        alert(
          `Failed to upload image: ${
            error.message || "Unknown error"
          }. Please try again.`
        );
      } finally {
        safeSetState(() => setUploading(false));
        e.target.value = ""; // Always reset file input
      }
    },
    [
      chore,
      weekKey,
      dayIndex,
      validateFile,
      uploadProof,
      getEntry,
      safeSetState,
    ]
  );

  // Remove proof handler
  const onRemoveProof = useCallback(async () => {
    if (removing) return; // Prevent double-clicks

    // Immediately hide the image when removal starts
    setViewing(false);
    setImgB64(null);
    setRemoving(true);

    try {
      await removeProof(chore, weekKey, dayIndex);

      // Check if currently marked as done and unmark if so
      const currentEntry = getEntry(chore, dayIndex);
      if (currentEntry?.doneBy) {
        await setDone(chore, weekKey, dayIndex, false);
      }
    } catch (error) {
      console.error("Remove failed:", error);
      alert(
        `Failed to remove image: ${
          error.message || "Unknown error"
        }. Please try again.`
      );

      // If removal failed, we should potentially restore the view state
      // But since we don't know if the image was actually removed or not,
      // it's safer to leave it hidden and let user refresh/re-view if needed
    } finally {
      setRemoving(false);
    }
  }, [chore, weekKey, dayIndex, removing, removeProof, setDone, getEntry]);

  // Toggle view handler
  const onToggleView = useCallback(async () => {
    const currentEntry = getEntry(chore, dayIndex);
    const currentHasProof = !!currentEntry?.proofExists;

    if (!currentHasProof || loadingView) return;

    if (!viewing && !imgB64) {
      setLoadingView(true);

      try {
        const b64 = await fetchProofB64(chore, weekKey, dayIndex);

        if (!b64) {
          console.warn("No image data returned despite proof existing");
          alert("Failed to load image. The image may be corrupted or missing.");
          setLoadingView(false);
          return;
        }

        setImgB64(b64);
        setViewing(true);
        setLoadingView(false);
      } catch (error) {
        console.error("Failed to fetch image:", error);
        alert(
          `Failed to load image: ${
            error.message || "Unknown error"
          }. Please try again.`
        );
        setImgB64(null);
        setLoadingView(false);
      }
    } else {
      setViewing((prev) => !prev);
    }
  }, [
    viewing,
    imgB64,
    loadingView,
    fetchProofB64,
    chore,
    weekKey,
    dayIndex,
    getEntry,
  ]);

  // Image error handler
  const handleImageError = useCallback(() => {
    console.error("Failed to display image - corrupted data");
    alert("Image data is corrupted. Please upload a new image.");
    safeSetState(() => {
      setImgB64(null);
      setViewing(false);
    });
  }, [safeSetState]);

  // Toggle done handler with loading state
  const toggleDone = useCallback(async () => {
    const currentEntry = getEntry(chore, dayIndex);
    const currentHasProof = !!currentEntry?.proofExists;
    const currentDone = !!currentEntry?.doneBy;

    if (!currentHasProof || toggling || uploading) return;

    safeSetState(() => setToggling(true));

    try {
      await setDone(chore, weekKey, dayIndex, !currentDone);
    } catch (error) {
      console.error("Failed to toggle done status:", error);
      alert(
        `Failed to update completion status: ${
          error.message || "Unknown error"
        }. Please try again.`
      );
    } finally {
      safeSetState(() => setToggling(false));
    }
  }, [
    toggling,
    uploading,
    setDone,
    chore,
    weekKey,
    dayIndex,
    getEntry,
    safeSetState,
  ]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e, action) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      action();
    }
  }, []);

  // PROPS VALIDATION AFTER ALL HOOKS
  if (!chore || !weekKey || dayIndex === undefined || !date || !assignee) {
    console.error("DayCard: Missing required props", {
      chore,
      weekKey,
      dayIndex,
      date,
      assignee,
    });
    return <div className="card error">Invalid card configuration</div>;
  }

  // Get entry data AFTER props validation but AFTER all hooks
  const entry = getEntry(chore, dayIndex);
  const hasProof = !!entry?.proofExists;
  const done = !!entry?.doneBy;

  // Computed states
  const isAnyOperationInProgress =
    uploading || removing || loadingView || toggling;
  const canMarkDone = hasProof || uploading;
  const showUploadingState = uploading && !hasProof;
  const showRemovingState = removing;
  const showProofControls =
    hasProof && !showUploadingState && !showRemovingState;

  // Get appropriate button text and title
  const getMarkDoneButtonText = () => {
    if (toggling) return "Updating...";
    if (uploading) return "Uploading...";
    if (done) return "Done ✅";
    return "Mark Done";
  };

  const getMarkDoneTitle = () => {
    if (toggling) return "Updating completion status...";
    if (uploading) return "Upload in progress...";
    if (removing) return "Removing photo...";
    if (!hasProof) return "Upload a photo to enable";
    return "Toggle completion status";
  };

  return (
    <div className="card">
      <div className="date">{format(date, "EEEE, MMM d")}</div>
      <div style={{ fontWeight: 700, marginTop: 6 }}>
        Responsible: {assignee}
      </div>

      <div style={{ marginTop: 10 }}>
        <label
          style={{ display: "block", marginBottom: 6 }}
          id={`upload-label-${chore}-${dayIndex}`}
        >
          Upload proof:
        </label>
        <input
          type="file"
          accept={SUPPORTED_FORMATS.join(",")}
          onChange={onUpload}
          disabled={isAnyOperationInProgress}
          aria-labelledby={`upload-label-${chore}-${dayIndex}`}
          aria-describedby={
            hasProof ? `proof-status-${chore}-${dayIndex}` : undefined
          }
        />

        {showUploadingState && (
          <div
            className="row"
            style={{ marginTop: 8, gap: 8, alignItems: "center" }}
            role="status"
            aria-live="polite"
          >
            <span className="date">Uploading...</span>
          </div>
        )}

        {showRemovingState && (
          <div
            className="row"
            style={{ marginTop: 8, gap: 8, alignItems: "center" }}
            role="status"
            aria-live="polite"
          >
            <span className="date">Removing...</span>
          </div>
        )}

        {showProofControls && (
          <div
            className="row"
            style={{ marginTop: 8, gap: 8, alignItems: "center" }}
            id={`proof-status-${chore}-${dayIndex}`}
          >
            <span className="date" aria-label="Upload status">
              Uploaded
            </span>
            <button
              className="btn ghost"
              onClick={onToggleView}
              onKeyDown={(e) => handleKeyDown(e, onToggleView)}
              disabled={loadingView}
              aria-label={
                viewing ? "Hide uploaded content" : "View uploaded content"
              }
              aria-pressed={viewing}
            >
              {viewing ? "Hide" : loadingView ? "Loading…" : "View"}
            </button>
            <button
              className="btn ghost"
              onClick={onRemoveProof}
              onKeyDown={(e) => handleKeyDown(e, onRemoveProof)}
              disabled={removing}
              aria-label="Remove uploaded content"
            >
              {removing ? "Removing..." : "Remove"}
            </button>
          </div>
        )}

        {viewing && imgB64 && (
          <div style={{ marginTop: 8 }}>
            <img
              className="preview"
              src={imgB64}
              alt={`Proof for ${chore} on ${format(date, "MMM d")}`}
              onError={handleImageError}
              style={{
                maxWidth: "100%",
                height: "auto",
                border: "1px solid #ddd",
                borderRadius: "4px",
              }}
            />
            <div style={{ marginTop: 6 }}>
              <a
                href={imgB64}
                target="_blank"
                rel="noreferrer"
                aria-label="Open in new tab"
              >
                Open in new tab
              </a>
            </div>
          </div>
        )}
      </div>

      <button
        className={`btn ${done ? "ok" : ""}`}
        style={{ marginTop: 10, opacity: canMarkDone ? 1 : 0.6 }}
        onClick={toggleDone}
        onKeyDown={(e) => handleKeyDown(e, toggleDone)}
        disabled={!canMarkDone || removing || toggling}
        title={getMarkDoneTitle()}
        aria-label={`Mark chore as ${done ? "not done" : "done"}`}
        aria-pressed={done}
      >
        {getMarkDoneButtonText()}
      </button>
    </div>
  );
}
