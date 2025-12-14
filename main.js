/*********************************************
 * Hymn Browser Frontend
 *********************************************/

// 1) Put your Apps Script Web App URL here:
const API_BASE = "https://script.google.com/macros/s/AKfycbyCzINmhpPt5TXrl55e2h0Vjv82_Jco8ajLY90izdBEyyF2SPdzeZB1oKaMc8Nj5x51/exec";

// 2) If GithubPath holds FULL URLs, leave IMAGE_BASE = "".
//    If GithubPath is just "image/xxx.png", set IMAGE_BASE = "" (your case).
const IMAGE_BASE = "";

// State
let hymns = [];
let filtered = [];
let currentHymnId = null;
let zoomLevel = 1;
let favoritesOnly = false;

// DOM
const searchInput = document.getElementById("searchInput");
const hymnListEl = document.getElementById("hymnList");
const viewerTitleEl = document.getElementById("viewerTitle");
const viewerMetaEl = document.getElementById("viewerMeta");
const hymnImageEl = document.getElementById("hymnImage");
const zoomInBtn = document.getElementById("zoomInBtn");
const zoomOutBtn = document.getElementById("zoomOutBtn");
const downloadLinkEl = document.getElementById("downloadLink");
const favoriteBtn = document.getElementById("favoriteBtn");
const favoritesToggleBtn = document.getElementById("favoritesToggle");
const commentsListEl = document.getElementById("commentsList");
const commentForm = document.getElementById("commentForm");
const commentNameInput = document.getElementById("commentName");
const commentTextInput = document.getElementById("commentText");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const swipeArea = document.getElementById("viewerSwipeArea");

