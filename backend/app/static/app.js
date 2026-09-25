// Plan C — Unified System Logic v2
// Camera capture for Antam, Gramasi for both Harta & Antam, Daily Dashboard

const state = {
  activeTab: 'harta',
  deviceId: localStorage.getItem('planc_device_id') || '',
  soundEnabled: localStorage.getItem('planc_sound') !== 'false',
  selectedGramasi: localStorage.getItem('planc_gramasi') || '',       // Antam
  selectedHartaGramasi: localStorage.getItem('planc_harta_gramasi') || '', // Harta
  hartaStep: 1,
  currentHarta: { url_harta: '', id_mandiri: '' },
  isSubmittingHarta: false,
  // Camera state
  cameraStream: null,
  facingMode: 'environment', // 'environment'=rear, 'user'=front
  isCapturing: false,
  dashboardDays: 7,
};

// ======================== AUDIO ========================
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playBeep(freq = 880, dur = 0.08, type = 'sine') {
  if (!state.soundEnabled) return;
  try {
    const ctx = getAudioCtx(); if (!ctx) return;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + dur);
  } catch (e) { console.warn(e); }
}

function playSuccessTone() {
  if (!state.soundEnabled) return;
  try {
    const ctx = getAudioCtx(); if (!ctx) return;
    const note = (f, s, d) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(f, ctx.currentTime + s);
      g.gain.setValueAtTime(0.25, ctx.currentTime + s);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + s + d);
      o.connect(g); g.connect(ctx.destination);
      o.start(ctx.currentTime + s); o.stop(ctx.currentTime + s + d);
    };
    note(659.25, 0.0, 0.12); note(1046.5, 0.1, 0.22);
  } catch (e) { console.warn(e); }
}

function playErrorTone() {
  if (!state.soundEnabled) return;
  try {
    const ctx = getAudioCtx(); if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(150, ctx.currentTime);
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.3);
  } catch (e) { console.warn(e); }
}

// ======================== TOAST ========================
function showToast(msg, type = 'success') {
  const container = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icon = type === 'success'
    ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>'
    : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>';
  t.innerHTML = `<svg width="17" height="17" fill="none" stroke="${type==='success'?'#10b981':'#f43f5e'}" viewBox="0 0 24 24">${icon}</svg><span>${msg}</span>`;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3800);
}

// ======================== DOM REFS ========================
const deviceNameInput = document.getElementById('deviceNameInput');
const folderTargetText = document.getElementById('folderTargetText');
const scannerCatcher = document.getElementById('scannerCatcher');
const btnSoundToggle = document.getElementById('btnSoundToggle');
const btnExportMenu = document.getElementById('btnExportMenu');
const exportDropdown = document.getElementById('exportDropdown');

// ======================== INIT ========================
function initApp() {
  if (!state.deviceId) {
    state.deviceId = 'Operator';
    localStorage.setItem('planc_device_id', 'Operator');
  }
  if (deviceNameInput) deviceNameInput.value = state.deviceId;

  if (!state.selectedGramasi) {
    state.selectedGramasi = '1';
    localStorage.setItem('planc_gramasi', '1');
  }
  if (!state.selectedHartaGramasi) {
    state.selectedHartaGramasi = '1';
    localStorage.setItem('planc_harta_gramasi', '1');
  }

  deviceNameInput.addEventListener('input', () => {
    state.deviceId = deviceNameInput.value.trim() || 'Operator';
    localStorage.setItem('planc_device_id', state.deviceId);
    updateFolderText();
  });
  updateFolderText();

  updateSoundIcon();
  btnSoundToggle.addEventListener('click', () => {
    state.soundEnabled = !state.soundEnabled;
    localStorage.setItem('planc_sound', state.soundEnabled);
    updateSoundIcon();
    if (state.soundEnabled) playBeep(880, 0.05);
  });

  btnExportMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    exportDropdown.classList.toggle('open');
  });
  document.addEventListener('click', () => exportDropdown.classList.remove('open'));

  setupTabs();
  setupHartaGramasiSelector();
  setupHartaScanner();
  setupAntamGramasiSelector();
  setupNativeCamera();
  setupDashboard();

  fetchLiveCounters();
  fetchHartaHistory();
  fetchAntamHistory();
  fetchDailyStats();
  setInterval(fetchLiveCounters, 8000);
}

