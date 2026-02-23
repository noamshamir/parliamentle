let target = null;
let selectedId = null; // now stores ISO (e.g., "JP"), not an SVG id like "JP__2"
let selectedName = null;
let panZoom = null;
let gameActive = false;
let currentMode = "daily";
let countryGuessed = false;
let hintStage = 0; // 0 = no hint, 1 = positions shown, 2 = names shown

window.onload = function () {
    const container = document.getElementById("map-placeholder");
    if (container) {
        container.innerHTML = WORLD_MAP_SVG;
    }
    panZoom = svgPanZoom("#world-map", {
        zoomEnabled: true,
        controlIconsEnabled: false,
        fit: true,
        center: true,
        minZoom: 0.5,
        maxZoom: 20,
        preventMouseEventsDefault: false,
        beforePan: function (oldPan, newPan) {
            var sizes = this.getSizes();
            var gutterWidth = sizes.width,
                gutterHeight = sizes.height;
            var leftLimit =
                -((sizes.viewBox.x + sizes.viewBox.width) * sizes.realZoom) +
                gutterWidth / 2;
            var rightLimit = sizes.width - gutterWidth / 2;
            var topLimit =
                -((sizes.viewBox.y + sizes.viewBox.height) * sizes.realZoom) +
                gutterHeight / 2;
            var bottomLimit = sizes.height - gutterHeight / 2;
            return {
                x: Math.max(leftLimit, Math.min(rightLimit, newPan.x)),
                y: Math.max(topLimit, Math.min(bottomLimit, newPan.y)),
            };
        },
    });

    setInterval(updateCountdown, 1000);
    updateCountdown();

    setupMapEvents();
};

function startGame(mode) {
    currentMode = mode;

    document.getElementById("main-menu").classList.add("hidden");

    resetGameStateUI();

    if (mode === "daily") {
        target = getDailyTarget();
        const todayStr = new Date().toISOString().split("T")[0];
        const lastWon = localStorage.getItem("electle_last_won");

        if (lastWon === todayStr) {
            gameActive = false;
            document.getElementById("diagram-img").src = target.img;
            showWinModal(true);
            document.getElementById("main-timer-box").style.display = "block";
        } else {
            gameActive = true;
            document.getElementById("diagram-img").src = target.img;
        }
    } else {
        nextRound();
    }

    setTimeout(() => panZoom.resize(), 350);
}

function goToMenu() {
    document.getElementById("main-menu").classList.remove("hidden");
    closeModal();
}

function nextRound() {
    if (currentMode !== "endless") return;

    const randomIndex = Math.floor(Math.random() * database.length);
    target = database[randomIndex];

    resetGameStateUI();
    gameActive = true;
    document.getElementById("diagram-img").src = target.img;

    console.log("New Round:", target.country);
}

function getDailyTarget() {
    const epoch = new Date("2024-01-01");
    const today = new Date();
    const diffTime = Math.abs(today - epoch);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const index = diffDays % database.length;
    return database[index];
}

function resetGameStateUI() {
    selectedId = null;
    countryGuessed = false;

    document.querySelectorAll("path").forEach((p) => {
        p.classList.remove(
            "correct",
            "wrong",
            "regional",
            "selected",
            "is-country-hover",
            "is-region-hover",
            "region-hover",
        );
    });

    const yearInput = document.getElementById("year-input");
    yearInput.value = "";
    yearInput.disabled = false;

    yearInput.style.borderColor = "";
    yearInput.style.color = "";

    const statusText = document.getElementById("selected-display");
    statusText.innerHTML = "Selected: <span>—</span>";

    document.getElementById("submit-btn").disabled = false;
    document.getElementById("hint-btn").disabled = false;
    document.getElementById("hint-btn").textContent = "\uD83D\uDCA1 Hint (1/2)";
    hintStage = 0;
    const partiesHint = document.getElementById("parties-hint");
    partiesHint.style.display = "none";
    partiesHint.innerHTML = "";
    document.getElementById("history").innerHTML = "";
    document.getElementById("win-modal").classList.remove("visible");

    if (panZoom) panZoom.reset();
}

function getIsoFromPath(p) {
    // After your fix script, countries should be identified by data-iso.
    // Fallback: try to strip suffixes from id just in case.
    const iso = (p?.dataset?.iso || "").trim();
    if (iso) return iso.toUpperCase();

    const rawId = (p?.id || "").trim();
    if (!rawId) return null;
    return rawId.split("__")[0].toUpperCase();
}

