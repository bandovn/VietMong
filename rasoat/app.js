/* =============================================================================
 * Rà soát đất Nông trường Việt Mông — Ứng dụng tĩnh
 * Toàn bộ dữ liệu tải từ file thuadat.geojson
 * Thay đổi của cán bộ rà soát lưu vào localStorage
 * ============================================================================= */

const STORAGE_KEY = 'vietmong_ra_soat_v1';

const COLORS_DX = {
  'BanGiao_BatBuoc':   { fill: '#F7C1C1', stroke: '#791F1F' },
  'BanGiao_DeXuat':    { fill: '#F5C4B3', stroke: '#993C1D' },
  'GiuLai_TheoPA':     { fill: '#9FE1CB', stroke: '#0F6E56' },
  'GiuLai_TheoHD':     { fill: '#C0DD97', stroke: '#3B6D11' },
  'CanRaSoatThem':     { fill: '#FAC775', stroke: '#854F0B' },
  'TamDung_TranhChap': { fill: '#F4C0D1', stroke: '#993556' },
};

const DX_LABELS = {
  'BanGiao_BatBuoc':   'Bàn giao bắt buộc',
  'BanGiao_DeXuat':    'Bàn giao đề xuất',
  'GiuLai_TheoPA':     'Giữ lại theo PA',
  'GiuLai_TheoHD':     'Giữ lại theo HĐ',
  'CanRaSoatThem':     'Cần rà soát thêm',
  'TamDung_TranhChap': 'Tạm dừng (tranh chấp)',
};

const DX_BADGE_CLASS = {
  'BanGiao_BatBuoc':   'badge-bg-batbuoc',
  'BanGiao_DeXuat':    'badge-bg-dexuat',
  'GiuLai_TheoPA':     'badge-gl',
  'GiuLai_TheoHD':     'badge-gl',
  'CanRaSoatThem':     'badge-rasoat',
  'TamDung_TranhChap': 'badge-tranhchap',
};

const A_LABELS = {
  'A0_ChuaXacDinh':  'Chưa xác định',
  'A1_Khoan':        'Khoán theo NĐ 01/135/168',
  'A3_KhoanTrang':   'Khoán trắng',
  'A4_ChoThue_LDLK': 'Cho thuê, LDLK',
  'A5_TuKhaiHoang':  'Tự khai hoang',
  'A6_LanChiem':     'Bị lấn, bị chiếm',
  'A7_TranhChap':    'Đang tranh chấp',
};

/* ============================================================================
 * STATE
 * ============================================================================ */
const state = {
  features: [],               // toàn bộ feature gốc
  edits: {},                  // chỉnh sửa localStorage: { id: { truc_a, ... } }
  map: null,
  geojsonLayer: null,
  highlightLayer: null,
  selectedId: null,
  filters: {
    de_xuat: new Set(['BanGiao_BatBuoc','BanGiao_DeXuat','GiuLai_TheoPA','GiuLai_TheoHD','CanRaSoatThem','TamDung_TranhChap']),
    thon: new Set(),
    truc_a: new Set(),
    ke_khai: new Set(),
    search: '',
  },
  table: {
    sortKey: 'to_bd',
    sortDir: 'asc',
    page: 1,
    pageSize: 50,
    searchText: '',
    filterXa: '',
    filterDx: '',
  },
};

/* ============================================================================
 * Helper - lấy properties hiệu lực (có ghép edits)
 * ============================================================================ */
function effectiveProps(feature) {
  const id = feature.id || feature.properties.id;
  const edit = state.edits[id];
  if (!edit) return feature.properties;
  return { ...feature.properties, ...edit, _edited: true };
}

/* ============================================================================
 * INIT
 * ============================================================================ */
async function init() {
  loadEdits();
  await loadData();
  initMap();
  initFilters();
  initNav();
  initTableControls();
  renderAll();
}

function loadEdits() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state.edits = raw ? JSON.parse(raw) : {};
  } catch (e) {
    state.edits = {};
  }
}
function saveEdits() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.edits));
}

