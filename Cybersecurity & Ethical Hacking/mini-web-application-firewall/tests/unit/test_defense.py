"""Unit tests verifying outbound response inspection and data leakage prevention."""

from miniwaf.config.settings import WAFSettings
from miniwaf.defense.response import ResponseFilter
from miniwaf.models.context import HTTPResponseContext


def test_luhn_checksum_algorithm() -> None:
    # Valid Visa card test number
    assert ResponseFilter.luhn_checksum("4532015112830366") is True
    # Invalid card number
    assert ResponseFilter.luhn_checksum("4532015112830367") is False
    # Short length
    assert ResponseFilter.luhn_checksum("12345") is False


def test_mask_credit_cards_in_text() -> None:
    text = "Customer placed order with card: 4532015112830366."
    masked = ResponseFilter.mask_credit_cards(text)
    assert "4532********0366" in masked
    assert "4532015112830366" not in masked


def test_strip_server_fingerprinting_headers() -> None:
    filter_engine = ResponseFilter()
    headers = {
        "Content-Type": "application/json",
        "Server": "Apache/2.4.41 (Ubuntu)",
        "X-Powered-By": "PHP/7.4.3",
        "X-AspNet-Version": "4.0.30319",
        "X-Custom-App": "MyService",
    }
    sanitized = filter_engine.filter_headers(headers)
    assert "server" not in sanitized
    assert "Server" not in sanitized
    assert "X-Powered-By" not in sanitized
    assert "X-AspNet-Version" not in sanitized
    assert sanitized["X-Custom-App"] == "MyService"
    assert sanitized["Content-Type"] == "application/json"


def test_cloak_500_error_stack_trace() -> None:
    filter_engine = ResponseFilter()
    error_body = (
        b"Traceback (most recent call last):\n"
        b'  File "app.py", line 42, in index\n'
        b"    cursor.execute('SELECT * FROM users')\n"
        b"DatabaseError: connection failed"
    )
    cloaked = filter_engine.filter_body(
        status_code=500,
        body_bytes=error_body,
        content_type="text/html",
    )
    assert b"Traceback" not in cloaked
    assert b"DatabaseError" not in cloaked
    assert b"Internal Server Error" in cloaked
    assert b"diagnostic details have been suppressed" in cloaked


def test_inspect_response_full_pipeline() -> None:
    filter_engine = ResponseFilter()
    resp_ctx = HTTPResponseContext(
        status_code=200,
        headers={"Server": "nginx/1.18.0", "Content-Type": "text/plain"},
        body=b"Your card 4532015112830366 was charged $49.99.",
        content_type="text/plain",
    )
    inspected = filter_engine.inspect_response(resp_ctx)
    assert "Server" not in inspected.headers
    assert b"4532********0366" in inspected.body


def test_disabled_response_inspection() -> None:
    settings = WAFSettings(response_inspection_enabled=False)
    filter_engine = ResponseFilter(settings=settings)
    resp_ctx = HTTPResponseContext(
        status_code=200,
        headers={"Server": "nginx"},
        body=b"plain text",
    )
    inspected = filter_engine.inspect_response(resp_ctx)
    assert inspected.headers["Server"] == "nginx"
