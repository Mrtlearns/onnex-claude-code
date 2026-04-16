#!/usr/bin/env python3
"""
Docker API version rewriter proxy.
Listens on TCP :2375, rewrites /vX.YY/ -> /v1.41/ in ALL HTTP request lines.
Handles HTTP/1.1 keep-alive connections (multiple requests per connection).
Also rewrites MinAPIVersion in /version responses.
"""
import socket
import threading
import re
import sys

LISTEN_PORT = 2375
DOCKER_SOCK = "/var/run/docker.sock"
TARGET_VERSION = "v1.41"
VER_PATTERN = re.compile(rb"/v\d+\.\d+/")


def rewrite_http_requests(data):
    """
    Rewrite all HTTP request lines in a chunk.
    HTTP request format: METHOD SP path SP HTTP/1.x CRLF
    One TCP chunk may contain multiple pipelined requests.
    """
    result = bytearray()
    i = 0
    while i < len(data):
        # Find CRLF
        crlf = data.find(b"\r\n", i)
        if crlf == -1:
            result.extend(data[i:])
            break
        line = data[i:crlf]
        # Check if this looks like an HTTP request line (starts with method)
        if (line.startswith(b"GET ") or line.startswith(b"POST ") or
                line.startswith(b"PUT ") or line.startswith(b"DELETE ") or
                line.startswith(b"HEAD ") or line.startswith(b"OPTIONS ")):
            new_line = VER_PATTERN.sub(b"/" + TARGET_VERSION.encode() + b"/", line)
            if new_line != line:
                sys.stderr.write("REWRITE: " + line.decode("utf-8", errors="replace")[:100] + "\n")
                sys.stderr.flush()
            result.extend(new_line)
        else:
            result.extend(line)
        result.extend(b"\r\n")
        i = crlf + 2
    return bytes(result)


def rewrite_version_response(data):
    """Rewrite MinAPIVersion in the server response to allow old clients."""
    return data.replace(b'MinAPIVersion":"1.40"', b'MinAPIVersion":"1.24"')


def forward_requests(src, dst):
    """Forward requests from src to dst, rewriting API versions."""
    try:
        while True:
            chunk = src.recv(65536)
            if not chunk:
                break
            chunk = rewrite_http_requests(chunk)
            dst.sendall(chunk)
    except Exception:
        pass
    finally:
        try:
            dst.shutdown(socket.SHUT_WR)
        except Exception:
            pass


def forward_responses(src, dst):
    """Forward responses from src to dst, rewriting version info."""
    try:
        while True:
            chunk = src.recv(65536)
            if not chunk:
                break
            chunk = rewrite_version_response(chunk)
            dst.sendall(chunk)
    except Exception:
        pass
    finally:
        try:
            dst.shutdown(socket.SHUT_WR)
        except Exception:
            pass


def handle(client_sock):
    try:
        upstream = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        upstream.connect(DOCKER_SOCK)
        t1 = threading.Thread(target=forward_requests, args=(client_sock, upstream), daemon=True)
        t2 = threading.Thread(target=forward_responses, args=(upstream, client_sock), daemon=True)
        t1.start()
        t2.start()
        t1.join()
        t2.join()
    except Exception as e:
        sys.stderr.write("handle: " + str(e) + "\n")
    finally:
        client_sock.close()


def main():
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(("0.0.0.0", LISTEN_PORT))
    srv.listen(128)
    print("Docker API rewriter listening on :" + str(LISTEN_PORT), flush=True)
    while True:
        c, _ = srv.accept()
        threading.Thread(target=handle, args=(c,), daemon=True).start()


if __name__ == "__main__":
    main()
