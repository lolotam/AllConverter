const webroot = document.querySelector("meta[name='webroot']").content;
const jobId = window.location.pathname.split("/").pop();
const main = document.querySelector("main");

// Each file's bar moves smoothly between the 1-second status polls. Converters that
// report progress (ffmpeg) show their real percentage; the others follow a time-based
// estimate that stays below 100% until the server says the file is done.
const STATE_LABELS = {
  queued: "Queued",
  converting: "Converting…",
  done: "Done",
  failed: "Failed",
};
let status = null;
let polledAt = 0;
let finishing = false;
const shown = [];

const targetPercent = (file, now) => {
  if (file.state === "done" || file.state === "failed") return 100;
  if (file.state === "queued") return 0;
  if (file.percent !== null) return file.percent;
  const elapsed = file.elapsedMs + (now - polledAt);
  return 95 * (1 - Math.exp((-2.5 * elapsed) / file.estimateMs));
};

const render = () => {
  const rows = document.querySelectorAll("[data-progress-index]");
  if (status && rows.length > 0) {
    const now = Date.now();
    let total = 0;
    for (const row of rows) {
      const index = Number(row.dataset.progressIndex);
      const file = status.files[index];
      if (!file) continue;
      const target = targetPercent(file, now);
      // Ease towards the target so jumps (e.g. a finished file) still animate
      const current = shown[index] ?? 0;
      shown[index] =
        Math.abs(target - current) < 0.2 ? target : current + (target - current) * 0.12;
      const percent = Math.floor(shown[index]);
      total += shown[index];

      row.dataset.state = file.state;
      row.querySelector("[data-progress-fill]").style.width = `${shown[index]}%`;
      row.querySelector("[data-progress-label]").textContent =
        file.state === "failed" ? "Failed" : `${percent}%`;
      row.querySelector("[data-progress-state]").textContent = STATE_LABELS[file.state];
      row.querySelector("[data-progress-bar]").setAttribute("aria-valuenow", String(percent));
    }
    const overall = document.querySelector("[data-progress-overall]");
    if (overall) overall.textContent = `${Math.floor(total / rows.length)}%`;
  }
  if (!finishing || document.querySelector("[data-progress-index]")) {
    requestAnimationFrame(render);
  }
};

const showResults = () => {
  fetch(`${webroot}/progress/${jobId}`, { method: "POST" })
    .then((res) => res.text())
    .then((html) => {
      main.innerHTML = html;
    })
    .catch((err) => console.log(err));
};

const poll = async () => {
  try {
    const res = await fetch(`${webroot}/progress/${jobId}/status`);
    if (res.ok) {
      status = await res.json();
      polledAt = Date.now();
    }
  } catch (err) {
    console.log(err);
  }

  if (status?.complete) {
    // Let every bar reach 100% before swapping in the download table
    finishing = true;
    setTimeout(showResults, 900);
    return;
  }
  setTimeout(poll, 1000);
};

if (document.querySelector("[data-job-complete='false']")) {
  poll();
  requestAnimationFrame(render);
}

window.downloadAll = function () {
  // Get all download links
  const downloadLinks = document.querySelectorAll("tbody a[download]");

  // Trigger download for each link
  downloadLinks.forEach((link, index) => {
    // We add a delay for each download to prevent them from starting at the same time
    setTimeout(() => {
      const event = new MouseEvent("click");
      link.dispatchEvent(event);
    }, index * 300);
  });
};
