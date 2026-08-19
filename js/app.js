/* Pulse — Metronome (bootstrap) */
(function () {
  'use strict';

  const splash = document.getElementById('splash');
  const startBtn = document.getElementById('startBtn');
  const app = document.getElementById('app');

  startBtn.addEventListener('click', () => {
    splash.classList.add('is-hiding');
    app.hidden = false;
    setTimeout(() => { splash.style.display = 'none'; }, 450);
  });
})();
