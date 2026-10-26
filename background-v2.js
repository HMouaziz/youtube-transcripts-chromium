export function isSupported(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(parsed.hostname);
  } catch { return false; }
}

// Serialize updates per tab so an older navigation cannot overwrite a newer one.
const updates = new Map();
export function refreshTab(tabId) {
  const previous = updates.get(tabId) || Promise.resolve();
  const next = previous.catch(() => {}).then(async () => {
    try {
      const tab = await chrome.tabs.get(tabId);
      const supported = isSupported(tab.pendingUrl || tab.url);
      await chrome.action.disable(tabId);
      await chrome.action.setIcon({tabId, path: supported
        ? {16:'icons/icon-16.png', 32:'icons/icon-32.png'}
        : {16:'icons/disabled-16.png', 32:'icons/disabled-32.png'}});
      await chrome.action.setPopup({tabId, popup: supported ? 'popup.html' : ''});
      await chrome.action.setTitle({tabId, title: supported ? 'Download YouTube transcript' : 'Available on YouTube only'});
      if (supported) await chrome.action.enable(tabId);
    } catch (error) { console.warn('Toolbar update failed:', error.message); }
  });
  updates.set(tabId, next);
  next.finally(() => { if (updates.get(tabId) === next) updates.delete(tabId); });
  return next;
}

async function initialize() {
  await chrome.action.disable();
  // Remove persisted rules from v1.1.2; they must not override explicit states.
  await new Promise(resolve => chrome.declarativeContent.onPageChanged.removeRules(undefined, resolve));
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map(tab => refreshTab(tab.id)));
}
chrome.runtime.onInstalled.addListener(initialize);
chrome.runtime.onStartup.addListener(initialize);
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.url !== undefined || change.status) return refreshTab(tabId);
});
chrome.tabs.onActivated.addListener(({tabId}) => refreshTab(tabId));
chrome.tabs.onCreated.addListener(tab => refreshTab(tab.id));
chrome.tabs.onReplaced.addListener(tabId => refreshTab(tabId));
