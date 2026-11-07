"""Tests for the transfer module."""

import pytest
import socket
import threading
import tempfile
from pathlib import Path

from p2p_lan.utils import (
    format_size,
    format_speed,
    format_time,
    hash_file,
    StreamingHasher,
)


class TestFormatSize:
    """Tests for human-readable size formatting."""

    def test_bytes(self):
        assert format_size(0) == "0 B"
        assert format_size(100) == "100 B"
        assert format_size(1023) == "1023 B"

    def test_kilobytes(self):
        assert format_size(1024) == "1.0 KB"
        assert format_size(1536) == "1.5 KB"
        assert format_size(1024 * 100) == "100.0 KB"

    def test_megabytes(self):
        assert format_size(1024 * 1024) == "1.0 MB"
        assert format_size(1024 * 1024 * 4.8) == "4.8 MB"

    def test_gigabytes(self):
        assert format_size(1024 * 1024 * 1024) == "1.00 GB"
        assert format_size(1024 * 1024 * 1024 * 2.5) == "2.50 GB"


class TestFormatSpeed:
    """Tests for speed formatting."""

    def test_bytes_per_second(self):
        assert format_speed(500) == "500 B/s"

    def test_kilobytes_per_second(self):
        assert format_speed(1024 * 850) == "850.0 KB/s"

    def test_megabytes_per_second(self):
        assert format_speed(1024 * 1024 * 12.5) == "12.5 MB/s"


class TestFormatTime:
    """Tests for time duration formatting."""

    def test_negative(self):
        assert format_time(-1) == "--:--"

    def test_seconds(self):
        assert format_time(0) == "0s"
        assert format_time(45) == "45s"
        assert format_time(59) == "59s"

    def test_minutes(self):
        assert format_time(60) == "1:00"
        assert format_time(90) == "1:30"
        assert format_time(123) == "2:03"

    def test_hours(self):
        assert format_time(3600) == "1:00:00"
        assert format_time(3660) == "1:01:00"


class TestHashFile:
    """Tests for file hashing."""

    def test_hash_file(self):
        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(b"Hello, World!")
            f.flush()
            filepath = Path(f.name)

        try:
            result = hash_file(filepath)
            # SHA-256 hash is 64 hex characters
            assert len(result) == 64
            assert all(c in "0123456789abcdef" for c in result)

            # Known hash for "Hello, World!"
            expected = "dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f"
            assert result == expected
        finally:
            filepath.unlink()

    def test_empty_file(self):
        with tempfile.NamedTemporaryFile(delete=False) as f:
            filepath = Path(f.name)

        try:
            result = hash_file(filepath)
            # Known hash for empty file
            expected = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
            assert result == expected
        finally:
            filepath.unlink()


class TestStreamingHasher:
    """Tests for incremental hashing."""

    def test_incremental_matches_full(self):
        data = b"Hello, World!"

        # Full hash
        import hashlib
        expected = hashlib.sha256(data).hexdigest()

        # Incremental hash
        hasher = StreamingHasher()
        hasher.update(b"Hello, ")
        hasher.update(b"World!")
        result = hasher.hexdigest()

        assert result == expected

    def test_verify_correct(self):
        hasher = StreamingHasher()
        hasher.update(b"test data")
        expected = hasher.hexdigest()

        assert hasher.verify(expected) is True

    def test_verify_incorrect(self):
        hasher = StreamingHasher()
        hasher.update(b"test data")

        assert hasher.verify("wrong_hash") is False
