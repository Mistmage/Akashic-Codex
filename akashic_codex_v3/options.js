import { getStorage, setStorage } from "./storage.js";
import { getGroups, saveGroups, addGroup } from "./groupUtils.js";

const elements = {
  closeOnSaveOne: document.getElementById("close-on-save-one"),
  refuseExistingTabs: document.getElementById("refuse-existing-tabs"),
  refuseExistingTabsGroup: document.getElementById("refuse-existing-tabs-group"),
  closeOnSaveAll: document.getElementById("close-on-save-all"),
  popupTabCount: document.getElementById("popup-tab-count"),
  globalSaveMode: document.getElementById("global-save-mode"),
  obsidianEnabled: document.getElementById("obsidian-enabled"),
  obsidianApiKey: document.getElementById("obsidian-api-key"),
  obsidianApiPath: document.getElementById("obsidian-api-path"),
  saveButton: document.getElementById("save-settings"),
  displayRawLinks: document.getElementById("display-raw-links"),
  disableDragDrop: document.getElementById("disable-drag-drop"),
  shiftDragDrop: document.getElementById("shift-drag-drop"),
  disableSaveAllConfirm: document.getElementById("disable-saveall-confirm"),
};

document.addEventListener("DOMContentLoaded", async () => {
  const settings = (await getStorage("settings")) || {};
  elements.closeOnSaveOne.checked = !!settings.closeOnSaveOne;
  elements.refuseExistingTabs.checked = !!settings.refuseExistingTabs;
  elements.refuseExistingTabsGroup.checked = !!settings.refuseExistingTabsGroup;
  elements.closeOnSaveAll.checked = !!settings.closeOnSaveAll;
  elements.popupTabCount.value = settings.popupTabCount || 5;
  elements.globalSaveMode.value = settings.globalSaveMode || "append-new";
  elements.obsidianEnabled.checked = !!settings.obsidianEnabled;
  elements.obsidianApiKey.value = settings.obsidianApiKey || "";
  elements.obsidianApiPath.value = settings.obsidianApiPath || "";
  elements.displayRawLinks.checked = !!settings.displayRawLinks;
  elements.disableDragDrop.checked = !!settings.disableDragDrop;
  elements.shiftDragDrop.checked = !!settings.shiftDragDrop;
  elements.disableSaveAllConfirm.checked = !!settings.disableSaveAllConfirm;

  const groups = await getGroups();
  renderRulebook(groups);
});

elements.saveButton.addEventListener("click", async () => {
  const settings = {
    closeOnSaveOne: elements.closeOnSaveOne.checked,
    refuseExistingTabs: elements.refuseExistingTabs.checked,
    refuseExistingTabsGroup: elements.refuseExistingTabsGroup.checked,
    closeOnSaveAll: elements.closeOnSaveAll.checked,
    popupTabCount: parseInt(elements.popupTabCount.value, 10),
    globalSaveMode: elements.globalSaveMode.value,
    obsidianEnabled: elements.obsidianEnabled.checked,
    obsidianApiKey: elements.obsidianApiKey.value,
    obsidianApiPath: elements.obsidianApiPath.value,
    displayRawLinks: elements.displayRawLinks.checked,
    disableDragDrop: elements.disableDragDrop.checked,
    shiftDragDrop: elements.shiftDragDrop.checked,
    disableSaveAllConfirm: elements.disableSaveAllConfirm.checked,
  };
  await setStorage("settings", settings);
  alert("Settings saved.");
});

document.getElementById("toggle-rulebook").addEventListener("click", () => {
  const container = document.getElementById("rulebook-container");
  container.style.display = container.style.display === "none" ? "block" : "none";
});

document.getElementById("add-rulebook-group").addEventListener("click", async () => {
  const groups = await getGroups();
  await addGroup(`New Group ${groups.length + 1}`);
  const updated = await getGroups();
  renderRulebook(updated);
});

