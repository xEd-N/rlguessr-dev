let players = [];
let teams = [];
let lans = [];
let teamsById = new Map();
let remainingPlayers = [];
let currentPlayer;
let selectedMode = null;
let timer = 0;
let timerInterval = null;
let correctCount = 0;
let totalCount = 0;
let roundResolved = false;
const preloadedImages = [];

// Pool et libellé de la session en cours — d'ordinaire tout le roster et le
// nom du mode MODES, mais un mode de test comme "Career Era" (voir plus bas)
// restreint le pool et porte son propre nom, hors de la table MODES. Permet
// à #playerIndex, restartMode() et showEndScreen() de rester corrects sans
// connaître le détail de chaque mode de test.
let currentPool = [];
let sessionPlayerCount = 0;
let currentDisplayName = "";

// Optionnel : fonction qui retire un nouveau pool à chaque "Play Again"
// plutôt que de rejouer exactement le même. Career Era/Regional Scene
// laissent ceci à null (leur pool EST la liste complète des éligibles,
// la rejouer telle quelle a du sens) ; Quick Ten (plus bas) le renseigne
// pour tirer 10 nouveaux joueurs aléatoires à chaque partie.
let currentResample = null;

// ========================
// Mode de test : Earnings Rank (voir "Modes de test" dans CLAUDE.md)
// ========================
let earningsCount = 5;       // 5 ou 10, choisi via le toggle de la carte
let rankPlayers = [];        // les joueurs du round, dans l'ordre d'affichage (mélangé)
let rankPicks = [];          // joueurs, dans l'ordre où le joueur les a tapotés
let rankResolved = false;
let rankRoundsPlayed = 0;
let rankRoundsWon = 0;       // rounds où l'ordre complet était correct

// ========================
// Mode de test : Career Era (voir "Modes de test" dans CLAUDE.md)
// ========================
let eraPeriod = "before";    // "before" ou "after", choisi via le toggle de la carte

// Fin de RLCS Season X (20 juin 2021). La saison suivante ("RLCS 2021-22")
// ne démarre que le 16 novembre 2021 — un trou de 5 mois sans aucun palmarès
// S-Tier dans le roster actuel. N'importe quelle date dans cet intervalle
// donne donc exactement le même découpage des joueurs ; celle-ci n'a pas
// besoin d'être ajustée si de nouveaux joueurs rejoignent le roster.
const ERA_CUTOFF = "2021-07-01";
const ERA_LABELS = { before: "Before Season X", after: "After Season X" };

// ========================
// Mode de test : Regional Scene (voir "Modes de test" dans CLAUDE.md)
// ========================
// `region` (players.json) est l'affiliation compétitive ACTUELLE du joueur,
// pas sa nationalité ni un historique — normalisée à la génération depuis
// `player.region` (API v3) par tools/regions.py. Ce choix (valeur unique,
// pas d'historique par équipe) est documenté dans CLAUDE.md.
let regionFilter = "Europe";  // choisi via le <select> de la carte

// ========================
// Mode de test : LAN Roster (voir "Modes de test" dans CLAUDE.md)
// ========================
// `player.lans` est calculé à la génération (tools/build_data.py,
// fetch_lans()) : liste des LAN (`type: "Offline"` sur l'API v3, tier S)
// où le joueur a un palmarès compté, 3v3 comme 1v1/2v2 — un Major 3v3 et
// son volet 1v1/2v2 partagent la même entrée `lans.json`, ce sont deux
// pages Liquipedia pour le même évènement physique.
let lanFilter = null;  // id de la LAN choisie, défini une fois lans.json chargé

// Les données viennent de l'API Liquipedia (voir tools/build_data.py) : chaque
// joueur porte déjà son `countryName`. Ces deux replis ne servent qu'aux codes
// non résolus — plus aucune table de pays n'est maintenue à la main ici.
const SUBDIVISION_NAMES = {
    "gb-eng": "England",
    "gb-sct": "Scotland",
    "gb-wls": "Wales",
    "gb-nir": "Northern Ireland"
};

// Intl.DisplayNames couvre tout l'ISO 3166-1 sans table locale.
const regionNames = typeof Intl !== "undefined" && Intl.DisplayNames
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

// ========================
// Table des modes : centralise le nom affiché et les indices disponibles
// ========================
const MODES = {
    classic: { name: "Classic", flag: true, achievements: true, teamLimit: 0, timed: false },
    medium:  { name: "Medium",  flag: true, achievements: false, teamLimit: 0, timed: false },
    hard:    { name: "Hard",    flag: false, achievements: true, teamLimit: 0, timed: false },
    extreme: { name: "Extreme", flag: true, achievements: false, teamLimit: 2, timed: false },
    timer:   { name: "Timer",   flag: true, achievements: true, teamLimit: 0, timed: true }
};

function modeConfig() {
    return MODES[selectedMode] || MODES.classic;
}

function countryName(code) {
    if (!code) return "";

    const key = code.toLowerCase();

    if (SUBDIVISION_NAMES[key]) return SUBDIVISION_NAMES[key];

    // Intl ne connaît que les codes pays à deux lettres, pas les subdivisions
    if (regionNames && key.length === 2) {
        try {
            const name = regionNames.of(key.toUpperCase());
            if (name && name.toLowerCase() !== key) return name;
        } catch (e) {
            // code invalide : on retombe sur le code en majuscules
        }
    }

    return code.toUpperCase();
}

function plural(count, word) {
    return `${count} ${word}${count === 1 ? "" : "s"}`;
}

// ========================
// Cache DOM (le script est chargé en fin de <body>, les éléments existent déjà)
// ========================
const elHub = document.getElementById("hub");
const elGame = document.getElementById("game");
const elHubStatus = document.getElementById("hubStatus");

