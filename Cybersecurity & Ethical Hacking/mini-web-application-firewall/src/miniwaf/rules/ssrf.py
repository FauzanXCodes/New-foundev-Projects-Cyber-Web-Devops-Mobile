"""Server-Side Request Forgery (SSRF) detection rules."""

from miniwaf.models.enums import AttackType, LocationTarget, RuleSeverity
from miniwaf.models.rules import WAFRule

SSRF_RULES: list[WAFRule] = [
    WAFRule(
        rule_id="RULE-SSRF-001",
        name="Private IPv4 & Localhost Probing",
        category=AttackType.SSRF,
        severity=RuleSeverity.HIGH,
        paranoia_level=1,
        pattern=(
            r"(?:https?|ftp)://(?:127\.0\.0\.1|localhost|0\.0\.0\.0|"
            r"10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|"
            r"172\.(?:1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3})\b"
        ),
        target=LocationTarget.QUERY_PARAM,
        cwe_id="CWE-918",
        description="Detects URL parameters pointing to internal RFC 1918 or loopback addresses.",
        remediation="Validate destination hostnames and block non-routable IP ranges.",
    ),
    WAFRule(
        rule_id="RULE-SSRF-002",
        name="Cloud Metadata Endpoint Access",
        category=AttackType.SSRF,
        severity=RuleSeverity.CRITICAL,
        paranoia_level=1,
        pattern=r"(?:169\.254\.169\.254|metadata\.google\.internal|100\.100\.100\.200)\b",
        target=LocationTarget.QUERY_PARAM,
        cwe_id="CWE-918",
        description="Detects queries targeting AWS, GCP, Azure, or Alibaba cloud metadata APIs.",
        remediation="Enforce IMDSv2 token hops restricted to 1 and block metadata egress.",
    ),
]
