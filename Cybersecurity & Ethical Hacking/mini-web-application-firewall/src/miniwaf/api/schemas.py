"""Pydantic schemas for the MiniWAF management and telemetry REST API."""

from datetime import UTC, datetime

from pydantic import BaseModel, Field

from miniwaf.models.decision import WAFDecision


class HealthResponse(BaseModel):
    """System operational health response."""

    status: str = Field(default="healthy", description="Operational state")
    version: str = Field(..., description="Application version")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(UTC), description="Current UTC timestamp"
    )


class InspectAPIRequest(BaseModel):
    """Payload to simulate or inspect an HTTP transaction through WAF."""

    method: str = Field(default="GET", description="HTTP Method")
    path: str = Field(..., min_length=1, description="URI path")
    client_ip: str = Field(default="127.0.0.1", description="Source client IP")
    headers: dict[str, str] = Field(default_factory=dict, description="Request headers")
    query_string: str = Field(default="", description="Raw URL query string")
    body: str | None = Field(default=None, description="Request body payload")


class UnjailAPIRequest(BaseModel):
    """Payload to release an IP from jail."""

    client_ip: str = Field(..., min_length=3, description="Client IP to unjail")


class WAFStatsResponse(BaseModel):
    """Aggregated WAF telemetry and traffic statistics."""

    total_rules: int = Field(..., description="Registered detection rules")
    jailed_ips_count: int = Field(..., description="Currently active jailed IPs")
    mode: str = Field(..., description="Active operational mode: BLOCK or MONITOR")
    anomaly_threshold: int = Field(..., description="Active blocking threshold")
    paranoia_level: int = Field(..., description="Active paranoia level")


class RuleDetailResponse(BaseModel):
    """Rule taxonomy description."""

    rule_id: str
    name: str
    category: str
    severity: str
    paranoia_level: int
    target: str
    score: int
    cwe_id: str
    description: str


class RulesListResponse(BaseModel):
    """Collection of registered WAF rules."""

    total_rules: int
    rules: list[RuleDetailResponse]


__all__ = [
    "HealthResponse",
    "InspectAPIRequest",
    "RuleDetailResponse",
    "RulesListResponse",
    "UnjailAPIRequest",
    "WAFDecision",
    "WAFStatsResponse",
]