// GIF 1×1 transparent, utilisé pour vider #playerPhoto sans que Chrome
// affiche son icône « image cassée » pendant la transition entre deux manches.
// Un src="" ou une simple removeAttribute rend cette icône ~0,4 s : elle
// se voyait au premier plan pendant que le masque revenait par-dessus.
const BLANK_PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const elHudModeName = document.getElementById("hudModeName");
const elHudTime = document.getElementById("hudTime");
const elTimerDisplay = document.getElementById("timerDisplay");
const elScoreDisplay = document.getElementById("scoreDisplay");
const elPlayerIndex = document.getElementById("playerIndex");

const elPhotoSlot = document.getElementById("photoSlot");
const elPhotoSil = document.getElementById("photoSil");
const elPlayerPhoto = document.getElementById("playerPhoto");

const elInfoNationality = document.getElementById("infoNationality");
const elInfoFlag = document.getElementById("infoFlag");
const elInfoCountryName = document.getElementById("infoCountryName");
const elFlagMasked = document.getElementById("flagMasked");

const elChipTeams = document.getElementById("chipTeams");
const elChipAchievements = document.getElementById("chipAchievements");

const elInfoAchievements = document.getElementById("infoAchievements");
const elAchLocked = document.getElementById("achLocked");

const elTeams = document.getElementById("teams");
const elTeamsCapNote = document.getElementById("teamsCapNote");

const elHudMode = document.getElementById("hudMode");
const elModeMenu = document.getElementById("modeMenu");

// Mode de test "Earnings Rank" — écran séparé, en dehors de la table MODES
// (voir "Modes de test" dans CLAUDE.md). Il a son propre bouton/menu de HUD
// (même patron que hudMode/modeMenu ci-dessus) pour pouvoir en repartir sans
// retourner au hub — voir "Dropdown de changement de mode" plus bas.
const elHudModeRank = document.getElementById("hudModeRank");
const elModeMenuRank = document.getElementById("modeMenuRank");
const elRankGame = document.getElementById("rankGame");
const elRankGrid = document.getElementById("rankGrid");
const elRankRoundIndex = document.getElementById("rankRoundIndex");
const elRankScoreDisplay = document.getElementById("rankScoreDisplay");
const elRankResetBtn = document.getElementById("rankResetBtn");
const elRankNextBtn = document.getElementById("rankNextBtn");

const elLanSelect = document.getElementById("lanSelect");

const elNameReveal = document.getElementById("nameReveal");
const elNameRevealBadge = document.getElementById("nameRevealBadge");
const elNameRevealName = document.getElementById("nameRevealName");

const elInput = document.getElementById("guessInput");
const elValidateBtn = document.getElementById("validateBtn");
const elSkipBtn = document.getElementById("skipBtn");
const elNextBtn = document.getElementById("nextBtn");
const elClueList = document.getElementById("clueList");

const elEndScreen = document.getElementById("endScreen");
const elEndTitle = document.getElementById("endTitle");
const elEndLede = document.getElementById("endLede");
const elFinalScore = document.getElementById("finalScore");
const elFinalTimeContainer = document.getElementById("finalTimeContainer");
const elFinalTime = document.getElementById("finalTime");

// ========================
// Chargement des données
// ========================
function setHubStatus(html, isError) {
    if (!html) {
        elHubStatus.hidden = true;
        elHubStatus.innerHTML = "";
        return;
    }

    elHubStatus.innerHTML = html;
    elHubStatus.classList.toggle("error", !!isError);
    elHubStatus.hidden = false;
}

setHubStatus("Loading players…", false);

Promise.all([
    fetch("players.json").then(r => r.json()),
    fetch("teams.json").then(r => r.json()),
    fetch("lans.json").then(r => r.json())
]).then(data => {
    players = data[0];
    teams = data[1];
    lans = data[2];
    teamsById = new Map(teams.map(t => [t.id, t]));
    remainingPlayers = [...players];

    populateLanSelect();

    setHubStatus(null);
}).catch(() => {
    // Cas le plus courant : la page est ouverte en file://, où les navigateurs
    // refusent de fetcher les JSON. Sans message, les boutons de mode
    // sembleraient simplement morts.
    setHubStatus(
        "Could not load the player data. Serve this folder over HTTP instead of " +
        "opening <code>index.html</code> directly — browsers block " +
        "<code>file://</code> data requests. For example: <code>npx serve .</code>",
        true
    );
});

function normalize(str) {
    return str
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, ""); // strip diacritics
}

function preloadImage(url) {
    // Les images viennent du CDN Liquipedia et peuvent manquer sur une fiche
    if (!url) return;

    const img = new Image();
    img.src = url;
    preloadedImages.push(img); // keep a reference: otherwise some browsers cancel the load
}

// ========================
// Mode selection (HUB -> GAME, ou changement de mode en cours de partie)
// ========================

// Vrai si un écran de jeu (classique ou un mode de test) est actuellement affiché —
// sert à décider si un changement de mode doit passer par le fondu du hub ou
// basculer instantanément (voir startMode()/startEarningsMode()).
function isInGame() {
    return elGame.classList.contains("active") || elRankGame.classList.contains("active");
}

// Sans données, on le dit au lieu de laisser un bouton de mode sans effet —
// garde-fou partagé par startMode() et par chaque mode de test.
function requirePlayers() {
    if (players.length) return true;

    setHubStatus(
        elHubStatus.classList.contains("error")
            ? elHubStatus.innerHTML
            : "Still loading the player data — try again in a second.",
        elHubStatus.classList.contains("error")
    );
    return false;
}

// Bascule vers `targetEl` (#game ou #rankGame) : instantanément si un écran de
// jeu est déjà affiché (le dropdown du HUD change de mode sans repasser par le
// hub), ou via le fondu de sortie du hub sinon. `setup` porte toute la logique
// propre au mode (setupGame(), ou l'équivalent pour Earnings Rank) — partagée
// par startMode() et les six modes de test/spéciaux.
function enterGameScreen(targetEl, setup) {

    closeModeMenu();
    closeRankModeMenu();

    if (isInGame()) {
        elGame.classList.toggle("active", targetEl === elGame);
        elRankGame.classList.toggle("active", targetEl === elRankGame);
        setup();
        return;
    }

    elHub.classList.add("leaving");

    setTimeout(() => {

        elHub.classList.add("hidden");
        elHub.classList.remove("leaving");
        targetEl.classList.add("active");

        setup();

    }, 300);
}

