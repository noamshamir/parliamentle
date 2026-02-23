var target = null;
var selectedId = null;
var selectedName = null;
var panZoom = null;
var gameActive = false;
var countryGuessed = false;

var hgHintStage = 0;
var hgGuessCount = 0;
var HG_MAX_GUESSES = 8;

var settingShowContinents = true;
var settingShowNeighbors = true;
var settingSnapToYears = false;
var eligibleYears = [];

function getDailyTarget() {
    var epoch = new Date("2024-01-01");
    var today = new Date();
    var diffTime = Math.abs(today - epoch);
    var diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    var index = diffDays % database.length;
    return database[index];
}

function getIsoFromPath(p) {
    var iso = "";
    if (p && p.dataset && p.dataset.iso) {
        iso = p.dataset.iso.trim();
    }
    if (iso) return iso.toUpperCase();

    var rawId = "";
    if (p && p.id) {
        rawId = p.id.trim();
    }
    if (!rawId) return null;
    return rawId.split("__")[0].toUpperCase();
}

function getRegionByCountryId(id) {
    var upperId = "";
    if (id) {
        upperId = id.toUpperCase();
    }
    var regions = Object.keys(regionMap);
    for (var i = 0; i < regions.length; i++) {
        var region = regions[i];
        var countries = regionMap[region];
        if (countries.indexOf(upperId) !== -1) {
            return region;
        }
    }
    return null;
}

function setupMapEvents() {
    var paths = document.querySelectorAll("path");
    for (var i = 0; i < paths.length; i++) {
        (function (p) {
            p.addEventListener("click", function () {
                handleCountrySelect(p);
            });

            p.addEventListener("mouseenter", function () {
                if (!gameActive || countryGuessed) return;

                var iso = getIsoFromPath(p);
                if (!iso) return;

                var samePaths = document.querySelectorAll(
                    'path[data-iso="' + iso + '"]',
                );
                for (var j = 0; j < samePaths.length; j++) {
                    samePaths[j].classList.add("is-country-hover");
                }

                var isGray =
                    !p.classList.contains("selected") &&
                    !p.classList.contains("regional") &&
                    !p.classList.contains("neighbor") &&
                    !p.classList.contains("wrong") &&
                    !p.classList.contains("correct");

                if (isGray && settingShowContinents) {
                    var region = getRegionByCountryId(iso);
                    if (region && regionMap[region]) {
                        var regionIds = regionMap[region];
                        for (var k = 0; k < regionIds.length; k++) {
                            var upperId = regionIds[k].toUpperCase();
                            var regionPaths = document.querySelectorAll(
                                'path[data-iso="' + upperId + '"]',
                            );
                            for (var m = 0; m < regionPaths.length; m++) {
                                regionPaths[m].classList.add("is-region-hover");
                            }
                        }
                    }
                }
            });

            p.addEventListener("mouseleave", function () {
                var hovered = document.querySelectorAll(".is-country-hover");
                for (var j = 0; j < hovered.length; j++) {
                    hovered[j].classList.remove("is-country-hover");
                }
                var regionHovered =
                    document.querySelectorAll(".is-region-hover");
                for (var j = 0; j < regionHovered.length; j++) {
                    regionHovered[j].classList.remove("is-region-hover");
                }
            });

            var startX, startY;
            p.addEventListener(
                "touchstart",
                function (e) {
                    if (e.touches.length > 1) return;
                    startX = e.touches[0].clientX;
                    startY = e.touches[0].clientY;
                },
                { passive: true },
            );
            p.addEventListener("touchend", function (e) {
                if (!startX || !startY) return;
                var endX = e.changedTouches[0].clientX;
                var endY = e.changedTouches[0].clientY;
                if (
                    Math.abs(endX - startX) < 10 &&
                    Math.abs(endY - startY) < 10
                ) {
                    e.preventDefault();
                    handleCountrySelect(p);
                }
                startX = null;
                startY = null;
            });
        })(paths[i]);
    }
}

