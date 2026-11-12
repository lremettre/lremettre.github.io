#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
르메뜨레(L.REMETTRE) 공식 자료실 백그라운드 실시간 감시 & 자동 배포 데몬 (Live Auto-Sync Daemon)
- 감시 대상: docs/, index.html, viewer.html, presentation.html, manifest.webmanifest, css/, js/, assets/
  (assets/thumbs, data/resources.json, sw.js, .git, __pycache__, _original_backups 및 임시/잠금 파일 제외)
- 파일 추가/수정/삭제 감지 후 15초 연속 변경이 멈추면(Debounce) 자동으로 auto_deploy.main() 실행
- 오프라인 상태에서 생성된 미전송 로컬 커밋(origin/main..HEAD > 0)을 유휴 시 60초 주기로 감지하여 자동 재푸시
- 로컬호스트 TCP 소켓(127.0.0.1:49872) 단일 인스턴스 잠금으로 중복 실행 원천 차단
"""

import os
import sys
import time
import socket
import atexit
import argparse
import datetime
import traceback
import subprocess

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(SCRIPT_DIR)

LOG_FILE = os.path.join(SCRIPT_DIR, "auto_sync.log")
LOCK_INFO_FILE = os.path.join(SCRIPT_DIR, ".watch_docs.lock")
MAX_LOG_BYTES = 2 * 1024 * 1024  # 2 MB 초과 시 자동 순환 정리

LOCK_HOST = "127.0.0.1"
LOCK_PORT = 49872

POLL_INTERVAL_SEC = 2.0
DEBOUNCE_SEC = 15
IDLE_PUSH_CHECK_SEC = 60

WATCHED_ROOT_FILES = (
    "index.html",
    "viewer.html",
    "presentation.html",
    "manifest.webmanifest",
)
WATCHED_DIRS = (
    "docs",
    "css",
    "js",
    "assets",
)
EXCLUDED_DIR_NAMES = {
    ".git",
    "__pycache__",
    "_original_backups",
}
EXCLUDED_REL_PATHS = {
    "sw.js",
    "data/resources.json",
    "auto_sync.log",
    ".watch_docs.lock",
    "assets/thumbs",
}
EXCLUDED_FILE_SUFFIXES = (
    ".tmp",
    ".log",
    ".lock",
    ".part",
    ".crdownload",
)

WIN_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0) if sys.platform == "win32" else 0
_LOCK_SOCKET = None


class TeeTimestampLogger:
    """콘솔(연결된 경우)과 auto_sync.log 양쪽에 타임스탬프 로그를 기록하며 2MB 초과 시 자동 정리합니다."""

    def __init__(self, log_path, console_stream=None, max_bytes=MAX_LOG_BYTES):
        self.log_path = log_path
        self.console_stream = console_stream
        self.max_bytes = max_bytes
        self.encoding = "utf-8"
        self._buf = ""

    def _rotate_if_needed(self):
        try:
            if os.path.exists(self.log_path) and os.path.getsize(self.log_path) > self.max_bytes:
                size_now = os.path.getsize(self.log_path)
                keep_bytes = self.max_bytes // 2
                with open(self.log_path, "rb") as rf:
                    rf.seek(max(0, size_now - keep_bytes))
                    tail = rf.read().decode("utf-8", errors="ignore")
                nl_idx = tail.find("\n")
                if nl_idx != -1:
                    tail = tail[nl_idx + 1:]
                ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                header = f"[{ts}] [로그 자동 정리] auto_sync.log 용량이 2MB를 초과하여 오래된 로그를 정리했습니다.\n"
                with open(self.log_path, "w", encoding="utf-8", newline="\n") as wf:
                    wf.write(header + tail)
        except Exception:
            pass

    def _write_log_line(self, line):
        stripped = line.rstrip("\r")
        ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        if stripped == "":
            formatted = "\n"
        elif stripped.startswith("[20") and len(stripped) >= 21 and stripped[20] == "]":
            formatted = f"{stripped}\n"
        else:
            formatted = f"[{ts}] {stripped}\n"
        self._rotate_if_needed()
        try:
            with open(self.log_path, "a", encoding="utf-8", newline="\n") as lf:
                lf.write(formatted)
        except Exception:
            pass

    def write(self, data):
        if not data:
            return 0
        if not isinstance(data, str):
            data = str(data)
        if self.console_stream is not None:
            try:
                self.console_stream.write(data)
                self.console_stream.flush()
            except Exception:
                pass
        self._buf += data
        while "\n" in self._buf:
            line, self._buf = self._buf.split("\n", 1)
            self._write_log_line(line)
        return len(data)

    def flush(self):
        if self._buf:
            self._write_log_line(self._buf)
            self._buf = ""
        if self.console_stream is not None:
            try:
                self.console_stream.flush()
            except Exception:
                pass

    def isatty(self):
        return False


def setup_logging():
    orig_out = sys.__stdout__
    if sys.platform == "win32" and orig_out is not None and hasattr(orig_out, "reconfigure"):
        try:
            orig_out.reconfigure(encoding="utf-8")
        except Exception:
            pass
    logger = TeeTimestampLogger(LOG_FILE, console_stream=orig_out, max_bytes=MAX_LOG_BYTES)
    sys.stdout = logger
    sys.stderr = logger
    return logger


def _cleanup_lock_info():
    try:
        if os.path.exists(LOCK_INFO_FILE):
            os.remove(LOCK_INFO_FILE)
    except Exception:
        pass


def acquire_single_instance_lock():
    """로컬호스트 TCP 포트(127.0.0.1:49872) 바인딩으로 중복 데몬 실행을 원천 방지합니다."""
    global _LOCK_SOCKET
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
        try:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        except Exception:
            pass
    try:
        sock.bind((LOCK_HOST, LOCK_PORT))
        sock.listen(1)
        _LOCK_SOCKET = sock
        try:
            with open(LOCK_INFO_FILE, "w", encoding="utf-8") as f:
                f.write(f"pid={os.getpid()}\nport={LOCK_PORT}\nstarted={datetime.datetime.now().isoformat()}\n")
            atexit.register(_cleanup_lock_info)
        except Exception:
            pass
        return True
    except OSError:
        try:
            sock.close()
        except Exception:
            pass
        print(f"ℹ️ 이미 watch_docs.py 자동 동기화 데몬이 실행 중입니다 (127.0.0.1:{LOCK_PORT} 활성). 중복 실행을 종료합니다.")
        return False


def _is_ignored_file(fname, rel_path_posix):
    if not fname or fname.startswith(".") or fname.startswith("~$"):
        return True
    lower_name = fname.lower()
    if lower_name.endswith(EXCLUDED_FILE_SUFFIXES):
        return True
    if rel_path_posix in EXCLUDED_REL_PATHS or rel_path_posix.startswith("assets/thumbs/"):
        return True
    return False


def get_watched_state():
    """
    감시 대상 파일들의 {상대경로: (수정시각, 파일크기)} 스냅샷을 반환합니다.
    (assets/thumbs, data/resources.json, sw.js, 임시/잠금 파일 제외)
    """
    state = {}

    # 1. 루트 단일 감시 파일
    for fname in WATCHED_ROOT_FILES:
        if _is_ignored_file(fname, fname):
            continue
        fpath = os.path.join(SCRIPT_DIR, fname)
        if os.path.isfile(fpath):
            try:
                st = os.stat(fpath)
                state[fname] = (round(st.st_mtime, 3), st.st_size)
            except OSError:
                pass

    # 2. 감시 대상 하위 디렉토리
    for dname in WATCHED_DIRS:
        target_dir = os.path.join(SCRIPT_DIR, dname)
        if not os.path.isdir(target_dir):
            continue
        for root, dirs, files in os.walk(target_dir):
            rel_root = os.path.relpath(root, SCRIPT_DIR).replace("\\", "/")
            # 제외 디렉토리 프루닝 (인플레이스 수정으로 하위 탐색 차단)
            filtered_dirs = []
            for sub in dirs:
                if sub.startswith(".") or sub in EXCLUDED_DIR_NAMES:
                    continue
                sub_rel = f"{rel_root}/{sub}" if rel_root != "." else sub
                if sub_rel.lower() == "assets/thumbs":
                    continue
                filtered_dirs.append(sub)
            dirs[:] = sorted(filtered_dirs)

            for fname in sorted(files):
                rel_path = f"{rel_root}/{fname}"
                if _is_ignored_file(fname, rel_path):
                    continue
                fpath = os.path.join(root, fname)
                try:
                    st = os.stat(fpath)
                    state[rel_path] = (round(st.st_mtime, 3), st.st_size)
                except OSError:
                    pass

    return state


def summarize_changes(old_state, new_state, limit=5):
    added = [k for k in new_state if k not in old_state]
    removed = [k for k in old_state if k not in new_state]
    modified = [k for k in new_state if k in old_state and new_state[k] != old_state[k]]

    labels = (
        [f"+{p}" for p in added]
        + [f"~{p}" for p in modified]
        + [f"-{p}" for p in removed]
    )
    if not labels:
        return "변경 감지"
    shown = ", ".join(labels[:limit])
    if len(labels) > limit:
        shown += f" 외 {len(labels) - limit}건"
    return shown


def get_unpushed_commit_count():
    """origin/main 대비 미전송 로컬 커밋 수를 조회합니다."""
    try:
        res = subprocess.run(
            ["git", "rev-list", "--count", "origin/main..HEAD"],
            cwd=SCRIPT_DIR,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            creationflags=WIN_NO_WINDOW,
        )
        if res.returncode == 0:
            return int(res.stdout.strip() or "0")
    except Exception:
        pass
    return 0


def run_auto_deploy(reason=""):
    import auto_deploy
    if reason:
        print(f"\n🔔 [자동 배포 트리거] {reason}")
    try:
        ok = auto_deploy.main()
        sys.stdout.flush()
        return bool(ok)
    except Exception as e:
        print(f"[자동 배포 실행 오류] {e}")
        traceback.print_exc()
        sys.stdout.flush()
        return False


def watch(once=False):
    setup_logging()

    if not acquire_single_instance_lock():
        return 0

    print("=" * 65)
    print("🌿 르메뜨레(L.REMETTRE) 백그라운드 자동 동기화 & 배포 데몬 가동")
    print(f"📂 작업 루트: {SCRIPT_DIR}")
    print(f"⏱️ 디바운스 대기: {DEBOUNCE_SEC}초 | 오프라인 미전송 점검 주기: {IDLE_PUSH_CHECK_SEC}초")
    print(f"📝 로그 파일: {LOG_FILE}")
    print("=" * 65)
    sys.stdout.flush()

    # 시작 시 1회 점검/동기화 실행 (변경 사항이 없으면 빈 커밋 없이 즉시 통과)
    ok = run_auto_deploy("데몬 시작 초기 상태 점검" if not once else "단발성(--once) 동기화 점검")
    if once:
        print("✅ --once 단일 점검 완료 후 종료합니다.")
        sys.stdout.flush()
        return 0 if ok else 1

    last_state = get_watched_state()
    pending_state = None
    last_change_mono = None
    last_idle_check_mono = time.monotonic()

    print(f"👀 총 {len(last_state)}개 파일 실시간 감시 대기 중...")
    sys.stdout.flush()

    while True:
        try:
            time.sleep(POLL_INTERVAL_SEC)
            now_mono = time.monotonic()
            current_state = get_watched_state()

            if pending_state is None:
                if current_state != last_state:
                    diff_summary = summarize_changes(last_state, current_state)
                    print(f"🔔 파일 변경 감지 ({diff_summary}) — {DEBOUNCE_SEC}초 연속 안정화 대기 시작...")
                    sys.stdout.flush()
                    pending_state = current_state
                    last_change_mono = now_mono
                elif (now_mono - last_idle_check_mono) >= IDLE_PUSH_CHECK_SEC:
                    last_idle_check_mono = now_mono
                    ahead = get_unpushed_commit_count()
                    if ahead > 0:
                        run_auto_deploy(f"오프라인 미전송 로컬 커밋 {ahead}건 감지 — 자동 클라우드 재푸시")
                        last_state = get_watched_state()
            else:
                if current_state != pending_state:
                    diff_summary = summarize_changes(pending_state, current_state)
                    print(f"⏳ 추가 파일 변경 감지 ({diff_summary}) — {DEBOUNCE_SEC}초 타이머 리셋...")
                    sys.stdout.flush()
                    pending_state = current_state
                    last_change_mono = now_mono
                elif (now_mono - last_change_mono) >= DEBOUNCE_SEC:
                    diff_summary = summarize_changes(last_state, pending_state)
                    deploy_ok = run_auto_deploy(f"{DEBOUNCE_SEC}초 연속 변경 없음 확인 ({diff_summary})")
                    # 배포 과정에서 생성/최적화된 파일(PDF 등)을 반영하도록 완료 직후 스냅샷 갱신
                    last_state = get_watched_state()
                    pending_state = None
                    last_change_mono = None
                    last_idle_check_mono = time.monotonic()
                    if deploy_ok:
                        print(f"✅ 자동 배포 사이클 완료 — 감시 재개 (감시 파일 {len(last_state)}개)")
                    else:
                        print("⚠️ 자동 배포 중 일부 단계 미완료 — 감시 유지 및 추후 자동 재시도 예정")
                    sys.stdout.flush()

        except KeyboardInterrupt:
            print("\n🛑 사용자 요청(Ctrl+C)으로 자동 동기화 데몬을 종료합니다.")
            sys.stdout.flush()
            break
        except Exception as loop_err:
            print(f"[감시 루프 예외 복구] {loop_err}")
            traceback.print_exc()
            sys.stdout.flush()
            time.sleep(5)

    return 0


def parse_args():
    parser = argparse.ArgumentParser(
        description="르메뜨레 공식 자료실 실시간 파일 감시 및 자동 GitHub 배포 데몬"
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="1회 동기화/배포 점검만 수행하고 즉시 종료합니다 (테스트용).",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    sys.exit(watch(once=args.once))
