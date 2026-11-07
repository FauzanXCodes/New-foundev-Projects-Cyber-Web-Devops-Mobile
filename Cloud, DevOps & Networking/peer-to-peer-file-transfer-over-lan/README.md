# p2p-lan

Zero-configuration peer-to-peer file transfer over your local network.

**No cloud. No server. No accounts. Just direct transfer.**

## Quick Start

**Terminal 1 (Sender):**
```bash
p2p send photo.jpg
```

**Terminal 2 (Receiver):**
```bash
p2p receive
```

That's it! The receiver will see the available file and can accept the transfer.

## How It Works

```
  Sender                          Receiver
    │                                │
    │──── UDP broadcast ────────────►│  (repeated every 1s)
    │     { file info }              │
    │                                │
    │◄──── TCP connect ─────────────│  (receiver accepted)
    │                                │
    │◄───► DH key exchange ────────►│  (if --encrypt)
    │                                │
    │──── file header (JSON) ──────►│
    │──── file data (chunks) ──────►│
    │──── SHA-256 checksum ────────►│
    │                                │
    │◄──── ACK ─────────────────────│
    │                                │
   done                            done
```

1. **Discovery**: The sender broadcasts its availability via UDP on port 9999. The announcement includes file name, size, and sender IP.

2. **Connection**: When a receiver accepts, it connects directly to the sender's TCP port.

3. **Transfer**: The file is streamed in 64KB chunks with a progress bar. After transfer, the SHA-256 checksum is verified.

4. **Encryption** (optional): With `--encrypt`, an X25519 key exchange occurs before transfer, and all data is encrypted with AES-256-GCM.

## Installation

```bash
# Clone the repository
git clone https://github.com/jakobkuy/p2p-lan.git
cd p2p-lan

# Install (editable mode recommended for development)
pip install -e .

# Or install with encryption support
pip install -e ".[crypto]"
```

### Requirements

- Python 3.10+
- No dependencies for basic transfers
- `cryptography` package required for `--encrypt` flag

## Usage

### Send a file

```bash
# Basic transfer
p2p send document.pdf

# With encryption
p2p send secret.zip --encrypt

# Specify TCP port
p2p send file.txt --port 8080
```

### Receive files

```bash
# Interactive mode (prompts for acceptance)
p2p receive

# Save to specific directory
p2p receive --save-dir ~/Downloads

# Auto-accept transfers (for scripting)
p2p receive --accept-all
```

### Options

| Command | Option | Description |
|---------|--------|-------------|
| `send` | `<filepath>` | File to send (required) |
| `send` | `--encrypt` | Enable end-to-end encryption |
| `send` | `--port PORT` | TCP port (default: random) |
| `receive` | `--save-dir DIR` | Save directory (default: current) |
| `receive` | `--accept-all` | Auto-accept without prompting |

## Security

### Encryption

When using `--encrypt`:

1. **Key Exchange**: Both parties perform an X25519 Diffie-Hellman key exchange to establish a shared secret.
2. **Key Derivation**: HKDF-SHA256 derives a 256-bit AES key from the shared secret.
3. **Encryption**: Each 64KB chunk is encrypted with AES-256-GCM using a unique incrementing nonce.
4. **Authentication**: GCM mode provides authenticated encryption — any tampering is detected.

### Honest Limitations

⚠️ **The initial key exchange is vulnerable to man-in-the-middle (MITM) attacks** because there is no certificate authority or pre-shared key to verify identity.

On a trusted LAN (your home or office network), this is acceptable. For untrusted networks:

1. Use `--encrypt` to enable encryption
2. Compare the **key fingerprint** displayed on both sides verbally or via a separate channel
3. If fingerprints match, no MITM is present

```
Sender:   Key fingerprint: a1b2c3d4
Receiver: Key fingerprint: a1b2c3d4  ✓ Matches!
```

### Checksum Verification

Every transfer includes SHA-256 checksum verification. If the checksum doesn't match, you'll see a warning — the file was corrupted in transit.

## Technical Decisions

### Why UDP broadcast over mDNS?
- **Simpler**: No dependencies, works everywhere
- **Faster discovery**: Immediate announcements vs mDNS lookup delays
- **Transparent**: Easy to understand and debug

### Why X25519 over traditional DH?
- **Simpler**: Fixed parameters, no negotiation
- **Faster**: Elliptic curve math is faster than large prime modular exponentiation
- **Safer**: Fewer implementation pitfalls

### Why AES-256-GCM?
- **Authenticated**: Detects tampering, not just eavesdropping
- **Fast**: Hardware acceleration on modern CPUs (AES-NI)
- **Standard**: Well-analyzed, widely used

### Why zero external deps for core?
- **Portability**: Runs anywhere Python runs
- **Trust**: No supply chain concerns for basic functionality
- **Speed**: Faster installation, no version conflicts

## Architecture

```
p2p-lan/
├── src/p2p_lan/
│   ├── cli.py         # Argument parsing with argparse
│   ├── discovery.py   # UDP broadcast sender + listener
│   ├── transfer.py    # TCP file transfer logic
│   ├── crypto.py      # X25519 + AES-256-GCM encryption
│   ├── protocol.py    # Wire format definitions
│   └── utils.py       # Progress bar, hashing, formatting
└── tests/             # pytest test suite
```

## Limitations & Future Work

- **Single file only**: No multi-file or directory transfer (yet)
- **LAN only**: No NAT traversal — both machines must be on the same subnet
- **UDP broadcast range**: Limited to local subnet; won't cross routers
- **No resume**: Interrupted transfers must restart from the beginning

## Troubleshooting

### "No senders found"
- Ensure both machines are on the same network subnet
- Check if a firewall is blocking UDP port 9999
- Try running `p2p send` first, then `p2p receive`

### "Connection refused"
- The sender may have timed out — try again
- Check if a firewall is blocking the TCP port

### Firewall configuration
Allow UDP port 9999 (discovery) and the TCP port shown by the sender:
```bash
# macOS (temporary)
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add $(which python3)

# Linux (ufw)
sudo ufw allow 9999/udp
sudo ufw allow 50000:60000/tcp  # For random port range
```

## License

MIT License — see [LICENSE](LICENSE) for details.

## Author

Jakob Kuylenstierna ([github.com/jakobkuy](https://github.com/jakobkuy))
