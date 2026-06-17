(function () {
  const items = [
    ['/', '订阅'],
    ['/src/admin/feed/', '公告'],
    ['/src/admin/events/', '事件'],
    ['/src/admin/spirits/', '先祖'],
    ['/src/admin/sync/', '同步'],
    ['/src/admin/settings/', '数据源'],
  ];
  const main = document.querySelector('main');
  if (!main || document.querySelector('.shell-nav')) return;
  const path = location.pathname.endsWith('/') ? location.pathname : `${location.pathname}/`;
  const nav = document.createElement('nav');
  nav.className = 'shell-nav';
  nav.innerHTML = items.map(([href, label]) => {
    const active = href === '/' ? path === '/' : path === href;
    return `<a${active ? ' class="active"' : ''} href="${href}">${label}</a>`;
  }).join('');
  main.prepend(nav);
})();
