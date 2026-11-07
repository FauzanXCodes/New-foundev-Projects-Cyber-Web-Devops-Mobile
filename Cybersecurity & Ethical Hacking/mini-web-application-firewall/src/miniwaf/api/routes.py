"""REST API endpoints for WAF inspection, telemetry, and administration."""

from fastapi import APIRouter, status

from miniwaf.api.schemas import (
    HealthResponse,
    InspectAPIRequest,
    RuleDetailResponse,
    RulesListResponse,
    UnjailAPIRequest,
    WAFDecision,
    WAFStatsResponse,
)
from miniwaf.config.settings import get_settings
from miniwaf.core.engine import WAFEngine
from miniwaf.core.normalizer import RequestNormalizer

router = APIRouter()
_engine = WAFEngine()


@router.get("/health", response_model=HealthResponse, tags=["System"])
def get_health() -> HealthResponse:
    """Return WAF microservice operational health status."""
    settings = get_settings()
    return HealthResponse(status="healthy", version=settings.version)


@router.post(
    "/api/v1/inspect",
    response_model=WAFDecision,
    status_code=status.HTTP_200_OK,
    tags=["Inspection"],
)
def inspect_transaction(payload: InspectAPIRequest) -> WAFDecision:
    """Execute WAF inspection on an incoming transaction."""
    raw_body = payload.body.encode("utf-8") if payload.body else b""
    ctx = RequestNormalizer.build_context(
        method=payload.method,
        path=payload.path,
        client_ip=payload.client_ip,
        headers=payload.headers,
        query_string=payload.query_string,
        raw_body=raw_body,
    )
    return _engine.inspect_request(ctx)


@router.get(
    "/api/v1/rules",
    response_model=RulesListResponse,
    tags=["Rules"],
)
def list_rules() -> RulesListResponse:
    """List all registered WAF rules and signatures."""
    rules = _engine.registry.all_rules()
    details = [
        RuleDetailResponse(
            rule_id=r.rule_id,
            name=r.name,
            category=r.category.value,
            severity=r.severity.value,
            paranoia_level=r.paranoia_level,
            target=r.target.value,
            score=r.score,
            cwe_id=r.cwe_id,
            description=r.description,
        )
        for r in rules
    ]
    return RulesListResponse(total_rules=len(details), rules=details)


@router.get(
    "/api/v1/stats",
    response_model=WAFStatsResponse,
    tags=["Telemetry"],
)
def get_stats() -> WAFStatsResponse:
    """Return active WAF configuration and telemetry."""
    settings = get_settings()
    rules = _engine.registry.all_rules()
    jailed = _engine.ratelimiter.jail.jailed_ips()
    return WAFStatsResponse(
        total_rules=len(rules),
        jailed_ips_count=len(jailed),
        mode=settings.mode,
        anomaly_threshold=settings.anomaly_threshold,
        paranoia_level=settings.paranoia_level,
    )


@router.get(
    "/api/v1/jailed",
    response_model=dict[str, float],
    tags=["Reputation"],
)
def list_jailed_ips() -> dict[str, float]:
    """List currently banned IP addresses and remaining jail seconds."""
    return _engine.ratelimiter.jail.jailed_ips()


@router.post(
    "/api/v1/unjail",
    status_code=status.HTTP_200_OK,
    tags=["Reputation"],
)
def unjail_ip(payload: UnjailAPIRequest) -> dict[str, str]:
    """Release a client IP from dynamic jail."""
    _engine.ratelimiter.jail.release(payload.client_ip)
    return {"status": "success", "message": f"IP {payload.client_ip} unjailed successfully."}
