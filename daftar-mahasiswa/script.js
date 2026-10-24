/**
 * Student Portal - Daftar Mahasiswa
 * JavaScript Native ES6+ (Fetch API, DOM API, Tanpa Library Eksternal)
 */

(function () {
  'use strict';

  // --- Konfigurasi Endpoint API ---
  const API_ENDPOINT = 'https://api-web.dnccudinus.org/api/mahasiswa';

  // --- State Aplikasi ---
  const state = {
    allStudents: [],
    filteredStudents: [],
    meta: {
      total: 0,
      ruang: 'public',
      message: ''
    },
    filter: {
      search: '',
      angkatan: 'all',
      jurusan: 'all',
      sort: 'nama-asc'
    },
    isLoading: false,
    selectedStudent: null,
    lastSync: null
  };

  // --- Palette Warna untuk Avatar & Tag Jurusan ---
  const AVATAR_COLORS = [
    '#2563EB', '#0D9488', '#E11D48', '#D97706',
    '#7C3AED', '#059669', '#DB2777', '#4F46E5',
    '#0284C7', '#CA8A04'
  ];

  const JURUSAN_STYLES = {
    'Teknik Informatika': { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
    'Sistem Informasi': { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' },
    'Desain Komunikasi Visual': { bg: '#FDF2F8', text: '#BE185D', border: '#FBCFE8' },
    'Akuntansi': { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
    'Manajemen': { bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' }
  };

  // --- Selektor DOM ---
  const dom = {
    // Nav & Sidebar
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebarOverlay'),
    mobileToggleBtn: document.getElementById('mobileToggleBtn'),
    sidebarCloseBtn: document.getElementById('sidebarCloseBtn'),

    // Top Header & Status
    statusPill: document.getElementById('statusPill'),
    statusText: document.getElementById('statusText'),
    refreshBtn: document.getElementById('refreshBtn'),
    refreshIcon: document.getElementById('refreshIcon'),
    lastSyncText: document.getElementById('lastSyncText'),
    exportBtn: document.getElementById('exportBtn'),

    // Statistik
    statTotalMahasiswa: document.getElementById('statTotalMahasiswa'),
    statTotalJurusan: document.getElementById('statTotalJurusan'),
    statAngkatanDominan: document.getElementById('statAngkatanDominan'),
    statRuang: document.getElementById('statRuang'),

    // Filter Toolbar
    searchInput: document.getElementById('searchInput'),
    searchClearBtn: document.getElementById('searchClearBtn'),
    filterAngkatan: document.getElementById('filterAngkatan'),
    filterJurusan: document.getElementById('filterJurusan'),
    sortSelect: document.getElementById('sortSelect'),
    resetFiltersBtn: document.getElementById('resetFiltersBtn'),
    resultCountBadge: document.getElementById('resultCountBadge'),

    // Table & States
    tableCard: document.getElementById('tableCard'),
    tableBody: document.getElementById('studentTableBody'),
    skeletonRows: document.getElementById('skeletonRows'),
    emptyState: document.getElementById('emptyState'),
    errorState: document.getElementById('errorState'),
    errorMessage: document.getElementById('errorMessage'),
    retryBtn: document.getElementById('retryBtn'),
    emptyResetBtn: document.getElementById('emptyResetBtn'),

    // Modal
    studentModal: document.getElementById('studentModal'),
    modalCloseBtn: document.getElementById('modalCloseBtn'),
    modalAvatar: document.getElementById('modalAvatar'),
    modalNama: document.getElementById('modalNama'),
    modalNimBadge: document.getElementById('modalNimBadge'),
    modalDetailId: document.getElementById('modalDetailId'),
    modalDetailRuang: document.getElementById('modalDetailRuang'),
    modalDetailNim: document.getElementById('modalDetailNim'),
    modalDetailNama: document.getElementById('modalDetailNama'),
    modalDetailJurusan: document.getElementById('modalDetailJurusan'),
    modalDetailAngkatan: document.getElementById('modalDetailAngkatan'),
    modalDetailCreatedAt: document.getElementById('modalDetailCreatedAt'),
    modalDetailUpdatedAt: document.getElementById('modalDetailUpdatedAt'),
    modalCopyNimBtn: document.getElementById('modalCopyNimBtn'),

    // Toast Container
    toastContainer: document.getElementById('toastContainer')
  };

  // --- Helper Functions ---

  /**
   * Mengamankan teks dari karakter berbahaya XSS
   */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Menghasilkan inisial dari nama mahasiswa (contoh: "Clarissa Aurelia" -> "CA")
   */
  function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /**
   * Menghasilkan warna konsisten untuk nama mahasiswa berdasarkan hash
   */
  function getAvatarColor(name) {
    if (!name) return AVATAR_COLORS[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % AVATAR_COLORS.length;
    return AVATAR_COLORS[index];
  }

  /**
   * Format tanggal ISO ke format bahasa Indonesia
   */
  function formatIndonesianDate(isoString) {
    if (!isoString) return '-';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return isoString;
      return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch {
      return isoString;
    }
  }

  /**
   * Format waktu lengkap untuk modal
   */
  function formatFullDateTime(isoString) {
    if (!isoString) return '-';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return isoString;
      return new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
      }).format(date);
    } catch {
      return isoString;
    }
  }

  /**
   * Menampilkan toast notification
   */
  function showToast(message, type = 'info') {
    if (!dom.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    } else {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    }

    toast.innerHTML = `${iconSvg}<span>${escapeHtml(message)}</span>`;
    dom.toastContainer.appendChild(toast);

    // Animasi tampil
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // --- Update Status Bar ---
  function updateApiStatus(statusType, label) {
    if (!dom.statusPill || !dom.statusText) return;
    dom.statusPill.className = `status-pill ${statusType}`;
    dom.statusText.textContent = label;
  }

  // --- Normalisasi Data API ---
  function normalizeStudentData(item) {
    return {
      id: Number(item.id) || 0,
      ruang: String(item.ruang || 'public').trim(),
      nim: String(item.nim || '-').trim(),
      nama: String(item.nama || '-').trim(),
      jurusan: String(item.jurusan || '-').trim(),
      angkatan: Number(item.angkatan) || 0,
      created_at: item.created_at || '',
      updated_at: item.updated_at || ''
    };
  }

  // --- Fetch Data dari API ---
  async function fetchMahasiswa() {
    if (state.isLoading) return;
    state.isLoading = true;

    // Tampilkan Loading State di UI
    updateApiStatus('loading', 'Menghubungkan API...');
    if (dom.refreshIcon) dom.refreshIcon.classList.add('spin');
    showSkeleton(true);
    hideError();
    hideEmpty();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText || 'Gagal mengambil data'}`);
      }

      const json = await response.json();

      // Validasi struktur respons sesuai kontrak
      let rawList = [];
      if (Array.isArray(json)) {
        rawList = json;
      } else if (json && Array.isArray(json.data)) {
        rawList = json.data;
        state.meta.total = json.total || rawList.length;
        state.meta.ruang = json.ruang || 'public';
        state.meta.message = json.message || '';
      } else {
        throw new Error('Format data API tidak sesuai ekspektasi (data array tidak ditemukan)');
      }

      // Normalisasi setiap record mahasiswa
      state.allStudents = rawList.map(normalizeStudentData);
      state.lastSync = new Date();

      updateApiStatus('online', 'API Terhubung');
      if (dom.lastSyncText) {
        dom.lastSyncText.textContent = `Sinkronisasi: ${new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(state.lastSync)}`;
      }

      // Perbarui dropdown filter secara dinamis sesuai data nyata
      populateDynamicFilters();

      // Perbarui statistik kartu
      updateStatistics();

      // Jalankan filter & render data
      applyFilters();

      showToast(`Berhasil memuat ${state.allStudents.length} data mahasiswa`, 'success');
    } catch (err) {
      console.error('API Fetch Error:', err);
      updateApiStatus('error', 'API Terputus');
      showError(err.name === 'AbortError' ? 'Koneksi ke API batas waktu habis (Timeout).' : err.message);
      showToast('Gagal memuat data dari API', 'error');
    } finally {
      clearTimeout(timeoutId);
      state.isLoading = false;
      showSkeleton(false);
      if (dom.refreshIcon) dom.refreshIcon.classList.remove('spin');
    }
  }

  // --- Perbarui Kartu Statistik ---
  function updateStatistics() {
    const list = state.allStudents;
    const total = list.length;

    // 1. Total Mahasiswa
    if (dom.statTotalMahasiswa) {
      dom.statTotalMahasiswa.textContent = total.toLocaleString('id-ID');
    }

    // 2. Total Jurusan Unik
    const jurusans = new Set(list.map(s => s.jurusan).filter(Boolean));
    if (dom.statTotalJurusan) {
      dom.statTotalJurusan.textContent = jurusans.size.toLocaleString('id-ID');
    }

    // 3. Angkatan Terbanyak / Dominan
    const angkatanCounts = {};
    list.forEach(s => {
      if (s.angkatan) {
        angkatanCounts[s.angkatan] = (angkatanCounts[s.angkatan] || 0) + 1;
      }
    });

    let dominantYear = '-';
    let maxCount = 0;
    for (const [year, count] of Object.entries(angkatanCounts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantYear = year;
      }
    }

    if (dom.statAngkatanDominan) {
      dom.statAngkatanDominan.textContent = dominantYear !== '-' ? `${dominantYear}` : '-';
    }

    // 4. Ruang Aktif
    if (dom.statRuang) {
      dom.statRuang.textContent = state.meta.ruang || 'public';
    }
  }

  // --- Populate Dynamic Filters ---
  function populateDynamicFilters() {
    // Dropdown Angkatan
    const angkatanSet = new Set(state.allStudents.map(s => s.angkatan).filter(Boolean));
    const sortedAngkatan = Array.from(angkatanSet).sort((a, b) => b - a);

    if (dom.filterAngkatan) {
      const currentVal = dom.filterAngkatan.value;
      dom.filterAngkatan.innerHTML = '<option value="all">Semua Angkatan</option>';
      sortedAngkatan.forEach(yr => {
        const opt = document.createElement('option');
        opt.value = String(yr);
        opt.textContent = `Angkatan ${yr}`;
        dom.filterAngkatan.appendChild(opt);
      });
      if (sortedAngkatan.map(String).includes(currentVal)) {
        dom.filterAngkatan.value = currentVal;
      }
    }

    // Dropdown Jurusan
    const jurusanSet = new Set(state.allStudents.map(s => s.jurusan).filter(Boolean));
    const sortedJurusan = Array.from(jurusanSet).sort((a, b) => a.localeCompare(b));

    if (dom.filterJurusan) {
      const currentVal = dom.filterJurusan.value;
      dom.filterJurusan.innerHTML = '<option value="all">Semua Program Studi</option>';
      sortedJurusan.forEach(j => {
        const opt = document.createElement('option');
        opt.value = j;
        opt.textContent = j;
        dom.filterJurusan.appendChild(opt);
      });
      if (sortedJurusan.includes(currentVal)) {
        dom.filterJurusan.value = currentVal;
      }
    }
  }

  // --- Filter & Sorting Logic ---
  function applyFilters() {
    const { search, angkatan, jurusan, sort } = state.filter;
    const query = search.trim().toLowerCase();

    let result = state.allStudents.filter(student => {
      // 1. Pencarian teks (Nama, NIM, Jurusan)
      const matchesSearch = !query ||
        student.nama.toLowerCase().includes(query) ||
        student.nim.toLowerCase().includes(query) ||
        student.jurusan.toLowerCase().includes(query);

      // 2. Filter Angkatan
      const matchesAngkatan = (angkatan === 'all') || (String(student.angkatan) === String(angkatan));

      // 3. Filter Jurusan
      const matchesJurusan = (jurusan === 'all') || (student.jurusan === jurusan);

      return matchesSearch && matchesAngkatan && matchesJurusan;
    });

    // Urutkan (Sorting)
    result.sort((a, b) => {
      switch (sort) {
        case 'nama-asc':
          return a.nama.localeCompare(b.nama);
        case 'nama-desc':
          return b.nama.localeCompare(a.nama);
        case 'nim-asc':
          return a.nim.localeCompare(b.nim);
        case 'nim-desc':
          return b.nim.localeCompare(a.nim);
        case 'angkatan-desc':
          return (b.angkatan || 0) - (a.angkatan || 0);
        case 'angkatan-asc':
          return (a.angkatan || 0) - (b.angkatan || 0);
        default:
          return 0;
      }
    });

    state.filteredStudents = result;
    renderTable();
    updateResultBadge();
  }

  function updateResultBadge() {
    if (!dom.resultCountBadge) return;
    const total = state.allStudents.length;
    const count = state.filteredStudents.length;
    dom.resultCountBadge.textContent = `Menampilkan ${count} dari ${total} mahasiswa`;

    // Tampilkan tombol reset filter bila ada filter aktif
    const hasActiveFilter = state.filter.search || state.filter.angkatan !== 'all' || state.filter.jurusan !== 'all';
    if (dom.resetFiltersBtn) {
      dom.resetFiltersBtn.style.display = hasActiveFilter ? 'inline-flex' : 'none';
    }
  }

  // --- Render Tabel Mahasiswa ---
  function renderTable() {
    if (!dom.tableBody) return;

    if (state.filteredStudents.length === 0) {
      dom.tableBody.innerHTML = '';
      if (!state.isLoading) {
        showEmpty(true);
      }
      return;
    }

    hideEmpty();

    const rowsHtml = state.filteredStudents.map((student, index) => {
      const initials = getInitials(student.nama);
      const avatarBg = getAvatarColor(student.nama);
      const jurusanStyle = JURUSAN_STYLES[student.jurusan] || { bg: '#F1F5F9', text: '#334155', border: '#E2E8F0' };
      const formattedDate = formatIndonesianDate(student.created_at);

      return `
        <tr data-student-id="${student.id}">
          <td style="color: var(--text-muted); font-size: 0.8rem; font-weight: 600; width: 44px; text-align: center;">
            ${index + 1}
          </td>
          <td>
            <div class="student-profile">
              <div class="student-avatar" style="background-color: ${avatarBg};">
                ${initials}
              </div>
              <div class="student-name-group">
                <span class="student-name">${escapeHtml(student.nama)}</span>
                <span class="student-subtext">ID: #${student.id}</span>
              </div>
            </div>
          </td>
          <td>
            <span class="badge-nim">${escapeHtml(student.nim)}</span>
          </td>
          <td>
            <span class="badge-jurusan" style="background-color: ${jurusanStyle.bg}; color: ${jurusanStyle.text}; border: 1px solid ${jurusanStyle.border};">
              ${escapeHtml(student.jurusan)}
            </span>
          </td>
          <td>
            <span class="badge-angkatan">${student.angkatan || '-'}</span>
          </td>
          <td>
            <span class="badge-ruang">${escapeHtml(student.ruang)}</span>
          </td>
          <td style="color: var(--text-secondary); font-size: 0.82rem; white-space: nowrap;">
            ${formattedDate}
          </td>
          <td>
            <div class="table-actions">
              <button type="button" class="btn btn-outline btn-sm action-detail-btn" data-id="${student.id}" title="Lihat detail mahasiswa">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                <span>Detail</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    dom.tableBody.innerHTML = rowsHtml;
  }

  // --- State Visual Handlers ---
  function showSkeleton(show) {
    if (dom.skeletonRows) {
      dom.skeletonRows.style.display = show ? 'table-row-group' : 'none';
    }
    if (show && dom.tableBody) {
      dom.tableBody.innerHTML = '';
    }
  }

  function showEmpty(show) {
    if (dom.emptyState) {
      dom.emptyState.style.display = show ? 'flex' : 'none';
    }
  }

  function hideEmpty() {
    if (dom.emptyState) {
      dom.emptyState.style.display = 'none';
    }
  }

  function showError(msg) {
    if (dom.errorState && dom.errorMessage) {
      dom.errorMessage.textContent = msg;
      dom.errorState.style.display = 'flex';
    }
    if (dom.tableBody) {
      dom.tableBody.innerHTML = '';
    }
  }

  function hideError() {
    if (dom.errorState) {
      dom.errorState.style.display = 'none';
    }
  }

  // --- Modal Detail Mahasiswa ---
  function openModal(studentId) {
    const student = state.allStudents.find(s => s.id === Number(studentId));
    if (!student || !dom.studentModal) return;

    state.selectedStudent = student;

    // Render data modal
    const initials = getInitials(student.nama);
    const avatarBg = getAvatarColor(student.nama);

    if (dom.modalAvatar) {
      dom.modalAvatar.textContent = initials;
      dom.modalAvatar.style.backgroundColor = avatarBg;
    }

    if (dom.modalNama) dom.modalNama.textContent = student.nama;
    if (dom.modalNimBadge) dom.modalNimBadge.textContent = student.nim;

    if (dom.modalDetailId) dom.modalDetailId.textContent = `#${student.id}`;
    if (dom.modalDetailRuang) dom.modalDetailRuang.textContent = student.ruang;
    if (dom.modalDetailNim) dom.modalDetailNim.textContent = student.nim;
    if (dom.modalDetailNama) dom.modalDetailNama.textContent = student.nama;
    if (dom.modalDetailJurusan) dom.modalDetailJurusan.textContent = student.jurusan;
    if (dom.modalDetailAngkatan) dom.modalDetailAngkatan.textContent = student.angkatan || '-';
    if (dom.modalDetailCreatedAt) dom.modalDetailCreatedAt.textContent = formatFullDateTime(student.created_at);
    if (dom.modalDetailUpdatedAt) dom.modalDetailUpdatedAt.textContent = formatFullDateTime(student.updated_at);

    // Buka modal
    dom.studentModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!dom.studentModal) return;
    dom.studentModal.classList.remove('active');
    document.body.style.overflow = '';
    state.selectedStudent = null;
  }

  // Salin NIM ke Clipboard
  function copyStudentNim() {
    if (!state.selectedStudent) return;
    const nim = state.selectedStudent.nim;
    navigator.clipboard.writeText(nim).then(() => {
      showToast(`NIM ${nim} berhasil disalin!`, 'success');
    }).catch(() => {
      showToast('Gagal menyalin NIM', 'error');
    });
  }

  // --- Ekspor ke CSV ---
  function exportToCsv() {
    const list = state.filteredStudents;
    if (list.length === 0) {
      showToast('Tidak ada data mahasiswa untuk diekspor', 'info');
      return;
    }

    const headers = ['ID', 'Ruang', 'NIM', 'Nama', 'Program Studi', 'Angkatan', 'Waktu Dibuat', 'Waktu Diperbarui'];
    const rows = list.map(s => [
      s.id,
      `"${s.ruang.replace(/"/g, '""')}"`,
      `"${s.nim.replace(/"/g, '""')}"`,
      `"${s.nama.replace(/"/g, '""')}"`,
      `"${s.jurusan.replace(/"/g, '""')}"`,
      s.angkatan,
      `"${s.created_at}"`,
      `"${s.updated_at}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `daftar-mahasiswa-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Berhasil mengekspor ${list.length} data ke format CSV`, 'success');
  }

  // --- Event Listeners Setup ---
  function setupEventListeners() {
    // 1. Refresh Button
    if (dom.refreshBtn) {
      dom.refreshBtn.addEventListener('click', () => {
        fetchMahasiswa();
      });
    }

    // 2. Retry Button pada Error State
    if (dom.retryBtn) {
      dom.retryBtn.addEventListener('click', () => {
        fetchMahasiswa();
      });
    }

    // 3. Search Input dengan Debounce
    let searchTimeout;
    if (dom.searchInput) {
      dom.searchInput.addEventListener('input', (e) => {
        const val = e.target.value;
        state.filter.search = val;

        if (dom.searchClearBtn) {
          dom.searchClearBtn.style.display = val ? 'flex' : 'none';
        }

        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          applyFilters();
        }, 180);
      });
    }

    // 4. Clear Search Button
    if (dom.searchClearBtn) {
      dom.searchClearBtn.addEventListener('click', () => {
        if (dom.searchInput) dom.searchInput.value = '';
        state.filter.search = '';
        dom.searchClearBtn.style.display = 'none';
        applyFilters();
      });
    }

    // 5. Filter Angkatan
    if (dom.filterAngkatan) {
      dom.filterAngkatan.addEventListener('change', (e) => {
        state.filter.angkatan = e.target.value;
        applyFilters();
      });
    }

    // 6. Filter Jurusan
    if (dom.filterJurusan) {
      dom.filterJurusan.addEventListener('change', (e) => {
        state.filter.jurusan = e.target.value;
        applyFilters();
      });
    }

    // 7. Sort Dropdown
    if (dom.sortSelect) {
      dom.sortSelect.addEventListener('change', (e) => {
        state.filter.sort = e.target.value;
        applyFilters();
      });
    }

    // 8. Reset Filters Button
    const resetAllFilters = () => {
      state.filter.search = '';
      state.filter.angkatan = 'all';
      state.filter.jurusan = 'all';
      state.filter.sort = 'nama-asc';

      if (dom.searchInput) dom.searchInput.value = '';
      if (dom.searchClearBtn) dom.searchClearBtn.style.display = 'none';
      if (dom.filterAngkatan) dom.filterAngkatan.value = 'all';
      if (dom.filterJurusan) dom.filterJurusan.value = 'all';
      if (dom.sortSelect) dom.sortSelect.value = 'nama-asc';

      applyFilters();
      showToast('Filter pencarian telah direset', 'info');
    };

    if (dom.resetFiltersBtn) {
      dom.resetFiltersBtn.addEventListener('click', resetAllFilters);
    }
    if (dom.emptyResetBtn) {
      dom.emptyResetBtn.addEventListener('click', resetAllFilters);
    }

    // 9. Delegasi Klik Tombol Detail pada Baris Tabel
    if (dom.tableBody) {
      dom.tableBody.addEventListener('click', (e) => {
        const detailBtn = e.target.closest('.action-detail-btn');
        if (detailBtn) {
          const id = detailBtn.getAttribute('data-id');
          openModal(id);
        }
      });
    }

    // 10. Modal Close & Backdrop
    if (dom.modalCloseBtn) {
      dom.modalCloseBtn.addEventListener('click', closeModal);
    }

    if (dom.studentModal) {
      dom.studentModal.addEventListener('click', (e) => {
        if (e.target === dom.studentModal) {
          closeModal();
        }
      });
    }

    // Escape Key untuk menutup Modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dom.studentModal && dom.studentModal.classList.contains('active')) {
        closeModal();
      }
    });

    // 11. Copy NIM Button pada Modal
    if (dom.modalCopyNimBtn) {
      dom.modalCopyNimBtn.addEventListener('click', copyStudentNim);
    }

    // 12. Export Button
    if (dom.exportBtn) {
      dom.exportBtn.addEventListener('click', exportToCsv);
    }

    // 13. Mobile Sidebar Toggle
    if (dom.mobileToggleBtn) {
      dom.mobileToggleBtn.addEventListener('click', () => {
        dom.sidebar.classList.add('open');
        dom.sidebarOverlay.classList.add('active');
      });
    }

    const closeMobileSidebar = () => {
      dom.sidebar.classList.remove('open');
      dom.sidebarOverlay.classList.remove('active');
    };

    if (dom.sidebarCloseBtn) dom.sidebarCloseBtn.addEventListener('click', closeMobileSidebar);
    if (dom.sidebarOverlay) dom.sidebarOverlay.addEventListener('click', closeMobileSidebar);
  }

  // --- Inisialisasi Aplikasi Saat DOM Siap ---
  document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    fetchMahasiswa();
  });

})();
