# Privacy

To keep its toolbar icon enabled only on supported sites, the extension reads tab URLs on navigation, tab switching and startup. These checks run locally; URLs are not logged, stored or transmitted by the toolbar logic.

The extension reads the current YouTube video's ID, title, caption languages and caption text when you invoke it. Opening the popup automatically fetches the initially selected caption track; selecting another language requests that track. Caption data and completed transcripts stay in popup memory and are discarded when it closes. Downloading requires a click; a queued download saves only after completion while the popup remains open. Caption requests go directly from your browser to YouTube over HTTPS. The web-player caption request may include your existing YouTube session credentials; the mobile-player fallback omits credentials. The extension does not export browser cookies to the developer or another service.

Transcripts are processed locally and saved only to the location you select through Chromium's download dialog. Saved files remain until you delete them. The extension has no developer-operated backend, analytics, advertising, telemetry or transcript history.

Optional Omarchy theme integration reads selected local appearance settings: theme name, colours, monospace font and shell font size. These values pass through a local native-messaging connection to the popup and are not sent to YouTube or the developer. The bridge runs only while the popup is open.

YouTube receives the requests needed to retrieve captions and handles them under its own privacy policy. Chromium manages download history and permissions under your browser settings. Removing the extension does not delete previously downloaded files; the optional native-host registration can be removed separately as described in the README.
