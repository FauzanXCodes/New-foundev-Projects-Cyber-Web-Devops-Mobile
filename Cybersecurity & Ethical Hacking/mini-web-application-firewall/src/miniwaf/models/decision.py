"""Models capturing WAF mitigation decisions and structured security audit events."""

from datetime import UTC, datetime

from pydantic import BaseModel, Field

from miniwaf.models.enums import WAFAction
from miniwaf.models.rules import RuleMatch


class WAFDecision(BaseModel):
    """Result of full WAF inspection on an HTTP transaction."""

    request_id: str = Field(..., description="Unique transaction UUID")
    action: WAFAction = Field(..., description="Final mitigation action: ALLOW, BLOCK, MONITOR")
    total_score: int = Field(default=0, ge=0, description="Total aggregated anomaly score")
    threshold: int = Field(default=5, description="Active anomaly blocking threshold")
    is_blocked: bool = Field(..., description="True if action is BLOCK")
    blocked_reason: str | None = Field(
        default=None, description="Detailed rationale if request was blocked"
    )
    matches: list[RuleMatch] = Field(
        default_factory=list, description="All individual rule matches triggered"
    )
    client_ip: str = Field(..., description="Client IP address")
    execution_time_ms: float = Field(
        default=0.0, description="WAF processing latency in milliseconds"
    )


class SecurityEvent(BaseModel):
    """Audit log schema for recording security violations and mitigation events."""

    event_id: str = Field(..., description="Unique event identifier")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(UTC), description="Event creation timestamp"
    )
    client_ip: str = Field(..., description="Client IP address")
    method: str = Field(..., description="HTTP Method")
    path: str = Field(..., description="Target URI path")
    action: WAFAction = Field(..., description="Action taken")
    total_score: int = Field(..., description="Accumulated anomaly score")
    rule_ids: list[str] = Field(default_factory=list, description="IDs of all triggered rules")
    attack_types: list[str] = Field(
        default_factory=list, description="List of attack classifications identified"
    )
    message: str = Field(..., description="Human-readable event summary")
