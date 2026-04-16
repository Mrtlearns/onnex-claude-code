def is_online() -> bool:
    """Quick non-blocking check if OpenRouter is reachable (TCP socket, 2s timeout)."""
    import socket
    try:
        socket.create_connection(("openrouter.ai", 443), timeout=2)
        return True
    except Exception:
        return False
