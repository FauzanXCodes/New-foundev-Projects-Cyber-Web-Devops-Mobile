import re
import json

class DetectionEngine:
    def __init__(self, parsed_logs):
        # Stores the structured logs (list of dictionaries) from LogParser
        self.logs = parsed_logs
        # Stores all generated alerts
        self.alerts = []

    def detect_failed_logins(self):
        """Detects explicit failed login attempts."""
        for entry in self.logs:
            # Assuming 'message' field contains the core log text
            if re.search(r'Failed password|Failed login|Authentication failure', entry.get('message', '')):
                self.alerts.append({
                    "timestamp": entry['timestamp'],
                    "ip": entry.get('ip', 'N/A'),
                    "severity": "High",
                    "rule": "Failed Login",
                    "details": entry.get('message', 'N/A')
                })

    def detect_suspicious_paths(self):
        """Detects attempts to access sensitive system files."""
        # Using a general 'raw_line' or 'message' field to check for access attempts
        for entry in self.logs:
            if re.search(r'/etc/passwd|/root|/var/log|/bin/sh', entry.get('message', '')):
                self.alerts.append({
                    "timestamp": entry['timestamp'],
                    "ip": entry.get('ip', 'N/A'),
                    "severity": "Medium",
                    "rule": "Suspicious Path Access",
                    "details": entry.get('message', 'N/A')
                })

    def detect(self):
        """Runs all detection methods and populates self.alerts."""
        # Clear previous alerts before running
        self.alerts = [] 
        
        # Run all specific detection rules
        self.detect_failed_logins()
        self.detect_suspicious_paths()
        
        return self.alerts

    def save_alerts(self, filename="alerts.json"):
        """Saves the detected alerts to a JSON file."""
        # Ensure detection runs before saving
        if not self.alerts:
            self.detect() 
            
        with open(filename, "w") as f:
            json.dump(self.alerts, f, indent=2)