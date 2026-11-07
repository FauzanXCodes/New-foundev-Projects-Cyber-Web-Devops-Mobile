"""
Interface Info Module
Passively inspects wireless network interfaces and their basic parameters.
Does NOT modify wireless configuration automatically.
"""

import os
import subprocess
import logging

logger = logging.getLogger('WiFiLab.InterfaceInfo')

def get_interfaces_sysfs() -> list:
    """Inspect /sys/class/net to find wireless interfaces passively."""
    interfaces = []
    sys_net = '/sys/class/net'
    if not os.path.exists(sys_net):
        return interfaces

    for iface in os.listdir(sys_net):
        iface_path = os.path.join(sys_net, iface)
        is_wireless = os.path.exists(os.path.join(iface_path, 'wireless')) or os.path.exists(os.path.join(iface_path, 'phy80211'))
        
        mac_address = 'Unknown'
        address_file = os.path.join(iface_path, 'address')
        if os.path.exists(address_file):
            try:
                with open(address_file, 'r') as f:
                    mac_address = f.read().strip()
            except Exception:
                pass

        operstate = 'unknown'
        operstate_file = os.path.join(iface_path, 'operstate')
        if os.path.exists(operstate_file):
            try:
                with open(operstate_file, 'r') as f:
                    operstate = f.read().strip()
            except Exception:
                pass

        interfaces.append({
            'name': iface,
            'is_wireless': is_wireless,
            'mac_address': mac_address,
            'operstate': operstate
        })
    return interfaces

def get_detailed_interface_info() -> dict:
    """Collect interface details via passive CLI commands if available."""
    summary = {
        'sysfs_interfaces': get_interfaces_sysfs(),
        'iwconfig_output': None,
        'ip_link_output': None
    }
    
    try:
        res = subprocess.run(['iwconfig'], capture_output=True, text=True)
        if res.returncode == 0:
            summary['iwconfig_output'] = res.stdout.strip()
    except Exception as e:
        logger.debug(f"iwconfig command unavailable: {e}")

    try:
        res = subprocess.run(['ip', 'link', 'show'], capture_output=True, text=True)
        if res.returncode == 0:
            summary['ip_link_output'] = res.stdout.strip()
    except Exception as e:
        logger.debug(f"ip link command unavailable: {e}")

    return summary