function startMode(mode) {
    if (!requirePlayers()) return;
    enterGameScreen(elGame, () => setupGame(mode));
}

// Prépare une partie fraîche pour un mode donné. Appelé depuis le hub via
// startMode() et depuis le dropdown du HUD pour changer de mode à la volée.
// `options.pool` restreint le roster (mode de test "Career Era") et
// `options.displayName` remplace le nom lu dans MODES pour un mode qui n'y
// figure pas — sans ça le HUD/l'écran de fin afficheraient "Classic" (repli
// de modeConfig()) au lieu du nom du mode de test réellement joué.
// `options.resample`, voir le commentaire sur `currentResample` plus haut.
function setupGame(mode, options) {

    options = options || {};

    selectedMode = mode;
    const cfg = modeConfig();

    currentResample = options.resample || null;
    currentPool = options.pool ? [...options.pool] : [...players];
    remainingPlayers = [...currentPool];
    sessionPlayerCount = currentPool.length;
    currentDisplayName = options.displayName || cfg.name;

    // ===== HUD =====
    elHudModeName.textContent = currentDisplayName;

    correctCount = 0;
    totalCount = 0;
    updateScore();

    stopTimer();

    if (cfg.timed) {
        elHudTime.style.display = "flex";
        timer = 0;
        updateTimerDisplay();
        startTimer();
    } else {
        elHudTime.style.display = "none";
    }

    renderClueList();
    startGame();
}

// ========================
// Start a round
// ========================
function startGame() {

    const cfg = modeConfig();

    resetPhotoSlot();
    resetInfoCard();

    elTeams.innerHTML = "";
    elInput.value = "";
    elInput.disabled = false;
    elInput.classList.remove("correct", "wrong");

    elValidateBtn.disabled = false;
    elSkipBtn.disabled = false;
    elNextBtn.classList.remove("show");

    roundResolved = false;

    if (remainingPlayers.length === 0) {

        stopTimer();

        showEndScreen();

        return;
    }

    const randomIndex = Math.floor(Math.random() * remainingPlayers.length);
    currentPlayer = remainingPlayers.splice(randomIndex, 1)[0];

    elPlayerIndex.textContent = `#${sessionPlayerCount - remainingPlayers.length} / ${sessionPlayerCount}`;

    preloadImage(currentPlayer.img);

    // Preload a future random player
    if (remainingPlayers.length > 0) {

        const nextRandom =
            remainingPlayers[
                Math.floor(Math.random() * remainingPlayers.length)
            ];

        // Player photo
        preloadImage(nextRandom.img);

        // Team logos of that player
        nextRandom.teams.forEach(teamId => {

            const team = teamsById.get(teamId);

            if (team && team.logo) {
                preloadImage(team.logo);
            }

        });
    }

    fillInfoCard(currentPlayer);

    // TEAMS
    let teamsToShow = [...currentPlayer.teams];

    // EXTREME MODE -> max 2 teams
    if (cfg.teamLimit && teamsToShow.length > cfg.teamLimit) {

        // Keep chronological order but pick random sorted indices
        let indexes = [];

        while (indexes.length < cfg.teamLimit) {
            let rand = Math.floor(Math.random() * teamsToShow.length);
            if (!indexes.includes(rand)) indexes.push(rand);
        }

        // Sort to preserve chronological order
        indexes.sort((a, b) => a - b);

        teamsToShow = indexes.map(i => teamsToShow[i]);
    }

    elTeamsCapNote.hidden = !cfg.teamLimit;
    elChipTeams.textContent = plural(teamsToShow.length, "team");

    // Display — les tuiles portent un numéro ordinal chronologique (1 = plus
    // ancienne équipe, N = plus récente). Cf. le hint « oldest first » sous
    // la section. En mode extreme, la numérotation part de 1 pour les tuiles
    // affichées et non pour la position réelle dans le palmarès.
    teamsToShow.forEach((teamId, index) => {

        const team = teamsById.get(teamId);
        if (!team) return;

        const tile = document.createElement("button");
        tile.type = "button";
        tile.className = "team-tile";
        tile.title = team.name;
        tile.setAttribute("aria-label", `${index + 1}. ${team.name}`);

        // Badge ordinal — position du passage dans la carrière (parmi les
        // tuiles affichées). Toujours visible, coin haut-gauche.
        const order = document.createElement("span");
        order.className = "team-tile-order";
        order.textContent = String(index + 1);
        tile.appendChild(order);

        // Badge 1v1/2v2 — coin haut-droite, seulement si ce passage inclut un
        // palmarès solo/duo pour cette équipe (voir teamModes, tools/build_data.py).
        // Le 3v3 reste sans marque : c'est l'affiliation par défaut.
        const modes = (currentPlayer.teamModes && currentPlayer.teamModes[teamId]) || [];
        if (modes.length) {
            const modeBadge = document.createElement("span");
            modeBadge.className = "team-tile-mode";
            modeBadge.textContent = modes.map(m => m.toUpperCase()).join("/");
            tile.appendChild(modeBadge);
        }

        const label = document.createElement("span");
        label.className = "team-tile-name";
        label.textContent = team.name;

        if (team.logo) {
            const img = document.createElement("img");
            img.alt = team.name;
            // Tant que le logo n'a pas décodé, on garde l'img masqué : sans ça
            // certains navigateurs affichent brièvement leur icône « image cassée »
            // sur la première frame (le fameux placeholder « feuille »).
            img.style.opacity = "0";
            img.addEventListener("load", () => { img.style.opacity = ""; });
            img.addEventListener("error", () => { img.style.display = "none"; });
            img.src = team.logo;
            tile.appendChild(img);

            // Superposition avec le nom, révélée au hover (desktop) ou au tap
            // (mobile — voir la media query dans style.css).
            tile.appendChild(label);

            tile.addEventListener("click", (event) => {
                event.stopPropagation();
                const wasRevealed = tile.classList.contains("revealed");
                // Une seule tuile révélée à la fois pour ne pas noyer la fiche —
                // les tuiles sans logo (voir ci-dessous) restent en dehors de ce jeu.
                elTeams.querySelectorAll(".team-tile.revealed:not(.no-logo)")
                    .forEach(t => t.classList.remove("revealed"));
                if (!wasRevealed) tile.classList.add("revealed");
            });
        } else {
            // Pas de logo (équipe sans fichier sur Liquipedia) : pas de tuile
            // générique à cliquer, le nom s'affiche d'emblée dans le même
            // style que la superposition ci-dessus, comme si la tuile avait
            // déjà été révélée.
            tile.classList.add("no-logo", "revealed");
            tile.appendChild(label);
        }

        elTeams.appendChild(tile);
    });

    if (window.innerWidth > 768) {
        elInput.focus();
    }
}

