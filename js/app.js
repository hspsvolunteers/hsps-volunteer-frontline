/* =========================================================
   支援前線｜互動計分器主程式
   快捷鍵：
     空白鍵 / Enter / → / PageDown ：下一步（主按鈕）
     ← / PageUp ：返回上一階段（僅限尚未給分時）
     1 2 3 4 ：藍 / 黃 / 紅 / 紫 給分
     Z / Backspace ：復原上一筆給分
     F ：全螢幕　G ：顯示舞台安全線
   ========================================================= */
(function () {
  'use strict';

  const DATA = window.GAME_DATA;
  const TEAMS = DATA.teams;
  const ROUNDS = DATA.rounds;
  const POINTS = DATA.points;
  const STORE_KEY = 'support-frontline-state-v1';
  const NUM_ZH = ['一', '二', '三', '四', '五', '六'];

  const PIK_COLORS = {
    blue:   { body: '#4c8df6', dark: '#2a64c4', light: '#8cbcff' },
    yellow: { body: '#ffc93d', dark: '#d39a14', light: '#ffe28a' },
    red:    { body: '#f4574b', dark: '#b8332a', light: '#ff9a8f' },
    purple: { body: '#9370f0', dark: '#6545bf', light: '#c6aeff' }
  };

  /* ---------------- 狀態 ---------------- */
  const fresh = () => ({
    round: 0,
    phase: 1,             // 1 情境｜2 代表｜3 物資計分｜'final' 最終
    totals: Object.fromEntries(TEAMS.map(t => [t.id, 0])),
    order: []             // 本回合完成順序（team id）
  });

  let state = load();

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY));
      if (s && typeof s.round === 'number' && s.totals && Array.isArray(s.order)) return s;
    } catch (e) { /* ignore */ }
    return fresh();
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  /* ---------------- DOM ---------------- */
  const $ = (s, r = document) => r.querySelector(s);
  const stage = $('#stage');
  const arena = $('#arena');
  const scoreboard = $('#scoreboard');
  const actionBtn = $('#actionBtn');
  const actionLabel = $('#actionLabel');
  const actionSub = $('#actionSub');
  const undoBtn = $('#undoBtn');
  const resetBtn = $('#resetBtn');
  const modal = $('#modal');
  const fx = $('#fx');

  /* ---------------- 縮放成 16:9 ---------------- */
  function fit() {
    const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.setProperty('--scale', s);
  }
  window.addEventListener('resize', fit);
  fit();

  /* =========================================================
     SVG 繪圖工具
     ========================================================= */
  // 等角方塊：(x, y) 為頂面中心，w 為半寬，h 為高度
  function isoBox(x, y, w, h, top, left, right, extra = '') {
    const q = w / 2;
    return `
      <polygon points="${x},${y - q} ${x + w},${y} ${x},${y + q} ${x - w},${y}" fill="${top}" ${extra}/>
      <polygon points="${x - w},${y} ${x},${y + q} ${x},${y + q + h} ${x - w},${y + h}" fill="${left}" ${extra}/>
      <polygon points="${x + w},${y} ${x},${y + q} ${x},${y + q + h} ${x + w},${y + h}" fill="${right}" ${extra}/>`;
  }

  // 皮克敏角色（腳底位於 0,0）
  function pikmin(team, opts = {}) {
    const c = PIK_COLORS[team];
    const sway = opts.sway ? 'class="sway"' : '';
    const kind = opts.kind || (team === 'purple' ? 'flower' : team === 'yellow' ? 'bud' : 'leaf');
    const armsUp = opts.armsUp;
    const headRx = team === 'purple' ? 19 : 17;
    const headRy = team === 'purple' ? 20 : 19;

    let extras = '';
    if (team === 'red') {
      extras = `<polygon points="-4,-74 0,-85 4,-74" fill="${c.body}"/>`;
    } else if (team === 'yellow') {
      extras = `
        <ellipse cx="-18" cy="-62" rx="6" ry="10" fill="${c.body}" transform="rotate(-25 -18 -62)"/>
        <ellipse cx="18" cy="-62" rx="6" ry="10" fill="${c.body}" transform="rotate(25 18 -62)"/>`;
    } else if (team === 'purple') {
      extras = `<path d="M-6,-77 L-4,-83 M0,-78 L0,-85 M6,-77 L4,-83" stroke="${c.dark}" stroke-width="2.4" stroke-linecap="round"/>`;
    }
    const mouth = team === 'blue'
      ? `<path d="M-4,-48 Q0,-45 4,-48" stroke="${c.dark}" stroke-width="2" fill="none" stroke-linecap="round"/>` : '';

    let top;
    if (kind === 'flower') {
      const petals = [0, 72, 144, 216, 288].map(a =>
        `<ellipse cx="3" cy="-121" rx="4.5" ry="7.5" fill="#ffffff" transform="rotate(${a} 3 -113)"/>`).join('');
      top = `${petals}<circle cx="3" cy="-113" r="4.2" fill="#ffd34d"/>`;
    } else if (kind === 'bud') {
      top = `<path d="M3,-106 C-5,-110 -5,-122 3,-128 C11,-122 11,-110 3,-106 Z" fill="#ffffff"/>
             <path d="M3,-106 C0,-112 0,-120 3,-126" stroke="#f3d9e6" stroke-width="1.5" fill="none"/>`;
    } else {
      top = `<path d="M3,-106 C-9,-111 -11,-126 2,-133 C13,-125 13,-112 3,-106 Z" fill="#7cc24a"/>
             <path d="M3,-106 C1,-114 1,-122 2,-130" stroke="#4f8f2b" stroke-width="1.6" fill="none"/>`;
    }
    const arms = armsUp
      ? `<path d="M-8,-36 L-15,-50 M8,-36 L15,-50" stroke="${c.dark}" stroke-width="3.6" stroke-linecap="round"/>`
      : `<path d="M-8,-35 L-16,-24 M8,-35 L16,-24" stroke="${c.dark}" stroke-width="3.6" stroke-linecap="round"/>`;

    return `
      <ellipse cx="0" cy="0" rx="17" ry="5" fill="rgba(36,48,32,.18)"/>
      <path d="M-5,-21 L-6,-2 M5,-21 L6,-2" stroke="${c.dark}" stroke-width="4" stroke-linecap="round"/>
      ${arms}
      <ellipse cx="0" cy="-30" rx="9.5" ry="13" fill="${c.body}"/>
      <ellipse cx="3" cy="-28" rx="4" ry="8" fill="${c.dark}" opacity=".25"/>
      <g ${sway}>
        <path d="M0,-76 C-3,-88 6,-95 3,-106" stroke="#6b8f3a" stroke-width="2.6" fill="none" stroke-linecap="round"/>
        ${top}
      </g>
      ${extras}
      <ellipse cx="0" cy="-58" rx="${headRx}" ry="${headRy}" fill="${c.body}"/>
      <ellipse cx="-6" cy="-68" rx="6" ry="3.5" fill="#ffffff" opacity=".35"/>
      <circle cx="-6.5" cy="-58" r="5.4" fill="#ffffff"/>
      <circle cx="6.5" cy="-58" r="5.4" fill="#ffffff"/>
      <circle cx="-5.6" cy="-57.4" r="2.8" fill="#1d1d1d"/>
      <circle cx="7.4" cy="-57.4" r="2.8" fill="#1d1d1d"/>
      <circle cx="-4.6" cy="-58.6" r="1" fill="#ffffff"/>
      <circle cx="8.4" cy="-58.6" r="1" fill="#ffffff"/>
      ${mouth}`;
  }

  const pikminSVG = (team, cls = '') =>
    `<svg class="${cls}" viewBox="-34 -138 68 144" aria-hidden="true">${pikmin(team)}</svg>`;

  // 回合進度方塊
  function stepCube(state) {
    const pal = state === 'done' ? ['#b6e37a', '#7cc24a', '#4f8f2b']
      : state === 'cur' ? ['#ffe28a', '#ffc93d', '#d39a14']
        : ['#f1efe2', '#dedbc8', '#cbc7af'];
    return `<svg viewBox="0 0 52 44" class="${state}" aria-hidden="true">${isoBox(26, 12, 22, 20, ...pal)}</svg>`;
  }

  // 組別編號方塊
  function numCube(n) {
    return `<svg class="gcard-num" viewBox="0 0 80 80" aria-hidden="true">
      ${isoBox(40, 22, 32, 34, '#b6e37a', '#7cc24a', '#4f8f2b')}
      <text x="40" y="29" text-anchor="middle" font-family="Outfit, sans-serif" font-weight="900" font-size="22" fill="#2f5e1a" transform="matrix(1,0,0,.6,0,11.6)">${n}</text>
    </svg>`;
  }

  // 情境插畫：堆疊方塊 + 皮克敏
  function sceneArt(roundIdx) {
    const order = ['blue', 'yellow', 'red', 'purple'];
    const t = order[roundIdx % 4];
    return `<svg class="scene-art" viewBox="0 0 300 300" aria-hidden="true">
      <ellipse cx="150" cy="282" rx="120" ry="12" fill="rgba(36,48,32,.12)"/>
      ${isoBox(150, 196, 110, 30, '#b6e37a', '#7cc24a', '#4f8f2b')}
      ${isoBox(98, 196, 30, 34, '#8cbcff', '#4c8df6', '#2a64c4')}
      ${isoBox(202, 196, 30, 34, '#ff9a8f', '#f4574b', '#b8332a')}
      ${isoBox(150, 222, 30, 34, '#ffe28a', '#ffc93d', '#d39a14')}
      ${isoBox(150, 170, 30, 34, '#c6aeff', '#9370f0', '#6545bf')}
      ${isoBox(150, 120, 30, 34, '#ffffff', '#ebe6d0', '#d4ddb9')}
      <g transform="translate(150 106) scale(.8)">${pikmin(t, { armsUp: true })}</g>
    </svg>`;
  }

  function treasureChest() {
    return `<svg class="treasure-chest" viewBox="0 0 60 54" aria-hidden="true">
      ${isoBox(30, 22, 24, 22, '#c98a4b', '#a86a33', '#8a5424')}
      <polygon points="6,22 30,34 30,40 6,28" fill="#ffd34d"/>
      <polygon points="54,22 30,34 30,40 54,28" fill="#e2b021"/>
      <polygon points="30,8 46,16 30,24 14,16" fill="#ffe9a0"/>
      <rect x="27" y="36" width="6" height="8" rx="1.5" fill="#3d2a00"/>
    </svg>`;
  }

  function gem(team) {
    const c = PIK_COLORS[team];
    return `<svg class="scard-gem" viewBox="0 0 40 40" aria-hidden="true">${isoBox(20, 12, 14, 14, c.light, c.body, c.dark)}</svg>`;
  }

  /* =========================================================
     看板
     ========================================================= */
  function buildScoreboard() {
    scoreboard.innerHTML = TEAMS.map(t => `
      <div class="tile t-${t.id}" id="tile-${t.id}">
        ${pikminSVG(t.id, 'tile-pik')}
        <div class="tile-info">
          <span class="tile-order">${t.order}</span>
          <span class="tile-name">${t.name}</span>
          <span class="tile-leader">小隊長 ${t.leader}</span>
        </div>
        <span class="tile-total" id="total-${t.id}">${state.totals[t.id]}</span>
      </div>`).join('');
  }

  function updateTotals(bumpId, plus) {
    TEAMS.forEach(t => { $('#total-' + t.id).textContent = state.totals[t.id]; });
    if (bumpId) {
      const tile = $('#tile-' + bumpId);
      tile.classList.remove('bump'); void tile.offsetWidth; tile.classList.add('bump');
      if (plus) {
        const f = document.createElement('span');
        f.className = 'tile-float';
        f.textContent = (plus > 0 ? '+' : '') + plus;
        tile.appendChild(f);
        setTimeout(() => f.remove(), 1400);
      }
    }
  }

  /* =========================================================
     舞台（arena）
     ========================================================= */
  function renderArena() {
    const p = state.phase;
    arena.className = 'arena phase-' + p;

    if (p === 'final') { arena.innerHTML = finalHTML(); return; }

    const r = ROUNDS[state.round];
    const n = r.groups.length;

    if (p === 1) {
      const longest = Math.max(...r.intro.map(s => s.length));
      const size = r.intro.length >= 4 ? 54 : longest > 14 ? 60 : 70;
      arena.innerHTML = `
        <article class="scene iso-card">
          <div class="scene-chips">
            <span class="chip green">${r.title}</span>
            <span class="chip cream">${r.theme}</span>
          </div>
          <h2 class="scene-text" style="--intro-size:${size}px">
            ${r.intro.map((l, i) => `<span style="animation-delay:${0.15 + i * 0.18}s">${l}</span>`).join('')}
          </h2>
          ${sceneArt(state.round)}
        </article>`;
      return;
    }

    if (p === 2) {
      arena.innerHTML = `
        <div class="strip">
          <span class="chip green">${r.title}</span>
          <span class="strip-text">代表就位<em>請以下組長上台準備</em></span>
        </div>
        <div class="crew n${n}">
          ${r.groups.map((g, i) => `
            <article class="gcard iso-card" style="animation-delay:${0.1 + i * 0.16}s">
              ${numCube(i + 1)}
              <span class="gcard-eyebrow">需要支援</span>
              <h3 class="gcard-name">${g.name}</h3>
              <span class="gcard-leader"><small>組長</small><b>${g.leader}</b></span>
              <span class="gcard-call">請上台</span>
            </article>`).join('')}
        </div>`;
      return;
    }

    // phase 3
    const teamCycle = ['blue', 'yellow', 'red', 'purple'];
    const stripHTML = r.treasure
      ? `<div class="strip">
           <span class="chip green">${r.title}</span>
           <div class="treasure">${treasureChest()}<span class="treasure-tag">尋寶提示</span><span>${r.treasure.replace(/^尋寶任務｜/, '')}</span></div>
         </div>`
      : `<div class="strip">
           <span class="chip green">${r.title}</span>
           <span class="strip-text">物資募集中<em>最先備齊的隊伍得 4 分，依序 3、2、1 分</em></span>
         </div>`;

    arena.innerHTML = `
      ${stripHTML}
      <div class="crew n${n}">
        ${r.groups.map((g, i) => `
          <article class="scard iso-card" style="animation-delay:${0.05 + i * 0.12}s">
            ${gem(teamCycle[i % 4])}
            <div class="scard-head">
              <span class="scard-name">${g.name}</span>
              <span class="scard-leader">組長 ${g.leader}</span>
            </div>
            <div class="scard-body">
              ${n < 4 ? '<span class="scard-label">需求物資</span>' : ''}
              <div class="scard-row">
                <span class="scard-supply${g.supply.length > 6 ? ' long' : ''}">${g.supply}</span>
                ${g.quantity ? `<span class="scard-qty"><b>${g.quantity}</b><small>${g.unit || '件'}</small></span>` : ''}
              </div>
            </div>
          </article>`).join('')}
      </div>
      <div class="scoring">
        ${TEAMS.map((t, i) => `
          <button class="score-btn t-${t.id}" id="score-${t.id}" data-team="${t.id}" type="button"
                  style="animation-delay:${0.45 + i * 0.1}s" aria-label="${t.name} 給分">
            <span class="sb-face">
              <span class="sb-info">
                <span class="sb-order">${t.order}</span>
                <span class="sb-name">${t.name}</span>
                <span class="sb-leader">小隊長 ${t.leader}</span>
              </span>
              <span class="sb-points">
                <span class="sb-plus">+4</span>
                <span class="sb-rank">按下給分</span>
              </span>
            </span>
          </button>`).join('')}
      </div>`;

    arena.querySelectorAll('.score-btn').forEach(b =>
      b.addEventListener('click', () => { b.blur(); score(b.dataset.team); }));
    updateScoreButtons();
  }

  function updateScoreButtons() {
    const nextPts = POINTS[state.order.length];
    TEAMS.forEach(t => {
      const b = $('#score-' + t.id);
      if (!b) return;
      const idx = state.order.indexOf(t.id);
      const plus = b.querySelector('.sb-plus');
      const rank = b.querySelector('.sb-rank');
      if (idx >= 0) {
        if (!b.classList.contains('is-done')) b.classList.add('is-done');
        b.disabled = true;
        plus.textContent = '+' + POINTS[idx];
        rank.textContent = `第 ${idx + 1} 名`;
        b.setAttribute('aria-label', `${t.name} 第 ${idx + 1} 名，獲得 ${POINTS[idx]} 分`);
      } else {
        b.classList.remove('is-done');
        b.disabled = false;
        plus.textContent = nextPts ? '+' + nextPts : '';
        rank.textContent = '按下給分';
        b.setAttribute('aria-label', `${t.name} 給分 +${nextPts}`);
      }
    });
  }

  function finalHTML() {
    const sorted = [...TEAMS].sort((a, b) => state.totals[b.id] - state.totals[a.id]);
    const max = Math.max(1, ...TEAMS.map(t => state.totals[t.id]));
    let lastScore = null, lastRank = 0;
    const ranks = sorted.map((t, i) => {
      const s = state.totals[t.id];
      if (s !== lastScore) { lastRank = i + 1; lastScore = s; }
      return lastRank;
    });
    return `
      <div class="strip">
        <span class="chip green">最終成績</span>
        <span class="strip-text">支援前線 任務完成<em>感謝四隊皮皮的熱情支援</em></span>
      </div>
      <div class="podium">
        ${sorted.map((t, i) => {
          const h = 70 + Math.round((state.totals[t.id] / max) * 170);
          return `
          <div class="pod t-${t.id}${ranks[i] === 1 ? ' first' : ''}" style="animation-delay:${0.2 + (3 - i) * 0.25}s">
            <span class="pod-rank">第 ${NUM_ZH[ranks[i] - 1]} 名</span>
            <span class="pod-name">${t.name}</span>
            <span class="pod-leader">小隊長 ${t.leader}</span>
            <div class="pod-col" style="height:${h}px; animation-delay:${0.3 + (3 - i) * 0.25}s">
              <span class="pod-score">${state.totals[t.id]}</span>
            </div>
          </div>`;
        }).join('')}
      </div>`;
  }

  /* =========================================================
     控制塔
     ========================================================= */
  function renderTower() {
    const p = state.phase;
    const isFinal = p === 'final';

    $('#trackerRound').textContent = isFinal ? '全部完成' : ROUNDS[state.round].title;
    $('#trackerSteps').innerHTML = ROUNDS.map((_, i) =>
      stepCube(isFinal || i < state.round ? 'done' : i === state.round ? 'cur' : 'todo')).join('');
    document.querySelectorAll('#trackerPhases span').forEach(s => {
      const n = Number(s.dataset.p);
      s.className = isFinal ? 'done' : n === p ? 'on' : n < p ? 'done' : '';
    });

    actionBtn.classList.remove('ready', 'next');
    actionBtn.disabled = false;

    if (isFinal) {
      actionLabel.textContent = '再玩一次';
      actionSub.textContent = '重設所有分數';
    } else if (p === 1) {
      actionLabel.textContent = '邀請代表上台';
      actionSub.textContent = 'SPACE · 下一步';
    } else if (p === 2) {
      actionLabel.textContent = '揭曉需求物資';
      actionSub.textContent = 'SPACE · 下一步';
    } else {
      const done = state.order.length >= TEAMS.length;
      if (done) {
        const last = state.round >= ROUNDS.length - 1;
        actionLabel.textContent = last ? '公布最終成績' : '進入下一回合';
        actionSub.textContent = 'SPACE · 繼續';
        actionBtn.classList.add('ready', 'next');
      } else {
        actionBtn.disabled = true;
        actionLabel.textContent = `等待給分 ${state.order.length} / ${TEAMS.length}`;
        actionSub.innerHTML = `<span class="wait-pips">${TEAMS.map(t =>
          `<i class="t-${t.id}${state.order.includes(t.id) ? ' on' : ''}"></i>`).join('')}</span>`;
      }
    }

    undoBtn.disabled = !(p === 3 && state.order.length > 0);
  }

  function renderAll() {
    renderArena();
    renderTower();
    updateTotals();
  }

  /* =========================================================
     操作
     ========================================================= */
  function advance() {
    const p = state.phase;
    if (p === 'final') { openModal(); return; }
    if (p === 1) state.phase = 2;
    else if (p === 2) state.phase = 3;
    else if (p === 3) {
      if (state.order.length < TEAMS.length) return; // 防呆：四隊未完成不可前進
      if (state.round >= ROUNDS.length - 1) {
        state.phase = 'final';
        state.order = [];
        save(); renderAll(); confetti(140);
        return;
      }
      state.round += 1;
      state.phase = 1;
      state.order = [];
    }
    save(); renderAll();
  }

  function goBack() {
    if (state.phase === 2) state.phase = 1;
    else if (state.phase === 3 && state.order.length === 0) state.phase = 2;
    else return;
    save(); renderAll();
  }

  function score(teamId) {
    if (state.phase !== 3) return;
    if (state.order.includes(teamId) || state.order.length >= TEAMS.length) return;
    const pts = POINTS[state.order.length];
    state.order.push(teamId);
    state.totals[teamId] += pts;
    save();
    updateScoreButtons();
    updateTotals(teamId, pts);
    renderTower();
    burst(teamId);
  }

  function undo() {
    if (state.phase !== 3 || !state.order.length) return;
    const teamId = state.order.pop();
    const pts = POINTS[state.order.length];
    state.totals[teamId] = Math.max(0, state.totals[teamId] - pts);
    save();
    updateScoreButtons();
    updateTotals(teamId, -pts);
    renderTower();
  }

  function resetGame() {
    state = fresh();
    save();
    closeModal();
    fx.innerHTML = '';
    renderAll();
  }

  /* ---------------- 特效 ---------------- */
  const CONF_COLORS = ['#4c8df6', '#ffc93d', '#f4574b', '#9370f0', '#7cc24a', '#ffffff'];
  function confetti(count) {
    for (let i = 0; i < count; i++) {
      const c = document.createElement('i');
      c.className = 'confetti';
      c.style.left = Math.random() * 1920 + 'px';
      c.style.background = CONF_COLORS[i % CONF_COLORS.length];
      c.style.animationDuration = (2.6 + Math.random() * 2.4) + 's';
      c.style.animationDelay = (Math.random() * 1.6) + 's';
      const s = 14 + Math.random() * 16;
      c.style.width = c.style.height = s + 'px';
      fx.appendChild(c);
      setTimeout(() => c.remove(), 7000);
    }
  }
  function burst(teamId) {
    const b = $('#score-' + teamId);
    if (!b) return;
    const rect = b.getBoundingClientRect();
    const sRect = stage.getBoundingClientRect();
    const scale = sRect.width / 1920;
    const cx = (rect.left - sRect.left + rect.width / 2) / scale;
    const cy = (rect.top - sRect.top + 40) / scale;
    const color = PIK_COLORS[teamId].body;
    for (let i = 0; i < 14; i++) {
      const c = document.createElement('i');
      c.className = 'confetti';
      const ang = (Math.PI * 2 * i) / 14;
      const dist = 90 + Math.random() * 60;
      c.style.left = cx + 'px';
      c.style.top = cy + 'px';
      c.style.background = i % 3 === 0 ? '#ffffff' : color;
      c.style.width = c.style.height = '16px';
      c.animate([
        { transform: 'translate(0,0) rotate(45deg) skew(10deg,10deg) scale(1)', opacity: 1 },
        { transform: `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist - 30}px) rotate(225deg) skew(10deg,10deg) scale(.3)`, opacity: 0 }
      ], { duration: 750, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
      c.style.animation = 'none';
      fx.appendChild(c);
      setTimeout(() => c.remove(), 800);
    }
  }

  /* ---------------- Modal ---------------- */
  function openModal() { modal.classList.add('open'); $('#modalCancel').focus(); }
  function closeModal() { modal.classList.remove('open'); }

  /* =========================================================
     下半部裝飾（安全留白區）
     ========================================================= */
  function buildDeco() {
    const W = 1920, H = 432, y0 = 58;
    let edge = `0,${y0 + 40}`;
    for (let x = 80; x <= W + 80; x += 80) edge += ` ${x},${(x / 80) % 2 ? y0 : y0 + 40}`;
    edge += ` ${W + 80},${H} 0,${H}`;

    const items = [];
    const add = (y, svg) => items.push({ y, svg });

    // 樹
    const tree = (x, y, s = 1) => add(y, `<g transform="translate(${x} ${y}) scale(${s})">
        <ellipse cx="0" cy="8" rx="44" ry="12" fill="rgba(36,48,32,.14)"/>
        ${isoBox(0, -18, 9, 26, '#b58552', '#946638', '#7a5229')}
        ${isoBox(0, -82, 40, 48, '#9ad65a', '#6fb33f', '#4f8f2b')}
        ${isoBox(0, -112, 24, 26, '#b6e37a', '#86c64f', '#5f9f34')}
      </g>`);
    // 花
    const flower = (x, y, col) => add(y, `<g transform="translate(${x} ${y})">
        <path d="M0,0 L0,-16" stroke="#4f8f2b" stroke-width="2.5"/>
        <g class="twinkle" style="animation-delay:${(x % 7) * .3}s">
          ${[0, 72, 144, 216, 288].map(a => `<ellipse cx="0" cy="-24" rx="4" ry="6" fill="${col}" transform="rotate(${a} 0 -18)"/>`).join('')}
          <circle cx="0" cy="-18" r="3.5" fill="#ffd34d"/>
        </g>
      </g>`);
    // 石頭
    const rock = (x, y, s = 1) => add(y, `<g transform="translate(${x} ${y}) scale(${s})">${isoBox(0, -14, 18, 12, '#e8e6da', '#cfccbb', '#b3af9b')}</g>`);
    // 站立皮克敏
    const pik = (x, y, team, s = 1, delay = 0) => add(y, `<g transform="translate(${x} ${y}) scale(${s})">
        <g class="bob" style="animation-delay:${delay}s">${pikmin(team, { sway: true })}</g></g>`);
    // 搬運物資的皮克敏小隊
    const carry = (x, y, teams, cls, crate) => add(y, `<g transform="translate(${x} ${y})"><g class="${cls}">
        ${teams.map((t, i) => `<g transform="translate(${(i - (teams.length - 1) / 2) * 38} ${i % 2 ? 6 : 0}) scale(.82)">
            <g class="bob" style="animation-delay:${i * .25}s">${pikmin(t, { armsUp: true, sway: true })}</g></g>`).join('')}
        <g class="bob" style="animation-delay:.1s">
          ${isoBox(0, -132, 50, 40, crate[0], crate[1], crate[2])}
          <polygon points="-50,-132 0,-107 0,-99 -50,-124" fill="rgba(255,255,255,.35)"/>
          <polygon points="50,-132 0,-107 0,-99 50,-124" fill="rgba(255,255,255,.22)"/>
        </g>
      </g></g>`);
    // 隊伍台座
    const base = (x, y, team) => {
      const c = PIK_COLORS[team];
      add(y, `<g transform="translate(${x} ${y})">
        <ellipse cx="0" cy="34" rx="70" ry="16" fill="rgba(36,48,32,.14)"/>
        ${isoBox(0, -10, 60, 26, c.light, c.body, c.dark)}
        <g transform="translate(0 -10) scale(.95)"><g class="bob" style="animation-delay:${x % 5 * .2}s">${pikmin(team, { sway: true })}</g></g>
      </g>`);
    };

    tree(110, 150, 1.05); tree(1830, 160, 1.1); tree(560, 112, .8); tree(1360, 118, .85); tree(960, 92, .7);
    rock(300, 160); rock(1640, 210, 1.2); rock(760, 330, .9); rock(1180, 380, 1.1);
    ['#ffffff', '#ffb3c7', '#ffffff', '#ffe28a', '#ffb3c7', '#ffffff', '#c6aeff', '#ffffff'].forEach((col, i) => {
      const xs = [210, 420, 690, 880, 1080, 1270, 1500, 1720];
      const ys = [230, 120, 205, 140, 230, 150, 120, 290];
      flower(xs[i], ys[i], col);
    });
    base(330, 260, 'blue'); base(770, 230, 'yellow'); base(1150, 230, 'red'); base(1590, 260, 'purple');
    carry(420, 400, ['red', 'blue', 'yellow'], 'march', ['#f3cf96', '#d9a865', '#b8864a']);
    carry(1500, 410, ['purple', 'yellow', 'blue', 'red'], 'march-2', ['#ffffff', '#e9e4cf', '#cfc8ad']);
    pik(150, 330, 'yellow', .9, .3); pik(210, 360, 'blue', .85, .8);
    pik(960, 300, 'purple', .9, .5); pik(1010, 320, 'red', .85, 1.1);
    pik(1790, 360, 'red', .9, .2); pik(1850, 330, 'blue', .8, .9);
    pik(640, 360, 'blue', .8, .6); pik(1290, 350, 'yellow', .82, 1.3);

    items.sort((a, b) => a.y - b.y);

    $('#deco').innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        <defs>
          <pattern id="tiles" width="160" height="80" patternUnits="userSpaceOnUse" x="0" y="${y0}">
            <rect width="160" height="80" fill="#a6d76c"/>
            <polygon points="80,0 160,40 80,80 0,40" fill="#b4df7d"/>
          </pattern>
          <linearGradient id="floorShade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#ffffff" stop-opacity=".18"/>
            <stop offset="1" stop-color="#2f5e1a" stop-opacity=".22"/>
          </linearGradient>
        </defs>
        <polygon points="${edge}" fill="#7cc24a" transform="translate(0 10)" opacity=".55"/>
        <polygon points="${edge}" fill="url(#tiles)"/>
        <polygon points="${edge}" fill="url(#floorShade)"/>
        <polyline points="${edge.split(' ').slice(0, -2).join(' ')}" fill="none" stroke="#ffffff" stroke-opacity=".6" stroke-width="3"/>
        ${items.map(i => i.svg).join('')}
      </svg>`;
  }

  /* =========================================================
     事件
     ========================================================= */
  actionBtn.addEventListener('click', () => { actionBtn.blur(); advance(); });
  undoBtn.addEventListener('click', () => { undoBtn.blur(); undo(); });
  resetBtn.addEventListener('click', () => { resetBtn.blur(); openModal(); });
  $('#modalCancel').addEventListener('click', closeModal);
  $('#modalOk').addEventListener('click', resetGame);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  document.addEventListener('keydown', e => {
    if (modal.classList.contains('open')) {
      if (e.key === 'Escape') closeModal();
      return;
    }
    const k = e.key;
    if (k === ' ' || k === 'Enter' || k === 'ArrowRight' || k === 'PageDown') {
      e.preventDefault();
      if (!actionBtn.disabled) advance();
    } else if (k === 'ArrowLeft' || k === 'PageUp') {
      e.preventDefault(); goBack();
    } else if (['1', '2', '3', '4'].includes(k)) {
      const t = TEAMS.find(t => t.key === k);
      if (t) score(t.id);
    } else if (k === 'z' || k === 'Z' || k === 'Backspace') {
      e.preventDefault(); undo();
    } else if (k === 'f' || k === 'F') {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
      else document.exitFullscreen?.();
    } else if (k === 'g' || k === 'G') {
      stage.classList.toggle('show-guide');
    }
  });

  /* ---------------- 啟動 ---------------- */
  buildScoreboard();
  buildDeco();
  renderAll();
})();