async function loadData() {
  const res = await fetch('thuadat.geojson');
  const data = await res.json();
  state.features = data.features;
  document.getElementById('total-count').textContent = state.features.length.toLocaleString('vi-VN');

  /* Khởi tạo các filter set từ dữ liệu */
  const thonSet = new Set();
  const trucASet = new Set();
  const keKhaiSet = new Set();
  state.features.forEach(f => {
    const p = f.properties;
    if (p.thon) thonSet.add(p.thon);
    if (p.truc_a) trucASet.add(p.truc_a);
    if (p.trang_thai_ke_khai) keKhaiSet.add(p.trang_thai_ke_khai);
  });
  state.filters.thon = new Set(thonSet);
  state.filters.truc_a = new Set(trucASet);
  state.filters.ke_khai = new Set(keKhaiSet);

  renderFilterChecks('filter-thon', 'thon', Array.from(thonSet).sort());
  renderFilterChecks('filter-truc-a', 'truc_a', Array.from(trucASet).sort(), A_LABELS);
  renderFilterChecks('filter-ke-khai', 'ke_khai', Array.from(keKhaiSet).filter(Boolean).sort());
}

function renderFilterChecks(containerId, filterKey, values, labels = {}) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  values.forEach(v => {
    const id = `${filterKey}-${v}`;
    const row = document.createElement('label');
    row.className = 'filter-row';
    row.innerHTML = `
      <input type="checkbox" data-filter="${filterKey}" value="${v}" checked>
      <span>${labels[v] || v}</span>
      <span class="count" data-count="${filterKey}-${v}">—</span>
    `;
    container.appendChild(row);
  });
}

/* ============================================================================
 * MAP
 * ============================================================================ */
function initMap() {
  if (typeof L === 'undefined') {
    document.getElementById('map-loading').innerHTML =
      '<div style="text-align:center;padding:20px;color:var(--danger)">' +
      '⚠️ Không tải được thư viện bản đồ Leaflet<br>' +
      '<span style="font-size:12px;color:var(--text-secondary)">Kiểm tra kết nối Internet. Các view khác (Tra cứu, Thống kê) vẫn hoạt động.</span>' +
      '</div>';
    return;
  }

  state.map = L.map('map', {
    zoomControl: true,
    preferCanvas: true,
  }).setView([21.063, 105.40], 14);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(state.map);

  /* Layer satellite tùy chọn */
  const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: '© Esri'
  });

  L.control.layers({
    'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(state.map),
    'Ảnh vệ tinh': satellite
  }, {}, { position: 'topleft' }).addTo(state.map);

  drawGeoJson();
  document.getElementById('map-loading').classList.add('hidden');
}

function drawGeoJson() {
  if (!state.map) {
    /* Vẫn cập nhật counter dù không có map */
    const filteredFeatures = state.features.filter(passesFilter);
    document.getElementById('visible-count').textContent = filteredFeatures.length.toLocaleString('vi-VN');
    return;
  }
  if (state.geojsonLayer) {
    state.map.removeLayer(state.geojsonLayer);
  }

  const filteredFeatures = state.features.filter(passesFilter);

  state.geojsonLayer = L.geoJSON(filteredFeatures, {
    style: feature => {
      const p = effectiveProps(feature);
      const c = COLORS_DX[p.de_xuat] || { fill: '#D3D1C7', stroke: '#5F5E5A' };
      return {
        fillColor: c.fill,
        color: c.stroke,
        weight: 0.7,
        fillOpacity: 0.65,
      };
    },
    onEachFeature: (feature, layer) => {
      layer.on('click', () => selectThua(feature.id || feature.properties.id, layer));
      layer.on('mouseover', e => e.target.setStyle({ weight: 2 }));
      layer.on('mouseout', e => {
        if (state.selectedId !== (feature.id || feature.properties.id)) {
          state.geojsonLayer.resetStyle(e.target);
        }
      });
    }
  }).addTo(state.map);

  document.getElementById('visible-count').textContent = filteredFeatures.length.toLocaleString('vi-VN');
}

function passesFilter(feature) {
  const p = effectiveProps(feature);
  if (!state.filters.de_xuat.has(p.de_xuat)) return false;
  if (!state.filters.thon.has(p.thon)) return false;
  if (!state.filters.truc_a.has(p.truc_a)) return false;
  if (p.trang_thai_ke_khai && !state.filters.ke_khai.has(p.trang_thai_ke_khai)) {
    /* chỉ filter nếu trạng thái không rỗng */
  }
  if (state.filters.search) {
    const s = state.filters.search.toLowerCase();
    const hay = `${p.chu_sd_2016 || ''} ${p.chu_sd_2022 || ''} ${p.id} ${p.thon} ${p.to_bd} ${p.thua}`.toLowerCase();
    if (!hay.includes(s)) return false;
  }
  return true;
}

