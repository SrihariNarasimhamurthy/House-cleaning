// CommonJS for Node.js
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const path = require("path");
const { startOfWeek, addDays, format } = require("date-fns");
require("dotenv").config();

// ---- Debug Environment Variables
console.log("🔧 Environment Variables Check:");
console.log("EMAIL_USER:", process.env.EMAIL_USER ? "✅ Set" : "❌ Missing");
console.log("EMAIL_PASS:", process.env.EMAIL_PASS ? "✅ Set" : "❌ Missing");
console.log(
  "HOUSEHOLD_ID:",
  process.env.HOUSEHOLD_ID ? "✅ Set" : "❌ Missing"
);
console.log(
  "DEFAULT_NOTIFY_EMAIL:",
  process.env.DEFAULT_NOTIFY_EMAIL ? "✅ Set" : "❌ Missing"
);
console.log("");

// ---- Debug Environment Variables
console.log("🔧 Environment Variables Check:");
console.log("EMAIL_USER:", process.env.EMAIL_USER ? "✅ Set" : "❌ Missing");
console.log("EMAIL_PASS:", process.env.EMAIL_PASS ? "✅ Set" : "❌ Missing");
console.log(
  "HOUSEHOLD_ID:",
  process.env.HOUSEHOLD_ID ? "✅ Set" : "❌ Missing"
);
console.log(
  "DEFAULT_NOTIFY_EMAIL:",
  process.env.DEFAULT_NOTIFY_EMAIL ? "✅ Set" : "❌ Missing"
);
console.log("");

// ---- Debug Environment Variables
console.log("🔧 Environment Variables Check:");
console.log("EMAIL_USER:", process.env.EMAIL_USER ? "✅ Set" : "❌ Missing");
console.log("EMAIL_PASS:", process.env.EMAIL_PASS ? "✅ Set" : "❌ Missing");
console.log(
  "HOUSEHOLD_ID:",
  process.env.HOUSEHOLD_ID ? "✅ Set" : "❌ Missing"
);
console.log(
  "DEFAULT_NOTIFY_EMAIL:",
  process.env.DEFAULT_NOTIFY_EMAIL ? "✅ Set" : "❌ Missing"
);
console.log("");

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

