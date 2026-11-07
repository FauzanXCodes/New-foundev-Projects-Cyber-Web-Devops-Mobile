"""Unit tests verifying rate limiting, dynamic IP jail, and CIDR reputation."""

import time

from miniwaf.core.ratelimit import (
    IPJailManager,
    IPReputationManager,
    IPStatus,
    RateLimitEngine,
    TokenBucket,
)


def test_token_bucket_consume_and_refill() -> None:
    bucket = TokenBucket(rate_per_second=10.0, capacity=2.0)
    # Initial capacity allows 2 tokens
    assert bucket.consume(1.0) is True
    assert bucket.consume(1.0) is True
    assert bucket.consume(1.0) is False

    # Sleep to refill
    time.sleep(0.12)  # Refills ~1.2 tokens
    assert bucket.consume(1.0) is True


def test_ip_jail_manager_violations_and_release() -> None:
    jail = IPJailManager(violation_threshold=3, jail_duration_seconds=5)
    ip = "198.51.100.22"

    assert jail.is_jailed(ip)[0] is False
    assert jail.record_violation(ip) is False  # 1st violation
    assert jail.record_violation(ip) is False  # 2nd violation
    assert jail.record_violation(ip) is True  # 3rd violation -> jailed!

    is_jailed, remaining = jail.is_jailed(ip)
    assert is_jailed is True
    assert remaining > 0

    jailed_dict = jail.jailed_ips()
    assert ip in jailed_dict

    jail.release(ip)
    assert jail.is_jailed(ip)[0] is False


def test_ip_reputation_manager_cidr() -> None:
    rep = IPReputationManager()
    rep.add_to_allowlist("10.0.0.0/8")
    rep.add_to_blocklist("203.0.113.0/24")

    assert rep.check("10.1.2.3") == IPStatus.ALLOWLISTED
    assert rep.check("203.0.113.55") == IPStatus.BLOCKLISTED
    assert rep.check("8.8.8.8") == IPStatus.STANDARD
    assert rep.check("invalid-ip") == IPStatus.STANDARD

    rep.remove_from_blocklist("203.0.113.0/24")
    assert rep.check("203.0.113.55") == IPStatus.STANDARD


def test_rate_limit_engine_pipeline() -> None:
    engine = RateLimitEngine(
        requests_per_minute=60,
        burst_capacity=3,
        jail_threshold=2,
        jail_duration_seconds=10,
    )
    # Allowlisted bypasses limits
    engine.reputation.add_to_allowlist("127.0.0.1")
    for _ in range(10):
        res = engine.evaluate("127.0.0.1")
        assert res.allowed is True
        assert res.status == IPStatus.ALLOWLISTED

    # Blocklisted is blocked immediately
    engine.reputation.add_to_blocklist("198.51.100.99")
    res_blocked = engine.evaluate("198.51.100.99")
    assert res_blocked.allowed is False
    assert res_blocked.status == IPStatus.BLOCKLISTED

    # Standard client rate limiting
    client = "192.168.1.15"
    assert engine.evaluate(client).allowed is True
    assert engine.evaluate(client).allowed is True
    assert engine.evaluate(client).allowed is True
    # 4th burst request exceeds capacity of 3
    res_exceeded = engine.evaluate(client)
    assert res_exceeded.allowed is False
    assert "Rate limit exceeded" in str(res_exceeded.reason)

    # Trigger jail
    bad_client = "192.168.1.99"
    engine.jail.record_violation(bad_client)
    engine.jail.record_violation(bad_client)
    res_jailed = engine.evaluate(bad_client)
    assert res_jailed.allowed is False
    assert res_jailed.status == IPStatus.JAILED