function hgUpdateSubmitState() {
    var btn = document.getElementById("hg-submit-btn");
    if (!btn) return;
    var yearEl = document.getElementById("hg-timeline-year");
    var yearVal = NaN;
    if (yearEl) {
        yearVal = parseInt(yearEl.value);
    }
    var hasCountry = false;
    if (selectedId) {
        hasCountry = true;
    }
    var hasYear = false;
    if (!isNaN(yearVal) && yearVal > 0) {
        hasYear = true;
    }

    if (hasCountry && hasYear) {
        btn.classList.add("ready");
    } else {
        btn.classList.remove("ready");
    }
}

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

    if (selectedId) {
        var oldPaths = document.querySelectorAll(
            'path[data-iso="' + selectedId + '"]',
        );
        for (var i = 0; i < oldPaths.length; i++) {
            oldPaths[i].classList.remove("selected");
        }
    }

    selectedId = iso;
    selectedName = el.getAttribute("name") || iso;

    var countryLabel = document.getElementById("hg-selected-country");
    if (countryLabel) {
        countryLabel.textContent = selectedName;
    }

    var newPaths = document.querySelectorAll(
        'path[data-iso="' + selectedId + '"]',
    );
    for (var i = 0; i < newPaths.length; i++) {
        newPaths[i].classList.add("selected");
    }

    if (settingSnapToYears) {
        eligibleYears = [];
        for (var i = 0; i < database.length; i++) {
            var entry = database[i];
            var entryIds = [];
            if (entry.ids) {
                entryIds = entry.ids;
            } else {
                entryIds = [entry.id];
            }
            var match = false;
            for (var j = 0; j < entryIds.length; j++) {
                if (entryIds[j].toUpperCase() === selectedId.toUpperCase()) {
                    match = true;
                    break;
                }
            }
            if (match && entry.year) {
                var alreadyThere = false;
                for (var k = 0; k < eligibleYears.length; k++) {
                    if (eligibleYears[k] === entry.year) {
                        alreadyThere = true;
                        break;
                    }
                }
                if (!alreadyThere) {
                    eligibleYears.push(entry.year);
                }
            }
        }
        eligibleYears.sort(function (a, b) {
            return a - b;
        });

        var yearEl = document.getElementById("hg-timeline-year");
        var currentYear = parseInt(yearEl.value);
        if (isNaN(currentYear)) {
            currentYear = eligibleYears[Math.floor(eligibleYears.length / 2)];
        }
        var closest = eligibleYears[0];
        var closestDiff = Math.abs(currentYear - closest);
        for (var ci = 1; ci < eligibleYears.length; ci++) {
            var d = Math.abs(currentYear - eligibleYears[ci]);
            if (d < closestDiff) {
                closestDiff = d;
                closest = eligibleYears[ci];
            }
        }
        if (window.hgScrollToYear) {
            window.hgScrollToYear(closest);
        }
        yearEl.value = closest;
    } else {
        eligibleYears = [];
    }

    hgUpdateSubmitState();
}

