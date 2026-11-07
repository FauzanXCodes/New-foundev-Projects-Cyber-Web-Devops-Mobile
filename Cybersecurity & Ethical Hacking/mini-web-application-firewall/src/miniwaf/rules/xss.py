"""Cross-Site Scripting (XSS) detection rules."""

from miniwaf.models.enums import AttackType, LocationTarget, RuleSeverity
from miniwaf.models.rules import WAFRule

XSS_RULES: list[WAFRule] = [
    WAFRule(
        rule_id="RULE-XSS-001",
        name="HTML Script / Dangerous Tag Injection",
        category=AttackType.XSS,
        severity=RuleSeverity.CRITICAL,
        paranoia_level=1,
        pattern=r"<\s*(?:script|iframe|object|embed|applet|meta|base)\b",
        target=LocationTarget.BODY,
        cwe_id="CWE-79",
        description="Detects executable HTML tag injection.",
        remediation="Apply HTML entity encoding and strict Content Security Policy.",
    ),
    WAFRule(
        rule_id="RULE-XSS-002",
        name="Inline HTML Event Handlers",
        category=AttackType.XSS,
        severity=RuleSeverity.HIGH,
        paranoia_level=1,
        pattern=r"\bon(?:error|load|click|mouseover|focus|blur|submit|input)\s*=",
        target=LocationTarget.BODY,
        cwe_id="CWE-79",
        description="Detects inline JavaScript DOM event handlers.",
        remediation="Strip inline event handlers using robust HTML sanitizer libraries.",
    ),
    WAFRule(
        rule_id="RULE-XSS-003",
        name="JavaScript Pseudo-Protocol",
        category=AttackType.XSS,
        severity=RuleSeverity.HIGH,
        paranoia_level=1,
        pattern=r"(?:javascript|vbscript|data:text/html)\s*:",
        target=LocationTarget.QUERY_PARAM,
        cwe_id="CWE-79",
        description="Detects execution vectors in URI attributes (e.g. href='javascript:...').",
        remediation="Validate URL schemes strictly against http:// and https://.",
    ),
    WAFRule(
        rule_id="RULE-XSS-004",
        name="Dangerous DOM Cookie / Storage Access",
        category=AttackType.XSS,
        severity=RuleSeverity.MEDIUM,
        paranoia_level=2,
        pattern=r"\b(?:document\.cookie|document\.domain|localStorage|sessionStorage)\b",
        target=LocationTarget.BODY,
        cwe_id="CWE-79",
        description="Detects scripts attempting to extract session cookies or local storage.",
        remediation="Set HttpOnly flags on session cookies and enforce CSP.",
    ),
]
