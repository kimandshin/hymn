/*********************************************
 * Hymn Browser Frontend
 *********************************************/

// 1) Put your Apps Script Web App URL here:
const API_BASE = "https://script.google.com/macros/s/PASTE_YOUR_WEB_APP_ID_HERE/exec";

// 2) If GithubPath holds FULL URLs, leave IMAGE_BASE = "".
//    If GithubPath is just "/hymns/xxx.png", set IMAGE_BASE to your site root.
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

  filtered = hymns.filter(function(h) {
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
      .some(function(str) {
        return String(str).toLowerCase().includes(q);
      });
  });

  renderHymnList();

  if (filtered.length > 0) {
    const stillVisible = filtered.find(function(h) {
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

  filtered.forEach(function(hymn) {
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

    li.addEventListener("click", function() {
      showHymn(hymn);
    });

    hymnListEl.appendChild(li);
  });

  highlightCurrentInList();
}

function highlightCurrentInList() {
  Array.prototype.forEach.call(hymnListEl.children, function(li) {
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
    comments.forEach(function(c) {
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

/*********** Event listeners ***********/
searchInput.addEventListener("input", function() {
  applyFilterAndRender();
});

zoomInBtn.addEventListener("click", function() {
  zoomLevel = Math.min(zoomLevel + 0.1, 3);
  hymnImageEl.style.transform = "scale(" + zoomLevel + ")";
});

zoomOutBtn.addEventListener("click", function() {
  zoomLevel = Math.max(zoomLevel - 0.1, 0.5);
  hymnImageEl.style.transform = "scale(" + zoomLevel + ")";
});

favoriteBtn.addEventListener("click", function() {
  if (!currentHymnId) return;
  toggleFavorite(currentHymnId);
  updateFavoriteButton();
  applyFilterAndRender();
});

favoritesToggleBtn.addEventListener("click", function() {
  favoritesOnly = !favoritesOnly;
  favoritesToggleBtn.classList.toggle("active", favoritesOnly);
  favoritesToggleBtn.textContent = favoritesOnly
    ? "Favorites only: On"
    : "Favorites only: Off";
  applyFilterAndRender();
});

commentForm.addEventListener("submit", async function(e) {
  e.preventDefault();
  if (!currentHymnId) return;

  const name = commentNameInput.value.trim() || "Anonymous";
  const text = commentTextInput.value.trim();
  if (!text) return;

  const submitBtn = commentForm.querySelector("button[type='submit']");
  submitBtn.disabled = true;

  try {
    await addComment(currentHymnId, name, text);
    commentTextInput.value = "";
    await loadAndRenderComments();
  } catch (err) {
    alert("Error adding comment. Please try again.");
  } finally {
    submitBtn.disabled = false;
  }
});

/*********** Init ***********/
fetchHymns().catch(function(err) {
  console.error(err);
  hymnListEl.innerHTML = "<li>Error loading hymns.</li>";
});