function updateFolderText() {
  const name = state.deviceId || 'nama_anda';
  const el = document.getElementById('folderTargetText');
  if (el) el.textContent = `/photos/${name.replace(/[\\/:*?"<>|]/g,'_')}/`;
}

function updateSoundIcon() {
  btnSoundToggle.classList.toggle('active', state.soundEnabled);
  document.getElementById('iconSoundOn').style.display = state.soundEnabled ? '' : 'none';
  document.getElementById('iconSoundOff').style.display = state.soundEnabled ? 'none' : '';
}

// ======================== TABS ========================
function setupTabs() {
  const tabs = [
    { btn: 'tabHartaBtn',     content: 'tabHartaContent',     key: 'harta' },
    { btn: 'tabAntamBtn',     content: 'tabAntamContent',     key: 'antam' },
    { btn: 'tabDashboardBtn', content: 'tabDashboardContent', key: 'dashboard' },
  ];
  tabs.forEach(tab => {
    document.getElementById(tab.btn).addEventListener('click', () => {
      state.activeTab = tab.key;
      tabs.forEach(t => {
        document.getElementById(t.btn).classList.toggle('active', t.key === tab.key);
        document.getElementById(t.content).classList.toggle('active', t.key === tab.key);
      });
      if (tab.key !== 'antam') stopLiveWebcam();
      if (tab.key === 'harta') focusCatcher();
      if (tab.key === 'dashboard') fetchDailyStats();
    });
  });
}

// ======================== LIVE COUNTER ========================
async function fetchLiveCounters() {
  try {
    const res = await fetch('/api/stats/counter');
    if (!res.ok) throw new Error();
    const data = await res.json();

    document.getElementById('counterHarta').textContent = data.total_harta ?? 0;
    document.getElementById('counterAntam').textContent = data.total_antam ?? 0;
    document.getElementById('counterGram').textContent = data.total_gram_antam ?? data.total_gram ?? 0;

    const dbLine = document.getElementById('dbStatusLine');
    dbLine.textContent = '● Database ONLINE';
    dbLine.style.color = '#10b981';

    renderGramasiBars('gramasiBarsAntam', data.gramasi_breakdown || {}, data.total_antam || 0,
      ['1','5','20','25','50']);
    renderGramasiBars('gramasiBarsHarta', data.harta_gramasi_breakdown || {}, data.total_harta || 0,
      ['1','5','10','20','25','50']);

    const now = new Date().toLocaleTimeString('id-ID');
    document.getElementById('gramasiLastUpdate').textContent = 'Update: ' + now;
    const hEl = document.getElementById('hartaGramasiLastUpdate');
    if (hEl) hEl.textContent = 'Update: ' + now;
  } catch {
    const dbLine = document.getElementById('dbStatusLine');
    dbLine.textContent = '● Database OFFLINE';
    dbLine.style.color = '#f43f5e';
  }
}

function renderGramasiBars(containerId, breakdown, totalCount, order) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const maxCount = Math.max(...order.map(g => (breakdown[g] || {count:0}).count), 1);
  container.innerHTML = order.map(g => {
    const d = breakdown[g] || { count: 0, gram_per_pcs: parseInt(g), total_gram: 0 };
    const pct = totalCount ? Math.round(d.count / totalCount * 100) : 0;
    const barWidth = Math.round(d.count / maxCount * 100);
    return `
      <div class="gramasi-row">
        <div class="gramasi-label">${g}g</div>
        <div class="gramasi-bar-track">
          <div class="gramasi-bar-fill" style="width:${barWidth}%"></div>
        </div>
        <div class="gramasi-count">${d.count} pcs (${pct}%)</div>
        <div class="gramasi-total-g">${d.total_gram}g</div>
      </div>`;
  }).join('');
}