// ---- Fixed Timezone Helper
function getESTTime() {
  const now = new Date();

  // Get current year for DST calculation
  const year = now.getFullYear();

  // DST starts second Sunday in March, ends first Sunday in November
  const dstStart = new Date(year, 2, 1); // March 1st
  dstStart.setDate(dstStart.getDate() + (7 - dstStart.getDay()) + 7); // Second Sunday

  const dstEnd = new Date(year, 10, 1); // November 1st
  dstEnd.setDate(dstEnd.getDate() + (7 - dstEnd.getDay())); // First Sunday

  const isDST = now >= dstStart && now < dstEnd;
  const offset = isDST ? -4 : -5; // EDT vs EST

  // Convert to EST/EDT
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
  const estTime = new Date(utcTime + offset * 3600000);

  console.log(`Current time: ${now.toISOString()}`);
  console.log(`DST active: ${isDST}, Offset: UTC${offset}`);
  console.log(`EST/EDT time: ${estTime.toISOString()}`);

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

// ---- Improved Smart Reminder Logic
function getSmartReminderTimes(currentHour) {
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
      hour: 20,
      type: "late_evening",
      message: "Late evening reminder - chores still need attention.",
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
    return { level: "medium", emoji: "📋", urgency: "Reminder" };
  if (currentHour >= 12)
    return { level: "low", emoji: "☀️", urgency: "Friendly Reminder" };
  return { level: "low", emoji: "🌅", urgency: "Morning Reminder" };
}

// ---- Main function with improved error handling
async function main() {
  const today = getESTTime();
  const currentHour = today.getHours();

  console.log("=".repeat(50));
  console.log("🏠 House Cleaning Reminder Script Started");
  console.log("=".repeat(50));
  console.log("Current time in EST/EDT:", format(today, "yyyy-MM-dd HH:mm:ss"));
  console.log("Current hour:", currentHour);

  // Check if this is a strategic reminder time
  const reminderTime = getSmartReminderTimes(currentHour);

  if (!reminderTime) {
    console.log(
      `❌ Not a strategic reminder hour (${currentHour}). Strategic hours: 9, 12, 15, 18, 20, 21`
    );
    return;
  }

  console.log(
    `✅ Strategic reminder time: ${reminderTime.type} (${currentHour}:00)`
  );

  const monday = startOfWeek(today, { weekStartsOn: 1 });
  const weekKey = getWeekKey(today);

  // Get all household IDs (you might want to target specific ones)
  const householdIds = process.env.HOUSEHOLD_IDS
    ? process.env.HOUSEHOLD_IDS.split(",").map((id) =>
        id.trim().replace(/^['"`]|['"`]$/g, "")
      )
    : [
        process.env.HOUSEHOLD_ID?.replace(/^['"`]|['"`]$/g, "")?.trim() ||
          "walnut-6",
      ];

  console.log("Processing households:", householdIds);

  for (const householdId of householdIds) {
    console.log(`\n📧 Processing household: ${householdId}`);

    try {
      await processHousehold(
        householdId,
        today,
        currentHour,
        weekKey,
        reminderTime
      );
    } catch (error) {
      console.error(`❌ Error processing household ${householdId}:`, error);
      // Continue with other households
    }
  }

  console.log("\n🎉 Reminder script completed");
}

async function processHousehold(
  householdId,
  today,
  currentHour,
  weekKey,
  reminderTime
) {
  const householdRef = db.doc(`households/${householdId}`);
  const householdSnap = await householdRef.get();

  if (!householdSnap.exists) {
    console.log(`   ⚠️  Household ${householdId} does not exist.`);
    return;
  }

  const householdData = householdSnap.data();
  const { housemates = [], chores = [], emails = [] } = householdData;

  console.log(`   👥 Housemates: ${housemates.length}`);
  console.log(`   🧹 Chores: ${chores.length}`);
  console.log(`   📧 Emails configured: ${emails.length}`);

  if (!chores.length) {
    console.log("   ⚠️  No chores configured for this household");
    return;
  }

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
      if (!entry || !entry.doneBy) {
        pendingByDay[i].push(chore);
      }
    }
  }

  // Determine today's index using EST time (0=Monday)
  const jsDay = today.getDay(); // 0=Sunday
  const dayIndex = (jsDay + 6) % 7; // Convert to Monday=0
  const todaysChores = pendingByDay[dayIndex];

  console.log(
    `   📅 Today is ${format(today, "EEEE")} (day index: ${dayIndex})`
  );
  console.log(`   🧹 Pending chores today: ${todaysChores.length}`);

  if (!todaysChores.length) {
    console.log("   ✅ No chores pending for today. All done! 🎉");
    return;
  }

  // Check if we've already sent THIS SPECIFIC reminder type today
  const todayDateKey = format(today, "yyyy-MM-dd");
  const reminderKey = `${todayDateKey}-${reminderTime.type}`;
  const lastReminderRef = db.doc(
    `households/${householdId}/reminders/${reminderKey}`
  );
  const lastReminderSnap = await lastReminderRef.get();

  if (lastReminderSnap.exists) {
    console.log(
      `   ⚠️  ${reminderTime.type} reminder already sent today. Skipping.`
    );
    return;
  }

  const assignee = housemates[dayIndex] || `Person ${dayIndex + 1}`;

  // Improved email selection with fallbacks
  let toEmail =
    emails[dayIndex] ||
    process.env.DEFAULT_NOTIFY_EMAIL ||
    process.env.EMAIL_USER;

  // If no email configured, try to find any email
  if (!toEmail && emails.length > 0) {
    toEmail = emails.find((email) => email && email.trim()) || emails[0];
  }

  if (!toEmail) {
    console.log("   ⚠️  No email configured for today, skipping.");
    return;
  }

  console.log(`   👤 Assignee: ${assignee}`);
  console.log(`   📧 Email: ${toEmail}`);

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

  const text = `Hi ${assignee},

${customMessage}

Pending chores (${todaysChores.length}):

${list}

Please upload a photo and mark them done in the app.

---
Household: ${householdId}
Week: ${weekKey}
Time: ${format(today, "h:mm a")} EST
`;

  try {
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
      emailSent: toEmail,
      chores: todaysChores,
    });

    console.log(`   ✅ Sent ${reminderTime.type} reminder to ${toEmail}`);
    console.log(`      ${todaysChores.length} chores pending for ${assignee}`);
  } catch (emailError) {
    console.error(`   ❌ Failed to send email:`, emailError);
    throw emailError;
  }
}

// ---- Error handling and execution
main().catch((e) => {
  console.error("💥 Script failed with error:", e);
  process.exit(1);
});
