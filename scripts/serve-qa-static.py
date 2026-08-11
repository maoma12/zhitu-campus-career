"""Serve the local CloudBase artifact with production-like module MIME types."""

from __future__ import annotations

import argparse
import functools
import http.server
import mimetypes


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--directory", default="cloudbase-dist")
    parser.add_argument("--port", type=int, default=3012)
    args = parser.parse_args()
    mimetypes.add_type("application/javascript", ".mjs")
    handler = functools.partial(
        http.server.SimpleHTTPRequestHandler,
        directory=args.directory,
    )
    server = http.server.ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    server.serve_forever()


if __name__ == "__main__":
    main()
