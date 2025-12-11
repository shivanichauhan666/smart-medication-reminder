// ===============================
// SMART MEDICINE SERVICE WORKER (full, robust)
// - Supports: exact & 10-min-before notifications
// - Prevents duplicates, supports multi-day, snooze, taken
// - Tries to mark backend on "taken" and notifies clients
// ===============================

/*
  IMPORTANT:
  - Backend record endpoint: POST http://localhost:8080/api/medications/record/{id}
    Body: { "taken": true }
  - The SW expects meds posted by the page via postMessage { action: "saveMeds", meds: [...] }
  - Each med object should include:
      id, name, dosage, times: ["HH:MM", ...], startDate: "yyyy-MM-dd", endDate: "yyyy-MM-dd"
*/

const BACKEND_RECORD_URL_BASE = "http://localhost:8080/api/medications/record";

let meds = []; // latest meds array from page
let shownNotifications = {}; // keys: `${medId}|${dateStr}|${timeStr}|${type}` (type: before|exact|snooze)
let snoozes = {}; // map medId -> { at: timestamp (ms), originalTime: "HH:MM" }
let lastResetDay = (new Date()).getDate();

// safe windows
const EXACT_WINDOW_MS = 3 * 1000;  // ±15s
const BEFORE_WINDOW_MAX_MS = 10 * 60 * 1000; // 10 minutes
const BEFORE_WINDOW_MIN_MS = 10 * 60 * 1000-5000;  // 9 minutes

// check interval
const CHECK_INTERVAL_MS = 1 * 1000; // every 5s

self.addEventListener("install", evt => {
  self.skipWaiting();
});

self.addEventListener("activate", evt => {
  evt.waitUntil(self.clients.claim());
  setInterval(() => {}, 5000);
});

// ------------------------------
// Helpers
// ------------------------------
function formatDateYYYYMMDD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function keyFor(medId, dateStr, timeStr, type) {
  return `${medId}|${dateStr}|${timeStr}|${type}`;
}
function isWithinBeforeWindow(diffMs) {
  // diffMs positive when medTime is in future
  return diffMs <= BEFORE_WINDOW_MAX_MS && diffMs > BEFORE_WINDOW_MIN_MS;
}
function isWithinExactWindow(diffMs) {
  return diffMs <=0 && diffMs > -EXACT_WINDOW_MS;
}

