"""Command-line interface for p2p-lan file transfer."""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s: %(message)s"
)
logger = logging.getLogger(__name__)


def create_parser() -> argparse.ArgumentParser:
    """Create the argument parser for the CLI."""
    parser = argparse.ArgumentParser(
        prog="p2p",
        description="Zero-config peer-to-peer file transfer over LAN",
        epilog="Examples:\n"
               "  p2p send photo.jpg           # Send a file\n"
               "  p2p send document.pdf --encrypt  # Send with encryption\n"
               "  p2p receive                  # Receive files\n"
               "  p2p receive --save-dir ~/Downloads  # Save to specific directory",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    # Send command
    send_parser = subparsers.add_parser(
        "send",
        help="Send a file to another machine on the network"
    )
    send_parser.add_argument(
        "filepath",
        type=Path,
        help="Path to the file to send"
    )
    send_parser.add_argument(
        "--encrypt",
        action="store_true",
        help="Enable encryption (requires 'cryptography' package)"
    )
    send_parser.add_argument(
        "--port",
        type=int,
        default=0,
        help="TCP port to use (default: random available port)"
    )

    # Receive command
    receive_parser = subparsers.add_parser(
        "receive",
        help="Receive files from the network"
    )
    receive_parser.add_argument(
        "--save-dir",
        type=Path,
        default=Path.cwd(),
        help="Directory to save received files (default: current directory)"
    )
    receive_parser.add_argument(
        "--accept-all",
        action="store_true",
        help="Auto-accept incoming transfers without prompting"
    )

    return parser


def cmd_send(args: argparse.Namespace) -> int:
    """Handle the 'send' command."""
    filepath: Path = args.filepath

    # Validate file exists
    if not filepath.exists():
        logger.error(f"File not found: {filepath}")
        return 1

    if not filepath.is_file():
        logger.error(f"Not a file: {filepath}")
        return 1

    # Import here to avoid circular imports and for lazy loading
    from p2p_lan.discovery import Broadcaster
    from p2p_lan.transfer import FileSender

    file_size = filepath.stat().st_size
    print(f"Preparing to send: {filepath.name} ({file_size:,} bytes)")
    print(f"Encryption: {'enabled' if args.encrypt else 'disabled'}")
    print("Broadcasting availability on LAN...")
    print("(Press Ctrl+C to cancel)\n")

    try:
        sender = FileSender(
            filepath=filepath,
            encrypt=args.encrypt,
            port=args.port
        )
        sender.start()
    except KeyboardInterrupt:
        print("\nTransfer cancelled.")
        return 130
    except Exception as e:
        logger.error(f"Transfer failed: {e}")
        return 1

    return 0


def cmd_receive(args: argparse.Namespace) -> int:
    """Handle the 'receive' command."""
    save_dir: Path = args.save_dir

    # Validate save directory
    if not save_dir.exists():
        logger.error(f"Directory not found: {save_dir}")
        return 1

    if not save_dir.is_dir():
        logger.error(f"Not a directory: {save_dir}")
        return 1

    # Check write permission
    if not os.access(save_dir, os.W_OK):
        logger.error(f"Permission denied: cannot write to {save_dir}")
        return 1

    # Import here to avoid circular imports and for lazy loading
    from p2p_lan.discovery import Listener
    from p2p_lan.transfer import FileReceiver

    print(f"Listening for senders on the network...")
    print(f"Files will be saved to: {save_dir.absolute()}")
    print("(Press Ctrl+C to cancel)\n")

    try:
        receiver = FileReceiver(
            save_dir=save_dir,
            accept_all=args.accept_all
        )
        receiver.start()
    except KeyboardInterrupt:
        print("\nReceiver stopped.")
        return 130
    except Exception as e:
        logger.error(f"Receive failed: {e}")
        return 1

    return 0


def main() -> int:
    """Main entry point for the CLI."""
    parser = create_parser()
    args = parser.parse_args()

    if args.command == "send":
        return cmd_send(args)
    elif args.command == "receive":
        return cmd_receive(args)
    else:
        parser.print_help()
        return 1


# Need os for access check
import os

if __name__ == "__main__":
    sys.exit(main())
