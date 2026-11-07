# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-10-09

### Added
- **Core Normalization & Deconstruction**:
  - `RequestNormalizer`: Recursive URL decoding, Unicode NFKC homoglyph collapsing, HTML entity unescaping, RFC 3986 path canonicalization, and safe body size clamping.
- **OWASP CRS-Inspired Signatures**:
  - Modular `RuleRegistry` with compiled regex cache.
  - SQL Injection detection: Union-based, boolean-based, time-based, stacked queries, and comment truncation (CWE-89).
  - Cross-Site Scripting (XSS) detection: Executable tags, inline event handlers, javascript pseudo-protocols, and DOM storage access (CWE-79).
  - Path Traversal & LFI detection: Directory climbing (`../`, `..\`), sensitive OS credential files, and null-byte injection (CWE-22).
  - Command Injection (RCE) detection: Shell separators, Unix binary paths, and Windows interpreters (CWE-78).
  - Server-Side Request Forgery (SSRF) detection: Private IPv4 probing and cloud instance metadata endpoint access (CWE-918).
  - Scanner Fingerprinting: User-Agent detection for automated security tools like sqlmap, nikto, nuclei (CWE-200).
- **Rate Limiting & IP Reputation**:
  - Token bucket algorithm per client IP with burst tolerance.
  - Dynamic `IPJailManager` automatically banning abusive IPs upon repeated security violations.
  - Subnet CIDR allowlisting and permanent blocklisting.
- **Anomaly Scoring & Evaluation Engine**:
  - Paranoia level controls (1 to 4) and threshold aggregation.
  - Dual operational modes: `BLOCK` (active inline prevention) and `MONITOR` (passive detection/IDS mode).
- **Outbound Response Shield**:
  - `ResponseFilter`: Strips technology fingerprinting headers (`Server`, `X-Powered-By`).
  - Stack trace and database error cloaking on HTTP 500 responses.
  - Payment card number detection with Luhn checksum validation and middle-digit masking.
- **Reverse Proxy & ASGI Middleware**:
  - Async reverse proxy forwarder using `httpx.AsyncClient` with connection failure containment.
  - Standalone drop-in ASGI middleware `MiniWAFASGIMiddleware` for FastAPI and Starlette apps.
- **Reporting, CLI & REST API**:
  - Structured JSON and ArcSight CEF audit logging for enterprise SIEM integration.
  - Typer CLI with `test`, `rules`, `unjail`, and `version` subcommands.
  - FastAPI management API with interactive OpenAPI docs at `/docs`.
  - Rootless multi-stage Docker container (`UID 10001:10001`) and docker-compose deployment.
  - Full CI pipeline with GitHub Actions, mypy strict typing, ruff, bandit, and $\ge 90\%$ test coverage.
