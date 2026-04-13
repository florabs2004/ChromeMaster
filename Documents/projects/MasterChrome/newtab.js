// Sound Synthesis using Web Audio API
function playSwoosh() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);

    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {
    console.warn('Audio playback failed:', e);
  }
}

let allTabs = [];
let duplicateIds = new Set();
let urlToTabIds = new Map();

function updateHeaderTime() {
  const now = new Date();
  const hours = now.getHours();
  
  let greeting = "Good evening";
  if (hours >= 5 && hours < 12) {
    greeting = "Good morning";
  } else if (hours >= 12 && hours < 18) {
    greeting = "Good afternoon";
  }
  
  document.getElementById('greeting-text').textContent = greeting;
  
  const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
  document.getElementById('current-date').textContent = now.toLocaleDateString('en-US', options).toUpperCase();
}

function processTabs() {
  const urlMap = new Map();
  duplicateIds.clear();
  urlToTabIds.clear();

  // Group by main domain name
  const domainGroups = new Map();

  allTabs.forEach(tab => {
    if (!tab.url.startsWith('http') && !tab.url.startsWith('chrome')) return;

    let targetUrl = tab.url;

    // Master regex unwrapper: decodes the URL and reliably extracts the embedded website link
    if (targetUrl.startsWith('chrome-extension://')) {
      try {
        const decoded = decodeURIComponent(targetUrl);
        const httpMatch = decoded.match(/(https?:\/\/[^&?#\s"']+)/);
        if (httpMatch) {
          targetUrl = httpMatch[1] || httpMatch[0];
        }
      } catch (e) {}
    }

    // Detect duplicates based on the true resolved website address
    if (urlMap.has(targetUrl)) {
      duplicateIds.add(tab.id);
      duplicateIds.add(urlMap.get(targetUrl));
    } else {
      urlMap.set(targetUrl, tab.id);
    }

    // Group by beautiful readable domain names
    try {
      const urlObj = new URL(targetUrl);
      let hostname = urlObj.hostname.replace('www.', '');
      let prettyName = hostname;
      
      // Clean fallback for standard extension settings pages
      if (targetUrl.startsWith('chrome-extension://')) {
        prettyName = 'Browser Extensions';
      } else if (hostname === 'go' || hostname.includes('go.corp.google.com') || targetUrl.includes('://go/')) {
        prettyName = 'Google Go Links';
      } else if (hostname.includes('github')) prettyName = 'GitHub';
      else if (hostname.includes('youtube')) prettyName = 'YouTube';
      else if (hostname.includes('linkedin')) prettyName = 'LinkedIn';
      else if (hostname.includes('twitter') || hostname.includes('x.com')) prettyName = 'X';
      else if (hostname.includes('google')) {
        if (hostname.includes('mail.google.com')) {
          prettyName = 'Google Mail';
        } else if (hostname.includes('calendar.google.com')) {
          prettyName = 'Google Calendar';
        } else if (hostname.includes('meet.google.com') || targetUrl.includes('broadcast')) {
          prettyName = 'Google Broadcast';
        } else if (hostname.includes('docs.google.com')) {
          if (targetUrl.includes('/document/')) prettyName = 'Google Docs';
          else if (targetUrl.includes('/spreadsheets/')) prettyName = 'Google Sheets';
          else if (targetUrl.includes('/presentation/')) prettyName = 'Google Slides';
          else prettyName = 'Google Docs';
        } else if (hostname.includes('drive.google.com')) {
          prettyName = 'Google Drive';
        } else if (hostname.includes('corp.google.com') || hostname.includes('moma') || targetUrl.includes('internal')) {
          prettyName = 'Google Internal';
        } else if (targetUrl.includes('/search') || targetUrl.includes('?q=')) {
          prettyName = 'Google Search';
        } else {
          prettyName = 'Google';
        }
      } else {
        const parts = hostname.split('.');
        if (parts.length > 0) {
          prettyName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        }
      }

      if (!domainGroups.has(prettyName)) {
        domainGroups.set(prettyName, {
          domain: hostname,
          tabs: [],
          duplicatesCount: 0
        });
      }

      const group = domainGroups.get(prettyName);
      tab.resolvedUrl = targetUrl;
      group.tabs.push(tab);
    } catch (e) {
      // skip invalid URLs
    }
  });

  // Update duplicates counts per domain
  domainGroups.forEach(group => {
    let dupes = 0;
    const seenUrls = new Set();
    
    group.tabs.forEach(t => {
      const compareUrl = t.resolvedUrl || t.url;
      if (seenUrls.has(compareUrl)) {
        dupes++;
      } else {
        seenUrls.add(compareUrl);
      }
    });
    group.duplicatesCount = dupes;
  });

  // Calculate system-wide duplicates total
  let totalDuplicates = 0;
  domainGroups.forEach(g => totalDuplicates += g.duplicatesCount);

  const globalDupesBtn = document.getElementById('btn-close-dupes-global');
  if (totalDuplicates > 0) {
    globalDupesBtn.style.display = 'flex';
    document.getElementById('global-dupes-count').textContent = totalDuplicates;
    
    globalDupesBtn.onclick = async () => {
      const toClose = [];
      const seen = new Set();
      
      allTabs.forEach(tab => {
        const url = tab.resolvedUrl || tab.url;
        if (!url.startsWith('http') && !url.startsWith('chrome')) return;
        
        if (seen.has(url)) {
          toClose.push(tab.id);
        } else {
          seen.add(url);
        }
      });
      
      if (toClose.length > 0) {
        await chrome.tabs.remove(toClose);
        playSwoosh();
        if (window.celebrate) window.celebrate();
        fetchAllTabs();
      }
    };
  } else {
    globalDupesBtn.style.display = 'none';
  }

  // Update Header Counts
  document.getElementById('domain-count').textContent = `${domainGroups.size} domains`;
  document.getElementById('total-tabs-count').textContent = allTabs.length;

  renderCards(domainGroups);
}

function renderCards(domainGroups) {
  const container = document.getElementById('cards-container');
  container.innerHTML = '';

  if (domainGroups.size === 0) {
    container.innerHTML = `<p class="empty-dashboard">All tabs are perfectly organized and closed.</p>`;
    return;
  }

  // Setup global close all button
  document.getElementById('btn-close-all').onclick = async () => {
    const ids = allTabs.map(t => t.id);
    if (ids.length > 0) {
      await chrome.tabs.remove(ids);
      playSwoosh();
      if (window.celebrate) window.celebrate();
      fetchAllTabs();
    }
  };

  // Sort domain groups so the ones with the most tabs show up first
  const sortedGroups = Array.from(domainGroups.entries()).sort((a, b) => b[1].tabs.length - a[1].tabs.length);

  sortedGroups.forEach(([prettyName, group]) => {
    const card = document.createElement('div');
    card.className = `domain-card ${group.duplicatesCount > 0 ? 'has-duplicates' : ''}`;

    let tabsHtml = '';
    
    // Count frequency of each URL inside this group to tag exact duplicates
    const urlFrequency = new Map();
    group.tabs.forEach(t => {
      urlFrequency.set(t.url, (urlFrequency.get(t.url) || 0) + 1);
    });

    const renderedUrls = new Set();

    group.tabs.forEach(tab => {
      const count = urlFrequency.get(tab.url);
      let duplicateTag = '';
      
      // If this tab url appears more than once, mark it
      if (count > 1) {
        duplicateTag = `<span class="dupe-tag">(2x)</span>`;
      }

      tabsHtml += `
        <div class="tab-item js-tab-row" data-tab-id="${tab.id}" data-window-id="${tab.windowId}">
          <div class="tab-info">
            <img class="tab-favicon" src="${tab.favIconUrl || 'https://www.google.com/s2/favicons?domain=' + group.domain}" />
            <span class="tab-title" title="${tab.title}">${tab.title}</span>
            ${duplicateTag}
          </div>
          <div class="tab-actions">
            <button class="icon-btn js-btn-bookmark" title="Bookmark tab" data-title="${tab.title}" data-url="${tab.url}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
              </svg>
            </button>
            <button class="icon-btn js-btn-close" title="Close tab" data-tab-id="${tab.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      `;
    });

    let dupeBadgeHtml = '';
    let closeDupesBtnHtml = '';

    if (group.duplicatesCount > 0) {
      dupeBadgeHtml = `
        <span class="badge badge-orange">
          ${group.duplicatesCount} duplicate${group.duplicatesCount > 1 ? 's' : ''}
        </span>
      `;
      closeDupesBtnHtml = `
        <button class="btn-close-dupes js-btn-close-dupes" data-domain="${group.domain}">
          Close ${group.duplicatesCount} duplicate${group.duplicatesCount > 1 ? 's' : ''}
        </button>
      `;
    }

    card.innerHTML = `
      <div class="card-header">
        <span class="domain-title">${prettyName}</span>
        <span class="badge badge-orange">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:2px;">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          </svg>
          ${group.tabs.length} tab${group.tabs.length > 1 ? 's' : ''} open
        </span>
        ${dupeBadgeHtml}
      </div>

      <div class="tab-list">
        ${tabsHtml}
      </div>

      <div class="card-footer">
        <button class="btn-close-domain js-btn-close-domain" data-tab-ids="${group.tabs.map(t => t.id).join(',')}">
          <span class="close-icon">✕</span> Close all ${group.tabs.length} tabs
        </button>
        ${closeDupesBtnHtml}
      </div>
    `;

    container.appendChild(card);
  });
}

// Tab Focus and Close Actions
async function fetchAllTabs() {
  allTabs = await chrome.tabs.query({});
  processTabs();
}

async function focusTab(tabId, windowId) {
  await chrome.windows.update(windowId, { focused: true });
  await chrome.tabs.update(tabId, { active: true });
}

async function closeTab(tabId) {
  await chrome.tabs.remove(tabId);
  playSwoosh();
  if (window.celebrate) window.celebrate();
  fetchAllTabs();
}

async function closeGroupTabs(tabIds) {
  await chrome.tabs.remove(tabIds);
  playSwoosh();
  if (window.celebrate) window.celebrate();
  fetchAllTabs();
}

async function closeGroupDuplicates(targetDomain) {
  const toClose = [];
  const seenUrls = new Set();

  allTabs.forEach(tab => {
    try {
      const urlObj = new URL(tab.url);
      if (urlObj.hostname.includes(targetDomain)) {
        if (seenUrls.has(tab.url)) {
          toClose.push(tab.id);
        } else {
          seenUrls.add(tab.url);
        }
      }
    } catch (e) {
      // ignore
    }
  });

  if (toClose.length > 0) {
    await chrome.tabs.remove(toClose);
    playSwoosh();
    if (window.celebrate) window.celebrate();
    fetchAllTabs();
  }
}

function bookmarkTab(title, url) {
  // Simply open standard bookmark dialog or notify user
  alert(`Bookmarking tab:\n${title}`);
}

document.addEventListener('DOMContentLoaded', () => {
  updateHeaderTime();
  fetchAllTabs();
  
  chrome.tabs.onRemoved.addListener(fetchAllTabs);
  chrome.tabs.onCreated.addListener(fetchAllTabs);
  chrome.tabs.onUpdated.addListener(fetchAllTabs);
});

// Secure MV3 Event Delegation for all interactive actions
document.addEventListener('click', async (event) => {
  // 1. Single Tab Focus
  const tabRow = event.target.closest('.js-tab-row');
  if (tabRow && !event.target.closest('button')) {
    const tabId = parseInt(tabRow.getAttribute('data-tab-id'), 10);
    const windowId = parseInt(tabRow.getAttribute('data-window-id'), 10);
    if (tabId && windowId) {
      await chrome.windows.update(windowId, { focused: true });
      await chrome.tabs.update(tabId, { active: true });
    }
    return;
  }

  // 2. Close Single Tab
  const closeBtn = event.target.closest('.js-btn-close');
  if (closeBtn) {
    const tabId = parseInt(closeBtn.getAttribute('data-tab-id'), 10);
    if (tabId) await closeTab(tabId);
    return;
  }

  // 3. Close Entire Domain Group
  const closeGroupBtn = event.target.closest('.js-btn-close-domain');
  if (closeGroupBtn) {
    const idsAttr = closeGroupBtn.getAttribute('data-tab-ids');
    if (idsAttr) {
      const ids = idsAttr.split(',').map(id => parseInt(id, 10)).filter(Boolean);
      if (ids.length > 0) {
        await chrome.tabs.remove(ids);
        playSwoosh();
        if (window.celebrate) window.celebrate();
        fetchAllTabs();
      }
    }
    return;
  }

  // 4. Close Domain Duplicates
  const closeDupesBtn = event.target.closest('.js-btn-close-dupes');
  if (closeDupesBtn) {
    const domain = closeDupesBtn.getAttribute('data-domain');
    if (domain) await closeGroupDuplicates(domain);
    return;
  }

  // 5. Bookmark action
  const bookmarkBtn = event.target.closest('.js-btn-bookmark');
  if (bookmarkBtn) {
    bookmarkTab(bookmarkBtn.getAttribute('data-title'), bookmarkBtn.getAttribute('data-url'));
  }
});
