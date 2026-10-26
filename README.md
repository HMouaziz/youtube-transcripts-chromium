# YouTube Transcript Download for Chromium

A small, MIT-licensed Chromium extension that saves YouTube captions as TXT, JSON, SRT, or VTT, with optional automatic Omarchy theme matching. Independent community project; not affiliated with YouTube or Omarchy.

## Install

```bash
git clone https://github.com/HMouaziz/youtube-transcripts-chromium.git
cd youtube-transcripts-chromium
```

1. Open `chrome://extensions` in Chromium.
2. Enable **Developer mode**.
3. Choose **Load unpacked**, then select this directory.
4. Open a YouTube video, click the extension, choose a language and format, and download.

The pinned icon is coloured and enabled on HTTPS YouTube pages (`youtube.com`, `www.youtube.com`, and `m.youtube.com`). Elsewhere the extension explicitly uses a grey icon and disables its action; clicking the disabled icon opens Chromium's extension menu. Pinning remains under your control. After updating, reload the extension in `chrome://extensions`.

No server, API key, or build step. The extension only accesses the current tab when invoked. It uses Chromium's download dialog and retrieves existing captions directly from YouTube. It does not send data to another service.

## Follow the Omarchy theme

Register the local theme bridge once using system Python 3.11 or later:

```bash
python3 native/install.py
```

Reload the extension in `chrome://extensions` after updating it. The popup reads the active Omarchy palette, fontconfig monospace family, and shell font size on opening and every two seconds while open. Light and dark themes are supported. The bridge exits when the popup closes; no daemon, hook, network service, or system-theme edits are needed.

The installer writes `~/.config/chromium/NativeMessagingHosts/local.omarchy.youtube_theme.json`. The bridge accepts only a fixed `get-theme` request and returns selected appearance values; it cannot execute requested commands or read requested paths. Access is restricted to this unpacked extension's ID. If you move the extension directory, update the registration for its new ID after inspecting the old manifest. A custom Chromium user-data directory can be specified with `--user-data-dir PATH`.

Without the bridge, the popup uses browser system colours and shows a setup notice; downloads still work. Native messaging requires the additional `nativeMessaging` permission. To remove the integration, remove its single native-host registration file.

Captions must be available on the video. YouTube may block timed-caption requests; errors are shown in the popup. YouTube's internal player interface can change, so this extension may need updates. Keep the popup open while fetching.

Permissions: `activeTab` for the selected video, `scripting` to read its caption metadata, `downloads` to save a file, `nativeMessaging` for the local read-only theme bridge, `tabs` to check the hostname on navigation and tab switching, and `declarativeContent` to remove the old toolbar rules during upgrades. Tab URLs are checked locally and are not stored or sent to the developer. No persistent site access.

## Tests

Requires Node.js and Python 3.11 or later. No dependency installation is needed.

```bash
node tests/check.mjs
node tests/failures.mjs
node tests/toolbar.mjs
python3 tests/theme_test.py
```

See [release notes and planned improvements](RELEASE.md), [privacy](PRIVACY.md), and the [MIT licence](LICENSE).
