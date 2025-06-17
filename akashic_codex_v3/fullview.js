import { getGroups, saveGroups } from './groupUtils.js';
import { getStorage } from './storage.js';
import { exportGroupToMarkdown } from './exportUtils.js';
import { renderGroupTabs, updateGroupDOM } from './extraUtils.js';
import { addListeners } from './listeners.js';

// Declare these OUTSIDE so listeners can access current values
let displayRawLinks = false;
let disableDragDrop = false;
let shiftDragDrop = false;



window.addEventListener('keydown', e => {
  if (e.key === 'Shift') window._isShiftDown = true;
});
window.addEventListener('keyup', e => {
  if (e.key === 'Shift') window._isShiftDown = false;
});



function attachDragDropListeners(container, groups) {
  // This function attaches your drag/drop event listeners on group tabs/items
  // Use disableDragDrop and shiftDragDrop from outer scope here
  groups.forEach((group, groupIndex) => {
    const groupElem = container.querySelector(`.group-panel:nth-child(${groupIndex + 1})`);
    if (!groupElem) return;
    // Attach listeners on tabs/items within groupElem
    const tabItems = groupElem.querySelectorAll('.tab-item');
    tabItems.forEach((item, tabIndex) => {
      if (!disableDragDrop) {
        item.addEventListener('dragover', e => {
          if (shiftDragDrop && !e.shiftKey) {
            e.preventDefault();
            return false;
          }
          if (!window._dragTab) {
            e.preventDefault();
            return false;
          }
          e.preventDefault();
          item.classList.add('drag-over');
        });
        item.addEventListener('dragleave', () => {
          item.classList.remove('drag-over');
        });
        item.addEventListener('drop', async e => {
          if (shiftDragDrop && !e.shiftKey) {
            e.preventDefault();
            return false;
          }
          item.classList.remove('drag-over');
          if (!window._dragTab) {
            e.preventDefault();
            return false;
          }
          const { g, t } = window._dragTab;
          const targetG = groupIndex;
          const targetT = tabIndex;
          if (g === targetG && t === targetT) return;
          // Always fetch fresh groups before mutating
          let freshGroups = await getGroups();
          const tab = freshGroups[g].tabs.splice(t, 1)[0];
          if (!tab.savedAt) tab.savedAt = Date.now();
          freshGroups[targetG].tabs.splice(targetT, 0, tab);
          await saveGroups(freshGroups);
          freshGroups = await getGroups();
          renderGroups(freshGroups);
        });
      }
    });
    // Attach listeners to tab-list for dropping on empty group
    const tabList = groupElem.querySelector('.tab-list');
    if (tabList && !disableDragDrop) {
      tabList.addEventListener('dragover', e => {
        if (shiftDragDrop && !e.shiftKey) {
          e.preventDefault();
          return false;
        }
        if (!window._dragTab) {
          e.preventDefault();
          return false;
        }
        e.preventDefault();
        tabList.classList.add('drag-over-group');
      });
      tabList.addEventListener('dragleave', () => {
        tabList.classList.remove('drag-over-group');
      });
      tabList.addEventListener('drop', async e => {
        if (shiftDragDrop && !e.shiftKey) {
          e.preventDefault();
          return false;
        }
        tabList.classList.remove('drag-over-group');
        if (!window._dragTab) {
          e.preventDefault();
          return false;
        }
        const { g, t } = window._dragTab;
        const groupIndex = parseInt(tabList.parentElement.querySelector('.group-header .export-group').dataset.index);
        // Always fetch fresh groups before mutating
        let freshGroups = await getGroups();
        if (g === groupIndex && freshGroups[groupIndex].tabs.length > 0) return; // Don't drop on self if not empty
        const tab = freshGroups[g].tabs.splice(t, 1)[0];
        if (!tab.savedAt) tab.savedAt = Date.now();
        freshGroups[groupIndex].tabs.push(tab);
        await saveGroups(freshGroups);
        freshGroups = await getGroups();
        renderGroups(freshGroups);
      });
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const groups = await getGroups();
  renderGroups(groups);

  document.getElementById('export-all').addEventListener('click', async () => {
    const groups = await getGroups();
    for (let i = 0; i < groups.length; i++) {
      await exportGroupToMarkdown(i);
    }
    alert('All groups exported.');
  });

  document.getElementById('restore-all').addEventListener('click', async () => {
    if (!confirm('Restore all tabs from all groups?')) return;
    const groups = await getGroups();
    for (const group of groups) {
      for (const tab of group.tabs) {
        chrome.tabs.create({ url: tab.url });
      }
    }
  });

  document.getElementById('restore-delete-all').addEventListener('click', async () => {
    if (!confirm('Restore and delete all tabs from all groups?')) return;
    const groups = await getGroups();
    let allRemovedTabs = [];
    for (const group of groups) {
      for (const tab of group.tabs) {
        chrome.tabs.create({ url: tab.url });
        allRemovedTabs.push({ ...tab, removedAt: Date.now(), group: group.name });
      }
      group.tabs = [];
    }
    chrome.storage.local.get('recentlyRemovedTabs', data => {
      const arr = data.recentlyRemovedTabs || [];
      const combined = arr.concat(allRemovedTabs).slice(-10);
      chrome.storage.local.set({ recentlyRemovedTabs: combined }, () => {
        renderRecentlyRemovedTabs();
      });
    });
    await saveGroups(groups);
    renderGroups(groups);
  });

  document.getElementById('remove-duplicates-all').addEventListener('click', async () => {
    const groups = await getGroups();
    let changed = false;
    const seen = new Set();
    for (const group of groups) {
      group.tabs = group.tabs.filter(tab => {
        if (seen.has(tab.url)) return false;
        seen.add(tab.url);
        return true;
      });
      changed = true;
    }
    if (changed) {
      await saveGroups(groups);
      renderGroups(groups);
    }
  });

  document.getElementById('save-all-alt').addEventListener('click', async (e) => {
    // Check for disable confirmation option in settings (same as popup)
    let disableConfirm = false;
    try {
      const { getStorage } = await import('./storage.js');
      const settings = await getStorage('settings');
      if (settings && settings.disableSaveAllConfirm) disableConfirm = true;
    } catch (err) {}

    if (disableConfirm) {
      const { saveAllTabs } = await import('./tabUtils.js');
      const result = await saveAllTabs(e, { allTabs: true });
      if (result && result.rejected && result.rejected.length) {
        alert('Some tabs were rejected: ' + JSON.stringify(result.rejected));
      } else {
        alert('All tabs saved!');
      }
    } else if (confirm('Save all tabs?')) {
      const { saveAllTabs } = await import('./tabUtils.js');
      const result = await saveAllTabs(e, { allTabs: true });
      if (result && result.rejected && result.rejected.length) {
        alert('Some tabs were rejected: ' + JSON.stringify(result.rejected));
      } else {
        alert('All tabs saved!');
      }
    }
  });
});

function renderGroups(groups) {
  window.renderGroups = renderGroups;
  window._dragTab = null;
  const container = document.getElementById('group-container');
  container.innerHTML = '';
  getStorage('settings').then(settings => {
    displayRawLinks = !!(settings && settings.displayRawLinks);
    disableDragDrop = !!(settings && settings.disableDragDrop);
    shiftDragDrop = !!(settings && settings.shiftDragDrop);
    console.log('Drag settings:', { disableDragDrop, shiftDragDrop });
    groups.forEach((group, groupIndex) => {
      const panel = document.createElement('div');
      panel.className = 'group-panel';
      const header = document.createElement('div');
      header.className = 'group-header';
      header.style.display = 'flex';
      header.style.alignItems = 'center';
      header.style.justifyContent = 'space-between';







      
      // Collapse/expand button
      const collapseBtn = document.createElement('button');
      collapseBtn.className = 'collapse-group-btn';
      collapseBtn.title = 'Collapse/Expand group';
      // Use localStorage to remember state
      const collapseKey = `group-collapse-${group.name}`;
      let isCollapsed = localStorage.getItem(collapseKey) === '1';
      collapseBtn.textContent = isCollapsed ? '\u2BC8' : '\u2BC6'; // ⯈/⯆
      collapseBtn.style.marginRight = '0.12em';
      collapseBtn.style.fontSize = '1.1em';
      collapseBtn.style.background = 'none';
      collapseBtn.style.border = 'none';
      collapseBtn.style.cursor = 'pointer';
      collapseBtn.style.color = '#1976d2';
      collapseBtn.style.padding = '0 0.18em';
      collapseBtn.style.userSelect = 'none';
      collapseBtn.addEventListener('click', () => {
        isCollapsed = !isCollapsed;
        localStorage.setItem(collapseKey, isCollapsed ? '1' : '0');
        collapseBtn.textContent = isCollapsed ? '\u2BC8' : '\u2BC6'; // ⯈/⯆
        list.style.display = isCollapsed ? 'none' : '';
      });

      // Title
      const title = document.createElement('h2');
      title.textContent = group.name;
      title.style.margin = '0';
      title.style.fontSize = '1.18em';
      title.style.fontWeight = '800';
      title.style.flexShrink = '0';
      title.style.textAlign = 'left';
      title.style.color = '#222';
      title.style.letterSpacing = '0.01em';
      title.style.padding = '0';
      title.style.lineHeight = '1.1';
      title.style.minWidth = '0';
      title.style.maxWidth = '18em';
      title.style.overflow = 'hidden';
      title.style.textOverflow = 'ellipsis';
      title.style.whiteSpace = 'nowrap';
      title.style.display = 'inline-block';
      // Collapse/expand button (immediately after title, no space)
      const titleCollapseWrapper = document.createElement('span');
      titleCollapseWrapper.style.display = 'inline-flex';
      titleCollapseWrapper.appendChild(title);
      collapseBtn.style.marginLeft = '0';
      collapseBtn.style.marginRight = '0.12em';
      collapseBtn.style.padding = '0';
      collapseBtn.style.position = 'relative';
      collapseBtn.style.left = '-2px';
      titleCollapseWrapper.appendChild(collapseBtn);
      header.appendChild(titleCollapseWrapper);
      // Buttons
      const buttons = document.createElement('div');
      buttons.className = 'group-buttons';
      // Tab count (styled pill, moved to right before Export)
      const tabCount = document.createElement('div');
      tabCount.className = 'group-tab-count';
      tabCount.title = 'Number of tabs in this group';
      // Only display if > 0, but always keep width
      const tabCountValue = group.tabs.length > 0 ? group.tabs.length : '';
      tabCount.innerHTML = `<span style="margin-right:0.3em;font-size:1.08em;vertical-align:middle;">🗂️</span><b>${tabCountValue}</b>`;
      // Insert tabCount as first child of buttons
      buttons.appendChild(tabCount);
      buttons.innerHTML += `
        <button class="export-group" data-index="${groupIndex}">Export</button>
        <button class="import-group" data-index="${groupIndex}">Import</button>
        <button class="restore-group" data-index="${groupIndex}">Restore All</button>
        <button class="restore-delete-group" data-index="${groupIndex}">Restore & Delete</button>
        <button class="remove-duplicates-group" data-index="${groupIndex}">Remove Duplicates</button>
        <button class="settings-group" data-index="${groupIndex}">⚙</button>
      `;
      header.appendChild(buttons);

      panel.appendChild(header);



      const list = document.createElement('ul');
      list.className = 'tab-list';
      if (isCollapsed) list.style.display = 'none';
      // Allow drop on empty group


      if (!disableDragDrop) {

        list.addEventListener('dragover', e => {
          if (shiftDragDrop && !e.shiftKey) {
            e.preventDefault();
            return false;
          }
          if (!window._dragTab) {
            e.preventDefault();
            return false;
          }
          e.preventDefault();
          list.classList.add('drag-over-group');
        });
        list.addEventListener('dragleave', () => {
          list.classList.remove('drag-over-group');
        });
        list.addEventListener('drop', async e => {
          if (shiftDragDrop && !e.shiftKey) {
            e.preventDefault();
            return false;
          }
          list.classList.remove('drag-over-group');
          if (!window._dragTab) {
            e.preventDefault();
            return false;
          }
          const { g, t } = window._dragTab;
          const groupIndex = parseInt(list.parentElement.querySelector('.group-header .export-group').dataset.index);
          // Always fetch fresh groups before mutating
          let freshGroups = await getGroups();
          if (g === groupIndex && freshGroups[groupIndex].tabs.length > 0) return; // Don't drop on self if not empty
          const tab = freshGroups[g].tabs.splice(t, 1)[0];
          if (!tab.savedAt) tab.savedAt = Date.now();
          freshGroups[groupIndex].tabs.push(tab);
          await saveGroups(freshGroups);
          freshGroups = await getGroups();
          renderGroups(freshGroups);
        });
      }

      group.tabs.forEach((tab, tabIndex) => {
        const item = document.createElement('li');
        item.className = 'tab-item';
        item.dataset.g = groupIndex;
        item.dataset.t = tabIndex;
        item.style.display = 'flex';
        item.style.flexDirection = 'column';
        item.style.alignItems = 'stretch';
        item.style.padding = '0.3em 0';
        item.style.borderBottom = '1px solid #eee';
        // --- Strictly block drag on tab-item except via handle ---
        item.setAttribute('draggable', 'false');
        item.addEventListener('dragstart', e => { e.preventDefault(); return false; });
        // Main row: favicon, handle, link, actions
        const mainRow = document.createElement('div');
        mainRow.className = 'tab-main-row';
        mainRow.style.display = 'flex';
        mainRow.style.flexDirection = 'row';
        mainRow.style.alignItems = 'center';
        mainRow.style.width = '100%';



// Add favicon
let faviconUrl = '';
if (tab.url && tab.url.startsWith('http')) {
  try {
    const parsedUrl = new URL(tab.url);
    faviconUrl = 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(parsedUrl.hostname);
  } catch (e) {
    faviconUrl = 'default-favicon.png'; // Fallback image in your extension
  }
} else {
  faviconUrl = 'default-favicon.png'; // Fallback for non-http URLs
}

const favicon = document.createElement('img');
favicon.src = faviconUrl;
favicon.className = 'favicon';
favicon.alt = '';
mainRow.appendChild(favicon);
        // Add drag handle
        const dragHandle = document.createElement('span');
        dragHandle.className = 'drag-handle';
        dragHandle.title = 'Drag to reorder';
        dragHandle.innerHTML = '&#x2630;';
        mainRow.appendChild(dragHandle);
        // Limit title length for display
        let displayTitle = tab.title || tab.url;
        const MAX_TITLE_LEN = 60;
        if (displayTitle.length > MAX_TITLE_LEN) {
          displayTitle = displayTitle.slice(0, MAX_TITLE_LEN - 1) + '…';
        }
        const link = document.createElement('a');
        link.href = tab.url;
        link.target = '_blank';
        link.title = tab.title;
        link.textContent = displayTitle;
        link.style.flexGrow = '1';
        link.style.marginRight = '1em';
        mainRow.appendChild(link);
        // Actions
        const actions = document.createElement('div');
        actions.className = 'tab-actions';
        actions.innerHTML = `
            <button class="move-tab-up" data-g="${groupIndex}" data-t="${tabIndex}" title="Move Up">▲</button>
            <button class="move-tab-down" data-g="${groupIndex}" data-t="${tabIndex}" title="Move Down">▼</button>
            <button class="copy-link" data-g="${groupIndex}" data-t="${tabIndex}" title="Copy Link">📋</button>
            <button class="open-tab" data-g="${groupIndex}" data-t="${tabIndex}">↗</button>
            <button class="open-remove-tab" data-g="${groupIndex}" data-t="${tabIndex}" title="Open and Remove">↗🗑</button>
            <button class="delete-tab" data-g="${groupIndex}" data-t="${tabIndex}">🗑</button>
        `;
        mainRow.appendChild(actions);
        item.appendChild(mainRow);

        // Raw link block (always on new line, after main row)
        if (displayRawLinks) {
          const rawBlock = document.createElement('pre');
          rawBlock.className = 'raw-link-block';
          rawBlock.textContent = tab.url;
          item.appendChild(rawBlock);
        }
        list.appendChild(item);
















          // Drag and drop for tab items
          if (!disableDragDrop) {
            item.addEventListener('dragover', e => {
              if (shiftDragDrop && !e.shiftKey) {
                e.preventDefault();
                return false;
              }
              if (!window._dragTab) {
                e.preventDefault();
                return false;
              }
              e.preventDefault();
              item.classList.add('drag-over');
            });
            item.addEventListener('dragleave', () => {
              item.classList.remove('drag-over');
            });
            item.addEventListener('drop', async e => {
              if (shiftDragDrop && !e.shiftKey) {
                e.preventDefault();
                return false;
              }
              item.classList.remove('drag-over');
              if (!window._dragTab) {
                e.preventDefault();
                return false;
              }
              const { g, t } = window._dragTab;
              const targetG = groupIndex;
              const targetT = tabIndex;
              if (g === targetG && t === targetT) return;
              // Always fetch fresh groups before mutating
              let freshGroups = await getGroups();
              const tab = freshGroups[g].tabs.splice(t, 1)[0];
              if (!tab.savedAt) tab.savedAt = Date.now();
              freshGroups[targetG].tabs.splice(targetT, 0, tab);
              await saveGroups(freshGroups);
              freshGroups = await getGroups();
              renderGroups(freshGroups);
            });
          }
        // Add drag handle logic
        const dragHandleElem = mainRow.querySelector('.drag-handle');
        if (dragHandleElem) {
          if (disableDragDrop) {
            dragHandleElem.setAttribute('draggable', 'false');
            dragHandleElem.classList.add('drag-disabled');
            dragHandleElem.onmousedown = null;
            dragHandleElem.onmouseup = null;
            dragHandleElem.ondragstart = null;
            dragHandleElem.ondragend = null;
            if (dragHandleElem._dragStartListener)
              dragHandleElem.removeEventListener('dragstart', dragHandleElem._dragStartListener);
            if (dragHandleElem._dragEndListener)
              dragHandleElem.removeEventListener('dragend', dragHandleElem._dragEndListener);
            item.setAttribute('draggable', 'false');
            item.addEventListener('dragstart', e => { e.preventDefault(); return false; });
            item.addEventListener('dragover', e => { e.preventDefault(); return false; });
          } else {
            dragHandleElem.setAttribute('draggable', 'true');
            dragHandleElem.classList.remove('drag-disabled');
            item.removeAttribute('draggable');
            // Remove previous listeners to avoid duplicates
            if (dragHandleElem._dragStartListener)
              dragHandleElem.removeEventListener('dragstart', dragHandleElem._dragStartListener);
            if (dragHandleElem._dragEndListener)
              dragHandleElem.removeEventListener('dragend', dragHandleElem._dragEndListener);
            if (dragHandleElem._mouseDownListener)
              dragHandleElem.removeEventListener('mousedown', dragHandleElem._mouseDownListener);
            // Attach new listeners
            dragHandleElem._dragStartListener = function(e) {
              if (shiftDragDrop && !e.shiftKey) {
                e.preventDefault();
                dragHandleElem.classList.add('shake');
                dragHandleElem.title = 'Hold Shift to drag';
                setTimeout(() => dragHandleElem.classList.remove('shake'), 400);
                return false;
              }
              window._dragTab = {
                g: groupIndex,
                t: tabIndex
              };
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', '');
              item.classList.add('dragging');
            };
            dragHandleElem._dragEndListener = function() {
              window._dragTab = null;
              item.classList.remove('dragging');
            };
            // Block mousedown if shift is required but not held (prevents drag ghost)
            dragHandleElem._mouseDownListener = function(e) {
              if (shiftDragDrop && !e.shiftKey) {
                e.preventDefault();
                return false;
              }
            };
            dragHandleElem.addEventListener('dragstart', dragHandleElem._dragStartListener);
            dragHandleElem.addEventListener('dragend', dragHandleElem._dragEndListener);
            dragHandleElem.addEventListener('mousedown', dragHandleElem._mouseDownListener);
            // Add shake animation CSS if not present
            if (!document.getElementById('drag-shake-style')) {
              const style = document.createElement('style');
              style.id = 'drag-shake-style';
              style.textContent = `.shake { animation: shake 0.4s; } @keyframes shake { 0% { transform: translateX(0); } 20% { transform: translateX(-4px); } 40% { transform: translateX(4px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } 100% { transform: translateX(0); } }`;
              document.head.appendChild(style);
            }
          }
        }
      });

      panel.appendChild(list);
      container.appendChild(panel);
    });

    // After rendering, re-attach listeners for only the affected group(s)
    getStorage('settings').then(settings => {
      addListeners(groups, { disableDragDrop: settings && settings.disableDragDrop, shiftDragDrop: settings && settings.shiftDragDrop });
    });
  });

  // --- Tab counts ---
  const tabCountsDiv = document.getElementById('tab-counts');
  if (tabCountsDiv) {
    let total = 0;
    groups.forEach(group => { total += group.tabs.length; });
    tabCountsDiv.innerHTML = `<span style="font-weight:bold;font-size:1.1em;color:#1976d2;">Total Tabs: ${total}</span>`;
  }
}

// --- Recently Removed Tabs UI ---
export function renderRecentlyRemovedTabs() {
  window.renderRecentlyRemovedTabs = renderRecentlyRemovedTabs;
  const list = document.getElementById('recently-removed-list');
  if (!list) return;
  list.innerHTML = '<li style="color:#888;font-size:13px;">Loading...</li>';
  chrome.storage.local.get('recentlyRemovedTabs', data => {
    const arr = (data && data.recentlyRemovedTabs) ? data.recentlyRemovedTabs.slice().reverse() : [];
    if (!arr.length) {
      list.innerHTML = '<li style="color:#888;font-size:13px;">No recently removed tabs.</li>';
      return;
    }
    list.innerHTML = '';
    arr.forEach((tab, i) => {
      const li = document.createElement('li');
      li.style.display = 'flex';
      li.style.alignItems = 'center';
      li.style.justifyContent = 'space-between';
      li.style.padding = '2px 0';
      const left = document.createElement('span');
      left.innerHTML = `<strong>${tab.title ? tab.title.replace(/</g,'&lt;').replace(/>/g,'&gt;') : tab.url}</strong> <span style='color:#888;font-size:12px;'>(${tab.group || 'Ungrouped'})</span><br><a href='${tab.url}' target='_blank' style='font-size:12px;'>${tab.url}</a>`;
      li.appendChild(left);
      const restoreBtn = document.createElement('button');
      restoreBtn.textContent = '↗ Restore';
      restoreBtn.title = 'Restore this tab';
      restoreBtn.style.marginLeft = '1em';
      restoreBtn.onclick = () => {
        chrome.tabs.create({ url: tab.url });
      };
      li.appendChild(restoreBtn);
      list.appendChild(li);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  renderRecentlyRemovedTabs();
});

// Listen for storage changes to update UI if tabs/groups are changed elsewhere (e.g. popup or background)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.tabGroups || changes.lastSavedTabs)) {
    getGroups().then(renderGroups);
    renderRecentlyRemovedTabs();
  }
});

// Add overall import button to the main heading
const mainHeading = document.querySelector('h1, .main-heading, header h1');
if (mainHeading && !document.getElementById('import-all-btn')) {
  const importAllBtn = document.createElement('button');
  importAllBtn.id = 'import-all-btn';
  importAllBtn.textContent = 'Import to All';
  importAllBtn.style.marginLeft = '1em';
  mainHeading.appendChild(importAllBtn);
  importAllBtn.addEventListener('click', async () => {
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
      // Extract links and titles in order
      const linkTitlePairs = [];
      // Markdown style [title](url)
      const mdLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
      let match;
      while ((match = mdLinkRegex.exec(text)) !== null) {
        linkTitlePairs.push({ url: match[2], title: match[1] });
      }
      // [[title]] - url
      const imgLinkRegex = /\[\[([^\]]+)\]\]\s*-\s*(https?:\/\/\S+)/g;
      while ((match = imgLinkRegex.exec(text)) !== null) {
        linkTitlePairs.push({ url: match[2], title: match[1] });
      }
      // Fallback: for any url, try to grab previous non-empty line as title
      const urlRegex = /https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+/g;
      const lines = text.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const urls = lines[i].match(urlRegex);
        if (urls) {
          let title = '';
          for (let j = i - 1; j >= 0; j--) {
            if (lines[j].trim() && !urlRegex.test(lines[j])) {
              const mdTitle = lines[j].match(/\[([^\]]+)\]/);
              if (mdTitle) {
                title = mdTitle[1];
              } else {
                title = lines[j].trim();
              }
              break;
            }
          }
          urls.forEach(url => {
            if (!linkTitlePairs.some(pair => pair.url === url)) {
              linkTitlePairs.push({ url, title: title || url });
            }
          });
        }
      }
      if (linkTitlePairs.length === 0) {
        alert('No links found in the selected file.');
        document.body.removeChild(input);
        return;
      }
      // Use saveTabsToGroups for rule-based assignment
      const tabs = await Promise.all(linkTitlePairs.map(async pair => {
        if (pair.title && pair.title.trim() && pair.title !== pair.url) {
          return { url: pair.url, title: pair.title };
        }
        // Try to fetch the title for http/https links
        try {
          if (/^https?:\/{2}/.test(pair.url)) {
            const resp = await fetch(pair.url, { method: 'GET', mode: 'cors' });
            const html = await resp.text();
            const match = html.match(/<title>([^<]*)<\/title>/i);
            if (match && match[1]) {
              return { url: pair.url, title: match[1].trim() };
            }
          }
        } catch (e) { /* ignore fetch errors */ }
        // Fallback: use url as title
        return { url: pair.url, title: pair.url };
      }));
      const { saveTabsToGroups } = await import('./tabUtils.js');
      const { rejected } = await saveTabsToGroups(tabs);
      if (rejected && rejected.length < tabs.length) {
        alert(`Imported ${tabs.length - rejected.length} new link(s).${rejected.length ? ' ' + rejected.length + ' duplicate(s) skipped.' : ''}`);
      } else if (rejected && rejected.length === tabs.length) {
        alert('No new links were imported (all were duplicates).');
      } else {
        alert(`Imported ${tabs.length} new link(s).`);
      }
      // Refresh UI
      const { getGroups } = await import('./groupUtils.js');
      const groups = await getGroups();
      if (typeof window.renderGroups === 'function') window.renderGroups(groups);
      document.body.removeChild(input);
    });
    input.click();
  });
}