function handleHint() {
    if (!target || !target.parties || target.parties.length === 0) return;
    const container = document.getElementById("parties-hint");
    const btn = document.getElementById("hint-btn");

    if (hintStage === 0) {
        // Hint 1/2: show positions with colored dots (no party names)
        const tags = target.parties
            .map((p) => {
                const color = typeof p === "object" && p.color ? p.color : "";
                const position =
                    typeof p === "object" && p.position
                        ? p.position
                        : "Unknown";
                const dot = color
                    ? `<span class="party-dot" style="background:${color}"></span>`
                    : `<span class="party-dot" style="background:#666"></span>`;
                return `<span class="party-tag">${dot}${position}</span>`;
            })
            .join("");
        container.innerHTML = `<div class="parties-label">Political positions:</div>${tags}`;
        container.style.display = "block";
        btn.textContent = "\uD83D\uDCA1 Hint (2/2)";
        hintStage = 1;
    } else if (hintStage === 1) {
        // Hint 2/2: show party names with position in parentheses
        const tags = target.parties
            .map((p) => {
                const name = typeof p === "string" ? p : p.name;
                const color = typeof p === "object" && p.color ? p.color : "";
                const position =
                    typeof p === "object" && p.position ? p.position : "";
                const dot = color
                    ? `<span class="party-dot" style="background:${color}"></span>`
                    : "";
                const posText = position
                    ? ` <span style="color:#888">(${position})</span>`
                    : "";
                return `<span class="party-tag">${dot}${name}${posText}</span>`;
            })
            .join("");
        container.innerHTML = `<div class="parties-label">Parties in parliament:</div>${tags}`;
        btn.disabled = true;
        hintStage = 2;
    }
}

function setupMapEvents() {
    const paths = document.querySelectorAll("path");
    paths.forEach((p) => {
        p.addEventListener("click", () => handleCountrySelect(p));

        p.addEventListener("mouseenter", () => {
            if (!gameActive || countryGuessed) return;

            const iso = getIsoFromPath(p);
            if (!iso) return;

            document
                .querySelectorAll(`path[data-iso="${iso}"]`)
                .forEach((el) => {
                    el.classList.add("is-country-hover");
                });

            const isGray =
                !p.classList.contains("selected") &&
                !p.classList.contains("regional") &&
                !p.classList.contains("wrong") &&
                !p.classList.contains("correct");

            if (isGray) {
                const region = getRegionByCountryId(iso);
                if (region && regionMap[region]) {
                    regionMap[region].forEach((id) => {
                        const upperId = id.toUpperCase();
                        document
                            .querySelectorAll(`path[data-iso="${upperId}"]`)
                            .forEach((el) => {
                                el.classList.add("is-region-hover");
                            });
                    });
                }
            }
        });

        p.addEventListener("mouseleave", () => {
            document.querySelectorAll(".is-country-hover").forEach((el) => {
                el.classList.remove("is-country-hover");
            });
            document.querySelectorAll(".is-region-hover").forEach((el) => {
                el.classList.remove("is-region-hover");
            });
        });

        let startX, startY;
        p.addEventListener(
            "touchstart",
            (e) => {
                if (e.touches.length > 1) return;
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
            },
            { passive: true },
        );
        p.addEventListener("touchend", (e) => {
            if (!startX || !startY) return;
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            if (Math.abs(endX - startX) < 10 && Math.abs(endY - startY) < 10) {
                e.preventDefault();
                handleCountrySelect(p);
            }
            startX = null;
            startY = null;
        });
    });
}

function handleRegionHover(countryId, isHovering) {
    if (!gameActive || countryGuessed) return;

    const regionName = getRegionByCountryId(countryId);
    if (!regionName) return;

    const regionCountries = regionMap[regionName];
    if (regionCountries) {
        regionCountries.forEach((id) => {
            const upperId = id.toUpperCase();
            document
                .querySelectorAll(`path[data-iso="${upperId}"]`)
                .forEach((el) => {
                    if (
                        !el.classList.contains("correct") &&
                        !el.classList.contains("wrong") &&
                        !el.classList.contains("regional") &&
                        !el.classList.contains("selected")
                    ) {
                        if (isHovering) {
                            el.classList.add("region-hover");
                        } else {
                            el.classList.remove("region-hover");
                        }
                    }
                });
        });
    }
}

function getRegionByCountryId(id) {
    const upperId = (id || "").toUpperCase();
    for (const [region, countries] of Object.entries(regionMap)) {
        if (countries.includes(upperId)) return region;
    }
    return null;
}

function handleCountrySelect(el) {
    if (!gameActive || countryGuessed) return;
    if (el.classList.contains("correct") || el.classList.contains("wrong"))
        return;

    const iso = getIsoFromPath(el);
    if (!iso) return;

    if (selectedId) {
        const oldPieces = document.querySelectorAll(
            `path[data-iso="${selectedId}"]`,
        );
        oldPieces.forEach((piece) => piece.classList.remove("selected"));
    }

    selectedId = iso;
    selectedName = el.getAttribute("name") || iso;

    const newPieces = document.querySelectorAll(
        `path[data-iso="${selectedId}"]`,
    );
    newPieces.forEach((piece) => piece.classList.add("selected"));

    document.getElementById("selected-display").innerHTML =
        `Selected: <span>${selectedName}</span>`;
}

