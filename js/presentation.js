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
  const stage = document.getElementById('slide-stage');
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

  /**
   * 1. 16:9 와이드스크린 반응형 오토 스케일링 (1920x1080 락)
   */
  function fitSlide() {
    if (!stage) return;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // 계산된 스케일 (화면 안에 꽉 차도록 레터박스/필러박스 유지)
    const scaleX = windowWidth / SLIDE_WIDTH;
    const scaleY = windowHeight / SLIDE_HEIGHT;
    const scale = Math.min(scaleX, scaleY);

    stage.style.transform = `scale(${scale})`;
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
      themeToggleBtn.innerHTML = '<span>☀️</span> 화이트 테마';
      localStorage.setItem('lremettre-deck-theme', 'dark');
    } else {
      document.body.classList.remove('theme-dark');
      document.body.classList.add('theme-white');
      themeToggleBtn.innerHTML = '<span>🌙</span> 다크 테마';
      localStorage.setItem('lremettre-deck-theme', 'white');
    }
  }

  function toggleTheme() {
    const isDark = document.body.classList.contains('theme-dark');
    applyTheme(isDark ? 'white' : 'dark');
  }

  /**
   * 6. 전체화면 API 토글
   */
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn('전체화면 전환 실패:', err);
      });
      fullscreenBtn.innerHTML = '<span>↙️</span> 축소';
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        fullscreenBtn.innerHTML = '<span>⛶</span> 전체화면 (F11)';
      }
    }
  }

  /**
   * 7. 썸네일 점프 드로어 제어
   */
  function openDrawer() {
    drawerBackdrop.classList.add('open');
    isDrawerOpen = true;
  }

  function closeDrawer() {
    drawerBackdrop.classList.remove('open');
    isDrawerOpen = false;
  }

  /**
   * 8. 키보드 네비게이션
   */
  function handleKeyDown(e) {
    if (isDrawerOpen) {
      if (e.key === 'Escape') closeDrawer();
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
        break;

      case 'ArrowLeft':
      case 'ArrowUp':
      case 'PageUp':
      case 'Backspace':
        e.preventDefault();
        prevSlide();
        break;

      case 'Home':
        e.preventDefault();
        goToSlide(0);
        break;

      case 'End':
        e.preventDefault();
        goToSlide(slidesData.length - 1);
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
   * 9. 터치 스와이프 제스처 (태블릿 / 모바일)
   */
  let touchStartX = 0;
  let touchStartY = 0;

  function handleTouchStart(e) {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }

  function handleTouchEnd(e) {
    const touchEndX = e.changedTouches[0].screenX;
    const touchEndY = e.changedTouches[0].screenY;
    const diffX = touchEndX - touchStartX;
    const diffY = touchEndY - touchStartY;

    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 40) {
      if (diffX < 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    }
  }

  /**
   * 10. 초기화 및 리스너 등록
   */
  function init() {
    fitSlide();
    window.addEventListener('resize', fitSlide);

    renderSlides();
    initTheme();

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
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    window.addEventListener('popstate', () => {
      const h = window.location.hash;
      if (h) {
        const p = parseInt(h.replace('#', ''), 10);
        if (!isNaN(p) && p >= 1 && p <= slidesData.length) {
          goToSlide(p - 1);
        }
      }
    });

    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) {
        fullscreenBtn.innerHTML = '<span>⛶</span> 전체화면 (F11)';
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