function renderRulebook(groups) {
  const container = document.getElementById("rulebook-groups");
  container.innerHTML = "";

  groups.forEach((group, index) => {
    const groupEl = document.createElement("div");
    groupEl.className = "rulebook-group";
    groupEl.innerHTML = `
      <div class="group-header">
        <strong>${group.name}</strong>
        <div class="group-header-buttons">
          <button data-index="${index}" class="rename-group">✏ Rename</button>
          <button data-index="${index}" class="delete-group">🗑 Delete</button>
          <span class="group-arrows">
            <button data-index="${index}" class="move-up" title="Move Up">▲</button>
            <button data-index="${index}" class="move-down" title="Move Down">▼</button>
          </span>
        </div>
      </div>
      <div class="export-settings">
        <label for="export-path-${index}">Export Path: 
          <input id="export-path-${index}" name="export-path-${index}" type="text" data-index="${index}" class="export-path" value="${group.exportPath}">
        </label>
        <label for="export-mode-${index}">Export Mode:
          <select id="export-mode-${index}" name="export-mode-${index}" data-index="${index}" class="export-mode">
            <option value="append-all" ${group.exportMode === 'append-all' ? 'selected' : ''}>Append All</option>
            <option value="append-new" ${group.exportMode === 'append-new' ? 'selected' : ''}>Append New</option>
            <option value="append-recent" ${group.exportMode === 'append-recent' ? 'selected' : ''}>Append Recent</option>
            <option value="overwrite" ${group.exportMode === 'overwrite' ? 'selected' : ''}>Overwrite</option>
          </select>
        </label>
        <label for="export-template-${index}">Export Template:
          <input id="export-template-${index}" name="export-template-${index}" type="text" data-index="${index}" class="export-template" value="${group.exportTemplate}">
        </label>
      </div>
      <div class="rule-lists">
        <label for="match-all-${index}">
          <input id="match-all-${index}" name="match-all-${index}" type="checkbox" data-index="${index}" class="match-all" ${group.rules.matchAll ? 'checked' : ''}> Match All Rules
        </label>
        <details>
          <summary>Whitelist Rules</summary>
          <div>
            <label for="whitelist-title-${index}">Title:</label>
            <textarea id="whitelist-title-${index}" name="whitelist-title-${index}" data-type="whitelist-title" data-index="${index}">${group.rules.whitelist.title.join('\n')}</textarea>
          </div>
          <div>
            <label for="whitelist-url-${index}">URL:</label>
            <textarea id="whitelist-url-${index}" name="whitelist-url-${index}" data-type="whitelist-url" data-index="${index}">${group.rules.whitelist.url.join('\n')}</textarea>
          </div>
        </details>
        <details>
          <summary>Blacklist Rules</summary>
          <div>
            <label for="blacklist-title-${index}">Title:</label>
            <textarea id="blacklist-title-${index}" name="blacklist-title-${index}" data-type="blacklist-title" data-index="${index}">${group.rules.blacklist.title.join('\n')}</textarea>
          </div>
          <div>
            <label for="blacklist-url-${index}">URL:</label>
            <textarea id="blacklist-url-${index}" name="blacklist-url-${index}" data-type="blacklist-url" data-index="${index}">${group.rules.blacklist.url.join('\n')}</textarea>
          </div>
        </details>
      </div>
      <hr>
`;
    container.appendChild(groupEl);
  });

  addRulebookListeners(groups);
}

function addRulebookListeners(groups) {
  document.querySelectorAll(".rename-group").forEach((btn) => {
    btn.onclick = async () => {
      const index = parseInt(btn.dataset.index);
      const newName = prompt("Rename group:", groups[index].name);
      if (newName && !groups.some((g, i) => i !== index && g.name === newName)) {
        groups[index].name = newName;
        await saveGroups(groups);
        renderRulebook(groups);
      } else {
        alert("Invalid or duplicate name.");
      }
    };
  });

  document.querySelectorAll(".delete-group").forEach((btn) => {
    btn.onclick = async () => {
      const index = parseInt(btn.dataset.index);
      if (confirm(`Delete group "${groups[index].name}"? This cannot be undone.`)) {
        groups.splice(index, 1);
        await saveGroups(groups);
        renderRulebook(groups);
      }
    };
  });

  document.querySelectorAll(".export-path").forEach((input) => {
    input.onchange = async () => {
      const index = parseInt(input.dataset.index);
      groups[index].exportPath = input.value;
      await saveGroups(groups);
    };
  });

  document.querySelectorAll(".export-mode").forEach((select) => {
    select.onchange = async () => {
      const index = parseInt(select.dataset.index);
      groups[index].exportMode = select.value;
      await saveGroups(groups);
    };
  });

  document.querySelectorAll(".export-template").forEach((input) => {
    input.onchange = async () => {
      const index = parseInt(input.dataset.index);
      groups[index].exportTemplate = input.value;
      await saveGroups(groups);
    };
  });

  document.querySelectorAll(".match-all").forEach((checkbox) => {
    checkbox.onchange = async () => {
      const index = parseInt(checkbox.dataset.index);
      groups[index].rules.matchAll = checkbox.checked;
      await saveGroups(groups);
    };
  });

  document.querySelectorAll("textarea").forEach((textarea) => {
    textarea.onchange = async () => {
      const [type, field] = textarea.dataset.type.split("-");
      const index = parseInt(textarea.dataset.index);
      groups[index].rules[type][field] = textarea.value.split("\n").filter(Boolean);
      await saveGroups(groups);
    };
  });

  document.querySelectorAll(".move-up").forEach((btn) => {
    btn.onclick = async () => {
      const index = parseInt(btn.dataset.index);
      if (index > 0) {
        const temp = groups[index - 1];
        groups[index - 1] = groups[index];
        groups[index] = temp;
        await saveGroups(groups);
        renderRulebook(groups);
      }
    };
  });
  document.querySelectorAll(".move-down").forEach((btn) => {
    btn.onclick = async () => {
      const index = parseInt(btn.dataset.index);
      if (index < groups.length - 1) {
        const temp = groups[index + 1];
        groups[index + 1] = groups[index];
        groups[index] = temp;
        await saveGroups(groups);
        renderRulebook(groups);
      }
    };
  });
}

