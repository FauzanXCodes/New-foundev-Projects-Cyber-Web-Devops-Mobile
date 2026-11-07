"""
Command Reference Module
Provides exact commands, syntax, parameters, prerequisites, and source citations from the course.
"""

import json
import os
import logging
from pathlib import Path

logger = logging.getLogger('WiFiLab.CommandReference')

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DB_PATH = str(PROJECT_ROOT / 'data' / 'command_reference_db.json')

class CommandReferenceDB:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        self.commands = self.load_db()

    def load_db(self) -> list:
        if os.path.exists(self.db_path):
            try:
                with open(self.db_path, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Failed to load command database {self.db_path}: {e}")
        return []

    def get_all_commands(self) -> list:
        return self.commands

    def search_commands(self, query: str) -> list:
        """Search commands by keyword across exact command, purpose, or lecture."""
        q = query.lower()
        results = []
        for cmd in self.commands:
            if (q in cmd['command'].lower() or 
                q in cmd['purpose'].lower() or 
                q in cmd['source_lecture'].lower() or
                q in cmd['id'].lower()):
                results.append(cmd)
        return results

    def get_command_by_id(self, cmd_id: str) -> dict:
        for cmd in self.commands:
            if cmd['id'].upper() == cmd_id.upper():
                return cmd
        return None
