// js/game.js
import { getGameName, getGameDesc, getGameCategory } from './utils.js';
import { handleGameClick } from './toRoom.js';
import { 
  allGames, recentGames, topGames, featuredGames, newGames, gamesByCategory,
  sliderPage, MAX_SHOW, currentLang, LANGS
} from './main.js'; // Import state từ main

/**
 * Render HTML cho một game card.
 */
export function renderGameCard(game) {
  const name = getGameName(game, currentLang);
  const desc = getGameDesc(game, currentLang);
  const category = getGameCategory(game, currentLang);
  
  const card = document.createElement('div');
  card.className = 'game-card';
  card.innerHTML = `
    ${game.badge ? `<div class="game-badge">${game.badge}</div>` : ""}
    <img src="game/${game.id}/Img/logo.png" alt="${name}" />
    <div class="game-title">${name}</div>
    <div class="game-category">${category}</div>
    <div class="game-desc">${desc}</div>
    ${game.players ? `<div class="game-players">👥 ${game.players} ${LANGS[currentLang]?.players || ''}</div>` : ""}
  `;
  
  // Gán sự kiện click
  card.onclick = () => handleGameClick(game.id, name.replace(/'/g, "\\'"));
  
  return card;
}

/**
 * Render một slider game (ví dụ: Hot, New) với các nút < >.
 */
export function renderSlider(games, sliderId, pageKey) {
  const slider = document.getElementById(sliderId);
  const sliderContainer = slider?.parentElement;
  if (!sliderContainer || !slider) return;

  // Xóa nút cũ
  sliderContainer.querySelectorAll('.slider-btn').forEach(btn => btn.remove());

  let page = sliderPage[pageKey] || 0;
  const totalPage = Math.ceil(games.length / MAX_SHOW);

  const start = page * MAX_SHOW;
  const end = Math.min(start + MAX_SHOW, games.length);
  const showGames = games.slice(start, end);

  // Render game card
  slider.innerHTML = ''; // Xóa nội dung cũ
  showGames.map(renderGameCard).forEach(cardElement => {
    slider.appendChild(cardElement);
  });

  // Thêm nút nếu cần
  if (games.length > MAX_SHOW) {
    // Nút Prev
    if (page > 0) {
      const prevBtn = document.createElement('button');
      prevBtn.className = 'slider-btn left';
      prevBtn.innerHTML = '&#8249;';
      prevBtn.onclick = () => {
        sliderPage[pageKey]--;
        renderSlider(games, sliderId, pageKey);
      };
      sliderContainer.insertBefore(prevBtn, slider);
    }

    // Nút Next
    if (end < games.length) {
      const nextBtn = document.createElement('button');
      nextBtn.className = 'slider-btn right';
      nextBtn.innerHTML = '&#8250;';
      nextBtn.onclick = () => {
        sliderPage[pageKey]++;
        renderSlider(games, sliderId, pageKey);
      };
      sliderContainer.appendChild(nextBtn);
    }
  }
}

/**
 * Phân nhóm game từ `allGames` vào các mảng (top, new, byCategory).
 */
export function groupGames() {
  allGames.sort((a, b) => (getGameName(a, 'vi')).localeCompare(getGameName(b, 'vi')));
  
  // Gán trực tiếp vào state đã import
  Object.assign(recentGames, allGames);
  Object.assign(topGames, allGames.filter(g => g.badge === "Hot" || g.badge === "Top"));
  Object.assign(featuredGames, allGames.filter(g => g.badge === "Hot" || g.badge === "Updated"));
  Object.assign(newGames, allGames.filter(g => g.badge === "New"));
  
  // Reset gamesByCategory
  Object.keys(gamesByCategory).forEach(key => delete gamesByCategory[key]);
  
  allGames.forEach(g => {
    const cats = (getGameCategory(g, 'vi') || 'Khác').split(',').map(c => c.trim());
    cats.forEach(cat => {
      if (!gamesByCategory[cat]) gamesByCategory[cat] = [];
      gamesByCategory[cat].push(g);
    });
  });
}

/**
 * Render tất cả các slider theo thể loại.
 */
export function renderGamesByCategory() {
  const categoryList = document.getElementById('category-list');
  if (!categoryList) return;
  
  categoryList.innerHTML = ''; // Xóa nội dung cũ
  
  Object.keys(gamesByCategory).sort().forEach(cat => {
    const catKey = cat.replace(/\s+/g, '-');
    const section = document.createElement('div');
    section.className = 'category-slider-section';
    section.innerHTML = `
      <div class="section-title-row" id="cat-${catKey}">
        <div class="section-title">${cat}</div>
      </div>
      ${renderSortDropdown(`cat-${catKey}`)}
      <div class="games-slider-container" id="cat-container-${catKey}">
        <div class="games-slider" id="catSlider-${catKey}"></div>
      </div>
    `;
    categoryList.appendChild(section);

    // Khởi tạo trang và render
    if (!sliderPage[`cat-${catKey}`]) sliderPage[`cat-${catKey}`] = 0;
    renderSlider(
      gamesByCategory[cat],
      `catSlider-${catKey}`,
      `cat-${catKey}`
    );
  });
}

/**
 * Render HTML cho dropdown sắp xếp.
 */
export function renderSortDropdown(key = '') {
  return `
    <div class="sort-dropdown-row">
      <label class="sort-label" data-i18n="sort_by">Sắp xếp theo</label>
      <div class="sort-dropdown">
        <select class="sort-select" onchange="sortGamesHandler('${key}', this)">
          <option value="newest" data-i18n="sort_newest">Mới nhất</option>
          <option value="oldest" data-i18n="sort_oldest">Cũ nhất</option>
          <option value="players_asc" data-i18n="sort_players_asc">Người chơi (tăng)</option>
          <option value="players_desc" data-i18n="sort_players_desc">Người chơi (giảm)</option>
          <option value="az" data-i18n="sort_az">Tên (A-Z)</option>
          <option value="za" data-i18n="sort_za">Tên (Z-A)</option>
        </select>
      </div>
    </div>
  `;
}

/**
 * Xử lý sự kiện sắp xếp (được gọi từ onchange).
 */
export function sortGames(sectionKey, selectEl) {
  const sortBy = selectEl.value;

  // Lấy đúng mảng game
  let gamesArr;
  if (sectionKey.startsWith('cat-')) {
    const catName = document.getElementById(sectionKey)?.querySelector('.section-title')?.innerText || '';
    gamesArr = gamesByCategory[catName] ? [...gamesByCategory[catName]] : [];
  } else if (sectionKey === 'recent') {
    gamesArr = [...recentGames];
  } else if (sectionKey === 'top') {
    gamesArr = [...topGames];
  } else if (sectionKey === 'featured') {
    gamesArr = [...featuredGames];
  } else if (sectionKey === 'new') {
    gamesArr = [...newGames];
  } else {
    return;
  }

  // Sắp xếp
  if (sortBy === 'newest') {
    gamesArr.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else if (sortBy === 'oldest') {
    gamesArr.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  } else if (sortBy === 'players_asc') {
    gamesArr.sort((a, b) => (a.players || 0) - (b.players || 0));
  } else if (sortBy === 'players_desc') {
    gamesArr.sort((a, b) => (b.players || 0) - (a.players || 0));
  } else if (sortBy === 'az') {
    gamesArr.sort((a, b) => getGameName(a, currentLang).localeCompare(getGameName(b, currentLang)));
  } else if (sortBy === 'za') {
    gamesArr.sort((a, b) => getGameName(b, currentLang).localeCompare(getGameName(a, currentLang)));
  }

  // Render lại slider với mảng đã sắp xếp
  // Reset trang về 0 khi sắp xếp
  sliderPage[sectionKey] = 0; 
  renderSlider(
    gamesArr,
    sectionKey.startsWith('cat-') ? `catSlider-${sectionKey.replace(/^cat-/, '')}` : `${sectionKey}Slider`,
    sectionKey
  );
}

/**
 * Thực hiện tìm kiếm game.
 */
export function searchGames() {
  const keyword = document.getElementById('searchInput').value.toLowerCase().trim();
  const main = document.querySelector('.main-content');
  let searchResultDiv = document.getElementById('search-result');

  if (!main) return;

  // Ẩn/hiện các mục
  Array.from(main.children).forEach(child => {
    if (child.id !== 'search-result') {
      child.style.display = keyword ? 'none' : '';
    }
  });

  // Tạo div kết quả nếu chưa có
  if (!searchResultDiv) {
    searchResultDiv = document.createElement('div');
    searchResultDiv.id = 'search-result';
    main.appendChild(searchResultDiv);
  }
  
  if (!keyword) {
    searchResultDiv.style.display = 'none';
    return;
  }

  searchResultDiv.style.display = 'block';

  const filtered = allGames.filter(g =>
    getGameName(g, currentLang).toLowerCase().includes(keyword) ||
    getGameDesc(g, currentLang).toLowerCase().includes(keyword) ||
    getGameCategory(g, currentLang).toLowerCase().includes(keyword)
  );

  if (filtered.length === 0) {
    searchResultDiv.innerHTML = `<div class="section-title-row"><div class="section-title">Không tìm thấy trò chơi phù hợp cho "<span style="color:#ff9800">${keyword}</span>".</div></div>`;
    return;
  }

  // Hàm highlight
  function highlight(text) {
    text = (text === undefined || text === null) ? '' : String(text);
    if (!text) return '';
    return text.replace(
      new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
      '<span class="highlight">$1</span>'
    );
  }

  // Hiển thị kết quả
  searchResultDiv.innerHTML = `
    <div class="section-title-row">
      <div class="section-title">Kết quả tìm kiếm cho "<span style="color:#ff9800">${keyword}</span>"</div>
    </div>
    <div class="games-slider" style="flex-wrap:wrap;gap:32px 24px;">
      ${filtered.map(game => {
        const name = getGameName(game, currentLang);
        const desc = getGameDesc(game, currentLang);
        const category = getGameCategory(game, currentLang);
        return `
          <div class="game-card" onclick="handleGameClick('${game.id}', '${name.replace(/'/g, "\\'")}')">
            ${game.badge ? `<div class="game-badge">${game.badge}</div>` : ""}
            <img src="game/${game.id}/Img/logo.png" alt="${name}" />
            <div class="game-title">${highlight(name)}</div>
            <div class="game-category">${highlight(category)}</div>
            <div class="game-desc">${highlight(desc)}</div>
            ${game.players ? `<div class="game-players">👥 ${highlight(String(game.players))} ${LANGS[currentLang]?.players || 'người chơi'}</div>` : ""}
          </div>
        `;
      }).join('')}
    </div>
  `;
  
  // Gán lại sự kiện click cho các card vừa render (vì dùng innerHTML)
  // Tốt hơn là dùng DOM
  searchResultDiv.querySelectorAll('.game-card').forEach((card, index) => {
    const game = filtered[index];
    const name = getGameName(game, currentLang);
    card.onclick = () => handleGameClick(game.id, name.replace(/'/g, "\\'"));
  });
}

/**
 * Render lại tất cả slider (dùng khi đổi ngôn ngữ hoặc resize).
 */
export function rerenderAllSliders() {
  renderSlider(recentGames, 'recentSlider', 'recent');
  renderSlider(topGames, 'topSlider', 'top');
  renderSlider(featuredGames, 'featuredSlider', 'featured');
  renderSlider(newGames, 'newSlider', 'new');
  renderGamesByCategory();
}