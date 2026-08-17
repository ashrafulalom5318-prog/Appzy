/* ================================================
   APPZY — MAIN.JS
   Home page logic + Shared utilities
================================================ */

// ------------------------------------------------
// CONFIG
// ------------------------------------------------
const CONFIG = {
    binId:   "6a788efeda38895dfecd4757",
    apiKey:  "$2a$10$x71ckWMZhtxO7QKf6.Beye3Q5mARPqFyAGYDs6FhJuD3p644iySm6",
    get binUrl() {
        return `https://api.jsonbin.io/v3/b/${this.binId}`;
    },
    appsJson: "data/apps.json"
};

// ------------------------------------------------
// STATE
// ------------------------------------------------
let STATE = {
    apps:        [],   // merged apps
    rawStatic:   [],
    rawDynamic:  [],
    activecat:   null,
    searching:   false
};

// ------------------------------------------------
// CATEGORY → LUCIDE ICON MAP
// ------------------------------------------------
const CAT_ICONS = {
    "entertainment": "tv-2",
    "tools":         "wrench",
    "productivity":  "zap",
    "games":         "gamepad-2",
    "social":        "message-circle",
    "music":         "music",
    "education":     "book-open",
    "finance":       "trending-up",
    "health":        "heart-pulse",
    "photography":   "camera",
    "news":          "newspaper",
    "shopping":      "shopping-bag",
    "travel":        "map",
    "food":          "utensils",
    "sports":        "trophy",
    "utilities":     "settings-2",
    "lifestyle":     "leaf",
    "security":      "shield",
    "weather":       "cloud",
    "other":         "grid-2x2"
};

function getCatIcon(cat) {
    if (!cat) return CAT_ICONS["other"];
    return CAT_ICONS[cat.toLowerCase().trim()] || CAT_ICONS["other"];
}

// ------------------------------------------------
// TOAST
// ------------------------------------------------
function showToast(msg, type = "success") {
    const el   = document.getElementById("toast");
    const msgEl = document.getElementById("toastMsg");
    const icon  = el.querySelector("svg, i");

    if (!el || !msgEl) return;

    msgEl.textContent = msg;

    if (type === "error") {
        if (icon) {
            icon.setAttribute("data-lucide", "x-circle");
            icon.style.color = "var(--red)";
        }
    } else {
        if (icon) {
            icon.setAttribute("data-lucide", "check-circle");
            icon.style.color = "var(--green)";
        }
    }

    lucide.createIcons();
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2800);
}

// ------------------------------------------------
// URL PARAM
// ------------------------------------------------
function getParam(key) {
    return new URLSearchParams(window.location.search).get(key);
}

// ------------------------------------------------
// FORMAT HELPERS
// ------------------------------------------------
function fmtCount(n) {
    if (!n || n === 0) return "0";
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return String(n);
}

function fmtDate(str) {
    if (!str) return "—";
    try {
        return new Date(str).toLocaleDateString("en-IN", {
            day: "numeric", month: "short", year: "numeric"
        });
    } catch { return str; }
}

// ------------------------------------------------
// DOWNLOAD LINK
// ------------------------------------------------
function getDownloadLink(app) {
    if (app.download_url && app.download_url.trim()) return app.download_url.trim();
    if (app.drive_file_id && app.drive_file_id.trim())
        return `https://drive.google.com/uc?export=download&id=${app.drive_file_id.trim()}`;
    return null;
}

// ------------------------------------------------
// STAR HTML
// ------------------------------------------------
function starsHTML(rating) {
    let html = "";
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5;

    for (let i = 1; i <= 5; i++) {
        if (i <= full) {
            html += `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>`;
        } else if (i === full + 1 && half) {
            html += `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" opacity="0.4">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>`;
        } else {
            html += `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.2">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>`;
        }
    }
    return html;
}

// ------------------------------------------------
// API — FETCH JSONBIN
// ------------------------------------------------
async function fetchDynamic() {
    try {
        const res = await fetch(`${CONFIG.binUrl}/latest`, {
            headers: { "X-Master-Key": CONFIG.apiKey }
        });
        const json = await res.json();
        return json.record?.apps || [];
    } catch (e) {
        console.error("JSONBin fetch error:", e);
        return [];
    }
}

