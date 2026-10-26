# Release readiness — 26 October 2026

Initial open-source repository release under the MIT licence. Installation currently uses Chromium’s Load unpacked control; an Omarchy installer and Web Store distribution remain possible future improvements.

## Verified

- Real caption retrieval in isolated Chromium during initial development.
- Native theme bridge reading the installed Last Horizon palette and font.
- An open popup following a dark-to-light fixture theme change without changing the desktop theme.
- TXT, JSON, SRT and VTT formatting, Unicode, timestamps, filename path sanitization and byte limits.
- No captions, unsupported sites, stale player metadata, invalid track selection, untrusted caption URL rejection, HTTP 429 without retry, timeout, malformed response, and matching language/type in the fallback.
- Native-message framing, UTF-8 responses, unsupported-operation rejection and shell font-size overrides.

Run the automated checks:

```sh
node tests/check.mjs
node tests/failures.mjs
python3 tests/theme_test.py
```

The live-browser checks were development smoke tests, not a portable CI suite. Failure cases above mostly use fixtures. They do not prove compatibility across YouTube clients, accounts, or video categories.

## Planned improvements

- Give the extension a stable public-key-based ID. The current native registration derives its ID from the absolute unpacked path; coordinate migration so existing installations keep working.
- Add a user-level installer and uninstaller that preserve unrelated Chromium flags and native hosts. Test clean installation, upgrades, relocation and removal.
- Bring browser smoke tests into the repository; exercise actual save/cancel flows and popup closure during requests.
- Test manual and automatic captions, multiple languages including RTL, Shorts, long videos, disabled captions, signed-out use, and unavailable/restricted videos. Stop on access restrictions.
- Verify live automatic-caption segments for rolling-text duplication and overlapping cues.
- Check Chromium versions, popup size/keyboard navigation, missing Python/native host, theme changes, and malformed theme files.
- Keep generated transcripts, private keys, browser profiles and caches out of the source release.

## Omarchy integration

The inspected Omarchy installation loads its Chromium extensions using `--load-extension` in chromium-flags.conf. Copy URL and Download Video also register native messaging hosts and have stable manifest keys. These are Chromium extensions, not Quickshell plugins.

A community installer can use a user-owned extension directory and preserve the existing extension list. Do not write to `/usr/share/omarchy`. Bundling with Omarchy itself would require maintainer acceptance. The new icon is original SVG artwork using the bundled extensions' green monochrome visual style; it does not imply official endorsement.

## Distribution and legal review

- YouTube's [UK Terms](https://www.youtube.com/static?template=terms&gl=GB), Permissions and Restrictions, constrain downloading and automated access, with stated exceptions. Current code uses internal caption/player endpoints and an Android-client fallback, not the official caption-download API. Review that implementation before a public release; working access is not proof of permission.
- The [official caption download API](https://developers.google.com/youtube/data/reference/rest/v3/captions/download) requires authorization and permission to edit the video, so switching to it changes the product's scope.
- Copyright in the transcript's content is separate from the extension's code license. The UK IPO's [exceptions guidance](https://www.gov.uk/guidance/exceptions-to-copyright) describes conditional, limited uses; private study is not blanket permission to reproduce or redistribute full works.
- The Web Store's [IP and impersonation rules](https://developer.chrome.com/docs/webstore/program-policies/impersonation-and-intellectual-property) prohibit infringement and false endorsement. Use independent branding and explain compatibility with YouTube/Omarchy without claiming affiliation.
- The [user-data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq) requires disclosure even for locally handled data. A store listing needs accurate privacy disclosures and permission justifications.
- The [native messaging host](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging) needs a separate OS registration. A store install alone would not install our theme bridge; make that integration optional and disclose setup requirements.

Repository distribution avoids Web Store review, not copyright or contractual concerns. This is a release-risk assessment, not legal clearance; obtain jurisdiction-specific advice before a consequential commercial launch.
