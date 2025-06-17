// tabUtils.js

import { getStorage } from './storage.js'; // Adjust path if needed
import { getGroups, saveGroups } from './groupUtils.js';



async function getMaxTabsInPopup() {
  const settings = await getStorage("settings") || {};
  return settings.popupTabCount || 5;
}
 
const LAST_TABS_KEY = 'lastSavedTabs';
// const MAX_TABS_IN_POPUP = getMaxTabsInPopup || 5; // Can be made configurable later







export async function saveCurrentTab(e) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    const result = await saveTabsToGroups([tab]);
    await updateLastTabsList([tab]);
    // Check closeOnSaveOne setting and close the tab if enabled, with Shift-invert logic
    const settings = await getStorage("settings") || {};
    let close = !!settings.closeOnSaveOne;
    if (e && e.shiftKey) close = !close;
    if (close) {
      await chrome.tabs.remove(tab.id);
    }
    return result && result.rejected ? { rejected: true } : {};
  }
  return {};
}

export async function saveAllTabs(e, opts = {}) {
  try {
    // Use allTabs option to determine query
    const useAllTabs = opts.allTabs !== undefined ? opts.allTabs : false;
    const query = useAllTabs ? {} : { currentWindow: true };
    const tabs = await chrome.tabs.query(query);
    if (!tabs || tabs.length === 0) {
      alert(`No tabs found in ${useAllTabs ? 'any window' : 'current window'}.`);
      return;
    }
    let saveResult;
    try {
      saveResult = await saveTabsToGroups(tabs);
    } catch (err) {
      alert('Error in saveTabsToGroups: ' + err);
      throw err;
    }
    try {
      await updateLastTabsList(tabs);
    } catch (err) {
      alert('Error in updateLastTabsList: ' + err);
      throw err;
    }
    // Always respect closeOnSaveAll setting (no shift-invert logic)
    let settings;
    try {
      settings = await getStorage("settings") || {};
    } catch (err) {
      alert('Error getting settings: ' + err);
      settings = {};
    }
    let close = !!settings.closeOnSaveAll;
    if (close) {
      // Only close tabs with URLs that are allowed to be closed and not pinned
      const closableTabs = tabs.filter(tab => {
        if (!tab.url) return false;
        if (tab.pinned) return false;
        return !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://') && !tab.url.startsWith('about:');
      });
      for (const tab of closableTabs) {
        try {
          await chrome.tabs.remove(tab.id);
        } catch (err) {
          console.error('Failed to close tab:', tab, err);
          alert('Failed to close tab: ' + (tab.title || tab.url || tab.id) + '\n' + err);
        }
      }
    }
    if (saveResult && saveResult.rejected && saveResult.rejected.length > 0) {
      alert('Some tabs were rejected: ' + JSON.stringify(saveResult.rejected));
    }
  } catch (err) {
    alert('Error in saveAllTabs: ' + err);
  }
}

export async function saveTabsToGroups(tabs) {
  const groups = await getGroups();
  const settings = await getStorage("settings") || {};
  const refuseExisting = !!settings.refuseExistingTabs;
  const refuseExistingGroup = !!settings.refuseExistingTabsGroup;
  let rejectedUrls = [];

  // Collect all existing URLs across all groups for global check
  let allUrls = [];
  if (refuseExisting) {
    for (const group of groups) {
      if (group.tabs && group.tabs.length) {
        allUrls.push(...group.tabs.map(t => t.url));
      }
    }
  }

  for (const tab of tabs) {
    let matched = false;
    let rejected = false;
    for (let i = groups.length - 1; i >= 0; i--) {
      const group = groups[i];
      if (matchTabToGroup(tab, group)) {
        if (!group.tabs) group.tabs = [];
        if (refuseExisting && allUrls.includes(tab.url)) {
          rejected = true;
          break;
        }
        if (refuseExistingGroup && group.tabs.some(t => t.url === tab.url)) {
          rejected = true;
          break;
        }
        group.tabs.push({ title: tab.title, url: tab.url });
        matched = true;
        break;
      }
    }
    if (rejected) {
      rejectedUrls.push(tab.url);
      continue;
    }
    if (!matched) {
      const newGroup = {
        name: 'Ungrouped',
        rules: { whitelist: { title: [], url: [] }, blacklist: { title: [], url: [] } },
        tabs: [{ title: tab.title, url: tab.url }],
        exportPath: '',
        exportTemplate: '* [[${title}]] - ${url}',
        exportMode: 'append-all',
      };
      groups.push(newGroup);
    }
  }
  await saveGroups(groups);
  // Store rejected URLs in localStorage for popup coloring, even if no actual duplicates in saved tabs
  if (rejectedUrls.length > 0) {
    try {
      localStorage.setItem('tab_saver_rejected', JSON.stringify(rejectedUrls));
    } catch (e) {}
  }
  return { rejected: rejectedUrls };
}

function matchTabToGroup(tab, group) {
  const title = tab.title || '';
  const url = tab.url || '';

  const { whitelist = {}, blacklist = {} } = group.rules || {};
  const { title: wt = [], url: wu = [] } = whitelist;
  const { title: bt = [], url: bu = [] } = blacklist;

  const whitelistMatch =
    (wt.length === 0 || wt.some(re => new RegExp(re, 'i').test(title))) &&
    (wu.length === 0 || wu.some(re => new RegExp(re, 'i').test(url)));

  const blacklistMatch =
    bt.some(re => new RegExp(re, 'i').test(title)) ||
    bu.some(re => new RegExp(re, 'i').test(url));

  return whitelistMatch && !blacklistMatch;
}

async function updateLastTabsList(tabs) {
  const stored = await chrome.storage.local.get(LAST_TABS_KEY);
  const current = stored[LAST_TABS_KEY] || [];

  const newTabs = tabs.map(tab => ({ title: tab.title, url: tab.url }));
  const maxTabs = await getMaxTabsInPopup();
  const combined = [...newTabs, ...current].slice(0, maxTabs);

  await chrome.storage.local.set({ [LAST_TABS_KEY]: combined });
}

export async function getLastSavedTabs() {
  const stored = await chrome.storage.local.get(LAST_TABS_KEY);
  return stored[LAST_TABS_KEY] || [];
}
