"""ASGI Middleware allowing inline WAF protection in any ASGI application."""

import contextlib
import json
from collections.abc import Callable, MutableMapping
from typing import Any

from miniwaf.config.settings import WAFSettings, get_settings
from miniwaf.core.engine import WAFEngine
from miniwaf.core.normalizer import RequestNormalizer
from miniwaf.defense.response import ResponseFilter
from miniwaf.models.context import HTTPResponseContext

Scope = MutableMapping[str, Any]
Receive = Callable[[], Any]
Send = Callable[[MutableMapping[str, Any]], Any]


class MiniWAFASGIMiddleware:
    """Standard ASGI middleware intercepting requests and responses."""

    def __init__(
        self,
        app: Any,
        engine: WAFEngine | None = None,
        response_filter: ResponseFilter | None = None,
        settings: WAFSettings | None = None,
    ) -> None:
        self.app = app
        self.settings = settings or get_settings()
        self.engine = engine or WAFEngine(settings=self.settings)
        self.response_filter = response_filter or ResponseFilter(settings=self.settings)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        """Process ASGI transaction."""
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # 1. Extract request metadata
        method = scope.get("method", "GET")
        path = scope.get("path", "/")
        query_string = scope.get("query_string", b"").decode("latin-1")

        # Client IP
        client = scope.get("client")
        client_ip = client[0] if client else "127.0.0.1"

        # Headers
        headers: dict[str, str] = {}
        for h_name, h_val in scope.get("headers", []):
            with contextlib.suppress(Exception):
                headers[h_name.decode("latin-1")] = h_val.decode("latin-1")

        # 2. Buffer body bytes
        body_parts: list[bytes] = []
        more_body = True
        while more_body:
            message = await receive()
            body_parts.append(message.get("body", b""))
            more_body = message.get("more_body", False)
        raw_body = b"".join(body_parts)

        # 3. Build context and inspect with WAF engine
        ctx = RequestNormalizer.build_context(
            method=method,
            path=path,
            client_ip=client_ip,
            headers=headers,
            query_string=query_string,
            raw_body=raw_body,
        )
        decision = self.engine.inspect_request(ctx)

        if decision.is_blocked:
            # Short-circuit with 403 Forbidden
            blocked_payload = json.dumps(
                {
                    "error": "Forbidden",
                    "message": "Blocked by MiniWAF",
                    "request_id": decision.request_id,
                    "reason": decision.blocked_reason,
                }
            ).encode("utf-8")

            await send(
                {
                    "type": "http.response.start",
                    "status": 403,
                    "headers": [
                        (b"content-type", b"application/json"),
                        (b"x-waf-action", b"BLOCK"),
                        (b"x-waf-score", str(decision.total_score).encode("ascii")),
                    ],
                }
            )
            await send(
                {
                    "type": "http.response.body",
                    "body": blocked_payload,
                    "more_body": False,
                }
            )
            return

        # 4. Replay buffered body to downstream application
        body_sent = False

        async def custom_receive() -> dict[str, Any]:
            nonlocal body_sent
            if not body_sent:
                body_sent = True
                return {"type": "http.request", "body": raw_body, "more_body": False}
            return {"type": "http.request", "body": b"", "more_body": False}

        # 5. Capture downstream response for egress filtering
        response_status = 200
        response_headers: list[tuple[bytes, bytes]] = []
        response_body_parts: list[bytes] = []

        async def custom_send(message: dict[str, Any]) -> None:
            nonlocal response_status, response_headers, response_body_parts
            msg_type = message.get("type")

            if msg_type == "http.response.start":
                response_status = message.get("status", 200)
                response_headers = list(message.get("headers", []))
            elif msg_type == "http.response.body":
                response_body_parts.append(message.get("body", b""))
                if not message.get("more_body", False):
                    # Full body collected - apply egress filter
                    full_body = b"".join(response_body_parts)
                    headers_dict = {
                        k.decode("latin-1"): v.decode("latin-1") for k, v in response_headers
                    }
                    content_type = headers_dict.get("content-type", "text/plain")

                    resp_ctx = HTTPResponseContext(
                        status_code=response_status,
                        headers=headers_dict,
                        body=full_body,
                        content_type=content_type,
                    )
                    filtered = self.response_filter.inspect_response(resp_ctx)

                    out_headers: list[tuple[bytes, bytes]] = [
                        (k.encode("latin-1"), v.encode("latin-1"))
                        for k, v in filtered.headers.items()
                        if k.lower() not in ("content-length", "transfer-encoding")
                    ]
                    out_headers.append((b"x-waf-action", decision.action.value.encode("ascii")))
                    out_headers.append((b"x-waf-score", str(decision.total_score).encode("ascii")))

                    await send(
                        {
                            "type": "http.response.start",
                            "status": filtered.status_code,
                            "headers": out_headers,
                        }
                    )
                    await send(
                        {
                            "type": "http.response.body",
                            "body": filtered.body,
                            "more_body": False,
                        }
                    )

        await self.app(scope, custom_receive, custom_send)
