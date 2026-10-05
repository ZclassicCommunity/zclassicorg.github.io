/* Progressive enhancements for the static Zclassic homepage. */
(() => {
  'use strict';

  const root = document.documentElement;
  const scheme = matchMedia('(prefers-color-scheme: dark)');
  const themeToggle = document.getElementById('theme-toggle');
  let themePreference = root.dataset.themePreference || 'system';

  const setTheme = preference => {
    themePreference = preference === 'light' || preference === 'dark' ? preference : 'system';
    const dark = themePreference === 'dark' || (themePreference === 'system' && scheme.matches);
    root.dataset.theme = dark ? 'dark' : 'light';
    themeToggle.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} theme`);
    document.querySelector('meta[name="theme-color"]').content = dark ? '#171914' : '#faf9f6';
  };

  setTheme(themePreference);
  themeToggle.addEventListener('click', () => {
    setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
    try { localStorage.setItem('zclassic-theme', themePreference); } catch (_) {}
  });
  scheme.addEventListener('change', () => {
    if (themePreference === 'system') setTheme('system');
  });
  window.addEventListener('storage', event => {
    if (event.key === 'zclassic-theme' || event.key === null) setTheme(event.newValue);
  });

  const header = document.querySelector('.site-header');
  const nav = document.getElementById('site-nav');
  const menuToggle = document.getElementById('menu-toggle');
  const desktop = matchMedia('(min-width: 901px)');
  let focusedNavControl = null;
  const setMenu = (open, returnFocus = false) => {
    nav.classList.toggle('open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    if (returnFocus && !desktop.matches) menuToggle.focus();
  };

  menuToggle.addEventListener('click', () => {
    const open = menuToggle.getAttribute('aria-expanded') !== 'true';
    setMenu(open);
    if (open) nav.querySelector('a').focus();
  });
  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => setMenu(false));
  });
  document.addEventListener('click', event => {
    if (!header.contains(event.target)) setMenu(false, nav.contains(document.activeElement));
  });
  document.addEventListener('focusin', event => {
    focusedNavControl = nav.contains(event.target) || event.target === menuToggle ? event.target : null;
    if (!header.contains(event.target)) setMenu(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav.classList.contains('open')) setMenu(false, true);
  });
  desktop.addEventListener('change', () => {
    // A CSS breakpoint can hide the focused control before this event runs.
    const previous = focusedNavControl;
    setMenu(false);
    if (!desktop.matches && previous && nav.contains(previous)) menuToggle.focus();
    else if (desktop.matches && previous === menuToggle) nav.querySelector('a').focus();
  });

  // Keep these destinations identical to the upstream wallet release links.
  const releaseBase = 'https://github.com/ZclassicCommunity/zclassic/releases/download/v2.1.2-beta6/';
  const platforms = {
    windows: {name: 'Windows', architecture: '64-bit', file: 'zclwallet-v2.1.2-beta6-win64.exe', format: '.exe · 64-bit'},
    macos: {name: 'macOS', architecture: 'Apple silicon', file: 'zclwallet-v2.1.2-beta6-macos-arm64.dmg', format: '.dmg · Apple silicon'},
    linux: {name: 'Linux', architecture: 'x86_64', file: 'zclwallet-v2.1.2-beta6-linux-x86_64', format: 'Executable · x86_64'}
  };
  const osTabs = Array.from(document.querySelectorAll('.os-tab'));
  const selectOS = (key, focus = false) => {
    const platform = platforms[key];
    if (!platform) return;
    osTabs.forEach(tab => {
      const selected = tab.dataset.os === key;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus();
    });
    document.getElementById('wallet-panel').setAttribute('aria-labelledby', `tab-${key}`);
    document.getElementById('wallet-title').textContent = `Zclassic for ${platform.name}`;
    document.getElementById('wallet-meta').textContent = `${platform.architecture} · v2.1.2-beta6 · Beta release`;
    document.getElementById('wallet-download').href = releaseBase + platform.file;
    document.getElementById('download-label').textContent = `Download for ${platform.name}`;
    document.getElementById('download-format').textContent = platform.format;
  };

  osTabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectOS(tab.dataset.os));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % osTabs.length;
      else if (event.key === 'ArrowLeft') next = (index - 1 + osTabs.length) % osTabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = osTabs.length - 1;
      else return;
      event.preventDefault();
      selectOS(osTabs[next].dataset.os, true);
    });
  });
  const agentPlatform = navigator.userAgentData?.platform || navigator.platform || '';
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && /Mac/i.test(agentPlatform));
  if (!mobile) {
    if (/Mac/i.test(agentPlatform)) selectOS('macos');
    else if (/Linux/i.test(agentPlatform)) selectOS('linux');
    else selectOS('windows');
  }

  let toastTimer;
  let copyTimer;
  const toast = message => {
    const element = document.getElementById('toast');
    clearTimeout(toastTimer);
    element.textContent = message;
    element.classList.add('show');
    toastTimer = setTimeout(() => element.classList.remove('show'), 3500);
  };
  const getSetupCommands = () => {
    const code = document.getElementById('setup-code').cloneNode(true);
    code.querySelectorAll('.prompt').forEach(prompt => prompt.remove());
    return code.textContent.trim();
  };
  const legacyCopy = text => {
    const field = document.createElement('textarea');
    field.value = text;
    field.readOnly = true;
    field.className = 'clipboard-fallback';
    const previousFocus = document.activeElement;
    document.body.appendChild(field);
    field.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch (_) {}
    field.remove();
    previousFocus?.focus({preventScroll: true});
    return copied;
  };

  document.getElementById('copy-code').addEventListener('click', async () => {
    const commands = getSetupCommands();
    let copied = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(commands);
        copied = true;
      }
    } catch (_) {}
    if (!copied) copied = legacyCopy(commands);
    if (copied) {
      const label = document.getElementById('copy-label');
      clearTimeout(copyTimer);
      label.textContent = 'Copied';
      toast('Z23 setup commands copied.');
      copyTimer = setTimeout(() => { label.textContent = 'Copy'; }, 2500);
    } else {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(document.getElementById('setup-code'));
      selection.removeAllRanges();
      selection.addRange(range);
      toast('Copy the highlighted commands with your keyboard or selection menu.');
    }
  });

  let category = 'all';
  const search = document.getElementById('resource-search');
  const groups = Array.from(document.querySelectorAll('.resource-group'));
  const filters = Array.from(document.querySelectorAll('.filter-btn'));
  const filterResources = () => {
    const query = search.value.trim().toLocaleLowerCase();
    let count = 0;
    groups.forEach(group => {
      const categoryMatch = category === 'all' || category === group.dataset.category;
      let visible = 0;
      group.querySelectorAll('li').forEach(item => {
        const matches = categoryMatch &&
          (item.textContent + ' ' + group.dataset.category).toLocaleLowerCase().includes(query);
        item.hidden = !matches;
        if (matches) visible++;
      });
      group.hidden = visible === 0;
      count += visible;
    });
    document.getElementById('resource-empty').hidden = count !== 0;
    document.getElementById('resource-count').textContent =
      `${count} resource${count === 1 ? '' : 's'}${query ? ` matching “${search.value.trim()}”` : ' to explore'}`;
  };
  const selectCategory = value => {
    category = value;
    filters.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === category)));
    filterResources();
  };

  filters.forEach(button => button.addEventListener('click', () => selectCategory(button.dataset.filter)));
  search.addEventListener('input', filterResources);
  search.addEventListener('search', filterResources);
  search.addEventListener('keydown', event => {
    if (event.key === 'Escape' && search.value) {
      search.value = '';
      filterResources();
    }
  });
  document.getElementById('reset-resources').addEventListener('click', () => {
    search.value = '';
    selectCategory('all');
    search.focus({preventScroll: true});
  });
  filterResources();

  if ('IntersectionObserver' in window) {
    const navLinks = Array.from(nav.querySelectorAll('a'));
    const visibleSections = new Set();
    const sectionObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) visibleSections.add(entry.target);
        else visibleSections.delete(entry.target);
      });
      const current = [...visibleSections].sort((a, b) =>
        Math.abs(a.getBoundingClientRect().top) - Math.abs(b.getBoundingClientRect().top))[0];
      navLinks.forEach(link => {
        if (current && link.hash === `#${current.id}`) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }, {rootMargin: '-15% 0px -60% 0px', threshold: 0});
    navLinks.forEach(link => {
      const section = document.getElementById(link.hash.slice(1));
      if (section) sectionObserver.observe(section);
    });
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            revealObserver.unobserve(entry.target);
          }
        });
      }, {threshold: 0.12});
      document.querySelectorAll('.reveal').forEach(element => revealObserver.observe(element));
    }
  }

  root.classList.add('js');
})();
