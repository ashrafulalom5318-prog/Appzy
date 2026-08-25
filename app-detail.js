/* ================================================
   APPZY — APP-DETAIL.JS
   App detail page — download + ratings + password protection
================================================ */

let CURRENT_APP    = null;
let selectedRating = 0;

// ------------------------------------------------
// INIT DETAIL PAGE
// ------------------------------------------------
async function initDetail() {
    const content  = document.getElementById("appContent");
    if (!content) return;

    const loader   = document.getElementById("globalLoader");
    const notFound = document.getElementById("notFound");
    const appId    = getParam("id");

    if (!appId) {
        if (loader)   loader.style.display   = "none";
        if (notFound) notFound.style.display = "flex";
        lucide.createIcons();
        return;
    }

    const [staticApps, dynApps] = await Promise.all([
        fetchStatic(),
        fetchDynamic()
    ]);

    const staticApp = staticApps.find(a => a.id === appId);

    if (!staticApp) {
        if (loader)   loader.style.display   = "none";
        if (notFound) notFound.style.display = "flex";
        lucide.createIcons();
        return;
    }

    const dynApp = dynApps.find(d => d.id === appId) || {
        id:             appId,
        download_count: 0,
        ratings:        [],
        average_rating: 0,
        rating_count:   0
    };

    CURRENT_APP = { ...staticApp, ...dynApp };
    document.title = `${CURRENT_APP.name} — Appzy`;

    populateDetail(CURRENT_APP);

    if (loader)  loader.style.display  = "none";
    content.style.display = "block";

    lucide.createIcons();
    initStarInput();
}

// ------------------------------------------------
// POPULATE DETAIL
// ------------------------------------------------
function populateDetail(app) {
    // Icon
    setAttr("appIcon", "src", app.icon || "");
    setAttr("appIcon", "alt", app.name);

    // Hero info
    setText("appCat",      app.category || "App");
    setText("appName",     app.name);
    setText("appTagline",  app.tagline || "");
    setText("heroRating",  app.average_rating ? app.average_rating.toFixed(1) : "New");
    setText("heroDownloads", fmtCount(app.download_count));
    setText("heroSize",    app.size ? app.size + " MB" : "—");

    // Admin Only Badge
    if (app.admin_only) {
        const heroInfo = document.querySelector(".app-hero-info");
        if (heroInfo && !document.querySelector(".admin-chip")) {
            const chip = document.createElement("span");
            chip.className = "admin-chip";
            chip.innerHTML = `<i data-lucide="shield-alert"></i> Admin Only`;
            heroInfo.appendChild(chip);
        }
    }

    // Download bar
    setText("dlVersion", `v${app.version || "—"}`);
    setText("dlAndroid", `Android ${app.min_android || "—"}+`);

    // Stats
    setText("statRating",   app.average_rating ? app.average_rating.toFixed(1) : "New");
    setText("statDownloads", fmtCount(app.download_count));
    setText("statSize",     app.size ? app.size + " MB" : "—");
    setText("statAndroid",  app.min_android ? `${app.min_android}+` : "—");

    // Description
    setText("appDesc", app.description || "No description available.");

    // Features
    const featEl = document.getElementById("featList");
    if (featEl) {
        if (app.features && app.features.length > 0) {
            featEl.innerHTML = app.features
                .map(f => `<li><span>${f}</span></li>`)
                .join("");
        } else {
            featEl.innerHTML = `<li><span>No features listed.</span></li>`;
        }
    }

    // Info table
    setText("infoVersion",    app.version    || "—");
    setText("infoPackage",    app.package    || "—");
    setText("infoCategory",   app.category   || "—");
    setText("infoMinAndroid", app.min_android ? `Android ${app.min_android}+` : "—");
    setText("infoUpdated",    fmtDate(app.updated_date));
    setText("infoReleased",   fmtDate(app.release_date));

    // Screenshots
    const scrollEl = document.getElementById("screenshotsScroll");
    const ssBock   = document.getElementById("screenshotsBlock");

    if (scrollEl) {
        if (app.screenshots && app.screenshots.length > 0) {
            scrollEl.innerHTML = app.screenshots
                .map(s => `<img src="${s}" alt="Screenshot" loading="lazy">`)
                .join("");
        } else {
            if (ssBock) ssBock.style.display = "none";
        }
    }

    // Download button state
    const dlBtn = document.getElementById("downloadBtn");

    if (app.status === "coming_soon") {
        dlBtn.disabled = true;
        dlBtn.innerHTML = `<i data-lucide="clock"></i> Coming Soon`;
        dlBtn.classList.add("cs-disabled");

        const heroEl = document.querySelector(".app-hero");
        if (heroEl) {
            const banner = document.createElement("div");
            banner.className = "cs-banner";
            banner.innerHTML = `<i data-lucide="clock"></i> This app is coming soon`;
            heroEl.parentNode.insertBefore(banner, heroEl.nextSibling);
            lucide.createIcons();
        }
    } else if (!getDownloadLink(app)) {
        dlBtn.disabled = true;
        dlBtn.innerHTML = `<i data-lucide="x-circle"></i> Unavailable`;
    }

    // Rating display
    refreshRatingUI(app);
}