function parseDateISO(dateStr) {
  // expects "yyyy-MM-dd"
  const parts = (dateStr || "").split("-");
  if (parts.length !== 3) return null;
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

// ------------------------------
// Show notification wrapper
// ------------------------------
function showNotificationFor(med, timeStr, type) {
  // type: "before" | "exact" | "snooze"
  try {
    const now = new Date();
    const dateStr = formatDateYYYYMMDD(now);
    const k = keyFor(med.id, dateStr, timeStr || "snoozed", type);
    if (shownNotifications[k]) return; // already shown
    shownNotifications[k] = Date.now();

    const title = (type === "exact") ? `Time to take ${med.name}` :
                  (type === "before") ? `Reminder: ${med.name} in 10 minutes` :
                  `Reminder (snoozed): ${med.name}`;
    const body = `${med.name} — ${med.dosage}${timeStr ? " at " + timeStr : ""}`;

    const opts = {
      body,
      icon: "/icon.png",
      badge: "/icon.png",
      data: { medId: med.id, timeStr, type },
      actions: [
        { action: "taken", title: "✔ Taken" },
        { action: "snooze", title: "⏳ Snooze 5 min" }
      ],
      renotify: false
    };

    self.registration.showNotification(title, opts);
  } catch (err) {
    console.error("showNotificationFor error:", err);
  }
}

// ------------------------------
// Schedule / Check loop
// ------------------------------
function resetDailyTrackingIfNeeded() {
  const now = new Date();
  const day = now.getDate();
  if (day !== lastResetDay) {
    shownNotifications = {};
    snoozes = {};
    lastResetDay = day;
    console.log("SW: daily tracking reset");
  }
}

function shouldMedBeActiveToday(med, todayDate) {
  // med.startDate and med.endDate expected "yyyy-MM-dd"
  if (!med.startDate && !med.endDate) return true;
  const start = parseDateISO(med.startDate);
  const end = parseDateISO(med.endDate);
  if (start && todayDate < start) return false;
  if (end && todayDate > end) return false;
  return true;
}

async function markTakenBackend(medId) {
  // Try to mark backend; don't throw up if fails
  try {
    const url = `${BACKEND_RECORD_URL_BASE}/${medId}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taken: true })
    });
    if (!res.ok) {
      console.warn("SW: backend record returned not ok", res.status);
    } else {
      console.log("SW: backend record success for med", medId);
    }
  } catch (err) {
    console.warn("SW: backend record failed", err);
  }
}

async function notifyClientsMedTaken(medId) {
  try {
    const clientsArr = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of clientsArr) {
      try {
        c.postMessage({ action: "medTaken", medId });
      } catch (err) {
        console.warn("SW: postMessage failed", err);
      }
    }
  } catch (err) {
    console.warn("SW: notifyClientsMedTaken fail", err);
  }
}

// Main check
function checkMedicines() {
  try {
    resetDailyTrackingIfNeeded();
    if (!meds || meds.length === 0) return;
    const now = new Date();
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // First, handle any snoozes
    for (const [medId, snoozeObj] of Object.entries(snoozes)) {
      if (!snoozeObj || !snoozeObj.at) continue;
      const diffMs = snoozeObj.at - Date.now();
      if (diffMs <= 0) {
        // find med in meds array
        const med = meds.find(m => String(m.id) === String(medId));
        if (med) {
          showNotificationFor(med, snoozeObj.originalTime || "snoozed", "snooze");
        }
        // cleanup one-shot snooze (do not re-show automatically)
        delete snoozes[medId];
      }
    }

    meds.forEach(med => {
      try {
        if (!shouldMedBeActiveToday(med, todayDate)) return;

        const times = Array.isArray(med.times) ? med.times : (typeof med.times === "string" ? med.times.split(",").map(s=>s.trim()) : []);
        if (!times || times.length === 0) return;

        times.forEach(timeStr => {
          try {
            const parts = timeStr.split(":").map(Number);
            if (parts.length < 2) return;
            const hh = parts[0], mm = parts[1];
            if (isNaN(hh) || isNaN(mm)) return;

            // Build medTime for today at hh:mm
            const medTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0);

            // If medTime already passed today, skip (we only notify for today's times here)
            // (If you want next-day behavior, that can be added)
            // Calculate difference in ms
            const diffMs = medTime - now;

            // 10-minute before: precise window
            // Calculate difference in minutes (rounded)
            const diffMinutes = Math.round((medTime - now) / 60000); // 1 min = 60000 ms

            // Fire exactly 10 minutes before
            if (diffMs >= 10*60*1000 && diffMs < 10*60*1000 + 1000) { // ±1s
             const k = keyFor(med.id, formatDateYYYYMMDD(now), timeStr, "before");
             if (!shownNotifications[k]) {
             showNotificationFor(med, timeStr, "before");
             }
            }

            // Exact time: safe ±15s
            if (isWithinExactWindow(diffMs)) {
              const k2 = keyFor(med.id, formatDateYYYYMMDD(now), timeStr, "exact");
              if (!shownNotifications[k2]) {
                showNotificationFor(med, timeStr, "exact");
              }
            }
          } catch (innerErr) {
            console.error("SW: checkMedicines inner loop error", innerErr);
          }
        });
      } catch (errMed) {
        console.error("SW: checkMedicines med loop error", errMed);
      }
    });
  } catch (err) {
    console.error("SW: checkMedicines error", err);
  }
}

// start periodic checks
setInterval(checkMedicines, CHECK_INTERVAL_MS);

// ------------------------------
// Message listener (receive meds from page)
// ------------------------------
self.addEventListener("message", event => {
  try {
    const data = event.data;
    if (!data) return;
    if (data.action === "saveMeds") {
      // normalize meds (times -> array)
      meds = (data.meds || []).map(m => {
        const clone = Object.assign({}, m);
        if (!Array.isArray(clone.times) && typeof clone.times === "string") {
          clone.times = clone.times.split(",").map(s => s.trim()).filter(Boolean);
        }
        return clone;
      });
      // reset shown notifications so new schedule gets fresh notifications
      shownNotifications = {};
      console.log("SW: saveMeds received and normalized:", meds);
      // run a check immediately (don't wait interval)
      checkMedicines();
    }
  } catch (err) {
    console.error("SW message handler error:", err);
  }
});

// ------------------------------
// Notification click handler (snooze / taken / default)
// ------------------------------
self.addEventListener("notificationclick", event => {
  try {
    const data = event.notification.data || {};
    const medId = data.medId;
    const timeStr = data.timeStr;
    const type = data.type;

    event.notification.close();

    // SNOOZE: schedule a snooze for 5 minutes from now (one-shot)
    if (event.action === "snooze") {
      try {
        const snoozeAt = Date.now() + 5 * 60 * 1000;
        snoozes[String(medId)] = { at: snoozeAt, originalTime: timeStr || null };
        // Optionally immediately notify clients of snooze (not required)
      } catch (err) {
        console.error("SW: snooze error", err);
      }
      return;
    }

    // TAKEN: try to mark backend and inform clients
    if (event.action === "taken") {
      event.waitUntil((async () => {
        try {
          // 1) call backend to record taken
          if (medId !== undefined && medId !== null) {
            await markTakenBackend(medId);
          }
        } catch (err) {
          console.warn("SW: markTakenBackend failed", err);
        }

        try {
          // 2) inform open clients so UI reloads and chart updates
          await notifyClientsMedTaken(medId);
        } catch (err2) {
          console.warn("SW: notify clients failed", err2);
        }

        // 3) mark notifications for that med/time as shown so we don't re-show
        try {
          const today = new Date();
          const dateStr = formatDateYYYYMMDD(today);
          if (timeStr) {
            // mark both before/exact as shown
            shownNotifications[keyFor(medId, dateStr, timeStr, "before")] = Date.now();
            shownNotifications[keyFor(medId, dateStr, timeStr, "exact")] = Date.now();
          } else {
            // snoozed case: mark snooze entry removed
            delete snoozes[String(medId)];
          }
        } catch (err3) {
          console.warn("SW: marking shownNotifications after taken failed", err3);
        }
      })());
      return;
    }

    // DEFAULT click (open or focus the app)
    event.waitUntil((async () => {
      const clientsArr = await clients.matchAll({ type: "window", includeUncontrolled: true });
      let client = clientsArr.find(c => c.visibilityState === "visible") || clientsArr[0];
      if (!client) {
        return clients.openWindow("/");
      }
      if (client.focus) client.focus();
      return client;
    })());
  } catch (err) {
    console.error("SW notificationclick error:", err);
  }
});

// ------------------------------
// Optional: listen for push (not used now) or sync events in future
// ------------------------------
self.addEventListener("push", event => {
  // you could implement push handling here if you want server-side pushes
  console.log("SW: push event (unused):", event);
});



