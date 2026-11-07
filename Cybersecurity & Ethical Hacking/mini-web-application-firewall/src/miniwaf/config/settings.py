"""Configuration management for mini-waf."""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class WAFSettings(BaseSettings):
    """Runtime configuration for Mini Web Application Firewall."""

    app_name: str = "Mini Web Application Firewall"
    version: str = "0.1.0"
    environment: str = "development"
    debug: bool = False

    # Operational Mode & Thresholds
    mode: Literal["BLOCK", "MONITOR"] = "BLOCK"
    anomaly_threshold: int = 5
    paranoia_level: int = 1  # Range 1 to 4

    # Request Clamping & Limits
    max_body_size_bytes: int = 1_048_576  # 1 MB
    max_url_length: int = 4096
    max_headers_count: int = 100

    # Rate Limiting & IP Reputation
    rate_limit_enabled: bool = True
    rate_limit_requests_per_minute: int = 120
    rate_limit_burst: int = 30
    ip_jail_enabled: bool = True
    ip_jail_duration_seconds: int = 300
    ip_jail_violation_threshold: int = 3

    # Egress / Response Defenses
    response_inspection_enabled: bool = True
    mask_credit_cards: bool = True
    strip_server_headers: bool = True

    # Reverse Proxy & Server Networking
    proxy_upstream_url: str = "http://127.0.0.1:8000"
    proxy_host: str = "0.0.0.0"  # nosec B104
    proxy_port: int = 8080
    admin_api_port: int = 8083

    model_config = SettingsConfigDict(
        env_prefix="MINIWAF_",
        env_file=".env",
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> WAFSettings:
    """Provide singleton instance of WAF settings."""
    return WAFSettings()
