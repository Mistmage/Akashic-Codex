// // storage.js

// // Utility to generate UUIDs for IDs
// function generateUUID() {
//   // Simple UUID v4 generator (not cryptographically strong, but sufficient here)
//   return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
//     const r = (Math.random() * 16) | 0,
//       v = c === 'x' ? r : (r & 0x3) | 0x8;
//     return v.toString(16);
//   });
// }

// /** TabEntry model */
// class TabEntry {
//   constructor({ id, url, title, favIconUrl, savedAt, lastAccessed }) {
//     this.id = id || generateUUID();
//     this.url = url;
//     this.title = title;
//     this.favIconUrl = favIconUrl || null;
//     this.savedAt = savedAt || Date.now();
//     this.lastAccessed = lastAccessed || null;
//   }
// }

// /** Rule model */
// class Rule {
//   constructor({ urlPattern, titlePattern }) {
//     this.urlPattern = urlPattern || null; // string regex
//     this.titlePattern = titlePattern || null; // string regex
//   }

//   matches(tab) {
//     try {
//       if (this.urlPattern) {
//         const re = new RegExp(this.urlPattern, 'i');
//         if (!re.test(tab.url)) return false;
//       }
//       if (this.titlePattern) {
//         const re = new RegExp(this.titlePattern, 'i');
//         if (!re.test(tab.title)) return false;
//       }
//       return true;
//     } catch {
//       // Invalid regex treated as no match
//       return false;
//     }
//   }
// }

// /** Group model */
// class Group {
//   constructor({
//     id,
//     name,
//     created,
//     tabs,
//     whitelistRules,
//     blacklistRules,
//     exportPath,
//     exportTemplate,
//     exportOnSave,
//     exportMode,
//     lastExportedAt,
//   }) {
//     this.id = id || generateUUID();
//     this.name = name || 'New Group';
//     this.created = created || Date.now();

//     this.tabs = tabs ? tabs.map(t => new TabEntry(t)) : [];

//     this.whitelistRules = whitelistRules
//       ? whitelistRules.map(r => new Rule(r))
//       : [];
//     this.blacklistRules = blacklistRules
//       ? blacklistRules.map(r => new Rule(r))
//       : [];

//     this.exportPath = exportPath || '';
//     this.exportTemplate =
//       exportTemplate ||
//       '# {{group.name}}\n\nSaved on {{timestamp}}\n\n{{#each tabs}}\n- [{{tab.title}}]({{tab.url}})\n{{/each}}';
//     this.exportOnSave = exportOnSave || false;

//     // 'appendNew' | 'appendAll' | 'overwrite' | 'appendRecent'
//     this.exportMode = exportMode || 'appendNew';

//     this.lastExportedAt = lastExportedAt || null;
//   }

//   matchesTab(tab) {
//     // If blacklisted, exclude
//     if (this.blacklistRules.some(rule => rule.matches(tab))) return false;
//     // If no whitelist rules, default true
//     if (this.whitelistRules.length === 0) return true;
//     // Else matches if any whitelist rule matches
//     return this.whitelistRules.some(rule => rule.matches(tab));
//   }

//   addTab(tab) {
//     if (this.tabs.find(t => t.url === tab.url)) return; // avoid duplicates by url
//     this.tabs.push(new TabEntry(tab));
//   }

//   removeTab(tabId) {
//     this.tabs = this.tabs.filter(t => t.id !== tabId);
//   }
// }

// /** Global settings */
// class GlobalSettings {
//   constructor({
//     removeOnOpen = false,
//     closeOnSaveTab = false,
//     closeOnSaveAll = false,
//     popupCount = 5,
//     defaultExportPath = '',
//     defaultExportTemplate =
//       '# {{group.name}}\n\nSaved on {{timestamp}}\n\n{{#each tabs}}\n- [{{tab.title}}]({{tab.url}})\n{{/each}}',
//     undoHistorySize = 20,
//     exportMode = 'appendNew',
//     obsidianIntegration = false,
//     obsidianApiKey = '',
//     obsidianEndpoint = '',
//   } = {}) {
//     this.removeOnOpen = removeOnOpen;
//     this.closeOnSaveTab = closeOnSaveTab;
//     this.closeOnSaveAll = closeOnSaveAll;
//     this.popupCount = popupCount;
//     this.defaultExportPath = defaultExportPath;
//     this.defaultExportTemplate = defaultExportTemplate;
//     this.undoHistorySize = undoHistorySize;
//     this.exportMode = exportMode;
//     this.obsidianIntegration = obsidianIntegration;
//     this.obsidianApiKey = obsidianApiKey;
//     this.obsidianEndpoint = obsidianEndpoint;
//   }
// }

