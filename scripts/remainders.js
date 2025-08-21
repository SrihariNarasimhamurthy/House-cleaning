const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const path = require("path");
const { startOfWeek, addDays, format } = require("date-fns");
require("dotenv").config();

let serviceAccount;

// Check if running in GitHub Actions (FIREBASE_SERVICE_ACCOUNT secret) or local
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  // GitHub Actions: parse JSON from secret
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
  // Local: require JSON file
  serviceAccount = require(path.join(
    __dirname,
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  ));
} else {
  console.error("Firebase service account not found!");
  process.exit(1);
}

// Initialize Firebase
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// Mail setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

// Helpers
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
  const today = new Date();
  const monday = startOfWeek(today, { weekStartsOn: 1 });
  const weekKey = getWeekKey(today);

  const householdId = process.env.HOUSEHOLD_ID || "demo-household";
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

  const pendingByDay = Array.from({ length: 7 }, () => []);
  for (const chore of chores) {
    const key = safeKey(chore);
    const days = choreEntries[key] || {};
    for (let i = 0; i < 7; i++) {
      const entry = days[i] || null;
      if (!entry || !entry.doneBy) pendingByDay[i].push(chore);
    }
  }

  const jsDay = today.getDay();
  const dayIndex = (jsDay + 6) % 7;

  const todaysChores = pendingByDay[dayIndex];
  if (!todaysChores.length) {
    console.log(`No chores pending for today.`);
    return;
  }

  const assignee = housemates[dayIndex] || `Person ${dayIndex + 1}`;
  const toEmail = emails[dayIndex] || process.env.DEFAULT_NOTIFY_EMAIL;
  if (!toEmail) {
    console.log(`No email configured for today, skipping.`);
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
  console.log(`Sent reminder to ${toEmail} for today.`);
}

console.log("HOUSEHOLD_ID env:", process.env.HOUSEHOLD_ID);
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
