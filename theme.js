export function applyTheme(theme, root = document.documentElement) {
  for (const key of ['background', 'foreground', 'accent', 'selection']) {
    if (!/^#[\da-f]{6}$/i.test(theme[key] || '')) return false;
  }
  for (const key of ['background', 'foreground', 'accent', 'selection']) root.style.setProperty(`--${key}`, theme[key]);
  const rgb = theme.foreground.match(/[\da-f]{2}/gi).map(n => parseInt(n, 16)).join(' ');
  root.style.setProperty('--foreground-rgb', rgb);
  root.style.colorScheme = theme.mode === 'light' ? 'light' : 'dark';
  if (typeof theme.font === 'string') root.style.setProperty('--font', `${JSON.stringify(theme.font)}, monospace`);
  if (Number.isFinite(theme.fontSize)) root.style.setProperty('--font-size', `${Math.max(10, Math.min(24, theme.fontSize))}px`);
  return true;
}

export function followSystemTheme() {
  const indicator = document.getElementById('theme-status');
  let port, timer, pending = false;
  try {
    port = chrome.runtime.connectNative('local.omarchy.youtube_theme');
    const request = () => {
      if (!pending) { pending = true; port.postMessage({ type: 'get-theme' }); }
    };
    port.onMessage.addListener(message => {
      pending = false;
      if (message.theme && applyTheme(message.theme)) {
        indicator.hidden = true;
        document.documentElement.dataset.theme = message.theme.name;
      } else {
        indicator.hidden = false;
        indicator.textContent = 'System theme temporarily unavailable.';
      }
    });
    port.onDisconnect.addListener(() => {
      const error = chrome.runtime.lastError;
      clearInterval(timer);
      indicator.hidden = false;
      indicator.textContent = 'System theme sync unavailable. See extension setup instructions.';
      indicator.title = error?.message || 'Theme bridge disconnected';
    });
    request();
    timer = setInterval(request, 2000);
    window.addEventListener('pagehide', () => { clearInterval(timer); port.disconnect(); }, { once: true });
  } catch {
    clearInterval(timer);
    indicator.hidden = false;
    indicator.textContent = 'System theme sync unavailable. See extension setup instructions.';
  }
}
