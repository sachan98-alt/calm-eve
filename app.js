const $ = (id) => document.getElementById(id);
const KEY = 'mood_entries_v1';

const load = () => JSON.parse(localStorage.getItem(KEY) || '[]');
const save = (list) => localStorage.setItem(KEY, JSON.stringify(list));

function encourage(mood, note='') {
  if (mood === 'happy') return 'いい流れ🌸 そのまま自分にやさしく！';
  if (mood === 'ok')    return '淡々と進む日も大事。深呼吸して1%だけ前へ。';
  if (note.includes('疲') || note.includes('眠')) return 'おつかれさま。水を一口→ゆっくり3呼吸してね。';
  return 'つらいね…今日は「がんばらない」をがんばる時間。';
}

function calcStreak(list){
  const set = new Set(list.map(e => e.date));
  let count = 0;
  let d = new Date();
  while (set.has(d.toISOString().slice(0,10))) {
    count++;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

// ===== Theme control =====
const THEME_KEY = 'ce_theme'; // 'auto' / 'light' / 'dark'

function getSystemTheme() {
  return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
    ? 'dark' : 'light';
}

function getEffectiveTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'auto';
  return saved === 'auto' ? getSystemTheme() : saved;
}

function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === 'auto') {
    // 自動モード → 端末設定に追従
    root.removeAttribute('data-theme');
  } else {
    // 明示的にライト・ダーク指定
    root.setAttribute('data-theme', mode);
  }
  localStorage.setItem(THEME_KEY, mode);

  // 背景色の再適用（気分色+テーマ反映）
  const latest = load()[0];
  if (latest?.mood) changeBackground(latest.mood);
}

/* ✅ 背景変更（テーマ別のパレット） */
function changeBackground(mood) {
  const effective = getEffectiveTheme();

  const colorsLight = { happy:'#E8F5E9', ok:'#FFFDE7', low:'#E3F2FD' };
  const colorsDark  = { happy:'#203026', ok:'#2A2A1D', low:'#1B2430' }; // ← 修正

  const palette = (effective === 'dark') ? colorsDark : colorsLight;
  const color = palette[mood] || (effective === 'dark' ? '#111315' : '#FAF9F6');

  document.documentElement.style.setProperty('--bg', color);
}

function ymd(date) { return date.toISOString().slice(0, 10); }

function lastNDates(n) {
  const arr = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    arr.push(d);
  }
  return arr;
}

function moodScore(mood) {
  if (mood === 'happy') return 2;
  if (mood === 'ok')    return 1;
  if (mood === 'low')   return 0;
  return null;
}

let moodChart = null;
function drawChart() {
  if (!window.Chart) return;

  const entries = load();
  const days = lastNDates(7);
  const labels = days.map(d => `${d.getMonth() + 1}/${d.getDate()}`);

  const dayData = days.map(d => {
    const dateStr = ymd(d);
    const hit = entries.find(e => e.date === dateStr);
    return hit ? moodScore(hit.mood) : null;
  });

  if (moodChart) moodChart.destroy();

  const ctx = $('moodChart').getContext('2d');
  moodChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: '気分スコア（0=しんどい, 1=ふつう, 2=よき）',
        data: dayData,
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 4,
        spanGaps: true
      }]
    },
    options: {
      responsive: true,
      scales: { y: { min: 0, max: 2, ticks: { stepSize: 1 } } },
      plugins: { legend: { display: true } }
    }
  });
}

function render() {
  const data = load();

  // 初期表示時も直近の気分色を反映
  if (data[0]?.mood) changeBackground(data[0].mood);

  const list = $('list');
  list.innerHTML = '';
  data.slice(0, 7).forEach(e => {
    const div = document.createElement('div');
    div.className = 'card';
    const emoji = e.mood === 'happy' ? '😄' : e.mood === 'ok' ? '😐' : '😞';
    div.innerHTML = `<b>${e.date}</b> ${emoji} ${e.mood}<br>${e.note || ''}`;
    list.appendChild(div);
  });

  drawChart();
}

