#!/usr/bin/env python3
"""
Lightweight local PTY bridge for Lanes Ghostty Terminal.
Speaks newline-delimited JSON on stdin/stdout so raw terminal bytes and resize
events stay cleanly framed with zero native Node addon compilation.

Protocol:
  stdin  -> {"type":"input","data":"..."}\n
  stdin  -> {"type":"resize","cols":80,"rows":24}\n
  stdout -> {"type":"data","b64":"..."}\n
  stdout -> {"type":"exit","code":0}\n
"""
import base64
import fcntl
import json
import os
import pty
import select
import signal
import struct
import sys
import termios


def set_winsize(fd: int, rows: int, cols: int) -> None:
    rows = max(4, min(300, int(rows)))
    cols = max(10, min(500, int(cols)))
    winsize = struct.pack("HHHH", rows, cols, 0, 0)
    try:
        fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)
    except OSError:
        pass


def emit(payload: dict) -> None:
    try:
        sys.stdout.write(json.dumps(payload) + "\n")
        sys.stdout.flush()
    except BrokenPipeError:
        pass


def main() -> int:
    shell = os.environ.get("LANES_SHELL") or os.environ.get("SHELL") or "/bin/zsh"
    if not os.path.isfile(shell):
        shell = "/bin/sh"
    cwd = os.environ.get("LANES_CWD") or os.getcwd()
    if not os.path.isdir(cwd):
        cwd = os.getcwd()
    cols = int(os.environ.get("LANES_COLS", "80") or "80")
    rows = int(os.environ.get("LANES_ROWS", "24") or "24")

    pid, master_fd = pty.fork()
    if pid == 0:
        try:
            os.chdir(cwd)
        except OSError:
            pass
        env = os.environ.copy()
        env["TERM"] = "xterm-256color"
        env["COLORTERM"] = "truecolor"
        env["TERM_PROGRAM"] = "Ghostty"
        env.setdefault("LANG", "en_US.UTF-8")
        env.pop("LANES_CWD", None)
        env.pop("LANES_COLS", None)
        env.pop("LANES_ROWS", None)
        env.pop("LANES_SHELL", None)
        # Interactive login shell so user aliases, PATH, and prompt work as expected
        os.execvpe(shell, [shell, "-i"], env)
        os._exit(127)

    set_winsize(master_fd, rows, cols)

    # Non-blocking reads on PTY master and stdin
    flags = fcntl.fcntl(master_fd, fcntl.F_GETFL)
    fcntl.fcntl(master_fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)
    stdin_fd = sys.stdin.fileno()
    in_flags = fcntl.fcntl(stdin_fd, fcntl.F_GETFL)
    fcntl.fcntl(stdin_fd, fcntl.F_SETFL, in_flags | os.O_NONBLOCK)

    def cleanup(_signum=None, _frame=None):
        try:
            os.kill(pid, signal.SIGHUP)
        except OSError:
            pass
        try:
            os.close(master_fd)
        except OSError:
            pass
        sys.exit(0)

    signal.signal(signal.SIGTERM, cleanup)
    signal.signal(signal.SIGINT, cleanup)

    stdin_buf = b""
    stdin_open = True
    exit_code = 0

    try:
        while True:
            read_fds = [master_fd]
            if stdin_open:
                read_fds.append(stdin_fd)
            try:
                ready, _, _ = select.select(read_fds, [], [], 0.25)
            except (InterruptedError, ValueError):
                break

            if master_fd in ready:
                try:
                    chunk = os.read(master_fd, 16384)
                    if not chunk:
                        break
                    emit({"type": "data", "b64": base64.b64encode(chunk).decode("ascii")})
                except BlockingIOError:
                    pass
                except OSError:
                    break

            if stdin_fd in ready:
                try:
                    raw = os.read(stdin_fd, 16384)
                    if not raw:
                        stdin_open = False
                        break
                    stdin_buf += raw
                    while b"\n" in stdin_buf:
                        line, stdin_buf = stdin_buf.split(b"\n", 1)
                        if not line.strip():
                            continue
                        try:
                            msg = json.loads(line.decode("utf-8", errors="replace"))
                        except json.JSONDecodeError:
                            continue
                        msg_type = msg.get("type")
                        if msg_type == "input":
                            data = msg.get("data", "")
                            if isinstance(data, str) and data:
                                encoded = data.encode("utf-8", errors="replace")
                                view = memoryview(encoded)
                                sent = 0
                                while sent < len(encoded):
                                    try:
                                        written = os.write(master_fd, view[sent:])
                                        if written <= 0:
                                            break
                                        sent += written
                                    except BlockingIOError:
                                        select.select([], [master_fd], [], 0.05)
                        elif msg_type == "resize":
                            set_winsize(master_fd, msg.get("rows", 24), msg.get("cols", 80))
                except BlockingIOError:
                    pass
                except OSError:
                    stdin_open = False
                    break

            # Check whether child shell exited
            try:
                done_pid, status = os.waitpid(pid, os.WNOHANG)
                if done_pid == pid:
                    if os.WIFEXITED(status):
                        exit_code = os.WEXITSTATUS(status)
                    elif os.WIFSIGNALED(status):
                        exit_code = 128 + os.WTERMSIG(status)
                    # Drain any remaining bytes from PTY
                    while True:
                        try:
                            tail = os.read(master_fd, 16384)
                            if not tail:
                                break
                            emit({"type": "data", "b64": base64.b64encode(tail).decode("ascii")})
                        except OSError:
                            break
                    break
            except ChildProcessError:
                break
    finally:
        try:
            os.kill(pid, signal.SIGHUP)
        except OSError:
            pass
        try:
            os.close(master_fd)
        except OSError:
            pass
        emit({"type": "exit", "code": exit_code})

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
