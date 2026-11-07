"""Outbound response inspection, header cloaking, and sensitive data leakage shield."""

import re

from miniwaf.config.settings import WAFSettings, get_settings
from miniwaf.models.context import HTTPResponseContext


class ResponseFilter:
    """Sanitizes outgoing HTTP responses from backend servers."""

    _SENSITIVE_HEADERS = {"server", "x-powered-by", "x-aspnet-version", "x-runtime"}

    # Pattern for Visa, Mastercard, Amex, Discover card sequences with optional spaces/hyphens
    _CREDIT_CARD_REGEX = re.compile(r"\b(?:\d[ -]*?){13,19}\b")

    _ERROR_DISCLOSURE_REGEX = re.compile(
        r"(?:Traceback \(most recent call last\)|NullPointerException|"
        r"Fatal error:|SQLSTATE\[|syntax error at or near|"
        r"ORA-\d{5}|Microsoft OLE DB Provider for ODBC Drivers)",
        re.IGNORECASE,
    )

    def __init__(self, settings: WAFSettings | None = None) -> None:
        self.settings = settings or get_settings()

    @classmethod
    def luhn_checksum(cls, card_number_digits: str) -> bool:
        """Validate whether a digit sequence satisfies the ISO/IEC 7812 Luhn checksum."""
        digits = [int(d) for d in card_number_digits if d.isdigit()]
        if len(digits) < 13 or len(digits) > 19:
            return False

        checksum = 0
        reverse_digits = digits[::-1]
        for idx, digit in enumerate(reverse_digits):
            if idx % 2 == 1:
                doubled = digit * 2
                checksum += doubled - 9 if doubled > 9 else doubled
            else:
                checksum += digit
        return checksum % 10 == 0

    @classmethod
    def mask_credit_cards(cls, text: str) -> str:
        """Locate valid credit card numbers and redact middle digits."""

        def _replacer(match: re.Match[str]) -> str:
            raw_match = match.group(0)
            digits_only = "".join(filter(str.isdigit, raw_match))
            if cls.luhn_checksum(digits_only):
                # Preserve first 4 and last 4, mask middle digits
                masked = digits_only[:4] + ("*" * (len(digits_only) - 8)) + digits_only[-4:]
                return masked
            return raw_match

        return cls._CREDIT_CARD_REGEX.sub(_replacer, text)

    def filter_headers(self, headers: dict[str, str]) -> dict[str, str]:
        """Strip technology fingerprinting headers from server response."""
        if not self.settings.strip_server_headers:
            return dict(headers)

        sanitized: dict[str, str] = {}
        for k, v in headers.items():
            if k.lower() not in self._SENSITIVE_HEADERS:
                sanitized[k] = v
        return sanitized

    def filter_body(self, status_code: int, body_bytes: bytes, content_type: str) -> bytes:
        """Sanitize error disclosures and mask sensitive payment details."""
        if not body_bytes:
            return body_bytes

        # Only process text-based responses
        is_text = any(
            t in content_type.lower()
            for t in ("text/", "application/json", "application/xml", "application/javascript")
        )
        if not is_text:
            return body_bytes

        try:
            body_text = body_bytes.decode("utf-8")
        except UnicodeDecodeError:
            return body_bytes

        # Cloak 5xx server exceptions disclosing stack traces
        if status_code >= 500 and self._ERROR_DISCLOSURE_REGEX.search(body_text):
            cloaked = (
                "<!DOCTYPE html><html><head><title>500 Internal Server Error</title></head>"
                "<body><h1>Internal Server Error</h1><p>An unexpected server condition "
                "occurred. The diagnostic details have been suppressed "
                "for security.</p></body></html>"
            )
            return cloaked.encode("utf-8")

        # Mask credit cards if enabled
        if self.settings.mask_credit_cards:
            body_text = self.mask_credit_cards(body_text)

        return body_text.encode("utf-8")

    def inspect_response(self, context: HTTPResponseContext) -> HTTPResponseContext:
        """Execute full response shielding pipeline."""
        if not self.settings.response_inspection_enabled:
            return context

        sanitized_headers = self.filter_headers(context.headers)
        sanitized_body = self.filter_body(
            status_code=context.status_code,
            body_bytes=context.body,
            content_type=context.content_type,
        )

        return HTTPResponseContext(
            status_code=context.status_code,
            headers=sanitized_headers,
            body=sanitized_body,
            content_type=context.content_type,
        )
