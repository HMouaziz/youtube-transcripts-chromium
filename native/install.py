#!/usr/bin/env python3
"""Register the read-only bridge for this unpacked Chromium extension."""
import argparse
import hashlib
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--user-data-dir', type=Path, default=Path.home() / '.config/chromium')
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    digest = hashlib.sha256(str(root).encode()).hexdigest()[:32]
    extension_id = ''.join(chr(ord('a') + int(c, 16)) for c in digest)
    host = root / 'native/theme_host.py'
    host.chmod(0o755)
    manifest = {
        'name': 'local.omarchy.youtube_theme',
        'description': 'Read active Omarchy theme for YouTube Transcript Download',
        'path': str(host), 'type': 'stdio',
        'allowed_origins': [f'chrome-extension://{extension_id}/'],
    }
    destination = args.user_data_dir.expanduser() / 'NativeMessagingHosts/local.omarchy.youtube_theme.json'
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and json.loads(destination.read_text()) != manifest:
        raise SystemExit(f'Refusing to overwrite a different registration: {destination}')
    if not destination.exists():
        with destination.open('x') as handle:
            json.dump(manifest, handle, indent=2)
            handle.write('\n')
    print(f'Registered {destination}\nExtension ID: {extension_id}')


if __name__ == '__main__':
    main()