// ========================
// Check the answer
// ========================
function checkAnswer() {

    if (roundResolved) return;

    const userAnswer = normalize(elInput.value);
    const correctAnswer = normalize(currentPlayer.name);

    if (!userAnswer) return;

    // Correct answer
    if (userAnswer === correctAnswer) {

        correctCount++;
        totalCount++;
        updateScore();

        if (modeConfig().timed) {
            stopTimer();
        }

        elInput.classList.remove("wrong");
        elInput.classList.add("correct");

        showNameReveal("correct");

        revealPlayer("correct");
        lockRound();

        return;
    }

    // Wrong answer — feedback via l'animation de secousse et la bordure rouge.
    // Le name-reveal ne se déclenche pas ici puisqu'on laisse une autre tentative.
    elInput.classList.remove("wrong");
    void elInput.offsetWidth; // relance l'animation de secousse si la classe est déjà passée
    elInput.classList.add("wrong");
}

// ========================
// Skip
// ========================
function skipQuestion() {

    if (roundResolved) return;

    totalCount++;
    updateScore();

    elInput.classList.remove("wrong", "correct");

    showNameReveal("skip");

    revealPlayer("skip");
    lockRound();

    if (modeConfig().timed) {
        stopTimer();
    }
}

// Fin de manche : on gèle les contrôles et on propose le joueur suivant
function lockRound() {

    roundResolved = true;

    elValidateBtn.disabled = true;
    elSkipBtn.disabled = true;
    elInput.disabled = true;

    elNextBtn.classList.add("show");
    elNextBtn.focus();
}

// ========================
// Next player
// ========================
function nextPlayer() {
    startGame();
    if (modeConfig().timed) {
        startTimer();
    }
}

// ========================
// Reveal player
// ========================
function revealPlayer(type) {

    if (!currentPlayer) return;

    const img = elPlayerPhoto;
    img.onload = null;
    img.onerror = null;
    img.alt = currentPlayer.name;

    // Initiale du pseudo derrière la photo, au cas où elle ne charge pas
    elPhotoSil.textContent = currentPlayer.name.charAt(0).toUpperCase();

    const show = () => {
        img.onload = null;
        img.onerror = null;
        elPhotoSlot.classList.add("revealed", type);
    };

    // Tous les joueurs Liquipedia n'ont pas de photo : on révèle le cadre avec
    // l'initiale plutôt que de laisser la manche bloquée sur le masque « ? »
    if (!currentPlayer.img) {
        elPhotoSlot.classList.add("no-photo");
        show();
        return;
    }

    img.src = currentPlayer.img;

    if (img.complete && img.naturalWidth > 0) {
        show();
    } else {
        img.onload = show;
        img.onerror = show;
    }
}

function resetPhotoSlot() {

    elPlayerPhoto.onload = null;
    elPlayerPhoto.onerror = null;
    // Pixel transparent plutôt qu'un src vide : Chrome afficherait sinon
    // son icône « image cassée » pendant le fondu de sortie de la manche.
    elPlayerPhoto.src = BLANK_PIXEL;
    elPlayerPhoto.alt = "";

    elPhotoSlot.classList.remove("revealed", "correct", "skip", "no-photo");
    elPhotoSil.textContent = "?";
}

// ========================
// HUB
// ========================
function goBackToMenu() {

    stopTimer();

    closeModeMenu();
    closeRankModeMenu();

    elGame.classList.remove("active");
    elRankGame.classList.remove("active");
    elEndScreen.classList.remove("show");
    elHub.classList.remove("hidden");

    resetPhotoSlot();
    hideNameReveal();

    elTeams.innerHTML = "";
    elRankGrid.innerHTML = "";
}

// ========================
// Fiche joueur
// ========================
function fillInfoCard(player) {

    const cfg = modeConfig();

    // NATIONALITY
    // HARD MODE = NO FLAG
    if (!cfg.flag) {

        elInfoNationality.hidden = true;
        elFlagMasked.hidden = false;
        elFlagMasked.querySelector(".masked-mode").textContent = cfg.name;

    } else {

        elFlagMasked.hidden = true;
        elInfoNationality.hidden = false;

        if (player.country) {
            const code = player.country.toLowerCase();
            // `countryName` est fourni par l'API ; countryName() n'est qu'un repli
            const name = player.countryName || countryName(code);

            elInfoFlag.onload = null;
            elInfoFlag.onerror = null;
            elInfoFlag.alt = `${name} flag`;
            elInfoFlag.title = name;

            // SVG endpoint supports both ISO 3166-1 (fr, us, ...) and ISO 3166-2 subdivisions (gb-eng, gb-sct, gb-wls)
            elInfoFlag.src = `https://flagcdn.com/${code}.svg`;
            elInfoFlag.style.display = "block";

            // Text fallback: if the flag fails to load, hide the broken image and rely on the country name
            elInfoFlag.onerror = () => {
                elInfoFlag.style.display = "none";
            };

            elInfoCountryName.textContent = name;
        } else {
            elInfoFlag.style.display = "none";
            elInfoCountryName.textContent = "Unknown";
        }
    }

    // ACHIEVEMENTS
    elInfoAchievements.innerHTML = "";

    const achievements = player.achievements || [];

    if (!cfg.achievements) {

        elInfoAchievements.hidden = true;
        elAchLocked.hidden = false;
        elAchLocked.querySelector(".locked-mode").textContent = cfg.name;

        elChipAchievements.textContent = "Achievements hidden";

    } else {

        elAchLocked.hidden = true;
        elInfoAchievements.hidden = false;

        if (achievements.length > 0) {

            achievements.forEach(a => {
                const li = document.createElement("li");
                li.textContent = a;
                elInfoAchievements.appendChild(li);
            });

            elChipAchievements.textContent = plural(achievements.length, "title");

        } else {

            const li = document.createElement("li");
            li.className = "empty";
            li.textContent = "No S-tier title";
            elInfoAchievements.appendChild(li);

            elChipAchievements.textContent = "No title";
        }
    }
}