function selectThua(id, layer) {
  state.selectedId = id;
  const feature = state.features.find(f => (f.id || f.properties.id) === id);
  if (!feature) return;

  /* Highlight */
  state.geojsonLayer.eachLayer(l => {
    state.geojsonLayer.resetStyle(l);
  });
  if (layer) {
    layer.setStyle({ weight: 3, color: '#0C447C' });
    layer.bringToFront();
  }

  renderThuaDetail(feature);

  /* Trên mobile, mở rightbar dạng bottom sheet */
  if (window.innerWidth <= 767) {
    document.getElementById('rightbar').classList.add('show');
  }
}

function renderThuaDetail(feature) {
  const p = effectiveProps(feature);
  const dx = p.de_xuat;
  const badgeClass = DX_BADGE_CLASS[dx] || 'badge-rasoat';
  const editedMark = p._edited ? '<span style="background:#FAEEDA;color:#854F0B;font-size:10px;padding:2px 6px;border-radius:4px;margin-left:6px">Đã sửa</span>' : '';

  document.getElementById('thua-detail').innerHTML = `
    <div class="thua-detail">
      <div class="thua-header">
        <div class="thua-loc">${p.thon} • Xã ${p.xa}</div>
        <div class="thua-id">Tờ ${p.to_bd} — Thửa ${p.thua}${editedMark}</div>
        <span class="badge ${badgeClass}">${DX_LABELS[dx] || dx}</span>
      </div>

      <div class="detail-grid">
        <div>
          <div class="label">Diện tích đo 2016</div>
          <div class="value">${p.dt_2016 ? p.dt_2016.toLocaleString('vi-VN') + ' m²' : '—'}</div>
        </div>
        <div>
          <div class="label">Loại đất gốc</div>
          <div class="value">${p.loai_dat_2016 || '—'}</div>
        </div>
        <div class="full">
          <div class="label">Chủ sử dụng 2016</div>
          <div class="value">${p.chu_sd_2016 || '—'}</div>
        </div>
        ${p.chu_sd_2022 ? `
        <div class="full">
          <div class="label">Chủ sử dụng 2022</div>
          <div class="value" style="font-size:11px;color:var(--text-secondary)">${p.chu_sd_2022}</div>
        </div>` : ''}
        <div>
          <div class="label">Số thửa con</div>
          <div class="value">${p.so_thua_con || 1}</div>
        </div>
        <div>
          <div class="label">Số công trình</div>
          <div class="value">${p.so_cong_trinh || 0}</div>
        </div>
        ${p.trang_thai_ke_khai ? `
        <div class="full">
          <div class="label">Trạng thái kê khai 2022</div>
          <div class="value">${p.trang_thai_ke_khai}</div>
        </div>` : ''}
        ${p.da_cap_gcn === 1 ? `
        <div class="full">
          <div class="label">Giấy chứng nhận QSDĐ</div>
          <div class="value" style="color:var(--accent)">✓ Đã được cấp</div>
        </div>` : ''}
      </div>

      <div class="classification">
        <div class="classification-label">Phân loại 4 trục</div>
        <div class="classification-tags">
          <span class="tag tag-A">${p.truc_a_text || p.truc_a}</span>
          <span class="tag tag-B">${p.truc_b_text || p.truc_b}</span>
          <span class="tag tag-C">${p.truc_c_text || p.truc_c}</span>
          ${p.so_thua_con > 1 ? `<span class="tag tag-D">D2 — Bị tách (${p.so_thua_con} con)</span>` : '<span class="tag tag-D">D1 — Không tách</span>'}
        </div>
      </div>

      ${p._ghi_chu_ra_soat ? `
      <div style="background:var(--bg-soft);padding:8px 10px;border-radius:6px;margin-bottom:10px;font-size:11px">
        <div style="color:var(--text-secondary);margin-bottom:2px">Ghi chú rà soát</div>
        <div>${escapeHtml(p._ghi_chu_ra_soat)}</div>
        ${p._nguoi_ra_soat ? `<div style="margin-top:4px;color:var(--text-tertiary);font-size:10px">— ${escapeHtml(p._nguoi_ra_soat)}${p._ngay_ra_soat ? ', ' + p._ngay_ra_soat : ''}</div>` : ''}
      </div>` : ''}

      <div class="detail-actions">
        <button class="btn btn-primary" onclick="openEditModal('${feature.id || feature.properties.id}')">
          ✏️ Sửa phân loại / cập nhật rà soát
        </button>
        <button class="btn" onclick="zoomToThua('${feature.id || feature.properties.id}')">
          🔍 Phóng đến thửa
        </button>
        <button class="btn" onclick="printThua('${feature.id || feature.properties.id}')">
          🖨️ In phiếu QR
        </button>
      </div>
    </div>
  `;
}

