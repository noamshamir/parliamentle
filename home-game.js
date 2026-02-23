/* ═══════════════════════════════════════════════════════════
   home-game.js  –  wires game widgets on the home page
   Loads AFTER script.js; overrides window.onload and
   handleCountrySelect so the shared game logic works
   against the home-page DOM.
   ═══════════════════════════════════════════════════════════ */

/* ── local hint state (separate from script.js hintStage) ── */
var hgHintStage = 0;
var hgGuessCount = 0;
var HG_MAX_GUESSES = 8;

/* ═══════════════════════════════════════════════════════════
   Submit-button readiness  –  white until both a country
   and a valid year are chosen, then turns black.
   ═══════════════════════════════════════════════════════════ */
function hgUpdateSubmitState() {
    var btn = document.getElementById("hg-submit-btn");
    if (!btn) return;
    var yearEl = document.getElementById("hg-timeline-year");
    var yearVal = yearEl ? parseInt(yearEl.value) : NaN;
    var hasCountry = !!selectedId;
    var hasYear = !isNaN(yearVal) && yearVal > 0;

    if (hasCountry && hasYear) {
        btn.classList.add("ready");
    } else {
        btn.classList.remove("ready");
    }
}

/* ═══════════════════════════════════════════════════════════
   Override handleCountrySelect
   (original in script.js references #selected-display which
    does not exist on the home page)
   ═══════════════════════════════════════════════════════════ */
function handleCountrySelect(el) {
    if (!gameActive || countryGuessed) return;
    if (
        el.classList.contains("correct") ||
        el.classList.contains("wrong") ||
        el.classList.contains("guessed-wrong")
    )
        return;

    var iso = getIsoFromPath(el);
    if (!iso) return;

    /* deselect previous */
    if (selectedId) {
        document
            .querySelectorAll('path[data-iso="' + selectedId + '"]')
            .forEach(function (p) {
                p.classList.remove("selected");
            });
    }

    selectedId = iso;
    selectedName = el.getAttribute("name") || iso;

    /* show country name */
    var countryLabel = document.getElementById("hg-selected-country");
    if (countryLabel) countryLabel.textContent = selectedName;

    /* highlight new selection */
    document
        .querySelectorAll('path[data-iso="' + selectedId + '"]')
        .forEach(function (p) {
            p.classList.add("selected");
        });

    hgUpdateSubmitState();
}

/* ═══════════════════════════════════════════════════════════
   Hint handling  →  #hg-hint-panel
   ═══════════════════════════════════════════════════════════ */
function hgRedactCountry(text, country) {
    if (!country) return text;
    /* Build list of words to redact: country name + common adjectival forms */
    var words = [country];
    /* Simple demonym heuristics */
    if (country.endsWith("land"))
        words.push(
            country.replace(/land$/, "landic"),
            country.replace(/land$/, "lander"),
            country.replace(/land$/, "landish"),
        );
    if (country.endsWith("a")) words.push(country.replace(/a$/, "an"));
    else if (country.endsWith("e")) words.push(country.replace(/e$/, "ian"));
    else
        words.push(
            country + "ian",
            country + "ese",
            country + "ish",
            country + "i",
        );
    /* Special common cases */
    var specials = {
        Indonesia: ["Indonesian"],
        France: ["French"],
        Spain: ["Spanish"],
        Portugal: ["Portuguese"],
        Germany: ["German"],
        Italy: ["Italian"],
        Greece: ["Greek"],
        Netherlands: ["Dutch"],
        Belgium: ["Belgian"],
        Denmark: ["Danish"],
        Sweden: ["Swedish"],
        Norway: ["Norwegian"],
        Finland: ["Finnish"],
        Poland: ["Polish"],
        Turkey: ["Turkish"],
        Ireland: ["Irish"],
        "Czech Republic": ["Czech"],
        Czechia: ["Czech"],
        "United Kingdom": ["British", "UK", "English", "Scottish", "Welsh"],
        "United States": ["American", "US", "U.S."],
        China: ["Chinese"],
        Japan: ["Japanese"],
        Korea: ["Korean"],
        "South Korea": ["Korean"],
        "North Korea": ["Korean"],
        Israel: ["Israeli"],
        India: ["Indian"],
        Pakistan: ["Pakistani"],
        Bangladesh: ["Bangladeshi"],
        Thailand: ["Thai"],
        Philippines: ["Filipino", "Philippine"],
        Switzerland: ["Swiss"],
        Luxembourg: ["Luxembourgish"],
        Peru: ["Peruvian"],
        Chile: ["Chilean"],
        Mexico: ["Mexican"],
        Brazil: ["Brazilian"],
        Argentina: ["Argentine", "Argentinian"],
        Iraq: ["Iraqi"],
        Iran: ["Iranian"],
        "New Zealand": ["New Zealand", "Kiwi"],
        Australia: ["Australian"],
        Canada: ["Canadian"],
        Russia: ["Russian"],
        Hungary: ["Hungarian"],
        Romania: ["Romanian"],
    };
    if (specials[country]) words = words.concat(specials[country]);
    /* Deduplicate and sort longest-first so longer matches replace first */
    words = Array.from(new Set(words)).sort(function (a, b) {
        return b.length - a.length;
    });
    var pattern = new RegExp(
        "(" +
            words
                .map(function (w) {
                    return w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                })
                .join("|") +
            ")",
        "gi",
    );
    // if the country name is in parentheses, such as (Denmark), just remove it. Otherwise, redact with [country]
    var output = text.replace(/\(([^)]+)\)/g, function (match, p1) {
        if (words.includes(p1)) {
            return "";
        }
        return match;
    });
    output = output.replace(pattern, "[country]");
    return output;
}

