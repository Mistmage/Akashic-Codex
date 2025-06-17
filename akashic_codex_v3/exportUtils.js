import { getGroups, saveGroups } from './groupUtils.js';
import { getStorage } from './storage.js';

const LAST_TABS_KEY = 'lastSavedTabs';

export async function saveCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    await saveTabsToGroups([tab]);
    await updateLastTabsList([tab]);
  }
}

export async function saveAllTabs() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  if (tabs && tabs.length > 0) {
    await saveTabsToGroups(tabs);
    await updateLastTabsList(tabs);
  }
}

async function saveTabsToGroups(tabs) {
  const groups = await getGroups();

  for (const tab of tabs) {
    let matched = false;
    const tabWithTimestamp = { title: tab.title, url: tab.url, savedAt: Date.now() };
    for (let i = groups.length - 1; i >= 0; i--) {
      const group = groups[i];
      if (matchTabToGroup(tab, group)) {
        if (!group.tabs) group.tabs = [];
        group.tabs.push(tabWithTimestamp);
        matched = true;
        break;
      }
    }

    if (!matched) {
      const newGroup = {
        name: 'Ungrouped',
        rules: { whitelist: { title: [], url: [] }, blacklist: { title: [], url: [] } },
        tabs: [tabWithTimestamp],
        exportPath: '',
        exportTemplate: '* [[${title}]] - ${url}',
        exportMode: 'append-all',
      };
      groups.push(newGroup);
    }
  }

  await saveGroups(groups);
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
  const settings = await getStorage("settings") || {};
  const maxTabs = settings.popupTabCount || 5;

  const stored = await chrome.storage.local.get(LAST_TABS_KEY);
  const current = stored[LAST_TABS_KEY] || [];

  const newTabs = tabs.map(tab => ({ title: tab.title, url: tab.url }));
  const combined = [...newTabs, ...current].slice(0, maxTabs);

  await chrome.storage.local.set({ [LAST_TABS_KEY]: combined });
}

export async function getLastSavedTabs() {
  const stored = await chrome.storage.local.get(LAST_TABS_KEY);
  return stored[LAST_TABS_KEY] || [];
}

