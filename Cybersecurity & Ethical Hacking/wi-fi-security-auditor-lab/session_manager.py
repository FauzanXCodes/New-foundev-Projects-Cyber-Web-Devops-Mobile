"""
Session Manager Module
Creates timestamped lab-session directories and manages notes, logs, and user outputs.
"""

import os
import json
import logging
from pathlib import Path
from datetime import datetime

logger = logging.getLogger('WiFiLab.SessionManager')

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SESSIONS_DIR = str(PROJECT_ROOT / 'sessions')

class SessionManager:
    def __init__(self, base_sessions_dir: str = DEFAULT_SESSIONS_DIR):
        path = Path(base_sessions_dir)
        self.base_sessions_dir = str(path if path.is_absolute() else PROJECT_ROOT / path)
        os.makedirs(self.base_sessions_dir, exist_ok=True)
        self.current_session_id = None
        self.current_session_dir = None

    def create_session(self, session_name: str = 'lab_session') -> str:
        """Create a new timestamped lab session directory structure."""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        session_id = f"{session_name}_{timestamp}"
        session_dir = os.path.join(self.base_sessions_dir, session_id)
        
        subdirs = ['notes', 'logs', 'raw_outputs']
        for sd in subdirs:
            os.makedirs(os.path.join(session_dir, sd), exist_ok=True)
            
        metadata = {
            'session_id': session_id,
            'created_at': datetime.now().isoformat(),
            'notes_count': 0,
            'raw_files_count': 0
        }
        
        with open(os.path.join(session_dir, 'metadata.json'), 'w') as f:
            json.dump(metadata, f, indent=2)
            
        self.current_session_id = session_id
        self.current_session_dir = session_dir
        logger.info(f"Created new session: {session_id} at {session_dir}")
        return session_id

    def add_note(self, note_title: str, note_text: str) -> str:
        """Save a user note into the active session notes directory."""
        if not self.current_session_dir:
            self.create_session()
            
        notes_dir = os.path.join(self.current_session_dir, 'notes')
        filename = f"{note_title.replace(' ', '_').lower()}.txt"
        filepath = os.path.join(notes_dir, filename)
        
        with open(filepath, 'w') as f:
            f.write(f"=== Note: {note_title} ===\n")
            f.write(f"Timestamp: {datetime.now().isoformat()}\n\n")
            f.write(note_text)
            
        logger.info(f"Saved note '{note_title}' to {filepath}")
        return filepath

    def save_raw_output(self, filename: str, content: str) -> str:
        """Store user-provided command/tool output into raw_outputs folder."""
        if not self.current_session_dir:
            self.create_session()
            
        raw_dir = os.path.join(self.current_session_dir, 'raw_outputs')
        if not filename or os.path.basename(filename) != filename or filename in {'.', '..'}:
            raise ValueError("filename must be a simple file name without path separators")
        filepath = os.path.join(raw_dir, filename)
        
        with open(filepath, 'w') as f:
            f.write(content)
            
        logger.info(f"Saved raw output '{filename}' to {filepath}")
        return filepath

    def list_sessions(self) -> list:
        """List all stored session directories."""
        sessions = []
        if os.path.exists(self.base_sessions_dir):
            for item in sorted(os.listdir(self.base_sessions_dir)):
                item_path = os.path.join(self.base_sessions_dir, item)
                if os.path.isdir(item_path):
                    meta_file = os.path.join(item_path, 'metadata.json')
                    meta = {}
                    if os.path.exists(meta_file):
                        try:
                            with open(meta_file, 'r') as f:
                                meta = json.load(f)
                        except Exception:
                            pass
                    sessions.append({
                        'session_id': item,
                        'path': item_path,
                        'created_at': meta.get('created_at', 'Unknown')
                    })
        return sessions
