import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('setup_lab', Path(__file__).with_name('setup_lab.py'))
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)


class SetupChecks(unittest.TestCase):
    def test_new_config_and_no_overwrite(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            template = (setup.ROOT / '.env.example').read_text(encoding='utf-8')
            setup.initialize(directory, template, 'server.test')
            env = (directory / '.env').read_bytes()
            proxy = (directory / '.env.proxy.local').read_text()
            self.assertIn(b'NEXT_PUBLIC_BASE_URL=http://server.test:3000', env)
            self.assertTrue(b'replace-with-' not in env, 'Secrets must not be placeholders')
            self.assertTrue(b'100.x.x.x' not in env, 'Public URLs must be usable')
            self.assertIn(b'DEV_BYPASS_AUTH=false', env)
            self.assertIn(b'FLASK_DEBUG=false', env)
            self.assertIn('POSTGRES_PASSWORD=', proxy)
            self.assertIn('ML_WEBHOOK_SECRET=', proxy)
            with self.assertRaises(ValueError):
                setup.initialize(directory, template, 'other.test')
            self.assertEqual((directory / '.env').read_bytes(), env)

    def test_host_validation(self):
        for host in ('https://server.test', 'host:3000', '../secrets', 'a\nb', 'a..test', '::1'):
            with self.assertRaises(ValueError, msg=host):
                setup.validate_host(host)
        self.assertEqual(setup.validate_host('192.0.2.10'), '192.0.2.10')


if __name__ == '__main__':
    unittest.main()
