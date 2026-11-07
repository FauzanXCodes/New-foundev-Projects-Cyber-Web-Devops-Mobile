"""TCP file transfer for p2p-lan.

This module handles:
- Sending files over TCP (sender side)
- Receiving files over TCP (receiver side)
- Optional encryption via X25519 + AES-256-GCM
"""

from __future__ import annotations

import logging
import socket
import struct
from pathlib import Path

from p2p_lan.discovery import Broadcaster, Listener, Announcement
from p2p_lan.protocol import (
    CHUNK_SIZE,
    PROTOCOL_VERSION,
    FileHeader,
    make_checksum_message,
    parse_checksum_message,
    make_ack_message,
    is_ack_message,
    recv_until_newline,
    recv_exactly,
    get_unique_filepath,
)
from p2p_lan.utils import (
    ProgressBar,
    StreamingHasher,
    hash_file,
    format_size,
)

logger = logging.getLogger(__name__)


class FileSender:
    """Sends a file over TCP with UDP discovery broadcast."""

    def __init__(
        self,
        filepath: Path,
        encrypt: bool = False,
        port: int = 0,
    ):
        self.filepath = filepath
        self.encrypt = encrypt
        self.port = port
        self.filesize = filepath.stat().st_size
        self.filename = filepath.name

        # Validate encryption availability
        if self.encrypt:
            from p2p_lan.crypto import require_crypto
            require_crypto()

    def start(self) -> None:
        """Start the file transfer process.

        1. Calculate file checksum
        2. Start TCP server
        3. Broadcast availability
        4. Wait for connection
        5. Transfer file
        """
        print(f"Calculating checksum for {self.filename}...")
        checksum = hash_file(self.filepath)
        print(f"Checksum: sha256:{checksum[:16]}...")

        # Create TCP server socket
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server_sock:
            server_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            server_sock.bind(("", self.port))
            server_sock.listen(1)

            # Get the actual port (if we used 0)
            actual_port = server_sock.getsockname()[1]
            print(f"Listening on port {actual_port}")

            # Start broadcasting
            broadcaster = Broadcaster(
                filename=self.filename,
                filesize=self.filesize,
                tcp_port=actual_port,
                encrypted=self.encrypt,
                checksum=f"sha256:{checksum}",
            )
            broadcaster.start()

            try:
                print("Waiting for receiver to connect...")
                server_sock.settimeout(300)  # 5 minute timeout
                conn, addr = server_sock.accept()
            except socket.timeout:
                print("Timeout waiting for connection.")
                return
            finally:
                broadcaster.stop()

            print(f"Connected to {addr[0]}:{addr[1]}")

            with conn:
                self._send_file(conn, checksum)

    def _send_file(self, conn: socket.socket, checksum: str) -> None:
        """Send the file over an established connection."""
        encryptor = None

        # Perform key exchange if encrypted
        if self.encrypt:
            from p2p_lan.crypto import (
                perform_key_exchange_sender,
                Encryptor,
                get_key_fingerprint,
            )
            print("Performing key exchange...")
            shared_key = perform_key_exchange_sender(conn)
            fingerprint = get_key_fingerprint(shared_key)
            print(f"Key fingerprint: {fingerprint}")
            print("(Compare this with receiver to verify secure connection)")
            encryptor = Encryptor(shared_key)

        # Send header
        header = FileHeader(
            version=PROTOCOL_VERSION,
            filename=self.filename,
            filesize=self.filesize,
            encrypted=self.encrypt,
        )
        conn.sendall(header.to_bytes())
        logger.debug(f"Sent header: {header}")

        # Send file data
        progress = ProgressBar(self.filename, self.filesize)

        with open(self.filepath, "rb") as f:
            sent = 0
            while sent < self.filesize:
                chunk = f.read(CHUNK_SIZE)
                if not chunk:
                    break

                if encryptor:
                    # Encrypt and send with length prefix
                    encrypted_chunk = encryptor.encrypt_chunk(chunk)
                    conn.sendall(encrypted_chunk)
                else:
                    conn.sendall(chunk)

                sent += len(chunk)
                progress.update(len(chunk))

        progress.finish()

        # Send checksum
        conn.sendall(make_checksum_message(checksum))
        logger.debug("Sent checksum")

        # Wait for ACK
        ack = recv_until_newline(conn)
        if is_ack_message(ack):
            print("Transfer confirmed by receiver.")
        else:
            print(f"Warning: Unexpected response: {ack}")


