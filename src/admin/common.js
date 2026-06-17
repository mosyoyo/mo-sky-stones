(function () {
  const tz = 'Asia/Shanghai';
  const escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function h(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => escapeMap[ch]);
  }

  async function fetchJSON(url, options) {
    const res = await fetch(url, options);
    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      data = null;
    }
    if (!res.ok) {
      throw new Error((data && data.error) || `HTTP ${res.status}`);
    }
    return data;
  }

  function formatDate(value, fallback = '未设置') {
    if (!value) return fallback;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return fallback;
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: tz,
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }

  function formatFullDate(value, fallback = '未设置') {
    if (!value) return fallback;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return fallback;
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }

  function splitLocal(value) {
    if (!value) return { date: '', time: '' };
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return { date: '', time: '' };
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return { date: `${map.year}-${map.month}-${map.day}`, time: `${map.hour}:${map.minute}` };
  }

  function localToUTC(datePart, timePart) {
    if (!datePart || !timePart) return '';
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    return new Date(Date.UTC(year, month - 1, day, hour - 8, minute || 0, 0)).toISOString();
  }

  function showToast(message, type = 'info') {
    let root = document.querySelector('.toast-root');
    if (!root) {
      root = document.createElement('div');
      root.className = 'toast-root';
      document.body.append(root);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    root.append(toast);
    setTimeout(() => toast.classList.add('show'), 20);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 220);
    }, 2600);
  }

  function confirmAction(message) {
    return Promise.resolve(window.confirm(message));
  }

  window.AdminCommon = {
    fetchJSON,
    formatDate,
    formatFullDate,
    h,
    localToUTC,
    showToast,
    splitLocal,
    confirmAction,
  };
})();
