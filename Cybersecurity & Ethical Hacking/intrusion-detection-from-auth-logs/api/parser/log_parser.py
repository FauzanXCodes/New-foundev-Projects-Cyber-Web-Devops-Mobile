# parser/log_parser.py
import re
import os

class LogParser:
    def __init__(self, filepath):
        self.filepath = filepath

    def parse(self):
        parsed_logs = []
        # General pattern for logs like: 2025-11-23 12:05:33 WARN Failed login attempt 192.168.0.2
        # It attempts to capture the main components of a simple log format.
        log_pattern = re.compile(
            r'^(?P<timestamp>\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})\s+(?P<level>\w+)\s+(?P<message>.*?)(?P<ip>\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})?$'
        )

        try:
            with open(self.filepath, 'r') as f:
                for line in f:
                    line = line.strip()
                    match = log_pattern.match(line)
                    
                    if match:
                        log_entry = match.groupdict()
                        # Ensure 'ip' is set, even if it's None in the regex match
                        log_entry['ip'] = log_entry['ip'] if log_entry['ip'] else 'N/A'
                        log_entry['raw_line'] = line # Keep raw line for full context
                        parsed_logs.append(log_entry)
                    else:
                        # Fallback for lines that don't match the structured pattern
                        parsed_logs.append({'timestamp': 'N/A', 'level': 'RAW', 'message': line, 'ip': 'N/A', 'raw_line': line})
                        
        except FileNotFoundError:
            print(f"Error: Log file not found at {self.filepath}")
            return []
            
        return parsed_logs

if __name__ == "__main__":
    # Example execution for testing the parser directly
    parser = LogParser("logs/auth.log")
    logs = parser.parse()
    print(logs)