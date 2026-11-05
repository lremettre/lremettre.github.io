#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
르메뜨레(L.REMETTRE) 원클릭 자동 동기화 및 깃허브 배포 통합 스크립트
1. 대용량 파일 자동 최적화/압축 (100MB 초과 방지)
2. PPTX 자동 PDF 변환 및 data/resources.json 갱신
3. Git 자동 스테이징, 커밋 및 깃허브 푸시
"""

import os
import sys
import time
import subprocess
import datetime

# 콘솔 출력 UTF-8 설정
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(SCRIPT_DIR)

def run_cmd(cmd_list, desc=""):
    if desc:
        print(f"\n[실행] {desc}...")
    try:
        res = subprocess.run(cmd_list, capture_output=True, text=True, encoding='utf-8', errors='replace')
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

def main():
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
        return

    # 2. Git 상태 확인 및 커밋 (이전 푸시 실패로 남은 로컬 커밋이 있으면 소프트 리셋 후 통합 커밋)
    print("\n[2/3] 변경 사항 패키징 및 Git 커밋 중...")
    try:
        ahead_check = subprocess.run(
            ["git", "rev-list", "--count", "origin/main..HEAD"],
            capture_output=True, text=True, encoding='utf-8'
        )
        if ahead_check.returncode == 0 and int(ahead_check.stdout.strip() or "0") > 0:
            subprocess.run(["git", "reset", "--soft", "origin/main"], capture_output=True)
    except Exception:
        pass

    run_cmd(["git", "add", "."])
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    commit_msg = f"docs: 르메뜨레 신규 자료 동기화 및 배포 ({now_str})"
    run_cmd(["git", "commit", "-m", commit_msg])

    # 3. 깃허브 푸시 (일시적 GitHub 서버 commit_refs 오류 대비 최대 3회 자동 재시도)
    print("\n[3/3] GitHub Pages 클라우드로 전송(Push) 중...")
    success = False
    for attempt in range(1, 4):
        label = "GitHub Push" if attempt == 1 else f"GitHub Push (자동 재시도 {attempt}/3)"
        success = run_cmd(["git", "push", "origin", "main"], label)
        if success:
            break
        if attempt < 3:
            print(f" ⏳ GitHub 서버 일시 응답 지연 감지 — 2초 후 자동으로 재시도합니다 ({attempt}/3)...")
            time.sleep(2)
            subprocess.run(["git", "fetch", "origin"], capture_output=True)

    print("\n" + "=" * 65)
    if success:
        print(" 🎉 모든 자료가 GitHub 클라우드로 성공적으로 배포되었습니다!")
        print(" 🌐 공식 허브 주소: https://lremettre.github.io/")
    else:
        print(" ⚠️ Git 푸시 과정에서 확인이 필요합니다. 위의 로그를 확인해주세요.")
    print("=" * 65)

if __name__ == '__main__':
    main()