/*********** Favorites helpers ***********/
function getFavorites() {
  try {
    const raw = localStorage.getItem("hymnFavorites") || "[]";
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function setFavorites(list) {
  localStorage.setItem("hymnFavorites", JSON.stringify(list));
}

function isFavorite(id) {
  const favs = getFavorites();
  return favs.includes(String(id));
}

function toggleFavorite(id) {
  const favs = getFavorites();
  const idx = favs.indexOf(String(id));
  if (idx === -1) {
    favs.push(String(id));
  } else {
    favs.splice(idx, 1);
  }
  setFavorites(favs);
}

/*********** Data loading ***********/
async function fetchHymns() {
  const url = API_BASE + "?action=list";
  const res = await fetch(url);
  const data = await res.json();
  hymns = data.hymns || [];
  applyFilterAndRender();
}

async function fetchComments(hymnId) {
  const url = API_BASE + "?action=comments&id=" + encodeURIComponent(hymnId);
  const res = await fetch(url);
  const data = await res.json();
  return data.comments || [];
}

async function addComment(hymnId, name, comment) {
  const url =
    API_BASE +
    "?action=addComment&id=" +
    encodeURIComponent(hymnId) +
    "&name=" +
    encodeURIComponent(name) +
    "&comment=" +
    encodeURIComponent(comment);
  const res = await fetch(url);
  const data = await res.json();
  return data;
}

/*********** UI rendering ***********/
function applyFilterAndRender() {
  const q = (searchInput.value || "").toLowerCase();
  const favs = getFavorites();

  filtered = hymns.filter(function (h) {
    if (favoritesOnly && !favs.includes(String(h.HymnID))) return false;
    if (!q) return true;

    const fields = [
      h.Title_ko,
      h.Title_en,
      h.Tags,
      h.Themes,
      h.Keywords,
      h.Number
    ];

    return fields
      .filter(Boolean)
      .some(function (str) {
        return String(str).toLowerCase().includes(q);
      });
  });

  renderHymnList();

  if (filtered.length > 0) {
    const stillVisible = filtered.find(function (h) {
      return String(h.HymnID) === String(currentHymnId);
    });
    if (!stillVisible) {
      showHymn(filtered[0]);
    } else {
      highlightCurrentInList();
    }
  } else {
    clearViewer();
  }
}

function renderHymnList() {
  hymnListEl.innerHTML = "";

  filtered.forEach(function (hymn) {
    const li = document.createElement("li");
    li.dataset.id = hymn.HymnID;

    const title = hymn.Title_ko || hymn.Title_en || hymn.HymnID;
    const number = hymn.Number ? "#" + hymn.Number : "";
    const key = hymn.Key ? "Key: " + hymn.Key : "";
    const tags = hymn.Tags ? "[" + hymn.Tags + "]" : "";

    const titleSpan = document.createElement("span");
    titleSpan.className = "title";
    titleSpan.textContent = title;

    const metaSpan = document.createElement("span");
    metaSpan.className = "meta";
    metaSpan.textContent =
      [number, key, tags].filter(Boolean).join(" · ");

    li.appendChild(titleSpan);
    li.appendChild(metaSpan);

    li.addEventListener("click", function () {
      showHymn(hymn);
    });

    hymnListEl.appendChild(li);
  });

  highlightCurrentInList();
}

function highlightCurrentInList() {
  Array.prototype.forEach.call(hymnListEl.children, function (li) {
    if (String(li.dataset.id) === String(currentHymnId)) {
      li.classList.add("active");
    } else {
      li.classList.remove("active");
    }
  });
}

function clearViewer() {
  currentHymnId = null;
  viewerTitleEl.textContent = "No hymns match your search.";
  viewerMetaEl.textContent = "";
  hymnImageEl.src = "";
  commentsListEl.innerHTML = "";
  favoriteBtn.textContent = "☆ Add to favorites";
}

function showHymn(hymn) {
  currentHymnId = hymn.HymnID;
  zoomLevel = 1;
  hymnImageEl.style.transform = "scale(" + zoomLevel + ")";

  const title = hymn.Title_ko || hymn.Title_en || hymn.HymnID;
  viewerTitleEl.textContent = title;

  const metaBits = [];
  if (hymn.Number) metaBits.push("#" + hymn.Number);
  if (hymn.Key) metaBits.push("Key: " + hymn.Key);
  if (hymn.Tags) metaBits.push("Tags: " + hymn.Tags);
  if (hymn.Themes) metaBits.push("Themes: " + hymn.Themes);
  viewerMetaEl.textContent = metaBits.join(" · ");

  const path = hymn.GithubPath || "";
  const src = (IMAGE_BASE ? IMAGE_BASE : "") + path;
  hymnImageEl.src = src;
  hymnImageEl.alt = title;

  downloadLinkEl.href = src;

  updateFavoriteButton();
  highlightCurrentInList();
  loadAndRenderComments();
}

function updateFavoriteButton() {
  if (!currentHymnId) {
    favoriteBtn.textContent = "☆ Add to favorites";
    return;
  }
  favoriteBtn.textContent = isFavorite(currentHymnId)
    ? "★ In favorites"
    : "☆ Add to favorites";
}

async function loadAndRenderComments() {
  if (!currentHymnId) {
    commentsListEl.innerHTML = "";
    return;
  }

  commentsListEl.textContent = "Loading comments…";

  try {
    const comments = await fetchComments(currentHymnId);
    if (!comments.length) {
      commentsListEl.textContent = "No comments yet.";
      return;
    }
    commentsListEl.innerHTML = "";
    comments.forEach(function (c) {
      const div = document.createElement("div");
      div.className = "comment";

      const nameSpan = document.createElement("span");
      nameSpan.className = "name";
      nameSpan.textContent = c.name || "Anonymous";

      const timeSpan = document.createElement("span");
      timeSpan.className = "time";
      const timeStr = c.timestamp
        ? new Date(c.timestamp).toLocaleString()
        : "";
      timeSpan.textContent = timeStr ? " · " + timeStr : "";

      const textDiv = document.createElement("div");
      textDiv.textContent = c.comment || "";

      div.appendChild(nameSpan);
      div.appendChild(timeSpan);
      div.appendChild(textDiv);
      commentsListEl.appendChild(div);
    });
  } catch (e) {
    commentsListEl.textContent = "Error loading comments.";
  }
}

/*********** Navigation helpers (prev/next/swipe) ***********/
function getCurrentIndex() {
  return filtered.findIndex(function (h) {
    return String(h.HymnID) === String(currentHymnId);
  });
}

function showNext(delta) {
  if (!filtered.length) return;
  let idx = getCurrentIndex();
  if (idx === -1) idx = 0;
  else idx = (idx + delta + filtered.length) % filtered.length;
  showHymn(filtered[idx]);
}

/*********** Event listeners ***********/
searchInput.addEventListener("input", function () {
  applyFilterAndRender();
});

zoomInBtn.addEventListener("click", function () {
  zoomLevel = Math.min(zoomLevel + 0.1, 3);
  hymnImageEl.style.transform = "scale(" + zoomLevel + ")";
});

zoomOutBtn.addEventListener("click", function () {
  zoomLevel = Math.max(zoomLevel - 0.1, 0.5);
  hymnImageEl.style.transform = "scale(" + zoomLevel + ")";
});

favoriteBtn.addEventListener("click", function () {
  if (!currentHymnId) return;
  toggleFavorite(currentHymnId);
  updateFavoriteButton();
  applyFilterAndRender();
});

favoritesToggleBtn.addEventListener("click", function () {
  favoritesOnly = !favoritesOnly;
  favoritesToggleBtn.classList.toggle("active", favoritesOnly);
  favoritesToggleBtn.textContent = favoritesOnly
    ? "Favorites only: On"
    : "Favorites only: Off";
  applyFilterAndRender();
});

prevBtn.addEventListener("click", function () {
  showNext(-1);
});

nextBtn.addEventListener("click", function () {
  showNext(1);
});

commentForm.addEventListener("submit", async function (e) {
  e.preventDefault();
  if (!currentHymnId) return;

  const name = commentNameInput.value.trim() || "Anonymous";
  const text = commentTextInput.value.trim();
  if (!text) return;

  const submitBtn = commentForm.querySelector("button[type='submit']");
  submitBtn.disabled = true;

  try {
    const result = await addComment(currentHymnId, name, text);
    if (result && result.error) {
      alert("Error from server: " + result.error);
    } else {
      commentTextInput.value = "";
      await loadAndRenderComments();
    }
  } catch (err) {
    console.error(err);
    alert("Error adding comment. Check console for details.");
  } finally {
    submitBtn.disabled = false;
  }
});

/*********** Keyboard navigation ***********/
window.addEventListener("keydown", function (e) {
  if (e.key === "ArrowRight") {
    showNext(1);
  } else if (e.key === "ArrowLeft") {
    showNext(-1);
  }
});

/*********** Touch swipe navigation ***********/
let touchStartX = null;
let touchStartY = null;

if (swipeArea) {
  swipeArea.addEventListener("touchstart", function (e) {
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
  });

  swipeArea.addEventListener("touchend", function (e) {
    if (touchStartX === null || touchStartY === null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;

    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) showNext(1);   // swipe left -> next
      else showNext(-1);         // swipe right -> previous
    }

    touchStartX = null;
    touchStartY = null;
  });
}

/*********** Init ***********/
fetchHymns().catch(function (err) {
  console.error(err);
  hymnListEl.innerHTML = "<li>Error loading hymns.</li>";
});