// ======================== HARTA GRAMASI SELECTOR ========================
function setupHartaGramasiSelector() {
  document.querySelectorAll('.harta-gram-btn').forEach(btn => {
    if (btn.dataset.gram === state.selectedHartaGramasi) btn.classList.add('selected');
    btn.addEventListener('click', () => {
      document.querySelectorAll('.harta-gram-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.selectedHartaGramasi = btn.dataset.gram;
      localStorage.setItem('planc_harta_gramasi', state.selectedHartaGramasi);
      const label = document.getElementById('selectedHartaGramasiLabel');
      if (label) label.textContent = `${state.selectedHartaGramasi} gram`;
      playBeep(880, 0.04);
    });
  });
  if (state.selectedHartaGramasi) {
    const label = document.getElementById('selectedHartaGramasiLabel');
    if (label) label.textContent = `${state.selectedHartaGramasi} gram`;
  }
}

// ======================== MODE HARTA (2-STEP) ========================
function focusCatcher() {
  if (state.activeTab === 'harta') scannerCatcher.focus();
}

function setupHartaScanner() {
  document.addEventListener('click', (e) => {
    if (state.activeTab === 'harta' &&
        !e.target.closest('select,button,input,a,.export-dropdown')) {
      focusCatcher();
    }
  });
  focusCatcher();

  scannerCatcher.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = scannerCatcher.value.trim();
      scannerCatcher.value = '';
      if (!val) return;
      handleHartaScan(val);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (state.activeTab === 'harta' && e.key === 'Escape') {
      resetHarta();
      showToast('Scan dibatalkan. Kembali ke Langkah 1.', 'error');
      playErrorTone();
    }
  });
}

function handleHartaScan(value) {
  if (!state.deviceId) {
    showToast('Masukkan nama Anda di kolom atas terlebih dahulu!', 'error');
    playErrorTone();
    deviceNameInput.focus();
    return;
  }
  if (state.hartaStep === 1) {
    state.currentHarta.url_harta = value;
    state.hartaStep = 2;
    playBeep(920, 0.08);
    document.getElementById('previewStep1').textContent = value;
    document.getElementById('step1Card').className = 'step-box glass-panel completed';
    document.getElementById('previewStep2').textContent = 'Menunggu scan ID Mandiri...';
    document.getElementById('step2Card').className = 'step-box glass-panel active';
  } else if (state.hartaStep === 2) {
    state.currentHarta.id_mandiri = value;
    document.getElementById('previewStep2').textContent = value;
    submitHartaBatch();
  }
}

