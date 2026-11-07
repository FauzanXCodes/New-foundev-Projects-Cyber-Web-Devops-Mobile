"""Unit tests verifying foundation settings and package metadata."""

from miniwaf import __version__
from miniwaf.config.settings import WAFSettings, get_settings


def test_package_version() -> None:
    assert __version__ == "0.1.0"


def test_default_settings() -> None:
    settings = get_settings()
    assert settings.app_name == "Mini Web Application Firewall"
    assert settings.mode in ("BLOCK", "MONITOR")
    assert settings.anomaly_threshold == 5
    assert settings.paranoia_level == 1
    assert settings.max_body_size_bytes == 1_048_576


def test_custom_settings_instantiation() -> None:
    custom = WAFSettings(
        mode="MONITOR",
        anomaly_threshold=10,
        paranoia_level=2,
    )
    assert custom.mode == "MONITOR"
    assert custom.anomaly_threshold == 10
    assert custom.paranoia_level == 2
