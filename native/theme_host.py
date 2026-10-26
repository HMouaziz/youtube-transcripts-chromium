#!/usr/bin/python3
"""Read-only Omarchy theme bridge. Accepts only the get-theme operation."""
import json
from pathlib import Path
import re
import struct
import subprocess
import sys
import tomllib
import xml.etree.ElementTree as ET


def read_toml(path):
    try:
        return tomllib.loads(path.read_text())
    except FileNotFoundError:
        return {}


def snapshot(home=None):
    home = home or Path.home()
    state = home / '.local/state/omarchy/current'
    if not (state / 'theme/colors.toml').exists():
        state = home / '.config/omarchy/current'
    colors = read_toml(state / 'theme/colors.toml')
    if not colors:
        raise ValueError('No active Omarchy theme found')
    shell = read_toml(state / 'theme/shell.toml')
    for section, values in read_toml(home / '.config/omarchy/shell.toml').items():
        if isinstance(values, dict):
            shell.setdefault(section, {}).update(values)
    def color(value, fallback):
        return value if isinstance(value, str) and re.fullmatch(r'#[0-9a-fA-F]{6}', value) else fallback
    background = color(shell.get('menu', {}).get('background'), color(colors.get('background'), '#17191e'))
    foreground = color(shell.get('menu', {}).get('text'), color(colors.get('foreground'), '#f2f3f6'))
    # Derive light/dark from the actual surface, including user overrides.
    rgb = [int(background[i:i+2], 16) / 255 for i in (1, 3, 5)]
    luminance = sum(c * w for c, w in zip(rgb, (.2126, .7152, .0722)))
    font = 'monospace'
    font_file = home / '.config/fontconfig/fonts.conf'
    try:
        root = ET.parse(font_file).getroot()
        for match in root.findall('match'):
            if any(test.get('name') == 'family' and test.findtext('string') == 'monospace' for test in match.findall('test')):
                for edit in match.findall('edit'):
                    if edit.get('name') == 'family' and edit.findtext('string'):
                        font = edit.findtext('string')[:128]
    except (FileNotFoundError, ET.ParseError):
        pass
    if font == 'monospace':
        try:
            font = subprocess.run(['/usr/bin/fc-match', '-f', '%{family[0]}', 'monospace'],
                                  capture_output=True, text=True, check=True, timeout=1).stdout.strip()[:128] or font
        except (OSError, subprocess.SubprocessError):
            pass
    size = shell.get('font', {}).get('base-size', 12)
    if not isinstance(size, (int, float)):
        size = 12
    try:
        name = (state / 'theme.name').read_text().strip()[:100]
    except FileNotFoundError:
        name = 'Omarchy'
    return {
        'name': name, 'mode': 'light' if luminance > .5 else 'dark',
        'background': background, 'foreground': foreground,
        'accent': color(colors.get('accent'), foreground),
        'selection': color(colors.get('selection'), foreground),
        'font': font, 'fontSize': max(10, min(24, size)),
    }


def main():
    while True:
        header = sys.stdin.buffer.read(4)
        if not header:
            return
        if len(header) != 4:
            return
        length = struct.unpack('=I', header)[0]
        if not 0 < length <= 4096:
            return
        body = sys.stdin.buffer.read(length)
        if len(body) != length:
            return
        try:
            request = json.loads(body)
            if request != {'type': 'get-theme'}:
                raise ValueError('Unsupported operation')
            response = {'theme': snapshot()}
        except (ValueError, OSError, TypeError) as exc:
            response = {'error': str(exc)}
        payload = json.dumps(response, ensure_ascii=False).encode('utf-8')
        sys.stdout.buffer.write(struct.pack('=I', len(payload)) + payload)
        sys.stdout.buffer.flush()


if __name__ == '__main__':
    main()
