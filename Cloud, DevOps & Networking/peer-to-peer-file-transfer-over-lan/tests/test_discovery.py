"""Tests for the discovery module."""

import json
import pytest

from p2p_lan.discovery import (
    Announcement,
    get_local_ip,
    PROTOCOL_VERSION,
)


class TestAnnouncement:
    """Tests for Announcement serialization."""

    def test_to_json(self):
        announcement = Announcement(
            version=1,
            name="test.txt",
            size=1024,
            sender_ip="192.168.1.100",
            tcp_port=50000,
            encrypted=False,
            checksum="sha256:abc123",
        )
        data = announcement.to_json()

        # Should be valid JSON
        obj = json.loads(data)
        assert obj["version"] == 1
        assert obj["name"] == "test.txt"
        assert obj["size"] == 1024
        assert obj["sender_ip"] == "192.168.1.100"
        assert obj["tcp_port"] == 50000
        assert obj["encrypted"] is False
        assert obj["checksum"] == "sha256:abc123"

    def test_from_json(self):
        data = json.dumps({
            "version": 1,
            "name": "photo.jpg",
            "size": 5000000,
            "sender_ip": "10.0.0.5",
            "tcp_port": 12345,
            "encrypted": True,
            "checksum": "sha256:xyz789",
        }).encode("utf-8")

        announcement = Announcement.from_json(data)
        assert announcement.version == 1
        assert announcement.name == "photo.jpg"
        assert announcement.size == 5000000
        assert announcement.sender_ip == "10.0.0.5"
        assert announcement.tcp_port == 12345
        assert announcement.encrypted is True
        assert announcement.checksum == "sha256:xyz789"

    def test_roundtrip(self):
        original = Announcement(
            version=PROTOCOL_VERSION,
            name="document.pdf",
            size=999999,
            sender_ip="172.16.0.1",
            tcp_port=8080,
            encrypted=True,
            checksum="sha256:deadbeef",
        )

        data = original.to_json()
        restored = Announcement.from_json(data)

        assert restored.version == original.version
        assert restored.name == original.name
        assert restored.size == original.size
        assert restored.sender_ip == original.sender_ip
        assert restored.tcp_port == original.tcp_port
        assert restored.encrypted == original.encrypted
        assert restored.checksum == original.checksum

    def test_from_json_missing_field_raises(self):
        data = json.dumps({
            "version": 1,
            "name": "test.txt",
            # Missing other fields
        }).encode("utf-8")

        with pytest.raises(KeyError):
            Announcement.from_json(data)

    def test_from_json_invalid_json_raises(self):
        with pytest.raises(json.JSONDecodeError):
            Announcement.from_json(b"not valid json")


class TestGetLocalIp:
    """Tests for get_local_ip function."""

    def test_returns_string(self):
        ip = get_local_ip()
        assert isinstance(ip, str)

    def test_looks_like_ip_address(self):
        ip = get_local_ip()
        # Should have at least one dot
        assert "." in ip
        # Should have 4 octets
        parts = ip.split(".")
        assert len(parts) == 4
        # Each part should be a number 0-255
        for part in parts:
            assert part.isdigit()
            assert 0 <= int(part) <= 255
