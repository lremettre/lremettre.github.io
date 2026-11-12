/**
 * 르메뜨레 공식 디지털 아카이브 허브 (L.REMETTRE White Editorial & Pastel Stage Controller v2.1)
 * - 6대 공식 카테고리 대시보드 요약 카드 자동 집계 및 실시간 백그라운드 동기화
 * - 최신 공식 세미나(Official V3.x+) 버전 자동 감지 및 전 구간 CTA/썸네일 동적 바인딩
 * - 설치형 PWA(Standalone) 풀스크린 내부 뷰어 네비게이션 연동
 */

(function () {
  'use strict';

  let resourcesData = [];
  let lastResourcesJsonStr = '';
  let lastSyncCheckAt = 0;
  let isFetchingResources = false;
  const MIN_SYNC_INTERVAL_MS = 10000;

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
      defaultThumb: 'assets/thumbs/presentation-르메뜨레세미나OfficialV34.jpg'
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

  // 히어로 스테이지 대표 프리뷰 슬라이드 목록 (1순위: 최신 Official 세미나 자동 연동)
  const HERO_STAGE_DECKS = [
    {
      key: 'v30-seminar',
      tag: 'OFFICIAL SEMINAR V3.4 · 51P',
      title: '르메뜨레 공식 세미나 프레젠테이션 (Official V3.4)',
      pages: 51,
      thumb: 'assets/thumbs/presentation-르메뜨레세미나OfficialV34.jpg',
      viewerUrl:
        'viewer.html?file=' +
        encodeURIComponent('docs/01_프레젠테이션_강의/르메뜨레 세미나_Official_V3.4.pdf') +
        '&title=' +
        encodeURIComponent('르메뜨레 세미나 Official V3.4')
    },
    {
      key: 'sp-edition',
      tag: 'SP SPECIAL EDITION · 30P',
      title: '르메뜨레 공식 프레젠테이션 (v2.1 SP 에디션)',
      pages: 30,
      thumb: 'assets/thumbs/presentation-르메뜨레프레젠테이션v21SP에디션.jpg',
      viewerUrl:
        'viewer.html?file=' +
        encodeURIComponent('docs/01_프레젠테이션_강의/르메뜨레 프레젠테이션_v2.1_SP에디션.pdf') +
        '&title=' +
        encodeURIComponent('르메뜨레 공식 프레젠테이션 (v2.1 SP 에디션)')
    },
    {
      key: 'cell-science',
      tag: 'OFFICIAL MAIN DECK · 27P',
      title: '르메뜨레(L.ReMeTTRe) : 세포의 시간을 되돌리는 과학',
      pages: 27,
      thumb: 'assets/thumbs/presentation-LReMeTTReNEWPPT.jpg',
      viewerUrl:
        'viewer.html?file=' +
        encodeURIComponent('docs/01_프레젠테이션_강의/L.ReMeTTRe_NEW_PPT.pdf') +
        '&title=' +
        encodeURIComponent('르메뜨레(L.ReMeTTRe) : 세포의 시간을 되돌리는 과학')
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
      viewerUrl:
        'viewer.html?file=' +
        encodeURIComponent('docs/01_프레젠테이션_강의/lremettre사업설명자료_세미나용_V1.4.pdf') +
        '&title=' +
        encodeURIComponent('르메뜨레 사업설명 공식 세미나 피치덱 (V1.4 최신판)')
    }
  ];

  let currentHeroIdx = 0;

  function isStandalonePwa() {
    return (
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      window.navigator.standalone === true
    );
  }

  function buildViewerUrlForItem(item) {
    if (!item) return '';
    if (item.web_deck_url) return item.web_deck_url;
    const isViewOnly = Boolean(item.view_only);
    if (item.downloads) {
      if (item.downloads.pdf) {
        return `viewer.html?file=${encodeURIComponent(item.downloads.pdf.url)}&title=${encodeURIComponent(item.title)}${isViewOnly ? '&readonly=1' : ''}`;
      }
      if (item.downloads.video) {
        return `viewer.html?file=${encodeURIComponent(item.downloads.video.url)}&title=${encodeURIComponent(item.title)}&type=video`;
      }
      if (item.downloads.pptx) {
        const rawUrl = window.location.origin + window.location.pathname.replace('index.html', '') + item.downloads.pptx.url;
        return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(rawUrl)}`;
      }
      if (item.downloads.image) {
        return item.downloads.image.url;
      }
    }
    return '';
  }

  function extractVersionInfo(item) {
    const sources = [
      (item && item.title) || '',
      (item && item.version) || '',
      (item && item.downloads && item.downloads.pdf && item.downloads.pdf.name) || '',
      (item && item.id) || ''
    ];
    for (let i = 0; i < sources.length; i++) {
      const m = sources[i].match(/Official[\s_.-]*v?(\d+(?:\.\d+)*)/i);
      if (m) {
        return {
          raw: m[1],
          parts: m[1].split('.').map((n) => parseInt(n, 10) || 0)
        };
      }
    }
    for (let i = 0; i < sources.length; i++) {
      const m = sources[i].match(/v(\d+(?:\.\d+)*)/i);
      if (m) {
        return {
          raw: m[1],
          parts: m[1].split('.').map((n) => parseInt(n, 10) || 0)
        };
      }
    }
    return { raw: '3.4', parts: [3, 4] };
  }

  function compareVersionParts(a, b) {
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
      const va = a[i] || 0;
      const vb = b[i] || 0;
      if (va !== vb) return va - vb;
    }
    return 0;
  }

  /**
   * ==========================================================================
   * 0. 최신 공식 세미나(Official V3.x+) & 히어로 스테이지 동적 동기화
   * ==========================================================================
   */
  function syncOfficialSeminarLinks() {
    if (!Array.isArray(resourcesData) || resourcesData.length === 0) return;

    const officialCandidates = resourcesData.filter((r) => {
      if (r.category && r.category !== 'presentation') return false;
      const id = r.id || '';
      const title = r.title || '';
      return (
        id.includes('르메뜨레세미나Official') ||
        /세미나[\s_-]*Official/i.test(title) ||
        title.includes('공식 세미나')
      );
    });

    officialCandidates.sort((a, b) => {
      const aOfficial = Number((a.id || '').includes('르메뜨레세미나Official') || /Official/i.test(a.title || ''));
      const bOfficial = Number((b.id || '').includes('르메뜨레세미나Official') || /Official/i.test(b.title || ''));
      if (aOfficial !== bOfficial) return bOfficial - aOfficial;
      return compareVersionParts(extractVersionInfo(b).parts, extractVersionInfo(a).parts);
    });

    const quickLinks = document.querySelectorAll('.mobile-quick-deck-link');
    const latestOfficial = officialCandidates[0];

    if (latestOfficial) {
      const verInfo = extractVersionInfo(latestOfficial);
      const verNum = verInfo.raw;
      const verUpper = `V${verNum}`;
      const slideCount = latestOfficial.slide_count || HERO_STAGE_DECKS[0].pages;
      const officialViewerUrl = buildViewerUrlForItem(latestOfficial) || HERO_STAGE_DECKS[0].viewerUrl;
      const officialThumb = latestOfficial.thumbnail || HERO_STAGE_DECKS[0].thumb;
      const officialDisplayTitle =
        latestOfficial.title && latestOfficial.title.includes('공식 세미나')
          ? latestOfficial.title
          : `르메뜨레 공식 세미나 프레젠테이션 (Official ${verUpper})`;

      HERO_STAGE_DECKS[0].tag = `OFFICIAL SEMINAR ${verUpper} · ${slideCount}P`;
      HERO_STAGE_DECKS[0].title = officialDisplayTitle;
      HERO_STAGE_DECKS[0].pages = slideCount;
      HERO_STAGE_DECKS[0].thumb = officialThumb;
      HERO_STAGE_DECKS[0].viewerUrl = officialViewerUrl;
      CATEGORY_DEFINITIONS[0].defaultThumb = officialThumb;

      if (tabDeckV30Seminar) {
        tabDeckV30Seminar.textContent = `🏆 Official ${verNum} 세미나 덱 (${slideCount}P)`;
      }

      const headerCta = document.querySelector('.header-white-cta');
      if (headerCta) {
        headerCta.href = officialViewerUrl;
        const span = headerCta.querySelector('span:not(.arrow)');
        if (span) span.textContent = `Official ${verNum} 발표`;
      }

      const drawerPrimaryCta = document.querySelector('.mobile-drawer-primary-cta');
      if (drawerPrimaryCta) {
        drawerPrimaryCta.href = officialViewerUrl;
        const span = drawerPrimaryCta.querySelector('span:first-child');
        if (span) span.textContent = `🚀 Official ${verNum} 세미나 바로 발표`;
      }

      if (quickLinks[0]) {
        quickLinks[0].href = officialViewerUrl;
        const span = quickLinks[0].querySelector('span:first-child');
        if (span) span.textContent = `🏆 Official ${verNum} 세미나 덱 (${slideCount}P)`;
      }

      if (heroMainCta) {
        heroMainCta.href = officialViewerUrl;
        const span = heroMainCta.querySelector('span:not(.arrow)');
        if (span) span.textContent = `Official ${verNum} 발표 시작`;
      }

      const bentoPost = document.querySelector('.bento-featured-post');
      if (bentoPost) {
        const badgeEl = bentoPost.querySelector('.featured-pill-badge');
        const titleEl = bentoPost.querySelector('.featured-post-title');
        const descEl = bentoPost.querySelector('.featured-post-desc');
        const ctaEl = bentoPost.querySelector('.hero-action-group a');

        if (badgeEl) badgeEl.textContent = `OFFICIAL ${verUpper} RELEASE`;
        if (titleEl) titleEl.textContent = `르메뜨레 공식 세미나 ${verUpper} 마스터 덱`;
        if (descEl) {
          if (
            latestOfficial.description &&
            !latestOfficial.description.startsWith('프레젠테이션&강의 공식 자료입니다')
          ) {
            descEl.textContent = latestOfficial.description;
          } else {
            descEl.textContent = `초저분자 세포 과학 데이터, 실제 회원 체험사례 단계별 연출, 최신 비즈니스 플랜이 통합된 ${slideCount}P 공식 세미나 마스터 에디션입니다.`;
          }
        }
        if (ctaEl) {
          ctaEl.href = officialViewerUrl;
          const span = ctaEl.querySelector('span:not(.arrow)');
          if (span) span.textContent = `Official ${verNum} 발표 시작`;
        }
      }

      const toolkitLinks = document.querySelectorAll('.toolkit-list a.toolkit-row');
      if (toolkitLinks[0] && !toolkitLinks[0].hasAttribute('download')) {
        toolkitLinks[0].href = officialViewerUrl;
        const tkBadge = toolkitLinks[0].querySelector('.toolkit-badge');
        if (tkBadge) tkBadge.textContent = verUpper;
      }

      const pptxToolkitLink = document.querySelector('.toolkit-list a.toolkit-row[download]');
      if (pptxToolkitLink) {
        if (latestOfficial.downloads && latestOfficial.downloads.pptx) {
          pptxToolkitLink.href = latestOfficial.downloads.pptx.url;
          pptxToolkitLink.setAttribute('download', latestOfficial.downloads.pptx.name);
        }
        const tkName = pptxToolkitLink.querySelector('.toolkit-name');
        if (tkName) tkName.textContent = `Official ${verNum} 원본 PPTX 다운로드`;
      }

      const firstCardDesc =
        document.querySelector('.neomathic-4cards-grid .neomathic-3d-card[data-category="presentation"] .card-3d-text p') ||
        document.querySelector('.neomathic-4cards-grid .neomathic-3d-card .card-3d-text p');
      if (firstCardDesc) {
        firstCardDesc.innerHTML = `Official ${verUpper} 세미나 ${slideCount}P,<br>SP 에디션, 세포 과학 메인 덱`;
      }

      const firstStatInfo = document.querySelector('.neomathic-stats-strip .neo-stat-col .neo-stat-info');
      if (firstStatInfo) {
        const strongEl = firstStatInfo.querySelector('strong');
        const spanEl = firstStatInfo.querySelector('span');
        if (strongEl) strongEl.textContent = `${slideCount}P`;
        if (spanEl) spanEl.textContent = `Official ${verUpper} 세미나 덱`;
      }

      const yearPillText = document.querySelector('.floating-search-year-pill span:first-child');
      if (yearPillText) {
        const yearStr = latestOfficial.date && /^\d{4}/.test(latestOfficial.date) ? latestOfficial.date.slice(0, 4) : '2026';
        yearPillText.textContent = `Official ${verUpper} · ${yearStr}`;
      }
      if (searchInput) {
        searchInput.placeholder = `자료명, 키워드, 세미나 버전(${verUpper}), SGS 성적서 실시간 검색...`;
      }

      const bottomPrimaryCta = document.querySelector('.bottom-arch-actions a.btn-neomathic-white');
      if (bottomPrimaryCta) {
        bottomPrimaryCta.href = officialViewerUrl;
        const span = bottomPrimaryCta.querySelector('span:not(.arrow)');
        if (span) span.textContent = `Official ${verNum} 발표 시작`;
      }
    }

    // 나머지 히어로 스테이지 대표 덱 썸네일(?v= 캐시버스팅 포함) 및 뷰어 URL 동기화
    const deckMatchers = {
      'sp-edition': (r) => (r.id && r.id.includes('SP에디션')) || (r.title && /SP\s*에디션/i.test(r.title)),
      'cell-science': (r) => r.id === 'presentation-LReMeTTReNEWPPT' || (r.title && r.title.includes('세포의 시간을 되돌리는 과학')),
      'leadership': (r) => r.id === 'leadership-masterclass' || (r.title && r.title.includes('리더십의 진짜 온도')),
      'v14-business': (r) => (r.id && r.id.includes('사업설명자료세미나용')) || (r.title && r.title.includes('사업설명'))
    };

    HERO_STAGE_DECKS.forEach((deck) => {
      const matcher = deckMatchers[deck.key];
      if (!matcher) return;
      const matched = resourcesData.find(matcher);
      if (!matched) return;

      if (matched.thumbnail) deck.thumb = matched.thumbnail;
      const syncedUrl = buildViewerUrlForItem(matched);
      if (syncedUrl) deck.viewerUrl = syncedUrl;
      if (matched.slide_count) {
        deck.pages = matched.slide_count;
        deck.tag = deck.tag.replace(/\d+P$/, `${matched.slide_count}P`);
      }

      if (deck.key === 'sp-edition') {
        if (tabDeckSpEdition) {
          tabDeckSpEdition.textContent = `✨ ${matched.version || 'v2.1'} SP 에디션 (${deck.pages}P)`;
        }
        if (quickLinks[1]) {
          quickLinks[1].href = deck.viewerUrl;
          const s = quickLinks[1].querySelector('span:first-child');
          if (s) s.textContent = `✨ ${matched.version || 'v2.1'} SP 에디션 (${deck.pages}P)`;
        }
      } else if (deck.key === 'cell-science') {
        if (tabDeckCellScience) {
          tabDeckCellScience.textContent = `🧬 세포 과학 덱 (${deck.pages}P)`;
        }
        if (quickLinks[2]) {
          quickLinks[2].href = deck.viewerUrl;
          const s = quickLinks[2].querySelector('span:first-child');
          if (s) s.textContent = `🧬 세포 과학 메인 덱 (${deck.pages}P)`;
        }
      }
    });

    renderHeroStage(currentHeroIdx);
  }

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
    if (heroMainCta && HERO_STAGE_DECKS[0]) heroMainCta.href = HERO_STAGE_DECKS[0].viewerUrl;

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
        const webDeckUrl = buildViewerUrlForItem(item);

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
   * 5. 데이터 실시간 로드 · 백그라운드 동기화 · Standalone PWA 네비게이션
   * ==========================================================================
   */
  async function loadResources() {
    if (isFetchingResources) return;
    isFetchingResources = true;
    lastSyncCheckAt = Date.now();

    try {
      const response = await fetch(`data/resources.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Network response was not ok');
      const rawText = await response.text();
      if (rawText && rawText !== lastResourcesJsonStr) {
        lastResourcesJsonStr = rawText;
        resourcesData = JSON.parse(rawText);
        syncOfficialSeminarLinks();
        renderSummaryDashboard();
        renderResources();
      }
    } catch (err) {
      console.warn('Failed to fetch resources.json:', err);
    } finally {
      isFetchingResources = false;
    }
  }

  function triggerThrottledResourceSync(force) {
    const now = Date.now();
    if (!force && now - lastSyncCheckAt < MIN_SYNC_INTERVAL_MS) return;
    loadResources();
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

    // 설치형 Standalone PWA 모드: 내부 뷰어(viewer.html / presentation.html) 클릭 시 외부 브라우저 탭 대신 앱 내부 풀스크린 이동
    document.addEventListener('click', (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (!isStandalonePwa()) return;

      const link = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!link) return;
      if (link.hasAttribute('download') || link.classList.contains('btn-download-pill')) return;

      try {
        const targetUrl = new URL(link.href, window.location.href);
        if (targetUrl.origin !== window.location.origin) return;
        if (/\/(viewer|presentation)\.html$/i.test(targetUrl.pathname)) {
          e.preventDefault();
          if (mobileDrawer && mobileDrawer.classList.contains('is-open')) {
            setMobileDrawerOpen(false);
          }
          window.location.href = targetUrl.href;
        }
      } catch (err) {}
    });

    // 앱 복귀(visibilitychange / focus / online) 시 실시간 백그라운드 자료 동기화
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        triggerThrottledResourceSync(false);
      }
    });

    window.addEventListener('focus', () => {
      triggerThrottledResourceSync(false);
    });

    window.addEventListener('online', () => {
      triggerThrottledResourceSync(true);
    });
  }

  initHeroLiveStage();
  initEvents();
  loadResources();
})();