// --- Export/Import Settings Logic ---

// Move buttons to their own section below rulebook
// (HTML change handled in options.html)

document.getElementById("export-settings").addEventListener("click", async () => {
  const [settings, groups] = await Promise.all([
    getStorage("settings"),
    getGroups()
  ]);
  const data = {
    settings: settings || {},
    groups: groups || []
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tab_saver_settings_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
});

document.getElementById("import-settings").addEventListener("click", () => {
  if (!confirm("Are you sure you want to import settings and rulebook? This will overwrite all your current settings and groups.")) {
    return;
  }
  document.getElementById("import-settings-file").value = "";
  document.getElementById("import-settings-file").click();
});

document.getElementById("import-settings-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data.settings || !Array.isArray(data.groups)) {
      alert("Invalid settings file.");
      return;
    }
    await setStorage("settings", data.settings);
    await saveGroups(data.groups);
    alert("Settings and rulebook imported. Reloading page...");
    location.reload();
  } catch (err) {
    alert("Failed to import: " + err);
  }
});

// (No changes needed here for raw link formatting)

// // options.js
// import { getGroups, saveGroups, addGroup } from './groupUtils.js';
// import { getStorage, setStorage } from "./storage.js";

// const elements = {
//   closeOnSaveOne: document.getElementById("close-on-save-one"),
//   closeOnSaveAll: document.getElementById("close-on-save-all"),
//   popupTabCount: document.getElementById("popup-tab-count"),
//   globalSaveMode: document.getElementById("global-save-mode"),
//   obsidianEnabled: document.getElementById("obsidian-enabled"),
//   obsidianApiKey: document.getElementById("obsidian-api-key"),
//   obsidianApiPath: document.getElementById("obsidian-api-path"),
//   saveButton: document.getElementById("save-settings")
// };

// document.addEventListener("DOMContentLoaded", async () => {
//   const settings = await getStorage("settings") || {};
//   elements.closeOnSaveOne.checked = !!settings.closeOnSaveOne;
//   elements.closeOnSaveAll.checked = !!settings.closeOnSaveAll;
//   elements.popupTabCount.value = settings.popupTabCount || 5;
//   elements.globalSaveMode.value = settings.globalSaveMode || "append-new";
//   elements.obsidianEnabled.checked = !!settings.obsidianEnabled;
//   elements.obsidianApiKey.value = settings.obsidianApiKey || "";
//   elements.obsidianApiPath.value = settings.obsidianApiPath || "";
// });

// elements.saveButton.addEventListener("click", async () => {
//   const settings = {
//     closeOnSaveOne: elements.closeOnSaveOne.checked,
//     closeOnSaveAll: elements.closeOnSaveAll.checked,
//     popupTabCount: parseInt(elements.popupTabCount.value, 10),
//     globalSaveMode: elements.globalSaveMode.value,
//     obsidianEnabled: elements.obsidianEnabled.checked,
//     obsidianApiKey: elements.obsidianApiKey.value,
//     obsidianApiPath: elements.obsidianApiPath.value
//   };
//   await setStorage("settings", settings);
//   alert("Settings saved.");
// });



// const RULEBOOK_GROUPS_KEY = 'tabGroups';

// document.getElementById('toggle-rulebook').addEventListener('click', () => {
//   const container = document.getElementById('rulebook-container');
//   container.style.display = container.style.display === 'none' ? 'block' : 'none';
// });

// document.getElementById('add-rulebook-group').addEventListener('click', async () => {
//   const groups = await loadGroups();
//   const newGroup = {
//     name: `New Group ${groups.length + 1}`,
//     rules: {
//       matchAll: true,
//       whitelist: { title: [], url: [] },
//       blacklist: { title: [], url: [] }
//     },
//     exportPath: '',
//     exportMode: 'append-all',
//     exportTemplate: '* [[${title}]] - ${url}'
//   };
//   groups.push(newGroup);
//   await saveGroups(groups);
//   renderRulebook(groups);
// });

// async function loadGroups() {
//   const data = await chrome.storage.local.get(RULEBOOK_GROUPS_KEY);
//   return data[RULEBOOK_GROUPS_KEY] || [];
// }

// async function saveGroups(groups) {
//   await chrome.storage.local.set({ [RULEBOOK_GROUPS_KEY]: groups });
// }

