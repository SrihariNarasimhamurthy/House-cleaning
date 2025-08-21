// Convert labels to safe Firestore keys: "Kitchen Sink" -> "kitchen-sink"
export function safeKey(str = "") {
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
