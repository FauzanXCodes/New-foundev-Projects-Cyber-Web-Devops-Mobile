# Threat Model: Mini Web Application Firewall (`mini-waf`)

## 1. Scope & Objective

The threat model evaluates the `mini-waf` reverse proxy, ASGI middleware, and management API using the STRIDE methodology.

## 2. STRIDE Assessment Matrix

| Threat Category | Threat Description | Severity | Countermeasure / Mitigation in `mini-waf` |
|:---|:---|:---|:---|
| **Spoofing** | Attacker spoofs `X-Forwarded-For` or client IP to evade rate limits or bypass IP jail. | High | WAF derives client IP directly from socket connection unless behind a cryptographically trusted proxy network. |
| **Tampering** | Adversary crafts obfuscated payloads (Unicode, double encoding, entity escaping) to bypass signature filters. | Critical | Multi-pass normalizer resolves URL percent-encoding recursively, applies Unicode NFKC, and unescapes HTML entities prior to regex evaluation. |
| **Repudiation** | Security incidents occur without audit trail or forensic logging. | Medium | Structured audit logger outputs full event metadata in JSON and ArcSight CEF formats, capturing rule IDs, timestamps, and client IPs. |
| **Information Disclosure** | Backend application exposes database exceptions, stack traces, or customer payment card numbers. | High | `ResponseFilter` cloaks 500 stack traces and applies Luhn checksum validation to detect and mask 13-19 digit card numbers. Strips `Server` and `X-Powered-By` headers. |
| **Denial of Service** | Adversary sends high-velocity HTTP floods or massive body payloads to exhaust memory. | High | Token bucket rate limiter throttles traffic bursts. Body parser clamps payload decoding to 1MB. Dynamic IP jail bans persistent violators. |
| **Elevation of Privilege** | Attacker exploits command injection or SQL injection in protected application. | Critical | Layered CRS-inspired regex signatures score payloads across query, body, and headers, blocking requests when accumulated anomaly score exceeds threshold. |

## 3. Trust Boundaries

1. **Untrusted Internet Client Boundary**:
   - Inbound HTTP transactions from arbitrary public IP addresses.
   - Mitigation: Strict size limits, canonicalization, rate limiting, and signature evaluation.

2. **Protected Upstream Service Boundary**:
   - Local network or loopback interface connecting WAF to protected backend.
   - Mitigation: Forwarding only sanitized, inspected requests. Hop-by-hop headers stripped.

3. **Management REST Control Plane Boundary**:
   - Administrative API listening on port 8083.
   - Mitigation: Running as non-root user (`UID 10001:10001`), read-only container filesystem.
