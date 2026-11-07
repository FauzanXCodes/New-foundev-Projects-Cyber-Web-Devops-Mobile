"""Global test fixtures and environment configuration."""

import pytest

from miniwaf.config.settings import WAFSettings


@pytest.fixture
def test_settings() -> WAFSettings:
    """Provide isolated WAF settings for testing."""
    return WAFSettings(
        environment="test",
        debug=True,
        mode="BLOCK",
        anomaly_threshold=5,
        paranoia_level=1,
    )
