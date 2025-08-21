import { create } from "zustand";
import { db, serverTimestamp, ensureAnonSignIn } from "./firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";
import { safeKey } from "./utils/sanitize";

const DEFAULT_NAMES = [
  "Abhay",
  "Rakesh",
  "Chethan",
  "Darshan",
  "Suchethan",
  "Shashank",
  "Hari",
];
// Downscale image to base64 JPEG (keeps Firestore docs small)
async function fileToBase64(file, maxDim = 1024, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        const b64 = canvas.toDataURL("image/jpeg", quality); // "data:image/jpeg;base64,..."
        resolve(b64);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
export const useAppStore = create((set, get) => ({
  uid: null,
  householdId: localStorage.getItem("householdId") || "demo-household",
  housemates: DEFAULT_NAMES,
  chores: ["Kitchen", "Bathroom"],
  weekData: {},
  _unsubHousehold: null,
  _unsubWeek: null,

  // --- Session & subscriptions ---
  initSession: () => {
    ensureAnonSignIn((user) => {
      set({ uid: user?.uid || null });
      get().subscribeHousehold();
    });
  },
  setHouseholdId: async (id) => {
    const newId = (id || "").trim();
    if (!newId) return;
    localStorage.setItem("householdId", newId);
    set({ householdId: newId });
    await get().ensureHouseholdDoc();
    get().subscribeHousehold();
  },
  ensureHouseholdDoc: async () => {
    const { householdId, housemates, chores } = get();
    const refDoc = doc(db, "households", householdId);
    const snap = await getDoc(refDoc);
    if (!snap.exists()) {
      await setDoc(
        refDoc,
        { housemates, chores, createdAt: serverTimestamp() },
        { merge: true }
      );
    }
  },
  subscribeHousehold: async () => {
    const { householdId, _unsubHousehold } = get();
    if (_unsubHousehold) _unsubHousehold();
    await get().ensureHouseholdDoc();
    const unsub = onSnapshot(doc(db, "households", householdId), (snap) => {
      const data = snap.data() || {};
      if (data.housemates) set({ housemates: data.housemates });
      if (data.chores) set({ chores: data.chores });
    });
    set({ _unsubHousehold: unsub });
  },
  subscribeWeek: (weekKey) => {
    const { householdId, _unsubWeek } = get();
    if (_unsubWeek) _unsubWeek();
    const refDoc = doc(db, "households", householdId, "weeks", weekKey);
    const unsub = onSnapshot(refDoc, (snap) =>
      set({ weekData: snap.data() || {} })
    );
    set({ _unsubWeek: unsub });
  },
  // --- Household edits ---
  setHousemate: async (idx, name) => {
    const { householdId, housemates } = get();
    const next = [...housemates];
    next[idx] = name;
    set({ housemates: next });
    await updateDoc(doc(db, "households", householdId), { housemates: next });
  },
  setChores: async (arr) => {
    const { householdId } = get();
    set({ chores: arr });
    await updateDoc(doc(db, "households", householdId), { chores: arr });
  },

  uploadProof: async (chore, weekKey, dayIndex, file) => {
    const { householdId, uid } = get();
    const safe = safeKey(chore);
    const b64 = await fileToBase64(file); // ~100–250KB at 1024px
    // Store the image in a subcollection doc to avoid 1MiB doc size issues
    await setDoc(
      doc(
        db,
        "households",
        householdId,
        "weeks",
        weekKey,
        "proofs",
        `${safe}-${dayIndex}`
      ),
      {
        b64,
        uploadedBy: uid,
        uploadedAt: serverTimestamp(),
      }
    );
    await setDoc(
      doc(db, "households", householdId, "weeks", weekKey),
      {
        chores: {
          [safe]: {
            [dayIndex]: { proofExists: true, doneBy: null, doneAt: null },
          },
        },
      },
      { merge: true }
    );
  },
  removeProof: async (chore, weekKey, dayIndex) => {
    const { householdId } = get();
    const safe = safeKey(chore);
    await deleteDoc(
      doc(
        db,
        "households",
        householdId,
        "weeks",
        weekKey,
        "proofs",
        `${safe}-${dayIndex}`
      )
    );
    await setDoc(
      doc(db, "households", householdId, "weeks", weekKey),
      {
        chores: {
          [safe]: {
            [dayIndex]: { proofExists: false, doneBy: null, doneAt: null },
          },
        },
      },
      { merge: true }
    );
  },
  setDone: async (chore, weekKey, dayIndex, value) => {
    const { householdId, uid } = get();
    const safe = safeKey(chore);
    const payload = value
      ? { doneBy: uid, doneAt: serverTimestamp() }
      : { doneBy: null, doneAt: null };
    await setDoc(
      doc(db, "households", householdId, "weeks", weekKey),
      { chores: { [safe]: { [dayIndex]: payload } } },
      { merge: true }
    );
  },
  getEntry: (chore, dayIndex) => {
    const { weekData } = get();
    const safe = safeKey(chore);
    return weekData?.chores?.[safe]?.[dayIndex] || null;
  },
  fetchProofB64: async (chore, weekKey, dayIndex) => {
    const { householdId } = get();
    const { doc, getDoc } = await import("firebase/firestore");
    const { safeKey } = await import("./utils/sanitize");
    const snap = await getDoc(
      doc(
        (
          await import("./firebase")
        ).db,
        "households",
        householdId,
        "weeks",
        weekKey,
        "proofs",
        `${safeKey(chore)}-${dayIndex}`
      )
    );
    return snap.exists() ? snap.data()?.b64 || null : null;
  },
}));
