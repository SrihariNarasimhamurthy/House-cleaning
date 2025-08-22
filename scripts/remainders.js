// CommonJS for Node.js
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const path = require("path");
const { startOfWeek, addDays, format } = require("date-fns");
require("dotenv").config();

// ---- Firebase Admin
let serviceAccount;
try {
  serviceAccount = require(path.join(__dirname, "serviceAccountKey.json"));
} catch (e) {
  console.error("Firebase service account not found!");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ---- Mail transport
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

// ---- Timezone Helper
function getESTTime() {
  const now = new Date();
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;

  // EST is UTC-5, EDT is UTC-4
  // Check if we're in daylight saving time (roughly March-November)
  const month = now.getUTCMonth();
  const isDST = month >= 2 && month <= 10; // Approximate DST period
  const estOffset = isDST ? -4 : -5; // EDT or EST

  const estTime = new Date(utcTime + estOffset * 3600000);
  return estTime;
}

// ---- Helpers
const safeKey = (s = "") =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const getWeekKey = (date) => {
  const monday = startOfWeek(date, { weekStartsOn: 1 });
  const weekNum = Number(format(monday, "I"));
  const year = Number(format(monday, "yyyy"));
  return `${year}-W${String(weekNum).padStart(2, "0")}`;
};

async function main() {
  // Use EST time instead of UTC
  const today = getESTTime();
  console.log("Current time in EST:", today.toISOString());
  console.log("Current day in EST:", format(today, "EEEE, MMMM d, yyyy"));

  const monday = startOfWeek(today, { weekStartsOn: 1 });
  const weekKey = getWeekKey(today);

  // Enhanced debugging for household ID
  const rawHouseholdId = process.env.HOUSEHOLD_ID || "demo-household";
  console.log("Raw HOUSEHOLD_ID from env:", JSON.stringify(rawHouseholdId));

  const householdId = rawHouseholdId
    .replace(/^['"`]|['"`]$/g, "") // Remove surrounding quotes
    .trim(); // Remove whitespace

  console.log("Cleaned HOUSEHOLD_ID:", JSON.stringify(householdId));

  const householdRef = db.doc(`households/${householdId}`);
  const householdSnap = await householdRef.get();

  if (!householdSnap.exists) {
    console.log(`Household ${householdId} does not exist.`);
    return;
  }

  const { housemates = [], chores = [], emails = [] } = householdSnap.data();

  const weekRef = db.doc(`households/${householdId}/weeks/${weekKey}`);
  const weekSnap = await weekRef.get();
  const weekData = weekSnap.exists ? weekSnap.data() : {};
  const choreEntries = weekData.chores || {};

  // Build pending chores per day
  const pendingByDay = Array.from({ length: 7 }, () => []);
  for (const chore of chores) {
    const key = safeKey(chore);
    const days = choreEntries[key] || {};
    for (let i = 0; i < 7; i++) {
      const entry = days[i] || null;
      if (!entry || !entry.doneBy) pendingByDay[i].push(chore);
    }
  }

  // Determine today's index using EST time (0=Monday)
  const jsDay = today.getDay(); // 0=Sunday
  const dayIndex = (jsDay + 6) % 7;
  const todaysChores = pendingByDay[dayIndex];

  console.log(
    `Today is ${format(today, "EEEE")} (day index: ${dayIndex}) in EST`
  );

  if (!todaysChores.length) {
    console.log("No chores pending for today.");
    return;
  }

  const assignee = housemates[dayIndex] || `Person ${dayIndex + 1}`;
  const toEmail = emails[dayIndex] || process.env.DEFAULT_NOTIFY_EMAIL;

  if (!toEmail) {
    console.log("No email configured for today, skipping.");
    return;
  }

  const list = todaysChores.map((c) => `• ${c}`).join("\n");
  const subj = `Chore Reminder — ${format(today, "EEE, MMM d")} (${assignee})`;
  const text = `Hi ${assignee},\n\nThe following chores are still pending today:\n\n${list}\n\nPlease upload a photo and mark them done in the app.\n\nHousehold: ${householdId}\nWeek: ${weekKey}\n`;

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: toEmail,
    subject: subj,
    text,
  });

  console.log(
    `Sent reminder to ${toEmail} for today (${format(today, "EEE, MMM d")}).`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
