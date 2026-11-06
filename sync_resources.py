#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
르메뜨레(L.REMETTRE) 공식 자료실 자동 동기화 & 미리보기 썸네일 생성 엔진 (v2.0 White Edition)
- 6대 공식 카테고리 체계:
  01_프레젠테이션_강의 (프레젠테이션&강의)
  02_문서_자료 (문서 자료)
  03_행사_영상 (행사 영상)
  04_후기_영상 (후기 영상)
  05_분석_자료 (분석 자료)
  06_각종_양식 (각종 양식)
- 모든 PDF/PPTX의 첫 슬라이드(1페이지)와 MP4 영상의 첫 클립 고해상도 썸네일을
  assets/thumbs/ 폴더에 자동 추출하여 카드 미리보기를 100% 보장합니다.
"""

import os
import re
import io
import json
import datetime
import urllib.parse
from PIL import Image

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DOCS_DIR = os.path.join(SCRIPT_DIR, "docs")
THUMBS_DIR = os.path.join(SCRIPT_DIR, "assets", "thumbs")
OUTPUT_JSON = os.path.join(SCRIPT_DIR, "data", "resources.json")

# 6대 공식 카테고리 폴더명 매핑 규칙
CATEGORY_MAP = {
    "01_프레젠테이션_강의": {"category": "presentation", "name": "프레젠테이션&강의", "badge": "강의/발표"},
    "presentations": {"category": "presentation", "name": "프레젠테이션&강의", "badge": "강의/발표"},
    "02_문서_자료": {"category": "document", "name": "문서 자료", "badge": "공식문서"},
    "02_제품_시험성적서": {"category": "document", "name": "문서 자료", "badge": "공식문서"},
    "03_홍보_브로슈어": {"category": "document", "name": "문서 자료", "badge": "공식문서"},
    "03_행사_영상": {"category": "event_video", "name": "행사 영상", "badge": "행사영상"},
    "04_후기_영상": {"category": "review_video", "name": "후기 영상", "badge": "후기영상"},
    "05_영상 자료": {"category": "review_video", "name": "후기 영상", "badge": "후기영상"},
    "05.영상 자료": {"category": "review_video", "name": "후기 영상", "badge": "후기영상"},
    "05_분석_자료": {"category": "analysis", "name": "분석 자료", "badge": "데이터분석"},
    "06_각종_양식": {"category": "forms", "name": "각종 양식", "badge": "공식양식"},
    "04_공식_서식": {"category": "forms", "name": "각종 양식", "badge": "공식양식"},
}

def format_size(bytes_size):
    if bytes_size < 1024:
        return f"{bytes_size} B"
    elif bytes_size < 1024 * 1024:
        return f"{bytes_size / 1024:.1f} KB"
    else:
        return f"{bytes_size / (1024 * 1024):.1f} MB"

def extract_version(text):
    match = re.search(r'(v\d+(\.\d+)?|\d{4}\.\d{2}|\d{6})', text, re.IGNORECASE)
    return match.group(1) if match else "v1.0"

def clean_title(filename):
    base, _ = os.path.splitext(filename)
    cleaned = base.replace('_', ' ').replace('-', ' ').strip()
    return cleaned

def generate_pdf_thumbnail_and_pages(pdf_path, group_key):
    """
    PDF의 첫 슬라이드(1페이지)를 고해상도 썸네일(assets/thumbs/{group_key}.jpg)로 저장하고
    전체 페이지 수를 함께 반환합니다.
    """
    os.makedirs(THUMBS_DIR, exist_ok=True)
    thumb_filename = f"{group_key}.jpg"
    thumb_full_path = os.path.join(THUMBS_DIR, thumb_filename)
    thumb_rel_url = f"assets/thumbs/{thumb_filename}"
    page_count = None

    try:
        import pymupdf
        doc = pymupdf.open(pdf_path)
        page_count = len(doc)
        if page_count > 0:
            # 파일 수정 시각 비교하여 썸네일이 없거나 원본이 갱신되었을 때만 재생성
            need_gen = not os.path.exists(thumb_full_path) or (os.path.getmtime(pdf_path) > os.path.getmtime(thumb_full_path))
            if need_gen:
                page = doc[0]
                rect = page.rect
                scale = 960.0 / max(rect.width, 1)
                pix = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=False)
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                # 세로형(A4) 문서는 상단 헤드라인과 제목이 16:9 프레임 중앙에 오도록 상단 기준 크롭
                if img.height > img.width * 0.65:
                    target_h = int(img.width * 9 / 16)
                    img = img.crop((0, 0, img.width, target_h))
                img.save(thumb_full_path, format="JPEG", quality=88, optimize=True)
                print(f"[첫 슬라이드 썸네일 생성] {os.path.basename(pdf_path)} -> {thumb_rel_url} ({page_count}P)")
        doc.close()
        if os.path.exists(thumb_full_path):
            return thumb_rel_url, page_count
    except Exception as e:
        print(f"[PDF 썸네일 생성 스킵] {os.path.basename(pdf_path)}: {e}")

    return (thumb_rel_url if os.path.exists(thumb_full_path) else None), page_count

def generate_video_thumbnail_and_duration(video_path, group_key):
    """
    MP4 영상의 첫 클립 대표 프레임(약 1.0초 지점)을 고해상도 썸네일로 추출하고
    영상 재생 시간(MM:SS)을 함께 반환합니다.
    """
    os.makedirs(THUMBS_DIR, exist_ok=True)
    thumb_filename = f"{group_key}.jpg"
    thumb_full_path = os.path.join(THUMBS_DIR, thumb_filename)
    thumb_rel_url = f"assets/thumbs/{thumb_filename}"
    duration_str = None

    try:
        import cv2
        cap = cv2.VideoCapture(video_path)
        if cap.isOpened():
            fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
            frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0
            if fps > 0 and frame_count > 0:
                total_sec = int(round(frame_count / fps))
                mins, secs = divmod(total_sec, 60)
                duration_str = f"{mins:02d}:{secs:02d}"

            need_gen = not os.path.exists(thumb_full_path) or (os.path.getmtime(video_path) > os.path.getmtime(thumb_full_path))
            if need_gen:
                # 첫 클립(약 1.0초 지점 또는 전체의 5% 지점 중 빠른 프레임)에서 가장 선명한 프레임 추출
                target_frame = min(int(fps * 1.0), max(0, int(frame_count - 1)))
                cap.set(cv2.CAP_PROP_POS_FRAMES, target_frame)
                ret, frame = cap.read()
                if not ret or frame is None:
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    ret, frame = cap.read()
                if ret and frame is not None:
                    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    img = Image.fromarray(rgb)
                    if img.width > 960:
                        ratio = 960.0 / img.width
                        img = img.resize((960, int(img.height * ratio)), Image.Resampling.LANCZOS)
                    img.save(thumb_full_path, format="JPEG", quality=88, optimize=True)
                    print(f"[첫 클립 썸네일 생성] {os.path.basename(video_path)} -> {thumb_rel_url} ({duration_str})")
            cap.release()
    except Exception as e:
        print(f"[영상 썸네일 생성 스킵] {os.path.basename(video_path)}: {e}")

    return (thumb_rel_url if os.path.exists(thumb_full_path) else None), duration_str

def scan_docs():
    if not os.path.exists(DOCS_DIR):
        print(f"Docs folder not found: {DOCS_DIR}")
        return []

    # 6대 공식 폴더가 없으면 자동 생성
    for default_folder in [
        "01_프레젠테이션_강의",
        "02_문서_자료",
        "03_행사_영상",
        "04_후기_영상",
        "05_분석_자료",
        "06_각종_양식"
    ]:
        os.makedirs(os.path.join(DOCS_DIR, default_folder), exist_ok=True)

    # 0. 90MB 초과 대용량 파일 자동 최적화/스마트 압축 (GitHub 100MB 제한 원천 방지)
    try:
        from compress_large_files import auto_optimize_docs
        optimized = auto_optimize_docs(DOCS_DIR)
        if optimized > 0:
            print(f"[자동 최적화] {optimized}개 대용량 파일이 GitHub 허용 기준(100MB 이하)으로 안전하게 압축되었습니다.")
    except Exception as e:
        print(f"[대용량 파일 압축 스킵] {e}")

    # 0-1. PPTX 파일 중 PDF가 없는 파일 자동 PDF 변환 (웹 뷰어 프레젠테이션 시작 & 첫 슬라이드 미리보기 100% 보장)
    try:
        import win32com.client
        ppt_app = None
        for r_root, r_dirs, r_files in os.walk(DOCS_DIR):
            if "_original_backups" in r_root:
                continue
            for rf in r_files:
                if rf.lower().endswith('.pptx') and not rf.startswith('~$'):
                    rf_path = os.path.join(r_root, rf)
                    target_pdf = os.path.join(r_root, os.path.splitext(rf)[0] + '.pdf')
                    if not os.path.exists(target_pdf):
                        try:
                            if ppt_app is None:
                                ppt_app = win32com.client.Dispatch("PowerPoint.Application")
                            print(f"[PPTX -> PDF 자동 변환] {rf}...")
                            pres = ppt_app.Presentations.Open(os.path.abspath(rf_path), WithWindow=False)
                            pres.SaveAs(os.path.abspath(target_pdf), 32)
                            pres.Close()
                            print(f" -> 변환 완료: {os.path.basename(target_pdf)}")
                        except Exception as c_err:
                            print(f" -> 변환 실패: {c_err}")
        if ppt_app:
            try:
                ppt_app.Quit()
            except Exception:
                pass
    except Exception:
        pass

    # 기존 resources.json 커스텀 메타데이터 보존
    existing_meta = {}
    if os.path.exists(OUTPUT_JSON):
        try:
            with open(OUTPUT_JSON, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for item in data:
                    if 'id' in item:
                        existing_meta[item['id']] = item
        except Exception as e:
            print(f"Warning: Could not read existing json: {e}")

    # 주요 자료 상세 프리셋
    presets_map = {
        'leadership-masterclass': {
            "title": "변화하는 시대, 리더십의 진짜 온도",
            "subtitle": "앞장서서 빨리 갈 것인가, 함께 끝까지 갈 것인가",
            "badge": "MASTERCLASS",
            "web_deck_url": "presentation.html",
            "slide_count": 16,
            "author": "유정환 교수 / L.REMETTRE",
            "description": "르메뜨레 비즈니스 그룹의 코어 에토스(Core Ethos)를 담은 16개 핵심 슬라이드 프레젠테이션입니다. 구성원과 함께 끝까지 완주하는 진짜 리더십의 온도와 신뢰 마케팅을 다룹니다.",
        },
        'presentation-오크라PPT': {
            "title": "르메뜨레 오크라(Okra) 제품 프레젠테이션",
            "subtitle": "식물성 뮤실리지 오크라 핵심 원료 및 제품 라인업",
            "badge": "PRODUCT DECK",
            "author": "L.REMETTRE R&D / PRODUCT GROUP",
            "description": "식물성 다당류 뮤실리지(Mucilage)가 풍부한 오크라 원료의 핵심 메커니즘과 르메뜨레 프리미엄 제품 라인업을 소개하는 공식 제품 프레젠테이션입니다.",
        },
        'presentation-LReMeTTReNEWPPT': {
            "title": "르메뜨레(L.ReMeTTRe) : 세포의 시간을 되돌리는 과학",
            "subtitle": "REMETTRE (Restore) · 가장 활력 넘치던 본연의 상태로 당신의 삶을 되돌립니다",
            "badge": "OFFICIAL DECK",
            "author": "L.REMETTRE R&D / BRAND GROUP",
            "slide_count": 27,
            "description": "르메뜨레의 세포 과학 메커니즘과 프리미엄 웰니스 브랜드 비전을 담은 27페이지 공식 메인 피치덱입니다. 웹 브라우저에서 바로 시네마틱 프레젠테이션으로 발표할 수 있습니다.",
        },
        'presentation-lremettre사업설명자료세미나용V14': {
            "title": "르메뜨레 사업설명 공식 세미나 피치덱 (V1.4 최신판)",
            "subtitle": "글로벌 웰니스 비즈니스 비전 및 사업설명회 최신 세미나 공식 자료",
            "badge": "LATEST DECK",
            "author": "L.REMETTRE BUSINESS GROUP",
            "slide_count": 50,
            "description": "르메뜨레 비즈니스 모델, 보상 체계 및 글로벌 비전을 다루는 50페이지 공식 사업설명회 최신 V1.4 프레젠테이션입니다. 브라우저에서 바로 열람하거나 F11 전체화면으로 발표할 수 있습니다.",
        },
        'presentation-르메뜨레세미나OfficialV30': {
            "title": "르메뜨레 공식 세미나 프레젠테이션 (Official V3.0)",
            "subtitle": "르메뜨레 브랜드 · 3대 핵심 바이오 솔루션 · 세미나 공식 발표 자료",
            "badge": "OFFICIAL V3.0",
            "author": "L.REMETTRE BUSINESS GROUP",
            "description": "르메뜨레의 핵심 제품 라인업과 과학적 메커니즘, 세미나 핵심 내용을 집약한 Official V3.0 공식 발표 자료입니다. 웹 뷰어 발표 및 PPTX/PDF 다운로드를 모두 지원합니다.",
        },
        'presentation-르메뜨레프레젠테이션v21SP에디션': {
            "title": "르메뜨레 공식 프레젠테이션 (v2.1 SP 에디션)",
            "subtitle": "소이 펩타이드(SP) 초저분자 세포 영양 & 비즈니스 스페셜 에디션",
            "badge": "SP EDITION",
            "author": "L.REMETTRE R&D / BUSINESS GROUP",
            "description": "500 Da 이하 초저분자 소이 펩타이드의 핵심 과학 데이터와 르메뜨레 비즈니스 경쟁력을 집약한 v2.1 SP 스페셜 에디션 프레젠테이션입니다.",
        },
        'review_video-02르메뜨레회원인바디건강다큐HUD비실명판': {
            "title": "르메뜨레 회원 인바디 변화 건강다큐 (HUD 비실명판)",
            "subtitle": "실제 회원 체성분·내장지방·세포영양 데이터 분석 다큐멘터리 후기 영상",
            "badge": "DOCU VIDEO",
            "author": "L.REMETTRE MEDIA GROUP",
            "description": "르메뜨레 3-Step 바이오 솔루션 섭취 전후 실제 회원의 인바디(InBody) 체성분 및 내장지방 변화 추이를 시네마틱 HUD 그래픽으로 정밀 분석한 건강 다큐멘터리 후기 영상입니다.",
        },
        'review_video-04르메뜨레회원혈액검진클린V2비실명판': {
            "title": "르메뜨레 회원 혈액검진 데이터 분석 (클린 V2 비실명판)",
            "subtitle": "실제 회원 혈액검진 지표 개선 사례 시네마틱 브리핑 후기 영상",
            "badge": "CLINICAL VIDEO",
            "author": "L.REMETTRE MEDIA GROUP",
            "description": "실제 회원의 건강검진 혈액 지표 변화를 객관적 수치와 시각 데이터로 알기 쉽게 정리한 클린 V2 브리핑 후기 영상(비실명판)입니다. 브라우저에서 즉시 전체화면 재생이 가능합니다.",
        },
        'event_video-2026년11월르메뜨레데이': {
            "title": "2026년 11월 르메뜨레 데이 (L.REMETTRE DAY) 공식 행사 영상",
            "subtitle": "르메뜨레 비즈니스 그룹 공식 세미나 & 르메뜨레 데이 현장 하이라이트",
            "badge": "EVENT VIDEO",
            "author": "L.REMETTRE MEDIA GROUP",
            "description": "2026년 11월 르메뜨레 데이 공식 행사의 열기와 비전 선포, 파트너십 현장을 생생하게 담은 공식 행사 영상입니다.",
        },
        'event_video-르메뜨레PrivateQingdao여행': {
            "title": "르메뜨레 프라이빗 청도(Qingdao) 본사 투어 & 여행 영상",
            "subtitle": "THE QINGDAO EDITION · 칭다오, 우아한 나흘 VIP 리더스 스페셜",
            "badge": "GLOBAL TOUR",
            "author": "L.REMETTRE MEDIA GROUP",
            "description": "르메뜨레 청도 본사 및 프라이빗 여행의 특별한 순간들을 담은 공식 하이라이트 영상입니다. Full HD 고화질로 최적화되어 웹에서 즉시 재생됩니다.",
        },
        'analysis-소이펩타이드아미노산20종효소가수분해과학적증거및궁합식재료가이드': {
            "title": "소이 펩타이드 아미노산 20종 완전 분석 & 시너지 식재료 가이드",
            "subtitle": "생물학적 효소 가수분해 공법의 과학적 증거(SGS 성적서) 및 궁합 식재료",
            "badge": "BIO REPORT",
            "author": "L.REMETTRE R&D GROUP",
            "description": "중국 SGS 공인 시험성적서(조단백질 98.9%, 펩타이드 97.6%, 500 Da 이하 59.26%, 아미노산 82.07g/100g)를 기반으로 표준 아미노산 20종 보존 원리와 시너지 식재료를 정리한 공식 분석 리포트입니다.",
        },
        'document-소이펩타이드아미노산20종효소가수분해과학적증거및궁합식재료가이드': {
            "title": "소이 펩타이드 아미노산 20종 완전 분석 & 시너지 식재료 가이드",
            "subtitle": "생물학적 효소 가수분해 공법의 과학적 증거(SGS 성적서) 및 궁합 식재료",
            "badge": "BIO GUIDE",
            "author": "L.REMETTRE R&D GROUP",
            "description": "중국 SGS 공인 시험성적서(조단백질 98.9%, 펩타이드 97.6%, 500 Da 이하 59.26%, 아미노산 82.07g/100g)를 기반으로 표준 아미노산 20종 보존 원리와 시너지 식재료를 정리한 공식 가이드 문서입니다.",
        },
        'analysis-01소이펩타이드SGS조단백989펩타이드순도976시험성적서': {
            "title": "소이 펩타이드 SGS 조단백(98.9%) · 펩타이드 순도(97.6%) 시험성적서",
            "subtitle": "SGS 공인 성적서 (WHF25-0000950-01 · 한국어 번역본 & 영문 원본 통합)",
            "badge": "SGS 공인성적서",
            "author": "SGS / 산동캉메이약업유한공사",
            "view_only": True,
            "description": "건조 기준 조단백질 98.9%(기준 ≥90%), 순수 펩타이드 함량 97.6%(기준 ≥80%), 지방 <0.1% 및 미생물·중금속 전 항목 적합 판정을 받은 중국 SGS 공인 시험성적서입니다.",
        },
        'analysis-02소이펩타이드SGS초저분자분자량분포시험성적서': {
            "title": "소이 펩타이드 SGS 초저분자 분자량 분포(500Da 이하 59.26%) 시험성적서",
            "subtitle": "SGS 공인 성적서 (GZF24-0003191-18 · 한국어 번역본 & 중문 원본 통합)",
            "badge": "SGS 공인성적서",
            "author": "SGS / 산동캉메이약업유한공사",
            "view_only": True,
            "description": "500 Da(달톤) 이하 초저분자 비중 59.26%(약 60%), 1,000 Da 이하 80.36%, 전체 수평균 분자량(Mn) 913.39 Da를 검증한 SGS 공인 분자량 분포 시험성적서입니다.",
        },
        'analysis-03소이펩타이드SGS18종아미노산함량시험성적서': {
            "title": "소이 펩타이드 SGS 18종 아미노산 정량 분석(82.07g/100g) 시험성적서",
            "subtitle": "SGS 청도 시험소 공인 성적서 (QDF26-0037147-01 · 산동캉메이 제조)",
            "badge": "SGS 공인성적서",
            "author": "SGS Qingdao / 산동캉메이약업유한공사",
            "view_only": True,
            "description": "생물학적 효소 가수분해 공법으로 보존된 트립토판(0.47g)·시스틴(1.08g) 포함 필수 아미노산 9종 전원 및 총 아미노산 82.07g/100g 함량을 검증한 SGS 공인 성적서입니다.",
        },
        'analysis-04소이펩타이드SGS영양성분당류중금속시험성적서': {
            "title": "소이 펩타이드 SGS 당류 · 포화지방 · 중금속 안전성 시험성적서",
            "subtitle": "SGS 청도 시험소 공인 성적서 (QDF26-0044427-01 · 산동캉메이 제조)",
            "badge": "SGS 공인성적서",
            "author": "SGS Qingdao / 산동캉메이약업유한공사",
            "view_only": True,
            "description": "포화지방 불검출(ND), 과당·자당·맥아당·유당 불검출(ND), 납·카드뮴·수은 불검출(ND) 등 무첨가 순수 펩타이드의 영양 및 안전성을 검증한 2026년 최신 SGS 성적서입니다.",
        },
        'analysis-05소이펩타이드산동캉메이출고품질검사시험성적서': {
            "title": "소이 펩타이드 산동캉메이 출고 품질검사 보고서 (2026·2025 통합)",
            "subtitle": "산동캉메이약업유한공사(SHANDONG KANGMEI) 공식 품질검사 성적서",
            "badge": "품질검사성적서",
            "author": "산동캉메이약업유한공사 품질검사실",
            "view_only": True,
            "description": "산동캉메이약업유한공사(SHANDONG KANGMEI PHARMACEUTICAL CO., LTD.)의 출고 로트별 조단백질·펩타이드 순도·미생물·중금속 및 제3자 정기 위탁검사 항목 적합 판정 보고서입니다.",
        },
        'analysis-06소이펩타이드NonGMO비유전자변형원료인증서': {
            "title": "소이 펩타이드 Non-GMO (비유전자변형 대두 원료 100%) 공식 인증서",
            "subtitle": "산동캉메이약업유한공사(SHANDONG KANGMEI) Non-GMO 원료 보증서",
            "badge": "Non-GMO 인증",
            "author": "산동캉메이약업유한공사",
            "view_only": True,
            "description": "르메뜨레 소이 펩타이드 분말이 100% 비유전자변형(Non-GMO) 대두 단백질 원료만을 사용하여 생산되었음을 공식 보증하는 산동캉메이 품질검사 직인 인증서입니다.",
        },
        'analysis-07풀컵오크라한국SGS납타르색소시험검사성적서': {
            "title": "풀컵 오크라(Full Cup Okra) 한국 SGS 공인 시험·검사성적서",
            "subtitle": "한국에스지에스(주) 식약처 지정 자가품질위탁검사 (R20260413-0168)",
            "badge": "한국SGS 성적서",
            "author": "(주)르메뜨레 / 한국에스지에스(주)",
            "view_only": True,
            "description": "(주)르메뜨레가 의뢰하고 식약처 지정 시험기관 한국에스지에스(주)가 검증한 풀컵 오크라(제조원: ZHEJIANG BAIKEJIAN) 납(0.2 mg/kg)·타르색소 불검출 적합 성적서입니다.",
        },
        'analysis-08오크라블룸한국SGS대장균시험검사성적서': {
            "title": "오크라 블룸(Okra Bloom) 한국 SGS 공인 시험·검사성적서",
            "subtitle": "한국에스지에스(주) 식약처 지정 자가품질위탁검사 (R20260326-0088)",
            "badge": "한국SGS 성적서",
            "author": "(주)르메뜨레 / 한국에스지에스(주)",
            "view_only": True,
            "description": "(주)르메뜨레가 의뢰하고 식약처 지정 시험기관 한국에스지에스(주)가 검증한 오크라 블룸(제조원: ZHEJIANG BAIKEJIAN) 대장균 전 시료 불검출(0,0,0,0,0) 적합 성적서입니다.",
        },
    }
    for pk, pv in presets_map.items():
        existing_meta[pk] = {**existing_meta.get(pk, {}), **pv}

    resources = []
    groups = {}

    for root, dirs, files in os.walk(DOCS_DIR):
        if root == DOCS_DIR or "_original_backups" in root:
            continue
        rel_folder = os.path.relpath(root, DOCS_DIR)
        top_folder = rel_folder.split(os.sep)[0]

        cat_info = CATEGORY_MAP.get(top_folder)
        if not cat_info:
            if "행사" in top_folder:
                cat_info = {"category": "event_video", "name": "행사 영상", "badge": "행사영상"}
            elif "후기" in top_folder or "영상" in top_folder or "video" in top_folder.lower():
                cat_info = {"category": "review_video", "name": "후기 영상", "badge": "후기영상"}
            elif "분석" in top_folder:
                cat_info = {"category": "analysis", "name": "분석 자료", "badge": "데이터분석"}
            elif "문서" in top_folder or "성적서" in top_folder or "브로슈어" in top_folder:
                cat_info = {"category": "document", "name": "문서 자료", "badge": "공식문서"}
            elif "양식" in top_folder or "서식" in top_folder:
                cat_info = {"category": "forms", "name": "각종 양식", "badge": "공식양식"}
            else:
                cat_info = {"category": "presentation", "name": "프레젠테이션&강의", "badge": "강의/발표"}

        for fname in files:
            if fname.startswith('.') or fname.startswith('~$'):
                continue

            file_path = os.path.join(root, fname)
            rel_file_path = os.path.relpath(file_path, SCRIPT_DIR).replace('\\', '/')
            ext = os.path.splitext(fname)[1].lower()

            if ext not in ['.pptx', '.ppt', '.pdf', '.xlsx', '.xls', '.docx', '.png', '.jpg', '.jpeg', '.mp4', '.webm', '.mov', '.m4v']:
                continue

            file_size = os.path.getsize(file_path)
            size_str = format_size(file_size)
            mtime = os.path.getmtime(file_path)
            date_str = datetime.datetime.fromtimestamp(mtime).strftime("%Y-%m-%d")

            stem = os.path.splitext(fname)[0]
            if "leadership" in stem.lower() or "리더십" in stem:
                group_key = "leadership-masterclass"
            else:
                clean_key = re.sub(r'[^a-zA-Z0-9가-힣]', '', stem)
                group_key = f"{cat_info['category']}-{clean_key}"

            if group_key not in groups:
                groups[group_key] = {
                    "id": group_key,
                    "category": cat_info["category"],
                    "category_name": cat_info["name"],
                    "badge": cat_info["badge"],
                    "date": date_str,
                    "version": extract_version(fname),
                    "files": {},
                    "primary_name": clean_title(fname),
                    "pdf_disk_path": None,
                    "video_disk_path": None,
                    "image_rel_path": None,
                }

            if ext in ['.pptx', '.ppt']:
                groups[group_key]["files"]["pptx"] = {
                    "url": rel_file_path,
                    "name": fname,
                    "size": size_str
                }
            elif ext == '.pdf':
                groups[group_key]["files"]["pdf"] = {
                    "url": rel_file_path,
                    "name": fname,
                    "size": size_str
                }
                groups[group_key]["pdf_disk_path"] = file_path
            elif ext in ['.xlsx', '.xls']:
                groups[group_key]["files"]["excel"] = {
                    "url": rel_file_path,
                    "name": fname,
                    "size": size_str
                }
            elif ext in ['.png', '.jpg', '.jpeg']:
                groups[group_key]["files"]["image"] = {
                    "url": rel_file_path,
                    "name": fname,
                    "size": size_str
                }
                groups[group_key]["image_rel_path"] = rel_file_path
            elif ext == '.docx':
                groups[group_key]["files"]["word"] = {
                    "url": rel_file_path,
                    "name": fname,
                    "size": size_str
                }
            elif ext in ['.mp4', '.webm', '.mov', '.m4v']:
                groups[group_key]["files"]["video"] = {
                    "url": rel_file_path,
                    "name": fname,
                    "size": size_str
                }
                groups[group_key]["video_disk_path"] = file_path

    # 최종 결과 빌드 + 첫 슬라이드/첫 클립 썸네일 자동 생성
    for gid, ginfo in groups.items():
        preset = existing_meta.get(gid, {})

        title = preset.get("title", ginfo["primary_name"])
        subtitle = preset.get("subtitle", f"{ginfo['category_name']} 공식 아카이브 자료")
        badge = preset.get("badge", ginfo["badge"])
        desc = preset.get("description", f"{ginfo['category_name']} 공식 자료입니다. 브라우저에서 첫 화면 미리보기 및 전체화면 발표/재생, 보안 다운로드를 지원합니다.")

        thumbnail_url = None
        detected_pages = None
        detected_duration = None

        if ginfo["pdf_disk_path"] and os.path.exists(ginfo["pdf_disk_path"]):
            thumbnail_url, detected_pages = generate_pdf_thumbnail_and_pages(ginfo["pdf_disk_path"], gid)
        elif ginfo["video_disk_path"] and os.path.exists(ginfo["video_disk_path"]):
            thumbnail_url, detected_duration = generate_video_thumbnail_and_duration(ginfo["video_disk_path"], gid)
        elif ginfo["image_rel_path"]:
            thumbnail_url = ginfo["image_rel_path"]

        slide_count = detected_pages or preset.get("slide_count")

        key_points = preset.get("key_points", [
            f"지원 포맷: {', '.join([k.upper() for k in ginfo['files'].keys()])}",
            f"업데이트 일자: {ginfo['date']}",
            "브라우저 즉시 열람/재생 및 보안 인증 다운로드 지원"
        ])

        item = {
            "id": gid,
            "category": ginfo["category"],
            "category_name": ginfo["category_name"],
            "title": title,
            "subtitle": subtitle,
            "version": ginfo["version"],
            "date": ginfo["date"],
            "badge": badge,
            "tags": [ginfo["category_name"], ginfo["version"]],
            "description": desc,
            "key_points": key_points,
            "downloads": ginfo["files"],
            "thumbnail": thumbnail_url,
        }

        is_view_only = bool(preset.get("view_only", False))

        if slide_count:
            item["slide_count"] = slide_count
        if detected_duration:
            item["duration"] = detected_duration
        if "author" in preset:
            item["author"] = preset["author"]
        if is_view_only:
            item["view_only"] = True

        if "web_deck_url" in preset and preset["web_deck_url"] == "presentation.html":
            item["web_deck_url"] = "presentation.html"
        elif "pdf" in ginfo["files"]:
            encoded_pdf = urllib.parse.quote(ginfo["files"]["pdf"]["url"])
            encoded_title = urllib.parse.quote(title)
            ro_param = "&readonly=1" if is_view_only else ""
            item["web_deck_url"] = f"viewer.html?file={encoded_pdf}&title={encoded_title}{ro_param}"
        elif "video" in ginfo["files"]:
            encoded_video = urllib.parse.quote(ginfo["files"]["video"]["url"])
            encoded_title = urllib.parse.quote(title)
            item["web_deck_url"] = f"viewer.html?file={encoded_video}&title={encoded_title}&type=video"

        resources.append(item)

    # 카테고리 정렬 우선순위
    cat_order = {
        "presentation": 0,
        "document": 1,
        "event_video": 2,
        "review_video": 3,
        "analysis": 4,
        "forms": 5,
    }
    resources.sort(key=lambda x: (cat_order.get(x["category"], 9), x["id"]), reverse=False)

    # 미사용(폴더 이동/삭제된) 구버전 썸네일 자동 정리
    active_thumbs = {os.path.basename(r["thumbnail"]) for r in resources if r.get("thumbnail")}
    if os.path.exists(THUMBS_DIR):
        for tf in os.listdir(THUMBS_DIR):
            if tf.endswith('.jpg') and tf not in active_thumbs:
                try:
                    os.remove(os.path.join(THUMBS_DIR, tf))
                except Exception:
                    pass

    os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(resources, f, ensure_ascii=False, indent=2)

    print(f"Successfully synced {len(resources)} resources to {OUTPUT_JSON}")
    for r in resources:
        meta_tag = f"{r.get('slide_count')}P" if r.get('slide_count') else (r.get('duration') or r['version'])
        print(f" - [{r['category_name']}] {r['title']} ({meta_tag} | thumb: {r.get('thumbnail')})")

if __name__ == '__main__':
    scan_docs()
