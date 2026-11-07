"""Unit tests verifying domain models and enums."""

from miniwaf.models.context import HTTPRequestContext, HTTPResponseContext
from miniwaf.models.decision import SecurityEvent, WAFDecision
from miniwaf.models.enums import AttackType, LocationTarget, RuleSeverity, WAFAction
from miniwaf.models.rules import RuleMatch, WAFRule


def test_severity_anomaly_score_weights() -> None:
    assert RuleSeverity.NOTICE.anomaly_score == 1
    assert RuleSeverity.LOW.anomaly_score == 2
    assert RuleSeverity.MEDIUM.anomaly_score == 3
    assert RuleSeverity.HIGH.anomaly_score == 4
    assert RuleSeverity.CRITICAL.anomaly_score == 5


def test_waf_rule_instantiation() -> None:
    rule = WAFRule(
        rule_id="RULE-SQLI-001",
        name="Basic SQLi Union Detection",
        category=AttackType.SQLI,
        severity=RuleSeverity.CRITICAL,
        paranoia_level=1,
        pattern=r"(?i)union\s+select",
        target=LocationTarget.QUERY_PARAM,
        cwe_id="CWE-89",
        description="Detects classic union-based SQL injection attempts",
        remediation="Use parameterized queries",
    )
    assert rule.score == 5
    assert rule.category == AttackType.SQLI
    assert rule.cwe_id == "CWE-89"


def test_rule_match_creation() -> None:
    rule = WAFRule(
        rule_id="RULE-XSS-001",
        name="Script Tag Injection",
        category=AttackType.XSS,
        severity=RuleSeverity.HIGH,
        paranoia_level=1,
        pattern=r"(?i)<script",
        target=LocationTarget.BODY,
        cwe_id="CWE-79",
        description="Detects unescaped script tag",
        remediation="HTML encode dynamic input",
    )
    match = RuleMatch(
        rule=rule,
        target=LocationTarget.BODY,
        matched_key="comment",
        matched_value="<script>alert(1)</script>",
        sample_snippet="<script>alert(1)",
    )
    assert match.rule.score == 4
    assert match.target == LocationTarget.BODY
    assert match.matched_key == "comment"


def test_waf_decision_creation() -> None:
    decision = WAFDecision(
        request_id="req-12345",
        action=WAFAction.BLOCK,
        total_score=8,
        threshold=5,
        is_blocked=True,
        blocked_reason="Anomaly score 8 exceeded threshold 5",
        matches=[],
        client_ip="192.168.1.100",
        execution_time_ms=1.25,
    )
    assert decision.is_blocked is True
    assert decision.total_score == 8
    assert decision.action == WAFAction.BLOCK


def test_request_and_response_contexts() -> None:
    req_ctx = HTTPRequestContext(
        request_id="req-abc",
        client_ip="10.0.0.5",
        method="POST",
        path="/api/login",
        normalized_path="/api/login",
        headers={"user-agent": "curl/8.0"},
        body_text="username=admin",
    )
    assert req_ctx.method == "POST"
    assert req_ctx.headers["user-agent"] == "curl/8.0"

    resp_ctx = HTTPResponseContext(
        status_code=200,
        headers={"content-type": "application/json"},
        body=b'{"status": "ok"}',
    )
    assert resp_ctx.status_code == 200
    assert resp_ctx.body == b'{"status": "ok"}'


def test_security_event_model() -> None:
    event = SecurityEvent(
        event_id="evt-001",
        client_ip="1.2.3.4",
        method="GET",
        path="/search",
        action=WAFAction.BLOCK,
        total_score=10,
        rule_ids=["RULE-SQLI-001"],
        attack_types=[AttackType.SQLI.value],
        message="Blocked SQL injection attempt",
    )
    assert event.action == WAFAction.BLOCK
    assert event.total_score == 10
    assert event.rule_ids == ["RULE-SQLI-001"]
