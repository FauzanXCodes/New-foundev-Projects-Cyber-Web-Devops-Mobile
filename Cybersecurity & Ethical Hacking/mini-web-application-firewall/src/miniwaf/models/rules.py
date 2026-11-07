"""Models for WAF rules, regex signatures, and rule evaluation matches."""

from pydantic import BaseModel, Field

from miniwaf.models.enums import AttackType, LocationTarget, RuleSeverity


class WAFRule(BaseModel):
    """Definition of an individual security inspection rule."""

    rule_id: str = Field(..., description="Unique alphanumeric identifier (e.g. RULE-SQLI-001)")
    name: str = Field(..., description="Human-readable rule name")
    category: AttackType = Field(..., description="Target attack classification")
    severity: RuleSeverity = Field(..., description="Severity weight contributing to anomaly score")
    paranoia_level: int = Field(default=1, ge=1, le=4, description="Paranoia level threshold (1-4)")
    pattern: str = Field(..., description="Compiled regular expression signature")
    target: LocationTarget = Field(..., description="Primary HTTP segment evaluated by rule")
    cwe_id: str = Field(..., description="Common Weakness Enumeration identifier")
    description: str = Field(..., description="Security explanation and attack context")
    remediation: str = Field(..., description="Guidance to remediate the underlying issue")

    @property
    def score(self) -> int:
        """Return anomaly score points associated with this rule's severity."""
        return self.severity.anomaly_score


class RuleMatch(BaseModel):
    """Record of a rule triggering against a specific HTTP component."""

    rule: WAFRule = Field(..., description="The matched inspection rule")
    target: LocationTarget = Field(..., description="HTTP component where match occurred")
    matched_key: str | None = Field(
        default=None, description="Header name, cookie name, or parameter key if applicable"
    )
    matched_value: str = Field(..., description="Extracted malicious payload value")
    sample_snippet: str = Field(
        ..., description="Truncated or sanitized snippet for logging and audit"
    )