function hgRedactCountry(text, country) {
    if (!country) return text;

    var words = [country];

    if (country.endsWith("land")) {
        words.push(country.replace(/land$/, "landic"));
        words.push(country.replace(/land$/, "lander"));
        words.push(country.replace(/land$/, "landish"));
    }
    if (country.endsWith("a")) {
        words.push(country.replace(/a$/, "an"));
    } else if (country.endsWith("e")) {
        words.push(country.replace(/e$/, "ian"));
    } else {
        words.push(country + "ian");
        words.push(country + "ese");
        words.push(country + "ish");
        words.push(country + "i");
    }

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

    if (specials[country]) {
        for (var i = 0; i < specials[country].length; i++) {
            words.push(specials[country][i]);
        }
    }

    var unique = [];
    for (var i = 0; i < words.length; i++) {
        var found = false;
        for (var j = 0; j < unique.length; j++) {
            if (unique[j] === words[i]) {
                found = true;
                break;
            }
        }
        if (!found) {
            unique.push(words[i]);
        }
    }
    words = unique;

    words.sort(function (a, b) {
        return b.length - a.length;
    });

    var escaped = [];
    for (var i = 0; i < words.length; i++) {
        escaped.push(words[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    }
    var pattern = new RegExp("(" + escaped.join("|") + ")", "gi");

    var output = text.replace(/\(([^)]+)\)/g, function (match, p1) {
        if (words.indexOf(p1) !== -1) {
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
        var tags = "";
        for (var i = 0; i < target.parties.length; i++) {
            var p = target.parties[i];
            var color = "#666";
            if (typeof p === "object" && p.color) {
                color = p.color;
            }
            var position = "Unknown";
            if (typeof p === "object" && p.position) {
                position = p.position;
            }
            tags = tags + '<span class="party-tag">';
            tags =
                tags +
                '<span class="party-dot" style="background:' +
                color +
                '"></span>';
            tags = tags + position;
            tags = tags + "</span>";
        }

        var wrapClass = "party-list";
        if (target.parties.length >= 7) {
            wrapClass = "party-list hg-wrap";
        }
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
        if (hgHintStage < 1) {
            hgDoHint(1);
        }

        var country = target.country || "";
        var tags = "";
        for (var i = 0; i < target.parties.length; i++) {
            var p = target.parties[i];
            var name = "";
            if (typeof p === "string") {
                name = p;
            } else {
                name = p.name;
            }
            var color = "";
            if (typeof p === "object" && p.color) {
                color = p.color;
            }
            var position = "";
            if (typeof p === "object" && p.position) {
                position = p.position;
            }
            var redactedName = hgRedactCountry(name, country);
            var dot = "";
            if (color) {
                dot =
                    '<span class="party-dot" style="background:' +
                    color +
                    '"></span>';
            }
            var posText = "";
            if (position) {
                posText =
                    '<span class="party-pos" style="color:#888">(' +
                    position +
                    ")</span>";
            }
            tags =
                tags +
                '<span class="party-tag">' +
                dot +
                redactedName +
                posText +
                "</span>";
        }

        var wrapClass = "party-list";
        if (target.parties.length >= 7) {
            wrapClass = "party-list hg-wrap";
        }
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
        if (hgHintStage < 2) {
            hgDoHint(2);
        }

        var tags = "";
        for (var i = 0; i < target.parties.length; i++) {
            var p = target.parties[i];
            var name = "";
            if (typeof p === "string") {
                name = p;
            } else {
                name = p.name;
            }
            var color = "";
            if (typeof p === "object" && p.color) {
                color = p.color;
            }
            var position = "";
            if (typeof p === "object" && p.position) {
                position = p.position;
            }
            var dot = "";
            if (color) {
                dot =
                    '<span class="party-dot" style="background:' +
                    color +
                    '"></span>';
            }
            var posText = "";
            if (position) {
                posText =
                    '<span class="party-pos" style="color:#888">(' +
                    position +
                    ")</span>";
            }
            tags =
                tags +
                '<span class="party-tag">' +
                dot +
                name +
                posText +
                "</span>";
        }

        var wrapClass = "party-list";
        if (target.parties.length >= 7) {
            wrapClass = "party-list hg-wrap";
        }
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

function hgMakeGuess() {
    if (!gameActive) return;
    if (hgGuessCount >= HG_MAX_GUESSES) return;

    var yearLabel = document.getElementById("hg-timeline-year");
    var disp = document.getElementById("hg-selected-display");
    var userYear = parseInt(yearLabel.value);

    if (!selectedId) {
        if (disp) {
            disp.innerHTML =
                '<span style="color:#c0392b">\u26A0 Select a country on the map</span>';
        }
        return;
    }
    if (!userYear || isNaN(userYear)) {
        if (disp) {
            disp.innerHTML =
                '<span style="color:#c0392b">\u26A0 Scroll the timeline to pick a year</span>';
        }
        return;
    }

    var rawIds = [];
    if (target.ids) {
        rawIds = target.ids;
    } else {
        rawIds = [target.id];
    }
    var correctIds = [];
    for (var i = 0; i < rawIds.length; i++) {
        correctIds.push(rawIds[i].toUpperCase());
    }
    var currentSelectedUpper = selectedId.toUpperCase();

    var isCountryCorrect = correctIds.indexOf(currentSelectedUpper) !== -1;
    var userRegion = getRegionByCountryId(selectedId);
    var targetRegion = getRegionByCountryId(correctIds[0]);
    var isRegionCorrect = false;
    if (settingShowContinents && userRegion && targetRegion) {
        isRegionCorrect = userRegion === targetRegion;
    }
    var isNeighborCorrect = false;
    if (settingShowNeighbors && !isCountryCorrect) {
        var targetNeighbors = neighborMap[correctIds[0]] || [];
        for (var n = 0; n < targetNeighbors.length; n++) {
            if (targetNeighbors[n].toUpperCase() === currentSelectedUpper) {
                isNeighborCorrect = true;
                break;
            }
        }
    }
    var yearDiff = Math.abs(userYear - target.year);

    var isYearClose = false;
    if (yearDiff !== 0 && yearDiff <= 5) {
        isYearClose = true;
    }

    var selectedPaths = document.querySelectorAll(
        'path[data-iso="' + selectedId + '"]',
    );
    for (var i = 0; i < selectedPaths.length; i++) {
        selectedPaths[i].classList.remove("selected");
    }

    var countryLabel = document.getElementById("hg-selected-country");
    if (countryLabel) {
        countryLabel.textContent = "";
    }

    if (isCountryCorrect) {
        countryGuessed = true;
        for (var i = 0; i < correctIds.length; i++) {
            var paths = document.querySelectorAll(
                'path[data-iso="' + correctIds[i] + '"]',
            );
            for (var j = 0; j < paths.length; j++) {
                paths[j].classList.remove("wrong", "regional", "neighbor");
                paths[j].classList.add("correct");
            }
        }
        selectedName = target.country;
    } else {
        if (isRegionCorrect) {
            var regionCountries = regionMap[targetRegion];
            if (regionCountries) {
                for (var i = 0; i < regionCountries.length; i++) {
                    var uid = regionCountries[i].toUpperCase();
                    var rPaths = document.querySelectorAll(
                        'path[data-iso="' + uid + '"]',
                    );
                    for (var j = 0; j < rPaths.length; j++) {
                        if (
                            !rPaths[j].classList.contains("correct") &&
                            !rPaths[j].classList.contains("neighbor")
                        ) {
                            rPaths[j].classList.add("regional");
                        }
                    }
                }
            }
        }
        if (isNeighborCorrect) {
            var neighborPaths = document.querySelectorAll(
                'path[data-iso="' + currentSelectedUpper + '"]',
            );
            for (var i = 0; i < neighborPaths.length; i++) {
                neighborPaths[i].classList.remove("regional");
                neighborPaths[i].classList.add("neighbor");
            }
        }
    }

    hgGuessCount++;

    var cTileClass = "";
    if (isCountryCorrect) {
        cTileClass = "hg-tile hg-tile-correct";
    } else if (isNeighborCorrect) {
        cTileClass = "hg-tile hg-tile-neighbor";
    } else if (isRegionCorrect) {
        cTileClass = "hg-tile hg-tile-regional";
    } else {
        cTileClass = "hg-tile hg-tile-wrong";
    }
    var cTileText =
        '<img class="hg-tile-pin" src="assets/images/pin.png" alt="" />';

    var yTileClass = "hg-tile-year";
    if (yearDiff === 0) {
        yTileClass = "hg-tile-year exact";
    } else if (isYearClose) {
        yTileClass = "hg-tile-year close";
    }

    var yTileText = "";
    if (yearDiff === 0) {
        yTileText = String(userYear);
    } else {
        if (userYear < target.year) {
            yTileText = userYear + " \u2191";
        } else {
            yTileText = userYear + " \u2193";
        }
    }

    var history = document.getElementById("hg-history");
    var row = document.createElement("div");
    row.className = "hg-history-row";

    var tilesHtml = "";
    if (settingShowContinents || settingShowNeighbors) {
        tilesHtml = '<span class="' + cTileClass + '">' + cTileText + "</span>";
    }
    tilesHtml += '<span class="' + yTileClass + '">' + yTileText + "</span>";

    row.innerHTML =
        '<span class="hg-history-country">' +
        selectedName +
        "</span>" +
        '<span class="hg-history-tiles">' +
        tilesHtml +
        "</span>";
    history.prepend(row);

    var counter = document.getElementById("hg-guess-counter");
    if (counter) {
        counter.textContent = hgGuessCount + " / " + HG_MAX_GUESSES;
    }

    if (isCountryCorrect && yearDiff === 0) {
        gameActive = false;
        if (disp) {
            disp.innerHTML = "";
        }
        document.getElementById("hg-submit-btn").disabled = true;
        hgShowModal(true);
    } else if (hgGuessCount >= HG_MAX_GUESSES) {
        gameActive = false;
        if (disp) {
            disp.innerHTML = "";
        }
        document.getElementById("hg-submit-btn").disabled = true;
        hgShowModal(false);
    } else if (isCountryCorrect) {
        if (disp) {
            disp.innerHTML =
                '<span style="color:#538d4e">\u2713 Country correct \u2014 adjust the year</span>';
        }
    } else {
        selectedId = null;
        if (disp) {
            disp.innerHTML = "Select a country on the map";
        }
    }
}

function hgShowModal(won) {
    var overlay = document.getElementById("hg-modal-overlay");
    var titleEl = document.getElementById("hg-modal-title");
    var answerEl = document.getElementById("hg-modal-answer");
    var guessesEl = document.getElementById("hg-modal-guesses");

    if (won) {
        titleEl.textContent = "Correct!";
    } else {
        titleEl.textContent = "Game Over";
    }

    if (won) {
        titleEl.className = "hg-modal-title hg-modal-win";
    } else {
        titleEl.className = "hg-modal-title hg-modal-lose";
    }

    answerEl.textContent = target.country + ", " + target.year;

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

function hgInitTimeline() {
    var yearSet = {};
    for (var i = 0; i < database.length; i++) {
        if (database[i].year) {
            yearSet[database[i].year] = true;
        }
    }
    var years = [];
    var keys = Object.keys(yearSet);
    for (var i = 0; i < keys.length; i++) {
        years.push(parseInt(keys[i]));
    }
    years.sort(function (a, b) {
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

    var majorInterval = 25;
    var firstMajor = Math.ceil(minYear / majorInterval) * majorInterval;
    for (var y = firstMajor; y <= maxYear; y = y + majorInterval) {
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

    var firstMinor = Math.ceil(minYear / 5) * 5;
    for (var y = firstMinor; y <= maxYear; y = y + 5) {
        if (y % majorInterval === 0) continue;
        var xPos = (y - minYear) * pxPerYear;
        var tick = document.createElement("div");
        tick.className = "hg-timeline-tick";
        tick.style.left = xPos + "px";
        track.appendChild(tick);
    }

    var offset = 0;
    var rawOffset = 0;

    function setOffset(newOffset) {
        var vw = viewport.clientWidth;
        var minOff = vw / 2 - totalWidth;
        var maxOff = vw / 2;
        if (newOffset < minOff) {
            rawOffset = minOff;
        } else if (newOffset > maxOff) {
            rawOffset = maxOff;
        } else {
            rawOffset = newOffset;
        }

        var centreYear = Math.round(minYear + (vw / 2 - rawOffset) / pxPerYear);
        if (centreYear < minYear) {
            centreYear = minYear;
        }
        if (centreYear > maxYear) {
            centreYear = maxYear;
        }

        var displayOffset = rawOffset;

        if (settingSnapToYears && eligibleYears.length > 0) {
            var closest = eligibleYears[0];
            var closestDiff = Math.abs(centreYear - closest);
            for (var si = 1; si < eligibleYears.length; si++) {
                var d = Math.abs(centreYear - eligibleYears[si]);
                if (d < closestDiff) {
                    closestDiff = d;
                    closest = eligibleYears[si];
                }
            }
            centreYear = closest;
            displayOffset = vw / 2 - (centreYear - minYear) * pxPerYear;
        }

        offset = rawOffset;
        track.style.transform = "translateX(" + displayOffset + "px)";
        label.value = centreYear;
        hgUpdateSubmitState();
    }

    function setOffsetSilent(newOffset) {
        var vw = viewport.clientWidth;
        var minOff = vw / 2 - totalWidth;
        var maxOff = vw / 2;
        if (newOffset < minOff) {
            offset = minOff;
        } else if (newOffset > maxOff) {
            offset = maxOff;
        } else {
            offset = newOffset;
        }
        track.style.transform = "translateX(" + offset + "px)";
    }

    window.hgScrollToYear = function (year) {
        if (year >= minYear && year <= maxYear) {
            var vw = viewport.clientWidth;
            var newOff = vw / 2 - (year - minYear) * pxPerYear;
            setOffsetSilent(newOff);
            offset = newOff;
            rawOffset = newOff;
        }
    };

    var midYear = Math.round((minYear + maxYear) / 2);
    setOffset(viewport.clientWidth / 2 - (midYear - minYear) * pxPerYear);

    viewport.addEventListener(
        "wheel",
        function (e) {
            e.preventDefault();
            var delta = e.deltaY;
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                delta = e.deltaX;
            }
            setOffset(offset - delta);
        },
        { passive: false },
    );

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

var hgCurrentMode = "daily";

function hgLoadTarget(mode) {
    hgCurrentMode = mode;

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

    var history = document.getElementById("hg-history");
    if (history) {
        history.innerHTML = "";
    }
    hgCloseModal();
    var disp = document.getElementById("hg-selected-display");
    if (disp) {
        disp.innerHTML = "Select a country on the map";
    }
    var submitBtn = document.getElementById("hg-submit-btn");
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove("ready");
    }

    var yearInput = document.getElementById("hg-timeline-year");
    if (mode === "random") {
        if (yearInput) {
            yearInput.value = "1964";
        }
        if (window.hgScrollToYear) {
            window.hgScrollToYear(1964);
        }
    } else {
        if (yearInput) {
            yearInput.value = "\u2014";
        }
    }

    var countryLabel = document.getElementById("hg-selected-country");
    if (countryLabel) {
        countryLabel.textContent = "";
    }

    selectedId = null;
    selectedName = null;
    countryGuessed = false;
    gameActive = true;
    hgGuessCount = 0;
    var counter = document.getElementById("hg-guess-counter");
    if (counter) {
        counter.textContent = "";
    }
    var allPaths = document.querySelectorAll("path");
    for (var i = 0; i < allPaths.length; i++) {
        allPaths[i].classList.remove(
            "correct",
            "wrong",
            "guessed-wrong",
            "regional",
            "selected",
            "is-country-hover",
            "is-region-hover",
        );
    }
    if (panZoom) {
        panZoom.reset();
    }

    if (mode === "daily") {
        target = getDailyTarget();
    } else {
        target = database[Math.floor(Math.random() * database.length)];
    }

    var img = document.getElementById("hg-diagram-img");
    if (img && target) {
        img.src = target.img;
    }

    if (mode === "daily") {
        document.getElementById("mode-daily").classList.add("active");
        document.getElementById("mode-random").classList.remove("active");
    } else {
        document.getElementById("mode-daily").classList.remove("active");
        document.getElementById("mode-random").classList.add("active");
    }
}

window.onload = function () {
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

    var ph = document.getElementById("hg-map-placeholder");
    if (ph) {
        ph.innerHTML = WORLD_MAP_SVG;
    }

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
            var gw = s.width;
            var gh = s.height;
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

    var mapEl = document.querySelector(".hg-map-wrapper");
    if (mapEl) {
        mapEl.addEventListener(
            "wheel",
            function (e) {
                if (e.ctrlKey) {
                    e.preventDefault();
                    if (e.deltaY < 0) {
                        panZoom.zoomIn();
                    } else {
                        panZoom.zoomOut();
                    }
                }
            },
            { passive: false },
        );
    }

    setupMapEvents();

    hgLoadTarget("daily");

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

    document.getElementById("hint-1").addEventListener("click", function () {
        hgDoHint(1);
    });
    document.getElementById("hint-2").addEventListener("click", function () {
        hgDoHint(2);
    });
    document.getElementById("hint-3").addEventListener("click", function () {
        hgDoHint(3);
    });

    document
        .getElementById("hg-submit-btn")
        .addEventListener("click", function () {
            hgMakeGuess();
        });

    document
        .getElementById("hg-modal-close")
        .addEventListener("click", hgCloseModal);
    document
        .getElementById("hg-modal-overlay")
        .addEventListener("click", function (e) {
            if (e.target === this) {
                hgCloseModal();
            }
        });

    document
        .getElementById("hg-timeline-year")
        .addEventListener("input", function () {
            hgUpdateSubmitState();
            var y = parseInt(this.value);
            if (!isNaN(y) && window.hgScrollToYear) {
                window.hgScrollToYear(y);
            }
        });

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

    var settingsBtn = document.getElementById("settings-btn");
    var settingsOverlay = document.getElementById("settings-overlay");
    var settingsClose = document.getElementById("settings-close");
    if (settingsBtn && settingsOverlay) {
        settingsBtn.addEventListener("click", function () {
            settingsOverlay.classList.add("visible");
        });
        if (settingsClose) {
            settingsClose.addEventListener("click", function () {
                settingsOverlay.classList.remove("visible");
            });
        }
        settingsOverlay.addEventListener("click", function (e) {
            if (e.target === settingsOverlay) {
                settingsOverlay.classList.remove("visible");
            }
        });
    }

    var toggleContinents = document.getElementById("toggle-continents");
    if (toggleContinents) {
        toggleContinents.addEventListener("change", function () {
            settingShowContinents = this.checked;
        });
    }

    var toggleNeighbors = document.getElementById("toggle-neighbors");
    if (toggleNeighbors) {
        toggleNeighbors.addEventListener("change", function () {
            settingShowNeighbors = this.checked;
        });
    }

    var toggleSnap = document.getElementById("toggle-snap");
    if (toggleSnap) {
        toggleSnap.addEventListener("change", function () {
            settingSnapToYears = this.checked;
            eligibleYears = [];
            if (settingSnapToYears && selectedId) {
                for (var i = 0; i < database.length; i++) {
                    var entry = database[i];
                    var entryIds = [];
                    if (entry.ids) {
                        entryIds = entry.ids;
                    } else {
                        entryIds = [entry.id];
                    }
                    var match = false;
                    for (var j = 0; j < entryIds.length; j++) {
                        if (
                            entryIds[j].toUpperCase() ===
                            selectedId.toUpperCase()
                        ) {
                            match = true;
                            break;
                        }
                    }
                    if (match && entry.year) {
                        var alreadyThere = false;
                        for (var k = 0; k < eligibleYears.length; k++) {
                            if (eligibleYears[k] === entry.year) {
                                alreadyThere = true;
                                break;
                            }
                        }
                        if (!alreadyThere) {
                            eligibleYears.push(entry.year);
                        }
                    }
                }
                eligibleYears.sort(function (a, b) {
                    return a - b;
                });
            }
        });
    }

    hgInitTimeline();

    // ── Admin picker (Cmd+Shift+A) ──
    var adminOverlay = document.getElementById("admin-overlay");
    var adminSearch = document.getElementById("admin-search");
    var adminResults = document.getElementById("admin-results");
    var adminClose = document.getElementById("admin-close");

    function adminOpen() {
        adminOverlay.classList.add("visible");
        adminSearch.value = "";
        adminRender("");
        setTimeout(function () {
            adminSearch.focus();
        }, 50);
    }

    function adminCloseModal() {
        adminOverlay.classList.remove("visible");
        adminSearch.value = "";
        adminResults.innerHTML = "";
    }

    function adminRender(query) {
        var q = query.toLowerCase().trim();
        var matches = [];
        for (var i = 0; i < database.length; i++) {
            var entry = database[i];
            var label = entry.country + " " + entry.year;
            if (q === "" || label.toLowerCase().indexOf(q) !== -1) {
                matches.push({ entry: entry, index: i, label: label });
            }
            if (matches.length >= 80) break;
        }

        if (matches.length === 0) {
            adminResults.innerHTML =
                '<div class="admin-results-empty">No matches</div>';
            return;
        }

        var html = "";
        for (var j = 0; j < matches.length; j++) {
            var m = matches[j];
            var pCount = m.entry.parties ? m.entry.parties.length : 0;
            html +=
                '<div class="admin-result-row" data-admin-idx="' +
                m.index +
                '">' +
                '<span class="admin-result-country">' +
                m.entry.country +
                "</span>" +
                "<span>" +
                '<span class="admin-result-year">' +
                m.entry.year +
                "</span>" +
                '<span class="admin-result-parties">' +
                pCount +
                (pCount === 1 ? " party" : " parties") +
                "</span>" +
                "</span>" +
                "</div>";
        }
        adminResults.innerHTML = html;
    }

    function adminPick(idx) {
        var entry = database[idx];
        if (!entry) return;
        adminCloseModal();

        // Reset game state like hgLoadTarget but with a specific entry
        hgCurrentMode = "admin";
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
        var yearInput = document.getElementById("hg-timeline-year");
        if (yearInput) yearInput.value = "\u2014";
        var countryLabel = document.getElementById("hg-selected-country");
        if (countryLabel) countryLabel.textContent = "";

        selectedId = null;
        selectedName = null;
        countryGuessed = false;
        gameActive = true;
        hgGuessCount = 0;
        var counter = document.getElementById("hg-guess-counter");
        if (counter) counter.textContent = "";
        var allPaths = document.querySelectorAll("path");
        for (var p = 0; p < allPaths.length; p++) {
            allPaths[p].classList.remove(
                "correct",
                "wrong",
                "guessed-wrong",
                "regional",
                "selected",
                "is-country-hover",
                "is-region-hover",
            );
        }
        if (panZoom) panZoom.reset();

        target = entry;
        var img = document.getElementById("hg-diagram-img");
        if (img && target) img.src = target.img;

        document.getElementById("mode-daily").classList.remove("active");
        document.getElementById("mode-random").classList.remove("active");
    }

    adminSearch.addEventListener("input", function () {
        adminRender(this.value);
    });

    adminResults.addEventListener("click", function (e) {
        var row = e.target.closest(".admin-result-row");
        if (row) {
            var idx = parseInt(row.getAttribute("data-admin-idx"), 10);
            adminPick(idx);
        }
    });

    adminClose.addEventListener("click", adminCloseModal);
    adminOverlay.addEventListener("click", function (e) {
        if (e.target === adminOverlay) adminCloseModal();
    });

    document.addEventListener("keydown", function (e) {
        if (
            (e.metaKey || e.ctrlKey) &&
            e.shiftKey &&
            e.key.toLowerCase() === "a"
        ) {
            e.preventDefault();
            if (adminOverlay.classList.contains("visible")) {
                adminCloseModal();
            } else {
                adminOpen();
            }
        }
        if (e.key === "Escape" && adminOverlay.classList.contains("visible")) {
            adminCloseModal();
        }
    });
};