function zoomToThua(id) {
  const feature = state.features.find(f => (f.id || f.properties.id) === id);
  if (!feature) return;
  const bounds = L.geoJSON(feature).getBounds();
  state.map.fitBounds(bounds, { maxZoom: 18, padding: [50, 50] });
}

function printThua(id) {
  const feature = state.features.find(f => (f.id || f.properties.id) === id);
  if (!feature) return;
  const p = feature.properties;

  /* Tạo cửa sổ in đơn giản — thực tế sẽ dùng QR library, ở đây hiển thị URL có ID */
  const w = window.open('', '_blank', 'width=600,height=800');
  const url = `${window.location.origin}${window.location.pathname}?thua=${encodeURIComponent(id)}`;

  w.document.write(`
    <html><head><title>Phiếu rà soát thửa ${p.to_bd}-${p.thua}</title>
    <style>
    body { font-family: Arial, sans-serif; padding: 30px; max-width: 500px; }
    h1 { font-size: 18px; text-align: center; }
    .info { margin: 12px 0; font-size: 14px; }
    .info label { font-weight: 500; color: #555; display: inline-block; width: 140px; }
    .qr-placeholder { width: 200px; height: 200px; margin: 20px auto; border: 2px solid #333; display: flex; align-items: center; justify-content: center; flex-direction: column; padding: 16px; text-align: center; font-size: 11px; }
    .footer { margin-top: 30px; border-top: 1px solid #ccc; padding-top: 12px; font-size: 11px; color: #888; text-align: center; }
    </style></head>
    <body>
    <h1>PHIẾU RÀ SOÁT THỬA ĐẤT</h1>
    <h2 style="text-align:center;font-size:14px;color:#555">Nông trường Việt Mông — UBND xã Yên Bài</h2>
    <div class="info"><label>Tờ bản đồ:</label> ${p.to_bd}</div>
    <div class="info"><label>Thửa đất:</label> ${p.thua}</div>
    <div class="info"><label>Thôn:</label> ${p.thon}</div>
    <div class="info"><label>Xã:</label> ${p.xa}</div>
    <div class="info"><label>Chủ SD 2016:</label> ${p.chu_sd_2016 || '—'}</div>
    <div class="info"><label>Diện tích đo 2016:</label> ${p.dt_2016 ? p.dt_2016.toLocaleString('vi-VN') + ' m²' : '—'}</div>
    <div class="info"><label>Loại đất:</label> ${p.loai_dat_2016 || '—'}</div>
    <div class="qr-placeholder">
      [Mã QR sẽ được sinh<br>cho ID: ${id}]<br><br>
      <span style="font-size:9px;color:#888">${url}</span>
    </div>
    <h3 style="font-size:13px">Phần cán bộ rà soát:</h3>
    <div style="margin:8px 0;font-size:13px">Chủ SD hiện tại: _____________________________</div>
    <div style="margin:8px 0;font-size:13px">Hiện trạng SD: ❏ Đúng MĐ  ❏ Không đúng MĐ  ❏ Không SD</div>
    <div style="margin:8px 0;font-size:13px">Quan hệ pháp lý: ❏ Khoán có HĐ  ❏ Khoán trắng  ❏ Khai hoang  ❏ Lấn chiếm</div>
    <div style="margin:8px 0;font-size:13px">Số công trình: ____  Loại: ____________________</div>
    <div style="margin:16px 0;font-size:13px">Ghi chú: _________________________________________</div>
    <div style="margin:16px 0;font-size:13px">Chữ ký hộ: ________________ Cán bộ: ________________</div>
    <div class="footer">Ngày in: ${new Date().toLocaleDateString('vi-VN')} • In từ hệ thống rà soát đất Việt Mông</div>
    </body></html>
  `);
  w.document.close();
  setTimeout(() => w.print(), 250);
}

