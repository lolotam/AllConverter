/* global tus */ // provided by tus.min.js, loaded before this script
const webroot = document.querySelector("meta[name='webroot']").content;
const fileInput = document.querySelector('input[type="file"]');
const dropZone = document.getElementById("dropzone");
const convertButton = document.querySelector("input[type='submit']");
const fileNames = [];
let fileType;
let pendingFiles = 0;
let formatSelected = false;
// Plan limits rendered by the server; the server enforces them too
const maxFileSizeMb = Number(dropZone.dataset.maxFileSizeMb) || Infinity;
const batchLimit = Number(dropZone.dataset.batchLimit) || Infinity;
// Files are sent in chunks: Cloudflare rejects proxied requests over 100 MB and cuts
// one off after 100 seconds, so a whole file can never travel in a single request.
const chunkSize = (Number(dropZone.dataset.chunkSizeMb) || 16) * 1024 * 1024;
const currentJobId = dropZone.dataset.jobId || "";
const uploads = new Map();

const showRejectedFile = (file, reason) => {
  const row = document.createElement("tr");
  const name = document.createElement("td");
  name.textContent = file.name;
  const message = document.createElement("td");
  message.colSpan = 2;
  message.className = "text-amber-400";
  message.textContent = reason;
  const action = document.createElement("td");
  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.className = "text-accent-500 hover:underline";
  dismiss.textContent = "Dismiss";
  dismiss.addEventListener("click", () => row.remove());
  action.appendChild(dismiss);
  row.append(name, message, action);
  document.querySelector("#file-list").appendChild(row);
};

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");

  const files = e.dataTransfer.files;

  if (files.length === 0) {
    console.warn("No files dropped — likely a URL or unsupported source.");
    return;
  }

  for (const file of files) {
    console.log("Handling dropped file:", file.name);
    handleFile(file);
  }
});

// Extracted handleFile function for reusability in drag-and-drop and file input
function handleFile(file) {
  if (file.size > maxFileSizeMb * 1024 * 1024) {
    showRejectedFile(file, `Larger than your plan's ${maxFileSizeMb} MB limit`);
    return;
  }
  if (!fileNames.includes(file.name) && fileNames.length >= batchLimit) {
    showRejectedFile(file, `Your plan allows ${batchLimit} files at once`);
    return;
  }

  const fileList = document.querySelector("#file-list");

  const row = document.createElement("tr");
  const nameCell = document.createElement("td");
  nameCell.textContent = file.name;
  const progressCell = document.createElement("td");
  progressCell.innerHTML = `
    <div class="flex items-center gap-2">
      <progress max="100" value="0" class="inline-block h-2 grow appearance-none overflow-hidden rounded-full border-0 bg-neutral-700 bg-none text-accent-500 accent-accent-500 [&::-moz-progress-bar]:bg-accent-500 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:[background:none] [&[value]::-webkit-progress-value]:bg-accent-500 [&[value]::-webkit-progress-value]:transition-[inline-size]"></progress>
      <span data-upload-percent class="w-10 shrink-0 text-right text-xs tabular-nums text-neutral-400">0%</span>
    </div>
    <span data-upload-status class="text-xs text-neutral-400"></span>
  `;
  const sizeCell = document.createElement("td");
  sizeCell.textContent = `${(file.size / 1024).toFixed(2)} kB`;
  const actionCell = document.createElement("td");
  actionCell.className = "whitespace-nowrap";
  const pauseButton = document.createElement("button");
  pauseButton.type = "button";
  pauseButton.className = "text-accent-500 hover:underline";
  pauseButton.textContent = "Pause";
  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "ml-3 text-accent-500 hover:underline";
  removeButton.textContent = "Remove";
  removeButton.addEventListener("click", () => removeFile(file.name, row));
  actionCell.append(pauseButton, removeButton);
  row.append(nameCell, progressCell, sizeCell, actionCell);

  if (!fileType) {
    fileType = file.name.split(".").pop();
    fileInput.setAttribute("accept", `.${fileType}`);
    setTitle();

    fetch(`${webroot}/conversions`, {
      method: "POST",
      body: JSON.stringify({ fileType }),
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.text())
      .then((html) => {
        selectContainer.innerHTML = html;
        updateSearchBar();
      })
      .catch(console.error);
  }

  fileList.appendChild(row);
  file.htmlRow = row;
  fileNames.push(file.name);
  uploadFile(file, pauseButton);
}

function saveRecentTarget(target, converter, value) {
  try {
    let recent = JSON.parse(localStorage.getItem("convertx_recent_targets") || "[]");
    recent = recent.filter((r) => r.target !== target);
    recent.unshift({ target, converter, value });
    if (recent.length > 8) recent = recent.slice(0, 8);
    localStorage.setItem("convertx_recent_targets", JSON.stringify(recent));
    renderRecentPills();
  } catch (e) {}
}

function renderRecentPills() {
  const container = document.getElementById("quick-recent-pills");
  if (!container) return;
  try {
    const recent = JSON.parse(localStorage.getItem("convertx_recent_targets") || "[]");
    if (recent.length === 0) {
      container.classList.add("hidden");
      return;
    }
    container.classList.remove("hidden");
    const list = container.querySelector(".recent-pills-list");
    if (!list) return;
    list.innerHTML = "";
    recent.slice(0, 6).forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 text-xs font-bold hover:bg-accent-500 hover:text-neutral-950 transition-colors cursor-pointer";
      btn.textContent = item.target.toUpperCase();
      btn.onclick = () => {
        selectTarget(item.target, item.converter, item.value);
      };
      list.appendChild(btn);
    });
  } catch (e) {}
}