function makeGuess() {
    if (!gameActive) return;

    const yearInput = document.getElementById("year-input");
    const statusText = document.getElementById("selected-display");
    const userYear = parseInt(yearInput.value);

    if (!selectedId) {
        statusText.innerHTML =
            "<span style='color:#ff5555'>⚠ Select a country!</span>";
        return;
    }
    if (!userYear) {
        statusText.innerHTML =
            "<span style='color:#ff5555'>⚠ Enter year!</span>";
        return;
    }

    let rawIds = target.ids ? target.ids : [target.id];
    const correctIds = rawIds.map((id) => id.toUpperCase());

    const currentSelectedUpper = selectedId.toUpperCase();

    const isCountryCorrect = correctIds.includes(currentSelectedUpper);

    const userRegion = getRegionByCountryId(selectedId);
    const isRegionCorrect = userRegion === target.region;
    const yearDiff = Math.abs(userYear - target.year);

    document
        .querySelectorAll(`path[data-iso="${selectedId}"]`)
        .forEach((el) => el.classList.remove("selected"));

    if (isCountryCorrect) {
        countryGuessed = true;

        correctIds.forEach((id) => {
            document
                .querySelectorAll(`path[data-iso="${id}"]`)
                .forEach((el) => {
                    el.classList.remove("wrong", "regional");
                    el.classList.add("correct");
                });
        });

        selectedName = target.country;
    } else if (isRegionCorrect) {
        const regionCountries = regionMap[target.region];
        if (regionCountries) {
            regionCountries.forEach((countryId) => {
                const upperId = countryId.toUpperCase();
                document
                    .querySelectorAll(`path[data-iso="${upperId}"]`)
                    .forEach((el) => {
                        if (
                            el.dataset.iso !== selectedId &&
                            !el.classList.contains("correct")
                        ) {
                            el.classList.add("regional");
                        }
                    });
            });
        }
        document
            .querySelectorAll(`path[data-iso="${selectedId}"]`)
            .forEach((el) => el.classList.add("wrong"));
    } else {
        document
            .querySelectorAll(`path[data-iso="${selectedId}"]`)
            .forEach((el) => el.classList.add("wrong"));
    }

    let yearIcon = yearDiff === 0 ? "✅" : userYear < target.year ? "↑" : "↓";
    let rowClass = "history-row";
    if (isCountryCorrect && yearDiff === 0) rowClass += " win";
    else if (isCountryCorrect || isRegionCorrect) rowClass += " close";
    let icon = isCountryCorrect ? "🌍✅" : isRegionCorrect ? "🌍🟡" : "🌍❌";

    const historyLog = document.getElementById("history");
    const row = document.createElement("div");
    row.className = rowClass;
    row.innerHTML = `<div>${selectedName}</div><div>${icon} | ${userYear} ${yearIcon}</div>`;
    historyLog.prepend(row);

    if (isCountryCorrect && yearDiff === 0) {
        gameActive = false;
        statusText.innerHTML = "<span style='color:#538d4e'>VICTORY!</span>";
        if (currentMode === "daily") {
            localStorage.setItem(
                "electle_last_won",
                new Date().toISOString().split("T")[0],
            );
            document.getElementById("main-timer-box").style.display = "block";
        }
        setTimeout(() => showWinModal(false), 1500);
    } else if (isCountryCorrect) {
        statusText.innerHTML = `<span style='color:#538d4e'>Correct! Now fix the Year (${yearIcon})</span>`;
        yearInput.select();
    } else {
        selectedId = null;
        statusText.innerHTML = "Selected: <span>—</span>";
        if (yearDiff !== 0) {
            yearInput.value = "";
        } else {
            yearInput.style.borderColor = "var(--correct-green)";
            yearInput.style.color = "var(--correct-green)";
        }
    }
}

function showWinModal(instant) {
    document.getElementById("win-country-name").innerText = target.country;
    document.getElementById("win-year-val").innerText = target.year;
    document.getElementById("submit-btn").disabled = true;
    document.getElementById("hint-btn").disabled = true;
    document.getElementById("year-input").disabled = true;

    const historyRows = document.querySelectorAll(".history-row");
    document.getElementById("attempt-count").innerText = historyRows.length;
    const listContainer = document.getElementById("win-history-list");
    listContainer.innerHTML = "";
    for (let i = 0; i < historyRows.length; i++) {
        const miniRow = document.createElement("div");
        miniRow.className = "mini-row";
        miniRow.innerHTML = historyRows[i].innerHTML;
        listContainer.appendChild(miniRow);
    }

    const timerEls = document.querySelectorAll(".countdown-text");
    const nextBtn = document.getElementById("next-round-btn");
    const timerLabel = document.querySelector(
        '.modal-content div[style*="text-transform: uppercase"]',
    ); // Label "NEXT GAME IN"

    if (currentMode === "endless") {
        nextBtn.style.display = "block";
        timerEls.forEach((el) => (el.style.display = "none"));
        if (timerLabel) timerLabel.style.display = "none";
    } else {
        nextBtn.style.display = "none";
        timerEls.forEach((el) => (el.style.display = "block"));
        if (timerLabel) timerLabel.style.display = "block";
    }

    const modal = document.getElementById("win-modal");
    modal.classList.add("visible");
    if (instant) modal.style.transition = "none";
}

function closeModal() {
    document.getElementById("win-modal").classList.remove("visible");
}

function updateCountdown() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const diff = tomorrow - now;
    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);
    const timeStr = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    document
        .querySelectorAll(".countdown-text")
        .forEach((t) => (t.innerText = timeStr));
}
