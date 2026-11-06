/* L.REMETTRE PWA: 서비스워커 등록 + 안드로이드 "앱 설치" 버튼 */
(function () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }

  var deferred = null;
  var isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (isStandalone) return;

  function showBar() {
    if (document.getElementById('pwa-install-bar')) return;
    if (sessionStorage.getItem('pwa-install-dismissed')) return;
    var bar = document.createElement('div');
    bar.id = 'pwa-install-bar';
    bar.className = 'pwa-install-bar';
    bar.innerHTML =
      '<img src="assets/icons/icon-192.png" alt="" class="pwa-install-icon">' +
      '<div class="pwa-install-text"><strong>르메뜨레 앱 설치</strong><span>홈 화면에서 바로 열어보세요</span></div>' +
      '<button type="button" class="pwa-install-btn" id="pwa-install-btn">설치</button>' +
      '<button type="button" class="pwa-install-close" id="pwa-install-close" aria-label="닫기">×</button>';
    document.body.appendChild(bar);
    document.getElementById('pwa-install-btn').addEventListener('click', install);
    document.getElementById('pwa-install-close').addEventListener('click', function () {
      sessionStorage.setItem('pwa-install-dismissed', '1');
      bar.remove();
    });
  }

  function install() {
    if (!deferred) return;
    deferred.prompt();
    deferred.userChoice.finally(function () {
      deferred = null;
      var bar = document.getElementById('pwa-install-bar');
      if (bar) bar.remove();
    });
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    showBar();
  });

  window.addEventListener('appinstalled', function () {
    var bar = document.getElementById('pwa-install-bar');
    if (bar) bar.remove();
  });
})();

