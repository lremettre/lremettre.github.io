/**
 * 르메뜨레 공식 디지털 아카이브 허브 (L.REMETTRE White Editorial & Pastel Stage Controller v2.0)
 * - 6대 공식 카테고리 대시보드 요약 카드 자동 집계 및 연동
 * - 모든 PPT/PDF 첫 슬라이드 표지 썸네일 & 모든 영상 첫 클립 라이브 미리보기 렌더링
 * - PC / 태블릿 / 모바일 100% 반응형 인터랙션
 */

(function () {
  'use strict';

  let resourcesData = [];
  let currentCategory = 'all';
  let searchQuery = '';

  const gridContainer = document.getElementById('resources-grid');
  const summaryGrid = document.getElementById('summary-cards-grid');
  const searchInput = document.getElementById('search-input');
  const headerTotalCount = document.getElementById('header-total-count');

  // 히어로 라이브 스테이지 요소
  const stageCanvas = document.getElementById('stage-canvas');
  const stagePrevBtn = document.getElementById('stage-prev-btn');
  const stageNextBtn = document.getElementById('stage-next-btn');
  const stageCurrentIdx = document.getElementById('stage-current-idx');
  const stageTotalIdx = document.getElementById('stage-total-idx');
  const stageProgressFill = document.getElementById('stage-progress-fill');
  const tabDeckV30Seminar = document.getElementById('tab-deck-v30-seminar');
  const tabDeckSpEdition = document.getElementById('tab-deck-sp-edition');
  const tabDeckCellScience = document.getElementById('tab-deck-cell-science');
  const btnTopLaunch = document.getElementById('btn-top-launch');
  const heroMainCta = document.getElementById('hero-main-cta');

  // 6대 공식 카테고리 정의 (레퍼런스 파스텔 6종 매핑)
  const CATEGORY_DEFINITIONS = [
    {
      key: 'presentation',
      name: '프레젠테이션&강의',
      eyebrow: 'PRESENTATION',
      tone: 'tone-pink',
      icon: '📊',
      defaultThumb: 'assets/thumbs/presentation-르메뜨레세미나OfficialV32.jpg'
    },
    {
      key: 'document',
      name: '문서 자료',
      eyebrow: 'DOCUMENTS',
      tone: 'tone-sky',
      icon: '📑',
      defaultThumb: ''
    },
    {
      key: 'event_video',
      name: '행사 영상',
      eyebrow: 'EVENT MEDIA',
      tone: 'tone-peach',
      icon: '🎥',
      defaultThumb: ''
    },
    {
      key: 'review_video',
      name: '후기 영상',
      eyebrow: 'REVIEW CLIP',
      tone: 'tone-yellow',
      icon: '🎬',
      defaultThumb: 'assets/thumbs/review_video-02르메뜨레회원인바디건강다큐HUD비실명판.jpg'
    },
    {
      key: 'analysis',
      name: '분석 자료',
      eyebrow: 'BIO ANALYSIS',
      tone: 'tone-rose',
      icon: '📈',
      defaultThumb: ''
    },
    {
      key: 'forms',
      name: '각종 양식',
      eyebrow: 'OFFICIAL FORMS',
      tone: 'tone-lavender',
      icon: '📋',
      defaultThumb: ''
    },
    {
      key: 'image',
      name: '이미지 자료',
      eyebrow: 'IMAGE GALLERY',
      tone: 'tone-mint',
      icon: '🖼️',
      defaultThumb: ''
    }
  ];

  // 히어로 스테이지 대표 프리뷰 슬라이드 목록 (1순위: Official V3.0)
  const HERO_STAGE_DECKS = [
    {
      key: 'v30-seminar',
      tag: 'OFFICIAL SEMINAR V3.2 · 64P',
      title: '르메뜨레 공식 세미나 프레젠테이션 (Official V3.2)',
      pages: 64,
      thumb: 'assets/thumbs/presentation-르메뜨레세미나OfficialV32.jpg',
      viewerUrl: 'viewer.html?file=' + encodeURIComponent('docs/01_프레젠테이션_강의/르메뜨레 세미나_Official_V3.2.pdf') + '&title=' + encodeURIComponent('르메뜨레 공식 세미나 프레젠테이션 (Official V3.2)')
    },
    {
      key: 'sp-edition',
      tag: 'SP SPECIAL EDITION · 30P',
      title: '르메뜨레 공식 프레젠테이션 (v2.1 SP 에디션)',
      pages: 30,
      thumb: 'assets/thumbs/presentation-르메뜨레프레젠테이션v21SP에디션.jpg',
      viewerUrl: 'viewer.html?file=' + encodeURIComponent('docs/01_프레젠테이션_강의/르메뜨레 프레젠테이션_v2.1_SP에디션.pdf') + '&title=' + encodeURIComponent('르메뜨레 공식 프레젠테이션 (v2.1 SP 에디션)')
    },
    {
      key: 'cell-science',
      tag: 'OFFICIAL MAIN DECK · 27P',
      title: '르메뜨레(L.ReMeTTRe) : 세포의 시간을 되돌리는 과학',
      pages: 27,
      thumb: 'assets/thumbs/presentation-LReMeTTReNEWPPT.jpg',
      viewerUrl: 'viewer.html?file=' + encodeURIComponent('docs/01_프레젠테이션_강의/L.ReMeTTRe_NEW_PPT.pdf') + '&title=' + encodeURIComponent('르메뜨레(L.ReMeTTRe) : 세포의 시간을 되돌리는 과학')
    },
    {
      key: 'leadership',
      tag: 'LEADERSHIP MASTERCLASS · 16P',
      title: '변화하는 시대, 리더십의 진짜 온도',
      pages: 16,
      thumb: 'assets/thumbs/leadership-masterclass.jpg',
      viewerUrl: 'presentation.html'
    },
    {
      key: 'v14-business',
      tag: 'BUSINESS PITCH DECK V1.4 · 50P',
      title: '르메뜨레 사업설명 공식 세미나 피치덱 (V1.4 최신판)',
      pages: 50,
      thumb: 'assets/thumbs/presentation-lremettre사업설명자료세미나용V14.jpg',
      viewerUrl: 'viewer.html?file=' + encodeURIComponent('docs/01_프레젠테이션_강의/lremettre사업설명자료_세미나용_V1.4.pdf') + '&title=' + encodeURIComponent('르메뜨레 사업설명 공식 세미나 피치덱 (V1.4 최신판)')
    }
  ];

  let currentHeroIdx = 0;

  /**
   * ==========================================================================
   * 1. 히어로 라이브 스테이지 (첫 슬라이드 실제 표지 프리뷰 쇼케이스)
   * ==========================================================================
   */
  function renderHeroStage(idx) {
    if (!stageCanvas) return;
    currentHeroIdx = (idx + HERO_STAGE_DECKS.length) % HERO_STAGE_DECKS.length;
    const deck = HERO_STAGE_DECKS[currentHeroIdx];

    if (tabDeckV30Seminar) tabDeckV30Seminar.classList.toggle('active', deck.key === 'v30-seminar');
    if (tabDeckSpEdition) tabDeckSpEdition.classList.toggle('active', deck.key === 'sp-edition');
    if (tabDeckCellScience) tabDeckCellScience.classList.toggle('active', deck.key === 'cell-science');

    if (btnTopLaunch) btnTopLaunch.href = deck.viewerUrl;
    if (heroMainCta) heroMainCta.href = deck.viewerUrl;

    stageCanvas.innerHTML = `
      <a href="${deck.viewerUrl}" target="_blank" style="position:absolute; inset:0; display:block; width:100%; height:100%;" title="클릭하여 전체화면 발표 시작">
        <img src="${deck.thumb}" alt="${deck.title} 첫 슬라이드" class="stage-slide-img-preview">
        <div class="stage-slide-overlay-bar">
          <div class="overlay-info">
            <span class="overlay-tag">${deck.tag}</span>
            <span class="overlay-title">${deck.title}</span>
          </div>
          <span class="overlay-open-btn">▶ 발표 시작</span>
        </div>
      </a>
    `;

    if (stageCurrentIdx) stageCurrentIdx.textContent = String(currentHeroIdx + 1).padStart(2, '0');
    if (stageTotalIdx) stageTotalIdx.textContent = String(HERO_STAGE_DECKS.length).padStart(2, '0');
    if (stageProgressFill) {
      const pct = ((currentHeroIdx + 1) / HERO_STAGE_DECKS.length) * 100;
      stageProgressFill.style.width = `${pct}%`;
    }
  }

  function initHeroLiveStage() {
    if (!stageCanvas) return;

    if (tabDeckV30Seminar) {
      tabDeckV30Seminar.addEventListener('click', () => renderHeroStage(0));
    }
    if (tabDeckSpEdition) {
      tabDeckSpEdition.addEventListener('click', () => renderHeroStage(1));
    }
    if (tabDeckCellScience) {
      tabDeckCellScience.addEventListener('click', () => renderHeroStage(2));
    }

    if (stagePrevBtn) {
      stagePrevBtn.addEventListener('click', () => renderHeroStage(currentHeroIdx - 1));
    }
    if (stageNextBtn) {
      stageNextBtn.addEventListener('click', () => renderHeroStage(currentHeroIdx + 1));
    }

    window.addEventListener('keydown', (e) => {
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight') renderHeroStage(currentHeroIdx + 1);
      else if (e.key === 'ArrowLeft') renderHeroStage(currentHeroIdx - 1);
    });

    renderHeroStage(0);
  }

  /**
   * ==========================================================================
   * 2. 대시보드 6대 카테고리 파스텔 요약 카드 렌더링
   * ==========================================================================
   */
  function renderSummaryDashboard() {
    if (!summaryGrid) return;

    if (headerTotalCount) {
      headerTotalCount.textContent = String(resourcesData.length);
    }
    const bentoTotalFiles = document.getElementById('bento-total-files');
    if (bentoTotalFiles) {
      bentoTotalFiles.textContent = `${resourcesData.length}+`;
    }
    const drawerCountAll = document.getElementById('drawer-count-all');
    if (drawerCountAll) {
      drawerCountAll.textContent = String(resourcesData.length);
    }
    CATEGORY_DEFINITIONS.forEach((cat) => {
      const badgeEl = document.getElementById(`drawer-count-${cat.key}`);
      if (badgeEl) {
        badgeEl.textContent = String(resourcesData.filter((r) => r.category === cat.key).length);
      }
    });

    summaryGrid.innerHTML = CATEGORY_DEFINITIONS.map((cat) => {
      const catItems = resourcesData.filter((r) => r.category === cat.key);
      const count = catItems.length;
      const firstThumb = (catItems.find((r) => r.thumbnail) || {}).thumbnail || cat.defaultThumb;
      const isActive = currentCategory === cat.key;

      return `
        <button type="button" class="summary-pastel-card ${cat.tone} ${isActive ? 'active-summary' : ''}" data-summary-cat="${cat.key}" title="${cat.name} 카테고리 보기 (${count}건)">
          <div class="summary-card-top">
            <div class="summary-thumb-mini">
              ${firstThumb
                ? `<img src="${firstThumb}" alt="${cat.name} 대표 미리보기" loading="lazy">`
                : `<span class="summary-fallback-icon">${cat.icon}</span>`
              }
            </div>
            <span class="summary-count-badge">${count}개 자료</span>
          </div>
          <div class="summary-card-body">
            <span class="summary-eyebrow">${cat.eyebrow}</span>
            <h3 class="summary-title">${cat.name}</h3>
            <span class="summary-action-link">바로보기 <span>→</span></span>
          </div>
        </button>
      `;
    }).join('');

    summaryGrid.querySelectorAll('.summary-pastel-card').forEach((card) => {
      card.addEventListener('click', () => {
        const targetCat = card.getAttribute('data-summary-cat');
        if (currentCategory === targetCat) {
          setCategory('all', true);
        } else {
          setCategory(targetCat, true);
        }
      });
    });
  }

  /**
   * ==========================================================================
   * 3. 카테고리 전환 통합 제어
   * ==========================================================================
   */
  function setCategory(catKey, scrollToCatalog) {
    currentCategory = catKey;

    // 알약형 필터 버튼 동기화
    document.querySelectorAll('.filter-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.category === catKey);
    });

    // 서브 네비게이션 버튼 동기화
    document.querySelectorAll('.sub-cat-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.category === catKey);
    });

    // 상단 메인 네비게이션 동기화
    document.querySelectorAll('.main-nav-link').forEach((link) => {
      link.classList.toggle('active', link.dataset.navCat === catKey);
    });

    // 모바일 삼선 드로어 메뉴 동기화
    document.querySelectorAll('.mobile-drawer-item').forEach((item) => {
      item.classList.toggle('active', item.dataset.mobileCat === catKey);
    });

    renderSummaryDashboard();
    renderResources();

    if (scrollToCatalog) {
      const catalogEl = document.getElementById('resources-catalog');
      if (catalogEl) {
        catalogEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  /**
   * ==========================================================================
   * 4. 자료실 카드 그리드 (첫 슬라이드 표지 & 첫 클립 비디오 라이브 프리뷰)
   * ==========================================================================
   */
  function getDownloadBtnHtml(type, fileInfo) {
    let icon = '💾';
    let label = type.toUpperCase();

    if (type === 'pptx' || type === 'ppt') {
      icon = '📊';
      label = 'PPTX';
    } else if (type === 'pdf') {
      icon = '📄';
      label = 'PDF';
    } else if (type === 'excel' || type === 'xlsx' || type === 'xls') {
      icon = '📑';
      label = 'Excel';
    } else if (type === 'word' || type === 'docx') {
      icon = '📝';
      label = 'Word';
    } else if (type === 'image' || type === 'png' || type === 'jpg') {
      icon = '🖼️';
      label = 'Image';
    } else if (type === 'video' || type === 'mp4' || type === 'webm' || type === 'mov') {
      icon = '🎬';
      label = 'MP4 다운로드';
    }

    return `
      <a href="${fileInfo.url}" class="btn-download-pill" download="${fileInfo.name}" target="_blank" title="${fileInfo.name} 보안 다운로드">
        <span>${icon}</span> <span>${label}</span> <span class="file-size">${fileInfo.size}</span>
      </a>
    `;
  }

  function bindVideoHoverPreviews() {
    if (!gridContainer) return;
    const videoCards = gridContainer.querySelectorAll('.resource-card[data-has-video="true"]');
    videoCards.forEach((card) => {
      const vid = card.querySelector('video.card-thumb-video');
      const chipText = card.querySelector('.js-video-chip-text');
      if (!vid) return;

      // 첫 클립 구간(0.8초 ~ 6.5초) 반복 미리보기
      vid.addEventListener('timeupdate', () => {
        if (vid.currentTime > 6.5) {
          vid.currentTime = 0.8;
        }
      });

      const startPreview = () => {
        if (vid.paused) {
          if (vid.currentTime < 0.5 || vid.currentTime > 6.5) {
            try { vid.currentTime = 0.8; } catch (e) {}
          }
          vid.play().then(() => {
            vid.classList.add('playing-preview');
            if (chipText) chipText.textContent = '첫 클립 재생 중...';
          }).catch(() => {});
        }
      };

      const stopPreview = () => {
        if (!vid.paused) {
          vid.pause();
          vid.classList.remove('playing-preview');
          if (chipText) chipText.textContent = '첫 클립 미리보기';
        }
      };

      card.addEventListener('mouseenter', startPreview);
      card.addEventListener('mouseleave', stopPreview);
      card.addEventListener('touchstart', startPreview, { passive: true });
    });
  }

  function renderResources() {
    if (!gridContainer) return;

    const filtered = resourcesData.filter((item) => {
      const matchCategory = currentCategory === 'all' || item.category === currentCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
        (item.description && item.description.toLowerCase().includes(q)) ||
        (item.category_name && item.category_name.toLowerCase().includes(q)) ||
        (item.tags && item.tags.some((t) => t.toLowerCase().includes(q)));

      return matchCategory && matchSearch;
    });

    if (filtered.length === 0) {
      const catObj = CATEGORY_DEFINITIONS.find((c) => c.key === currentCategory);
      const catLabel = catObj ? catObj.name : '선택한 카테고리';
      gridContainer.innerHTML = `
        <div class="empty-catalog-box">
          <div class="empty-icon">📂</div>
          <h3>현재 '${catLabel}'에 등록된 자료가 없습니다</h3>
          <p>docs 폴더의 해당 카테고리 폴더에 파일을 넣으시면 첫 화면 미리보기와 함께 즉시 등록됩니다.</p>
        </div>
      `;
      return;
    }

    gridContainer.innerHTML = filtered
      .map((item) => {
        const isVideoItem =
          item.category === 'event_video' ||
          item.category === 'review_video' ||
          (item.downloads && Boolean(item.downloads.video) && !item.downloads.pdf && !item.downloads.pptx);

        const isViewOnly = Boolean(item.view_only);

        let webDeckUrl = item.web_deck_url;
        if (!webDeckUrl && item.downloads) {
          if (item.downloads.pdf) {
            webDeckUrl = `viewer.html?file=${encodeURIComponent(item.downloads.pdf.url)}&title=${encodeURIComponent(item.title)}${isViewOnly ? '&readonly=1' : ''}`;
          } else if (item.downloads.video) {
            webDeckUrl = `viewer.html?file=${encodeURIComponent(item.downloads.video.url)}&title=${encodeURIComponent(item.title)}&type=video`;
          } else if (item.downloads.pptx) {
            const rawUrl = window.location.origin + window.location.pathname.replace('index.html', '') + item.downloads.pptx.url;
            webDeckUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(rawUrl)}`;
          } else if (item.downloads.image) {
            webDeckUrl = item.downloads.image.url;
          }
        }

        let downloadBtnsHtml = '';
        if (isViewOnly) {
          downloadBtnsHtml = `
            <div class="card-readonly-badge" title="본 문서는 대외 보안 규정상 브라우저 내 열람만 가능하며 다운로드가 제한됩니다.">
              <span>🔒</span> <span>열람 전용 문서 (다운로드 제한)</span>
            </div>
          `;
        } else if (item.downloads) {
          const btns = Object.entries(item.downloads).map(([type, fileInfo]) => {
            return getDownloadBtnHtml(type, fileInfo);
          });
          downloadBtnsHtml = `<div class="card-download-group">${btns.join('')}</div>`;
        }

        let launchLabel = '프레젠테이션 시작';
        let launchIcon = '🚀';
        if (isVideoItem) {
          launchLabel = '전체 영상 재생';
          launchIcon = '🎬';
        } else if (isViewOnly || item.category === 'analysis') {
          launchLabel = '성적서 열람하기';
          launchIcon = '🔍';
        } else if (item.category === 'document') {
          launchLabel = '문서 열람하기';
          launchIcon = '📖';
        } else if (item.category === 'image') {
          launchLabel = '이미지 크게 보기';
          launchIcon = '🖼️';
        }

        // 좌상단 핑크 알약 뱃지 (슬라이드 장수 또는 영상 길이)
        const leftPillText = isViewOnly
          ? `🔒 열람전용 · ${item.slide_count || 1}P`
          : (item.category === 'image'
              ? '🖼️ 이미지'
              : (item.slide_count
                  ? `${item.slide_count}P 슬라이드`
                  : (item.duration ? `🎬 ${item.duration}` : (item.badge || item.version))));

        // 16:9 실제 미리보기 미디어 (PPT 첫 슬라이드 이미지 vs 영상 첫 클립 대표 화면 + 호버 비디오)
        let previewMediaHtml = '';
        if (isVideoItem && item.downloads && item.downloads.video) {
          previewMediaHtml = `
            ${item.thumbnail ? `<img src="${item.thumbnail}" alt="${item.title} 첫 클립 미리보기" class="card-thumb-img" loading="lazy">` : ''}
            <video
              class="card-thumb-video"
              src="${item.downloads.video.url}"
              muted
              loop
              playsinline
              preload="none"
            ></video>
          `;
        } else if (item.thumbnail) {
          previewMediaHtml = `
            <img
              src="${item.thumbnail}"
              alt="${item.title} 첫 슬라이드 미리보기"
              class="card-thumb-img"
              loading="lazy"
            >
          `;
        } else {
          previewMediaHtml = `
            <div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#F1F5F9; color:#64748B; font-weight:800;">
              <span>📑 ${item.category_name}</span>
            </div>
          `;
        }

        const previewChipText = item.category === 'image'
          ? '이미지 미리보기'
          : ((isViewOnly || item.category === 'analysis' || item.category === 'document')
              ? '첫 페이지 미리보기'
              : '첫 슬라이드 미리보기');

        const previewChipHtml = isVideoItem
          ? `<div class="card-preview-chip video-chip">
               <span class="chip-dot"></span>
               <span class="js-video-chip-text">첫 클립 미리보기</span>
             </div>`
          : `<div class="card-preview-chip">
               <span class="chip-dot"></span>
               <span>${previewChipText}</span>
             </div>`;

        return `
          <article class="resource-card" id="card-${item.id}" data-has-video="${isVideoItem ? 'true' : 'false'}">
            <!-- 16:9 Real 1st-Slide / 1st-Clip Preview Frame -->
            <div class="card-thumb-container">
              <div class="card-thumb-aspect">
                ${previewMediaHtml}

                <span class="card-pill-badge-left">${leftPillText}</span>

                ${webDeckUrl ? `
                  <a href="${webDeckUrl}" class="card-quick-circle-right" target="_blank" title="${launchLabel}">
                    ${isVideoItem ? '▶' : '⛶'}
                  </a>
                ` : ''}

                ${previewChipHtml}

                ${webDeckUrl ? `
                  <a href="${webDeckUrl}" class="card-thumb-hover-link" target="_blank" title="${launchLabel}">
                    <div class="hover-play-pill">
                      <span>${launchIcon}</span>
                      <span>${launchLabel}</span>
                    </div>
                  </a>
                ` : ''}
              </div>
            </div>

            <!-- Card Content Body -->
            <div class="card-body-compact">
              <div class="card-meta-stars-row">
                <span class="card-cat-tag">● ${item.category_name}</span>
                <span class="card-date-tag">${item.date || ''}</span>
              </div>
              <h3 class="card-title" title="${item.title}">${item.title}</h3>
              <div class="card-subtitle" title="${item.subtitle || item.description}">${item.subtitle || item.description}</div>
            </div>

            <!-- Card Footer: Launch & Security Downloads -->
            <div class="card-footer-compact">
              ${webDeckUrl ? `
                <a href="${webDeckUrl}" class="btn-deck-launch" target="_blank" title="${launchLabel}">
                  <span>${launchIcon}</span> ${launchLabel}
                </a>
              ` : ''}
              ${downloadBtnsHtml}
            </div>
          </article>
        `;
      })
      .join('');

    bindVideoHoverPreviews();
  }

  /**
   * ==========================================================================
   * 5. 이벤트 바인딩 & 초기 로드
   * ==========================================================================
   */
  async function loadResources() {
    try {
      const response = await fetch(`data/resources.json?t=${Date.now()}`);
      if (!response.ok) throw new Error('Network response was not ok');
      resourcesData = await response.json();
      renderSummaryDashboard();
      renderResources();
    } catch (err) {
      console.warn('Failed to fetch resources.json:', err);
    }
  }

  function initEvents() {
    // 알약형 필터 탭
    document.querySelectorAll('.filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        setCategory(btn.dataset.category, false);
      });
    });

    // 서브 네비게이션 6대 카테고리 버튼
    document.querySelectorAll('.sub-cat-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        setCategory(btn.dataset.category, true);
      });
    });

    // 상단 메인 네비게이션 링크
    document.querySelectorAll('.main-nav-link').forEach((link) => {
      link.addEventListener('click', (e) => {
        const navCat = link.dataset.navCat;
        if (navCat) {
          e.preventDefault();
          setCategory(navCat, navCat !== 'all');
          if (navCat === 'all') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }
      });
    });

    // 하단 프로모 배너 & 벤토 필러 카테고리 점프 버튼
    document.querySelectorAll('.js-jump-cat').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        setCategory(btn.dataset.category, true);
      });
    });

    // 실시간 검색창
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderResources();
      });
    }

    // 모바일 삼선(햄버거) 메뉴 드로어 열기/닫기 제어
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileDrawer = document.getElementById('mobile-nav-drawer');
    const mobileBackdrop = document.getElementById('mobile-drawer-backdrop');
    const mobileCloseBtn = document.getElementById('mobile-drawer-close');

    function setMobileDrawerOpen(open) {
      if (!mobileDrawer || !mobileBackdrop || !mobileMenuBtn) return;
      mobileDrawer.classList.toggle('is-open', open);
      mobileBackdrop.classList.toggle('is-open', open);
      mobileMenuBtn.classList.toggle('is-open', open);
      mobileMenuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      mobileDrawer.setAttribute('aria-hidden', open ? 'false' : 'true');
      document.body.style.overflow = open ? 'hidden' : '';
    }

    if (mobileMenuBtn) {
      mobileMenuBtn.addEventListener('click', () => {
        const isOpen = mobileDrawer && mobileDrawer.classList.contains('is-open');
        setMobileDrawerOpen(!isOpen);
      });
    }
    if (mobileCloseBtn) {
      mobileCloseBtn.addEventListener('click', () => setMobileDrawerOpen(false));
    }
    if (mobileBackdrop) {
      mobileBackdrop.addEventListener('click', () => setMobileDrawerOpen(false));
    }

    document.querySelectorAll('.mobile-drawer-item').forEach((item) => {
      item.addEventListener('click', () => {
        const cat = item.dataset.mobileCat || 'all';
        setMobileDrawerOpen(false);
        setCategory(cat, true);
      });
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileDrawer && mobileDrawer.classList.contains('is-open')) {
        setMobileDrawerOpen(false);
      }
    });
  }

  initHeroLiveStage();
  initEvents();
  loadResources();
})();
