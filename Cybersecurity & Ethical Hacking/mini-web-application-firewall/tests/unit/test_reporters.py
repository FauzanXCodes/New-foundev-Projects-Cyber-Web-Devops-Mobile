"""Unit tests verifying audit loggers (JSON, CEF) and Rich console reporter."""

import json
from pathlib import Path

from rich.console import Console

from miniwaf.models.decision import WAFDecision
from miniwaf.models.enums import AttackType, LocationTarget, RuleSeverity, WAFAction
from miniwaf.models.rules import RuleMatch, WAFRule
from miniwaf.reporters.cef_logger import CEFAuditLogger
from miniwaf.reporters.json_logger import JSONAuditLogger
from miniwaf.reporters.rich_reporter import RichConsoleReporter


def _sample_decision(is_blocked: bool = True) -> WAFDecision:
    rule = WAFRule(
        rule_id="RULE-SQLI-001",
        name="Union SQLi",
        category=AttackType.SQLI,
        severity=RuleSeverity.CRITICAL,
        paranoia_level=1,
        pattern=r"union select",
        target=LocationTarget.QUERY_PARAM,
        cwe_id="CWE-89",
        description="Union select detected",
        remediation="Parameterize queries",
    )
    match = RuleMatch(
        rule=rule,
        target=LocationTarget.QUERY_PARAM,
        matched_key="id",
        matched_value="1 UNION SELECT 1",
        sample_snippet="1 UNION SELECT 1",
    )
    return WAFDecision(
        request_id="req-999888",
        action=WAFAction.BLOCK if is_blocked else WAFAction.ALLOW,
        total_score=5 if is_blocked else 0,
        threshold=5,
        is_blocked=is_blocked,
        blocked_reason="Anomaly score exceeded threshold" if is_blocked else None,
        matches=[match] if is_blocked else [],
        client_ip="192.168.1.100",
        execution_time_ms=0.85,
    )


def test_json_audit_logger(tmp_path: Path) -> None:
    log_file = tmp_path / "audit.json"
    logger = JSONAuditLogger(log_file=log_file)

    decision = _sample_decision(is_blocked=True)
    event = logger.log_decision(decision, method="GET", path="/items")

    assert event.client_ip == "192.168.1.100"
    assert event.action == WAFAction.BLOCK
    assert "RULE-SQLI-001" in event.rule_ids
    assert len(logger.events) == 1

    # Verify persistent file content
    assert log_file.exists()
    content = log_file.read_text(encoding="utf-8")
    parsed = json.loads(content.strip())
    assert parsed["client_ip"] == "192.168.1.100"


def test_cef_audit_logger(tmp_path: Path) -> None:
    log_file = tmp_path / "audit.cef"
    logger = CEFAuditLogger(log_file=log_file)

    decision = _sample_decision(is_blocked=True)
    event = logger.log_decision(decision, method="POST", path="/login")

    assert event.action == WAFAction.BLOCK
    assert len(logger.cef_lines) == 1

    cef_str = logger.cef_lines[0]
    assert cef_str.startswith("CEF:0|MiniWAF|WAF|")
    assert "RULE-SQLI-001" in cef_str
    assert "act=BLOCK" in cef_str
    assert "src=192.168.1.100" in cef_str


def test_rich_console_reporter() -> None:
    console = Console(record=True, width=120)
    reporter = RichConsoleReporter(console=console)

    decision = _sample_decision(is_blocked=True)
    reporter.print_decision(decision, method="GET", path="/search")

    output = console.export_text()
    assert "WAF DECISION: BLOCK" in output
    assert "RULE-SQLI-001" in output
    assert "192.168.1.100" in output
