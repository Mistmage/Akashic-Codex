// popup.js
import { saveCurrentTab, saveAllTabs, getLastSavedTabs } from "./tabUtils.js";

document.addEventListener("DOMContentLoaded", async () => {
  const tabList = document.getElementById("tab-list");
  const saveTabBtn = document.getElementById("save-tab");
  const saveAllBtn = document.getElementById("save-all");

  // Load and show last N saved tabs
  const tabs = await getLastSavedTabs();
  // Get all saved tabs across all groups for duplicate detection
  let allSavedUrls = [];
  let groupUrls = {};
  try {
    const { getGroups } = await import("./groupUtils.js");
    const groups = await getGroups();
    if (groups && groups.length) {
      for (const group of groups) {
        if (group.tabs && group.tabs.length) {
          allSavedUrls.push(...group.tabs.map(t => t.url));
          groupUrls[group.name] = group.tabs.map(t => t.url);
        }
      }
    }
  } catch (e) {
    // fallback: don't color
  }

  // Get list of recently refused tabs (by duplicate setting)
  let refusedUrls = [];
  try {
    const refused = localStorage.getItem('tab_saver_rejected');
    if (refused) {
      refusedUrls = JSON.parse(refused);
      // Clear after reading
      localStorage.removeItem('tab_saver_rejected');
    }
  } catch (e) {}

  for (const tab of tabs) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = tab.url;
    a.textContent = tab.title || tab.url;
    a.target = "_blank"; // so it opens in a new tab
    a.rel = "noopener noreferrer";
    // If this tab was refused by duplicate setting, color it red (takes precedence)
    if (refusedUrls.includes(tab.url)) {
      a.style.color = '#d32f2f';
      a.style.fontWeight = 'bold';
      a.title = 'Refused by duplicate tab setting';
    } else {
      // If this tab is a duplicate (global or group), color it red
      let isDuplicate = allSavedUrls.filter(url => url === tab.url).length > 1;
      if (isDuplicate) {
        a.style.color = '#d32f2f';
        a.style.fontWeight = 'bold';
        a.title = 'Already saved (duplicate)';
      }
    }
    li.appendChild(a);
    tabList.appendChild(li);
  }

  document.getElementById('open-fullview').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('fullview.html') });
  });

  saveTabBtn.addEventListener("click", async (e) => {
    const result = await saveCurrentTab(e);
    if (result && result.rejected && result.rejected.length) {
      // Store rejected URLs for next popup load
      localStorage.setItem('tabSaverLastRejected', JSON.stringify(result.rejected));
      location.reload();
      return;
    } else {
      window.close();
    }
  });

  // Save all tabs button
  saveAllBtn.addEventListener("click", async (e) => {
    let disableConfirm = false;
    try {
      const settings = await import('./storage.js').then(m => m.getStorage && m.getStorage("settings"));
      if (settings && settings.disableSaveAllConfirm) disableConfirm = true;
    } catch (err) {}

    if (disableConfirm) {
      const result = await saveAllTabs(e);
      if (result && result.rejected && result.rejected.length) {
        localStorage.setItem('tabSaverLastRejected', JSON.stringify(result.rejected));
        location.reload();
        return;
      }
      window.close();
    } else if (confirm("Save all tabs?")) {
      const result = await saveAllTabs(e);
      if (result && result.rejected && result.rejected.length) {
        localStorage.setItem('tabSaverLastRejected', JSON.stringify(result.rejected));
        location.reload();
        return;
      }
      window.close();
    }
  });
});

function showRejectedMarker() {
  let marker = document.getElementById('rejected-marker');
  if (!marker) {
    marker = document.createElement('div');
    marker.id = 'rejected-marker';
    marker.textContent = 'Tab already saved!';
    marker.style.position = 'fixed';
    marker.style.top = '10px';
    marker.style.right = '10px';
    marker.style.background = '#d32f2f';
    marker.style.color = 'white';
    marker.style.padding = '8px 16px';
    marker.style.borderRadius = '6px';
    marker.style.fontWeight = 'bold';
    marker.style.zIndex = 1000;
    document.body.appendChild(marker);
  } else {
    marker.style.display = '';
  }
}

function hideRejectedMarker() {
  const marker = document.getElementById('rejected-marker');
  if (marker) marker.style.display = 'none';
}


