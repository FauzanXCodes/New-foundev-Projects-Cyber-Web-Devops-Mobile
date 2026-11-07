"""Rule registry and compiled regular expression cache."""

import re
from collections.abc import Sequence

from miniwaf.models.enums import LocationTarget
from miniwaf.models.rules import WAFRule


class RuleRegistry:
    """Manages active WAF inspection rules and compiled regexes."""

    def __init__(self) -> None:
        self._rules: dict[str, WAFRule] = {}
        self._compiled_regexes: dict[str, re.Pattern[str]] = {}

    def register(self, rule: WAFRule) -> None:
        """Register a new WAFRule and compile its pattern."""
        self._rules[rule.rule_id] = rule
        self._compiled_regexes[rule.rule_id] = re.compile(rule.pattern, re.IGNORECASE)

    def register_many(self, rules: Sequence[WAFRule]) -> None:
        """Register multiple WAFRules."""
        for rule in rules:
            self.register(rule)

    def get_rule(self, rule_id: str) -> WAFRule | None:
        """Retrieve a rule by unique identifier."""
        return self._rules.get(rule_id)

    def get_pattern(self, rule_id: str) -> re.Pattern[str] | None:
        """Retrieve compiled pattern for a rule."""
        return self._compiled_regexes.get(rule_id)

    def all_rules(self) -> list[WAFRule]:
        """Return all registered rules."""
        return list(self._rules.values())

    def get_rules_for_target(
        self, target: LocationTarget, max_paranoia_level: int = 1
    ) -> list[tuple[WAFRule, re.Pattern[str]]]:
        """Fetch active rules and patterns matching target within paranoia level."""
        active: list[tuple[WAFRule, re.Pattern[str]]] = []
        for rule_id, rule in self._rules.items():
            if (
                rule.target in (target, LocationTarget.ANY)
                and rule.paranoia_level <= max_paranoia_level
            ):
                pat = self._compiled_regexes.get(rule_id)
                if pat:
                    active.append((rule, pat))
        return active

    def clear(self) -> None:
        """Clear all registered rules."""
        self._rules.clear()
        self._compiled_regexes.clear()