function selectTarget(targetName, converterName, fullValue) {
  const convertToInput = document.querySelector("input[name='convert_to_search']");
  const convertToElement = document.querySelector("select[name='convert_to']");
  if (!convertToElement || !convertToInput) return;

  const finalVal = fullValue || `${targetName},${converterName}`;
  convertToElement.value = finalVal;
  convertToInput.value = `${targetName.toUpperCase()}${converterName ? ` (${converterName})` : ""}`;
  formatSelected = true;
  updateQualityOption();
  if (pendingFiles === 0 && fileNames.length > 0) {
    convertButton.disabled = false;
  }
  saveRecentTarget(targetName, converterName, finalVal);
}

document.addEventListener("DOMContentLoaded", () => {
  renderRecentPills();
});

const selectContainer = document.querySelector("form .select_container");

const updateSearchBar = () => {
  const convertToInput = document.querySelector("input[name='convert_to_search']");
  const convertToPopup = document.querySelector(".convert_to_popup");
  const convertToGroupElements = document.querySelectorAll(".convert_to_group");
  const convertToGroups = {};
  const convertToElement = document.querySelector("select[name='convert_to']");

  // Populate recent formats group inside popup if present
  const recentGroup = document.getElementById("recent-formats-group");
  const recentList = document.getElementById("recent-formats-list");
  if (recentGroup && recentList) {
    try {
      const recent = JSON.parse(localStorage.getItem("convertx_recent_targets") || "[]");
      if (recent.length > 0) {
        recentList.innerHTML = "";
        recent.forEach((r) => {
          const btn = document.createElement("button");
          btn.tabIndex = 0;
          btn.type = "button";
          btn.className =
            "target rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-600 dark:text-blue-300 hover:bg-accent-500 hover:text-neutral-950 transition-colors";
          btn.dataset.value = r.value || `${r.target},${r.converter}`;
          btn.dataset.target = r.target;
          btn.dataset.converter = r.converter;
          btn.textContent = r.target.toUpperCase();
          btn.onmousedown = () => {
            selectTarget(r.target, r.converter, r.value);
            showMatching("");
          };
          recentList.appendChild(btn);
        });
        recentGroup.classList.remove("hidden");
        recentGroup.classList.add("flex");
      }
    } catch (e) {}
  }

  const showMatching = (search) => {
    for (const [targets, groupElement] of Object.values(convertToGroups)) {
      let matchingTargetsFound = 0;
      for (const target of targets) {
        if (target.dataset.target.includes(search)) {
          matchingTargetsFound++;
          target.classList.remove("hidden");
          target.classList.add("flex");
        } else {
          target.classList.add("hidden");
          target.classList.remove("flex");
        }
      }

      if (matchingTargetsFound === 0) {
        groupElement.classList.add("hidden");
        groupElement.classList.remove("flex");
      } else {
        groupElement.classList.remove("hidden");
        groupElement.classList.add("flex");
      }
    }
  };

  for (const groupElement of convertToGroupElements) {
    const groupName = groupElement.dataset.converter;

    const targetElements = groupElement.querySelectorAll(".target");
    const targets = Array.from(targetElements);

    for (const target of targets) {
      target.onmousedown = () => {
        selectTarget(target.dataset.target, target.dataset.converter, target.dataset.value);
        showMatching("");
      };
    }

    convertToGroups[groupName] = [targets, groupElement];
  }

  convertToInput.addEventListener("input", (e) => {
    showMatching(e.target.value.toLowerCase());
  });

  convertToInput.addEventListener("search", () => {
    // when the user clears the search bar using the 'x' button
    convertButton.disabled = true;
    formatSelected = false;
  });

  convertToInput.addEventListener("blur", (e) => {
    // Keep the popup open even when clicking on a target button
    // for a split second to allow the click to go through
    if (e?.relatedTarget?.classList?.contains("target")) {
      convertToPopup.classList.add("hidden");
      convertToPopup.classList.remove("flex");
      return;
    }

    convertToPopup.classList.add("hidden");
    convertToPopup.classList.remove("flex");
  });

  convertToInput.addEventListener("focus", () => {
    convertToPopup.classList.remove("hidden");
    convertToPopup.classList.add("flex");
  });
};

// Add a 'change' event listener to the file input element
fileInput.addEventListener("change", (e) => {
  const files = e.target.files;
  for (const file of files) {
    handleFile(file);
  }
});