// ------------------------------------------------
// REFRESH RATING UI
// ------------------------------------------------
function refreshRatingUI(app) {
    const rating = app.average_rating || 0;
    const count  = app.rating_count   || 0;

    setText("bigScore",    rating.toFixed(1));
    setText("ratingCount", `${count} rating${count !== 1 ? "s" : ""}`);
    setText("heroRating",  rating > 0 ? rating.toFixed(1) : "New");
    setText("statRating",  rating > 0 ? rating.toFixed(1) : "New");

    const starsEl = document.getElementById("staticStars");
    if (starsEl) starsEl.innerHTML = starsHTML(rating);
}

// ------------------------------------------------
// HANDLE DOWNLOAD (Password Protected Check)
// ------------------------------------------------
async function handleDownload() {
    if (!CURRENT_APP) return;

    // Check if App is Admin Only Protected
    if (CURRENT_APP.admin_only) {
        openPwdModal();
        return;
    }

    startActualDownload();
}

// ------------------------------------------------
// START ACTUAL DOWNLOAD
// ------------------------------------------------
async function startActualDownload() {
    const link  = getDownloadLink(CURRENT_APP);
    const dlBtn = document.getElementById("downloadBtn");

    if (!link) {
        showToast("Download link not available!", "error");
        return;
    }

    const orig = dlBtn.innerHTML;
    dlBtn.disabled = true;
    dlBtn.innerHTML = `<i data-lucide="loader"></i> Starting...`;
    lucide.createIcons();

    try {
        const a  = document.createElement("a");
        a.href   = link;
        a.target = "_blank";
        a.rel    = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        await incrDownload(CURRENT_APP.id);
        showToast("Download started! 🎉");

    } catch (err) {
        console.error("Download error:", err);
        showToast("Something went wrong!", "error");
    } finally {
        setTimeout(() => {
            dlBtn.innerHTML = orig;
            dlBtn.disabled  = false;
            lucide.createIcons();
        }, 2500);
    }
}

// ------------------------------------------------
// PASSWORD MODAL LOGIC
// ------------------------------------------------
function openPwdModal() {
    const modal  = document.getElementById("pwdModal");
    const pwdInp = document.getElementById("pwdInput");
    const pwdErr = document.getElementById("pwdError");
    
    if (!modal) return;
    if (pwdInp) pwdInp.value = "";
    if (pwdErr) pwdErr.style.display = "none";

    modal.classList.add("active");
    if (pwdInp) pwdInp.focus();
}

function closePwdModal() {
    const modal = document.getElementById("pwdModal");
    if (modal) modal.classList.remove("active");
}

