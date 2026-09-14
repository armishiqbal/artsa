"""Exchange a GitHub App manifest code into a local, permissioned secret file.

The manifest registration itself requires an account owner to approve it in
GitHub's UI. This helper handles only GitHub's documented final handshake. It
never logs the PEM key or webhook secret and refuses to overwrite an existing
output file unless explicitly requested.
"""

from __future__ import annotations

import argparse
import json
import os
import stat
import sys
from pathlib import Path
from urllib import error, parse, request


def exchange(code: str) -> dict[str, object]:
    if not code or len(code) > 256:
        raise ValueError("manifest code is required and must be <=256 characters")
    path = parse.quote(code, safe="")
    req = request.Request(
        f"https://api.github.com/app-manifests/{path}/conversions",
        headers={
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=20) as response:
            payload = json.loads(response.read())
    except error.HTTPError as exc:
        raise RuntimeError(f"GitHub manifest exchange failed with HTTP {exc.code}") from None
    except (TimeoutError, OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"GitHub manifest exchange failed: {exc}") from None
    if not isinstance(payload, dict):
        raise TypeError("GitHub manifest exchange returned a non-object response")
    if not isinstance(payload.get("id"), int):
        raise TypeError("GitHub manifest exchange response has no App ID")
    if not isinstance(payload.get("pem"), str) or not payload["pem"].strip():
        raise RuntimeError("GitHub manifest exchange response has no private key")
    if not isinstance(payload.get("webhook_secret"), str) or not payload["webhook_secret"].strip():
        raise RuntimeError("GitHub manifest exchange response has no webhook secret")
    return {
        "app_id": payload["id"],
        "private_key": payload["pem"],
        "webhook_secret": payload["webhook_secret"],
    }


def write_secret_file(path: Path, payload: dict[str, object], *, force: bool = False) -> None:
    if path.exists() and not force:
        raise FileExistsError(f"refusing to overwrite existing secret file: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC
    fd = os.open(path, flags, stat.S_IRUSR | stat.S_IWUSR)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2)
            handle.write("\n")
    except Exception:
        try:
            os.close(fd)
        except OSError:
            pass
        raise
    path.chmod(stat.S_IRUSR | stat.S_IWUSR)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--code", default=os.environ.get("ARTSA_GITHUB_MANIFEST_CODE"))
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("artsa-github-app-secrets.json"),
        help="0600 local output path; move values to a secret manager immediately",
    )
    parser.add_argument("--force", action="store_true", help="replace an existing output file")
    args = parser.parse_args()
    if not args.code:
        print("Set ARTSA_GITHUB_MANIFEST_CODE or pass --code.", file=sys.stderr)
        return 2
    try:
        secrets = exchange(args.code)
        write_secret_file(args.output, secrets, force=args.force)
    except (FileExistsError, RuntimeError, TypeError, ValueError, OSError) as exc:
        print(str(exc), file=sys.stderr)
        return 1
    print(f"GitHub App {secrets['app_id']} captured at {args.output} (mode 0600).")
    print("Move these values into the ARTSA VPC secret manager; do not commit the file.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
