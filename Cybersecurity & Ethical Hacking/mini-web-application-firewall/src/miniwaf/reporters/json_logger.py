"""Structured JSON security event logger."""

import json
from datetime import UTC, datetime
from pathlib import Path

from miniwaf.models.decision import SecurityEvent, WAFDecision
from miniwaf.reporters.base import BaseAuditLogger


class JSONAuditLogger(BaseAuditLogger):
    """Outputs structured JSON events to file or memory buffer."""

    def __init__(self, log_file: Path | str | None = None) -> None:
        self.log_file = Path(log_file) if log_file else None
        self.events: list[SecurityEvent] = []

    def log_decision(self, decision: WAFDecision, method: str, path: str) -> SecurityEvent:
        """Create and persist a SecurityEvent from a WAF decision."""
        rule_ids = [m.rule.rule_id for m in decision.matches]
        attack_types = list({m.rule.category.value for m in decision.matches})

        msg = (
            f"WAF {decision.action.value}: score={decision.total_score} "
            f"ip={decision.client_ip} method={method} path={path}"
        )
        if decision.is_blocked:
            msg += f" reason={decision.blocked_reason}"

        event = SecurityEvent(
            event_id=f"evt-{decision.request_id[:8]}",
            timestamp=datetime.now(UTC),
            client_ip=decision.client_ip,
            method=method,
            path=path,
            action=decision.action,
            total_score=decision.total_score,
            rule_ids=rule_ids,
            attack_types=attack_types,
            message=msg,
        )

        self.events.append(event)

        if self.log_file:
            self.log_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.log_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(event.model_dump(mode="json")) + "\n")

        return event
