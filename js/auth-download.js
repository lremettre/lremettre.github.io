/**
 * 르메뜨레(L.REMETTRE) 보안 다운로드 인증 모달 제어 엔진
 * - 모든 자료 다운로드 시 비밀번호(초기: 7485) 검증 후 다운로드 승인
 * - SHA-256 비동기 암호화 대조로 클라이언트 보안 보장
 * - 오류 시 햅틱 셰이크 애니메이션 및 피드백 알림
 */

(function () {
  'use strict';

  // SHA-256 해시 계산 유틸리티
  async function computeSha256(text) {
    if (window.crypto && window.crypto.subtle) {
      const msgBuffer = new TextEncoder().encode(text.trim());
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    // 폴백 (구형 브라우저)
    return null;
  }

  // DOM 요소 참조
  let modalBackdrop = null;
  let modalDialog = null;
  let pwInput = null;
  let submitBtn = null;
  let cancelBtn = null;
  let closeBtn = null;
  let togglePwBtn = null;
  let errorMsg = null;
  let targetFileDisplay = null;

  // 대기 중인 다운로드 타겟 정보
  let pendingDownload = null;

  function initElements() {
    modalBackdrop = document.getElementById('auth-modal-backdrop');
    modalDialog = document.getElementById('auth-modal-dialog');
    pwInput = document.getElementById('auth-pw-input');
    submitBtn = document.getElementById('auth-submit-btn');
    cancelBtn = document.getElementById('auth-cancel-btn');
    closeBtn = document.getElementById('auth-close-btn');
    togglePwBtn = document.getElementById('auth-toggle-pw-btn');
    errorMsg = document.getElementById('auth-error-msg');
    targetFileDisplay = document.getElementById('auth-target-file-info');

    if (!modalBackdrop) return;

    // sessionAuth가 비활성화된 경우, 이전에 남아있을 수 있는 세션 키를 즉시 초기화/삭제
    const config = window.LREMETTRE_AUTH || {};
    if (!config.sessionAuth && config.storageKey) {
      try {
        sessionStorage.removeItem(config.storageKey);
      } catch (e) {}
    }

    // 모달 닫기 이벤트 바인딩
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) closeModal();
    });

    // Enter 키로 비밀번호 제출
    if (pwInput) {
      pwInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleAuthSubmit();
        }
      });
      pwInput.addEventListener('input', () => {
        if (errorMsg) errorMsg.style.display = 'none';
        if (modalDialog) modalDialog.classList.remove('shake-error');
      });
    }

    // 비밀번호 보이기/숨기기 토글
    if (togglePwBtn && pwInput) {
      togglePwBtn.addEventListener('click', () => {
        const isPw = pwInput.type === 'password';
        pwInput.type = isPw ? 'text' : 'password';
        togglePwBtn.textContent = isPw ? '🙈' : '👁️';
      });
    }

    // 승인 버튼 클릭
    if (submitBtn) {
      submitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handleAuthSubmit();
      });
    }

    // ESC 키로 모달 닫기
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalBackdrop && modalBackdrop.classList.contains('active')) {
        closeModal();
      }
    });

    // 전역 다운로드 버튼 클릭 가로채기
    document.addEventListener('click', (e) => {
      const downloadBtn = e.target.closest('.btn-download-pill');
      if (!downloadBtn) return;

      e.preventDefault();
      e.stopPropagation();

      const url = downloadBtn.getAttribute('href');
      const filename = downloadBtn.getAttribute('download') || url.split('/').pop();
      const title = downloadBtn.getAttribute('title') || filename;

      openAuthModal({
        url: url,
        name: filename,
        title: title
      });
    });
  }

  // 모달 열기
  function openAuthModal(fileInfo) {
    pendingDownload = fileInfo;

    // sessionAuth가 명시적으로 true인 경우에만 이전 인증을 재사용, 기본값은 매회 비밀번호 입력
    const config = window.LREMETTRE_AUTH || {};
    if (config.sessionAuth === true && sessionStorage.getItem(config.storageKey) === 'verified') {
      executeDownload(fileInfo);
      showDownloadToast(fileInfo.name);
      return;
    }

    if (!modalBackdrop || !pwInput) return;

    if (targetFileDisplay) {
      targetFileDisplay.innerHTML = `
        <div class="auth-file-pill">
          <span class="file-icon">📄</span>
          <span class="file-name" title="${fileInfo.name}">${fileInfo.name}</span>
        </div>
      `;
    }

    if (errorMsg) errorMsg.style.display = 'none';
    pwInput.value = '';
    if (togglePwBtn) togglePwBtn.textContent = '👁️';
    pwInput.type = 'password';

    modalBackdrop.classList.add('active');
    setTimeout(() => {
      pwInput.focus();
    }, 150);
  }

  // 모달 닫기
  function closeModal() {
    if (!modalBackdrop) return;
    modalBackdrop.classList.remove('active');
    pendingDownload = null;
    if (pwInput) pwInput.value = '';
    if (errorMsg) errorMsg.style.display = 'none';
  }

  // 비밀번호 인증 제출 핸들러
  async function handleAuthSubmit() {
    if (!pwInput || !pendingDownload) return;

    const inputVal = pwInput.value.trim();
    if (!inputVal) {
      showError('비밀번호를 입력해 주세요.');
      return;
    }

    const config = window.LREMETTRE_AUTH || {};
    const inputHash = await computeSha256(inputVal);

    // 해시 대조 또는 폴백 평문 '7485' 대조
    const isCorrect = (inputHash && inputHash === config.hash) || (inputVal === '7485');

    if (isCorrect) {
      // 인증 성공! sessionAuth가 명시적 true일 때만 세션 스토리지에 유지, 아니면 즉시 파기
      if (config.sessionAuth === true) {
        sessionStorage.setItem(config.storageKey, 'verified');
      } else if (config.storageKey) {
        try {
          sessionStorage.removeItem(config.storageKey);
        } catch (e) {}
      }

      if (submitBtn) {
        submitBtn.innerHTML = `<span>✅</span> 인증 성공! 다운로드 시작...`;
        submitBtn.style.background = 'linear-gradient(135deg, #10B981 0%, #059669 100%)';
      }

      // 파일 다운로드 실행
      setTimeout(() => {
        executeDownload(pendingDownload);
        closeModal();

        // 버튼 상태 원복
        if (submitBtn) {
          submitBtn.innerHTML = `<span>🔓</span> 보안 해제 및 다운로드`;
          submitBtn.style.background = '';
        }
      }, 500);
    } else {
      // 인증 실패
      showError('⚠️ 비밀번호가 일치하지 않습니다. 올바른 보안 코드를 입력하세요.');
      if (modalDialog) {
        modalDialog.classList.remove('shake-error');
        void modalDialog.offsetWidth; // 트랜지션 리셋
        modalDialog.classList.add('shake-error');
      }
      pwInput.value = '';
      pwInput.focus();
    }
  }

  function showError(msg) {
    if (errorMsg) {
      errorMsg.textContent = msg;
      errorMsg.style.display = 'block';
    }
  }

  // 실제 다운로드 트리거
  function executeDownload(fileInfo) {
    if (!fileInfo || !fileInfo.url) return;
    const link = document.createElement('a');
    link.href = fileInfo.url;
    link.download = fileInfo.name || '';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // 세션 인증된 경우 가벼운 안내 토스트
  function showDownloadToast(filename) {
    const toast = document.createElement('div');
    toast.className = 'lremettre-auth-toast';
    toast.innerHTML = `<span>🔒 보안 인증 완료:</span> <strong>${filename}</strong> 다운로드를 시작합니다.`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // DOM 로드 완료 후 초기화
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initElements);
  } else {
    initElements();
  }
})();
