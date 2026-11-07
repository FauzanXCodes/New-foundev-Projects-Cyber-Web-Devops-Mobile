"""Comprehensive WAF inspection and anomaly scoring evaluation engine."""

import time
from typing import Any

from miniwaf.config.settings import WAFSettings, get_settings
from miniwaf.core.ratelimit import RateLimitEngine
from miniwaf.models.context import HTTPRequestContext
from miniwaf.models.decision import WAFDecision
from miniwaf.models.enums import AttackType, LocationTarget, RuleSeverity, WAFAction
from miniwaf.models.rules import RuleMatch, WAFRule
from miniwaf.rules import RuleRegistry, create_default_registry


class WAFEngine:
    """Core evaluation engine inspecting HTTP transactions across all registered rules."""

    def __init__(
        self,
        settings: WAFSettings | None = None,
        registry: RuleRegistry | None = None,
        ratelimiter: RateLimitEngine | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.registry = registry or create_default_registry()
        self.ratelimiter = ratelimiter or RateLimitEngine(
            requests_per_minute=self.settings.rate_limit_requests_per_minute,
            burst_capacity=self.settings.rate_limit_burst,
            jail_threshold=self.settings.ip_jail_violation_threshold,
            jail_duration_seconds=self.settings.ip_jail_duration_seconds,
        )

    def _extract_json_values(self, data: Any) -> list[str]:
        """Recursively extract string values from nested parsed JSON."""
        values: list[str] = []
        if isinstance(data, dict):
            for k, v in data.items():
                values.append(str(k))
                values.extend(self._extract_json_values(v))
        elif isinstance(data, list):
            for item in data:
                values.extend(self._extract_json_values(item))
        elif isinstance(data, (str, int, float, bool)):
            values.append(str(data))
        return values

    def _inspect_target_values(
        self,
        target: LocationTarget,
        items: list[tuple[str | None, str]],
        paranoia_level: int,
    ) -> list[RuleMatch]:
        """Evaluate a collection of key-value pairs against rules for a specific target."""
        matches: list[RuleMatch] = []
        active_rules = self.registry.get_rules_for_target(target, max_paranoia_level=paranoia_level)

        for rule, pattern in active_rules:
            for key, val in items:
                if not val:
                    continue
                match = pattern.search(val)
                if match:
                    snippet = val[max(0, match.start() - 20) : min(len(val), match.end() + 20)]
                    matches.append(
                        RuleMatch(
                            rule=rule,
                            target=target,
                            matched_key=key,
                            matched_value=val[:200],
                            sample_snippet=snippet,
                        )
                    )
                    # Once a rule matches a target, prevent duplicate scoring from the same rule
                    break

        return matches

    def inspect_request(self, context: HTTPRequestContext) -> WAFDecision:
        """Execute full multi-tier inspection pipeline on incoming request context."""
        start_time = time.perf_counter()

        # 1. Rate Limiting & IP Reputation Gate
        if self.settings.rate_limit_enabled:
            rate_result = self.ratelimiter.evaluate(context.client_ip)
            if not rate_result.allowed:
                exec_ms = (time.perf_counter() - start_time) * 1000.0
                rate_rule = WAFRule(
                    rule_id="RULE-RATE-001",
                    name="Rate Limit or IP Reputation Violation",
                    category=AttackType.RATE_LIMIT_EXCEEDED,
                    severity=RuleSeverity.CRITICAL,
                    paranoia_level=1,
                    pattern="N/A",
                    target=LocationTarget.HEADER,
                    cwe_id="CWE-770",
                    description=rate_result.reason or "Rate limit exceeded",
                    remediation="Reduce request velocity or contact system administrator.",
                )
                match = RuleMatch(
                    rule=rate_rule,
                    target=LocationTarget.HEADER,
                    matched_key="client_ip",
                    matched_value=context.client_ip,
                    sample_snippet=context.client_ip,
                )
                return WAFDecision(
                    request_id=context.request_id,
                    action=WAFAction.BLOCK,
                    total_score=self.settings.anomaly_threshold,
                    threshold=self.settings.anomaly_threshold,
                    is_blocked=True,
                    blocked_reason=rate_result.reason,
                    matches=[match],
                    client_ip=context.client_ip,
                    execution_time_ms=round(exec_ms, 3),
                )

        matches: list[RuleMatch] = []
        pl = self.settings.paranoia_level

        # 2. Inspect URI Path
        path_items: list[tuple[str | None, str]] = [
            ("path", context.path),
            ("normalized_path", context.normalized_path),
        ]
        matches.extend(self._inspect_target_values(LocationTarget.URI_PATH, path_items, pl))

        # 3. Inspect Query Parameters
        query_items: list[tuple[str | None, str]] = []
        for q_key, q_vals in context.query_params.items():
            query_items.append((q_key, q_key))
            for v in q_vals:
                query_items.append((q_key, v))
        matches.extend(self._inspect_target_values(LocationTarget.QUERY_PARAM, query_items, pl))

        # 4. Inspect User-Agent
        if context.user_agent:
            ua_items: list[tuple[str | None, str]] = [("user-agent", context.user_agent)]
            matches.extend(self._inspect_target_values(LocationTarget.USER_AGENT, ua_items, pl))

        # 5. Inspect Headers
        header_items: list[tuple[str | None, str]] = [
            (h_name, h_val) for h_name, h_val in context.headers.items()
        ]
        matches.extend(self._inspect_target_values(LocationTarget.HEADER, header_items, pl))

        # 6. Inspect Cookies
        cookie_items: list[tuple[str | None, str]] = [
            (c_name, c_val) for c_name, c_val in context.cookies.items()
        ]
        matches.extend(self._inspect_target_values(LocationTarget.COOKIE, cookie_items, pl))

        # 7. Inspect Request Body
        body_items: list[tuple[str | None, str]] = []
        if context.body_text:
            body_items.append(("body_raw", context.body_text))
        if context.parsed_json is not None:
            for json_val in self._extract_json_values(context.parsed_json):
                body_items.append(("json_value", json_val))
        matches.extend(self._inspect_target_values(LocationTarget.BODY, body_items, pl))

        # 8. Calculate Aggregated Anomaly Score
        total_score = sum(m.rule.score for m in matches)
        threshold = self.settings.anomaly_threshold
        is_violating = total_score >= threshold

        blocked_reason = None
        if is_violating:
            categories = {m.rule.category.value for m in matches}
            blocked_reason = (
                f"Anomaly score {total_score} meets or exceeds threshold {threshold}. "
                f"Detected threats: {', '.join(sorted(categories))}."
            )

            # Record security violation for IP Jail
            if self.settings.ip_jail_enabled:
                self.ratelimiter.jail.record_violation(context.client_ip)

        # 9. Determine Action
        if is_violating:
            action = WAFAction.BLOCK if self.settings.mode == "BLOCK" else WAFAction.MONITOR
            is_blocked = self.settings.mode == "BLOCK"
        else:
            action = WAFAction.ALLOW
            is_blocked = False

        exec_ms = (time.perf_counter() - start_time) * 1000.0

        return WAFDecision(
            request_id=context.request_id,
            action=action,
            total_score=total_score,
            threshold=threshold,
            is_blocked=is_blocked,
            blocked_reason=blocked_reason,
            matches=matches,
            client_ip=context.client_ip,
            execution_time_ms=round(exec_ms, 3),
        )
