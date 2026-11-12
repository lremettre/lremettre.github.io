/**
 * 르메뜨레 시네마틱 프레젠테이션 엔진
 * L.REMETTRE Web Pitch Deck Controller
 */

(function () {
  'use strict';

  // Constants & State
  const SLIDE_WIDTH = 1920;
  const SLIDE_HEIGHT = 1080;
  const slidesData = window.LEADERSHIP_SLIDES || [];
  let currentIndex = 0;
  let isDrawerOpen = false;

  // DOM Elements
  const viewportShell = document.getElementById('viewport-shell');
  const stage = document.getElementById('slide-stage');
  const topHud = document.getElementById('top-hud');
  const bottomHud = document.getElementById('bottom-hud');
  const counterCurrent = document.getElementById('counter-current');
  const counterTotal = document.getElementById('counter-total');
  const progressFill = document.getElementById('progress-fill');
  const prevBtn = document.getElementById('btn-prev');
  const nextBtn = document.getElementById('btn-next');
  const themeToggleBtn = document.getElementById('btn-theme-toggle');
  const fullscreenBtn = document.getElementById('btn-fullscreen');
  const drawerBtn = document.getElementById('btn-drawer');
  const drawerBackdrop = document.getElementById('drawer-backdrop');
  const drawerGrid = document.getElementById('drawer-grid');
  const drawerCloseBtn = document.getElementById('btn-drawer-close');

  const vpTimers = [];
  let hudHideTimer = null;
  let hudJustWokeAt = 0;
  let wasInAutoHideMode = false;

  function isNativeFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  function isCompactLandscape() {
    return window.innerWidth > window.innerHeight && window.innerHeight <= 600;
  }

  function isAutoHideMode() {
    return isCompactLandscape() || isNativeFullscreen() || document.body.classList.contains('is-immersive');
  }

  function clearHudTimer() {
    if (hudHideTimer) {
      clearTimeout(hudHideTimer);
      hudHideTimer = null;
    }
  }

  function hideHud() {
    clearHudTimer();
    if (isAutoHideMode() && !isDrawerOpen) {
      document.body.classList.add('hud-hidden');
    }
  }

  function showHud(delayMs) {
    clearHudTimer();
    if (document.body.classList.contains('hud-hidden')) {
      document.body.classList.remove('hud-hidden');
      hudJustWokeAt = Date.now();
    }
    if (isAutoHideMode() && !isDrawerOpen) {
      hudHideTimer = setTimeout(function () {
        if (isAutoHideMode() && !isDrawerOpen) {
          document.body.classList.add('hud-hidden');
        }
      }, delayMs || 3000);
    }
  }

  function updateFullscreenButtonUI() {
    const active = isNativeFullscreen() || document.body.classList.contains('is-immersive');
    fullscreenBtn.innerHTML = active
      ? '<span>↙️</span> 축소'
      : '<span>⛶</span> 전체화면 <span class="key-hint">(F11)</span>';
  }

  function syncHudMode() {
    const auto = isAutoHideMode();
    if (auto && !wasInAutoHideMode) {
      showHud(2500);
    } else if (!auto) {
      clearHudTimer();
      document.body.classList.remove('hud-hidden');
    }
    wasInAutoHideMode = auto;
  }

  /**
   * 1. 16:9 와이드스크린 반응형 오토 스케일링 (1920x1080 락 + 100dvh 대응)
   */
  function fitSlide() {
    if (!stage) return;
    const availW = (viewportShell && viewportShell.clientWidth) || window.innerWidth;
    const availH = (viewportShell && viewportShell.clientHeight) || window.innerHeight;

    // 계산된 스케일 (화면 안에 꽉 차도록 레터박스/필러박스 유지)
    const scaleX = availW / SLIDE_WIDTH;
    const scaleY = availH / SLIDE_HEIGHT;
    const scale = Math.min(scaleX, scaleY);

    stage.style.transform = `scale(${scale})`;
  }

  function checkAndSyncViewport() {
    const fsActive = isNativeFullscreen();
    document.body.classList.toggle('is-fullscreen', fsActive);
    if (fsActive && document.body.classList.contains('is-immersive')) {
      document.body.classList.remove('is-immersive');
    }
    updateFullscreenButtonUI();
    syncHudMode();
    fitSlide();
  }

  function handleViewportChange() {
    checkAndSyncViewport();
    while (vpTimers.length) {
      clearTimeout(vpTimers.pop());
    }
    vpTimers.push(setTimeout(checkAndSyncViewport, 120));
    vpTimers.push(setTimeout(checkAndSyncViewport, 350));
  }

  /**
   * 2. 슬라이드 DOM 생성 렌더러
   */
  function renderSlides() {
    if (!stage || !slidesData.length) return;
    stage.innerHTML = '';

    slidesData.forEach((s, idx) => {
      const slideEl = document.createElement('div');
      slideEl.className = `slide-content-wrapper ${idx === 0 ? 'active' : ''}`;
      slideEl.id = `slide-${idx + 1}`;

      if (s.type === 'cover') {
        // 커버 슬라이드 (슬라이드 1)
        slideEl.classList.add('slide-cover');
        slideEl.innerHTML = `
          <div class="cover-badge">
            <span>✨</span> ${s.tag}
          </div>
          <h1 class="cover-title">${s.title.replace('리더십의 진짜 온도', '<span class="title-accent">리더십의 진짜 온도</span>')}</h1>
          <p class="cover-subtitle">${s.subtitle}</p>
          <div class="cover-footer">
            <div class="cover-group-tag">${s.group}</div>
            <div class="cover-quote-pill">"${s.quote}"</div>
          </div>
        `;
      } else {
        // 일반 대조형 슬라이드 (슬라이드 2 ~ 16)
        slideEl.innerHTML = `
          <div class="slide-header">
            <div class="slide-tag">${s.tag}</div>
            <h2 class="slide-title">${s.title}</h2>
            <p class="slide-subtitle">${s.subtitle}</p>
          </div>

          <div class="cards-row">
            <!-- Left Card -->
            <div class="content-card ${s.card_left.badge_color || 'danger'}">
              <div>
                <div class="card-badge badge-${s.card_left.badge_color || 'danger'}">
                  ${s.card_left.badge}
                </div>
                <h3 class="card-quote-head">${s.card_left.quote}</h3>
                <p class="card-body-text">${s.card_left.body}</p>
              </div>
              <div class="card-result-pill pill-${s.card_left.badge_color || 'danger'}">
                ${s.card_left.result}
              </div>
            </div>

            <!-- Right Card -->
            <div class="content-card ${s.card_right.badge_color || 'success'}">
              <div>
                <div class="card-badge badge-${s.card_right.badge_color || 'success'}">
                  ${s.card_right.badge}
                </div>
                <h3 class="card-quote-head">${s.card_right.quote}</h3>
                <p class="card-body-text">${s.card_right.body}</p>
              </div>
              <div class="card-result-pill pill-${s.card_right.badge_color || 'success'}">
                ${s.card_right.result}
              </div>
            </div>
          </div>

          <!-- Bottom Quote Bar -->
          <div class="ethos-quote-bar">
            <div class="ethos-tag">
              <span>🌿</span> L.REMETTRE Core Ethos
            </div>
            <div class="ethos-text">"${s.quote}"</div>
          </div>
        `;
      }

      stage.appendChild(slideEl);
    });

    counterTotal.textContent = String(slidesData.length).padStart(2, '0');
    renderThumbnails();
  }

  /**
   * 3. 썸네일 그리드 렌더러
   */
  function renderThumbnails() {
    if (!drawerGrid) return;
    drawerGrid.innerHTML = '';

    slidesData.forEach((s, idx) => {
      const item = document.createElement('div');
      item.className = `thumb-item ${idx === currentIndex ? 'current' : ''}`;
      item.dataset.index = idx;

      item.innerHTML = `
        <div class="thumb-index">SLIDE ${String(idx + 1).padStart(2, '0')}</div>
        <div class="thumb-title">${s.type === 'cover' ? '표지: ' + s.title.replace('\n', ' ') : s.title}</div>
      `;

      item.addEventListener('click', () => {
        goToSlide(idx);
        closeDrawer();
      });

      drawerGrid.appendChild(item);
    });
  }

  /**
   * 4. 슬라이드 이동 및 UI 상태 갱신
   */
  function goToSlide(index) {
    if (index < 0 || index >= slidesData.length) return;

    // 슬라이드 DOM 전환
    const allSlides = stage.querySelectorAll('.slide-content-wrapper');
    allSlides.forEach((el, idx) => {
      if (idx === index) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    currentIndex = index;

    // 카운터 갱신
    counterCurrent.textContent = String(currentIndex + 1).padStart(2, '0');

    // 이전/다음 버튼 활성/비활성
    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex === slidesData.length - 1;

    // 프로그레스 바 갱신
    const progress = ((currentIndex + 1) / slidesData.length) * 100;
    progressFill.style.width = `${progress}%`;

    // 썸네일 하이라이트 갱신
    if (drawerGrid) {
      const thumbs = drawerGrid.querySelectorAll('.thumb-item');
      thumbs.forEach((th, idx) => {
        if (idx === currentIndex) {
          th.classList.add('current');
        } else {
          th.classList.remove('current');
        }
      });
    }

    // URL 해시 동기화
    window.location.hash = `#${currentIndex + 1}`;
  }

  function nextSlide() {
    if (currentIndex < slidesData.length - 1) {
      goToSlide(currentIndex + 1);
    }
  }

  function prevSlide() {
    if (currentIndex > 0) {
      goToSlide(currentIndex - 1);
    }
  }

  /**
   * 5. 테마 토글 (화이트 에디션 ☀️ vs 다크 에디션 🌙)
   */
  function initTheme() {
    const savedTheme = localStorage.getItem('lremettre-deck-theme') || 'dark';
    applyTheme(savedTheme);
  }

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.body.classList.remove('theme-white');
      document.body.classList.add('theme-dark');
      themeToggleBtn.innerHTML = '<span>☀️</span> <span class="hide-xs">화이트 </span>테마';
      localStorage.setItem('lremettre-deck-theme', 'dark');
    } else {
      document.body.classList.remove('theme-dark');
      document.body.classList.add('theme-white');
      themeToggleBtn.innerHTML = '<span>🌙</span> <span class="hide-xs">다크 </span>테마';
      localStorage.setItem('lremettre-deck-theme', 'white');
    }
  }

  function toggleTheme() {
    const isDark = document.body.classList.contains('theme-dark');
    applyTheme(isDark ? 'white' : 'dark');
    if (isAutoHideMode()) showHud(3000);
  }

  /**
   * 6. 전체화면 API 토글 (네이티브 전체화면 + 가로 고정 + iOS Safari 몰입형 폴백)
   */
  function toggleImmersiveFallback(forceState) {
    if (typeof forceState === 'boolean') {
      document.body.classList.toggle('is-immersive', forceState);
    } else {
      document.body.classList.toggle('is-immersive');
    }
    updateFullscreenButtonUI();
    if (document.body.classList.contains('is-immersive')) {
      showHud(2500);
    }
    handleViewportChange();
  }

  function toggleFullscreen() {
    if (isNativeFullscreen() || document.body.classList.contains('is-immersive')) {
      if (document.body.classList.contains('is-immersive')) {
        document.body.classList.remove('is-immersive');
      }
      if (isNativeFullscreen()) {
        if (screen.orientation && typeof screen.orientation.unlock === 'function') {
          try { screen.orientation.unlock(); } catch (e) {}
        }
        const exitFs = document.exitFullscreen || document.webkitExitFullscreen;
        if (exitFs) {
          try {
            const p = exitFs.call(document);
            if (p && typeof p.catch === 'function') p.catch(function () {});
          } catch (e) {}
        }
      }
      updateFullscreenButtonUI();
      handleViewportChange();
      return;
    }

    const docEl = document.documentElement;
    const canNativeFs = !!(
      (docEl.requestFullscreen && document.fullscreenEnabled !== false) ||
      (docEl.webkitRequestFullscreen && document.webkitFullscreenEnabled !== false)
    );

    if (canNativeFs) {
      const reqFs = docEl.requestFullscreen || docEl.webkitRequestFullscreen;
      try {
        const p = reqFs.call(docEl);
        if (p && typeof p.then === 'function') {
          p.then(function () {
            if (screen.orientation && screen.orientation.lock) {
              screen.orientation.lock('landscape').catch(function () {});
            }
            updateFullscreenButtonUI();
            showHud(2500);
            handleViewportChange();
          }).catch(function () {
            toggleImmersiveFallback(true);
          });
        } else {
          if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(function () {});
          }
          setTimeout(function () {
            if (!isNativeFullscreen()) {
              toggleImmersiveFallback(true);
            } else {
              updateFullscreenButtonUI();
              showHud(2500);
              handleViewportChange();
            }
          }, 150);
        }
      } catch (err) {
        toggleImmersiveFallback(true);
      }
    } else {
      toggleImmersiveFallback();
    }
  }

  /**
   * 7. 썸네일 점프 드로어 제어
   */
  function openDrawer() {
    clearHudTimer();
    document.body.classList.remove('hud-hidden');
    drawerBackdrop.classList.add('open');
    isDrawerOpen = true;
  }

  function closeDrawer() {
    drawerBackdrop.classList.remove('open');
    isDrawerOpen = false;
    if (isAutoHideMode()) {
      showHud(2500);
    }
  }

  /**
   * 8. 키보드 네비게이션
   */
  function handleKeyDown(e) {
    if (isDrawerOpen) {
      if (e.key === 'Escape') closeDrawer();
      return;
    }

    if (e.key === 'Escape' && document.body.classList.contains('is-immersive')) {
      document.body.classList.remove('is-immersive');
      updateFullscreenButtonUI();
      handleViewportChange();
      return;
    }

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
      case 'PageDown':
      case ' ':
      case 'Enter':
        e.preventDefault();
        nextSlide();
        if (isAutoHideMode()) hideHud();
        break;

      case 'ArrowLeft':
      case 'ArrowUp':
      case 'PageUp':
      case 'Backspace':
        e.preventDefault();
        prevSlide();
        if (isAutoHideMode()) hideHud();
        break;

      case 'Home':
        e.preventDefault();
        goToSlide(0);
        if (isAutoHideMode()) hideHud();
        break;

      case 'End':
        e.preventDefault();
        goToSlide(slidesData.length - 1);
        if (isAutoHideMode()) hideHud();
        break;

      case 't':
      case 'T':
        toggleTheme();
        break;

      case 'f':
      case 'F':
        toggleFullscreen();
        break;

      case 'g':
      case 'G':
      case 'm':
      case 'M':
        openDrawer();
        break;

      default:
        break;
    }
  }

  /**
   * 9. 터치 스와이프 제스처 & 스테이지 탭 HUD 토글 (태블릿 / 모바일)
   */
  let touchStartX = 0;
  let touchStartY = 0;
  let touchClientX = 0;
  let touchClientY = 0;
  let touchStartAt = 0;
  let lastTouchTime = 0;
  let wasMultiTouch = false;

  function handleTouchStart(e) {
    lastTouchTime = Date.now();
    if (e.touches.length > 1) {
      wasMultiTouch = true;
      return;
    }
    wasMultiTouch = false;
    touchStartAt = lastTouchTime;
    const t = e.changedTouches[0];
    touchStartX = t.screenX;
    touchStartY = t.screenY;
    touchClientX = t.clientX;
    touchClientY = t.clientY;
  }

  function handleTouchMove(e) {
    if (e.touches.length > 1) {
      wasMultiTouch = true;
    }
  }

  function handleTouchEnd(e) {
    lastTouchTime = Date.now();
    if (wasMultiTouch) {
      if (e.touches.length === 0) wasMultiTouch = false;
      return;
    }
    if (isDrawerOpen) return;

    const t = e.changedTouches[0];
    const moveDist = Math.hypot(t.clientX - touchClientX, t.clientY - touchClientY);
    const elapsed = lastTouchTime - touchStartAt;
    const inHudOrOverlay = !!(e.target && e.target.closest && e.target.closest('.top-hud, .bottom-hud, .drawer-backdrop, .pwa-install-bar'));

    if (moveDist < 12 && elapsed < 500) {
      if (!inHudOrOverlay && isAutoHideMode()) {
        if (document.body.classList.contains('hud-hidden')) {
          showHud(3000);
        } else {
          hideHud();
        }
      }
      return;
    }

    if (window.visualViewport && window.visualViewport.scale > 1.05) return;

    const diffX = t.screenX - touchStartX;
    const diffY = t.screenY - touchStartY;

    if (Math.abs(diffX) > Math.abs(diffY) * 1.2 && Math.abs(diffX) > 40) {
      if (diffX < 0) {
        nextSlide();
      } else {
        prevSlide();
      }
      if (isAutoHideMode()) hideHud();
    }
  }

  /**
   * 10. 초기화 및 리스너 등록
   */
  function init() {
    renderSlides();
    initTheme();
    handleViewportChange();

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleViewportChange);
    document.addEventListener('fullscreenchange', handleViewportChange);
    document.addEventListener('webkitfullscreenchange', handleViewportChange);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
    }

    // 초기 해시 확인 (#3 이면 3번째 슬라이드로 바로 이동)
    const hash = window.location.hash;
    if (hash && hash.startsWith('#')) {
      const pageNum = parseInt(hash.replace('#', ''), 10);
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= slidesData.length) {
        goToSlide(pageNum - 1);
      } else {
        goToSlide(0);
      }
    } else {
      goToSlide(0);
    }

    // Guard against synthetic click hitting newly-revealed HUD buttons on wake tap
    [topHud, bottomHud].forEach((el) => {
      if (!el) return;
      el.addEventListener('click', (e) => {
        if (Date.now() - hudJustWokeAt < 350) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (isAutoHideMode()) {
          showHud(3000);
        }
      }, true);
    });

    // Event Listeners
    prevBtn.addEventListener('click', prevSlide);
    nextBtn.addEventListener('click', nextSlide);
    themeToggleBtn.addEventListener('click', toggleTheme);
    fullscreenBtn.addEventListener('click', toggleFullscreen);
    drawerBtn.addEventListener('click', openDrawer);
    drawerCloseBtn.addEventListener('click', closeDrawer);
    drawerBackdrop.addEventListener('click', (e) => {
      if (e.target === drawerBackdrop) closeDrawer();
    });

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    // Desktop mouse wake & click toggle on stage
    let lastMouseX = -1;
    let lastMouseY = -1;
    window.addEventListener('mousemove', (e) => {
      if (Date.now() - lastTouchTime < 800) return;
      if (!isAutoHideMode() || isDrawerOpen) return;
      if (Math.abs(e.clientX - lastMouseX) < 3 && Math.abs(e.clientY - lastMouseY) < 3) return;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      showHud(3000);
    }, { passive: true });

    if (viewportShell) {
      viewportShell.addEventListener('click', (e) => {
        if (Date.now() - lastTouchTime < 800) return;
        if (!isAutoHideMode() || isDrawerOpen) return;
        if (e.target && e.target.closest && e.target.closest('.top-hud, .bottom-hud, .drawer-backdrop, .pwa-install-bar')) return;
        if (document.body.classList.contains('hud-hidden')) {
          showHud(3000);
        } else {
          hideHud();
        }
      });
    }

    window.addEventListener('popstate', () => {
      const h = window.location.hash;
      if (h) {
        const p = parseInt(h.replace('#', ''), 10);
        if (!isNaN(p) && p >= 1 && p <= slidesData.length) {
          goToSlide(p - 1);
        }
      }
    });
  }

  // Run on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
