"""SSRF guard for LLM reverse-proxy forwarding targets.

The proxy forwards to targets chosen by the request (``X-ARTSA-Forward-To``),
registered providers (``POST /providers``) or environment config. Without a
guard, a client holding an API key could point the proxy at internal hosts —
cloud metadata (``169.254.169.254``), container networks, the local machine —
turning the guardrail into an SSRF amplifier.

The guard blocks any forwarding target whose host is a private, loopback,
link-local, multicast, reserved or unspecified address, including hostnames
that resolve to one. Policy:

* ``ARTSA_PROXY_ALLOW_INTERNAL_TARGETS=true``  -> always allow (local LLMs/Ollama)
* ``ARTSA_PROXY_ALLOW_INTERNAL_TARGETS=false`` -> always block
* unset -> block in production, allow in dev/testing (local-first default)

Only ``http``/``https`` targets are ever forwarded.

Residual risk: the hostname is resolved once here; httpx re-resolves at connect
time, so a DNS-rebinding race between check and connect is theoretically
possible. Closing it fully requires pinning the resolved address or an egress
network policy — outside the scope of this guard.
"""

from __future__ import annotations

import asyncio
import ipaddress
import logging
import socket
from urllib.parse import urlsplit

from src.core.config import settings

logger = logging.getLogger(__name__)

_ALLOWED_SCHEMES = ("http", "https")
# IANA "Shared Address Space" (CGNAT) — always treat as internal regardless of
# how the running Python classifies ip.is_private.
_SHARED_ADDRESS_SPACE = ipaddress.ip_network("100.64.0.0/10")


class SSRFBlockedError(Exception):
    """Raised when a proxied forwarding target points at an internal host."""


def _normalize_address(addr: str) -> ipaddress.IPv4Address | ipaddress.IPv6Address:
    """Parse a host string as an IP address, unwrapping IPv4-mapped IPv6."""
    ip = ipaddress.ip_address(addr)
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        return ip.ipv4_mapped
    return ip


def _is_internal_ip(addr: str) -> bool:
    """True if a host string names a non-public (internal) address."""
    try:
        ip = _normalize_address(addr)
    except ValueError:
        return False
    if isinstance(ip, ipaddress.IPv4Address) and ip in _SHARED_ADDRESS_SPACE:
        return True
    return any(
        (
            ip.is_private,
            ip.is_loopback,
            ip.is_link_local,
            ip.is_multicast,
            ip.is_reserved,
            ip.is_unspecified,
        )
    )


def _target_host(url: str) -> str:
    """Validate the URL scheme/host and return the lowercase hostname."""
    parts = urlsplit(url)
    scheme = (parts.scheme or "").lower()
    if scheme not in _ALLOWED_SCHEMES:
        raise SSRFBlockedError(
            f"Proxied target scheme '{scheme or '<none>'}' is not allowed (http/https only): {url}"
        )
    host = (parts.hostname or "").strip().rstrip(".").lower()
    if not host:
        raise SSRFBlockedError(f"Proxied target has no host: {url}")
    return host


def _blocked_message(host: str) -> str:
    return (
        f"Proxied target host {host!r} is a private/loopback/link-local address; "
        "forwarding is blocked by the SSRF guard (set "
        "ARTSA_PROXY_ALLOW_INTERNAL_TARGETS=true to allow)"
    )


def validate_target_url(url: str) -> None:
    """Static URL safety check (scheme + literal-IP hosts).

    Raises :class:`SSRFBlockedError` for non-http(s) schemes or hosts that are
    literal internal addresses. No DNS is performed here.
    """
    host = _target_host(url)
    if settings.proxy_allows_internal_targets:
        return
    if _is_internal_ip(host):
        raise SSRFBlockedError(_blocked_message(host))


async def check_proxy_target(url: str) -> None:
    """Full target check: static rules plus DNS resolution of hostnames.

    A hostname that fails to resolve is *allowed* (the connection would fail
    anyway), which keeps the guard compatible with offline/sandboxed runners
    and avoids false blocks during transient DNS issues.
    """
    host = _target_host(url)
    if settings.proxy_allows_internal_targets:
        return
    if _is_internal_ip(host):
        raise SSRFBlockedError(_blocked_message(host))

    try:
        addrs = await asyncio.to_thread(
            socket.getaddrinfo, host, None, socket.AF_UNSPEC, socket.SOCK_STREAM
        )
    except socket.gaierror:
        logger.debug("Proxy target %s did not resolve — allowing (connect would fail anyway)", host)
        return

    for info in addrs:
        addr = info[4][0]
        if _is_internal_ip(addr):
            raise SSRFBlockedError(
                f"Proxied target host {host!r} resolves to internal address {addr}; "
                "forwarding is blocked by the SSRF guard (set "
                "ARTSA_PROXY_ALLOW_INTERNAL_TARGETS=true to allow)"
            )