class FileReceiver:
    """Receives files over TCP with UDP discovery listening."""

    def __init__(
        self,
        save_dir: Path,
        accept_all: bool = False,
    ):
        self.save_dir = save_dir
        self.accept_all = accept_all

    def start(self) -> None:
        """Start listening for file transfers.

        1. Listen for UDP broadcasts
        2. Display discovered senders
        3. Prompt user to accept
        4. Connect and receive file
        """
        listener = Listener(on_discovery=self._on_discovery)
        listener.start()

        try:
            print("Waiting for senders...")
            announcement = listener.wait_for_announcement(timeout=30.0)

            if not announcement:
                print("No senders found. Timeout.")
                return

            # Prompt for acceptance
            if not self._prompt_accept(announcement):
                print("Transfer declined.")
                return

            # Connect and receive
            self._receive_from(announcement)

        finally:
            listener.stop()

    def _on_discovery(self, announcement: Announcement) -> None:
        """Called when a new sender is discovered."""
        print(f"\nDiscovered: {announcement.name} ({format_size(announcement.size)})")
        print(f"  From: {announcement.sender_ip}:{announcement.tcp_port}")
        print(f"  Encrypted: {'Yes' if announcement.encrypted else 'No'}")

    def _prompt_accept(self, announcement: Announcement) -> bool:
        """Prompt user to accept or decline the transfer."""
        if self.accept_all:
            print("Auto-accepting transfer...")
            return True

        while True:
            try:
                response = input("\nAccept this transfer? [y/n]: ").strip().lower()
                if response in ("y", "yes"):
                    return True
                elif response in ("n", "no"):
                    return False
                else:
                    print("Please enter 'y' or 'n'.")
            except EOFError:
                return False

    def _receive_from(self, announcement: Announcement) -> None:
        """Connect to sender and receive the file."""
        print(f"\nConnecting to {announcement.sender_ip}:{announcement.tcp_port}...")

        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.connect((announcement.sender_ip, announcement.tcp_port))
            print("Connected!")

            self._receive_file(sock, announcement)

    def _receive_file(self, sock: socket.socket, announcement: Announcement) -> None:
        """Receive a file over an established connection."""
        decryptor = None

        # Perform key exchange if encrypted
        if announcement.encrypted:
            from p2p_lan.crypto import (
                perform_key_exchange_receiver,
                Decryptor,
                get_key_fingerprint,
            )
            print("Performing key exchange...")
            shared_key = perform_key_exchange_receiver(sock)
            fingerprint = get_key_fingerprint(shared_key)
            print(f"Key fingerprint: {fingerprint}")
            print("(Compare this with sender to verify secure connection)")
            decryptor = Decryptor(shared_key)

        # Receive header
        header_data = recv_until_newline(sock)
        header = FileHeader.from_bytes(header_data)
        logger.debug(f"Received header: {header}")

        # Validate header
        if header.version != PROTOCOL_VERSION:
            print(f"Warning: Protocol version mismatch (got {header.version})")

        # Determine output path
        output_path = get_unique_filepath(self.save_dir, header.filename)
        print(f"Saving to: {output_path}")

        # Receive file data
        progress = ProgressBar(header.filename, header.filesize)
        hasher = StreamingHasher()

        with open(output_path, "wb") as f:
            received = 0
            while received < header.filesize:
                if decryptor:
                    # Receive encrypted chunk: [4-byte length][nonce + ciphertext]
                    length_bytes = recv_exactly(sock, 4)
                    length = struct.unpack(">I", length_bytes)[0]
                    encrypted_data = recv_exactly(sock, length)
                    chunk = decryptor.decrypt_chunk(encrypted_data)
                else:
                    remaining = header.filesize - received
                    chunk_size = min(remaining, CHUNK_SIZE)
                    chunk = recv_exactly(sock, chunk_size)

                f.write(chunk)
                hasher.update(chunk)
                received += len(chunk)
                progress.update(len(chunk))

        progress.finish()

        # Receive and verify checksum
        checksum_data = recv_until_newline(sock)
        try:
            expected_checksum = parse_checksum_message(checksum_data)
            actual_checksum = hasher.hexdigest()

            if actual_checksum == expected_checksum:
                print("Checksum verified!")
            else:
                print(f"WARNING: Checksum mismatch!")
                print(f"  Expected: {expected_checksum}")
                print(f"  Got:      {actual_checksum}")
                print("File may be corrupted.")
        except ValueError as e:
            print(f"Warning: Could not verify checksum: {e}")

        # Send ACK
        sock.sendall(make_ack_message())
        print(f"File saved: {output_path}")
