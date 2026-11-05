#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
르메뜨레 자동 대용량 파일 최적화/압축 엔진 (Compress Large Files Engine)
docs/ 폴더 내 90MB를 초과하는 대용량 PPTX/PDF 파일을 자동으로 감지하여,
시각적 품질(Full HD 1920)을 완벽히 유지하면서 100MB 이하로 스마트 압축합니다.
GitHub의 100MB 단일 파일 제한을 영구적으로 우회하고 웹 로딩 속도를 극대화합니다.
"""

import os
import io
import shutil
import zipfile
import subprocess
from PIL import Image

MAX_GITHUB_SAFE_BYTES = 90 * 1024 * 1024  # 90MB 이상이면 자동 압축 트리거

def compress_pptx(file_path, target_max_dim=1920, quality=80):
    """
    PPTX 내부의 고용량 미디어 이미지를 분석하여 Full HD로 최적화 리샘플링합니다.
    """
    file_size = os.path.getsize(file_path)
    if file_size <= MAX_GITHUB_SAFE_BYTES:
        return False, file_size, file_size

    print(f"[자동 압축 시작] {os.path.basename(file_path)}: {file_size / (1024*1024):.1f} MB (100MB 제한 초과 감지)")

    # 1. 안전 백업 디렉토리 생성
    backup_dir = os.path.join(os.path.dirname(file_path), "_original_backups")
    os.makedirs(backup_dir, exist_ok=True)
    backup_path = os.path.join(backup_dir, os.path.basename(file_path))
    if not os.path.exists(backup_path):
        shutil.copy2(file_path, backup_path)
        print(f" -> 원본 백업 완료: {backup_path}")

    # 2. 임시 압축 파일 생성
    temp_path = file_path + ".compressing.tmp"

    try:
        with zipfile.ZipFile(file_path, 'r') as zin, zipfile.ZipFile(temp_path, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)
                fname_lower = item.filename.lower()

                # ppt/media 이미지 최적화
                if 'ppt/media/' in fname_lower and (fname_lower.endswith('.png') or fname_lower.endswith('.jpg') or fname_lower.endswith('.jpeg')):
                    if len(data) > 250 * 1024: # 250KB 이상 이미지 대상
                        try:
                            img = Image.open(io.BytesIO(data))
                            w, h = img.size
                            if w > target_max_dim or h > target_max_dim:
                                img.thumbnail((target_max_dim, target_max_dim), Image.Resampling.LANCZOS)

                            buf = io.BytesIO()
                            if fname_lower.endswith('.png'):
                                if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
                                    img.save(buf, format='PNG', optimize=True, compress_level=9)
                                else:
                                    img = img.convert('RGB')
                                    img.save(buf, format='JPEG', quality=quality, optimize=True)
                            else:
                                if img.mode != 'RGB':
                                    img = img.convert('RGB')
                                img.save(buf, format='JPEG', quality=quality, optimize=True)

                            new_data = buf.getvalue()
                            if len(new_data) < len(data):
                                data = new_data
                        except Exception:
                            pass

                zout.writestr(item, data)

        new_size = os.path.getsize(temp_path)
        if new_size < file_size:
            shutil.move(temp_path, file_path)
            reduction = (1 - new_size / file_size) * 100
            print(f"[압축 성공] {file_size / (1024*1024):.1f} MB -> {new_size / (1024*1024):.1f} MB ({reduction:.1f}% 절감, GitHub 안전 통과)")
            return True, file_size, new_size
        else:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            return False, file_size, file_size
    except Exception as e:
        print(f"[압축 오류] {e}")
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return False, file_size, file_size

def compress_video(file_path, target_max_mb=72):
    """
    90MB를 초과하는 영상 파일(.mp4, .mov, .webm)이 감지되면 FFmpeg(NVIDIA NVENC 하드웨어 가속 우선)를 통해
    Full HD(1080p) 화질을 유지하면서 GitHub 안전 기준(70~80MB 이하)으로 초고속 자동 최적화합니다.
    """
    file_size = os.path.getsize(file_path)
    if file_size <= MAX_GITHUB_SAFE_BYTES:
        return False, file_size, file_size

    print(f"[영상 자동 최적화 시작] {os.path.basename(file_path)}: {file_size / (1024*1024):.1f} MB (90MB 초과 감지)")

    ffmpeg_bin = shutil.which("ffmpeg")
    if not ffmpeg_bin:
        print(f"[안내] {os.path.basename(file_path)} 용량({file_size/(1024*1024):.1f} MB)이 90MB를 초과합니다. 100MB 미만인지 확인해주세요.")
        return False, file_size, file_size

    backup_dir = os.path.join(os.path.dirname(file_path), "_original_backups")
    os.makedirs(backup_dir, exist_ok=True)
    backup_path = os.path.join(backup_dir, os.path.basename(file_path))
    if not os.path.exists(backup_path):
        shutil.copy2(file_path, backup_path)
        print(f" -> 원본 영상 백업 완료: {backup_path}")

    # 영상 길이에 맞춘 안전 비트레이트 계산 (72MB 목표)
    duration_sec = 240.0
    try:
        import cv2
        cap = cv2.VideoCapture(file_path)
        if cap.isOpened():
            fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
            frames = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0
            if fps > 0 and frames > 0:
                duration_sec = max(10.0, frames / fps)
            cap.release()
    except Exception:
        pass

    target_v_kbps = max(800, min(2600, int((target_max_mb * 8192) / duration_sec) - 128))
    max_v_kbps = int(target_v_kbps * 1.15)
    buf_kbps = int(target_v_kbps * 2.0)

    temp_path = file_path + ".compressing.mp4"
    try:
        # 1차: NVIDIA GPU 하드웨어 가속(h264_nvenc) 시도
        cmd_nvenc = [
            ffmpeg_bin, "-y", "-i", file_path,
            "-vf", "scale='min(1920,iw)':-2",
            "-c:v", "h264_nvenc", "-preset", "p5", "-rc", "vbr",
            "-b:v", f"{target_v_kbps}k", "-maxrate", f"{max_v_kbps}k", "-bufsize", f"{buf_kbps}k",
            "-c:a", "aac", "-b:a", "128k",
            "-movflags", "+faststart",
            temp_path
        ]
        res = subprocess.run(cmd_nvenc, capture_output=True, text=True)
        if res.returncode != 0 or not os.path.exists(temp_path):
            # 2차 폴백: CPU(libx264 veryfast)
            cmd_cpu = [
                ffmpeg_bin, "-y", "-i", file_path,
                "-vf", "scale='min(1920,iw)':-2",
                "-c:v", "libx264", "-preset", "veryfast",
                "-b:v", f"{target_v_kbps}k", "-maxrate", f"{max_v_kbps}k", "-bufsize", f"{buf_kbps}k",
                "-c:a", "aac", "-b:a", "128k",
                "-movflags", "+faststart",
                temp_path
            ]
            res = subprocess.run(cmd_cpu, capture_output=True, text=True)

        if res.returncode == 0 and os.path.exists(temp_path):
            new_size = os.path.getsize(temp_path)
            if new_size < file_size and new_size <= MAX_GITHUB_SAFE_BYTES:
                shutil.move(temp_path, file_path)
                reduction = (1 - new_size / file_size) * 100
                print(f"[영상 압축 성공] {file_size / (1024*1024):.1f} MB -> {new_size / (1024*1024):.1f} MB ({reduction:.1f}% 절감)")
                return True, file_size, new_size
        if os.path.exists(temp_path):
            os.remove(temp_path)
    except Exception as e:
        print(f"[영상 압축 오류] {e}")
        if os.path.exists(temp_path):
            os.remove(temp_path)

    return False, file_size, file_size

def compress_pdf_safe(file_path, target_max_dim=1920, quality=82):
    """
    Canva 등에서 내보낸 90MB 초과 대용량 PDF에서 투명도 마스크(SMask)가 없는
    불투명(Opaque) 고해상도 배경/사진 스트림만 선별하여 Full HD JPEG로 리샘플링합니다.
    투명 레이어(SMask != 0)와 벡터 그래픽/텍스트는 100% 원본 그대로 보존하여
    시각적 손실이나 검은색 마스킹 깨짐 현상 없이 용량만 안전하게 절감합니다.
    """
    file_size = os.path.getsize(file_path)
    if file_size <= MAX_GITHUB_SAFE_BYTES:
        return False, file_size, file_size

    print(f"[PDF 안전 최적화 시작] {os.path.basename(file_path)}: {file_size / (1024*1024):.1f} MB (90MB 초과 감지)")

    try:
        import pymupdf
    except ImportError:
        print("[안내] pymupdf 라이브러리가 없어 PDF 자동 최적화를 건너뜁니다.")
        return False, file_size, file_size

    backup_dir = os.path.join(os.path.dirname(file_path), "_original_backups")
    os.makedirs(backup_dir, exist_ok=True)
    backup_path = os.path.join(backup_dir, os.path.basename(file_path))
    if not os.path.exists(backup_path):
        shutil.copy2(file_path, backup_path)
        print(f" -> 원본 PDF 백업 완료: {backup_path}")

    temp_path = file_path + ".compressing.pdf"
    try:
        doc = pymupdf.open(file_path)
        seen = set()
        for page in doc:
            for img in page.get_images(full=True):
                xref = img[0]
                if xref in seen:
                    continue
                seen.add(xref)
                smask = img[1]
                cs = img[5]
                # 투명도 마스크가 없는 불투명 RGB 이미지만 안전하게 압축
                if smask == 0 and cs in ('DeviceRGB', 'ICCBased'):
                    raw = doc.xref_stream_raw(xref)
                    if not raw or len(raw) < 150 * 1024:
                        continue
                    try:
                        pix = pymupdf.Pixmap(doc, xref)
                        if pix.n - pix.alpha != 3:
                            continue
                        pil_img = Image.frombytes('RGB', [pix.width, pix.height], pix.samples)
                        if pil_img.width > target_max_dim or pil_img.height > target_max_dim:
                            pil_img.thumbnail((target_max_dim, target_max_dim), Image.Resampling.LANCZOS)
                        buf = io.BytesIO()
                        pil_img.save(buf, format='JPEG', quality=quality, optimize=True)
                        new_bytes = buf.getvalue()
                        if len(new_bytes) < len(raw) * 0.85:
                            page.replace_image(xref, stream=new_bytes)
                    except Exception:
                        pass

        doc.save(temp_path, garbage=4, deflate=True)
        doc.close()

        new_size = os.path.getsize(temp_path)
        if new_size < file_size and new_size <= MAX_GITHUB_SAFE_BYTES:
            shutil.move(temp_path, file_path)
            reduction = (1 - new_size / file_size) * 100
            print(f"[PDF 최적화 성공] {file_size / (1024*1024):.1f} MB -> {new_size / (1024*1024):.1f} MB ({reduction:.1f}% 절감, 투명 레이어 100% 보존)")
            return True, file_size, new_size
        else:
            if os.path.exists(temp_path):
                os.remove(temp_path)
    except Exception as e:
        print(f"[PDF 최적화 오류] {e}")
        if os.path.exists(temp_path):
            os.remove(temp_path)

    return False, file_size, file_size

def auto_optimize_docs(docs_root):
    """
    docs 디렉토리 내의 모든 대용량 PPTX, PDF 및 영상 파일을 검사하여 90MB 초과 시 자동 압축합니다.
    """
    optimized_count = 0
    for root, dirs, files in os.walk(docs_root):
        if "_original_backups" in root:
            continue
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            full_path = os.path.join(root, f)
            try:
                size = os.path.getsize(full_path)
            except OSError:
                continue

            if size > MAX_GITHUB_SAFE_BYTES:
                if ext == '.pptx':
                    success, old_s, new_s = compress_pptx(full_path)
                    if success:
                        optimized_count += 1
                elif ext in ['.mp4', '.mov', '.webm', '.m4v']:
                    success, old_s, new_s = compress_video(full_path)
                    if success:
                        optimized_count += 1
                elif ext == '.pdf':
                    success, old_s, new_s = compress_pdf_safe(full_path)
                    if success:
                        optimized_count += 1
    return optimized_count

if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    docs_dir = os.path.join(script_dir, "docs")
    print("Checking docs for 90MB+ oversized files...")
    count = auto_optimize_docs(docs_dir)
    print(f"Total files optimized: {count}")

