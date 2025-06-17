// extraUtils.js

export function renderGroupTabs(group, groupIndex, settings) {
  const panel = document.querySelectorAll('.group-panel')[groupIndex];
  if (!panel) return;
  const oldList = panel.querySelector('.tab-list');
  if (!oldList) return;
  const newList = document.createElement('ul');
  newList.className = 'tab-list';
  const displayRawLinks = settings && settings.displayRawLinks;
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
    // Main row: favicon, handle, link, actions
    const mainRow = document.createElement('div');
    mainRow.className = 'tab-main-row';
    mainRow.style.display = 'flex';
    mainRow.style.flexDirection = 'row';
    mainRow.style.alignItems = 'center';
    mainRow.style.width = '100%';
    // Add favicon
  let hostname = '';
try {
  hostname = new URL(tab.url).hostname;
} catch {
  hostname = '';
}

const faviconUrl = hostname
  ? 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(hostname)
  : ''; // or a fallback URL if you want

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
    newList.appendChild(item);
  });
  oldList.replaceWith(newList);
}

export function updateGroupDOM(groupIndex) {
  import('./groupUtils.js').then(({ getGroups }) => {
    import('./storage.js').then(({ getStorage }) => {
      import('./listeners.js').then(({ addListeners }) => {
        getGroups().then(groups => {
          getStorage('settings').then(settings => {
            renderGroupTabs(groups[groupIndex], groupIndex, settings);
            addListeners(groups, settings);
          });
        });
      });
    });
  });
}