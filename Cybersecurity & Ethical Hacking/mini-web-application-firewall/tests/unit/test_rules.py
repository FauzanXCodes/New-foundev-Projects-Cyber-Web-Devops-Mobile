"""Unit tests verifying signature detection rules and rule registry."""

from miniwaf.models.enums import AttackType, LocationTarget
from miniwaf.rules import (
    DEFAULT_RULES,
    RuleRegistry,
    create_default_registry,
)


def test_default_registry_initialization() -> None:
    registry = create_default_registry()
    all_rules = registry.all_rules()
    assert len(all_rules) == len(DEFAULT_RULES)
    assert len(all_rules) >= 15

    sqli_rule = registry.get_rule("RULE-SQLI-001")
    assert sqli_rule is not None
    assert sqli_rule.category == AttackType.SQLI

    pattern = registry.get_pattern("RULE-SQLI-001")
    assert pattern is not None
    assert pattern.search("UNION SELECT 1, 2, 3") is not None


def test_registry_target_filtering() -> None:
    registry = create_default_registry()
    uri_rules = registry.get_rules_for_target(LocationTarget.URI_PATH, max_paranoia_level=1)
    assert len(uri_rules) >= 2
    rule_ids = [r.rule_id for r, _ in uri_rules]
    assert "RULE-TRAV-001" in rule_ids


def test_sqli_patterns() -> None:
    registry = create_default_registry()
    pat_union = registry.get_pattern("RULE-SQLI-001")
    assert pat_union is not None
    assert pat_union.search("1' UNION ALL SELECT username, password FROM users--") is not None

    pat_taut = registry.get_pattern("RULE-SQLI-002")
    assert pat_taut is not None
    assert pat_taut.search("' or 'a'='a") is not None
    assert pat_taut.search("1 OR 1=1") is not None


def test_xss_patterns() -> None:
    registry = create_default_registry()
    pat_tag = registry.get_pattern("RULE-XSS-001")
    assert pat_tag is not None
    assert pat_tag.search("<script>alert(document.cookie)</script>") is not None
    assert pat_tag.search("<IFRAME SRC='evil.com'>") is not None

    pat_handler = registry.get_pattern("RULE-XSS-002")
    assert pat_handler is not None
    assert pat_handler.search("<img src=x onerror=alert(1)>") is not None


def test_traversal_patterns() -> None:
    registry = create_default_registry()
    pat_trav = registry.get_pattern("RULE-TRAV-001")
    assert pat_trav is not None
    assert pat_trav.search("../../etc/passwd") is not None
    assert pat_trav.search("..\\..\\windows\\system32") is not None


def test_cmdi_patterns() -> None:
    registry = create_default_registry()
    pat_cmdi = registry.get_pattern("RULE-CMDI-001")
    assert pat_cmdi is not None
    assert pat_cmdi.search("127.0.0.1; cat /etc/passwd") is not None
    assert pat_cmdi.search("test && id") is not None


def test_ssrf_patterns() -> None:
    registry = create_default_registry()
    pat_ssrf = registry.get_pattern("RULE-SSRF-001")
    assert pat_ssrf is not None
    assert pat_ssrf.search("http://127.0.0.1:8080/admin") is not None
    assert pat_ssrf.search("http://192.168.1.1/router") is not None

    pat_meta = registry.get_pattern("RULE-SSRF-002")
    assert pat_meta is not None
    assert pat_meta.search("http://169.254.169.254/latest/meta-data/") is not None


def test_client_scanner_patterns() -> None:
    registry = create_default_registry()
    pat_client = registry.get_pattern("RULE-CLIENT-001")
    assert pat_client is not None
    assert pat_client.search("sqlmap/1.7#stable") is not None
    assert pat_client.search("Mozilla/5.0 (compatible; Nikto/2.1.6)") is not None


def test_registry_clear() -> None:
    reg = RuleRegistry()
    reg.register_many(DEFAULT_RULES)
    assert len(reg.all_rules()) > 0
    reg.clear()
    assert len(reg.all_rules()) == 0
