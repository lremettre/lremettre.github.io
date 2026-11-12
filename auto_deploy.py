#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
르메뜨레(L.REMETTRE) 원클릭 자동 동기화 및 깃허브 배포 통합 스크립트
1. 대용량 파일 자동 최적화/압축 (100MB 초과 방지)
2. PPTX 자동 PDF 변환(수정본 재변환 포함) 및 data/resources.json 갱신
3. 실제 변경 사항 감지 시에만 PWA Service Worker(sw.js) 캐시 버전 자동 갱신
4. Git 자동 스테이징, 커밋 및 깃허브 푸시 (오프라인 복구 및 3회 재시도 지원)
"""

import os
import re
import sys
import time
import subprocess
import datetime

# 콘솔 출력 UTF-8 설정 (pythonw 무창 모드에서도 안전하게 처리)
if sys.platform == 'win32':
    try:
        if sys.stdout is not None and hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8')
        if sys.stderr is not None and hasattr(sys.stderr, 'reconfigure'):
            sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SW_PATH = os.path.join(SCRIPT_DIR, "sw.js")
WIN_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0) if sys.platform == "win32" else 0
IGNORED_TEMP_SUFFIXES = (".log", ".lock", ".tmp", ".part", ".crdownload")
IGNORED_EXACT_NAMES = {"auto_sync.log", ".watch_docs.lock"}


def run_cmd(cmd_list, desc=""):
    if desc:
        print(f"\n[실행] {desc}...")
    try:
        res = subprocess.run(
            cmd_list,
            cwd=SCRIPT_DIR,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            creationflags=WIN_NO_WINDOW,
        )
        if res.stdout and res.stdout.strip():
            print(res.stdout.strip())
        if res.returncode != 0:
            if "nothing to commit" in (res.stdout + res.stderr):
                print(" ℹ️ 새로 커밋할 변경 내역이 없습니다 (최신 상태).")
                return True
            if res.stderr and res.stderr.strip():
                print(f"[알림/경고] {res.stderr.strip()}")
            return False
        else:
            if res.stderr and res.stderr.strip():
                # Git push 진행 정보는 stderr로 출력되므로 정상 표시
                print(res.stderr.strip())
            return True
    except Exception as e:
        print(f"[오류 발생] {e}")
        return False


def get_ahead_count():
    """로컬 브랜치(HEAD)가 origin/main보다 앞서 있는 미전송 커밋 개수를 반환합니다."""
    try:
        ahead_check = subprocess.run(
            ["git", "rev-list", "--count", "origin/main..HEAD"],
            cwd=SCRIPT_DIR,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            creationflags=WIN_NO_WINDOW,
        )
        if ahead_check.returncode == 0:
            return int(ahead_check.stdout.strip() or "0")
    except Exception:
        pass
    return 0


def get_meaningful_git_changes():
    """
    git status --porcelain 결과를 확인하여 로그/잠금/임시 파일을 제외한
    실제 추적/미추적 변경 사항 목록을 반환합니다.
    """
    try:
        res = subprocess.run(
            ["git", "-c", "core.quotepath=false", "status", "--porcelain"],
            cwd=SCRIPT_DIR,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            creationflags=WIN_NO_WINDOW,
        )
        if res.returncode != 0:
            return []
        changes = []
        for raw_line in res.stdout.splitlines():
            if len(raw_line) < 4:
                continue
            path_part = raw_line[3:].strip()
            if " -> " in path_part:
                path_part = path_part.split(" -> ", 1)[1].strip()
            path_part = path_part.strip('"')
            base = os.path.basename(path_part)
            if base in IGNORED_EXACT_NAMES or base.startswith("~$"):
                continue
            if base.lower().endswith(IGNORED_TEMP_SUFFIXES):
                continue
            changes.append(raw_line)
        return changes
    except Exception as e:
        print(f"[Git 상태 확인 오류] {e}")
        return []


def bump_sw_cache_version():
    """
    실제 배포할 변경 사항이 존재할 때만 sw.js의 CACHE 버전을 타임스탬프로 자동 갱신하여
    클라이언트 브라우저 및 설치된 PWA가 즉시 새 버전을 감지하도록 합니다.
    """
    if not os.path.exists(SW_PATH):
        return None
    ver_stamp = datetime.datetime.now().strftime('%Y%m%d%H%M%S')
    try:
        with open(SW_PATH, 'r', encoding='utf-8') as f:
            content = f.read()

        replacement = f"const CACHE = 'lremettre-v{ver_stamp}';"
        updated, count = re.subn(
            r"const CACHE = 'lremettre-v[^']*';",
            replacement,
            content,
            count=1,
        )
        if count == 0:
            updated, count = re.subn(
                r"""const\s+CACHE\s*=\s*['"]lremettre-v[^'"]*['"]\s*;""",
                replacement,
                content,
                count=1,
            )
        if count > 0 and updated != content:
            with open(SW_PATH, 'w', encoding='utf-8', newline='\n') as f:
                f.write(updated)
            print(f"[PWA 캐시 자동 갱신] sw.js -> lremettre-v{ver_stamp}")
            return ver_stamp
    except Exception as e:
        print(f"[sw.js 버전 갱신 경고] {e}")
    return None


def push_to_github(max_attempts=3):
    """일시적 GitHub 서버/네트워크 오류에 대비하여 최대 3회 자동 재시도로 푸시합니다."""
    print("\n[3/3] GitHub Pages 클라우드로 전송(Push) 중...")
    success = False
    for attempt in range(1, max_attempts + 1):
        label = "GitHub Push" if attempt == 1 else f"GitHub Push (자동 재시도 {attempt}/{max_attempts})"
        success = run_cmd(["git", "push", "origin", "main"], label)
        if success:
            break
        if attempt < max_attempts:
            print(f" ⏳ GitHub 서버 일시 응답 지연 감지 — 2초 후 자동으로 재시도합니다 ({attempt}/{max_attempts})...")
            time.sleep(2)
            subprocess.run(
                ["git", "fetch", "origin"],
                cwd=SCRIPT_DIR,
                capture_output=True,
                creationflags=WIN_NO_WINDOW,
            )
    return success


def deploy_all():
    """
    전체 자료실 동기화, SW 버전 스탬프 갱신, Git 커밋 및 푸시를 통합 수행합니다.
    성공(또는 변경 사항 없음) 시 True, 오류/푸시 실패 시 False를 반환합니다.
    """
    os.chdir(SCRIPT_DIR)

    print("=" * 65)
    print(" 🌿 르메뜨레 공식 자료실 원클릭 자동 동기화 & 깃허브 배포 엔진")
    print("=" * 65)

    # 1. sync_resources.py 실행 (대용량 압축 + PPTX->PDF 자동 변환 + JSON 갱신)
    print("\n[1/3] 문서 스캔, 대용량 자동 압축 및 resources.json 갱신 중...")
    try:
        import sync_resources
        sync_resources.scan_docs()
    except Exception as e:
        print(f"[동기화 오류] {e}")
        return False

    # 2. Git 상태 확인 및 조건부 SW 버전 갱신 + 커밋
    print("\n[2/3] 변경 사항 확인 및 Git 패키징 중...")
    meaningful_changes = get_meaningful_git_changes()
    ahead_count = get_ahead_count()

    if not meaningful_changes and ahead_count == 0:
        print(" ℹ️ 변경된 자료나 코드가 없어 커밋 및 배포를 생략합니다 (최신 상태 유지).")
        print("\n" + "=" * 65)
        print(" ✅ 모든 자료가 이미 최신 상태로 동기화되어 있습니다.")
        print(" 🌐 공식 허브 주소: https://lremettre.github.io/")
        print("=" * 65)
        return True

    if meaningful_changes:
        # 이전 푸시 실패로 남은 로컬 커밋이 있으면 소프트 리셋 후 신규 변경분과 하나로 통합 커밋
        if ahead_count > 0:
            try:
                subprocess.run(
                    ["git", "reset", "--soft", "origin/main"],
                    cwd=SCRIPT_DIR,
                    capture_output=True,
                    creationflags=WIN_NO_WINDOW,
                )
            except Exception:
                pass

        # 실제 변경 사항이 있을 때만 sw.js 캐시 버전 갱신 (빈 커밋 원천 방지)
        bump_sw_cache_version()

        run_cmd(["git", "add", "."])
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        commit_msg = f"docs: 르메뜨레 신규 자료 동기화 및 배포 ({now_str})"
        if not run_cmd(["git", "commit", "-m", commit_msg]):
            print(" ⚠️ Git 커밋 단계에서 문제가 발생했습니다.")
            return False
    else:
        print(f" ℹ️ 미전송 로컬 커밋 {ahead_count}건 감지 — 추가 빈 커밋 없이 클라우드 전송을 재시도합니다.")

    # 3. 깃허브 푸시 (최대 3회 자동 재시도)
    success = push_to_github(max_attempts=3)

    print("\n" + "=" * 65)
    if success:
        print(" 🎉 모든 자료가 GitHub 클라우드로 성공적으로 배포되었습니다!")
        print(" 🌐 공식 허브 주소: https://lremettre.github.io/")
    else:
        print(" ⚠️ Git 푸시 과정에서 확인이 필요합니다. 네트워크 복구 시 자동 재시도됩니다.")
    print("=" * 65)
    return success


def main():
    return deploy_all()


if __name__ == '__main__':
    deploy_all()