function hgDoHint(stage) {
    if (!target || !target.parties || target.parties.length === 0) return;
    var panel = document.getElementById("hg-hint-panel");
    if (!panel) return;

    if (stage === 1 && hgHintStage < 1) {
        /* Stage 1 – positions with coloured dots, no names */
        var tags = target.parties
            .map(function (p) {
                var color = typeof p === "object" && p.color ? p.color : "#666";
                var position =
                    typeof p === "object" && p.position
                        ? p.position
                        : "Unknown";
                return (
                    '<span class="party-tag">' +
                    '<span class="party-dot" style="background:' +
                    color +
                    '"></span>' +
                    position +
                    "</span>"
                );
            })
            .join("");

        var wrapClass =
            target.parties.length >= 7 ? "party-list hg-wrap" : "party-list";
        panel.innerHTML =
            '<div class="parties-label">Political positions:</div>' +
            '<div class="' +
            wrapClass +
            '">' +
            tags +
            "</div>";
        panel.style.display = "block";
        hgHintStage = 1;

        document.getElementById("hint-1").style.opacity = "0.4";
        document.getElementById("hint-1").style.pointerEvents = "none";
    } else if (stage === 2 && hgHintStage < 2) {
        /* Ensure stage 1 ran first */
        if (hgHintStage < 1) hgDoHint(1);

        /* Stage 2 – party names with positions, country name redacted */
        var country = target.country || "";
        var tags = target.parties
            .map(function (p) {
                var name = typeof p === "string" ? p : p.name;
                var color = typeof p === "object" && p.color ? p.color : "";
                var position =
                    typeof p === "object" && p.position ? p.position : "";
                var redactedName = hgRedactCountry(name, country);
                var dot = color
                    ? '<span class="party-dot" style="background:' +
                      color +
                      '"></span>'
                    : "";
                var posText = position
                    ? '<span class="party-pos" style="color:#888">(' +
                      position +
                      ")</span>"
                    : "";
                return (
                    '<span class="party-tag">' +
                    dot +
                    redactedName +
                    (posText ? posText : "") +
                    "</span>"
                );
            })
            .join("");

        var wrapClass =
            target.parties.length >= 7 ? "party-list hg-wrap" : "party-list";
        panel.innerHTML =
            '<div class="parties-label">Parties in parliament:</div>' +
            '<div class="' +
            wrapClass +
            '">' +
            tags +
            "</div>";
        panel.style.display = "block";
        hgHintStage = 2;

        document.getElementById("hint-2").style.opacity = "0.4";
        document.getElementById("hint-2").style.pointerEvents = "none";
    } else if (stage === 3 && hgHintStage < 3) {
        /* Ensure stages 1 & 2 ran first */
        if (hgHintStage < 2) hgDoHint(2);

        /* Stage 3 – full party names with positions, no redaction */
        var tags = target.parties
            .map(function (p) {
                var name = typeof p === "string" ? p : p.name;
                var color = typeof p === "object" && p.color ? p.color : "";
                var position =
                    typeof p === "object" && p.position ? p.position : "";
                var dot = color
                    ? '<span class="party-dot" style="background:' +
                      color +
                      '"></span>'
                    : "";
                var posText = position
                    ? '<span class="party-pos" style="color:#888">(' +
                      position +
                      ")</span>"
                    : "";
                return (
                    '<span class="party-tag">' +
                    dot +
                    name +
                    (posText ? posText : "") +
                    "</span>"
                );
            })
            .join("");

        var wrapClass =
            target.parties.length >= 7 ? "party-list hg-wrap" : "party-list";
        panel.innerHTML =
            '<div class="parties-label">Parties in parliament:</div>' +
            '<div class="' +
            wrapClass +
            '">' +
            tags +
            "</div>";
        panel.style.display = "block";
        hgHintStage = 3;

        document.getElementById("hint-3").style.opacity = "0.4";
        document.getElementById("hint-3").style.pointerEvents = "none";
    }
}

