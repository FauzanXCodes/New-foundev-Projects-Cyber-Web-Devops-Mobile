"""Protocol definitions for p2p-lan.

This module defines the wire format for messages:
- HEADER: JSON object with file metadata (newline-delimited)
- CHUNK: Raw file data (64KB blocks)
- CHECKSUM: SHA-256 hash for verification (newline-delimited)
- ACK: Acknowledgment message (newline-delimited)

Wire format (unencrypted):
    1. HEADER: JSON + '\n'
    2. DATA: raw bytes (exactly filesize bytes)
    3. CHECKSUM: "sha256:<hex>\n"
    4. ACK: "ACK\n"
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

# Constants
CHUNK_SIZE = 65536  # 64KB
PROTOCOL_VERSION = 1


@dataclass
class FileHeader:
    """File transfer header containing metadata."""
    version: int
    filename: str
    filesize: int
    encrypted: bool

    def to_bytes(self) -> bytes:
        """Serialize header to bytes (JSON + newline)."""
        return json.dumps({
            "version": self.version,
            "filename": self.filename,
            "filesize": self.filesize,
            "encrypted": self.encrypted,
        }).encode("utf-8") + b"\n"

    @classmethod
    def from_bytes(cls, data: bytes) -> FileHeader:
        """Deserialize header from bytes."""
        # Strip newline if present
        if data.endswith(b"\n"):
            data = data[:-1]
        obj = json.loads(data.decode("utf-8"))
        return cls(
            version=obj["version"],
            filename=obj["filename"],
            filesize=obj["filesize"],
            encrypted=obj["encrypted"],
        )


def make_checksum_message(checksum: str) -> bytes:
    """Create a checksum message."""
    return f"sha256:{checksum}\n".encode("utf-8")


def parse_checksum_message(data: bytes) -> str:
    """Parse a checksum message and return the hash.

    Args:
        data: Raw message bytes.

    Returns:
        The hex-encoded hash string.

    Raises:
        ValueError: If the message format is invalid.
    """
    text = data.decode("utf-8").strip()
    if not text.startswith("sha256:"):
        raise ValueError(f"Invalid checksum format: {text}")
    return text[7:]  # Remove "sha256:" prefix


def make_ack_message() -> bytes:
    """Create an acknowledgment message."""
    return b"ACK\n"


def is_ack_message(data: bytes) -> bool:
    """Check if data is an ACK message."""
    return data.strip() == b"ACK"


def recv_until_newline(sock, max_size: int = 4096) -> bytes:
    """Receive data from socket until newline is found.

    Args:
        sock: Socket to receive from.
        max_size: Maximum bytes to receive.

    Returns:
        Received data including the newline.

    Raises:
        ValueError: If max_size exceeded without finding newline.
    """
    data = b""
    while len(data) < max_size:
        chunk = sock.recv(1)
        if not chunk:
            break
        data += chunk
        if chunk == b"\n":
            break
    return data


def recv_exactly(sock, size: int) -> bytes:
    """Receive exactly `size` bytes from socket.

    Args:
        sock: Socket to receive from.
        size: Exact number of bytes to receive.

    Returns:
        Received data.

    Raises:
        ConnectionError: If connection closed before all bytes received.
    """
    data = b""
    while len(data) < size:
        remaining = size - len(data)
        chunk = sock.recv(min(remaining, CHUNK_SIZE))
        if not chunk:
            raise ConnectionError(
                f"Connection closed after {len(data)}/{size} bytes"
            )
        data += chunk
    return data


def get_unique_filepath(directory: Path, filename: str) -> Path:
    """Get a unique filepath, adding (1), (2), etc. if file exists.

    Args:
        directory: Directory to save file in.
        filename: Desired filename.

    Returns:
        Path that doesn't exist yet.
    """
    filepath = directory / filename
    if not filepath.exists():
        return filepath

    # Split name and extension
    stem = filepath.stem
    suffix = filepath.suffix
    counter = 1

    while True:
        new_name = f"{stem}({counter}){suffix}"
        new_path = directory / new_name
        if not new_path.exists():
            return new_path
        counter += 1
