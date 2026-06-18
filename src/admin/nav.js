(function () {
  const items = [
    ['/', '订阅'],
    ['/admin/feed/', '公告'],
    ['/admin/events/', '事件'],
    ['/admin/spirits/', '先祖'],
    ['/admin/sync/', '同步'],
    ['/admin/settings/', '数据源'],
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