/* ═══════════════════════════════════════════════════════════
   Guess mechanic
   ═══════════════════════════════════════════════════════════ */
function hgMakeGuess() {
    if (!gameActive) return;
    if (hgGuessCount >= HG_MAX_GUESSES) return;

    var yearLabel = document.getElementById("hg-timeline-year");
    var disp = document.getElementById("hg-selected-display");
    var userYear = parseInt(yearLabel.value);

    if (!selectedId) {
        if (disp)
            disp.innerHTML =
                '<span style="color:#c0392b">⚠ Select a country on the map</span>';
        return;
    }
    if (!userYear || isNaN(userYear)) {
        if (disp)
            disp.innerHTML =
                '<span style="color:#c0392b">⚠ Scroll the timeline to pick a year</span>';
        return;
    }

    var rawIds = target.ids ? target.ids : [target.id];
    var correctIds = rawIds.map(function (id) {
        return id.toUpperCase();
    });
    var currentSelectedUpper = selectedId.toUpperCase();

    var isCountryCorrect = correctIds.indexOf(currentSelectedUpper) !== -1;
    var userRegion = getRegionByCountryId(selectedId);
    var isRegionCorrect = userRegion === target.region;
    var yearDiff = Math.abs(userYear - target.year);

    /* remove selection highlight */
    document
        .querySelectorAll('path[data-iso="' + selectedId + '"]')
        .forEach(function (el) {
            el.classList.remove("selected");
        });
    /* clear country name display */
    var countryLabel = document.getElementById("hg-selected-country");
    if (countryLabel) countryLabel.textContent = "";
    /* colour map */
    if (isCountryCorrect) {
        countryGuessed = true;
        correctIds.forEach(function (id) {
            document
                .querySelectorAll('path[data-iso="' + id + '"]')
                .forEach(function (el) {
                    el.classList.remove("wrong", "regional");
                    el.classList.add("correct");
                });
        });
        selectedName = target.country;
    } else if (isRegionCorrect) {
        var regionCountries = regionMap[target.region];
        if (regionCountries) {
            regionCountries.forEach(function (cid) {
                var uid = cid.toUpperCase();
                document
                    .querySelectorAll('path[data-iso="' + uid + '"]')
                    .forEach(function (el) {
                        if (!el.classList.contains("correct")) {
                            el.classList.add("regional");
                        }
                    });
            });
        }
        /* guessed country blends into the yellow region */
    } else {
        /* wrong region — revert to default grey (no marker) */
    }

    hgGuessCount++;

    /* tile classes */
    var cTileClass = isCountryCorrect
        ? "hg-tile hg-tile-correct"
        : isRegionCorrect
          ? "hg-tile hg-tile-regional"
          : "hg-tile hg-tile-wrong";
    var cTileText =
        '<img class="hg-tile-pin" src="assets/images/pin.png" alt="" />';
    var yTileClass = yearDiff === 0 ? "hg-tile-year exact" : "hg-tile-year";
    var yTileText =
        yearDiff === 0
            ? String(userYear)
            : userYear + (userYear < target.year ? " ↑" : " ↓");

    /* build history row */
    var history = document.getElementById("hg-history");
    var row = document.createElement("div");
    row.className = "hg-history-row";
    row.innerHTML =
        '<span class="hg-history-country">' +
        selectedName +
        "</span>" +
        '<span class="hg-history-tiles">' +
        '<span class="' +
        cTileClass +
        '">' +
        cTileText +
        "</span>" +
        '<span class="' +
        yTileClass +
        '">' +
        yTileText +
        "</span>" +
        "</span>";
    history.prepend(row);

    /* update counter */
    var counter = document.getElementById("hg-guess-counter");
    if (counter) counter.textContent = hgGuessCount + " / " + HG_MAX_GUESSES;

    /* check win */
    if (isCountryCorrect && yearDiff === 0) {
        gameActive = false;
        if (disp) disp.innerHTML = "";
        document.getElementById("hg-submit-btn").disabled = true;
        hgShowModal(true);
    } else if (hgGuessCount >= HG_MAX_GUESSES) {
        /* out of guesses */
        gameActive = false;
        if (disp) disp.innerHTML = "";
        document.getElementById("hg-submit-btn").disabled = true;
        hgShowModal(false);
    } else if (isCountryCorrect) {
        if (disp)
            disp.innerHTML =
                '<span style="color:#538d4e">✓ Country correct — adjust the year</span>';
    } else {
        selectedId = null;
        if (disp) disp.innerHTML = "Select a country on the map";
    }
}

