"""
Dependency Checker Module
Checks for required Linux binaries using 'command -v' or shutil.which without installing anything.
"""

import shutil
import logging

logger = logging.getLogger('WiFiLab.DependencyChecker')

REQUIRED_TOOLS = [
    'aircrack-ng', 'airodump-ng', 'aireplay-ng', 'packetforge-ng',
    'wash', 'reaver', 'mdk3', 'crunch', 'john', 'airolib-ng',
    'hashcat', 'hostapd-wpe', 'asleap', 'ifconfig', 'ip'
]

def check_single_tool(tool_name: str) -> dict:
    """Check if a single command binary exists in PATH."""
    # shutil.which performs the PATH lookup directly and avoids shell invocation.
    path = shutil.which(tool_name)
    installed = path is not None
    logger.info(f"Tool '{tool_name}': {'INSTALLED (' + path + ')' if installed else 'MISSING'}")
    return {
        'tool': tool_name,
        'installed': installed,
        'path': path if installed else None
    }

def check_all_dependencies(tools=None) -> dict:
    """Check status for all required tools."""
    if tools is None:
        tools = REQUIRED_TOOLS
    
    results = {}
    installed_count = 0
    for tool in tools:
        res = check_single_tool(tool)
        results[tool] = res
        if res['installed']:
            installed_count += 1
            
    summary = {
        'total_tools': len(tools),
        'installed_count': installed_count,
        'missing_count': len(tools) - installed_count,
        'details': results
    }
    return summary