function escapeHtml(s) {
  if (!s) return '';
  return s.replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}

/* ============================================================================
 * MODAL SỬA PHÂN LOẠI
 * ============================================================================ */
let currentEditId = null;

function openEditModal(id) {
  currentEditId = id;
  const feature = state.features.find(f => (f.id || f.properties.id) === id);
  if (!feature) return;
  const p = effectiveProps(feature);

  document.getElementById('edit-thua-id').textContent = `${p.to_bd}-${p.thua}`;
  document.getElementById('edit-truc-a').value = p.truc_a || 'A0_ChuaXacDinh';
  document.getElementById('edit-truc-b').value = p.truc_b || 'B0_KhongRo';
  document.getElementById('edit-truc-c').value = p.truc_c || 'C0_KhongRo';
  document.getElementById('edit-de-xuat').value = p.de_xuat || 'CanRaSoatThem';
  document.getElementById('edit-chu-sd-2022').value = p.chu_sd_2022 || '';
  document.getElementById('edit-ghi-chu').value = p._ghi_chu_ra_soat || '';
  document.getElementById('edit-nguoi-ra-soat').value = p._nguoi_ra_soat || '';
  document.getElementById('edit-ngay-ra-soat').value = p._ngay_ra_soat || new Date().toISOString().slice(0,10);

  document.getElementById('edit-modal').classList.add('show');
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.remove('show');
  currentEditId = null;
}

function saveEditClassification() {
  if (!currentEditId) return;
  const trucA = document.getElementById('edit-truc-a').value;
  const trucB = document.getElementById('edit-truc-b').value;
  const trucC = document.getElementById('edit-truc-c').value;
  const deXuat = document.getElementById('edit-de-xuat').value;

  state.edits[currentEditId] = {
    truc_a: trucA,
    truc_a_text: A_LABELS[trucA] || trucA,
    truc_b: trucB,
    truc_c: trucC,
    de_xuat: deXuat,
    de_xuat_text: DX_LABELS[deXuat] || deXuat,
    chu_sd_2022: document.getElementById('edit-chu-sd-2022').value,
    _ghi_chu_ra_soat: document.getElementById('edit-ghi-chu').value,
    _nguoi_ra_soat: document.getElementById('edit-nguoi-ra-soat').value,
    _ngay_ra_soat: document.getElementById('edit-ngay-ra-soat').value,
    _last_edited: new Date().toISOString(),
  };
  saveEdits();

  /* Cập nhật giao diện */
  renderAll();
  const feature = state.features.find(f => (f.id || f.properties.id) === currentEditId);
  if (feature) renderThuaDetail(feature);

  closeEditModal();
  showToast('✓ Đã lưu thay đổi vào trình duyệt');
}

/* ============================================================================
 * FILTERS
 * ============================================================================ */
function initFilters() {
  document.querySelectorAll('input[data-filter]').forEach(input => {
    input.addEventListener('change', e => {
      const key = e.target.dataset.filter;
      const value = e.target.value;
      if (e.target.checked) {
        state.filters[key].add(value);
      } else {
        state.filters[key].delete(value);
      }
      renderAll();
    });
  });

  document.getElementById('search-input').addEventListener('input', e => {
    state.filters.search = e.target.value.trim();
    renderAll();
  });
}

/* ============================================================================
 * NAV (chuyển view)
 * ============================================================================ */
function initNav() {
  /* Cả nav top (desktop) và bottom nav (mobile) đều dùng chung handler */
  document.querySelectorAll('.nav-btn, .mobile-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      switchView(view);
    });
  });

  /* Hamburger menu - toggle sidebar trên mobile */
  document.querySelector('.topbar').addEventListener('click', e => {
    if (window.innerWidth > 767) return;
    /* Chỉ trigger khi click vùng ::after (hamburger ở góc phải) */
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX > rect.right - 50) {
      toggleSidebar();
    }
  });

  /* Click overlay để đóng sidebar */
  document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);
}