// /** Undo entry for undo stack */
// class UndoEntry {
//   constructor(groupsSnapshot) {
//     this.timestamp = Date.now();
//     this.groupsSnapshot = JSON.parse(JSON.stringify(groupsSnapshot)); // deep clone
//   }
// }

// /** Main Storage Manager */
// class StorageManager {
//   constructor() {
//     this.GROUPS_KEY = 'tabSaverPro_groups';
//     this.SETTINGS_KEY = 'tabSaverPro_settings';
//     this.UNDO_KEY = 'tabSaverPro_undoStack';

//     /** @type {Group[]} */
//     this.groups = [];

//     /** @type {GlobalSettings} */
//     this.settings = new GlobalSettings();

//     /** @type {UndoEntry[]} */
//     this.undoStack = [];
//   }

//   async load() {
//     return new Promise(resolve => {
//       chrome.storage.local.get(
//         [this.GROUPS_KEY, this.SETTINGS_KEY, this.UNDO_KEY],
//         result => {
//           if (result[this.GROUPS_KEY]) {
//             this.groups = result[this.GROUPS_KEY].map(g => new Group(g));
//           }
//           if (result[this.SETTINGS_KEY]) {
//             this.settings = new GlobalSettings(result[this.SETTINGS_KEY]);
//           }
//           if (result[this.UNDO_KEY]) {
//             this.undoStack = result[this.UNDO_KEY];
//           }
//           resolve();
//         }
//       );
//     });
//   }

//   async save() {
//     return new Promise(resolve => {
//       chrome.storage.local.set(
//         {
//           [this.GROUPS_KEY]: this.groups,
//           [this.SETTINGS_KEY]: this.settings,
//           [this.UNDO_KEY]: this.undoStack,
//         },
//         () => resolve()
//       );
//     });
//   }

//   pushUndo() {
//     this.undoStack.push(new UndoEntry(this.groups));
//     if (this.undoStack.length > this.settings.undoHistorySize) {
//       this.undoStack.shift();
//     }
//   }

//   undo() {
//     if (this.undoStack.length === 0) return false;
//     const last = this.undoStack.pop();
//     this.groups = last.groupsSnapshot.map(g => new Group(g));
//     return true;
//   }

//   findGroupForTab(tab) {
//     // Bottom-up group matching
//     for (let i = this.groups.length - 1; i >= 0; i--) {
//       if (this.groups[i].matchesTab(tab)) return this.groups[i];
//     }
//     return null;
//   }

//   createGroup(name) {
//     const g = new Group({ name });
//     this.groups.push(g);
//     return g;
//   }

//   addTab(tab) {
//     let group = this.findGroupForTab(tab);
//     if (!group) {
//       group = this.createGroup('New Group');
//     }
//     group.addTab(tab);
//   }

//   removeTab(tabId) {
//     this.groups.forEach(group => group.removeTab(tabId));
//   }
// }

// const storageManager = new StorageManager();

// // Initialize on load
// (async () => {
//   await storageManager.load();
//   console.log('Tab Saver Pro storage loaded');
// })();

// export { TabEntry, Rule, Group, GlobalSettings, UndoEntry, storageManager };



// storage.js

export function getStorage(key) {
  return new Promise(resolve => {
    chrome.storage.local.get(key, result => {
      resolve(result[key]);
    });
  });
}

export function setStorage(key, value) {
  return new Promise(resolve => {
    chrome.storage.local.set({ [key]: value }, () => resolve());
  });
}

export function removeStorage(key) {
  return new Promise(resolve => {
    chrome.storage.local.remove(key, () => resolve());
  });
}