const setTitle = () => {
  const title = document.querySelector("h1");
  title.textContent = `Convert ${fileType ? `.${fileType}` : ""}`;
};

const uploadFinished = () => {
  pendingFiles -= 1;
  if (pendingFiles === 0) {
    convertButton.disabled = !(formatSelected && fileNames.length > 0);
    convertButton.textContent = "Convert";
  }
};

const forgetFile = (name) => {
  const index = fileNames.indexOf(name);
  if (index !== -1) {
    fileNames.splice(index, 1);
  }
  uploads.delete(name);
  if (fileNames.length === 0) {
    fileType = null;
    fileInput.removeAttribute("accept");
    fileInput.value = "";
    convertButton.disabled = true;
    setTitle();
  }
};

// Removing a file that is still uploading also cancels it on the server
const removeFile = (name, row) => {
  const entry = uploads.get(name);
  row.remove();
  forgetFile(name);

  if (entry && !entry.done) {
    entry.upload.abort(true).catch((err) => console.log(err));
    uploadFinished();
    return;
  }

  fetch(`${webroot}/delete`, {
    method: "POST",
    body: JSON.stringify({ filename: name }),
    headers: { "Content-Type": "application/json" },
  }).catch((err) => console.log(err));
};

const uploadFile = (file, pauseButton) => {
  convertButton.disabled = true;
  convertButton.textContent = "Uploading...";
  pendingFiles += 1;

  const row = file.htmlRow;
  const bar = row.querySelector("progress");
  const percent = row.querySelector("[data-upload-percent]");
  const status = row.querySelector("[data-upload-status]");

  const upload = new tus.Upload(file, {
    endpoint: `${webroot}/files`,
    chunkSize,
    // Keep going through a dropped connection instead of losing the whole upload
    retryDelays: [0, 3000, 10000, 30000, 60000],
    metadata: { filename: file.name, filetype: file.type, jobId: currentJobId },
    storeFingerprintForResuming: true,
    removeFingerprintOnSuccess: true,
    onProgress: (sent, total) => {
      const value = total > 0 ? (100 * sent) / total : 0;
      bar.value = value;
      percent.textContent = `${Math.floor(value)}%`;
      status.textContent = "";
    },
    onSuccess: () => {
      const entry = uploads.get(file.name);
      if (entry) {
        entry.done = true;
      }
      bar.value = 100;
      percent.textContent = "100%";
      status.textContent = "Uploaded";
      pauseButton.remove();
      uploadFinished();
    },
    onShouldRetry: (error) => {
      const code = error?.originalResponse?.getStatus?.() ?? 0;
      // The server refused the file itself: retrying would fail the same way
      if ([400, 401, 403, 413, 429].includes(code)) {
        return false;
      }
      status.textContent = "Connection lost, retrying…";
      return true;
    },
    onError: (error) => {
      const message = error?.originalResponse?.getBody?.() || "Upload failed";
      row.remove();
      forgetFile(file.name);
      showRejectedFile(file, message);
      uploadFinished();
    },
  });

  uploads.set(file.name, { upload, done: false, paused: false });

  pauseButton.addEventListener("click", () => {
    const entry = uploads.get(file.name);
    if (!entry || entry.done) {
      return;
    }
    if (entry.paused) {
      entry.paused = false;
      pauseButton.textContent = "Pause";
      status.textContent = "Resuming…";
      entry.upload.start();
    } else {
      entry.paused = true;
      pauseButton.textContent = "Resume";
      status.textContent = "Paused";
      entry.upload.abort().catch((err) => console.log(err));
    }
  });

  // Choosing the same file again after a refresh or a lost connection continues
  // from the offset the server already holds instead of starting over
  upload
    .findPreviousUploads()
    .then((previous) => {
      const match = previous.find((item) => item.metadata?.jobId === currentJobId);
      if (match) {
        upload.resumeFromPreviousUpload(match);
        status.textContent = "Resuming previous upload…";
      }
      upload.start();
    })
    .catch(() => upload.start());
};

// Rasterising a document (PDF, PostScript) into images is the only case where the
// resolution matters, so the option only appears for those conversions.
const DOCUMENT_TYPES = ["pdf", "ps", "eps", "ai", "epdf"];
const IMAGE_TARGETS = ["jpg", "jpeg", "png", "webp", "tiff", "tif", "bmp", "avif", "heic"];

const updateQualityOption = () => {
  const option = document.getElementById("quality-option");
  if (!option) return;
  const target = (document.querySelector("select[name='convert_to']")?.value || "").split(",")[0];
  option.hidden = !(
    DOCUMENT_TYPES.includes((fileType || "").toLowerCase()) && IMAGE_TARGETS.includes(target)
  );
};

const formConvert = document.querySelector(`form[action='${webroot}/convert']`);

formConvert.addEventListener("submit", () => {
  const hiddenInput = document.querySelector("input[name='file_names']");
  hiddenInput.value = JSON.stringify(fileNames);
});

updateSearchBar();
