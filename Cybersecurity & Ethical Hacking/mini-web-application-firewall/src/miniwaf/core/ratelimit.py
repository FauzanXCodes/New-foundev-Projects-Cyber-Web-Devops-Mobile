"""Token-bucket rate limiting, dynamic IP jail management, and CIDR reputation."""

import ipaddress
import threading
import time
from enum import StrEnum
from typing import NamedTuple


class IPStatus(StrEnum):
    """Reputation status of a client IP address."""

    ALLOWLISTED = "ALLOWLISTED"
    BLOCKLISTED = "BLOCKLISTED"
    JAILED = "JAILED"
    STANDARD = "STANDARD"


class RateLimitResult(NamedTuple):
    """Result of rate limit check."""

    allowed: bool
    status: IPStatus
    reason: str | None


class TokenBucket:
    """Thread-safe token bucket rate limiter for a single entity."""

    def __init__(self, rate_per_second: float, capacity: float) -> None:
        self.rate = rate_per_second
        self.capacity = capacity
        self.tokens = capacity
        self.last_update = time.monotonic()
        self._lock = threading.Lock()

    def consume(self, tokens: float = 1.0) -> bool:
        """Attempt to consume tokens. Returns True if accepted, False if throttled."""
        with self._lock:
            now = time.monotonic()
            elapsed = now - self.last_update
            self.last_update = now

            # Refill tokens according to elapsed time
            self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)

            if self.tokens >= tokens:
                self.tokens -= tokens
                return True
            return False


class IPJailManager:
    """Tracks security violations and temporarily bans abusive IP addresses."""

    def __init__(
        self,
        violation_threshold: int = 3,
        jail_duration_seconds: int = 300,
        violation_window_seconds: int = 60,
    ) -> None:
        self.threshold = violation_threshold
        self.duration = jail_duration_seconds
        self.window = violation_window_seconds
        self._violations: dict[str, list[float]] = {}
        self._jailed_until: dict[str, float] = {}
        self._lock = threading.Lock()

    def is_jailed(self, ip: str) -> tuple[bool, float]:
        """Check if IP is currently jailed. Returns (is_jailed, remaining_seconds)."""
        with self._lock:
            now = time.monotonic()
            until = self._jailed_until.get(ip)
            if until and now < until:
                return True, until - now
            if until and now >= until:
                del self._jailed_until[ip]
            return False, 0.0

    def record_violation(self, ip: str) -> bool:
        """Record an attack violation. Returns True if the IP was jailed as a result."""
        with self._lock:
            now = time.monotonic()
            # Clean expired timestamps outside sliding window
            timestamps = [ts for ts in self._violations.get(ip, []) if now - ts < self.window]
            timestamps.append(now)
            self._violations[ip] = timestamps

            if len(timestamps) >= self.threshold:
                self._jailed_until[ip] = now + self.duration
                self._violations[ip] = []
                return True
            return False

    def release(self, ip: str) -> None:
        """Manually unjail an IP."""
        with self._lock:
            self._jailed_until.pop(ip, None)
            self._violations.pop(ip, None)

    def jailed_ips(self) -> dict[str, float]:
        """List all currently jailed IPs and remaining ban seconds."""
        with self._lock:
            now = time.monotonic()
            return {
                ip: max(0.0, until - now)
                for ip, until in list(self._jailed_until.items())
                if until > now
            }


class IPReputationManager:
    """Evaluates client IPs against CIDR allowlists and blocklists."""

    def __init__(self) -> None:
        self._allowlist: set[ipaddress.IPv4Network | ipaddress.IPv6Network] = set()
        self._blocklist: set[ipaddress.IPv4Network | ipaddress.IPv6Network] = set()
        self._lock = threading.Lock()

    def add_to_allowlist(self, cidr_or_ip: str) -> None:
        """Add IP or CIDR network to allowlist."""
        with self._lock:
            network = ipaddress.ip_network(cidr_or_ip, strict=False)
            self._allowlist.add(network)

    def add_to_blocklist(self, cidr_or_ip: str) -> None:
        """Add IP or CIDR network to blocklist."""
        with self._lock:
            network = ipaddress.ip_network(cidr_or_ip, strict=False)
            self._blocklist.add(network)

    def remove_from_blocklist(self, cidr_or_ip: str) -> None:
        """Remove IP or CIDR from blocklist."""
        with self._lock:
            network = ipaddress.ip_network(cidr_or_ip, strict=False)
            self._blocklist.discard(network)

    def check(self, ip_str: str) -> IPStatus:
        """Check IP status against allowlist and blocklist."""
        try:
            ip_obj = ipaddress.ip_address(ip_str)
        except ValueError:
            return IPStatus.STANDARD

        with self._lock:
            for net in self._allowlist:
                if ip_obj in net:
                    return IPStatus.ALLOWLISTED
            for net in self._blocklist:
                if ip_obj in net:
                    return IPStatus.BLOCKLISTED
            return IPStatus.STANDARD


class RateLimitEngine:
    """Integrated rate limiting and reputation pipeline."""

    def __init__(
        self,
        requests_per_minute: int = 120,
        burst_capacity: int = 30,
        jail_threshold: int = 3,
        jail_duration_seconds: int = 300,
    ) -> None:
        self.rpm = requests_per_minute
        self.burst = burst_capacity
        self.rate_per_sec = requests_per_minute / 60.0
        self.reputation = IPReputationManager()
        self.jail = IPJailManager(
            violation_threshold=jail_threshold,
            jail_duration_seconds=jail_duration_seconds,
        )
        self._buckets: dict[str, TokenBucket] = {}
        self._lock = threading.Lock()

    def _get_bucket(self, ip: str) -> TokenBucket:
        with self._lock:
            if ip not in self._buckets:
                self._buckets[ip] = TokenBucket(
                    rate_per_second=self.rate_per_sec, capacity=float(self.burst)
                )
            return self._buckets[ip]

    def evaluate(self, client_ip: str) -> RateLimitResult:
        """Inspect client IP against reputation, jail, and rate limits."""
        # 1. Check Allowlist
        rep_status = self.reputation.check(client_ip)
        if rep_status == IPStatus.ALLOWLISTED:
            return RateLimitResult(allowed=True, status=IPStatus.ALLOWLISTED, reason=None)

        # 2. Check Permanent Blocklist
        if rep_status == IPStatus.BLOCKLISTED:
            return RateLimitResult(
                allowed=False,
                status=IPStatus.BLOCKLISTED,
                reason=f"Client IP {client_ip} is permanently blocklisted.",
            )

        # 3. Check Dynamic Jail
        is_jailed, remaining = self.jail.is_jailed(client_ip)
        if is_jailed:
            return RateLimitResult(
                allowed=False,
                status=IPStatus.JAILED,
                reason=(
                    f"Client IP {client_ip} is temporarily jailed for {int(remaining)}s "
                    "due to repeated security violations."
                ),
            )

        # 4. Check Token Bucket Rate Limit
        bucket = self._get_bucket(client_ip)
        if not bucket.consume(1.0):
            return RateLimitResult(
                allowed=False,
                status=IPStatus.STANDARD,
                reason=f"Rate limit exceeded for IP {client_ip} ({self.rpm} req/min).",
            )

        return RateLimitResult(allowed=True, status=IPStatus.STANDARD, reason=None)