// ------------------------------------------------
// API — UPDATE JSONBIN
// ------------------------------------------------
async function updateDynamic(data) {
    try {
        const res = await fetch(CONFIG.binUrl, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "X-Master-Key": CONFIG.apiKey
            },
            body: JSON.stringify({ apps: data })
        });
        return await res.json();
    } catch (e) {
        console.error("JSONBin update error:", e);
        return null;
    }
}

// ------------------------------------------------
// API — FETCH STATIC apps.json
// ------------------------------------------------
async function fetchStatic() {
    try {
        const res  = await fetch(CONFIG.appsJson);
        const json = await res.json();
        return json.apps || [];
    } catch (e) {
        console.error("apps.json fetch error:", e);
        return [];
    }
}

// ------------------------------------------------
// MERGE STATIC + DYNAMIC
// ------------------------------------------------
function mergeApps(staticArr, dynArr) {
    return staticArr
        .filter(app => app.status === "published")
        .map(app => {
            const dyn = dynArr.find(d => d.id === app.id) || {
                id:              app.id,
                download_count:  0,
                ratings:         [],
                average_rating:  0,
                rating_count:    0
            };
            return { ...app, ...dyn };
        });
}

// ------------------------------------------------
// NAVIGATE
// ------------------------------------------------
function goToApp(id) {
    window.location.href = `app.html?id=${id}`;
}

// ------------------------------------------------
// FOCUS SEARCH
// ------------------------------------------------
function focusSearch() {
    const inp = document.getElementById("searchInput");
    if (!inp) return;
    inp.focus();
    inp.scrollIntoView({ behavior: "smooth", block: "center" });
}

// ------------------------------------------------
// CLEAR SEARCH
// ------------------------------------------------
function clearSearch() {
    const inp     = document.getElementById("searchInput");
    const clearBtn = document.getElementById("searchClearBtn");

    if (inp) inp.value = "";
    if (clearBtn) clearBtn.style.display = "none";

    STATE.searching = false;

    const searchSec = document.getElementById("searchSection");
    const mainSecs  = document.getElementById("mainSections");

    if (searchSec) searchSec.style.display = "none";
    if (mainSecs)  mainSecs.style.display  = "block";
}

// ------------------------------------------------
// HANDLE SEARCH
// ------------------------------------------------
function handleSearch() {
    const inp      = document.getElementById("searchInput");
    const clearBtn = document.getElementById("searchClearBtn");
    const term     = inp ? inp.value.trim().toLowerCase() : "";

    if (clearBtn) clearBtn.style.display = term ? "flex" : "none";

    if (!term) { clearSearch(); return; }

    STATE.searching = true;

    const searchSec  = document.getElementById("searchSection");
    const mainSecs   = document.getElementById("mainSections");
    const searchGrid = document.getElementById("searchGrid");
    const searchTitle = document.getElementById("searchTitle");
    const searchEmpty = document.getElementById("searchEmpty");

    if (mainSecs)  mainSecs.style.display  = "none";
    if (searchSec) searchSec.style.display = "block";

    const results = STATE.apps.filter(app =>
        app.name.toLowerCase().includes(term) ||
        (app.category || "").toLowerCase().includes(term) ||
        (app.tagline  || "").toLowerCase().includes(term)
    );

    if (searchTitle) searchTitle.textContent =
        `"${inp.value.trim()}" — ${results.length} result${results.length !== 1 ? "s" : ""}`;

    if (results.length === 0) {
        if (searchGrid) searchGrid.innerHTML = "";
        if (searchEmpty) searchEmpty.style.display = "flex";
    } else {
        if (searchEmpty) searchEmpty.style.display = "none";
        if (searchGrid)  searchGrid.innerHTML = results.map(buildAppCard).join("");
        lucide.createIcons();
    }
}

