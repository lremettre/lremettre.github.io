/* L.REMETTRE PWA: 서비스워커 실시간 자동 업데이트 + 안드로이드/데스크톱 "앱 설치" 버튼 */
(function () {
  var swRegistration = null;
  var lastUpdateCheck = 0;
  var MIN_UPDATE_INTERVAL_MS = 10000;
  var refreshing = false;

  function requestSkipWaiting(worker) {
    if (!worker) return;
    try {
      worker.postMessage({ type: 'SKIP_WAITING' });
    } catch (e) {}
  }

  function isLivePresentationPage() {
    var path = (window.location.pathname || '').toLowerCase();
    return (
      path.indexOf('viewer.html') !== -1 ||
      path.indexOf('presentation.html') !== -1
    );
  }

  function checkForSwUpdate(force) {
    if (!swRegistration) return;
    var now = Date.now();
    if (!force && now - lastUpdateCheck < MIN_UPDATE_INTERVAL_MS) return;
    lastUpdateCheck = now;

    swRegistration
      .update()
      .then(function () {
        if (swRegistration && swRegistration.waiting && navigator.serviceWorker.controller) {
          requestSkipWaiting(swRegistration.waiting);
        }
      })
      .catch(function () {});
  }

  function bindRegistrationLifecycle(reg) {
    if (!reg) return;
    swRegistration = reg;

    if (reg.waiting && navigator.serviceWorker.controller) {
      requestSkipWaiting(reg.waiting);
    }

    reg.addEventListener('updatefound', function () {
      var installingWorker = reg.installing;
      if (!installingWorker) return;
      installingWorker.addEventListener('statechange', function () {
        if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
          requestSkipWaiting(installingWorker);
        }
      });
    });

    checkForSwUpdate(true);
  }

  if ('serviceWorker' in navigator) {
    var hadController = Boolean(navigator.serviceWorker.controller);

    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController) {
        hadController = true;
        return;
      }
      if (refreshing || isLivePresentationPage()) return;
      refreshing = true;
      window.location.reload();
    });

    var registerSw = function () {
      navigator.serviceWorker
        .register('sw.js', { updateViaCache: 'none' })
        .then(bindRegistrationLifecycle)
        .catch(function () {});
    };

    if (document.readyState === 'complete') {
      registerSw();
    } else {
      window.addEventListener('load', registerSw);
    }

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        checkForSwUpdate(false);
      }
    });

    window.addEventListener('focus', function () {
      checkForSwUpdate(false);
    });

    window.addEventListener('online', function () {
      checkForSwUpdate(true);
    });
  }

  var deferred = null;
  var isStandalone =
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true;
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