/* ═══════════════════════════════════════════════════════════
   Game-over modal
   ═══════════════════════════════════════════════════════════ */
function hgShowModal(won) {
    var overlay = document.getElementById("hg-modal-overlay");
    var titleEl = document.getElementById("hg-modal-title");
    var answerEl = document.getElementById("hg-modal-answer");
    var guessesEl = document.getElementById("hg-modal-guesses");

    titleEl.textContent = won ? "Correct!" : "Game Over";
    titleEl.className =
        "hg-modal-title" + (won ? " hg-modal-win" : " hg-modal-lose");
    answerEl.textContent = target.country + ", " + target.year;

    /* clone guess history rows into modal */
    var historyEl = document.getElementById("hg-history");
    guessesEl.innerHTML = "";
    var rows = historyEl.querySelectorAll(".hg-history-row");
    for (var i = rows.length - 1; i >= 0; i--) {
        var clone = rows[i].cloneNode(true);
        clone.style.animation = "none";
        guessesEl.appendChild(clone);
    }

    overlay.classList.add("visible");
}

function hgCloseModal() {
    document.getElementById("hg-modal-overlay").classList.remove("visible");
}

/* ═══════════════════════════════════════════════════════════
   Year timeline
   ═══════════════════════════════════════════════════════════ */
function hgInitTimeline() {
    var yearSet = new Set();
    database.forEach(function (e) {
        if (e.year) yearSet.add(e.year);
    });
    var years = Array.from(yearSet).sort(function (a, b) {
        return a - b;
    });
    if (years.length === 0) return;

    var viewport = document.getElementById("hg-timeline-viewport");
    var track = document.getElementById("hg-timeline-track");
    var label = document.getElementById("hg-timeline-year");
    if (!viewport || !track || !label) return;

    var minYear = years[0];
    var maxYear = years[years.length - 1];
    var pxPerYear = 12;
    var totalWidth = (maxYear - minYear) * pxPerYear;

    track.style.width = totalWidth + "px";
    track.innerHTML = "";

    /* ── major ticks every 25 years ── */
    var majorInterval = 25;
    var firstMajor = Math.ceil(minYear / majorInterval) * majorInterval;
    for (var y = firstMajor; y <= maxYear; y += majorInterval) {
        var xPos = (y - minYear) * pxPerYear;

        var tick = document.createElement("div");
        tick.className = "hg-timeline-tick major";
        tick.style.left = xPos + "px";
        track.appendChild(tick);

        var lbl = document.createElement("div");
        lbl.className = "hg-timeline-tick-label";
        lbl.style.left = xPos + "px";
        lbl.textContent = y;
        track.appendChild(lbl);
    }

    /* ── minor ticks every 5 years ── */
    for (var y = Math.ceil(minYear / 5) * 5; y <= maxYear; y += 5) {
        if (y % majorInterval === 0) continue;
        var xPos = (y - minYear) * pxPerYear;
        var tick = document.createElement("div");
        tick.className = "hg-timeline-tick";
        tick.style.left = xPos + "px";
        track.appendChild(tick);
    }

    /* ── offset = translateX of the track.
       The year at the viewport centre is:
       year = minYear + (viewportW/2 - offset) / pxPerYear  ── */
    var offset = 0;

    function setOffset(newOffset) {
        var vw = viewport.clientWidth;
        /* clamp so minYear–maxYear stay reachable at centre */
        var minOff = vw / 2 - totalWidth;
        var maxOff = vw / 2;
        offset = Math.max(minOff, Math.min(maxOff, newOffset));
        track.style.transform = "translateX(" + offset + "px)";

        var centreYear = Math.round(minYear + (vw / 2 - offset) / pxPerYear);
        centreYear = Math.max(minYear, Math.min(maxYear, centreYear));
        label.value = centreYear;
        hgUpdateSubmitState();
    }

    /* move the track to a given year without touching the input */
    function setOffsetSilent(newOffset) {
        var vw = viewport.clientWidth;
        var minOff = vw / 2 - totalWidth;
        var maxOff = vw / 2;
        offset = Math.max(minOff, Math.min(maxOff, newOffset));
        track.style.transform = "translateX(" + offset + "px)";
    }
    window.hgScrollToYear = function (year) {
        if (year >= minYear && year <= maxYear) {
            var vw = viewport.clientWidth;
            setOffsetSilent(vw / 2 - (year - minYear) * pxPerYear);
        }
    };

    /* start with the middle year centred */
    var midYear = Math.round((minYear + maxYear) / 2);
    setOffset(viewport.clientWidth / 2 - (midYear - minYear) * pxPerYear);

    /* ── horizontal scroll (trackpad / mouse-wheel) ── */
    viewport.addEventListener(
        "wheel",
        function (e) {
            e.preventDefault();
            var delta =
                Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
            setOffset(offset - delta);
        },
        { passive: false },
    );

    /* ── touch swipe ── */
    var touchStartX = null;
    var touchStartOffset = null;

    viewport.addEventListener(
        "touchstart",
        function (e) {
            if (e.touches.length === 1) {
                touchStartX = e.touches[0].clientX;
                touchStartOffset = offset;
            }
        },
        { passive: true },
    );
    viewport.addEventListener(
        "touchmove",
        function (e) {
            if (touchStartX !== null) {
                var dx = e.touches[0].clientX - touchStartX;
                setOffset(touchStartOffset + dx);
            }
        },
        { passive: true },
    );
    viewport.addEventListener("touchend", function () {
        touchStartX = null;
    });
}

