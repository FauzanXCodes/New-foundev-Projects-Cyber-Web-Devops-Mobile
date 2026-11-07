from flask import Flask, jsonify
from flask_cors import CORS 
import json
import os
import os.path as path 

# --- Correct Imports for Nested Structure (Using Relative Imports) ---
# .parser means "the parser module inside the current package (api)"
from .parser.log_parser import LogParser 
from .detection.detection_engine import DetectionEngine 

# --- Path Configuration Fix ---
# BASE_DIR is the absolute path to the directory where app.py resides (api/)
BASE_DIR = path.dirname(path.abspath(__file__))

# LOG_FILE is two levels up (..) and into the logs folder
# This makes the path robust regardless of where the script is run from.
LOG_FILE = path.join(BASE_DIR, "..", "logs", "auth.log") 

# ALERTS_FILE is saved right next to app.py in the 'api' folder
ALERTS_FILE = path.join(BASE_DIR, "alerts.json") 

# --- Flask Configuration ---
app = Flask(__name__)
CORS(app) # Enable CORS for all routes (necessary for frontend integration)


# --- Helper Function ---
def run_analysis():
    """Reruns the log parsing and detection to ensure fresh data."""
    if not path.exists(LOG_FILE):
        print(f"Error: Log file not found at {LOG_FILE}")
        return []

    try:
        # 1. Parse Logs
        parser = LogParser(LOG_FILE)
        parsed_logs = parser.parse()
        print("DEBUG — Parsed logs:", parsed_logs) # Debugging output

        # 2. Run Detection (This will generate/update alerts.json)
        engine = DetectionEngine(parsed_logs)
        # Save alerts.json using the explicit path
        engine.save_alerts(filename=ALERTS_FILE) 
        
        return parsed_logs
    except Exception as e:
        # Note: If the parser or detection engine has a crash, it's caught here
        print(f"Error during analysis: {e}")
        return []

# --- API Endpoints ---
@app.route('/api/logs', methods=['GET'])
def get_logs():
    """Endpoint to return all parsed logs."""
    # Running the analysis ensures the data is fresh and alerts.json is generated
    parsed_logs = run_analysis()
    return jsonify(parsed_logs)

@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    """Endpoint to return all detected alerts."""
    # 1. Ensure alerts.json is up-to-date
    run_analysis() 
    
    # 2. Read the alerts file using the explicit path
    try:
        with open(ALERTS_FILE, 'r') as f:
            alerts = json.load(f)
        return jsonify(alerts)
    except FileNotFoundError:
        # This should no longer happen after the path fix
        return jsonify({"error": "Alerts file not found."}), 404

@app.route('/')
def home():
    return "Log Analysis API is running. Try /api/logs or /api/alerts"

if __name__ == '__main__':
    app.run(debug=True)