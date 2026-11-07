"""Tests for the crypto module."""

import pytest

# Skip all tests if cryptography is not installed
pytest.importorskip("cryptography")

from p2p_lan.crypto import (
    KeyExchange,
    Encryptor,
    Decryptor,
    get_key_fingerprint,
    is_crypto_available,
    KEY_SIZE,
)


class TestKeyExchange:
    """Tests for X25519 key exchange."""

    def test_public_key_is_32_bytes(self):
        kex = KeyExchange()
        public_key = kex.get_public_key()
        assert len(public_key) == 32

    def test_different_instances_have_different_keys(self):
        kex1 = KeyExchange()
        kex2 = KeyExchange()
        assert kex1.get_public_key() != kex2.get_public_key()

    def test_shared_key_derivation(self):
        # Simulate two parties
        alice = KeyExchange()
        bob = KeyExchange()

        # Exchange public keys
        alice_public = alice.get_public_key()
        bob_public = bob.get_public_key()

        # Derive shared keys
        alice_shared = alice.derive_shared_key(bob_public)
        bob_shared = bob.derive_shared_key(alice_public)

        # Both should derive the same key
        assert alice_shared == bob_shared
        assert len(alice_shared) == KEY_SIZE


class TestEncryption:
    """Tests for AES-256-GCM encryption."""

    def test_encrypt_decrypt_roundtrip(self):
        key = b"0" * 32  # 32-byte key
        encryptor = Encryptor(key)
        decryptor = Decryptor(key)

        plaintext = b"Hello, World! This is a test message."
        encrypted = encryptor.encrypt_chunk(plaintext)

        # Encrypted should be different from plaintext
        assert encrypted != plaintext

        # Extract nonce + ciphertext (skip 4-byte length prefix)
        encrypted_data = encrypted[4:]
        decrypted = decryptor.decrypt_chunk(encrypted_data)

        assert decrypted == plaintext

    def test_multiple_chunks_unique_nonces(self):
        key = b"1" * 32
        encryptor = Encryptor(key)

        chunk1 = encryptor.encrypt_chunk(b"chunk 1")
        chunk2 = encryptor.encrypt_chunk(b"chunk 2")

        # Extract nonces (bytes 4-16)
        nonce1 = chunk1[4:16]
        nonce2 = chunk2[4:16]

        # Nonces should be different (incrementing)
        assert nonce1 != nonce2

    def test_wrong_key_fails(self):
        key1 = b"a" * 32
        key2 = b"b" * 32

        encryptor = Encryptor(key1)
        decryptor = Decryptor(key2)

        plaintext = b"Secret message"
        encrypted = encryptor.encrypt_chunk(plaintext)

        with pytest.raises(ValueError, match="Decryption failed"):
            decryptor.decrypt_chunk(encrypted[4:])

    def test_invalid_key_length_raises(self):
        with pytest.raises(ValueError, match="Key must be"):
            Encryptor(b"too short")

        with pytest.raises(ValueError, match="Key must be"):
            Decryptor(b"too short")

    def test_large_chunk(self):
        key = b"2" * 32
        encryptor = Encryptor(key)
        decryptor = Decryptor(key)

        # 64KB chunk (typical transfer size)
        plaintext = b"x" * 65536
        encrypted = encryptor.encrypt_chunk(plaintext)
        decrypted = decryptor.decrypt_chunk(encrypted[4:])

        assert decrypted == plaintext


class TestKeyFingerprint:
    """Tests for key fingerprint function."""

    def test_returns_8_chars(self):
        key = b"some key data here"
        fingerprint = get_key_fingerprint(key)
        assert len(fingerprint) == 8

    def test_is_hex(self):
        key = b"another key"
        fingerprint = get_key_fingerprint(key)
        # Should only contain hex characters
        assert all(c in "0123456789abcdef" for c in fingerprint)

    def test_same_key_same_fingerprint(self):
        key = b"consistent key"
        fp1 = get_key_fingerprint(key)
        fp2 = get_key_fingerprint(key)
        assert fp1 == fp2

    def test_different_keys_different_fingerprints(self):
        fp1 = get_key_fingerprint(b"key 1")
        fp2 = get_key_fingerprint(b"key 2")
        assert fp1 != fp2


class TestCryptoAvailability:
    """Tests for crypto availability check."""

    def test_is_available(self):
        # Since we're running these tests, cryptography must be installed
        assert is_crypto_available() is True
