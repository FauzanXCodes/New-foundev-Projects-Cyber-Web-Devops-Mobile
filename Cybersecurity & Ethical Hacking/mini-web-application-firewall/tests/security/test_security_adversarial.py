"""Adversarial security and WAF evasion fuzzing test suite."""

import urllib.parse

import pytest

from miniwaf.core.engine import WAFEngine
from miniwaf.core.normalizer import RequestNormalizer
from miniwaf.models.enums import AttackType, WAFAction


@pytest.fixture
def engine() -> WAFEngine:
    return WAFEngine()


def test_evasion_double_url_encoded_sqli(engine: WAFEngine) -> None:
    # Double encoded: %2527 -> %27 -> '
    double_encoded_query = "id=1%2527%2520UNION%2520SELECT%25201,2"
    ctx = RequestNormalizer.build_context(
        method="GET",
        path="/items",
        client_ip="192.168.1.10",
        query_string=double_encoded_query,
    )
    decision = engine.inspect_request(ctx)
    assert decision.action == WAFAction.BLOCK
    assert any(m.rule.category == AttackType.SQLI for m in decision.matches)


def test_evasion_mixed_case_sqli(engine: WAFEngine) -> None:
    mixed_case_query = "id=1' uNiOn  sElEcT 1,2,3--"
    ctx = RequestNormalizer.build_context(
        method="GET",
        path="/search",
        client_ip="192.168.1.11",
        query_string=mixed_case_query,
    )
    decision = engine.inspect_request(ctx)
    assert decision.action == WAFAction.BLOCK
    assert any(m.rule.category == AttackType.SQLI for m in decision.matches)


def test_evasion_fullwidth_unicode_xss(engine: WAFEngine) -> None:
    # Fullwidth Unicode characters: ＜script＞
    fullwidth_payload = '{"input": "＜script＞alert(1)＜/script＞"}'
    ctx = RequestNormalizer.build_context(
        method="POST",
        path="/submit",
        client_ip="192.168.1.12",
        headers={"Content-Type": "application/json"},
        raw_body=fullwidth_payload.encode("utf-8"),
    )
    decision = engine.inspect_request(ctx)
    assert decision.action == WAFAction.BLOCK
    assert any(m.rule.category == AttackType.XSS for m in decision.matches)


def test_evasion_html_entity_unescaping_xss(engine: WAFEngine) -> None:
    entity_payload = "&lt;script&gt;alert(document.cookie)&lt;/script&gt;"
    ctx = RequestNormalizer.build_context(
        method="POST",
        path="/profile",
        client_ip="192.168.1.13",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        raw_body=f"bio={entity_payload}".encode(),
    )
    decision = engine.inspect_request(ctx)
    assert decision.action == WAFAction.BLOCK
    assert any(m.rule.category == AttackType.XSS for m in decision.matches)


@pytest.mark.parametrize(
    "payload",
    [
        "../../../../etc/passwd",
        "..%2f..%2f..%2fetc%2fshadow",
        "..\\..\\..\\windows\\system32",
        "file.pdf%00",
    ],
)
def test_evasion_path_traversal_variations(engine: WAFEngine, payload: str) -> None:
    ctx = RequestNormalizer.build_context(
        method="GET",
        path=f"/download/{payload}",
        client_ip="192.168.1.14",
    )
    decision = engine.inspect_request(ctx)
    assert decision.action == WAFAction.BLOCK
    assert any(m.rule.category == AttackType.TRAVERSAL for m in decision.matches)


@pytest.mark.parametrize(
    "cmd_payload",
    [
        "127.0.0.1; whoami",
        "test && id",
        "test || cat /etc/passwd",
        "$(whoami)",
    ],
)
def test_cmdi_adversarial_patterns(engine: WAFEngine, cmd_payload: str) -> None:
    ctx = RequestNormalizer.build_context(
        method="GET",
        path="/ping",
        client_ip="192.168.1.15",
        query_string=urllib.parse.urlencode({"host": cmd_payload}),
    )
    decision = engine.inspect_request(ctx)
    assert decision.action == WAFAction.BLOCK
    assert any(m.rule.category == AttackType.CMDI for m in decision.matches)


def test_ssrf_cloud_metadata(engine: WAFEngine) -> None:
    ctx = RequestNormalizer.build_context(
        method="GET",
        path="/fetch",
        client_ip="192.168.1.16",
        query_string="url=http://169.254.169.254/latest/meta-data/",
    )
    decision = engine.inspect_request(ctx)
    assert decision.action == WAFAction.BLOCK
    assert any(m.rule.category == AttackType.SSRF for m in decision.matches)


def test_malicious_scanner_user_agent(engine: WAFEngine) -> None:
    ctx = RequestNormalizer.build_context(
        method="GET",
        path="/index",
        client_ip="192.168.1.17",
        headers={"User-Agent": "sqlmap/1.6.12#stable"},
    )
    decision = engine.inspect_request(ctx)
    assert any(m.rule.category == AttackType.MALICIOUS_CLIENT for m in decision.matches)


def test_dos_oversized_payload_resilience(engine: WAFEngine) -> None:
    # 5MB massive benign payload
    huge_body = b"field=" + (b"A" * 5_000_000)
    ctx = RequestNormalizer.build_context(
        method="POST",
        path="/upload",
        client_ip="192.168.1.18",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        raw_body=huge_body,
    )
    decision = engine.inspect_request(ctx)
    assert decision.action == WAFAction.ALLOW
    assert decision.execution_time_ms < 500.0  # Finishes swiftly due to body size clamping