function resetInfoCard() {

    elInfoFlag.onload = null;
    elInfoFlag.onerror = null;
    elInfoFlag.src = "";
    elInfoFlag.style.display = "none";
    elInfoCountryName.textContent = "";

    elInfoAchievements.innerHTML = "";

    elChipTeams.textContent = "—";
    elChipAchievements.textContent = "—";

    hideNameReveal();
}

// ========================
// Révélation prominente du nom (bonne réponse ou abandon)
// ========================
function showNameReveal(kind) {
    elNameReveal.className = `name-reveal ${kind}`;
    elNameRevealBadge.textContent = kind === "correct" ? "Correct answer" : "The answer was";
    elNameRevealName.textContent = currentPlayer.name;
    elNameReveal.hidden = false;
}

function hideNameReveal() {
    elNameReveal.hidden = true;
    elNameReveal.className = "name-reveal";
    elNameRevealName.textContent = "";
}

// ========================
// Récapitulatif compact des indices du mode courant.
// Une seule ligne de chips colorées : plus discret que l'ancien tableau.
// ========================
function renderClueList() {

    const cfg = modeConfig();

    const rows = [
        { label: "Flag", state: cfg.flag ? "on" : "off" },
        { label: "Titles", state: cfg.achievements ? "on" : "off" },
        {
            label: cfg.teamLimit ? `${cfg.teamLimit} teams` : "All teams",
            state: cfg.teamLimit ? "partial" : "on"
        },
        { label: "Photo · reveal", state: "partial" }
    ];

    elClueList.innerHTML = "";

    rows.forEach(row => {
        const chip = document.createElement("span");
        chip.className = `clue-chip ${row.state}`;
        chip.textContent = row.label;
        elClueList.appendChild(chip);
    });
}

// ========================
// Chrono et score
// ========================
function startTimer() {
    clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        timer++;
        updateTimerDisplay();
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}

function updateTimerDisplay() {
    const minutes = String(Math.floor(timer / 60)).padStart(2, "0");
    const seconds = String(timer % 60).padStart(2, "0");

    elTimerDisplay.textContent = `${minutes}:${seconds}`;
}

function updateScore() {
    // Quick Ten a un total connu d'avance (toujours 10, cf. QUICK_TEN_SIZE) :
    // afficher "/10" dès le début est plus lisible que le "/totalCount" des
    // autres modes, qui grandit manche après manche et ne dit rien du nombre
    // de manches restantes. Les autres modes gardent ce dernier comportement
    // (score d'exactitude sur les manches déjà tentées).
    const denominator = selectedMode === "quickten" ? sessionPlayerCount : totalCount;
    elScoreDisplay.textContent = `${correctCount}/${denominator}`;
}

// ========================
// Écran de fin
// ========================
function showEndScreen() {

    const cfg = modeConfig();
    const displayName = currentDisplayName || cfg.name;

    // Le titre et l'accroche reflètent le score réel : l'ancien texte fixe
    // ("Congratulations! You found every player") s'affichait même à 0/10,
    // qui n'est pas seulement trop optimiste mais factuellement faux — on
    // atteint cet écran dès que le pool est épuisé, pas seulement en cas de
    // sans-faute (skip/mauvaise réponse font aussi avancer la manche).
    if (totalCount > 0 && correctCount === totalCount) {
        elEndTitle.textContent = "Congratulations!";
        elEndLede.textContent = `You found every player in ${displayName} mode.`;
    } else if (correctCount === 0) {
        elEndTitle.textContent = "Round Complete";
        elEndLede.textContent = `You didn't find any player in ${displayName} mode this time.`;
    } else {
        elEndTitle.textContent = "Round Complete";
        elEndLede.textContent = `You found ${correctCount} of ${totalCount} players in ${displayName} mode.`;
    }

    elFinalScore.textContent = `${correctCount}/${totalCount}`;

    if (cfg.timed) {

        elFinalTimeContainer.style.display = "block";
        elFinalTime.textContent = elTimerDisplay.textContent;
        elFinalTimeContainer.parentElement.classList.remove("single");

    } else {

        elFinalTimeContainer.style.display = "none";
        elFinalTimeContainer.parentElement.classList.add("single");
    }

    elEndScreen.classList.add("show");
}

function restartMode() {

    elEndScreen.classList.remove("show");

    // Rejoue le même pool que la session en cours — pas le roster complet :
    // un "Play Again" depuis un mode de test comme "Career Era" doit rester
    // dans la période choisie, pas revenir silencieusement à tous les joueurs.
    // Exception : Quick Ten fournit `currentResample` pour tirer 10 NOUVEAUX
    // joueurs aléatoires à chaque partie plutôt que de rejouer les mêmes dix.
    if (currentResample) currentPool = currentResample();
    remainingPlayers = [...currentPool];
    sessionPlayerCount = currentPool.length;

    correctCount = 0;
    totalCount = 0;

    updateScore();

    if (modeConfig().timed) {

        timer = 0;

        updateTimerDisplay();

        startTimer();
    }

    startGame();
}

// ========================
// Titre du hub : filet de sécurité
// ========================

