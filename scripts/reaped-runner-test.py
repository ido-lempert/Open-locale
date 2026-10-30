#!/usr/bin/env python3
import subprocess
import sys

wrapper = [sys.executable, 'scripts/run-reaped.py']
cases = [
    ('success exit preserved', 'import sys;sys.exit(0)', 0),
    ('failure exit preserved', 'import sys;sys.exit(7)', 7),
    ('orphaned child adopted and reaped', 'import os,time;pid=os.fork();time.sleep(.05) if pid==0 else None;os._exit(0)', 0),
    ('live leftover fails instead of false green', 'import os,time;pid=os.fork();time.sleep(30) if pid==0 else None;os._exit(0)', 1),
]
failures = 0
for name, code, expected in cases:
    result = subprocess.run(wrapper + [sys.executable, '-c', code], capture_output=True, timeout=15)
    ok = result.returncode == expected
    if name.startswith('live'):
        ok = ok and b'cleanup forced' in result.stderr
    print(('PASS' if ok else 'FAIL') + ' ' + name)
    failures += not ok
sys.exit(1 if failures else 0)
