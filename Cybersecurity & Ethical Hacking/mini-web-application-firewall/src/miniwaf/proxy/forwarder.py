"""Async reverse proxy forwarder integrating WAF inspection and response cloaking."""

import httpx
from fastapi import Response

from miniwaf.config.settings import WAFSettings, get_settings
from miniwaf.core.engine import WAFEngine
from miniwaf.core.normalizer import RequestNormalizer
from miniwaf.defense.response import ResponseFilter
from miniwaf.models.context import HTTPResponseContext
from miniwaf.models.decision import WAFDecision


class ReverseProxyForwarder:
    """Forwards inspected client traffic to upstream backend servers."""

    def __init__(
        self,
        engine: WAFEngine | None = None,
        response_filter: ResponseFilter | None = None,
        settings: WAFSettings | None = None,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.engine = engine or WAFEngine(settings=self.settings)
        self.response_filter = response_filter or ResponseFilter(settings=self.settings)
        self._client = http_client or httpx.AsyncClient(
            base_url=self.settings.proxy_upstream_url,
            timeout=30.0,
            follow_redirects=False,
        )

    async def close(self) -> None:
        """Close internal httpx AsyncClient."""
        await self._client.aclose()

    def build_blocked_response(self, decision: WAFDecision) -> Response:
        """Generate standardized synthetic 403 Forbidden mitigation response."""
        blocked_body = (
            f'{{"error": "Forbidden", "message": "Request blocked by MiniWAF", '
            f'"request_id": "{decision.request_id}", "reason": "{decision.blocked_reason}"}}'
        )
        headers = {
            "Content-Type": "application/json",
            "X-WAF-Action": "BLOCK",
            "X-WAF-Score": str(decision.total_score),
            "X-WAF-Request-ID": decision.request_id,
        }
        return Response(content=blocked_body, status_code=403, headers=headers)

    async def forward_request(
        self,
        method: str,
        path: str,
        headers: dict[str, str],
        query_string: str = "",
        body: bytes = b"",
        client_ip: str = "127.0.0.1",
    ) -> Response:
        """Inspect inbound request, forward to upstream if clean, and filter outbound response."""
        # 1. Build and normalize request context
        ctx = RequestNormalizer.build_context(
            method=method,
            path=path,
            client_ip=client_ip,
            headers=headers,
            query_string=query_string,
            raw_body=body,
        )

        # 2. Inspect with WAF Engine
        decision = self.engine.inspect_request(ctx)
        if decision.is_blocked:
            return self.build_blocked_response(decision)

        # 3. Strip hop-by-hop headers before upstream forwarding
        forward_headers = {
            k: v
            for k, v in headers.items()
            if k.lower() not in ("host", "content-length", "connection")
        }
        forward_headers["X-Forwarded-For"] = client_ip
        forward_headers["X-WAF-Score"] = str(decision.total_score)

        # 4. Dispatch async request to upstream service
        target_url = f"{path}?{query_string}" if query_string else path
        try:
            upstream_resp = await self._client.request(
                method=method,
                url=target_url,
                headers=forward_headers,
                content=body if body else None,
            )
        except httpx.RequestError as exc:
            return Response(
                content=f'{{"error": "Bad Gateway", "detail": "Upstream unreachable: {exc}"}}',
                status_code=502,
                headers={"Content-Type": "application/json", "X-WAF-Action": "PASSED"},
            )

        # 5. Filter outbound response through Defense Shield
        resp_headers = dict(upstream_resp.headers)
        # Drop hop-by-hop headers
        resp_headers.pop("content-length", None)
        resp_headers.pop("transfer-encoding", None)

        resp_ctx = HTTPResponseContext(
            status_code=upstream_resp.status_code,
            headers=resp_headers,
            body=upstream_resp.content,
            content_type=resp_headers.get("content-type", "application/octet-stream"),
        )
        filtered_ctx = self.response_filter.inspect_response(resp_ctx)

        filtered_headers = dict(filtered_ctx.headers)
        filtered_headers["X-WAF-Action"] = decision.action.value
        filtered_headers["X-WAF-Score"] = str(decision.total_score)

        return Response(
            content=filtered_ctx.body,
            status_code=filtered_ctx.status_code,
            headers=filtered_headers,
        )
