"""Unit tests verifying WAF inspection engine and anomaly scoring."""

from miniwaf.config.settings import WAFSettings
from miniwaf.core.engine import WAFEngine
from miniwaf.core.normalizer import RequestNormalizer
from miniwaf.models.enums import AttackType, WAFAction


def test_engine_allows_benign_traffic() -> None:
    engine = WAFEngine()
    ctx = RequestNormalizer.build_context(
        method="GET",
        path="/api/v1/products",
        client_ip="192.168.1.10",
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
        query_string="category=books&page=1",
    )
    decision = engine.inspect_request(ctx)
    assert decision.action == WAFAction.ALLOW
    assert decision.is_blocked is False
    assert decision.total_score == 0
    assert len(decision.matches) == 0


def test_engine_blocks_sqli_in_query() -> None:
    engine = WAFEngine()
    ctx = RequestNormalizer.build_context(
        method="GET",
        path="/items",
        client_ip="192.168.1.55",
        query_string="id=1%20UNION%20SELECT%20username,%20password%20FROM%20users",
    )
    decision = engine.inspect_request(ctx)
    assert decision.action == WAFAction.BLOCK
    assert decision.is_blocked is True
    assert decision.total_score >= 5
    assert any(m.rule.category == AttackType.SQLI for m in decision.matches)
    assert "SQLI" in str(decision.blocked_reason)


def test_engine_blocks_xss_in_body() -> None:
    engine = WAFEngine()
    ctx = RequestNormalizer.build_context(
        method="POST",
        path="/comments",
        client_ip="10.2.3.4",
        headers={"Content-Type": "application/json"},
        raw_body=b'{"comment": "<script>alert(1)</script>"}',
    )
    decision = engine.inspect_request(ctx)
    assert decision.action == WAFAction.BLOCK
    assert decision.is_blocked is True
    assert any(m.rule.category == AttackType.XSS for m in decision.matches)


def test_engine_blocks_path_traversal() -> None:
    engine = WAFEngine()
    ctx = RequestNormalizer.build_context(
        method="GET",
        path="/static/../../etc/passwd",
        client_ip="10.2.3.5",
    )
    decision = engine.inspect_request(ctx)
    assert decision.action == WAFAction.BLOCK
    assert decision.is_blocked is True
    assert any(m.rule.category == AttackType.TRAVERSAL for m in decision.matches)


def test_engine_monitor_mode_does_not_block() -> None:
    settings = WAFSettings(mode="MONITOR", anomaly_threshold=5)
    engine = WAFEngine(settings=settings)
    ctx = RequestNormalizer.build_context(
        method="GET",
        path="/search",
        client_ip="192.168.1.99",
        query_string="q=1%20UNION%20SELECT%20null",
    )
    decision = engine.inspect_request(ctx)
    assert decision.action == WAFAction.MONITOR
    assert decision.is_blocked is False
    assert decision.total_score >= 5


def test_engine_rate_limit_blocking() -> None:
    settings = WAFSettings(rate_limit_burst=2, rate_limit_requests_per_minute=60)
    engine = WAFEngine(settings=settings)
    client = "172.16.0.45"

    ctx = RequestNormalizer.build_context(method="GET", path="/test", client_ip=client)
    assert engine.inspect_request(ctx).is_blocked is False
    assert engine.inspect_request(ctx).is_blocked is False

    # 3rd request violates burst
    decision = engine.inspect_request(ctx)
    assert decision.action == WAFAction.BLOCK
    assert decision.is_blocked is True
    assert any(m.rule.category == AttackType.RATE_LIMIT_EXCEEDED for m in decision.matches)