async function submitHartaBatch() {
  if (state.isSubmittingHarta) return;
  state.isSubmittingHarta = true;
  try {
    const res = await fetch('/api/harta/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: state.deviceId,
        url_harta: state.currentHarta.url_harta,
        id_mandiri: state.currentHarta.id_mandiri,
        gramasi: state.selectedHartaGramasi || null
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Gagal menyimpan');

    playSuccessTone();
    const gramInfo = state.selectedHartaGramasi ? ` | ${state.selectedHartaGramasi}g` : '';
    showToast(`✓ Harta #${data.id} tersimpan — ${state.deviceId}${gramInfo}`, 'success');
    fetchLiveCounters();
    fetchHartaHistory();
    resetHarta();
  } catch (err) {
    playErrorTone();
    showToast(err.message, 'error');
    resetHarta();
  } finally {
    state.isSubmittingHarta = false;
    focusCatcher();
  }
}

function resetHarta() {
  state.hartaStep = 1;
  state.currentHarta = { url_harta: '', id_mandiri: '' };
  document.getElementById('previewStep1').textContent = 'Menunggu scan QR Harta...';
  document.getElementById('previewStep2').textContent = 'Menunggu Langkah 1 selesai...';
  document.getElementById('step1Card').className = 'step-box glass-panel active';
  document.getElementById('step2Card').className = 'step-box glass-panel';
}

async function fetchHartaHistory() {
  try {
    const res = await fetch('/api/harta/history?limit=30');
    if (!res.ok) return;
    const data = await res.json();
    document.getElementById('hartaHistoryCount').textContent = `${data.total_records} total data`;
    const tbody = document.getElementById('hartaTableBody');
    if (!data.items?.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:22px">Belum ada data scan Harta.</td></tr>`;
      return;
    }
    tbody.innerHTML = data.items.map(item => `
      <tr>
        <td style="text-align:center;font-family:monospace">${item.id}</td>
        <td style="color:var(--text-muted);font-size:0.8rem">${item.waktu}</td>
        <td><span class="badge-device" title="${item.device_id}">${item.device_id}</span></td>
        <td style="text-align:center">${item.gramasi ? `<span class="badge-gram">${item.gramasi}g</span>` : '<span style="color:var(--text-dim)">–</span>'}</td>
        <td>
          <a href="${item.url_harta}" target="_blank"
             style="color:var(--accent-cyan);text-decoration:none;word-break:break-all;font-size:0.83rem">
            ${item.url_harta}
          </a>
        </td>
        <td style="font-family:'JetBrains Mono',monospace;font-size:0.82rem">${item.id_mandiri}</td>
      </tr>`).join('');
  } catch (e) { console.error(e); }
}

// ======================== ANTAM GRAMASI SELECTOR ========================
function setupAntamGramasiSelector() {
  document.querySelectorAll('.antam-gram-btn').forEach(btn => {
    if (btn.dataset.gram === state.selectedGramasi) btn.classList.add('selected');
    btn.addEventListener('click', () => {
      document.querySelectorAll('.antam-gram-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.selectedGramasi = btn.dataset.gram;
      localStorage.setItem('planc_gramasi', state.selectedGramasi);
      const label = document.getElementById('selectedGramasiLabel');
      if (label) label.textContent = `${state.selectedGramasi} gram`;
      playBeep(880, 0.04);
    });
  });
  if (state.selectedGramasi) {
    const label = document.getElementById('selectedGramasiLabel');
    if (label) label.textContent = `${state.selectedGramasi} gram`;
  }
}

// ======================== VALIDASI ANTAM ========================
function validateAntamReady() {
  // Pastikan nama user / device ada
  if (!state.deviceId) {
    const input = document.getElementById('deviceNameInput');
    const val = input ? input.value.trim() : '';
    if (val) {
      state.deviceId = val;
      localStorage.setItem('planc_device_id', val);
      updateFolderText();
    } else {
      state.deviceId = 'Operator';
      if (input) input.value = 'Operator';
      localStorage.setItem('planc_device_id', 'Operator');
      updateFolderText();
      showToast('ℹ️ Nama diset otomatis "Operator" (dapat diubah di atas)', 'info');
    }
  }

  // Pastikan gramasi ada
  if (!state.selectedGramasi) {
    const btn1 = document.querySelector('.antam-gram-btn[data-gram="1"]');
    if (btn1) {
      btn1.click();
      showToast('ℹ️ Gramasi otomatis dipilih 1 gram', 'info');
    } else {
      state.selectedGramasi = '1';
    }
  }
  return true;
}

// ======================== CAMERA LOGIC (Antam) ========================
function setupNativeCamera() {
  const inputRear    = document.getElementById('cameraInputRear');
  const inputFront   = document.getElementById('cameraInputFront');
  const btnRear      = document.getElementById('btnOpenRear');
  const btnFront     = document.getElementById('btnOpenFront');
  const btnWebcam    = document.getElementById('btnOpenWebcam');
  const btnShutter   = document.getElementById('btnShutterLive');
  const btnCloseLive = document.getElementById('btnCloseLiveCam');

  // Tombol Kamera Belakang (Native HP)
  if (btnRear) {
    btnRear.addEventListener('click', (e) => {
      if (!validateAntamReady()) {
        e.preventDefault();
        return;
      }
      inputRear.value = '';
      setTimeout(() => {
        try { inputRear.click(); } catch (err) { console.warn(err); }
      }, 50);
    });
  }

  // Tombol Kamera Depan (Native HP)
  if (btnFront) {
    btnFront.addEventListener('click', (e) => {
      if (!validateAntamReady()) {
        e.preventDefault();
        return;
      }
      inputFront.value = '';
      setTimeout(() => {
        try { inputFront.click(); } catch (err) { console.warn(err); }
      }, 50);
    });
  }

  // Tombol Kamera Layar Web (Live)
  if (btnWebcam) {
    btnWebcam.addEventListener('click', () => {
      if (!validateAntamReady()) return;
      openLiveWebcam();
    });
  }

  if (btnShutter) {
    btnShutter.addEventListener('click', captureLiveWebcamPhoto);
  }

  if (btnCloseLiveCam) {
    btnCloseLiveCam.addEventListener('click', stopLiveWebcam);
  }

  inputRear.addEventListener('change',  () => handleNativePhoto(inputRear));
  inputFront.addEventListener('change', () => handleNativePhoto(inputFront));
}

// Buka Kamera Live Web (Video Viewfinder di dalam web)
// Jika gagal (misal di HP via HTTP biasa), otomatis fallback langsung ke Kamera Bawaan HP!
async function openLiveWebcam() {
  const box = document.getElementById('liveWebcamBox');
  const video = document.getElementById('camLiveVideo');
  const statusBadge = document.getElementById('camStatusBadge');

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast('⚠️ Kamera Web browser butuh HTTPS di HP. Langsung membuka Kamera HP...', 'info');
    triggerNativeRearCamera();
    return;
  }

  try {
    stopLiveWebcam();
    const constraints = {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    state.cameraStream = stream;
    video.srcObject = stream;
    box.style.display = 'block';
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });

    if (statusBadge) {
      statusBadge.textContent = '● Live Kamera Aktif';
      statusBadge.style.background = 'rgba(245,158,11,0.2)';
      statusBadge.style.color = 'var(--accent-gold)';
    }
    showToast('Kamera Web aktif! Arahkan ke emas & tekan "Ambil Foto".', 'info');
  } catch (err) {
    console.warn('getUserMedia failed:', err);
    showToast('⚠️ Live browser tidak tersedia. Langsung membuka Kamera Bawaan HP...', 'info');
    triggerNativeRearCamera();
  }
}

