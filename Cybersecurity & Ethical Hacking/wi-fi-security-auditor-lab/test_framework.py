"""
Unit Tests for Wi-Fi Security Educational Lab Framework
Verifies functionality of all 8 core modules.
"""

import unittest
import os
import sys
import json
import shutil
import tempfile

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from modules.dependency_checker import check_all_dependencies, check_single_tool
from modules.interface_info import get_interfaces_sysfs, get_detailed_interface_info
from modules.lab_config import LabConfigManager
from modules.session_manager import SessionManager
from modules.command_reference import CommandReferenceDB
from modules.result_analyzer import analyze_airodump_csv, analyze_wash_output, analyze_generic_log
from modules.report_generator import generate_markdown_report, generate_json_report, generate_html_report
from modules.help_system import get_framework_help, explain_module


class TestWiFiLabFramework(unittest.TestCase):

    def test_01_dependency_checker(self):
        res = check_single_tool('python3')
        self.assertTrue(res['installed'])
        summary = check_all_dependencies(['python3', 'ls', 'non_existent_fake_tool_12345'])
        self.assertEqual(summary['total_tools'], 3)
        self.assertEqual(summary['installed_count'], 2)
        self.assertEqual(summary['missing_count'], 1)

    def test_02_interface_info(self):
        ifaces = get_interfaces_sysfs()
        self.assertIsInstance(ifaces, list)
        info = get_detailed_interface_info()
        self.assertIn('sysfs_interfaces', info)

    def test_03_lab_config(self):
        with tempfile.TemporaryDirectory() as tmp:
            test_cfg_path = os.path.join(tmp, 'test_lab_config.json')
            mgr = LabConfigManager(config_path=test_cfg_path)
            self.assertEqual(mgr.get_param('interface'), 'wlan0mon')
            mgr.set_param('interface', 'mon0')
            self.assertEqual(mgr.get_param('interface'), 'mon0')

    def test_04_session_manager(self):
        with tempfile.TemporaryDirectory() as test_sess_dir:
            mgr = SessionManager(base_sessions_dir=test_sess_dir)
            sess_id = mgr.create_session('unit_test')
            self.assertIn('unit_test_', sess_id)

            note_path = mgr.add_note('Test Title', 'Test Content Body')
            self.assertTrue(os.path.exists(note_path))

    def test_05_command_reference(self):
        db = CommandReferenceDB()
        cmds = db.get_all_commands()
        self.assertGreaterEqual(len(cmds), 40)
        
        reaver_cmds = db.search_commands('reaver')
        self.assertGreater(len(reaver_cmds), 0)
        
        cmd1 = db.get_command_by_id('CMD-001')
        self.assertIsNotNone(cmd1)
        self.assertIn('airodump-ng', cmd1['command'])

    def test_06_result_analyzer(self):
        sample_wash = """
BSSID              Channel  RSSI  WPS Version  WPS Locked  ESSID
----------------------------------------------------------------
00:11:22:33:44:55  11       -50   1.0          No          TestAP
AA:BB:CC:DD:EE:FF  6        -75   2.0          Yes         LockedAP
"""
        res = analyze_wash_output(sample_wash)
        self.assertEqual(res['total_wps_aps'], 2)
        self.assertEqual(res['locked_aps_count'], 1)

    def test_07_report_generator(self):
        test_data = {
            'session_id': 'test_sess_001',
            'config': {'interface': 'mon0'},
            'dependencies': {'total_tools': 5, 'installed_count': 5, 'missing_count': 0, 'details': {}},
            'analysis_results': {},
            'notes': [{'title': 'Sample Note', 'content': 'Body text'}]
        }
        with tempfile.TemporaryDirectory() as tmp:
            md_file = os.path.join(tmp, 'test_report.md')
            json_file = os.path.join(tmp, 'test_report.json')
            html_file = os.path.join(tmp, 'test_report.html')

            generate_markdown_report(test_data, md_file)
            generate_json_report(test_data, json_file)
            generate_html_report(test_data, html_file)

            self.assertTrue(os.path.exists(md_file))
            self.assertTrue(os.path.exists(json_file))
            self.assertTrue(os.path.exists(html_file))

    def test_08_airodump_client_parsing(self):
        csv_text = """BSSID, First time seen, Last time seen, channel, Speed, Privacy, Cipher, Authentication, Power, # beacons, # IV, LAN IP, ID-length, ESSID, Key
00:11:22:33:44:55, 2026-10-04 12:00:00, 2026-10-04 12:01:00, 11, 54, WPA2, CCMP, PSK, -42, 10, 100, 0.0.0.0, 7, TestAP,
Station MAC, First time seen, Last time seen, Power, # packets, BSSID, Probed ESSIDs
AA:BB:CC:DD:EE:FF, 2026-10-04 12:00:01, 2026-10-04 12:01:01, -55, 1234, 00:11:22:33:44:55, TestAP
"""
        with tempfile.NamedTemporaryFile('w', suffix='.csv', delete=False) as f:
            f.write(csv_text)
            path = f.name
        try:
            result = analyze_airodump_csv(path)
            self.assertEqual(result['total_clients'], 1)
            self.assertEqual(result['clients'][0]['power'], '-55')
            self.assertEqual(result['clients'][0]['packets'], '1234')
        finally:
            os.remove(path)

    def test_09_security_hardening(self):
        with tempfile.TemporaryDirectory() as tmp:
            mgr = SessionManager(base_sessions_dir=tmp)
            mgr.create_session('security_test')
            with self.assertRaises(ValueError):
                mgr.save_raw_output('../escape.txt', 'blocked')
            html_path = os.path.join(tmp, 'report.html')
            generate_html_report(
                {'session_id': '<script>x</script>', 'config': {'x': '<img src=x onerror=1>'}},
                html_path
            )
            with open(html_path, encoding='utf-8') as html_file:
                html = html_file.read()
            self.assertNotIn('<script>x</script>', html)
            self.assertNotIn('<img src=x onerror=1>', html)

    def test_10_output_dir_integration(self):
        with tempfile.TemporaryDirectory() as tmp:
            mgr = SessionManager(base_sessions_dir=tmp)
            session_id = mgr.create_session('output_test')
            self.assertTrue(os.path.isdir(os.path.join(tmp, session_id)))

    def test_11_help_topic(self):
        self.assertIn('dependency_checker', explain_module('dependency_checker'))

    def test_12_help_system(self):
        h = get_framework_help()
        self.assertIn('Wi-Fi Security Educational Lab Framework', h)
        exp = explain_module('dependency_checker')
        self.assertIn('Checks whether required Linux binaries', exp)


if __name__ == '__main__':
    unittest.main()
