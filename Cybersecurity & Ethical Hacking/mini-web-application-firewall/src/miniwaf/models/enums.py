"""Enumerations defining WAF actions, attack types, severities, and targets."""

from enum import StrEnum


class WAFAction(StrEnum):
    """Action taken by the WAF on an inspected request or response."""

    ALLOW = "ALLOW"
    BLOCK = "BLOCK"
    MONITOR = "MONITOR"
    CHALLENGE = "CHALLENGE"


class AttackType(StrEnum):
    """Categorization of web attacks and security events."""

    SQLI = "SQLI"
    XSS = "XSS"
    TRAVERSAL = "TRAVERSAL"
    CMDI = "CMDI"
    SSRF = "SSRF"
    MALICIOUS_CLIENT = "MALICIOUS_CLIENT"
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"
    PROTOCOL_VIOLATION = "PROTOCOL_VIOLATION"
    DATA_LEAKAGE = "DATA_LEAKAGE"


class RuleSeverity(StrEnum):
    """Severity assigned to a WAF rule and corresponding anomaly score weight."""

    NOTICE = "NOTICE"  # 1 point
    LOW = "LOW"  # 2 points
    MEDIUM = "MEDIUM"  # 3 points
    HIGH = "HIGH"  # 4 points
    CRITICAL = "CRITICAL"  # 5 points

    @property
    def anomaly_score(self) -> int:
        """Calculate numerical anomaly points contributed by this severity level."""
        weights = {
            RuleSeverity.NOTICE: 1,
            RuleSeverity.LOW: 2,
            RuleSeverity.MEDIUM: 3,
            RuleSeverity.HIGH: 4,
            RuleSeverity.CRITICAL: 5,
        }
        return weights.get(self, 1)


class LocationTarget(StrEnum):
    """Location within HTTP transaction targeted for inspection."""

    URI_PATH = "URI_PATH"
    QUERY_PARAM = "QUERY_PARAM"
    HEADER = "HEADER"
    COOKIE = "COOKIE"
    BODY = "BODY"
    USER_AGENT = "USER_AGENT"
    RESPONSE_BODY = "RESPONSE_BODY"
    ANY = "ANY"
