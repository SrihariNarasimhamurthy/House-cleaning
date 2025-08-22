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

  const month = now.getUTCMonth();
  const isDST = month >= 2 && month <= 10;
  const estOffset = isDST ? -4 : -5;

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

// ---- Smart Reminder Logic
function getSmartReminderTimes(currentHour) {
  // Strategic reminder times based on psychology and daily patterns
  const reminderSchedule = [
    {
      hour: 9,
      type: "morning",
      message: "Good morning! Time to tackle today's chores.",
    },
    {
      hour: 12,
      type: "lunch",
      message: "Lunch break reminder - don't forget your chores!",
    },
    {
      hour: 15,
      type: "afternoon",
      message: "Afternoon check-in - chores still pending.",
    },
    {
      hour: 18,
      type: "evening",
      message: "Evening reminder - please complete pending chores.",
    },
    {
      hour: 21,
      type: "final",
      message: "Final reminder - please finish up today's chores.",
    },
  ];

  return reminderSchedule.find((r) => r.hour === currentHour);
}

function getUrgencyLevel(currentHour, choresTotalCount) {
  if (currentHour >= 21)
    return { level: "high", emoji: "🚨", urgency: "URGENT" };
  if (currentHour >= 18)
    return { level: "medium", emoji: "⏰", urgency: "Important" };
  if (currentHour >= 15)
    return { level: "medium", emoji: "📝", urgency: "Reminder" };
  if (currentHour >= 12)
    return { level: "low", emoji: "☀️", urgency: "Friendly Reminder" };
  return { level: "low", emoji: "🌅", urgency: "Morning Reminder" };
}

async function main() {
  const today = getESTTime();
  const currentHour = today.getHours();

  console.log("Current time in EST:", format(today, "yyyy-MM-dd HH:mm:ss"));
  console.log("Current hour:", currentHour);

  // Check if this is a strategic reminder time
  const reminderTime = getSmartReminderTimes(currentHour);

  if (!reminderTime) {
    console.log(
      `Not a strategic reminder hour (${currentHour}). Strategic hours: 9, 12, 15, 18, 21`
    );
    return;
  }

  const monday = startOfWeek(today, { weekStartsOn: 1 });
  const weekKey = getWeekKey(today);

  const rawHouseholdId = process.env.HOUSEHOLD_ID || "demo-household";
  const householdId = rawHouseholdId.replace(/^['"`]|['"`]$/g, "").trim();

  console.log("Processing household:", JSON.stringify(householdId));

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
    console.log("No chores pending for today. All done! 🎉");
    return;
  }

  // Check if we've already sent THIS SPECIFIC reminder type today
  const todayDateKey = format(today, "yyyy-MM-dd");
  const reminderKey = `${todayDateKey}-${reminderTime.type}`;
  const lastReminderRef = db.doc(
    `households/${householdId}/metadata/reminders/${reminderKey}`
  );
  const lastReminderSnap = await lastReminderRef.get();

  if (lastReminderSnap.exists) {
    console.log(`${reminderTime.type} reminder already sent today. Skipping.`);
    return;
  }

  const assignee = housemates[dayIndex] || `Person ${dayIndex + 1}`;
  const toEmail = emails[dayIndex] || process.env.DEFAULT_NOTIFY_EMAIL;

  if (!toEmail) {
    console.log("No email configured for today, skipping.");
    return;
  }

  // Get urgency level and customize message
  const urgency = getUrgencyLevel(currentHour, todaysChores.length);

  const list = todaysChores.map((c) => `• ${c}`).join("\n");
  const subj = `${urgency.emoji} ${urgency.urgency}: Chores for ${format(
    today,
    "EEE, MMM d"
  )} (${assignee})`;

  let customMessage = reminderTime.message;
  if (currentHour >= 21) {
    customMessage += " The day is almost over!";
  } else if (currentHour >= 18) {
    customMessage += " Evening is a great time to wrap up tasks.";
  }

  const text = `Hi ${assignee},\n\n${customMessage}\n\nPending chores (${
    todaysChores.length
  }):\n\n${list}\n\nPlease upload a photo and mark them done in the app.\n\n---\nHousehold: ${householdId}\nWeek: ${weekKey}\nTime: ${format(
    today,
    "h:mm a"
  )} EST\n`;

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: toEmail,
    subject: subj,
    text,
  });

  // Mark this specific reminder type as sent
  await lastReminderRef.set({
    timestamp: admin.firestore.Timestamp.fromDate(today),
    reminderType: reminderTime.type,
    dayIndex,
    choresCount: todaysChores.length,
    hour: currentHour,
    assignee: assignee,
  });

  console.log(
    `✅ Sent ${reminderTime.type} reminder to ${toEmail} at ${format(
      today,
      "h:mm a"
    )} EST`
  );
  console.log(`   ${todaysChores.length} chores pending for ${assignee}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
