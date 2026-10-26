// Chromium handles matching and greys out the disabled toolbar icon itself.
// Exact hosts avoid enabling the action on unrelated YouTube subdomains.
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.action.disable();
  chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError.message);
      return;
    }
    chrome.declarativeContent.onPageChanged.addRules([{
      id: 'youtube-only',
      conditions: ['youtube.com', 'www.youtube.com', 'm.youtube.com'].map(hostEquals =>
        new chrome.declarativeContent.PageStateMatcher({
          pageUrl: { schemes: ['https'], hostEquals }
        })
      ),
      actions: [new chrome.declarativeContent.ShowAction()]
    }], () => {
      if (chrome.runtime.lastError) console.error(chrome.runtime.lastError.message);
    });
  });
});

// Declarative rules persist; restore the disabled default each browser session.
chrome.runtime.onStartup.addListener(() => chrome.action.disable());
