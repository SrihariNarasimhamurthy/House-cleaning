import { addDays, startOfWeek, format } from "date-fns";

// Monday-start week key: e.g., 2025-W34
export function getWeekKey(date) {
  const monday = startOfWeek(date, { weekStartsOn: 1 });
  const weekNum = Number(format(monday, "I")); // ISO week number
  const year = Number(format(monday, "yyyy"));
  return `${year}-W${String(weekNum).padStart(2, "0")}`;
}

// Assign each weekday to a housemate in order (Mon→index 0, Tue→1, etc.)
export function getAssignments(weekStartDate, housemates = []) {
  const monday = startOfWeek(weekStartDate, { weekStartsOn: 1 });
  const n = housemates.length || 1;
  const arr = [];
  for (let i = 0; i < 7; i++) {
    arr.push({
      dayIndex: i,
      date: addDays(monday, i),
      assignee: housemates[i % n] || "—",
    });
  }
  return arr;
}