// function renderRulebook(groups) {
//   const container = document.getElementById('rulebook-groups');
//   container.innerHTML = '';

//   groups.forEach((group, index) => {
//     const groupEl = document.createElement('div');
//     groupEl.className = 'rulebook-group';
//     groupEl.innerHTML = `
//       <div class="group-header">
//         <strong>${group.name}</strong>
//         <button data-index="${index}" class="rename-group">✏ Rename</button>
//         <button data-index="${index}" class="delete-group">🗑 Delete</button>
//       </div>
//       <div class="export-settings">
//         <label>Export Path: <input type="text" data-index="${index}" class="export-path" value="${group.exportPath}"></label>
//         <label>Export Mode:
//           <select data-index="${index}" class="export-mode">
//             <option value="append-all" ${group.exportMode === 'append-all' ? 'selected' : ''}>Append All</option>
//             <option value="append-new" ${group.exportMode === 'append-new' ? 'selected' : ''}>Append New</option>
//             <option value="append-recent" ${group.exportMode === 'append-recent' ? 'selected' : ''}>Append Recent</option>
//             <option value="overwrite" ${group.exportMode === 'overwrite' ? 'selected' : ''}>Overwrite</option>
//           </select>
//         </label>
//         <label>Export Template:
//           <input type="text" data-index="${index}" class="export-template" value="${group.exportTemplate}">
//         </label>
//       </div>
//       <div class="rule-lists">
//         <label><input type="checkbox" data-index="${index}" class="match-all" ${group.rules.matchAll ? 'checked' : ''}> Match All Rules</label>
//         <details>
//           <summary>Whitelist Rules</summary>
//           <div>Title: <textarea data-type="whitelist-title" data-index="${index}">${group.rules.whitelist.title.join('\n')}</textarea></div>
//           <div>URL: <textarea data-type="whitelist-url" data-index="${index}">${group.rules.whitelist.url.join('\n')}</textarea></div>
//         </details>
//         <details>
//           <summary>Blacklist Rules</summary>
//           <div>Title: <textarea data-type="blacklist-title" data-index="${index}">${group.rules.blacklist.title.join('\n')}</textarea></div>
//           <div>URL: <textarea data-type="blacklist-url" data-index="${index}">${group.rules.blacklist.url.join('\n')}</textarea></div>
//         </details>
//       </div>
//       <hr>
//     `;
//     container.appendChild(groupEl);
//   });

//   addRulebookListeners(groups);
// }

// function addRulebookListeners(groups) {
//   document.querySelectorAll('.rename-group').forEach(btn => {
//     btn.onclick = async () => {
//       const index = parseInt(btn.dataset.index);
//       const newName = prompt('Rename group:', groups[index].name);
//       if (newName && !groups.some((g, i) => i !== index && g.name === newName)) {
//         groups[index].name = newName;
//         await saveGroups(groups);
//         renderRulebook(groups);
//       } else {
//         alert('Invalid or duplicate name.');
//       }
//     };
//   });

//   document.querySelectorAll('.delete-group').forEach(btn => {
//     btn.onclick = async () => {
//       const index = parseInt(btn.dataset.index);
//       if (confirm(`Delete group "${groups[index].name}"? This cannot be undone.`)) {
//         groups.splice(index, 1);
//         await saveGroups(groups);
//         renderRulebook(groups);
//       }
//     };
//   });

//   document.querySelectorAll('.export-path').forEach(input => {
//     input.onchange = async () => {
//       const index = parseInt(input.dataset.index);
//       groups[index].exportPath = input.value;
//       await saveGroups(groups);
//     };
//   });

//   document.querySelectorAll('.export-mode').forEach(select => {
//     select.onchange = async () => {
//       const index = parseInt(select.dataset.index);
//       groups[index].exportMode = select.value;
//       await saveGroups(groups);
//     };
//   });

//   document.querySelectorAll('.export-template').forEach(input => {
//     input.onchange = async () => {
//       const index = parseInt(input.dataset.index);
//       groups[index].exportTemplate = input.value;
//       await saveGroups(groups);
//     };
//   });

//   document.querySelectorAll('.match-all').forEach(checkbox => {
//     checkbox.onchange = async () => {
//       const index = parseInt(checkbox.dataset.index);
//       groups[index].rules.matchAll = checkbox.checked;
//       await saveGroups(groups);
//     };
//   });

//   document.querySelectorAll('textarea').forEach(textarea => {
//     textarea.onchange = async () => {
//       const [type, field] = textarea.dataset.type.split('-');
//       const index = parseInt(textarea.dataset.index);
//       groups[index].rules[type][field] = textarea.value.split('\n').filter(Boolean);
//       await saveGroups(groups);
//     };
//   });
// }

// // Load everything when options opens
// loadGroups().then(renderRulebook);
