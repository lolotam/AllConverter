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
  row.innerHTML = `
    <td>${file.name}</td>
    <td><progress max="100" class="inline-block h-2 appearance-none overflow-hidden rounded-full border-0 bg-neutral-700 bg-none text-accent-500 accent-accent-500 [&::-moz-progress-bar]:bg-accent-500 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:[background:none] [&[value]::-webkit-progress-value]:bg-accent-500 [&[value]::-webkit-progress-value]:transition-[inline-size]"></progress></td>
    <td>${(file.size / 1024).toFixed(2)} kB</td>
    <td><button type="button" class="text-accent-500 hover:underline" onclick="deleteRow(this)">Remove</button></td>
  `;

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
  uploadFile(file);
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
      btn.className = "rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 text-xs font-bold hover:bg-accent-500 hover:text-neutral-950 transition-colors cursor-pointer";
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
          btn.className = "target rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-600 dark:text-blue-300 hover:bg-accent-500 hover:text-neutral-950 transition-colors";
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

// Add a onclick for the delete button
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const deleteRow = (target) => {
  const filename = target.parentElement.parentElement.children[0].textContent;
  const row = target.parentElement.parentElement;
  row.remove();

  // remove from fileNames
  const index = fileNames.indexOf(filename);
  fileNames.splice(index, 1);

  // reset fileInput
  fileInput.value = "";

  // if fileNames is empty, reset fileType
  if (fileNames.length === 0) {
    fileType = null;
    fileInput.removeAttribute("accept");
    convertButton.disabled = true;
    setTitle();
  }

  fetch(`${webroot}/delete`, {
    method: "POST",
    body: JSON.stringify({ filename: filename }),
    headers: {
      "Content-Type": "application/json",
    },
  }).catch((err) => console.log(err));
};

const uploadFile = (file) => {
  convertButton.disabled = true;
  convertButton.textContent = "Uploading...";
  pendingFiles += 1;

  const formData = new FormData();
  formData.append("file", file, file.name);

  let xhr = new XMLHttpRequest();

  xhr.open("POST", `${webroot}/upload`, true);

  xhr.onload = () => {
    let data = {};
    try {
      data = JSON.parse(xhr.responseText);
    } catch {
      // e.g. a plain-text 413 from the server's body size cap
    }

    pendingFiles -= 1;

    if (xhr.status >= 400) {
      const index = fileNames.indexOf(file.name);
      if (index !== -1) {
        fileNames.splice(index, 1);
      }
      file.htmlRow.remove();
      showRejectedFile(file, data.message || "Upload failed");
      if (fileNames.length === 0) {
        fileType = null;
        fileInput.removeAttribute("accept");
        setTitle();
      }
    } else {
      //Remove the progress bar when upload is done
      let progressbar = file.htmlRow.getElementsByTagName("progress");
      progressbar[0].parentElement.remove();
      console.log(data);
    }

    if (pendingFiles === 0) {
      convertButton.disabled = !(formatSelected && fileNames.length > 0);
      convertButton.textContent = "Convert";
    }
  };

  xhr.upload.onprogress = (e) => {
    let sent = e.loaded;
    let total = e.total;
    console.log(`upload progress (${file.name}):`, (100 * sent) / total);

    let progressbar = file.htmlRow.getElementsByTagName("progress");
    progressbar[0].value = (100 * sent) / total;
  };

  xhr.onerror = (e) => {
    console.log(e);
  };

  xhr.send(formData);
};

const formConvert = document.querySelector(`form[action='${webroot}/convert']`);

formConvert.addEventListener("submit", () => {
  const hiddenInput = document.querySelector("input[name='file_names']");
  hiddenInput.value = JSON.stringify(fileNames);
});

updateSearchBar();
