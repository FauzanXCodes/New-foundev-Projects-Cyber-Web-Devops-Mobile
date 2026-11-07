"""Malicious client and security scanner fingerprinting rules."""

from miniwaf.models.enums import AttackType, LocationTarget, RuleSeverity
from miniwaf.models.rules import WAFRule

CLIENT_RULES: list[WAFRule] = [
    WAFRule(
        rule_id="RULE-CLIENT-001",
        name="Known Security Scanner User-Agent",
        category=AttackType.MALICIOUS_CLIENT,
        severity=RuleSeverity.HIGH,
        paranoia_level=1,
        pattern=r"\b(?:sqlmap|nikto|nuclei|gobuster|dirbuster|wpscan|acunetix|nessus|masscan|zgrab)\b",
        target=LocationTarget.USER_AGENT,
        cwe_id="CWE-200",
        description="Detects automated vulnerability assessment and exploitation scanners.",
        remediation="Block automated scanners and rate-limit anomalous reconnaissance.",
    ),
    WAFRule(
        rule_id="RULE-CLIENT-002",
        name="Suspicious Scripting Client User-Agent",
        category=AttackType.MALICIOUS_CLIENT,
        severity=RuleSeverity.LOW,
        paranoia_level=2,
        pattern=r"^(?:python-requests|curl|wget|libwww-perl|go-http-client)(?:/|\s|$)",
        target=LocationTarget.USER_AGENT,
        cwe_id="CWE-200",
        description="Detects uncustomized scripting and automated CLI tools.",
        remediation="Challenge or verify automated non-browser clients where appropriate.",
    ),
]