// Le titre « RL / GUESSR » est un dégradé découpé à la forme des lettres
// (`background-clip: text` + texte transparent). Quand un navigateur annonce
// supporter la technique mais ne l'applique pas — c'est le cas du mode sombre
// automatique de Chrome, qui réécrit les couleurs de la page — le texte reste
// transparent par-dessus un aplat : le titre devient invisible et il ne reste
// que deux bandes de couleur.
//
// On vérifie donc le résultat réel plutôt que la déclaration : si la valeur
// calculée n'est pas `text`, on repasse le titre en couleur pleine.
function checkGradientTextSupport() {
    const target = document.querySelector(".hero-rl");
    if (!target) return;

    const style = window.getComputedStyle(target);
    const clip = style.backgroundClip || style.webkitBackgroundClip;

    if (clip !== "text") {
        document.body.classList.add("no-gradient-text");
    }
}

checkGradientTextSupport();

// Les polices arrivent après le premier rendu : on revérifie une fois posées.
if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(checkGradientTextSupport);
}

// Entrée : valide la réponse, ou enchaîne sur le joueur suivant si la manche est finie
elInput.addEventListener("keydown", function (event) {
    if (event.key !== "Enter") return;

    event.preventDefault();

    if (roundResolved) {
        nextPlayer();
    } else {
        checkAnswer();
    }
});

// Un clic ailleurs referme la tuile d'équipe révélée et le menu de modes.
// Les clics sur la tuile et sur le bouton du HUD appellent stopPropagation.
document.addEventListener("click", () => {
    elTeams.querySelectorAll(".team-tile.revealed:not(.no-logo)").forEach(t => t.classList.remove("revealed"));
    closeModeMenu();
    closeRankModeMenu();
});

// ========================
// Dropdown de changement de mode dans le HUD
// ========================
// Les deux écrans de jeu (classique #game et le mode de test Earnings Rank
// #rankGame) ont chacun leur propre bouton/menu, mais le même contenu : les
// cinq modes classiques, puis — séparés par un petit espace, cf. demande du
// mainteneur — les modes de test (pour l'instant, seulement Earnings Rank).
// Un mode de test ne passe pas par MODES (voir "Modes de test" dans
// CLAUDE.md), donc l'entrée Earnings Rank est ajoutée à la main après la
// boucle plutôt que déclarée dans la table.
function buildModeMenuContents(menuEl) {
    menuEl.innerHTML = "";

    Object.entries(MODES).forEach(([key, cfg]) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = `mode-menu-item mode-menu-${key}`;
        item.dataset.mode = key;
        item.setAttribute("role", "menuitem");

        const dot = document.createElement("span");
        dot.className = "mode-menu-dot";
        item.appendChild(dot);

        const label = document.createElement("span");
        label.textContent = cfg.name;
        item.appendChild(label);

        item.addEventListener("click", (event) => {
            event.stopPropagation();
            closeModeMenu();
            closeRankModeMenu();
            startMode(key);
        });

        menuEl.appendChild(item);
    });

    const divider = document.createElement("div");
    divider.className = "mode-menu-divider";
    divider.setAttribute("role", "separator");
    menuEl.appendChild(divider);

    appendModeMenuItem(menuEl, "earnings", "mode-menu-earnings", "Earnings Rank", () => {
        startEarningsMode();
    });

    appendModeMenuItem(menuEl, "era-before", "mode-menu-era", ERA_LABELS.before, () => {
        applyEraPeriod("before");
        startEraMode();
    });

    appendModeMenuItem(menuEl, "era-after", "mode-menu-era", ERA_LABELS.after, () => {
        applyEraPeriod("after");
        startEraMode();
    });

    appendModeMenuItem(menuEl, "region", "mode-menu-region", "Regional Scene", () => {
        startRegionMode();
    });

    appendModeMenuItem(menuEl, "quickten", "mode-menu-quickten", "Quick Ten", () => {
        startQuickTenMode();
    });

    appendModeMenuItem(menuEl, "lan", "mode-menu-lan", "LAN Roster", () => {
        startLanMode();
    });
}

// Un item de mode de test dans le dropdown : même structure que les entrées
// classiques (pastille + libellé), mais sans passer par MODES — voir
// "Modes de test" dans CLAUDE.md.
function appendModeMenuItem(menuEl, modeKey, extraClass, label, onSelect) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `mode-menu-item ${extraClass}`;
    item.dataset.mode = modeKey;
    item.setAttribute("role", "menuitem");

    const dot = document.createElement("span");
    dot.className = "mode-menu-dot";
    item.appendChild(dot);

    const text = document.createElement("span");
    text.textContent = label;
    item.appendChild(text);

    item.addEventListener("click", (event) => {
        event.stopPropagation();
        closeModeMenu();
        closeRankModeMenu();
        onSelect();
    });

    menuEl.appendChild(item);
}

// Fonctions génériques ouverture/fermeture, paramétrées par la paire
// bouton/menu concernée — évite de dupliquer la logique pour les deux HUD.
function toggleModeMenuFor(buttonEl, menuEl, currentKey) {
    if (menuEl.hidden) openModeMenuFor(buttonEl, menuEl, currentKey);
    else closeModeMenuFor(buttonEl, menuEl);
}

function openModeMenuFor(buttonEl, menuEl, currentKey) {
    // Marque l'entrée du mode courant à chaque ouverture
    menuEl.querySelectorAll(".mode-menu-item").forEach(el => {
        el.classList.toggle("active", el.dataset.mode === currentKey);
    });
    menuEl.hidden = false;
    buttonEl.setAttribute("aria-expanded", "true");
}

function closeModeMenuFor(buttonEl, menuEl) {
    if (menuEl.hidden) return;
    menuEl.hidden = true;
    buttonEl.setAttribute("aria-expanded", "false");
}

function toggleModeMenu() { toggleModeMenuFor(elHudMode, elModeMenu, selectedMode); }
function closeModeMenu() { closeModeMenuFor(elHudMode, elModeMenu); }

