from parser.log_parser import LogParser
from detection.detection_engine import DetectionEngine
import os # For checking if the log file exists

if __name__ == "__main__":
    log_file_path = "logs/auth.log"
    
    if not os.path.exists(log_file_path):
        print(f"Error: Log file not found at {log_file_path}. Please create it and add sample logs.")
        exit(1)

    # Step 1: Parse the log file
    parser = LogParser(log_file_path)
    parsed_logs = parser.parse()
    
    print("Parsed Logs:")
    for log in parsed_logs:
        print(log)

    # Step 2: Run detection and save alerts
    if parsed_logs:
        engine = DetectionEngine(parsed_logs)
        engine.save_alerts()
        print("\nAlerts saved to alerts.json")
    else:
        print("\nNo logs were parsed. Check log file content and parser regex.")