function stopLiveWebcam() {
  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach(track => track.stop());
    state.cameraStream = null;
  }
  const box = document.getElementById('liveWebcamBox');
  if (box) box.style.display = 'none';
  const video = document.getElementById('camLiveVideo');
  if (video) video.srcObject = null;
  const statusBadge = document.getElementById('camStatusBadge');
  if (statusBadge) {
    statusBadge.textContent = 'Siap Jepret';
    statusBadge.style.background = '';
    statusBadge.style.color = '';
  }
}

function triggerNativeRearCamera() {
  const input = document.getElementById('cameraInputRear');
  if (input) {
    input.value = '';
    input.click();
  }
}

// Jepret dari Video Live Web
async function captureLiveWebcamPhoto() {
  const video = document.getElementById('camLiveVideo');
  const canvas = document.getElementById('camCaptureCanvas');
  if (!video || !video.videoWidth) {
    showToast('Kamera belum siap, tunggu sebentar...', 'error');
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.toBlob(async (blob) => {
    if (!blob) return;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `ANTAM_${state.deviceId}_${state.selectedGramasi}g_${timestamp}.jpg`;
    const file = new File([blob], filename, { type: 'image/jpeg' });
    await uploadAntamFile(file);
  }, 'image/jpeg', 0.92);
}

// Handle foto dari Kamera Native Device (input file capture)
async function handleNativePhoto(input) {
  const file = input.files[0];
  if (!file) return;
  await uploadAntamFile(file);
}

// Fungsi utama kirim foto ke backend FastAPI & Docker
async function uploadAntamFile(file) {
  if (!validateAntamReady()) return;

  // Preview langsung sebelum upload
  const previewUrl = URL.createObjectURL(file);
  const lastImg = document.getElementById('lastCaptureImg');
  if (lastImg) lastImg.src = previewUrl;
  const lastWrap = document.getElementById('lastCaptureWrap');
  if (lastWrap) lastWrap.style.display = 'flex';

  const lastInfo = document.getElementById('lastCaptureInfo');
  if (lastInfo) lastInfo.textContent = `${state.selectedGramasi}g · ${state.deviceId}`;

  const indicator = document.getElementById('uploadingIndicator');
  if (indicator) indicator.style.display = 'block';
  const statusEl = document.getElementById('nativeCamStatus');
  if (statusEl) {
    statusEl.textContent = 'Mengirim foto ke Docker server...';
    statusEl.style.color = 'var(--accent-gold)';
  }

  const btnRear  = document.getElementById('btnOpenRear');
  const btnFront = document.getElementById('btnOpenFront');
  if (btnRear)  btnRear.style.pointerEvents = 'none';
  if (btnFront) btnFront.style.pointerEvents = 'none';

  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `ANTAM_${state.deviceId}_${state.selectedGramasi}g_${timestamp}.${ext}`;

    const formData = new FormData();
    formData.append('device_id', state.deviceId);
    formData.append('gramasi', state.selectedGramasi);
    formData.append('photo', file, filename);

    const res = await fetch('/api/antam/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Gagal mengunggah foto');

    playSuccessTone();
    showToast(`✓ Foto ${state.selectedGramasi}g tersimpan ke folder ${state.deviceId}`, 'success');
    if (statusEl) {
      statusEl.textContent = `✓ Foto ${state.selectedGramasi}g berhasil tersimpan di Docker! Siap jepret berikutnya.`;
      statusEl.style.color = 'var(--accent-green)';
    }

    fetchLiveCounters();
    fetchAntamHistory();
    fetchDailyStats();
  } catch (err) {
    playErrorTone();
    showToast(err.message, 'error');
    if (statusEl) {
      statusEl.textContent = '✗ Gagal kirim foto — coba lagi';
      statusEl.style.color = 'var(--accent-rose)';
    }
  } finally {
    if (indicator) indicator.style.display = 'none';
    if (btnRear)  btnRear.style.pointerEvents = '';
    if (btnFront) btnFront.style.pointerEvents = '';
  }
}