function verifyPasswordAndDownload() {
    const pwdInp = document.getElementById("pwdInput");
    const pwdErr = document.getElementById("pwdError");
    const userEntered = pwdInp ? pwdInp.value.trim() : "";

    if (!CURRENT_APP) return;

    if (userEntered === CURRENT_APP.admin_password) {
        closePwdModal();
        showToast("Access Granted! Starting download...", "success");
        startActualDownload();
    } else {
        if (pwdErr) pwdErr.style.display = "block";
        if (pwdInp) {
            pwdInp.classList.add("shake");
            setTimeout(() => pwdInp.classList.remove("shake"), 500);
        }
    }
}

// ------------------------------------------------
// INCREMENT DOWNLOAD
// ------------------------------------------------
async function incrDownload(appId) {
    try {
        const dynApps = await fetchDynamic();
        let entry = dynApps.find(d => d.id === appId);

        if (!entry) {
            entry = {
                id:             appId,
                download_count: 0,
                ratings:        [],
                average_rating: 0,
                rating_count:   0
            };
            dynApps.push(entry);
        }

        entry.download_count = (entry.download_count || 0) + 1;
        await updateDynamic(dynApps);

        const count = fmtCount(entry.download_count);
        setText("statDownloads",  count);
        setText("heroDownloads",  count);

    } catch (e) {
        console.error("incrDownload error:", e);
    }
}

// ------------------------------------------------
// STAR INPUT INIT
// ------------------------------------------------
function initStarInput() {
    const container = document.getElementById("starInput");
    if (!container) return;

    const stars = container.querySelectorAll("i");

    stars.forEach(star => {
        star.addEventListener("mouseenter", () => {
            lightStars(parseInt(star.getAttribute("data-val")));
        });

        star.addEventListener("click", () => {
            const val  = parseInt(star.getAttribute("data-val"));
            selectedRating = val;
            submitRating(val);
        });
    });

    container.addEventListener("mouseleave", () => {
        lightStars(selectedRating);
    });
}

// ------------------------------------------------
// LIGHT STARS
// ------------------------------------------------
function lightStars(n) {
    const container = document.getElementById("starInput");
    if (!container) return;

    container.querySelectorAll("i").forEach(star => {
        const v = parseInt(star.getAttribute("data-val"));
        star.classList.toggle("lit", v <= n);
    });
}

// ------------------------------------------------
// SUBMIT RATING
// ------------------------------------------------
async function submitRating(val) {
    if (!CURRENT_APP) return;

    const key       = "appzy_rated";
    const ratedList = JSON.parse(localStorage.getItem(key) || "[]");

    if (ratedList.includes(CURRENT_APP.id)) {
        showToast("You've already rated this app!", "error");
        return;
    }

    try {
        const dynApps = await fetchDynamic();
        let entry = dynApps.find(d => d.id === CURRENT_APP.id);

        if (!entry) {
            entry = {
                id:             CURRENT_APP.id,
                download_count: 0,
                ratings:        [],
                average_rating: 0,
                rating_count:   0
            };
            dynApps.push(entry);
        }

        if (!Array.isArray(entry.ratings)) entry.ratings = [];
        entry.ratings.push(val);
        entry.rating_count  = entry.ratings.length;
        entry.average_rating = parseFloat(
            (entry.ratings.reduce((s, r) => s + r, 0) / entry.ratings.length).toFixed(1)
        );

        await updateDynamic(dynApps);

        ratedList.push(CURRENT_APP.id);
        localStorage.setItem(key, JSON.stringify(ratedList));

        CURRENT_APP.ratings        = entry.ratings;
        CURRENT_APP.rating_count   = entry.rating_count;
        CURRENT_APP.average_rating = entry.average_rating;

        refreshRatingUI(CURRENT_APP);
        lucide.createIcons();
        showToast("Thanks for rating! ⭐");

    } catch (e) {
        console.error("submitRating error:", e);
        showToast("Couldn't submit rating!", "error");
    }
}

// ------------------------------------------------
// DOM HELPERS
// ------------------------------------------------
function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function setAttr(id, attr, val) {
    const el = document.getElementById(id);
    if (el) el.setAttribute(attr, val);
}

// ------------------------------------------------
// INIT
// ------------------------------------------------
document.addEventListener("DOMContentLoaded", initDetail);