function switchView(view) {
  /* Update active state cho cả 2 nav */
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  document.querySelectorAll('.mobile-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));

  document.getElementById('view-map').classList.toggle('hidden', view !== 'map');
  document.getElementById('view-table').classList.toggle('hidden', view !== 'table');
  document.getElementById('view-dashboard').classList.toggle('hidden', view !== 'dashboard');
  document.getElementById('view-help').classList.toggle('hidden', view !== 'help');

  /* Sidebar và rightbar chỉ show ở view map (trên desktop) */
  if (window.innerWidth > 767) {
    document.getElementById('sidebar').classList.toggle('hidden', view !== 'map');
    document.getElementById('rightbar').classList.toggle('hidden', view !== 'map');
    document.querySelector('.main').classList.toggle('no-sidebar', view !== 'map');
  } else {
    /* Trên mobile, sidebar và rightbar là drawer/sheet — đóng khi đổi view */
    closeSidebar();
    closeRightbarMobile();
  }

  if (view === 'map' && state.map) {
    setTimeout(() => state.map.invalidateSize(), 50);
  }
  if (view === 'table') renderTable();
  if (view === 'dashboard') renderDashboard();
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const isOpen = sidebar.classList.contains('show');
  if (isOpen) {
    closeSidebar();
  } else {
    sidebar.classList.add('show');
    overlay.classList.add('show');
    document.querySelector('.topbar').classList.add('menu-open');
  }
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('show');
  document.getElementById('sidebar-overlay').classList.remove('show');
  document.querySelector('.topbar').classList.remove('menu-open');
}

function closeRightbarMobile() {
  document.getElementById('rightbar').classList.remove('show');
}

/* ============================================================================
 * TABLE VIEW
 * ============================================================================ */
function initTableControls() {
  document.getElementById('table-search').addEventListener('input', e => {
    state.table.searchText = e.target.value.trim().toLowerCase();
    state.table.page = 1;
    renderTable();
  });
  document.getElementById('table-xa').addEventListener('change', e => {
    state.table.filterXa = e.target.value;
    state.table.page = 1;
    renderTable();
  });
  document.getElementById('table-dx').addEventListener('change', e => {
    state.table.filterDx = e.target.value;
    state.table.page = 1;
    renderTable();
  });

  document.querySelectorAll('#thua-table-wrap th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (state.table.sortKey === key) {
        state.table.sortDir = state.table.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.table.sortKey = key;
        state.table.sortDir = 'asc';
      }
      renderTable();
    });
  });
}

function getTableData() {
  let data = state.features.map(f => effectiveProps(f));

  if (state.table.searchText) {
    data = data.filter(p => {
      const h = `${p.chu_sd_2016 || ''} ${p.chu_sd_2022 || ''} ${p.id} ${p.thon}`.toLowerCase();
      return h.includes(state.table.searchText);
    });
  }
  if (state.table.filterXa) data = data.filter(p => p.xa === state.table.filterXa);
  if (state.table.filterDx) data = data.filter(p => p.de_xuat === state.table.filterDx);

  const key = state.table.sortKey;
  const dir = state.table.sortDir === 'asc' ? 1 : -1;
  data.sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
    return String(av).localeCompare(String(bv), 'vi') * dir;
  });

  return data;
}

function renderTable() {
  /* Khởi tạo dropdown nếu chưa */
  const xaSelect = document.getElementById('table-xa');
  if (xaSelect.options.length === 1) {
    const xas = Array.from(new Set(state.features.map(f => f.properties.xa))).sort();
    xas.forEach(xa => {
      const opt = document.createElement('option');
      opt.value = xa; opt.textContent = xa;
      xaSelect.appendChild(opt);
    });
  }
  const dxSelect = document.getElementById('table-dx');
  if (dxSelect.options.length === 1) {
    Object.entries(DX_LABELS).forEach(([k, v]) => {
      const opt = document.createElement('option');
      opt.value = k; opt.textContent = v;
      dxSelect.appendChild(opt);
    });
  }

  const data = getTableData();
  const total = data.length;
  const totalPages = Math.max(1, Math.ceil(total / state.table.pageSize));
  if (state.table.page > totalPages) state.table.page = totalPages;
  const start = (state.table.page - 1) * state.table.pageSize;
  const slice = data.slice(start, start + state.table.pageSize);

  const tbody = document.getElementById('table-body');
  tbody.innerHTML = slice.map(p => `
    <tr onclick="goToThua('${p.id}')">
      <td>${p.xa || ''}</td>
      <td>${p.thon || ''}</td>
      <td>${p.to_bd}</td>
      <td>${p.thua}</td>
      <td>${escapeHtml(p.chu_sd_2016 || '')}</td>
      <td>${p.loai_dat_2016 || ''}</td>
      <td class="num">${p.dt_2016 ? p.dt_2016.toLocaleString('vi-VN') : '—'}</td>
      <td><span class="tag tag-A">${p.truc_a_text || ''}</span></td>
      <td><span class="badge ${DX_BADGE_CLASS[p.de_xuat] || 'badge-rasoat'}">${DX_LABELS[p.de_xuat] || ''}</span></td>
    </tr>
  `).join('');

  document.getElementById('pagination').innerHTML = `
    <div>Hiển thị ${(start+1).toLocaleString('vi-VN')}–${Math.min(start + state.table.pageSize, total).toLocaleString('vi-VN')} / ${total.toLocaleString('vi-VN')} thửa</div>
    <div>
      <button onclick="changePage(-1)" ${state.table.page === 1 ? 'disabled' : ''}>‹ Trước</button>
      <span style="margin:0 8px">Trang ${state.table.page}/${totalPages}</span>
      <button onclick="changePage(1)" ${state.table.page === totalPages ? 'disabled' : ''}>Sau ›</button>
    </div>
  `;
}