async function fetchAntamHistory() {
  try {
    const res = await fetch('/api/antam/history?limit=30');
    if (!res.ok) return;
    const data = await res.json();
    document.getElementById('antamHistoryCount').textContent = `${data.total_records} total foto`;
    const tbody = document.getElementById('antamTableBody');
    if (!data.items?.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:22px">Belum ada foto Antam diunggah.</td></tr>`;
      return;
    }
    tbody.innerHTML = data.items.map(item => `
      <tr>
        <td style="text-align:center;font-family:monospace">${item.id}</td>
        <td style="text-align:center">
          <a href="${item.url_view}" target="_blank">
            <img src="${item.url_view}" class="photo-thumb" alt="foto"
              onerror="this.src='data:image/svg+xml,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'44\\' height=\\'44\\'><rect width=\\'44\\' height=\\'44\\' fill=\\'%231e293b\\'/></svg>'">
          </a>
        </td>
        <td style="color:var(--text-muted);font-size:0.8rem">${item.waktu}</td>
        <td><span class="badge-device gold" title="${item.device_id}">${item.device_id}</span></td>
        <td style="text-align:center"><span class="badge-gram">${item.gramasi}g</span></td>
        <td style="font-family:'JetBrains Mono',monospace;font-size:0.78rem;color:var(--text-muted)">${item.filename}</td>
      </tr>`).join('');
  } catch (e) { console.error(e); }
}

