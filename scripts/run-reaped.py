#!/usr/bin/env python3
"""Linux verification wrapper: adopt and reap orphaned build subprocesses.

Returns the command's status unless descendants refuse cleanup. Not a general
service launcher. Does not change test output or turn failed checks green.
"""
import ctypes
import os
import signal
import subprocess
import sys
import time


def main():
    if len(sys.argv) < 2:
        print('usage: run-reaped.py COMMAND [ARG ...]', file=sys.stderr)
        return 2
    # PR_SET_CHILD_SUBREAPER: grandchildren orphaned by tools such as esbuild
    # reparent here instead of PID1, so this process can actually wait for them.
    if ctypes.CDLL(None, use_errno=True).prctl(36, 1, 0, 0, 0) != 0:
        print('could not enable child reaping', file=sys.stderr)
        return 2
    status = subprocess.run(sys.argv[1:]).returncode
    deadline = time.monotonic() + 5
    forced = False
    while True:
        try:
            pid, _ = os.waitpid(-1, os.WNOHANG)
        except ChildProcessError:
            break
        if pid:
            continue
        if time.monotonic() >= deadline:
            # Only direct adopted children, never unrelated user processes.
            children_path = f'/proc/{os.getpid()}/task/{os.getpid()}/children'
            with open(children_path, encoding='ascii') as source:
                children = [int(x) for x in source.read().split()]
            for child in children:
                try:
                    os.kill(child, signal.SIGKILL)
                except ProcessLookupError:
                    pass
            if forced:
                print('descendant cleanup did not settle', file=sys.stderr)
                return 1
            forced = True
            deadline = time.monotonic() + 5
        time.sleep(.02)
    if forced:
        print('verification command left live descendants; cleanup forced', file=sys.stderr)
        return 1
    return status if status >= 0 else 128 - status


if __name__ == '__main__':
    sys.exit(main())
