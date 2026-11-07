"""Request and response transaction context models for inspection."""

from typing import Any

from pydantic import BaseModel, Field


class HTTPRequestContext(BaseModel):
    """Normalized, deconstructed representation of an incoming HTTP request."""

    request_id: str = Field(..., description="Unique transaction tracking UUID")
    client_ip: str = Field(..., description="Resolved client IP address")
    method: str = Field(..., description="HTTP Method (GET, POST, etc.)")
    path: str = Field(..., description="Raw URI path")
    normalized_path: str = Field(..., description="Decoded, canonicalized path")
    query_params: dict[str, list[str]] = Field(
        default_factory=dict, description="Parsed query parameters"
    )
    headers: dict[str, str] = Field(
        default_factory=dict, description="Normalized lower-case headers"
    )
    cookies: dict[str, str] = Field(default_factory=dict, description="Parsed cookies")
    raw_body: bytes = Field(default=b"", description="Raw binary body bytes")
    body_text: str = Field(default="", description="Decoded string body content if readable")
    parsed_json: dict[str, Any] | list[Any] | None = Field(
        default=None, description="Parsed JSON object if application/json"
    )
    content_type: str = Field(default="application/octet-stream", description="MIME content type")
    user_agent: str = Field(default="", description="Client User-Agent header value")


class HTTPResponseContext(BaseModel):
    """Context representing outgoing backend response prior to egress to client."""

    status_code: int = Field(..., description="HTTP Status code returned from upstream")
    headers: dict[str, str] = Field(
        default_factory=dict, description="Response headers from upstream"
    )
    body: bytes = Field(default=b"", description="Response body content")
    content_type: str = Field(default="text/plain", description="Response MIME content type")
