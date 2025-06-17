// listeners.js
import { exportGroupToMarkdown } from './exportUtils.js';
import { updateGroupDOM } from './extraUtils.js';
import { renderRecentlyRemovedTabs } from './fullview.js';

function addListeners(groups, dragDropSettings = {}) {
  // Remove all previous listeners by cloning nodes (for tab-item and drag-handle)
  document.querySelectorAll('.tab-item').forEach(item => {
    const newItem = item.cloneNode(true);
    item.parentNode.replaceChild(newItem, item);
  });
  document.querySelectorAll('.drag-handle').forEach(handle => {
    const newHandle = handle.cloneNode(true);
    handle.parentNode.replaceChild(newHandle, handle);
  });
  // Remove all previous listeners for buttons
  [
    '.export-group', '.restore-group', '.restore-delete-group', '.settings-group',
    '.open-tab', '.delete-tab', '.move-tab-up', '.move-tab-down',
    '.open-remove-tab', '.remove-duplicates-group', '.copy-link', '.import-group'
  ].forEach(sel => {
    document.querySelectorAll(sel).forEach(btn => {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
    });
  });
  document.querySelectorAll('.export-group').forEach(button => {
    button.addEventListener('click', async () => {
      const index = parseInt(button.dataset.index);
      await exportGroupToMarkdown(index);
      alert(`Group "${groups[index].name}" exported.`);
    });
  });
  document.querySelectorAll('.restore-group').forEach(button => {
    button.addEventListener('click', () => {
      const index = parseInt(button.dataset.index);
      groups[index].tabs.forEach(tab => chrome.tabs.create({ url: tab.url }));
    });
  });
  document.querySelectorAll('.restore-delete-group').forEach(button => {
    button.addEventListener('click', async () => {
      const index = parseInt(button.dataset.index);
      if (!confirm(`Restore and delete all tabs in "${groups[index].name}"?`)) return;
      // Store all removed tabs in recentlyRemovedTabs
      const removedTabs = groups[index].tabs.map(tab => ({ ...tab, removedAt: Date.now(), group: groups[index].name }));
      chrome.storage.local.get('recentlyRemovedTabs', data => {
        const arr = data.recentlyRemovedTabs || [];
        const combined = arr.concat(removedTabs).slice(-10);
        chrome.storage.local.set({ recentlyRemovedTabs: combined }, () => {
          if (typeof window.renderRecentlyRemovedTabs === 'function') window.renderRecentlyRemovedTabs();
        });
      });
      groups[index].tabs.forEach(tab => chrome.tabs.create({ url: tab.url }));
      groups[index].tabs = [];
      await updateGroupsAndUI(groups);
    });
  });
  document.querySelectorAll('.settings-group').forEach(button => {
    button.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  });
  document.querySelectorAll('.open-tab').forEach(button => {
    button.addEventListener('click', e => {
      const g = parseInt(e.target.dataset.g);
      const t = parseInt(e.target.dataset.t);
      const shift = e.shiftKey;
      chrome.tabs.create({ url: groups[g].tabs[t].url, active: !shift });
    });
  });
  document.querySelectorAll('.delete-tab').forEach(button => {
    button.addEventListener('click', async e => {
      const g = parseInt(e.target.dataset.g);
      const t = parseInt(e.target.dataset.t);
      // Store removed tab in recentlyRemovedTabs (last 10)
      const removedTab = groups[g].tabs[t];
      chrome.storage.local.get('recentlyRemovedTabs', data => {
        const arr = data.recentlyRemovedTabs || [];
        arr.push({ ...removedTab, removedAt: Date.now(), group: groups[g].name });
        const last10 = arr.slice(-10);
        chrome.storage.local.set({ recentlyRemovedTabs: last10 }, () => {
          if (typeof window.renderRecentlyRemovedTabs === 'function') window.renderRecentlyRemovedTabs();
        });
      });
      groups[g].tabs.splice(t, 1);
      // Only update the affected group in the DOM
      await updateGroupsAndUI(groups, [g]);
    });
  });
  document.querySelectorAll('.move-tab-up').forEach(button => {
    button.addEventListener('click', async (e) => {
      const g = parseInt(button.dataset.g);
      const t = parseInt(button.dataset.t);
      const shift = e.shiftKey;
      if ((shift && g > 0) || (!shift && t === 0 && g > 0)) {
        // Move to previous group (with shift or at first tab)
        const tab = groups[g].tabs.splice(t, 1)[0];
        if (!tab.savedAt) tab.savedAt = Date.now();
        groups[g-1].tabs.push(tab);
        await updateGroupsAndUI(groups, [g, g-1]);
      } else if (!shift && t > 0) {
        // Move up within group
        const tabs = groups[g].tabs;
        if (!tabs[t].savedAt) tabs[t].savedAt = Date.now();
        if (!tabs[t-1].savedAt) tabs[t-1].savedAt = Date.now();
        [tabs[t-1], tabs[t]] = [tabs[t], tabs[t-1]];
        await updateGroupsAndUI(groups, [g]);
      }
    });
  });
  document.querySelectorAll('.move-tab-down').forEach(button => {
    button.addEventListener('click', async (e) => {
      const g = parseInt(button.dataset.g);
      const t = parseInt(button.dataset.t);
      const shift = e.shiftKey;
      if ((shift && g < groups.length - 1) || (!shift && t === groups[g].tabs.length - 1 && g < groups.length - 1)) {
        // Move to next group (with shift or at last tab)
        const tab = groups[g].tabs.splice(t, 1)[0];
        if (!tab.savedAt) tab.savedAt = Date.now();
        groups[g+1].tabs.push(tab);
        await updateGroupsAndUI(groups, [g, g+1]);
      } else if (!shift && t < groups[g].tabs.length - 1) {
        // Move down within group
        const tabs = groups[g].tabs;
        if (!tabs[t].savedAt) tabs[t].savedAt = Date.now();
        if (!tabs[t+1].savedAt) tabs[t+1].savedAt = Date.now();
        [tabs[t], tabs[t+1]] = [tabs[t+1], tabs[t]];
        await updateGroupsAndUI(groups, [g]);
      }
    });
  });
  // Open and Remove (open tab and delete it)
  document.querySelectorAll('.open-remove-tab').forEach(button => {
    button.addEventListener('click', async e => {
      const g = parseInt(button.dataset.g);
      const t = parseInt(button.dataset.t);
      const shift = e.shiftKey;
      const tabObj = groups[g].tabs[t];
      chrome.tabs.create({ url: tabObj.url, active: !shift });
      // Store removed tab in recentlyRemovedTabs (last 10)
      chrome.storage.local.get('recentlyRemovedTabs', data => {
        const arr = data.recentlyRemovedTabs || [];
        arr.push({ ...tabObj, removedAt: Date.now(), group: groups[g].name });
        const last10 = arr.slice(-10);
        chrome.storage.local.set({ recentlyRemovedTabs: last10 }, () => {
          if (typeof window.renderRecentlyRemovedTabs === 'function') window.renderRecentlyRemovedTabs();
        });
      });
      groups[g].tabs.splice(t, 1);
      // Only update the affected group in the DOM
      await updateGroupsAndUI(groups, [g]);
    });
  });

  // Remove duplicates in group
  document.querySelectorAll('.remove-duplicates-group').forEach(button => {
    button.addEventListener('click', async () => {
      const index = parseInt(button.dataset.index);
      const group = groups[index];
      const seen = new Set();
      group.tabs = group.tabs.filter(tab => {
        if (seen.has(tab.url)) return false;
        seen.add(tab.url);
        return true;
      });
      await updateGroupsAndUI(groups);
    });
  });

  // Copy link
  document.querySelectorAll('.copy-link').forEach(button => {
    button.addEventListener('click', async e => {
      const g = parseInt(button.dataset.g);
      const t = parseInt(button.dataset.t);
      const url = groups[g].tabs[t].url;
      try {
        await navigator.clipboard.writeText(url);
        button.textContent = '✔';
        setTimeout(() => { button.textContent = '📋'; }, 1000);
      } catch (err) {
        button.textContent = '✖';
        setTimeout(() => { button.textContent = '📋'; }, 1000);
      }
    });
  });

  // Drag and drop for tab items (within and between groups)
  document.querySelectorAll('.tab-item').forEach(item => {
    const handle = item.querySelector('.drag-handle');
    if (dragDropSettings.disableDragDrop) {
      // Remove all drag listeners and set draggable false
      item.setAttribute('draggable', 'false');
      if (handle) {
        handle.setAttribute('draggable', 'false');
        handle.classList.add('drag-disabled');
        handle.onmousedown = null;
        handle.onmouseup = null;
        handle.ondragstart = null;
        handle.ondragend = null;
      }
      item.addEventListener('dragstart', e => { e.preventDefault(); return false; });
      item.addEventListener('dragover', e => { e.preventDefault(); return false; });
      return;
    }
    item.setAttribute('draggable', 'false');
    if (!handle) return;
    handle.setAttribute('draggable', 'true');
    handle.classList.remove('drag-disabled');
    // Remove previous listeners to avoid duplicates
    if (handle._dragStartListener)
      handle.removeEventListener('dragstart', handle._dragStartListener);
    if (handle._dragEndListener)
      handle.removeEventListener('dragend', handle._dragEndListener);
    if (handle._mouseDownListener)
      handle.removeEventListener('mousedown', handle._mouseDownListener);
    // Attach new listeners
    handle._dragStartListener = function(e) {
      if (dragDropSettings.shiftDragDrop && !e.shiftKey) {
        e.preventDefault();
        handle.classList.add('shake');
        handle.title = 'Hold Shift to drag';
        setTimeout(() => handle.classList.remove('shake'), 400);
        return false;
      }
      window._dragTab = {
        g: parseInt(item.dataset.g),
        t: parseInt(item.dataset.t)
      };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', '');
      item.classList.add('dragging');
    };
    handle._dragEndListener = function() {
      window._dragTab = null;
      item.classList.remove('dragging');
    };
    // Block mousedown if shift is required but not held (prevents drag ghost)
    handle._mouseDownListener = function(e) {
      if (dragDropSettings.shiftDragDrop && !e.shiftKey) {
        e.preventDefault();
        return false;
      }
    };
    handle.addEventListener('dragstart', handle._dragStartListener);
    handle.addEventListener('dragend', handle._dragEndListener);
    handle.addEventListener('mousedown', handle._mouseDownListener);
    // Add shake animation CSS if not present
    if (!document.getElementById('drag-shake-style')) {
      const style = document.createElement('style');
      style.id = 'drag-shake-style';
      style.textContent = `.shake { animation: shake 0.4s; } @keyframes shake { 0% { transform: translateX(0); } 20% { transform: translateX(-4px); } 40% { transform: translateX(4px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } 100% { transform: translateX(0); } }`;
      document.head.appendChild(style);
    }
  });
  document.querySelectorAll('.tab-item').forEach(item => {
    if (dragDropSettings.disableDragDrop) return;
    item.addEventListener('dragover', e => {
      e.preventDefault();
      item.classList.add('drag-over');
    });
    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over');
    });
    item.addEventListener('drop', async e => {
      item.classList.remove('drag-over');
      if (!window._dragTab) return;
      const { g, t } = window._dragTab;
      const targetG = parseInt(item.dataset.g);
      const targetT = parseInt(item.dataset.t);
      if (g === targetG && t === targetT) return;
      // Always fetch fresh groups before mutating
      const { getGroups } = await import('./groupUtils.js');
      let freshGroups = await getGroups();
      const tab = freshGroups[g].tabs.splice(t, 1)[0];
      if (!tab.savedAt) tab.savedAt = Date.now();
      freshGroups[targetG].tabs.splice(targetT, 0, tab);
      await updateGroupsAndUI(freshGroups, [g, targetG]);
    });
  });
  document.querySelectorAll('.tab-list').forEach(list => {
    if (dragDropSettings.disableDragDrop) return;
    list.addEventListener('dragover', e => {
      e.preventDefault();
      list.classList.add('drag-over-group');
    });
    list.addEventListener('dragleave', () => {
      list.classList.remove('drag-over-group');
    });
    list.addEventListener('drop', async e => {
      list.classList.remove('drag-over-group');
      if (!window._dragTab) return;
      const { g, t } = window._dragTab;
      const groupIndex = parseInt(list.parentElement.querySelector('.group-header .export-group').dataset.index);
      // Always fetch fresh groups before mutating
      const { getGroups } = await import('./groupUtils.js');
      let freshGroups = await getGroups();
      if (g === groupIndex && freshGroups[groupIndex].tabs.length > 0) return; // Don't drop on self if not empty
      const tab = freshGroups[g].tabs.splice(t, 1)[0];
      if (!tab.savedAt) tab.savedAt = Date.now();
      freshGroups[groupIndex].tabs.push(tab);
      await updateGroupsAndUI(freshGroups, [g, groupIndex]);
    });
  });

  // Import group (file input)
  document.querySelectorAll('.import-group').forEach(button => {
    button.addEventListener('click', async () => {
      const index = parseInt(button.dataset.index);
      // Create file input dynamically
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.md,text/markdown,text/plain';
      input.style.display = 'none';
      document.body.appendChild(input);
      input.addEventListener('change', async (e) => {
        const file = input.files[0];
        if (!file) return;
        const text = await file.text();
        // Extract links from markdown (simple regex for http/https links)
        const urlRegex = /https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+/g;
        const urls = text.match(urlRegex) || [];
        if (urls.length === 0) {
          alert('No links found in the selected file.');
          document.body.removeChild(input);
          return;
        }
        // Add as new tabs to the group, avoiding duplicates
        const group = groups[index];
        const existing = new Set(group.tabs.map(tab => tab.url));
        let added = 0;
        urls.forEach(url => {
          if (!existing.has(url)) {
            group.tabs.push({ url, title: url });
            existing.add(url);
            added++;
          }
        });
        if (added > 0) {
          await updateGroupsAndUI(groups);
          alert(`Imported ${added} new link(s) to "${group.name}".`);
        } else {
          alert('No new links were imported (all were duplicates).');
        }
        document.body.removeChild(input);
      });
      input.click();
    });
  });
}

async function updateGroupsAndUI(groups, changedGroups = null) {
  // Save and update only affected group(s) in the DOM, not the full page
  const { saveGroups } = await import('./groupUtils.js');
  await saveGroups(groups);
  if (Array.isArray(changedGroups)) {
    // Only update the changed group indices
    for (const g of changedGroups) {
      const { updateGroupDOM } = await import('./extraUtils.js');
      updateGroupDOM(g);
    }
  } else {
    // Fallback: update all
    if (typeof window.renderGroups === 'function') window.renderGroups(groups);
  }
  if (typeof window.renderRecentlyRemovedTabs === 'function') window.renderRecentlyRemovedTabs();
}

export { addListeners };
