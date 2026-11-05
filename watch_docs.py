#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
르메뜨레 docs 폴더 실시간 파일 감시기 (Live File Watcher)
docs/ 하위 폴더에 새 파일이 들어오거나 수정/삭제되면 2초 이내로 sync_resources.py를 자동 호출합니다.
"""

import os
import time
import subprocess

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DOCS_DIR = os.path.join(SCRIPT_DIR, "docs")
SYNC_SCRIPT = os.path.join(SCRIPT_DIR, "sync_resources.py")

def get_dir_state(target_dir):
    state = {}
    if not os.path.exists(target_dir):
        return state
    for root, dirs, files in os.walk(target_dir):
        for f in files:
            if f.startswith('.') or f.startswith('~$'):
                continue
            path = os.path.join(root, f)
            try:
                state[path] = os.path.getmtime(path)
            except OSError:
                pass
    return state

def run_sync():
    print(f"\n[{time.strftime('%Y-%m-%d %H:%M:%S')}] 🔔 docs 폴더 변경 감지! 자동 동기화 실행 중...")
    try:
        res = subprocess.run(["python", SYNC_SCRIPT], cwd=SCRIPT_DIR, capture_output=True, text=True, encoding='utf-8')
        print(res.stdout)
        if res.stderr:
            print("Notice:", res.stderr)
        print("✅ 자료실(resources.json) 자동 갱신 완료!\n")
    except Exception as e:
        print("Error running sync:", e)

def watch():
    print("=" * 60)
    print("🌿 르메뜨레 docs 실시간 감시기 실행 중")
    print(f"📂 감시 대상: {DOCS_DIR}")
    print("💡 docs 폴더에 문서를 복사하거나 수정하면 즉시 자동 반영됩니다.")
    print("   (종료하려면 Ctrl + C 를 누르세요)")
    print("=" * 60)

    # 초기 1회 실행
    run_sync()
    last_state = get_dir_state(DOCS_DIR)

    while True:
        try:
            time.sleep(2)
            current_state = get_dir_state(DOCS_DIR)
            if current_state != last_state:
                run_sync()
                last_state = current_state
        except KeyboardInterrupt:
            print("\n감시기를 종료합니다.")
            break
        except Exception as e:
            time.sleep(2)

if __name__ == '__main__':
    watch()
