// groupUtils.js

const STORAGE_KEY = 'tabSaverGroups';

export async function getGroups() {
  const data = await chrome.storage.local.get([STORAGE_KEY]);
  return data[STORAGE_KEY] || [];
}

export async function saveGroups(groups) {
  await chrome.storage.local.set({ [STORAGE_KEY]: groups });
}

export async function addGroup(name = 'New Group') {
  const groups = await getGroups();
  groups.push({
    name,
    tabs: [],
    rules: {
      whitelist: { title: [], url: [] },
      blacklist: { title: [], url: [] },
      matchAll: true
    },
    exportPath: '',
    exportTemplate: '* [[${title}]] - ${url}',
    exportMode: 'append-all' // append-new | append-all | overwrite | append-recent
  });
  await saveGroups(groups);
}

// groupUtils.js snippet

export async function saveTabToGroup(tab, groupIndex) {
  const groups = await getGroups();
  const group = groups[groupIndex];
  if (!group) {
    console.error(`Group at index ${groupIndex} not found`);
    return false;
  }
  // Check if tab already exists by URL
  const exists = group.tabs.some(t => t.url === tab.url);
  if (!exists) {
    group.tabs.push({ title: tab.title || '', url: tab.url || '' });
    await saveGroups(groups);
    console.log(`Tab added to group ${group.name}:`, tab);
    return true;
  } else {
    console.log(`Tab already exists in group ${group.name}:`, tab.url);
    return false;
  }
}


export async function applyRulesToTab(tab) {
  const groups = await getGroups();
  for (let i = groups.length - 1; i >= 0; i--) {
    const { rules } = groups[i];
    if (matchTabAgainstRules(tab, rules)) {
      return i;
    }
  }
  await addGroup('Auto Group');
  const updated = await getGroups();
  return updated.length - 1;
}

function matchTabAgainstRules(tab, rules) {
  const { whitelist, blacklist, matchAll } = rules;
  const { title, url } = tab;

  const match = (regexList, value) => regexList.some(pattern => new RegExp(pattern).test(value));

  if (blacklist.title.some(r => match([r], title)) || blacklist.url.some(r => match([r], url))) {
    return false;
  }

  if (!whitelist.title.length && !whitelist.url.length) return true;

  const titleMatch = match(whitelist.title, title);
  const urlMatch = match(whitelist.url, url);

  return matchAll ? (titleMatch && urlMatch) : (titleMatch || urlMatch);
}

export async function exportGroupToMarkdown(index) {
  const groups = await getGroups();
  const group = groups[index];
  if (!group) return;

  const global = await chrome.storage.local.get(['globalSettings']);
  const settings = global.globalSettings || {};

  const template = group.exportTemplate || '* [[${title}]] - ${url}';
  const lines = group.tabs.map(tab => template.replace('${title}', tab.title).replace('${url}', tab.url));
  const content = lines.join('\n');

  if (settings.useObsidianAPI) {
    const res = await fetch(settings.obsidianAPIEndpoint, {
      method: 'POST',
      headers: { 'Authorization': settings.obsidianAPIKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: group.exportPath || 'tabs.md',
        content,
        mode: group.exportMode
      })
    });
    if (!res.ok) {
      console.error('Obsidian API export failed', res.statusText);
    }
  } else {
    const blob = new Blob([content], { type: 'text/markdown' });
    chrome.downloads.download({
      url: URL.createObjectURL(blob),
      filename: group.exportPath || 'tabs.md',
      saveAs: false
    });
  }
}
