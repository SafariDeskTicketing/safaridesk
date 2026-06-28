from __future__ import annotations

from typing import Optional, Tuple


def resolve_imap_transport(port: Optional[int], use_ssl: Optional[bool]) -> Tuple[int, bool]:
    resolved_port = port or 993
    resolved_ssl = use_ssl if use_ssl is not None else resolved_port == 993

    # Port 993 is implicit TLS/SSL for IMAP.
    if resolved_port == 993:
        resolved_ssl = True

    return resolved_port, resolved_ssl


def resolve_smtp_transport(
    port: Optional[int],
    use_ssl: Optional[bool],
    use_tls: Optional[bool],
) -> Tuple[int, bool, bool]:
    if port:
        resolved_port = port
    elif use_ssl:
        resolved_port = 465
    else:
        resolved_port = 587

    resolved_ssl = bool(use_ssl) if use_ssl is not None else False
    resolved_tls = bool(use_tls) if use_tls is not None else False

    # Canonical SMTP transport modes for common ports.
    if resolved_port == 465:
        resolved_ssl = True
        resolved_tls = False
    elif resolved_port == 587 and use_ssl is not True and not resolved_tls:
        resolved_tls = True

    if resolved_ssl:
        resolved_tls = False

    return resolved_port, resolved_ssl, resolved_tls
