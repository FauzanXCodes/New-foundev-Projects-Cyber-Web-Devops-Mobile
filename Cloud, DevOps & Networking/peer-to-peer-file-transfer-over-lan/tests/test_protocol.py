"""Tests for the protocol module."""

import pytest
from pathlib import Path
import tempfile

from p2p_lan.protocol import (
    CHUNK_SIZE,
    PROTOCOL_VERSION,
    FileHeader,
    make_checksum_message,
    parse_checksum_message,
    make_ack_message,
    is_ack_message,
    get_unique_filepath,
)


class TestFileHeader:
    """Tests for FileHeader serialization."""

    def test_to_bytes_includes_newline(self):
        header = FileHeader(
            version=1,
            filename="test.txt",
            filesize=1024,
            encrypted=False,
        )
        data = header.to_bytes()
        assert data.endswith(b"\n")

    def test_roundtrip(self):
        original = FileHeader(
            version=1,
            filename="my_file.pdf",
            filesize=12345678,
            encrypted=True,
        )
        data = original.to_bytes()
        restored = FileHeader.from_bytes(data)

        assert restored.version == original.version
        assert restored.filename == original.filename
        assert restored.filesize == original.filesize
        assert restored.encrypted == original.encrypted

    def test_special_characters_in_filename(self):
        header = FileHeader(
            version=1,
            filename="file with spaces & special (chars).txt",
            filesize=100,
            encrypted=False,
        )
        data = header.to_bytes()
        restored = FileHeader.from_bytes(data)
        assert restored.filename == header.filename

    def test_empty_filename(self):
        header = FileHeader(
            version=1,
            filename="",
            filesize=0,
            encrypted=False,
        )
        data = header.to_bytes()
        restored = FileHeader.from_bytes(data)
        assert restored.filename == ""
        assert restored.filesize == 0


class TestChecksumMessage:
    """Tests for checksum message format."""

    def test_make_checksum_message(self):
        checksum = "abc123def456"
        msg = make_checksum_message(checksum)
        assert msg == b"sha256:abc123def456\n"

    def test_parse_checksum_message(self):
        msg = b"sha256:abc123def456\n"
        checksum = parse_checksum_message(msg)
        assert checksum == "abc123def456"

    def test_parse_checksum_without_newline(self):
        msg = b"sha256:abc123"
        checksum = parse_checksum_message(msg)
        assert checksum == "abc123"

    def test_parse_invalid_format_raises(self):
        with pytest.raises(ValueError):
            parse_checksum_message(b"md5:abc123")


class TestAckMessage:
    """Tests for ACK message format."""

    def test_make_ack_message(self):
        msg = make_ack_message()
        assert msg == b"ACK\n"

    def test_is_ack_message_true(self):
        assert is_ack_message(b"ACK\n") is True
        assert is_ack_message(b"ACK") is True
        assert is_ack_message(b"  ACK  ") is True

    def test_is_ack_message_false(self):
        assert is_ack_message(b"NACK") is False
        assert is_ack_message(b"") is False
        assert is_ack_message(b"ack") is False  # Case sensitive


class TestGetUniqueFilepath:
    """Tests for filename conflict resolution."""

    def test_no_conflict(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = get_unique_filepath(Path(tmpdir), "test.txt")
            assert path.name == "test.txt"

    def test_single_conflict(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create existing file
            (Path(tmpdir) / "test.txt").touch()

            path = get_unique_filepath(Path(tmpdir), "test.txt")
            assert path.name == "test(1).txt"

    def test_multiple_conflicts(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create existing files
            (Path(tmpdir) / "test.txt").touch()
            (Path(tmpdir) / "test(1).txt").touch()
            (Path(tmpdir) / "test(2).txt").touch()

            path = get_unique_filepath(Path(tmpdir), "test.txt")
            assert path.name == "test(3).txt"

    def test_preserves_extension(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            (Path(tmpdir) / "image.png").touch()

            path = get_unique_filepath(Path(tmpdir), "image.png")
            assert path.name == "image(1).png"
            assert path.suffix == ".png"
