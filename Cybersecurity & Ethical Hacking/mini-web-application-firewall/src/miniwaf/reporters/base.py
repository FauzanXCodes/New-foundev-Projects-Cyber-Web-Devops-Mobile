"""Abstract base class for security audit loggers."""

from abc import ABC, abstractmethod

from miniwaf.models.decision import SecurityEvent, WAFDecision


class BaseAuditLogger(ABC):
    """Base interface for security event auditing."""

    @abstractmethod
    def log_decision(self, decision: WAFDecision, method: str, path: str) -> SecurityEvent:
        """Record and format a WAF mitigation decision."""
