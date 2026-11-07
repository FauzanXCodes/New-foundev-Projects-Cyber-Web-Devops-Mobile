"""Utility functions for p2p-lan.

This module provides:
- Progress bar display
- File hashing (SHA-256)
- Human-readable size formatting
"""

from __future__ import annotations

import hashlib
import sys
import time
from pathlib import Path


def format_size(size_bytes: int) -> str:
    """Format a byte count as a human-readable string.

    Args:
        size_bytes: Size in bytes.

    Returns:
        Formatted string like "4.8 MB" or "128 KB".
    """
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"


def format_speed(bytes_per_second: float) -> str:
    """Format a transfer speed as a human-readable string.

    Args:
        bytes_per_second: Speed in bytes per second.

    Returns:
        Formatted string like "12.5 MB/s" or "850 KB/s".
    """
    if bytes_per_second < 1024:
        return f"{bytes_per_second:.0f} B/s"
    elif bytes_per_second < 1024 * 1024:
        return f"{bytes_per_second / 1024:.1f} KB/s"
    else:
        return f"{bytes_per_second / (1024 * 1024):.1f} MB/s"


def format_time(seconds: float) -> str:
    """Format a time duration as a human-readable string.

    Args:
        seconds: Duration in seconds.

    Returns:
        Formatted string like "1:23" or "45s".
    """
    if seconds < 0:
        return "--:--"
    elif seconds < 60:
        return f"{int(seconds)}s"
    elif seconds < 3600:
        mins = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{mins}:{secs:02d}"
    else:
        hours = int(seconds // 3600)
        mins = int((seconds % 3600) // 60)
        return f"{hours}:{mins:02d}:00"


class ProgressBar:
    """A terminal progress bar for file transfers.

    Displays: filename, progress bar, percentage, transferred/total,
    speed, and ETA.
    """

    def __init__(
        self,
        filename: str,
        total_bytes: int,
        bar_width: int = 30,
    ):
        self.filename = filename
        self.total_bytes = total_bytes
        self.bar_width = bar_width
        self.transferred = 0
        self.start_time = time.time()
        self.last_update = 0.0

    def update(self, bytes_transferred: int) -> None:
        """Update progress with additional bytes transferred.

        Args:
            bytes_transferred: Number of new bytes transferred.
        """
        self.transferred += bytes_transferred
        self._render()

    def set_progress(self, total_transferred: int) -> None:
        """Set the absolute progress.

        Args:
            total_transferred: Total bytes transferred so far.
        """
        self.transferred = total_transferred
        self._render()

    def _render(self) -> None:
        """Render the progress bar to the terminal."""
        # Rate limit updates to avoid flickering
        now = time.time()
        if now - self.last_update < 0.1 and self.transferred < self.total_bytes:
            return
        self.last_update = now

        # Calculate progress
        if self.total_bytes > 0:
            fraction = min(1.0, self.transferred / self.total_bytes)
        else:
            fraction = 1.0

        percent = int(fraction * 100)

        # Calculate speed and ETA
        elapsed = now - self.start_time
        if elapsed > 0:
            speed = self.transferred / elapsed
            if speed > 0 and self.transferred < self.total_bytes:
                remaining_bytes = self.total_bytes - self.transferred
                eta = remaining_bytes / speed
            else:
                eta = 0
        else:
            speed = 0
            eta = -1

        # Build the bar
        filled = int(self.bar_width * fraction)
        bar = "█" * filled + "░" * (self.bar_width - filled)

        # Format the line
        line = (
            f"\r{self.filename[:20]:20} "
            f"[{bar}] "
            f"{percent:3d}% "
            f"{format_size(self.transferred):>9}/{format_size(self.total_bytes):<9} "
            f"{format_speed(speed):>10} "
            f"ETA {format_time(eta)}"
            f"\033[K"  # Clear to end of line
        )

        sys.stdout.write(line)
        sys.stdout.flush()

    def finish(self) -> None:
        """Complete the progress bar and move to a new line."""
        self.transferred = self.total_bytes
        self._render()
        print()  # Newline

        elapsed = time.time() - self.start_time
        avg_speed = self.total_bytes / elapsed if elapsed > 0 else 0
        print(f"Completed in {format_time(elapsed)} (avg {format_speed(avg_speed)})")


def hash_file(filepath: Path, algorithm: str = "sha256") -> str:
    """Calculate the hash of a file.

    Args:
        filepath: Path to the file.
        algorithm: Hash algorithm to use (default: sha256).

    Returns:
        Hex-encoded hash string.
    """
    hasher = hashlib.new(algorithm)
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):  # 64KB chunks
            hasher.update(chunk)
    return hasher.hexdigest()


class StreamingHasher:
    """A hasher that can be updated incrementally during transfer."""

    def __init__(self, algorithm: str = "sha256"):
        self.hasher = hashlib.new(algorithm)

    def update(self, data: bytes) -> None:
        """Add data to the hash."""
        self.hasher.update(data)

    def hexdigest(self) -> str:
        """Get the current hash as a hex string."""
        return self.hasher.hexdigest()

    def verify(self, expected: str) -> bool:
        """Verify the hash matches expected value."""
        return self.hexdigest() == expected
