if (Notification.permission !== "granted") {
  Notification.requestPermission().then(p => {
    console.log("Notification permission:", p);
  });
}
// ===============================
// SERVICE WORKER REGISTRATION
// ===============================
async function registerSW() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const reg = await navigator.serviceWorker.register('/service-worker.js');
    console.log("SW registered:", reg);

    // Wait for activation
    await navigator.serviceWorker.ready;

    // Send meds to SW immediately
    sendMedsToSW();

  } catch (err) {
    console.error("SW register failed:", err);
  }
}

registerSW();

// ===============================
// DOM & CONFIG
// ===============================
const medList = document.getElementById("medList");
const form = document.getElementById("medForm");
const reportDetails = document.getElementById("reportDetails");
const BASE_URL = "http://localhost:8080/api/medications";
const USER_ID = 1;
let chartInstance = null;



// ===============================
// Helper: Send meds to SW
// ===============================
async function sendMedsToSW(medsArg) {
  try {
    const res = await fetch(`${BASE_URL}/user/${USER_ID}`);
    const meds = medsArg || await res.json();

    const payload = meds.map(m => ({
            id: m.id,
            name: m.name,
            dosage: m.dosage,
            times: Array.isArray(m.times)
            ? m.times
            : m.times.split(",").map(s => s.trim()),
            startDate: m.startDate,
            endDate: m.endDate
}));


    const reg = await navigator.serviceWorker.ready;
    if (reg.active) {
      reg.active.postMessage({ action: "saveMeds", meds: payload });
      console.log("Main: sent meds to SW:", payload);
    }
  } catch (err) {
    console.error("sendMedsToSW error:", err);
  }
}

// ===============================
// Load meds and render
// ===============================
async function loadMed() {
  try {
    const res = await fetch(`${BASE_URL}/user/${USER_ID}`);
    const meds = await res.json();
    medList.innerHTML = "";
    meds.forEach(displayMed);
    await sendMedsToSW(meds);
  } catch (err) {
    console.error("loadMed error:", err);
  }
}

// ===============================
// Display med row
// ===============================
function displayMed(med) {
  const today = new Date();
  const start = new Date(med.startDate || 0);
  const end = new Date(med.endDate || 8640000000000000);

  if (today >= start && today <= end) {
    const timesArr = (typeof med.times === "string") ? med.times.split(",").map(t => t.trim()) : (med.times || []);

    timesArr.forEach(timeStr => {
      if (!timeStr) return;
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${timeStr}</td><td>${med.name}</td><td>${med.dosage}</td>`;
      const actionTd = document.createElement("td");

      const delBtn = document.createElement("button");
      delBtn.textContent = "🗑 Delete";
      delBtn.className = "delete-btn";
      delBtn.onclick = async () => {
        if (!confirm(`Delete ${med.name} at ${timeStr}?`)) return;
        await fetch(`${BASE_URL}/${med.id}`, { method: "DELETE" });
        tr.remove();
        await loadReport();
        await sendMedsToSW();
      };
      actionTd.appendChild(delBtn);

      const takenBtn = document.createElement("button");
      takenBtn.textContent = "✔ Taken";
      takenBtn.className = "delete-btn";
      takenBtn.style.marginLeft = "6px";
      takenBtn.onclick = async () => {
        try {
          await fetch(`${BASE_URL}/record/${med.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taken: true })
          });
          await loadMed();
          await loadReport();
        } catch (err) {
          console.error("manual Taken failed:", err);
        }
      };
      actionTd.appendChild(takenBtn);

      tr.appendChild(actionTd);
      medList.appendChild(tr);
    });
  }
}

// ===============================
// Load report & update chart
// ===============================
async function loadReport() {
  try {
    const res = await fetch(`${BASE_URL}/weekly/${USER_ID}`);
    const report = await res.json();

    reportDetails.innerHTML = `
      <p><strong>Total:</strong> ${report.totalDoses}</p>
      <p><strong>Taken:</strong> ${report.takenDoses}</p>
      <p><strong>Missed:</strong> ${report.missedDoses}</p>
      <p><strong>Adherence:</strong> ${report.adherencePercent}%</p>
    `;

    const canvas = document.getElementById("adherenceChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    if (chartInstance) {
      chartInstance.data.datasets[0].data = [report.takenDoses, report.missedDoses];
      chartInstance.update();
    } else {
      chartInstance = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: ["Taken", "Missed"],
          datasets: [{ data: [report.takenDoses, report.missedDoses], backgroundColor: ["#4CAF50", "#FF5252"] }]
        },
        options: { responsive: false, maintainAspectRatio: false }
      });
    }
  } catch (err) {
    console.error("loadReport error:", err);
  }
}

// ===============================
// SW Messages Receiver
// ===============================
navigator.serviceWorker.addEventListener("message", async (event) => {
  try {
    const data = event.data;
    if (!data) return;
    console.log("Main: message from SW:", data);

    if (data.action === "medTaken" && data.medId) {
      try {
        await fetch(`${BASE_URL}/record/${data.medId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taken: true })
        });
      } catch (err) {
        console.error("Main: backend record call failed:", err);
      }
      await loadMed();
      await loadReport();
      return;
    }

    if (data.type === "refreshAdherence") {
      await loadMed();
      await loadReport();
      return;
    }
  } catch (err) {
    console.error("Main message handler error:", err);
  }
});

// ===============================
// Form submission
// ===============================
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("name").value;
  const dosage = document.getElementById("dosage").value;
  const timesInput = document.getElementById("time").value;
  const timesArray = timesInput.split(",").map(s => s.trim()).filter(Boolean);

  const body = {
    name, dosage,
    times: timesArray.join(","),
    startDate: document.getElementById("startDate").value,
    endDate: document.getElementById("endDate").value,
    user: { id: USER_ID }
  };

  try {
    const res = await fetch(`${BASE_URL}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error("failed to add med");
    form.reset();
    await loadMed();
    await loadReport();
  } catch (err) {
    console.error("Add med failed:", err);
    alert("Add med failed — check console");
  }
});

// ===============================
// Init
// ===============================
(async function init() {
  await loadMed();
  await loadReport();
  // keep SW in sync
  setInterval(sendMedsToSW, 60 * 1000);
})();


