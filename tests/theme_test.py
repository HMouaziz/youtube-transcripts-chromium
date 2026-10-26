import importlib.util
import io
import json
from pathlib import Path
import struct
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('theme_host', Path(__file__).resolve().parents[1] / 'native/theme_host.py')
host = importlib.util.module_from_spec(spec)
spec.loader.exec_module(host)


class ThemeTest(unittest.TestCase):
    def test_theme_changes_and_overrides(self):
        with tempfile.TemporaryDirectory() as temporary:
            home = Path(temporary)
            theme = home / '.local/state/omarchy/current/theme'
            theme.mkdir(parents=True)
            config = home / '.config/omarchy'
            config.mkdir(parents=True)
            (config / 'shell.toml').write_text('[font]\nbase-size = 16\n')
            font = home / '.config/fontconfig/fonts.conf'
            font.parent.mkdir(parents=True)
            font.write_text('<fontconfig><match><test name="family"><string>monospace</string></test><edit name="family"><string>Example Mono</string></edit></match></fontconfig>')
            colors = theme / 'colors.toml'
            colors.write_text('background = "#101010"\nforeground = "#eeeeee"\naccent = "#ff0000"\n')
            first = host.snapshot(home)
            self.assertEqual(first['mode'], 'dark')
            self.assertEqual(first['font'], 'Example Mono')
            self.assertEqual(first['fontSize'], 16)
            colors.write_text('background = "#ffffff"\nforeground = "#111111"\naccent = "#0000aa"\n')
            second = host.snapshot(home)
            self.assertEqual(second['mode'], 'light')
            self.assertEqual(second['accent'], '#0000aa')
            self.assertNotEqual(first, second)

    def test_protocol_and_rejected_operations(self):
        def frame(value):
            data = json.dumps(value).encode()
            return struct.pack('=I', len(data)) + data
        incoming = io.BytesIO(frame({'type': 'get-theme'}) + frame({'type': 'read-file', 'path': '/etc/passwd'}))
        outgoing = io.BytesIO()
        with patch.object(host.sys, 'stdin') as stdin, patch.object(host.sys, 'stdout') as stdout, patch.object(host, 'snapshot', return_value={'name': 'Café'}):
            stdin.buffer, stdout.buffer = incoming, outgoing
            host.main()
        outgoing.seek(0)
        def read():
            length = struct.unpack('=I', outgoing.read(4))[0]
            return json.loads(outgoing.read(length))
        self.assertEqual(read()['theme']['name'], 'Café')
        self.assertEqual(read()['error'], 'Unsupported operation')


if __name__ == '__main__':
    unittest.main()