// ------------------------------------------------
// BUILD APP CARD
// ------------------------------------------------
function buildAppCard(app, rank = null) {
    const rating = app.average_rating
        ? app.average_rating.toFixed(1) : "New";

    const rankEl = rank
        ? `<div class="rank-num">${rank}</div>` : "";

    return `
        <div class="app-card" onclick="goToApp('${app.id}')">
            ${rankEl}
            <img
                src="${app.icon || ''}"
                alt="${app.name}"
                class="ac-icon"
                onerror="this.src='https://api.iconify.design/lucide/package.svg?color=%23444'"
            >
            <div class="ac-name">${app.name}</div>
            <div class="ac-rating">
                <i data-lucide="star" fill="currentColor"></i>
                <span>${rating}</span>
            </div>
        </div>
    `;
}

// ------------------------------------------------
// BUILD FEATURED CARD
// ------------------------------------------------
function buildFeatCard(app) {
    const thumb = app.screenshots && app.screenshots[0]
        ? `<img src="${app.screenshots[0]}" class="feat-thumb" alt="" 
                onerror="this.outerHTML='<div class=feat-thumb-placeholder><i data-lucide=image></i></div>'">`
        : `<div class="feat-thumb-placeholder">
               <i data-lucide="image"></i>
           </div>`;

    return `
        <div class="feat-card" onclick="goToApp('${app.id}')">
            <span class="feat-badge">Featured</span>
            ${thumb}
            <div class="feat-card-body">
                <img
                    src="${app.icon || ''}"
                    alt="${app.name}"
                    class="feat-icon"
                    onerror="this.src='https://api.iconify.design/lucide/package.svg?color=%23444'"
                >
                <div class="feat-card-text">
                    <div class="fc-name">${app.name}</div>
                    <div class="fc-cat">${app.category || "App"}</div>
                </div>
            </div>
        </div>
    `;
}

// ------------------------------------------------
// BUILD CATEGORY CARD
// ------------------------------------------------
function buildCatCard(catName, count) {
    const icon = getCatIcon(catName);
    return `
        <div class="cat-card" data-cat="${catName}" onclick="toggleCategory('${catName}', this)">
            <div class="cat-icon">
                <i data-lucide="${icon}"></i>
            </div>
            <span class="cat-name">${catName}</span>
            <span class="cat-count">${count} app${count !== 1 ? "s" : ""}</span>
        </div>
    `;
}

