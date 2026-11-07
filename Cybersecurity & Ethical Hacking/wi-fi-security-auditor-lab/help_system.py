"""
Help System Module
Explains each module, framework workflows, safety policies, and course command references.
"""

import logging

logger = logging.getLogger('WiFiLab.HelpSystem')

MODULE_DESCRIPTIONS = {
    'dependency_checker': 'Checks whether required Linux binaries (aircrack-ng, wash, reaver, etc.) exist in $PATH using command -v without auto-installing.',
    'interface_info': 'Passively inspects wireless interfaces and their MAC/operational properties via sysfs and ip/iwconfig without altering network state.',
    'lab_config': 'Loads, updates, and persists lab parameters (target BSSID, ESSID, channel, interface) in config/lab_config.json.',
    'session_manager': 'Creates timestamped session folders (notes, logs, raw_outputs) to organize student activity.',
    'command_reference': 'Searches and displays the 43 exact course commands extracted from the 28 course transcripts with arguments, prerequisites, and source lectures.',
    'result_analyzer': 'Parses user-provided log output files (airodump CSV, wash text, reaver logs) into structured data without launching attacks.',
    'report_generator': 'Exports session findings and lab status into Markdown (.md), JSON (.json), and HTML (.html) formats.',
    'help': 'Displays module information, safety guidelines, and interactive documentation.'
}

def get_framework_help() -> str:
    lines = []
    lines.append("=== Wi-Fi Security Educational Lab Framework Manual ===")
    lines.append("Safety Policy: Non-offensive execution framework. No automatic attack execution.")
    lines.append("\nAvailable Modules:")
    for mod, desc in MODULE_DESCRIPTIONS.items():
        lines.append(f"  - {mod:20s}: {desc}")
    return '\n'.join(lines)

def explain_module(module_name: str) -> str:
    m = module_name.lower().strip()
    if m in MODULE_DESCRIPTIONS:
        return f"Module [{m}]: {MODULE_DESCRIPTIONS[m]}"
    return f"Module [{m}] not found. Available modules: {', '.join(MODULE_DESCRIPTIONS.keys())}"