/* ═══════════════════════════════════════════════════════════
   Game mode & reset
   ═══════════════════════════════════════════════════════════ */
var hgCurrentMode = "daily";

function hgLoadTarget(mode) {
    hgCurrentMode = mode;

    /* reset hint state */
    hgHintStage = 0;
    var panel = document.getElementById("hg-hint-panel");
    if (panel) {
        panel.style.display = "none";
        panel.innerHTML = "";
    }
    document.getElementById("hint-1").style.opacity = "";
    document.getElementById("hint-1").style.pointerEvents = "";
    document.getElementById("hint-2").style.opacity = "";
    document.getElementById("hint-2").style.pointerEvents = "";
    document.getElementById("hint-3").style.opacity = "";
    document.getElementById("hint-3").style.pointerEvents = "";

    /* reset guess state */
    var history = document.getElementById("hg-history");
    if (history) history.innerHTML = "";
    hgCloseModal();
    var disp = document.getElementById("hg-selected-display");
    if (disp) disp.innerHTML = "Select a country on the map";
    var submitBtn = document.getElementById("hg-submit-btn");
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove("ready");
    }

    /* reset year input */
    var yearInput = document.getElementById("hg-timeline-year");
    if (mode === "random") {
        if (yearInput) yearInput.value = "1964";
        if (window.hgScrollToYear) window.hgScrollToYear(1964);
    } else {
        if (yearInput) yearInput.value = "—";
    }

    /* reset country label */
    var countryLabel = document.getElementById("hg-selected-country");
    if (countryLabel) countryLabel.textContent = "";

    /* reset map state */
    selectedId = null;
    selectedName = null;
    countryGuessed = false;
    gameActive = true;
    hgGuessCount = 0;
    var counter = document.getElementById("hg-guess-counter");
    if (counter) counter.textContent = "";
    document.querySelectorAll("path").forEach(function (p) {
        p.classList.remove(
            "correct",
            "wrong",
            "guessed-wrong",
            "regional",
            "selected",
            "is-country-hover",
            "is-region-hover",
        );
    });
    if (panZoom) panZoom.reset();

    /* pick target */
    if (mode === "daily") {
        target = getDailyTarget();
    } else {
        target = database[Math.floor(Math.random() * database.length)];
    }

    /* update diagram */
    var img = document.getElementById("hg-diagram-img");
    if (img && target) img.src = target.img;

    /* update active button */
    document
        .getElementById("mode-daily")
        .classList.toggle("active", mode === "daily");
    document
        .getElementById("mode-random")
        .classList.toggle("active", mode === "random");
}