// ------------------------------------------------
// TOGGLE CATEGORY
// ------------------------------------------------
function toggleCategory(catName, el) {
    const appsBox  = document.getElementById("categoryAppsBox");
    const appsGrid = document.getElementById("categoryAppsGrid");
    const label    = document.getElementById("activeCatLabel");

    // If same category clicked → close
    if (STATE.activecat === catName) {
        closeCategoryApps();
        return;
    }

    // Deactivate all pills
    document.querySelectorAll(".cat-card").forEach(c => c.classList.remove("active"));
    el.classList.add("active");

    STATE.activecat = catName;

    const filtered = STATE.apps.filter(a =>
        (a.category || "Other").toLowerCase() === catName.toLowerCase()
    );

    if (label)    label.textContent = catName;
    if (appsGrid) appsGrid.innerHTML = filtered.map(buildAppCard).join("");
    if (appsBox)  appsBox.style.display = "block";

    lucide.createIcons();
    appsBox.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ------------------------------------------------
// CLOSE CATEGORY APPS
// ------------------------------------------------
function closeCategoryApps() {
    STATE.activecat = null;
    document.querySelectorAll(".cat-card").forEach(c => c.classList.remove("active"));
    const appsBox = document.getElementById("categoryAppsBox");
    if (appsBox) appsBox.style.display = "none";
}

// ------------------------------------------------
// SEE ALL (Featured / Popular / Latest)
// ------------------------------------------------
function seeAll(type) {
    let apps  = [];
    let title = "";

    if (type === "featured") {
        apps  = STATE.apps.filter(a => a.featured === true);
        title = "Featured Apps";
    } else if (type === "popular") {
        apps  = [...STATE.apps].sort((a, b) =>
            (b.download_count || 0) - (a.download_count || 0));
        title = "Popular Apps";
    } else if (type === "latest") {
        apps  = [...STATE.apps].sort((a, b) =>
            new Date(b.updated_date || 0) - new Date(a.updated_date || 0));
        title = "Latest Apps";
    }

    // Replace All Apps section content
    const allSec   = document.getElementById("allSection");
    const allGrid  = document.getElementById("allGrid");
    const allTitle = allSec ? allSec.querySelector(".section-title") : null;
    const allLabel = allSec ? allSec.querySelector(".section-label") : null;
    const countEl  = document.getElementById("totalCount");

    if (allTitle) allTitle.textContent = title;
    if (allLabel) allLabel.innerHTML   = "";
    if (countEl)  countEl.textContent  = `${apps.length} apps`;
    if (allGrid)  allGrid.innerHTML    = apps.map(buildAppCard).join("");

    lucide.createIcons();
    allSec.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ------------------------------------------------
// RENDER ALL HOME SECTIONS
// ------------------------------------------------
function renderHome(apps) {
    const loader  = document.getElementById("globalLoader");
    const emptyDb = document.getElementById("emptyDb");

    if (loader) loader.style.display = "none";

    if (!apps || apps.length === 0) {
        if (emptyDb) emptyDb.style.display = "block";
        return;
    }

    // ── FEATURED ──
    const featured    = apps.filter(a => a.featured === true);
    const featSec     = document.getElementById("featuredSection");
    const featRow     = document.getElementById("featuredRow");
    const div1        = document.getElementById("div1");

    if (featured.length > 0 && featSec && featRow) {
        featRow.innerHTML = featured.slice(0, 10).map(buildFeatCard).join("");
        featSec.style.display = "block";
        if (div1) div1.style.display = "block";
    }

    // ── POPULAR ──
    const popular  = [...apps]
        .sort((a, b) => (b.download_count || 0) - (a.download_count || 0))
        .slice(0, 8);
    const popSec   = document.getElementById("popularSection");
    const popGrid  = document.getElementById("popularGrid");
    const div2     = document.getElementById("div2");

    if (popSec && popGrid) {
        popGrid.innerHTML = popular.map((a, i) => buildAppCard(a, i + 1)).join("");
        popSec.style.display = "block";
        if (div2) div2.style.display = "block";
    }

    // ── LATEST ──
    const latest   = [...apps]
        .sort((a, b) => new Date(b.updated_date || 0) - new Date(a.updated_date || 0))
        .slice(0, 8);
    const latSec   = document.getElementById("latestSection");
    const latGrid  = document.getElementById("latestGrid");
    const div3     = document.getElementById("div3");

    if (latSec && latGrid) {
        latGrid.innerHTML = latest.map(buildAppCard).join("");
        latSec.style.display = "block";
        if (div3) div3.style.display = "block";
    }

    // ── CATEGORIES ──
    const catMap = {};
    apps.forEach(a => {
        const c = a.category || "Other";
        catMap[c] = (catMap[c] || 0) + 1;
    });

    const catSec  = document.getElementById("categorySection");
    const catGrid = document.getElementById("categoryGrid");
    const div4    = document.getElementById("div4");

    if (catSec && catGrid) {
        catGrid.innerHTML = Object.entries(catMap)
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => buildCatCard(name, count))
            .join("");
        catSec.style.display = "block";
        if (div4) div4.style.display = "block";
    }

    // ── ALL APPS ──
    const allSec  = document.getElementById("allSection");
    const allGrid = document.getElementById("allGrid");
    const countEl = document.getElementById("totalCount");

    if (allSec && allGrid) {
        allGrid.innerHTML = apps.map(buildAppCard).join("");
        if (countEl) countEl.textContent = `${apps.length} app${apps.length !== 1 ? "s" : ""}`;
        allSec.style.display = "block";
    }

    lucide.createIcons();
}

// ------------------------------------------------
// INIT HOME
// ------------------------------------------------
async function initHome() {
    // Only run on home page
    if (!document.getElementById("globalLoader")) return;
    if (document.getElementById("appContent")) return; // app.html

    const [staticApps, dynApps] = await Promise.all([
        fetchStatic(),
        fetchDynamic()
    ]);

    STATE.rawStatic  = staticApps;
    STATE.rawDynamic = dynApps;
    STATE.apps       = mergeApps(staticApps, dynApps);

    renderHome(STATE.apps);
}

// ------------------------------------------------
// DOMContentLoaded
// ------------------------------------------------
document.addEventListener("DOMContentLoaded", initHome);
