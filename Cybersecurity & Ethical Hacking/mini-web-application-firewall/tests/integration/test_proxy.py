"""Integration tests for ReverseProxyForwarder and MiniWAFASGIMiddleware."""

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from miniwaf.proxy.forwarder import ReverseProxyForwarder
from miniwaf.proxy.middleware import MiniWAFASGIMiddleware


def _create_mock_transport() -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/error":
            return httpx.Response(
                500,
                headers={"Server": "VulnerableServer/1.0", "Content-Type": "text/html"},
                content=b"Traceback (most recent call last):\n  File app.py\nException: Boom",
            )
        if request.url.path == "/leak":
            return httpx.Response(
                200,
                headers={"Server": "nginx/1.20", "Content-Type": "text/plain"},
                content=b"Customer card: 4532015112830366 charged.",
            )
        return httpx.Response(
            200,
            headers={"Server": "nginx/1.20", "Content-Type": "application/json"},
            content=b'{"status": "upstream_ok"}',
        )

    return httpx.MockTransport(handler)


@pytest.mark.asyncio
async def test_reverse_proxy_forwarder_clean_request() -> None:
    transport = _create_mock_transport()
    client = httpx.AsyncClient(transport=transport, base_url="http://mock-upstream")

    forwarder = ReverseProxyForwarder(http_client=client)
    resp = await forwarder.forward_request(
        method="GET",
        path="/api/data",
        headers={"User-Agent": "ValidBrowser/1.0"},
    )
    assert resp.status_code == 200
    assert b"upstream_ok" in resp.body
    assert resp.headers["X-WAF-Action"] == "ALLOW"
    # Verify server header was stripped by response filter
    assert "Server" not in resp.headers

    await forwarder.close()


@pytest.mark.asyncio
async def test_reverse_proxy_forwarder_blocks_attack() -> None:
    transport = _create_mock_transport()
    client = httpx.AsyncClient(transport=transport, base_url="http://mock-upstream")

    forwarder = ReverseProxyForwarder(http_client=client)
    resp = await forwarder.forward_request(
        method="GET",
        path="/search",
        query_string="q=1%20UNION%20SELECT%20null",
        headers={"User-Agent": "ValidBrowser/1.0"},
    )
    assert resp.status_code == 403
    assert resp.headers["X-WAF-Action"] == "BLOCK"
    assert b"Request blocked by MiniWAF" in resp.body

    await forwarder.close()


@pytest.mark.asyncio
async def test_reverse_proxy_forwarder_sanitizes_leak_and_errors() -> None:
    transport = _create_mock_transport()
    client = httpx.AsyncClient(transport=transport, base_url="http://mock-upstream")

    forwarder = ReverseProxyForwarder(http_client=client)

    # Test error cloaking
    resp_err = await forwarder.forward_request(method="GET", path="/error", headers={})
    assert resp_err.status_code == 500
    assert b"Traceback" not in resp_err.body
    assert b"Internal Server Error" in resp_err.body

    # Test card masking
    resp_leak = await forwarder.forward_request(method="GET", path="/leak", headers={})
    assert resp_leak.status_code == 200
    assert b"4532********0366" in resp_leak.body

    await forwarder.close()


@pytest.mark.asyncio
async def test_reverse_proxy_forwarder_upstream_error() -> None:
    def failing_handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("Connection refused")

    client = httpx.AsyncClient(
        transport=httpx.MockTransport(failing_handler), base_url="http://down-upstream"
    )
    forwarder = ReverseProxyForwarder(http_client=client)

    resp = await forwarder.forward_request(method="GET", path="/ping", headers={})
    assert resp.status_code == 502
    assert b"Bad Gateway" in resp.body

    await forwarder.close()


def test_asgi_middleware_integration() -> None:
    base_app = FastAPI()

    @base_app.get("/items")
    def get_items() -> dict[str, str]:
        return {"item": "widget"}

    @base_app.post("/comments")
    def post_comment(data: dict[str, str]) -> dict[str, str]:
        return {"status": "saved", "comment": data.get("text", "")}

    # Wrap with MiniWAF ASGI middleware
    waf_app = MiniWAFASGIMiddleware(base_app)
    client = TestClient(waf_app)

    # 1. Clean GET request passes
    resp_clean = client.get("/items")
    assert resp_clean.status_code == 200
    assert resp_clean.json() == {"item": "widget"}
    assert resp_clean.headers["X-WAF-Action"] == "ALLOW"

    # 2. Malicious XSS POST request is intercepted by middleware
    resp_xss = client.post(
        "/comments",
        json={"text": "<script>alert('xss')</script>"},
    )
    assert resp_xss.status_code == 403
    assert resp_xss.headers["X-WAF-Action"] == "BLOCK"
    assert "Blocked by MiniWAF" in resp_xss.text

    # 3. Path traversal is intercepted
    resp_trav = client.get("/items?page=../../etc/passwd")
    assert resp_trav.status_code == 403
    assert resp_trav.headers["X-WAF-Action"] == "BLOCK"