export async function exportGroupToMarkdown(groupIndex) {
  console.log("exportGroupToMarkdown called", groupIndex);
  const groups = await getGroups();
  const group = groups[groupIndex];
  if (!group) return;

  // Prepare export context
  const now = new Date();
  const timestamp = now.toISOString();
  const context = {
    group,
    timestamp,
    tabs: group.tabs,
  };

  // Template rendering
  let template = group.exportTemplate || '* [[${title}]] - ${url}';
  // Support for variables: {{group.name}}, {{timestamp}}, {{#each tabs}}...{{/each}}, {{#special}}...{{/special}}
  let output = '';
  // Handle special block
  if (template.includes('{{#special}}')) {
    const specialBlock = template.match(/{{#special}}([\s\S]*?){{\/special}}/);
    if (specialBlock) {
      // Example: Replace with a summary (customize as needed)
      const specialContent = specialBlock[1]
        .replace(/{{tabCount}}/g, group.tabs.length)
        .replace(/{{group.name}}/g, group.name)
        .replace(/{{timestamp}}/g, timestamp);
      template = template.replace(/{{#special}}([\s\S]*?){{\/special}}/, specialContent);
    }
  }
  if (template.includes('{{#each tabs}}')) {
    // Handlebars-like each block
    const eachBlock = template.match(/{{#each tabs}}([\s\S]*?){{\/each}}/);
    if (eachBlock) {
      const inner = eachBlock[1];
      output = template.replace(/{{#each tabs}}([\s\S]*?){{\/each}}/,
        group.tabs.map((tab, idx) => {
          return inner
            .replace(/{{tab.title}}/g, tab.title)
            .replace(/{{tab.url}}/g, tab.url)
            .replace(/{{group.name}}/g, group.name)
            .replace(/{{timestamp}}/g, timestamp)
            .replace(/{{Counter}}/g, idx + 1);
        }).join('')
      );
    }
  } else {
    // Simple template, one line per tab
    output = group.tabs.map((tab, idx) => {
      let line = group.exportTemplate || '* [[${title}]] - ${url}';
      line = line.replace(/{{tab.title}}|\${title}/g, tab.title)
                 .replace(/{{tab.url}}|\${url}/g, tab.url)
                 .replace(/{{group.name}}/g, group.name)
                 .replace(/{{timestamp}}/g, timestamp)
                 .replace(/{{Counter}}/g, idx + 1);
      return line;
    }).join('\n');
  }
  // Add header/footer if needed
  if (group.exportTemplate && group.exportTemplate.includes('{{group.name}}')) {
    output = output.replace(/{{group.name}}/g, group.name);
  }
  if (group.exportTemplate && group.exportTemplate.includes('{{timestamp}}')) {
    output = output.replace(/{{timestamp}}/g, timestamp);
  }

  // Export mode logic
  const mode = group.exportMode || 'append-all';
  let previousContent = '';
  let exportedTabs = [];
  let filePath = group.exportPath || `${group.name}.md`;
  let lastExportedAt = group.lastExportedAt || 0;

  // If obsidian integration is enabled, POST to Obsidian
  const settings = await getStorage('settings') || {};
  const obsidianEnabled = settings.obsidianEnabled;
  const obsidianApiKey = settings.obsidianApiKey;
  const obsidianApiPath = settings.obsidianApiPath;

  // If not obsidian, use download
  async function downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  // Always ensure .md extension for Obsidian export path in all modes
  let fixedFilePath = filePath.trim();
  if (!fixedFilePath.toLowerCase().endsWith('.md')) {
    fixedFilePath += '.md';
  }

  // Read previous file content if needed (for append-new/append-recent)
  async function getPreviousContent() {
    // For Obsidian, fetch file content via API if possible
    if (obsidianEnabled && obsidianApiKey && obsidianApiPath) {
      try {
        const encodedPrevPath = fixedFilePath.split('/').map(encodeURIComponent).join('/');
        const basePrev = obsidianApiPath.replace(/\/+$/, '');
        const urlPrev = `${basePrev}/vault/${encodedPrevPath}`;
        const resp = await fetch(urlPrev, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${obsidianApiKey}`,
            'accept': 'application/vnd.olrapi.note+json'
          }
        });
        if (resp.ok) {
          const data = await resp.json();
          // Try to extract content from known fields
          if (data && (data.content || data.body)) {
            return data.content || data.body;
          }
        }
      } catch (e) {}
    }
    // For download, cannot read previous file, so skip
    return '';
  }

  if (mode === 'append-new' || mode === 'append-recent') {
    previousContent = await getPreviousContent();
    // MIGRATION: Ensure all tabs have savedAt
    let didMigrate = false;
    group.tabs.forEach(tab => {
      if (!tab.savedAt) {
        tab.savedAt = Date.now();
        didMigrate = true;
      }
    });
    if (didMigrate) {
      await saveGroups(groups);
    //   console.log('Migrated missing savedAt for group', group.name);
    }
    // Only add tabs not already present in previousContent (by URL)
    if (mode === 'append-new') {
      const existingUrls = new Set();
      if (previousContent) {
        const urlRegex = /https?:\/\/[^\s)\]]+/g;
        let matches = previousContent.match(urlRegex);
        if (matches) {
          matches.forEach(url => existingUrls.add(url));
        }
      }
      exportedTabs = group.tabs.filter(tab => !existingUrls.has(tab.url));
      // Debug logging
      console.log('[append-new] previousContent:', previousContent);
      console.log('[append-new] existingUrls:', Array.from(existingUrls));
      console.log('[append-new] group.tabs:', group.tabs);
      console.log('[append-new] exportedTabs:', exportedTabs);
      output = exportedTabs.map(tab => {
        let line = group.exportTemplate || '* [[${title}]] - ${url}';
        line = line.replace(/{{tab.title}}|\${title}/g, tab.title)
                   .replace(/{{tab.url}}|\${url}/g, tab.url)
                   .replace(/{{group.name}}/g, group.name)
                   .replace(/{{timestamp}}/g, timestamp);
        return line;
      }).join('\n');
      if (output) output = previousContent + (previousContent ? '\n' : '') + output;
      else output = previousContent;
    } else if (mode === 'append-recent') {
      // Only add tabs saved since lastExportedAt
      // Debug logging
      console.log('[append-recent] lastExportedAt:', lastExportedAt);
      console.log('[append-recent] group.tabs:', group.tabs);
      exportedTabs = group.tabs.filter(tab => {
        // If tab.savedAt is missing, treat as old (do not include)
        return tab.savedAt && tab.savedAt > lastExportedAt;
      });
      console.log('[append-recent] exportedTabs:', exportedTabs);
      if (exportedTabs.length > 0) {
        output = exportedTabs.map(tab => {
          let line = group.exportTemplate || '* [[${title}]] - ${url}';
          line = line.replace(/{{tab.title}}|\${title}/g, tab.title)
                     .replace(/{{tab.url}}|\${url}/g, tab.url)
                     .replace(/{{group.name}}/g, group.name)
                     .replace(/{{timestamp}}/g, timestamp);
          return line;
        }).join('\n');
        output = previousContent + (previousContent ? '\n' : '') + output;
      } else {
        // No recent tabs, just return previous content
        output = previousContent;
      }
    }
  } else if (mode === 'overwrite') {
    // Overwrite: just use output as is
    // (already set above)
  } else {
    // append-all: always append all tabs
    previousContent = await getPreviousContent();
    // Generate output for all tabs using the template
    output = group.tabs.map(tab => {
      let line = group.exportTemplate || '* [[${title}]] - ${url}';
      line = line.replace(/{{tab.title}}|\${title}/g, tab.title)
                 .replace(/{{tab.url}}|\${url}/g, tab.url)
                 .replace(/{{group.name}}/g, group.name)
                 .replace(/{{timestamp}}/g, timestamp);
      return line;
    }).join('\n');
    output = previousContent + (previousContent && output ? '\n' : '') + output;
  }

  // Export: PUT to Obsidian REST API or download
  if (obsidianEnabled && obsidianApiKey && obsidianApiPath) {
    try {
      const encodedPath = fixedFilePath.split('/').map(encodeURIComponent).join('/');
      const base = obsidianApiPath.replace(/\/+$/, '');
      const url = `${base}/vault/${encodedPath}`;

      // Debug: log export details
      console.log('Obsidian Export URL:', url);
      console.log('Obsidian Export Headers:', {
        'Authorization': `Bearer ${obsidianApiKey}`,
        'Content-Type': 'text/markdown',
        'accept': '*/*'
      });
      console.log('Obsidian Export Body:', output);

      const resp = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${obsidianApiKey}`,
          'Content-Type': 'text/markdown',
          'accept': '*/*'
        },
        body: output
      });
      console.log("Fetch completed", resp);
      if (!resp.ok) {
        const errText = await resp.text();
        alert('Obsidian export failed: ' + resp.status + ' ' + errText);
        console.error('Obsidian export error:', resp.status, errText);
        return;
      }
    } catch (e) {
      alert('Failed to connect to Obsidian REST API. Check your settings and that the API server is running.');
      console.error('Obsidian export fetch error:', e);
      throw e;
    }
  } else {
    // Save file with group name as filename (add .md if not present)
    let safeGroupName = group.name.trim().replace(/[/\\?%*:|"<>]/g, '_');
    let filename = safeGroupName.endsWith('.md') ? safeGroupName : safeGroupName + '.md';
    await downloadFile(filename, output);
  }

  // Update lastExportedAt
  group.lastExportedAt = Date.now();
  await saveGroups(groups);
}