/* ═══════════════════════════════════════════════════════════
   Boot  –  overrides window.onload set by script.js
   ═══════════════════════════════════════════════════════════ */
window.onload = function () {
    /* 0 ── set today's date ── */
    var dateEl = document.querySelector(".date");
    if (dateEl) {
        var now = new Date();
        var months = [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
        ];
        dateEl.textContent =
            months[now.getMonth()] +
            " " +
            now.getDate() +
            ", " +
            now.getFullYear();
    }

    /* 1 ── inject SVG map ── */
    var ph = document.getElementById("hg-map-placeholder");
    if (ph) ph.innerHTML = WORLD_MAP_SVG;

    /* 2 ── svg-pan-zoom (wheel zoom disabled – pinch only) ── */
    panZoom = svgPanZoom("#world-map", {
        zoomEnabled: true,
        controlIconsEnabled: false,
        fit: true,
        center: true,
        minZoom: 0.5,
        maxZoom: 20,
        preventMouseEventsDefault: false,
        mouseWheelZoomEnabled: false,
        beforePan: function (oldPan, newPan) {
            var s = this.getSizes();
            var gw = s.width,
                gh = s.height;
            return {
                x: Math.max(
                    -((s.viewBox.x + s.viewBox.width) * s.realZoom) + gw / 2,
                    Math.min(s.width - gw / 2, newPan.x),
                ),
                y: Math.max(
                    -((s.viewBox.y + s.viewBox.height) * s.realZoom) + gh / 2,
                    Math.min(s.height - gh / 2, newPan.y),
                ),
            };
        },
    });

    /* 3 ── pinch-to-zoom only on map (normal scroll passes through) ── */
    var mapEl = document.querySelector(".hg-map-wrapper");
    if (mapEl) {
        mapEl.addEventListener(
            "wheel",
            function (e) {
                if (e.ctrlKey) {
                    /* pinch-to-zoom gesture on trackpad sends ctrlKey + wheel */
                    e.preventDefault();
                    if (e.deltaY < 0) panZoom.zoomIn();
                    else panZoom.zoomOut();
                }
                /* else: normal two-finger scroll → do nothing, page scrolls */
            },
            { passive: false },
        );
    }

    /* 4 ── map hover / click events (reuse from script.js) ── */
    setupMapEvents();

    /* 4 ── load daily target ── */
    hgLoadTarget("daily");

    /* 5 ── mode buttons ── */
    document
        .getElementById("mode-daily")
        .addEventListener("click", function () {
            hgLoadTarget("daily");
        });
    document
        .getElementById("mode-random")
        .addEventListener("click", function () {
            hgLoadTarget("random");
        });

    /* 6 ── hint buttons ── */
    document.getElementById("hint-1").addEventListener("click", function () {
        hgDoHint(1);
    });
    document.getElementById("hint-2").addEventListener("click", function () {
        hgDoHint(2);
    });
    document.getElementById("hint-3").addEventListener("click", function () {
        hgDoHint(3);
    });

    /* 7 ── submit button ── */
    document
        .getElementById("hg-submit-btn")
        .addEventListener("click", function () {
            hgMakeGuess();
        });

    /* 7a ── modal close ── */
    document
        .getElementById("hg-modal-close")
        .addEventListener("click", hgCloseModal);
    document
        .getElementById("hg-modal-overlay")
        .addEventListener("click", function (e) {
            if (e.target === this) hgCloseModal();
        });

    /* 7b ── year input: update submit readiness + sync slider ── */
    document
        .getElementById("hg-timeline-year")
        .addEventListener("input", function () {
            hgUpdateSubmitState();
            var y = parseInt(this.value);
            if (!isNaN(y) && window.hgScrollToYear) {
                window.hgScrollToYear(y);
            }
        });

    /* 6 ── zoom buttons ── */
    document
        .getElementById("hg-zoom-in")
        .addEventListener("click", function () {
            panZoom.zoomIn();
        });
    document
        .getElementById("hg-zoom-out")
        .addEventListener("click", function () {
            panZoom.zoomOut();
        });
    document
        .getElementById("hg-zoom-reset")
        .addEventListener("click", function () {
            panZoom.reset();
        });

    /* 7 ── year timeline ── */
    hgInitTimeline();
};
