"""
Result Analyzer Module
Parses user-provided log files (airodump, wash, reaver, hostapd-wpe) without executing attacks.
"""

import os
import re
import csv
import logging

logger = logging.getLogger('WiFiLab.ResultAnalyzer')

def analyze_airodump_csv(filepath: str) -> dict:
    """Parse airodump-ng CSV summary log file."""
    aps = []
    clients = []
    
    if not os.path.exists(filepath):
        return {'error': f'File not found: {filepath}'}

    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
            
        is_client_section = False
        for line in lines:
            line = line.strip()
            if not line:
                continue
            if 'Station MAC' in line:
                is_client_section = True
                continue
            if 'BSSID' in line and 'ESSID' in line:
                continue
                
            parts = [p.strip() for p in line.split(',')]
            if not is_client_section:
                if len(parts) >= 14 and re.match(r'^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$', parts[0]):
                    aps.append({
                        'bssid': parts[0],
                        'channel': parts[3],
                        'privacy': parts[5],
                        'cipher': parts[6],
                        'authentication': parts[7],
                        'essid': parts[13] if len(parts) > 13 else ''
                    })
            else:
                if len(parts) >= 6 and re.match(r'^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$', parts[0]):
                    clients.append({
                        'station_mac': parts[0],
                        'bssid': parts[5],
                        'power': parts[3],
                        'packets': parts[4]
                    })
                    
        return {
            'type': 'airodump_csv',
            'total_aps': len(aps),
            'total_clients': len(clients),
            'aps': aps,
            'clients': clients
        }
    except Exception as e:
        logger.error(f"Error parsing airodump CSV {filepath}: {e}")
        return {'error': str(e)}

def analyze_wash_output(content_or_filepath: str) -> dict:
    """Parse wash WPS scan output text."""
    if os.path.exists(content_or_filepath):
        with open(content_or_filepath, 'r') as f:
            text = f.read()
    else:
        text = content_or_filepath

    wps_aps = []
    lines = text.splitlines()
    for line in lines:
        if 'BSSID' in line or '---' in line or not line.strip():
            continue
        parts = re.split(r'\s+', line.strip())
        if len(parts) >= 5 and re.match(r'^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$', parts[0]):
            wps_aps.append({
                'bssid': parts[0],
                'channel': parts[1],
                'rssi': parts[2],
                'wps_version': parts[3],
                'wps_locked': parts[4],
                'essid': ' '.join(parts[5:]) if len(parts) > 5 else ''
            })

    return {
        'type': 'wash_scan',
        'total_wps_aps': len(wps_aps),
        'locked_aps_count': sum(1 for ap in wps_aps if ap['wps_locked'].lower() in ['yes', '1', 'true']),
        'wps_aps': wps_aps
    }

def analyze_generic_log(filepath: str) -> dict:
    """Categorize and analyze arbitrary user log file."""
    if not os.path.exists(filepath):
        return {'error': f'File not found: {filepath}'}

    if filepath.endswith('.csv'):
        return analyze_airodump_csv(filepath)

    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        text = f.read()

    if 'WPS' in text or 'WSC' in text:
        return analyze_wash_output(text)

    # General pattern check
    handshake_detected = bool(re.search(r'WPA handshake:', text, re.IGNORECASE))
    bssids_found = list(set(re.findall(r'(?:[0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}', text)))

    return {
        'type': 'generic_log',
        'file_path': filepath,
        'handshake_detected': handshake_detected,
        'bssids_found': bssids_found,
        'line_count': len(text.splitlines())
    }