// ======================== DAILY DASHBOARD ========================
function setupDashboard() {
  document.querySelectorAll('.range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.dashboardDays = parseInt(btn.dataset.days);
      fetchDailyStats();
    });
  });
}

async function fetchDailyStats() {
  try {
    const res = await fetch(`/api/stats/daily?days=${state.dashboardDays}`);
    if (!res.ok) return;
    const data = await res.json();
    renderDailyChart(data.days);
    renderDailyTable(data.days);
    updateTodayCards(data.days);
  } catch (e) { console.error(e); }
}

function updateTodayCards(days) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayData = days.find(d => d.date === todayStr) || { harta: 0, antam: 0, total: 0 };
  document.getElementById('todayHarta').textContent = todayData.harta;
  document.getElementById('todayAntam').textContent = todayData.antam;
  document.getElementById('todayTotal').textContent = todayData.total;
}

function renderDailyChart(days) {
  const wrap = document.getElementById('dailyChartWrap');
  if (!days.length) { wrap.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:2rem">Belum ada data</p>'; return; }

  const maxVal = Math.max(...days.map(d => d.total), 1);
  const recentDays = days.slice(-state.dashboardDays);

  wrap.innerHTML = `
    <div class="daily-chart">
      ${recentDays.map(d => {
        const hartaPct = Math.round((d.harta / maxVal) * 100);
        const antamPct = Math.round((d.antam / maxVal) * 100);
        const label = d.date.slice(5); // MM-DD
        return `
          <div class="chart-col">
            <div class="chart-bars">
              <div class="chart-bar-wrap" title="Harta: ${d.harta}">
                <div class="chart-bar harta-bar" style="height:${hartaPct}%"></div>
              </div>
              <div class="chart-bar-wrap" title="Antam: ${d.antam}">
                <div class="chart-bar antam-bar" style="height:${antamPct}%"></div>
              </div>
            </div>
            <div class="chart-total">${d.total}</div>
            <div class="chart-label">${label}</div>
          </div>`;
      }).join('')}
    </div>
    <div class="chart-legend">
      <span class="legend-dot harta-dot"></span> Harta
      <span class="legend-dot antam-dot" style="margin-left:1rem"></span> Antam
    </div>`;
}

function renderDailyTable(days) {
  const tbody = document.getElementById('dailyTableBody');
  const recentDays = [...days].reverse().slice(0, state.dashboardDays);
  if (!recentDays.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-dim);padding:22px">Belum ada data harian.</td></tr>`;
    return;
  }
  const todayStr = new Date().toISOString().slice(0, 10);
  tbody.innerHTML = recentDays.map(d => {
    const isToday = d.date === todayStr;
    return `<tr ${isToday ? 'class="today-row"' : ''}>
      <td style="font-weight:${isToday?'700':'400'};color:${isToday?'var(--accent-gold)':'inherit'}">
        ${d.date} ${isToday ? '<span style="font-size:0.7rem;background:var(--accent-gold);color:#000;padding:1px 6px;border-radius:4px;margin-left:6px">HARI INI</span>' : ''}
      </td>
      <td style="text-align:center">
        <span class="badge-device">${d.harta}</span>
      </td>
      <td style="text-align:center">
        <span class="badge-device gold">${d.antam}</span>
      </td>
      <td style="text-align:center;font-weight:600;color:var(--text-main)">${d.total}</td>
    </tr>`;
  }).join('');
}

window.addEventListener('DOMContentLoaded', initApp);
