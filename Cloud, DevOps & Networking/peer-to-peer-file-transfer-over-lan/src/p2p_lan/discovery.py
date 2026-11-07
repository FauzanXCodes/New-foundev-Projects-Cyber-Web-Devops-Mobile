"""UDP broadcast discovery for p2p-lan.

This module handles:
- Broadcasting file availability (sender side)
- Listening for broadcasts and discovering senders (receiver side)
"""

from __future__ import annotations

import json
import logging
import socket
import threading
import time
from dataclasses import dataclass
from typing import Callable

logger = logging.getLogger(__name__)

# Constants
BROADCAST_PORT = 9999
BROADCAST_ADDR = "<broadcast>"
BROADCAST_INTERVAL = 1.0  # seconds
PROTOCOL_VERSION = 1


@dataclass
class Announcement:
    """A file transfer announcement from a sender."""
    version: int
    name: str
    size: int
    sender_ip: str
    tcp_port: int
    encrypted: bool
    checksum: str

    def to_json(self) -> bytes:
        """Serialize to JSON bytes for transmission."""
        return json.dumps({
            "version": self.version,
            "name": self.name,
            "size": self.size,
            "sender_ip": self.sender_ip,
            "tcp_port": self.tcp_port,
            "encrypted": self.encrypted,
            "checksum": self.checksum,
        }).encode("utf-8")

    @classmethod
    def from_json(cls, data: bytes) -> Announcement:
        """Deserialize from JSON bytes."""
        obj = json.loads(data.decode("utf-8"))
        return cls(
            version=obj["version"],
            name=obj["name"],
            size=obj["size"],
            sender_ip=obj["sender_ip"],
            tcp_port=obj["tcp_port"],
            encrypted=obj["encrypted"],
            checksum=obj["checksum"],
        )


def get_local_ip() -> str:
    """Get the local IP address of this machine.

    Uses a UDP socket trick: connecting to an external address
    (without actually sending data) reveals the local IP.
    """
    try:
        # We don't actually connect, just use the socket to find our IP
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            # Connect to a public DNS server (doesn't send anything)
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except OSError:
        # Fallback to localhost if no network
        return "127.0.0.1"


class Broadcaster:
    """Broadcasts file availability via UDP.

    Sends announcement packets every BROADCAST_INTERVAL seconds
    until stop() is called.
    """

    def __init__(
        self,
        filename: str,
        filesize: int,
        tcp_port: int,
        encrypted: bool = False,
        checksum: str = "",
    ):
        self.announcement = Announcement(
            version=PROTOCOL_VERSION,
            name=filename,
            size=filesize,
            sender_ip=get_local_ip(),
            tcp_port=tcp_port,
            encrypted=encrypted,
            checksum=checksum,
        )
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        """Start broadcasting in a background thread."""
        self._thread = threading.Thread(target=self._broadcast_loop, daemon=True)
        self._thread.start()
        logger.debug(f"Broadcaster started on port {BROADCAST_PORT}")

    def stop(self) -> None:
        """Stop the broadcast loop."""
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=2.0)
        logger.debug("Broadcaster stopped")

    def _broadcast_loop(self) -> None:
        """Main broadcast loop."""
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
                # Enable broadcasting
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)

                message = self.announcement.to_json()

                while not self._stop_event.is_set():
                    try:
                        sock.sendto(message, (BROADCAST_ADDR, BROADCAST_PORT))
                        logger.debug(f"Broadcast sent: {self.announcement.name}")
                    except OSError as e:
                        logger.warning(f"Broadcast failed: {e}")

                    # Wait for interval or stop signal
                    self._stop_event.wait(BROADCAST_INTERVAL)

        except Exception as e:
            logger.error(f"Broadcaster error: {e}")


class Listener:
    """Listens for UDP broadcast announcements.

    Deduplicates announcements by sender_ip + filename.
    Calls the callback function when a new sender is discovered.
    """

    def __init__(self, on_discovery: Callable[[Announcement], None] | None = None):
        self.on_discovery = on_discovery
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None
        self._discovered: dict[str, Announcement] = {}  # key: "ip:filename"
        self._lock = threading.Lock()

    def start(self) -> None:
        """Start listening in a background thread."""
        self._thread = threading.Thread(target=self._listen_loop, daemon=True)
        self._thread.start()
        logger.debug(f"Listener started on port {BROADCAST_PORT}")

    def stop(self) -> None:
        """Stop the listen loop."""
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=2.0)
        logger.debug("Listener stopped")

    def get_discovered(self) -> list[Announcement]:
        """Get all discovered senders."""
        with self._lock:
            return list(self._discovered.values())

    def clear_discovered(self) -> None:
        """Clear the discovered senders list."""
        with self._lock:
            self._discovered.clear()

    def wait_for_announcement(self, timeout: float = 30.0) -> Announcement | None:
        """Block until an announcement is received or timeout.

        Returns the first announcement received, or None on timeout.
        """
        start_time = time.time()

        while time.time() - start_time < timeout:
            with self._lock:
                if self._discovered:
                    # Return the first discovered sender
                    return next(iter(self._discovered.values()))
            time.sleep(0.1)

        return None

    def _listen_loop(self) -> None:
        """Main listen loop."""
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
                # Allow multiple listeners on same port
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

                # Also set SO_REUSEPORT if available (macOS/Linux)
                if hasattr(socket, 'SO_REUSEPORT'):
                    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEPORT, 1)

                sock.bind(("", BROADCAST_PORT))
                sock.settimeout(0.5)  # Allow checking stop event

                while not self._stop_event.is_set():
                    try:
                        data, addr = sock.recvfrom(4096)
                        self._handle_announcement(data, addr)
                    except socket.timeout:
                        continue
                    except OSError as e:
                        if not self._stop_event.is_set():
                            logger.warning(f"Receive error: {e}")

        except Exception as e:
            logger.error(f"Listener error: {e}")

    def _handle_announcement(self, data: bytes, addr: tuple[str, int]) -> None:
        """Handle a received announcement."""
        try:
            announcement = Announcement.from_json(data)

            # Validate version
            if announcement.version != PROTOCOL_VERSION:
                logger.warning(f"Ignoring announcement with version {announcement.version}")
                return

            # Create dedup key
            key = f"{announcement.sender_ip}:{announcement.name}"

            with self._lock:
                is_new = key not in self._discovered
                self._discovered[key] = announcement

            if is_new:
                logger.debug(f"Discovered: {announcement.name} from {announcement.sender_ip}")
                if self.on_discovery:
                    self.on_discovery(announcement)

        except (json.JSONDecodeError, KeyError) as e:
            logger.debug(f"Invalid announcement from {addr}: {e}")
