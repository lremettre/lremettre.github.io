/**
 * 르메뜨레(L.REMETTRE) 인터랙티브 키네틱 캔버스 배경 엔진
 * - 세포 생명력 & 신경망 에너지를 형상화한 하이엔드 파티클 네트워크
 * - 마우스 인터랙션: 커서 추적 앰비언트 글로우 & 자성 반발/연결 피직스
 * - 레티나 디스플레이(HiDPI) 완벽 지원 & 60FPS 최적화
 */

(function () {
  'use strict';

  const canvas = document.getElementById('interactive-bg-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let animId = null;

  // 파티클 색상 팔레트 (르메뜨레 시그니처 딥 오렌지 + 골드 + 앰버)
  const PALETTE = [
    { r: 255, g: 110, b: 64 },   // Deep Orange Bright
    { r: 245, g: 158, b: 11 },   // Gold
    { r: 252, g: 211, b: 77 },   // Warm Sunlight
    { r: 255, g: 87,  b: 34 },   // Core Deep Orange
    { r: 255, g: 235, b: 210 }   // Luminous Pearl
  ];

  const particles = [];
  const PARTICLE_COUNT = window.innerWidth < 768 ? 36 : 72;
  const CONNECT_DISTANCE = 115;
  const MOUSE_RADIUS = 170;

  // 마우스 상태 및 스무스 보간
  const mouse = {
    x: -9999,
    y: -9999,
    targetX: -9999,
    targetY: -9999,
    active: false
  };

  class Particle {
    constructor() {
      this.reset(true);
    }

    reset(initial = false) {
      this.x = initial ? Math.random() * width : (Math.random() > 0.5 ? 0 : width);
      this.y = initial ? Math.random() * height : Math.random() * height;
      
      const speed = 0.25 + Math.random() * 0.55;
      const angle = Math.random() * Math.PI * 2;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;

      this.radius = 1.2 + Math.random() * 2.2;
      this.baseAlpha = 0.25 + Math.random() * 0.55;
      this.alpha = this.baseAlpha;
      
      this.color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
      this.pulseSpeed = 0.02 + Math.random() * 0.03;
      this.pulsePhase = Math.random() * Math.PI * 2;
      this.wobblePhase = Math.random() * Math.PI * 2;
    }

    update(time) {
      this.wobblePhase += 0.015;
      this.pulsePhase += this.pulseSpeed;
      this.alpha = this.baseAlpha + Math.sin(this.pulsePhase) * 0.15;

      // 기본 이동 + 미세 부유 유기 모션
      this.x += this.vx + Math.sin(this.wobblePhase) * 0.18;
      this.y += this.vy + Math.cos(this.wobblePhase) * 0.18;

      // 마우스 인터랙션: 커서가 가까워지면 부드럽게 반발 및 에너지 활성화
      if (mouse.active) {
        const dx = this.x - mouse.x;
        const dy = this.y - mouse.y;
        const dist = Math.hypot(dx, dy);

        if (dist < MOUSE_RADIUS && dist > 0) {
          const force = (1 - dist / MOUSE_RADIUS) * 2.2;
          this.x += (dx / dist) * force;
          this.y += (dy / dist) * force;
          this.alpha = Math.min(1, this.alpha + 0.35);
        }
      }

      // 화면 경계 래핑 (화면 밖으로 나가면 반대편에서 재등장)
      const margin = 20;
      if (this.x < -margin) this.x = width + margin;
      else if (this.x > width + margin) this.x = -margin;
      if (this.y < -margin) this.y = height + margin;
      else if (this.y > height + margin) this.y = -margin;
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${Math.max(0.05, this.alpha)})`;
      ctx.fill();

      // 밝은 파티클에 미세 코어 글로우
      if (this.radius > 2.0) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.alpha * 0.12})`;
        ctx.fill();
      }
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(dpr, dpr);

    if (particles.length === 0) {
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push(new Particle());
      }
    }
  }

  // 마우스 추적 이벤트
  window.addEventListener('mousemove', (e) => {
    mouse.targetX = e.clientX;
    mouse.targetY = e.clientY;
    mouse.active = true;
  });

  window.addEventListener('mouseleave', () => {
    mouse.active = false;
    mouse.targetX = -9999;
    mouse.targetY = -9999;
  });

  window.addEventListener('resize', resize);

  // 대형 유기적 오로라 앰비언트 글로우 렌더러
  function drawAmbientNebula(time) {
    // 1번 글로우: 상단 오렌지 앰비언트 (천천히 부유)
    const g1x = width * 0.35 + Math.sin(time * 0.0006) * 90;
    const g1y = height * 0.25 + Math.cos(time * 0.0008) * 60;
    const rad1 = Math.max(width * 0.45, 420);

    const grad1 = ctx.createRadialGradient(g1x, g1y, 0, g1x, g1y, rad1);
    grad1.addColorStop(0, 'rgba(255, 87, 34, 0.09)');
    grad1.addColorStop(0.5, 'rgba(245, 158, 11, 0.035)');
    grad1.addColorStop(1, 'transparent');

    ctx.fillStyle = grad1;
    ctx.fillRect(0, 0, width, height);

    // 2번 글로우: 우측 하단 골드 앰비언트
    const g2x = width * 0.72 + Math.cos(time * 0.0007) * 80;
    const g2y = height * 0.65 + Math.sin(time * 0.0005) * 70;
    const rad2 = Math.max(width * 0.4, 380);

    const grad2 = ctx.createRadialGradient(g2x, g2y, 0, g2x, g2y, rad2);
    grad2.addColorStop(0, 'rgba(245, 158, 11, 0.075)');
    grad2.addColorStop(0.5, 'rgba(255, 110, 64, 0.025)');
    grad2.addColorStop(1, 'transparent');

    ctx.fillStyle = grad2;
    ctx.fillRect(0, 0, width, height);

    // 마우스 커서 다이내믹 앰비언트 글로우
    if (mouse.active && mouse.x > 0 && mouse.y > 0) {
      const mouseGrad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 220);
      mouseGrad.addColorStop(0, 'rgba(255, 110, 64, 0.12)');
      mouseGrad.addColorStop(0.45, 'rgba(245, 158, 11, 0.045)');
      mouseGrad.addColorStop(1, 'transparent');

      ctx.fillStyle = mouseGrad;
      ctx.fillRect(0, 0, width, height);
    }
  }

  function render(time) {
    ctx.clearRect(0, 0, width, height);

    // 부드러운 마우스 위치 보간
    if (mouse.active) {
      mouse.x += (mouse.targetX - mouse.x) * 0.08;
      mouse.y += (mouse.targetY - mouse.y) * 0.08;
    }

    // 1. 유기적 오로라 앰비언트 필드
    drawAmbientNebula(time);

    // 2. 파티클 업데이트 및 상호 연결선 드로잉
    const pLen = particles.length;
    for (let i = 0; i < pLen; i++) {
      particles[i].update(time);
    }

    // 파티클 간 신경망 연결선 (Distance threshold)
    for (let i = 0; i < pLen; i++) {
      const p1 = particles[i];

      // 마우스와 파티클 간 다이내믹 에너지 연결
      if (mouse.active) {
        const mDist = Math.hypot(p1.x - mouse.x, p1.y - mouse.y);
        if (mDist < MOUSE_RADIUS) {
          const mAlpha = (1 - mDist / MOUSE_RADIUS) * 0.42;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(255, 170, 70, ${mAlpha})`;
          ctx.lineWidth = 1.1;
          ctx.stroke();
        }
      }

      for (let j = i + 1; j < pLen; j++) {
        const p2 = particles[j];
        const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);

        if (dist < CONNECT_DISTANCE) {
          const connAlpha = (1 - dist / CONNECT_DISTANCE) * 0.22;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(255, 110, 64, ${connAlpha})`;
          ctx.lineWidth = 0.85;
          ctx.stroke();
        }
      }
    }

    // 3. 파티클 점 그리기
    for (let i = 0; i < pLen; i++) {
      particles[i].draw();
    }

    animId = requestAnimationFrame(render);
  }

  // 탭 비활성화 시 연산 일시정지 (배터리 및 CPU 100% 절약)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (animId) cancelAnimationFrame(animId);
    } else {
      animId = requestAnimationFrame(render);
    }
  });

  // 초기화 및 루프 시작
  resize();
  animId = requestAnimationFrame(render);
})();
