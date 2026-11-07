"""Unit tests verifying HTTP request normalization and decoding."""

from miniwaf.core.normalizer import RequestNormalizer


def test_recursive_urldecode() -> None:
    # Single URL encoding
    assert RequestNormalizer.recursive_urldecode("%3Cscript%3E") == "<script>"
    # Double URL encoding
    assert RequestNormalizer.recursive_urldecode("%253Cscript%253E") == "<script>"
    # Triple URL encoding
    assert RequestNormalizer.recursive_urldecode("%25253Cscript%25253E") == "<script>"


def test_unicode_normalization() -> None:
    # Fullwidth Unicode characters: ＜script＞
    fullwidth = "＜script＞alert(1)＜/script＞"
    normalized = RequestNormalizer.normalize_unicode(fullwidth)
    assert normalized == "<script>alert(1)</script>"


def test_html_entity_unescaping() -> None:
    escaped = "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
    unescaped = RequestNormalizer.unescape_html_entities(escaped)
    assert unescaped == '<script>alert("xss")</script>'


def test_canonicalize_path() -> None:
    assert RequestNormalizer.canonicalize_path("//app//static/../admin/panel") == "/app/admin/panel"
    assert RequestNormalizer.canonicalize_path("/api/v1/../../etc/passwd") == "/etc/passwd"
    assert RequestNormalizer.canonicalize_path("/folder/./subfolder/") == "/folder/subfolder/"


def test_parse_query_params_and_cookies() -> None:
    query = "id=1%2527%20OR%201=1&tag=%3Cb%3Ehi%3C/b%3E"
    parsed_q = RequestNormalizer.parse_query_params(query)
    assert parsed_q["id"] == ["1' OR 1=1"]
    assert parsed_q["tag"] == ["<b>hi</b>"]

    cookie_header = "session_id=abc1234; user_pref=%7B%22theme%22%3A%22dark%22%7D"
    parsed_c = RequestNormalizer.parse_cookies(cookie_header)
    assert parsed_c["session_id"] == "abc1234"
    assert parsed_c["user_pref"] == '{"theme":"dark"}'


def test_build_context_with_json_body() -> None:
    body = b'{"query": "SELECT * FROM users", "active": true}'
    ctx = RequestNormalizer.build_context(
        method="POST",
        path="/api/search",
        client_ip="192.168.1.50",
        headers={
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0",
            "Cookie": "token=secret",
        },
        query_string="debug=true",
        raw_body=body,
    )
    assert ctx.method == "POST"
    assert ctx.path == "/api/search"
    assert ctx.client_ip == "192.168.1.50"
    assert ctx.content_type == "application/json"
    assert ctx.user_agent == "Mozilla/5.0"
    assert ctx.cookies["token"] == "secret"
    assert ctx.query_params["debug"] == ["true"]
    assert ctx.parsed_json == {"query": "SELECT * FROM users", "active": True}


def test_build_context_clamping() -> None:
    oversized = b"A" * 2_000_000
    norm_text, _ = RequestNormalizer.parse_body(
        raw_body=oversized,
        content_type="text/plain",
        max_size_bytes=1000,
    )
    assert len(norm_text) == 1000