function toggleRankModeMenu() { toggleModeMenuFor(elHudModeRank, elModeMenuRank, "earnings"); }
function closeRankModeMenu() { closeModeMenuFor(elHudModeRank, elModeMenuRank); }

elHudMode.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleModeMenu();
});

elHudModeRank.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleRankModeMenu();
});

// Empêche la fermeture quand on clique dans le panneau lui-même (sur un espace
// vide entre deux items par exemple).
elModeMenu.addEventListener("click", (event) => event.stopPropagation());
elModeMenuRank.addEventListener("click", (event) => event.stopPropagation());

buildModeMenuContents(elModeMenu);
buildModeMenuContents(elModeMenuRank);

// ========================
// Mode de test : Earnings Rank
// ========================
// Séparé de startMode()/MODES : ce n'est pas un mode "deviner le nom à partir
// d'indices", donc modeConfig() n'a rien à y faire. Voir "Modes de test" dans
// CLAUDE.md pour le patron à suivre pour le prochain mode de test.

function eligibleForEarnings() {
    return players.filter(p => typeof p.earnings === "number" && p.earnings > 0);
}

function setEarningsCount(count, event) {
    event.stopPropagation();
    earningsCount = count;
    document.querySelectorAll(".count-pill").forEach(pill => {
        pill.classList.toggle("active", Number(pill.dataset.count) === count);
    });
}

function formatEarnings(value) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0
    }).format(value);
}

function startEarningsMode() {

    if (!requirePlayers()) return;

    if (eligibleForEarnings().length < earningsCount) {
        setHubStatus(
            "Not enough players have earnings data yet — regenerate players.json " +
            "with the earnings field (see tools/build_data.py) to play this mode.",
            true
        );
        return;
    }

    // stopTimer() est nécessaire ici (contrairement aux autres modes de test,
    // qui passent par setupGame() et l'appellent déjà) : on peut rejoindre
    // Earnings Rank — qui n'a pas de chrono — depuis le mode Timer en cours.
    enterGameScreen(elRankGame, () => {
        stopTimer();
        rankRoundsPlayed = 0;
        rankRoundsWon = 0;
        updateRankScore();
        startRankRound();
    });
}

function startRankRound() {

    rankResolved = false;

    const pool = eligibleForEarnings();
    rankPlayers = [];

    while (rankPlayers.length < earningsCount && pool.length) {
        const randomIndex = Math.floor(Math.random() * pool.length);
        rankPlayers.push(pool.splice(randomIndex, 1)[0]);
    }

    rankPicks = [];

    elRankRoundIndex.textContent = `Round ${rankRoundsPlayed + 1}`;
    elRankResetBtn.disabled = false;
    elRankNextBtn.classList.remove("show");

    renderRankGrid();
}

function renderRankGrid() {

    elRankGrid.innerHTML = "";

    rankPlayers.forEach((player, index) => {

        const card = document.createElement("button");
        card.type = "button";
        card.className = "rank-card";
        card.dataset.index = index;
        card.setAttribute("aria-label", player.name);

        const badge = document.createElement("span");
        badge.className = "rank-card-badge";
        badge.hidden = true;
        card.appendChild(badge);

        const photo = document.createElement("div");
        photo.className = "rank-card-photo";

        if (player.img) {
            const img = document.createElement("img");
            img.src = player.img;
            img.alt = player.name;
            photo.appendChild(img);
        } else {
            photo.textContent = player.name.charAt(0).toUpperCase();
        }

        card.appendChild(photo);

        const name = document.createElement("span");
        name.className = "rank-card-name";
        name.textContent = player.name;
        card.appendChild(name);

        const earnings = document.createElement("span");
        earnings.className = "rank-card-earnings";
        earnings.hidden = true;
        card.appendChild(earnings);

        card.addEventListener("click", () => pickRankCard(index, card));

        elRankGrid.appendChild(card);
    });
}

function pickRankCard(index, card) {

    if (rankResolved || card.classList.contains("picked")) return;

    rankPicks.push(rankPlayers[index]);
    card.classList.add("picked");

    const badge = card.querySelector(".rank-card-badge");
    badge.textContent = String(rankPicks.length);
    badge.hidden = false;

    if (rankPicks.length === rankPlayers.length) {
        resolveRankRound();
    }
}

function resetRankPicks() {

    if (rankResolved) return;

    rankPicks = [];

    elRankGrid.querySelectorAll(".rank-card").forEach(card => {
        card.classList.remove("picked");
        card.querySelector(".rank-card-badge").hidden = true;
    });
}

function resolveRankRound() {

    rankResolved = true;
    rankRoundsPlayed++;

    const correctOrder = [...rankPlayers].sort((a, b) => b.earnings - a.earnings);
    let correctPositions = 0;

    // On itère sur le classement réel (pas sur les tuiles) : chaque carte migre
    // à sa vraie place via `order` CSS — la grille est déjà en display: grid.
    correctOrder.forEach((player, trueIndex) => {

        const card = elRankGrid.querySelector(`.rank-card[data-index="${rankPlayers.indexOf(player)}"]`);
        const isCorrect = rankPicks[trueIndex] === player;

        if (isCorrect) correctPositions++;

        card.style.order = trueIndex;
        card.classList.remove("picked");
        card.classList.add(isCorrect ? "correct" : "wrong");

        const badge = card.querySelector(".rank-card-badge");
        badge.textContent = `#${trueIndex + 1}`;

        const earnings = card.querySelector(".rank-card-earnings");
        earnings.textContent = formatEarnings(player.earnings);
        earnings.hidden = false;
    });

    if (correctPositions === rankPlayers.length) rankRoundsWon++;
    updateRankScore();

    elRankResetBtn.disabled = true;
    elRankNextBtn.classList.add("show");
    elRankNextBtn.focus();
}

function updateRankScore() {
    elRankScoreDisplay.textContent = `${rankRoundsWon}/${rankRoundsPlayed}`;
}

function nextRankRound() {
    startRankRound();
}