function changePage(d) {
  state.table.page = Math.max(1, state.table.page + d);
  renderTable();
}

function goToThua(id) {
  document.querySelector('.nav-btn[data-view="map"]').click();
  setTimeout(() => {
    const feature = state.features.find(f => (f.id || f.properties.id) === id);
    if (!feature) return;
    state.geojsonLayer.eachLayer(l => {
      const fid = l.feature.id || l.feature.properties.id;
      if (fid === id) {
        selectThua(id, l);
        zoomToThua(id);
      }
    });
  }, 200);
}

function exportFilteredCsv() {
  const data = getTableData();
  const headers = ['Xã','Thôn','Tờ BĐ','Thửa','Chủ SD 2016','Chủ SD 2022','Loại đất','DT 2016 (m²)','Trục A','Trục B','Trục C','Đề xuất','Ghi chú rà soát','Người rà soát','Ngày rà soát'];
  const rows = data.map(p => [
    p.xa, p.thon, p.to_bd, p.thua,
    p.chu_sd_2016 || '', p.chu_sd_2022 || '',
    p.loai_dat_2016 || '',
    p.dt_2016 || '',
    p.truc_a_text || p.truc_a || '',
    p.truc_b_text || p.truc_b || '',
    p.truc_c_text || p.truc_c || '',
    p.de_xuat_text || p.de_xuat || '',
    p._ghi_chu_ra_soat || '',
    p._nguoi_ra_soat || '',
    p._ngay_ra_soat || '',
  ]);

  const csv = '\uFEFF' + [headers, ...rows].map(r =>
    r.map(c => {
      const s = String(c).replace(/"/g, '""');
      return /[,;"\n]/.test(s) ? `"${s}"` : s;
    }).join(',')
  ).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `thua_dat_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`✓ Đã xuất ${data.length.toLocaleString('vi-VN')} thửa ra CSV`);
}

/* ============================================================================
 * DASHBOARD
 * ============================================================================ */
function renderDashboard() {
  const features = state.features;
  const props = features.map(f => effectiveProps(f));

  const total = features.length;
  const totalArea = props.reduce((s, p) => s + (p.dt_2016 || 0), 0);

  const bgFeats = props.filter(p => (p.de_xuat || '').startsWith('BanGiao'));
  const glFeats = props.filter(p => (p.de_xuat || '').startsWith('GiuLai'));
  const rsFeats = props.filter(p => p.de_xuat === 'CanRaSoatThem');
  const editedFeats = props.filter(p => p._edited);

  document.getElementById('stat-total').textContent = total.toLocaleString('vi-VN');
  document.getElementById('stat-area').textContent = (totalArea/10000).toLocaleString('vi-VN', {maximumFractionDigits:1}) + ' ha';
  document.getElementById('stat-area-m2').textContent = Math.round(totalArea).toLocaleString('vi-VN') + ' m² đã đo đạc';
  document.getElementById('stat-bg').textContent = bgFeats.length.toLocaleString('vi-VN') + ' thửa';
  document.getElementById('stat-bg-ha').textContent = (bgFeats.reduce((s,p)=>s+(p.dt_2016||0),0)/10000).toLocaleString('vi-VN',{maximumFractionDigits:1}) + ' ha';
  document.getElementById('stat-gl').textContent = glFeats.length.toLocaleString('vi-VN') + ' thửa';
  document.getElementById('stat-gl-ha').textContent = (glFeats.reduce((s,p)=>s+(p.dt_2016||0),0)/10000).toLocaleString('vi-VN',{maximumFractionDigits:1}) + ' ha';
  document.getElementById('stat-rs').textContent = rsFeats.length.toLocaleString('vi-VN') + ' thửa';
  document.getElementById('stat-progress').textContent = (editedFeats.length/total*100).toFixed(1) + '%';

  /* Bảng theo thôn */
  const byThon = {};
  props.forEach(p => {
    const key = `${p.xa}||${p.thon}`;
    if (!byThon[key]) byThon[key] = { xa: p.xa, thon: p.thon, count: 0, area: 0 };
    byThon[key].count++;
    byThon[key].area += p.dt_2016 || 0;
  });
  const tbody = document.querySelector('#table-by-thon tbody');
  tbody.innerHTML = Object.values(byThon)
    .sort((a,b) => b.count - a.count)
    .map(r => `<tr>
      <td>${r.xa}</td><td>${r.thon}</td>
      <td class="num">${r.count.toLocaleString('vi-VN')}</td>
      <td class="num">${(r.area/10000).toLocaleString('vi-VN',{maximumFractionDigits:1})}</td>
    </tr>`).join('');

  /* Trục A chart */
  const byA = {};
  props.forEach(p => { byA[p.truc_a] = (byA[p.truc_a] || 0) + 1; });
  const maxA = Math.max(...Object.values(byA));
  document.getElementById('chart-truc-a').innerHTML = Object.entries(byA)
    .sort((a,b) => b[1] - a[1])
    .map(([k, v]) => `
      <div class="bar-row">
        <div>${A_LABELS[k] || k}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${(v/maxA*100).toFixed(1)}%;background:var(--accent)"></div></div>
        <div class="value">${v.toLocaleString('vi-VN')}</div>
      </div>`).join('');

  /* Kê khai chart */
  const byK = { 'Không biến động':0, 'Chưa kê khai':0, 'Có biến động':0 };
  props.forEach(p => {
    if (p.trang_thai_ke_khai && byK.hasOwnProperty(p.trang_thai_ke_khai)) {
      byK[p.trang_thai_ke_khai]++;
    }
  });
  const maxK = Math.max(...Object.values(byK));
  const KCOLOR = { 'Không biến động':'#0F6E56', 'Chưa kê khai':'#BA7517', 'Có biến động':'#993C1D' };
  document.getElementById('chart-ke-khai').innerHTML = Object.entries(byK)
    .map(([k, v]) => `
      <div class="bar-row">
        <div>${k}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${(v/maxK*100).toFixed(1)}%;background:${KCOLOR[k]}"></div></div>
        <div class="value">${v.toLocaleString('vi-VN')}</div>
      </div>`).join('');
}

/* ============================================================================
 * Render counts trong filter sidebar
 * ============================================================================ */
function renderFilterCounts() {
  const counts = {};
  state.features.forEach(f => {
    const p = effectiveProps(f);
    counts[`dx-${p.de_xuat}`] = (counts[`dx-${p.de_xuat}`] || 0) + 1;
    counts[`thon-${p.thon}`] = (counts[`thon-${p.thon}`] || 0) + 1;
    counts[`truc_a-${p.truc_a}`] = (counts[`truc_a-${p.truc_a}`] || 0) + 1;
    if (p.trang_thai_ke_khai) {
      counts[`ke_khai-${p.trang_thai_ke_khai}`] = (counts[`ke_khai-${p.trang_thai_ke_khai}`] || 0) + 1;
    }
  });
  document.querySelectorAll('[data-count]').forEach(el => {
    const k = el.dataset.count;
    el.textContent = (counts[k] || 0).toLocaleString('vi-VN');
  });
}

/* ============================================================================
 * RENDER ALL
 * ============================================================================ */
function renderAll() {
  drawGeoJson();
  renderFilterCounts();
}

/* ============================================================================
 * TOAST
 * ============================================================================ */
function showToast(msg) {
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#2c2c2a;color:white;padding:10px 18px;border-radius:6px;z-index:3000;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,0.2)';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

/* ============================================================================
 * Khởi chạy
 * ============================================================================ */
document.addEventListener('DOMContentLoaded', init);
