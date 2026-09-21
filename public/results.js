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

      // Keep showing "Converting…" until the bar has visibly reached 100%
      const state = file.state === "done" && shown[index] < 99.5 ? "converting" : file.state;
      row.dataset.state = state;
      row.querySelector("[data-progress-fill]").style.width = `${shown[index]}%`;
      row.querySelector("[data-progress-label]").textContent =
        file.state === "failed" ? "Failed" : `${percent}%`;
      row.querySelector("[data-progress-state]").textContent = STATE_LABELS[state];
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

// --- results gallery: rows/cards, preview, selection, delete ---------------

const VIEW_KEY = "convertx_results_view";

const resultsRoot = () => document.querySelector("[data-results]");

const setView = (view) => {
  const root = resultsRoot();
  if (!root) return;
  for (const container of root.querySelectorAll("[data-view]")) {
    container.hidden = container.dataset.view !== view;
  }
  for (const button of root.querySelectorAll("[data-view-button]")) {
    const active = button.dataset.viewButton === view;
    button.classList.toggle("bg-cta", active);
    button.classList.toggle("text-cta-ink", active);
  }
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    // private windows can refuse storage; the view still works for this visit
  }
};

// The same file appears in both views, so selecting it in one selects it in the other
const itemsNamed = (name) =>
  [...document.querySelectorAll("[data-result-item]")].filter((item) => item.dataset.name === name);

const selectedNames = () => {
  const names = new Set();
  for (const box of document.querySelectorAll("[data-select]:checked")) {
    names.add(box.closest("[data-result-item]").dataset.name);
  }
  return [...names];
};

const refreshSelection = () => {
  const root = resultsRoot();
  if (!root) return;
  const names = selectedNames();
  const bar = root.querySelector("[data-selection-bar]");
  const count = root.querySelector("[data-selection-count]");
  if (bar) bar.hidden = names.length === 0;
  if (count) count.textContent = `${names.length} selected`;
};

const downloadUrls = (urls) => {
  // Space the downloads out so the browser does not block them as a popup burst
  urls.forEach((url, index) => {
    setTimeout(() => {
      const link = document.createElement("a");
      link.href = url;
      link.download = "";
      document.body.appendChild(link);
      link.click();
      link.remove();
    }, index * 300);
  });
};

const openPreview = (name, url, isImage) => {
  if (!isImage) {
    window.open(url, "_blank", "noopener");
    return;
  }
  const modal = document.querySelector("[data-preview-modal]");
  if (!modal) return;
  modal.querySelector("[data-preview-name]").textContent = name;
  modal.querySelector("[data-preview-image]").src = url;
  modal.hidden = false;
};

const closePreview = () => {
  const modal = document.querySelector("[data-preview-modal]");
  if (!modal) return;
  modal.hidden = true;
  modal.querySelector("[data-preview-image]").src = "";
};

const deleteResult = async (name) => {
  const jobPath = window.location.pathname.split("/").pop();
  try {
    const res = await fetch(`${webroot}/results/${jobPath}/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: name }),
    });
    if (!res.ok) return;
    for (const item of itemsNamed(name)) {
      item.remove();
    }
    refreshSelection();
  } catch (err) {
    console.log(err);
  }
};

// One delegated listener keeps working after the page swaps in the finished results
document.addEventListener("click", (event) => {
  const viewButton = event.target.closest?.("[data-view-button]");
  if (viewButton) {
    setView(viewButton.dataset.viewButton);
    return;
  }

  const preview = event.target.closest?.("[data-preview]");
  if (preview) {
    const item = preview.closest("[data-result-item]");
    openPreview(
      item?.dataset.name ?? "",
      preview.dataset.preview,
      preview.dataset.isImage === "true",
    );
    return;
  }

  if (event.target.closest?.("[data-preview-close]")) {
    closePreview();
    return;
  }

  const modal = document.querySelector("[data-preview-modal]");
  if (modal && !modal.hidden && event.target === modal) {
    closePreview();
    return;
  }

  const del = event.target.closest?.("[data-delete]");
  if (del) {
    const item = del.closest("[data-result-item]");
    if (item) deleteResult(item.dataset.name);
    return;
  }

  if (event.target.closest?.("[data-download-selected]")) {
    const urls = selectedNames().map((name) => itemsNamed(name)[0]?.dataset.download);
    downloadUrls(urls.filter(Boolean));
    return;
  }

  if (event.target.closest?.("[data-clear-selection]")) {
    for (const box of document.querySelectorAll("[data-select]")) {
      box.checked = false;
    }
    refreshSelection();
  }
});

document.addEventListener("change", (event) => {
  if (event.target.matches?.("[data-select-all]")) {
    for (const box of document.querySelectorAll("[data-select]")) {
      box.checked = event.target.checked;
    }
    refreshSelection();
    return;
  }

  if (event.target.matches?.("[data-select]")) {
    const item = event.target.closest("[data-result-item]");
    // Mirror the tick onto the same file in the other view
    for (const twin of itemsNamed(item.dataset.name)) {
      const box = twin.querySelector("[data-select]");
      if (box) box.checked = event.target.checked;
    }
    refreshSelection();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closePreview();
  }
});

const restoreView = () => {
  let saved = "rows";
  try {
    saved = localStorage.getItem(VIEW_KEY) || "rows";
  } catch {
    // storage unavailable; fall back to the default view
  }
  if (resultsRoot()) {
    setView(saved);
  }
};

restoreView();
// The finished results replace the page content, so restore the view again then
new MutationObserver(restoreView).observe(main, { childList: true });

window.downloadAll = function () {
  // One entry per file, even though each file appears in both views
  const seen = new Set();
  const urls = [];
  for (const item of document.querySelectorAll("[data-result-item]")) {
    const { name, download } = item.dataset;
    if (download && !seen.has(name)) {
      seen.add(name);
      urls.push(download);
    }
  }
  downloadUrls(urls);
};