// ========================
// Mode de test : Career Era
// ========================
// Contrairement à Earnings Rank, ce n'est pas une mécanique inédite : c'est
// exactement la boucle "deviner à partir d'indices" du mode Classic (photo,
// drapeau, équipes, palmarès — tout est montré), juste avec `remainingPlayers`
// restreint à une période de carrière. Pas de nouvel écran : on réutilise
// #game via setupGame(mode, { pool, displayName }) — voir ce commentaire
// plus haut dans le fichier. `selectedMode` vaut "era-before"/"era-after",
// absent de MODES : modeConfig() retombe donc sur MODES.classic (tous les
// indices visibles), exactement le comportement voulu.

function eligibleForEra(period) {
    return players.filter(p => {
        if (period === "before") return p.firstSTierDate && p.firstSTierDate < ERA_CUTOFF;
        return p.lastSTierDate && p.lastSTierDate >= ERA_CUTOFF;
    });
}

function applyEraPeriod(period) {
    eraPeriod = period;
    document.querySelectorAll("[data-era]").forEach(pill => {
        pill.classList.toggle("active", pill.dataset.era === period);
    });
}

function setEraPeriod(period, event) {
    event.stopPropagation();
    applyEraPeriod(period);
}

function startEraMode() {

    if (!requirePlayers()) return;

    const pool = eligibleForEra(eraPeriod);

    if (!pool.length) {
        setHubStatus(
            "No players found for this period yet — regenerate players.json with " +
            "firstSTierDate/lastSTierDate (see tools/build_data.py) to play this mode.",
            true
        );
        return;
    }

    const key = `era-${eraPeriod}`;
    const displayName = ERA_LABELS[eraPeriod];

    enterGameScreen(elGame, () => setupGame(key, { pool, displayName }));
}

// ========================
// Mode de test : Regional Scene
// ========================
// Même patron que Career Era : réutilise #game via setupGame(mode, { pool,
// displayName }), pas de nouvel écran. Contrairement au dropdown du HUD qui
// liste "Before Season X"/"After Season X" séparément (2 options), les 7
// régions tiennent dans UNE seule entrée "Regional Scene" — comme Earnings
// Rank, qui ne liste pas "Earnings 5"/"Earnings 10" séparément. D'où
// `selectedMode` fixé à la constante "region" plutôt qu'à une clé par région :
// un seul item de menu à mettre en surbrillance, pas sept.

function eligibleForRegion(region) {
    return players.filter(p => p.region === region);
}

function setRegionFilter(value) {
    regionFilter = value;
}

function startRegionMode() {

    if (!requirePlayers()) return;

    const pool = eligibleForRegion(regionFilter);

    if (!pool.length) {
        setHubStatus(
            "No players found for this region yet — regenerate players.json with " +
            "the region field (see tools/build_data.py) to play this mode.",
            true
        );
        return;
    }

    enterGameScreen(elGame, () => setupGame("region", { pool, displayName: regionFilter }));
}

// ========================
// Special : Quick Ten
// ========================
// Toujours la mécanique Classic (setupGame("quickten", ...), absent de
// MODES donc modeConfig() retombe sur MODES.classic — tous les indices).
// Seule différence avec Career Era/Regional Scene : le pool n'est pas un
// sous-ensemble stable (une période, une région), c'est un tirage aléatoire
// de taille fixe à chaque partie — d'où `resample` (voir `currentResample`
// plus haut) pour qu'un "Play Again" tire 10 NOUVEAUX joueurs plutôt que de
// rejouer les mêmes dix. L'écran de fin existant (#endScreen, déjà utilisé
// par les 5 modes classiques) sert tel quel de récapitulatif.
const QUICK_TEN_SIZE = 10;

function drawRandomPool(size) {
    const shuffled = [...players];
    const picked = [];

    while (picked.length < size && shuffled.length) {
        const randomIndex = Math.floor(Math.random() * shuffled.length);
        picked.push(shuffled.splice(randomIndex, 1)[0]);
    }

    return picked;
}

function startQuickTenMode() {

    if (!requirePlayers()) return;

    const size = Math.min(QUICK_TEN_SIZE, players.length);
    const opts = {
        pool: drawRandomPool(size),
        displayName: "Quick Ten",
        resample: () => drawRandomPool(size),
    };

    enterGameScreen(elGame, () => setupGame("quickten", opts));
}

// ========================
// Special : LAN Roster
// ========================
// Même patron que Regional Scene : un <select> (la liste de LAN est generee,
// pas question de coder 32 <option> en dur comme les sept regions), une
// seule entree de dropdown quelle que soit la LAN choisie (comme Earnings
// Rank/Regional Scene), et setupGame("lan", { pool, displayName }) — pas de
// nouvel ecran, meme mecanique Classic (tous les indices).

function populateLanSelect() {
    if (!lans.length) return;

    elLanSelect.innerHTML = "";

    lans.forEach(lan => {
        const option = document.createElement("option");
        option.value = lan.id;
        option.textContent = lan.city ? `${lan.name} — ${lan.city}` : lan.name;
        elLanSelect.appendChild(option);
    });

    // Par defaut, la LAN la plus recente — lans.json est deja trie par date.
    lanFilter = lans[lans.length - 1].id;
    elLanSelect.value = lanFilter;
}

function setLanFilter(value) {
    lanFilter = value;
}

function eligibleForLan(lanId) {
    return players.filter(p => p.lans && p.lans.includes(lanId));
}

function startLanMode() {

    if (!requirePlayers()) return;

    if (!lanFilter) {
        setHubStatus("Still loading LAN data — try again in a second.", false);
        return;
    }

    const pool = eligibleForLan(lanFilter);

    if (!pool.length) {
        setHubStatus(
            "No players found for this LAN yet — regenerate players.json/lans.json " +
            "(see tools/build_data.py) to play this mode.",
            true
        );
        return;
    }

    const lan = lans.find(l => l.id === lanFilter);
    const displayName = lan ? lan.name : "LAN Roster";

    enterGameScreen(elGame, () => setupGame("lan", { pool, displayName }));
}
