"""HTTP request deconstruction, decoding, and canonicalization normalizer."""

import html
import json
import posixpath
import re
import unicodedata
import urllib.parse
import uuid
from typing import Any

from miniwaf.config.settings import get_settings
from miniwaf.models.context import HTTPRequestContext


class RequestNormalizer:
    """Deconstructs and normalizes raw HTTP transactions to neutralize WAF evasion."""

    _NULL_BYTE_PATTERN = re.compile(r"%00|\x00")
    _MULTIPLE_SLASHES = re.compile(r"/+")

    @classmethod
    def recursive_urldecode(cls, value: str, max_passes: int = 5) -> str:
        """Decode URL percentage sequences repeatedly to dismantle double-encoding evasion."""
        current = value
        for _ in range(max_passes):
            decoded = urllib.parse.unquote(current)
            if decoded == current:
                break
            current = decoded
        return current

    @classmethod
    def normalize_unicode(cls, text: str) -> str:
        """Apply Unicode NFKC normalization to collapse full-width homoglyphs."""
        return unicodedata.normalize("NFKC", text)

    @classmethod
    def unescape_html_entities(cls, text: str) -> str:
        """Convert HTML entities (e.g. &lt;, &#x3c;) into raw characters."""
        return html.unescape(text)

    @classmethod
    def canonicalize_path(cls, raw_path: str) -> str:
        """Resolve path traversal sequences (../, ./) and remove redundant slashes."""
        decoded = cls.recursive_urldecode(raw_path)
        # Strip query string or fragment if embedded in path
        clean_path = decoded.split("?")[0].split("#")[0]
        # Remove redundant repeated slashes
        clean_path = cls._MULTIPLE_SLASHES.sub("/", clean_path)
        # Resolve dot segments safely using posixpath
        normalized = posixpath.normpath(clean_path)
        if clean_path.endswith("/") and not normalized.endswith("/"):
            normalized += "/"
        return normalized

    @classmethod
    def normalize_string_value(cls, value: str) -> str:
        """Apply full multi-stage normalization (URL decode, Unicode NFKC, HTML entities)."""
        step1 = cls.recursive_urldecode(value)
        step2 = cls.normalize_unicode(step1)
        return cls.unescape_html_entities(step2)

    @classmethod
    def parse_query_params(cls, query_string: str) -> dict[str, list[str]]:
        """Parse query string with normalization on keys and values."""
        parsed = urllib.parse.parse_qs(query_string, keep_blank_values=True)
        normalized: dict[str, list[str]] = {}
        for k, vals in parsed.items():
            norm_key = cls.normalize_string_value(k)
            normalized[norm_key] = [cls.normalize_string_value(v) for v in vals]
        return normalized

    @classmethod
    def parse_cookies(cls, cookie_header: str | None) -> dict[str, str]:
        """Extract and normalize cookie name-value pairs from Cookie header."""
        if not cookie_header:
            return {}
        cookies: dict[str, str] = {}
        for item in cookie_header.split(";"):
            item_trimmed = item.strip()
            if not item_trimmed or "=" not in item_trimmed:
                continue
            name, val = item_trimmed.split("=", 1)
            norm_name = cls.normalize_string_value(name.strip())
            norm_val = cls.normalize_string_value(val.strip())
            cookies[norm_name] = norm_val
        return cookies

    @classmethod
    def parse_body(
        cls, raw_body: bytes, content_type: str, max_size_bytes: int
    ) -> tuple[str, dict[str, Any] | list[Any] | None]:
        """Safely decode body bytes and parse structured JSON if applicable."""
        if not raw_body:
            return "", None

        # Clamp body length to avoid memory exhaustion
        clamped_bytes = raw_body[:max_size_bytes]

        try:
            body_text = clamped_bytes.decode("utf-8", errors="replace")
        except Exception:
            body_text = clamped_bytes.decode("latin-1", errors="replace")

        norm_body = cls.normalize_string_value(body_text)

        parsed_json = None
        if "application/json" in content_type.lower():
            try:
                parsed_json = json.loads(norm_body)
            except Exception:
                parsed_json = None

        return norm_body, parsed_json

    @classmethod
    def build_context(
        cls,
        method: str,
        path: str,
        client_ip: str,
        headers: dict[str, str] | None = None,
        query_string: str = "",
        raw_body: bytes = b"",
        request_id: str | None = None,
    ) -> HTTPRequestContext:
        """Assemble a fully normalized and structured HTTPRequestContext."""
        settings = get_settings()
        req_id = request_id or str(uuid.uuid4())
        raw_headers = headers or {}

        # Lowercase header keys and normalize header values
        normalized_headers: dict[str, str] = {}
        for k, v in raw_headers.items():
            normalized_headers[k.lower().strip()] = cls.normalize_string_value(v)

        norm_path = cls.canonicalize_path(path)
        query_dict = cls.parse_query_params(query_string)
        cookie_header = normalized_headers.get("cookie")
        cookies = cls.parse_cookies(cookie_header)

        content_type = normalized_headers.get("content-type", "application/octet-stream")
        user_agent = normalized_headers.get("user-agent", "")

        body_text, parsed_json = cls.parse_body(
            raw_body=raw_body,
            content_type=content_type,
            max_size_bytes=settings.max_body_size_bytes,
        )

        return HTTPRequestContext(
            request_id=req_id,
            client_ip=client_ip,
            method=method.upper().strip(),
            path=path,
            normalized_path=norm_path,
            query_params=query_dict,
            headers=normalized_headers,
            cookies=cookies,
            raw_body=raw_body,
            body_text=body_text,
            parsed_json=parsed_json,
            content_type=content_type,
            user_agent=user_agent,
        )