$('saveBtn').onclick = () => {
  const mood = $('mood').value;
  const note = $('note').value.trim();
  const date = new Date().toISOString().slice(0, 10);

  const rest = load().filter(e => e.date !== date);
  const next = [{ date, mood, note }, ...rest];
  save(next);

  changeBackground(mood);

  const streak = calcStreak(next);
  const box = $('msg');
  box.textContent = `AIからひとこと：${encourage(mood, note)} / 連続${streak}日📅`;
  box.style.display = 'block';
  $('note').value = '';

  render();
};

// ----------------------------
// 🌙 Calm Eve：ホーム画面に追加（A2HS）
// ----------------------------
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('installBtn');
  if (!isStandalone() && !localStorage.getItem('ce_installed')) {
    btn.style.display = 'block';
  }
});

document.getElementById('installBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('installBtn');
  btn.style.display = 'none';
  if (!deferredPrompt) return;
  await deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  if (choice.outcome !== 'accepted') {
    localStorage.setItem('ce_install_dismissed', '1');
  }
});

window.addEventListener('appinstalled', () => {
  localStorage.setItem('ce_installed', '1');
  const btn = document.getElementById('installBtn');
  if (btn) btn.style.display = 'none';
});

function isStandalone() {
  if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
  if (window.navigator.standalone) return true; // iOS
  return false;
}

// --- iOS Safari 向けヒント表示 ---
(function iosInstallTip() {
  const ua = navigator.userAgent.toLowerCase();
  const isiOS = /iphone|ipad|ipod/.test(ua);

  const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
                  || window.navigator.standalone;

  const dismissed = localStorage.getItem('ce_ios_tip_dismissed') === '1';
  const installed = localStorage.getItem('ce_installed') === '1';

  if (isiOS && !standalone && !dismissed && !installed) {
    const tip = document.getElementById('iosTip');
    if (tip) tip.style.display = 'block';
  }

  document.getElementById('iosTipClose')?.addEventListener('click', () => {
    const tip = document.getElementById('iosTip');
    if (tip) tip.style.display = 'none';
    localStorage.setItem('ce_ios_tip_dismissed', '1');
  });

  window.addEventListener('appinstalled', () => {
    const tip = document.getElementById('iosTip');
    if (tip) tip.style.display = 'none';
    localStorage.setItem('ce_installed', '1');
  });
})();

// ===== 初期化：テーマセレクタと保存値の同期 =====
(function initTheme() {
  const select = document.getElementById('themeSelect');
  if(!select) return;

  const saved = localStorage.getItem(THEME_KEY) || 'auto';
  select.value = saved;
  applyTheme(saved);

  // セレクタ変更で即反映
  select.addEventListener('change', () => applyTheme(select.value));

  // Auto の時は OS 変更にも追従
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener?.('change', () => {
      if ((localStorage.getItem(THEME_KEY) || 'auto') === 'auto') {
        applyTheme('auto');
      }
    });
  }
})();

// ===== Backup / Restore =====

// ✅ バックアップ（JSONダウンロード）
document.getElementById('exportBtn')?.addEventListener('click', () => {
  const data = load();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `calm-eve-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
});

// ✅ 復元（ファイル選択ダイアログを開く）
document.getElementById('importBtn')?.addEventListener('click', () => {
  document.getElementById('importFile')?.click();
});

// ✅ 復元（読み込み・置換 or マージ）
document.getElementById('importFile')?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const incoming = JSON.parse(text);
    if (!Array.isArray(incoming)) throw new Error('Invalid JSON shape');

    const mode = window.prompt('復元モードを入力してください：\n"replace" → データを置き換え\n"merge" → 日付ごとにマージ', 'merge');
    if (!mode) return;

    const current = load();
    let next;

    if (mode.toLowerCase() === 'replace') {
      next = incoming; // 🔄 全置き換え
    } else {
      // 🤝 マージ（同じ日付はバックアップ側を優先）
      const byDate = new Map();
      current.forEach(e => byDate.set(e.date, e));
      incoming.forEach(e => byDate.set(e.date, e));
      next = Array.from(byDate.values())
        .filter(e => e?.date && e?.mood)
        .sort((a,b) => b.date.localeCompare(a.date));
    }

    save(next);
    render();
    alert('復元が完了しました！');
    e.target.value = '';
  } catch (err) {
    console.error(err);
    alert('JSONの形式が正しくありませんでした。');
  }
});
