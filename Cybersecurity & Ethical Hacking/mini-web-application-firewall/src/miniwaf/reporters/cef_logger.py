"""Common Event Format (CEF) logger for enterprise SIEM integration."""

from pathlib import Path

from miniwaf import __version__
from miniwaf.models.decision import SecurityEvent, WAFDecision
from miniwaf.reporters.base import BaseAuditLogger
from miniwaf.reporters.json_logger import JSONAuditLogger


class CEFAuditLogger(BaseAuditLogger):
    """Formats security events into standard ArcSight/CEF format."""

    def __init__(self, log_file: Path | str | None = None) -> None:
        self.log_file = Path(log_file) if log_file else None
        self._json_logger = JSONAuditLogger()
        self.cef_lines: list[str] = []

    def format_cef(self, decision: WAFDecision, method: str, path: str) -> str:
        """Construct standard CEF line string."""
        severity = min(10, max(1, decision.total_score * 2))
        sig_id = decision.matches[0].rule.rule_id if decision.matches else "WAF-INFO-001"
        name = decision.matches[0].rule.name if decision.matches else "Transaction Inspected"

        # Extensions
        ext = (
            f"src={decision.client_ip} requestMethod={method} request={path} "
            f"act={decision.action.value} cn1={decision.total_score} "
            f"cn1Label=AnomalyScore externalId={decision.request_id}"
        )
        if decision.blocked_reason:
            clean_reason = decision.blocked_reason.replace("=", r"\=")
            ext += f" msg={clean_reason}"

        return f"CEF:0|MiniWAF|WAF|{__version__}|{sig_id}|{name}|{severity}|{ext}"

    def log_decision(self, decision: WAFDecision, method: str, path: str) -> SecurityEvent:
        """Format CEF and record security event."""
        cef_string = self.format_cef(decision, method, path)
        self.cef_lines.append(cef_string)

        if self.log_file:
            self.log_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.log_file, "a", encoding="utf-8") as f:
                f.write(cef_string + "\n")

        return self._json_logger.log_decision(decision, method, path)
