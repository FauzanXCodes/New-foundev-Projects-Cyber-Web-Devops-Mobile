"""Rules package registering default OWASP CRS-inspired security signatures."""

from miniwaf.rules.clients import CLIENT_RULES
from miniwaf.rules.cmdi import CMDI_RULES
from miniwaf.rules.registry import RuleRegistry
from miniwaf.rules.sqli import SQLI_RULES
from miniwaf.rules.ssrf import SSRF_RULES
from miniwaf.rules.traversal import TRAVERSAL_RULES
from miniwaf.rules.xss import XSS_RULES

DEFAULT_RULES = SQLI_RULES + XSS_RULES + TRAVERSAL_RULES + CMDI_RULES + SSRF_RULES + CLIENT_RULES


def create_default_registry() -> RuleRegistry:
    """Instantiate and populate a RuleRegistry with all built-in rules."""
    registry = RuleRegistry()
    registry.register_many(DEFAULT_RULES)
    return registry


__all__ = [
    "CLIENT_RULES",
    "CMDI_RULES",
    "DEFAULT_RULES",
    "RuleRegistry",
    "SQLI_RULES",
    "SSRF_RULES",
    "TRAVERSAL_RULES",
    "XSS_RULES",
    "create_default_registry",
]
