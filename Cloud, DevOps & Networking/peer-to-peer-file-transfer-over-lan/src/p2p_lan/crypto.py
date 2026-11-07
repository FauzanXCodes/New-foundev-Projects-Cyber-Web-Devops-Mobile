"""Encryption support for p2p-lan.

This module handles:
- X25519 Diffie-Hellman key exchange
- AES-256-GCM encryption/decryption

Requires the 'cryptography' package:
    pip install cryptography

Wire format for encrypted chunks:
    [4-byte length (big-endian)][12-byte nonce][ciphertext + 16-byte GCM tag]
"""

from __future__ import annotations

import struct
from typing import TYPE_CHECKING

# Constants
NONCE_SIZE = 12
TAG_SIZE = 16
KEY_SIZE = 32  # AES-256


def is_crypto_available() -> bool:
    """Check if the cryptography package is installed."""
    try:
        from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey
        return True
    except ImportError:
        return False


def require_crypto() -> None:
    """Raise an error if cryptography is not available."""
    if not is_crypto_available():
        raise ImportError(
            "Encryption requires the 'cryptography' package.\n"
            "Install it with: pip install cryptography"
        )


class KeyExchange:
    """X25519 Diffie-Hellman key exchange.

    Usage:
        # Both sides:
        kex = KeyExchange()
        my_public = kex.get_public_key()

        # Exchange public keys over the network...

        shared_key = kex.derive_shared_key(their_public)
    """

    def __init__(self):
        require_crypto()
        from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey
        self._private_key = X25519PrivateKey.generate()

    def get_public_key(self) -> bytes:
        """Get our public key to send to the other party."""
        from cryptography.hazmat.primitives.serialization import (
            Encoding,
            PublicFormat,
        )
        return self._private_key.public_key().public_bytes(
            Encoding.Raw,
            PublicFormat.Raw,
        )

    def derive_shared_key(self, their_public_key: bytes) -> bytes:
        """Derive the shared secret key from their public key.

        Args:
            their_public_key: The other party's public key (32 bytes).

        Returns:
            A 32-byte shared key suitable for AES-256.
        """
        from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PublicKey
        from cryptography.hazmat.primitives.kdf.hkdf import HKDF
        from cryptography.hazmat.primitives import hashes

        their_key = X25519PublicKey.from_public_bytes(their_public_key)
        shared_secret = self._private_key.exchange(their_key)

        # Use HKDF to derive a proper key from the shared secret
        hkdf = HKDF(
            algorithm=hashes.SHA256(),
            length=KEY_SIZE,
            salt=None,
            info=b"p2p-lan file transfer",
        )
        return hkdf.derive(shared_secret)


class Encryptor:
    """AES-256-GCM encryptor with incrementing nonce.

    Each chunk gets a unique nonce based on an incrementing counter.
    """

    def __init__(self, key: bytes):
        require_crypto()
        if len(key) != KEY_SIZE:
            raise ValueError(f"Key must be {KEY_SIZE} bytes, got {len(key)}")

        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        self._cipher = AESGCM(key)
        self._counter = 0

    def encrypt_chunk(self, plaintext: bytes) -> bytes:
        """Encrypt a chunk of data.

        Args:
            plaintext: Data to encrypt.

        Returns:
            Encrypted chunk in wire format:
            [4-byte length][12-byte nonce][ciphertext + 16-byte tag]
        """
        # Generate nonce from counter (12 bytes, big-endian)
        nonce = struct.pack(">Q", self._counter).rjust(NONCE_SIZE, b"\x00")
        self._counter += 1

        ciphertext = self._cipher.encrypt(nonce, plaintext, None)

        # Pack: length (4 bytes) + nonce (12 bytes) + ciphertext
        length = NONCE_SIZE + len(ciphertext)
        return struct.pack(">I", length) + nonce + ciphertext


class Decryptor:
    """AES-256-GCM decryptor."""

    def __init__(self, key: bytes):
        require_crypto()
        if len(key) != KEY_SIZE:
            raise ValueError(f"Key must be {KEY_SIZE} bytes, got {len(key)}")

        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        self._cipher = AESGCM(key)

    def decrypt_chunk(self, encrypted: bytes) -> bytes:
        """Decrypt a chunk of data.

        Args:
            encrypted: Encrypted data (nonce + ciphertext, without length prefix).

        Returns:
            Decrypted plaintext.

        Raises:
            ValueError: If decryption fails (authentication tag mismatch).
        """
        if len(encrypted) < NONCE_SIZE + TAG_SIZE:
            raise ValueError("Encrypted chunk too short")

        nonce = encrypted[:NONCE_SIZE]
        ciphertext = encrypted[NONCE_SIZE:]

        try:
            return self._cipher.decrypt(nonce, ciphertext, None)
        except Exception as e:
            raise ValueError(f"Decryption failed: {e}")


def perform_key_exchange_sender(sock) -> bytes:
    """Perform key exchange as the sender (server).

    Protocol:
        1. Sender sends their public key (32 bytes)
        2. Sender receives receiver's public key (32 bytes)
        3. Both derive shared key

    Args:
        sock: Connected socket.

    Returns:
        The shared encryption key.
    """
    kex = KeyExchange()

    # Send our public key
    sock.sendall(kex.get_public_key())

    # Receive their public key
    their_public = recv_exactly_crypto(sock, 32)

    return kex.derive_shared_key(their_public)


def perform_key_exchange_receiver(sock) -> bytes:
    """Perform key exchange as the receiver (client).

    Protocol:
        1. Receiver receives sender's public key (32 bytes)
        2. Receiver sends their public key (32 bytes)
        3. Both derive shared key

    Args:
        sock: Connected socket.

    Returns:
        The shared encryption key.
    """
    kex = KeyExchange()

    # Receive their public key
    their_public = recv_exactly_crypto(sock, 32)

    # Send our public key
    sock.sendall(kex.get_public_key())

    return kex.derive_shared_key(their_public)


def recv_exactly_crypto(sock, size: int) -> bytes:
    """Receive exactly `size` bytes from socket."""
    data = b""
    while len(data) < size:
        chunk = sock.recv(size - len(data))
        if not chunk:
            raise ConnectionError(f"Connection closed after {len(data)}/{size} bytes")
        data += chunk
    return data


def get_key_fingerprint(key: bytes) -> str:
    """Get a short fingerprint of a key for verification.

    Users can verbally compare fingerprints to verify they have
    the same key (protection against MITM attacks).

    Args:
        key: The key bytes.

    Returns:
        A short hex string like "a1b2c3d4".
    """
    import hashlib
    return hashlib.sha256(key).hexdigest()[:8]
