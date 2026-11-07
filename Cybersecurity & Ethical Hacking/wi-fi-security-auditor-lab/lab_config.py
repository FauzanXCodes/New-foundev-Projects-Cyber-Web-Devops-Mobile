"""
Lab Config Module
Manages loading, updating, and saving lab environment configuration parameters.
"""

import json
import os
import logging
from pathlib import Path

logger = logging.getLogger('WiFiLab.LabConfig')

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONFIG_PATH = str(PROJECT_ROOT / 'config' / 'lab_config.json')

DEFAULT_PARAMS = {
    'lab_name': 'Educational Wi-Fi Security Lab',
    'interface': 'wlan0mon',
    'target_bssid': '00:11:22:33:44:55',
    'target_essid': 'TestAP',
    'target_channel': 11,
    'client_mac': 'AA:BB:CC:DD:EE:FF',
    'output_dir': str(PROJECT_ROOT / 'sessions'),
    'wordlist_path': '/usr/share/wordlists/rockyou.txt',
    'log_level': 'INFO'
}

class LabConfigManager:
    def __init__(self, config_path: str = DEFAULT_CONFIG_PATH):
        self.config_path = config_path
        self.config = {}
        self.config = self.load_config()

    def load_config(self) -> dict:
        """Load config from file or initialize with defaults if absent."""
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, 'r') as f:
                    data = json.load(f)
                    logger.info(f"Loaded lab configuration from {self.config_path}")
                    return data
            except Exception as e:
                logger.error(f"Failed to read config file {self.config_path}: {e}")
        
        # Write default
        self.config = DEFAULT_PARAMS.copy()
        self.save_config()
        return self.config.copy()

    def save_config(self, params: dict = None) -> bool:
        """Save updated configuration parameters to disk."""
        if params is not None:
            self.config.update(params)
        
        os.makedirs(os.path.dirname(self.config_path), exist_ok=True)
        try:
            with open(self.config_path, 'w') as f:
                json.dump(self.config, f, indent=2)
            logger.info(f"Saved lab configuration to {self.config_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to write config file {self.config_path}: {e}")
            return False

    def get_param(self, key: str, default=None):
        return self.config.get(key, default)

    def set_param(self, key: str, value) -> bool:
        self.config[key] = value
        return self.save_config()
