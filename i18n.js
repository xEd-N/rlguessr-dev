// ============================================================
// i18n : table de traductions + moteur d'application
// ============================================================
// Cinq langues pour l'instant : en (par défaut), fr, ar, es, de.
//
// Règles :
//   - L'anglais est aussi le fallback : une clé manquante dans une autre
//     langue retombe sur en. Une clé absente partout est renvoyée telle
//     quelle plutôt que de casser le rendu.
//   - Les données de jeu (noms de joueurs, d'équipes, de LAN, titres de
//     palmarès) restent en anglais : source unique = Liquipedia, aucune
//     traduction manuelle à maintenir. Seuls les libellés UI passent ici.
//   - `t("...", {name: "..."})` remplace `{name}` par la valeur fournie —
//     nécessaire pour toutes les phrases qui contiennent un nombre ou un
//     nom de mode ("You found {n} of {m} players in {mode} mode.").
//   - L'arabe passe la page en `dir="rtl"` ; l'input de réponse garde
//     `dir="ltr"` (les tags des joueurs restent en alphabet latin).
//
// Ce fichier est chargé AVANT script.js dans index.html — pour que
// `setLanguage()`/`t()` existent quand script.js s'exécute et que le
// DOM statique porte déjà la bonne langue à la première frame.

const LANGUAGES = [
  { code: "en", nativeLabel: "English" },
  { code: "fr", nativeLabel: "Français" },
  { code: "ar", nativeLabel: "العربية" },
  { code: "es", nativeLabel: "Español" },
  { code: "de", nativeLabel: "Deutsch" }
];

const RTL_LANGUAGES = new Set(["ar"]);

// ============================================================
// Table de traductions
// ============================================================
const I18N = {

  // ------------------------------------------------------------
  // EN — anglais américain (langue par défaut, source de vérité)
  // ------------------------------------------------------------
  en: {
    "meta.title": "RLGuessr — Guess the Rocket League Pro",

    "lang.title": "Language",

    "hub.brand.label": "Rocket League Guessing Game",
    "hub.hero.lede": "Guess Rocket League pro players from their clues: nationality, S-Tier honours and the teams they joined. Five modes, from the most forgiving to the most merciless.",
    "hub.section.modes": "Choose your mode",
    "hub.section.specials": "Specials",
    "hub.specials.note": "Experimental mini-games — still deciding which of these stay.",

    "modes.classic.tag": "All clues",
    "modes.classic.name": "Classic",
    "modes.classic.desc": "The standard mode. Flag, photo, S-tier achievements and every team are shown.",
    "modes.medium.tag": "No achievements",
    "modes.medium.name": "Medium",
    "modes.medium.desc": "S-tier achievements are hidden. The flag, the photo and the teams remain.",
    "modes.hard.tag": "No flag",
    "modes.hard.name": "Hard",
    "modes.hard.desc": "Nationality is hidden. You play on achievements and teams alone.",
    "modes.extreme.tag": "2 teams max",
    "modes.extreme.name": "Extreme",
    "modes.extreme.desc": "Two teams shown at most, and no achievements. For veterans only.",
    "modes.timer.tag": "Against the clock",
    "modes.timer.name": "Timer",
    "modes.timer.desc": "All the clues, but the clock is running. Clear the roster as fast as you can.",

    "modes.earnings.aria": "Number of players",
    "modes.earnings.name": "Earnings Rank",
    "modes.earnings.desc": "No clues but their face and tag. Rank the pack from highest to lowest career earnings.",
    "modes.era.aria": "Career period",
    "modes.era.before": "Before",
    "modes.era.after": "After",
    "modes.era.name": "Career Era",
    "modes.era.desc": "All the usual clues, but the roster is cut down to players active before or after RLCS Season X.",
    "modes.era.beforeLabel": "Before Season X",
    "modes.era.afterLabel": "After Season X",
    "modes.region.aria": "Competitive region",
    "modes.region.name": "Regional Scene",
    "modes.region.desc": "Same clues as Classic, but the roster is cut down to players currently competing in one region.",
    "modes.quickten.tag": "10 players",
    "modes.quickten.name": "Quick Ten",
    "modes.quickten.desc": "Same clues as Classic, but just a short run of 10 random players — then a recap and a fresh set.",
    "modes.lan.aria": "LAN event",
    "modes.lan.name": "LAN Roster",
    "modes.lan.desc": "Same clues as Classic, but the roster is cut down to everyone — 3v3, 1v1, 2v2 — who competed at one LAN.",

    "regions.europe": "Europe",
    "regions.northAmerica": "North America",
    "regions.southAmerica": "South America",
    "regions.mena": "MENA",
    "regions.ssa": "SSA",
    "regions.asiaPacific": "Asia-Pacific",
    "regions.oceania": "Oceania",

    "hub.footer.disclaimer": "Fan site, not affiliated in any way with Psyonix or Epic Games. Rocket League is a trademark of Psyonix LLC.",
    "hub.footer.data": "Player data and achievements: <a href=\"https://liquipedia.net/rocketleague/\" target=\"_blank\" rel=\"noopener noreferrer\">Liquipedia</a> — CC-BY-SA 3.0.",

    "game.btn.menu": "Menu",
    "hud.mode": "Mode ·",
    "hud.score": "Score",
    "hud.time": "Time",
    "hud.perfectRounds": "Perfect rounds",

    "panel.playerInfo": "Player Info",
    "panel.photo": "Photo",
    "panel.nationality": "Nationality",
    "panel.hiddenIn": "Hidden in {mode} mode",
    "panel.teamsJoined": "Teams joined",
    "panel.oldestFirst": "— oldest first",
    "panel.cappedAt": "Capped at {n}",
    "panel.achievements": "S-Tier Achievements",
    "panel.achievementsLocked": "Achievements unavailable in {mode} mode",

    "panel.answer.title": "Your answer",
    "panel.answer.lede": "Type the player's tag, then confirm.",
    "panel.answer.placeholder": "Player tag…",
    "panel.answer.confirm": "Confirm",
    "panel.answer.skip": "I don't know",
    "panel.answer.next": "Next player",
    "panel.answer.correct": "Correct answer",
    "panel.answer.was": "The answer was",

    "clues.title": "Clues",
    "clues.flag": "Flag",
    "clues.titles": "Titles",
    "clues.allTeams": "All teams",
    "clues.nTeams": "{n} teams",
    "clues.photo": "Photo · reveal",

    "chips.team.one": "{n} team",
    "chips.team.other": "{n} teams",
    "chips.title.one": "{n} title",
    "chips.title.other": "{n} titles",
    "chips.noTitle": "No title",
    "chips.achievementsHidden": "Achievements hidden",

    "list.noTitle": "No S-tier title",

    "rank.roundLabel": "Round {n}",
    "rank.panelTitle": "Rank by career earnings",
    "rank.lede": "Tap the players in order — <strong>highest career earnings first</strong>.",
    "rank.reset": "Reset picks",
    "rank.next": "New round",

    "end.congrats": "Congratulations!",
    "end.complete": "Round Complete",
    "end.foundAll": "You found every player in {mode} mode.",
    "end.foundNone": "You didn't find any player in {mode} mode this time.",
    "end.foundSome": "You found {n} of {m} players in {mode} mode.",
    "end.finalScore": "Final score",
    "end.finalTime": "Final time",
    "end.playAgain": "Play Again",
    "end.menu": "Menu",

    "status.loading": "Loading players…",
    "status.stillLoading": "Still loading the player data — try again in a second.",
    "status.loadError": "Could not load the player data. Serve this folder over HTTP instead of opening <code>index.html</code> directly — browsers block <code>file://</code> data requests. For example: <code>npx serve .</code>",
    "status.notEnoughEarnings": "Not enough players have earnings data yet — regenerate players.json with the earnings field (see tools/build_data.py) to play this mode.",
    "status.noPeriodPlayers": "No players found for this period yet — regenerate players.json with firstSTierDate/lastSTierDate (see tools/build_data.py) to play this mode.",
    "status.noRegionPlayers": "No players found for this region yet — regenerate players.json with the region field (see tools/build_data.py) to play this mode.",
    "status.noLanPlayers": "No players found for this LAN yet — regenerate players.json/lans.json (see tools/build_data.py) to play this mode.",
    "status.loadingLan": "Still loading LAN data — try again in a second.",

    "misc.unknown": "Unknown",
    "misc.flagAlt": "{country} flag"
  },

  // ------------------------------------------------------------
  // FR — français
  // ------------------------------------------------------------
  fr: {
    "meta.title": "RLGuessr — Devinez le pro Rocket League",

    "lang.title": "Langue",

    "hub.brand.label": "Jeu de devinettes Rocket League",
    "hub.hero.lede": "Devinez les joueurs pros de Rocket League à partir de leurs indices : nationalité, palmarès S-Tier et équipes rejointes. Cinq modes, du plus indulgent au plus impitoyable.",
    "hub.section.modes": "Choisissez votre mode",
    "hub.section.specials": "Spéciaux",
    "hub.specials.note": "Mini-jeux expérimentaux — on décide encore lesquels restent.",

    "modes.classic.tag": "Tous les indices",
    "modes.classic.name": "Classique",
    "modes.classic.desc": "Le mode standard. Drapeau, photo, palmarès S-tier et toutes les équipes sont affichés.",
    "modes.medium.tag": "Sans palmarès",
    "modes.medium.name": "Moyen",
    "modes.medium.desc": "Les palmarès S-tier sont cachés. Il reste le drapeau, la photo et les équipes.",
    "modes.hard.tag": "Sans drapeau",
    "modes.hard.name": "Difficile",
    "modes.hard.desc": "La nationalité est cachée. À vous de jouer avec le palmarès et les équipes.",
    "modes.extreme.tag": "2 équipes max",
    "modes.extreme.name": "Extrême",
    "modes.extreme.desc": "Deux équipes affichées au maximum, et pas de palmarès. Pour les vétérans uniquement.",
    "modes.timer.tag": "Contre la montre",
    "modes.timer.name": "Chrono",
    "modes.timer.desc": "Tous les indices, mais le chrono tourne. Écumez le roster le plus vite possible.",

    "modes.earnings.aria": "Nombre de joueurs",
    "modes.earnings.name": "Classement Gains",
    "modes.earnings.desc": "Aucun indice à part le visage et le pseudo. Classez le groupe des plus gros aux plus petits gains en carrière.",
    "modes.era.aria": "Période de carrière",
    "modes.era.before": "Avant",
    "modes.era.after": "Après",
    "modes.era.name": "Époque",
    "modes.era.desc": "Tous les indices habituels, mais le roster est restreint aux joueurs actifs avant ou après la Saison X de RLCS.",
    "modes.era.beforeLabel": "Avant la Saison X",
    "modes.era.afterLabel": "Après la Saison X",
    "modes.region.aria": "Région compétitive",
    "modes.region.name": "Scène Régionale",
    "modes.region.desc": "Les mêmes indices que Classique, mais le roster est restreint aux joueurs actuellement en compétition dans une région.",
    "modes.quickten.tag": "10 joueurs",
    "modes.quickten.name": "Dix Rapide",
    "modes.quickten.desc": "Les mêmes indices que Classique, juste une courte série de 10 joueurs aléatoires — puis un récap et une nouvelle sélection.",
    "modes.lan.aria": "Événement LAN",
    "modes.lan.name": "Roster LAN",
    "modes.lan.desc": "Les mêmes indices que Classique, mais le roster est restreint à tous ceux — 3v3, 1v1, 2v2 — qui ont concouru à une LAN.",

    "regions.europe": "Europe",
    "regions.northAmerica": "Amérique du Nord",
    "regions.southAmerica": "Amérique du Sud",
    "regions.mena": "MENA",
    "regions.ssa": "Afrique subsaharienne",
    "regions.asiaPacific": "Asie-Pacifique",
    "regions.oceania": "Océanie",

    "hub.footer.disclaimer": "Site de fans, sans aucune affiliation avec Psyonix ou Epic Games. Rocket League est une marque déposée de Psyonix LLC.",
    "hub.footer.data": "Données joueurs et palmarès : <a href=\"https://liquipedia.net/rocketleague/\" target=\"_blank\" rel=\"noopener noreferrer\">Liquipedia</a> — CC-BY-SA 3.0.",

    "game.btn.menu": "Menu",
    "hud.mode": "Mode ·",
    "hud.score": "Score",
    "hud.time": "Temps",
    "hud.perfectRounds": "Manches parfaites",

    "panel.playerInfo": "Fiche joueur",
    "panel.photo": "Photo",
    "panel.nationality": "Nationalité",
    "panel.hiddenIn": "Caché en mode {mode}",
    "panel.teamsJoined": "Équipes rejointes",
    "panel.oldestFirst": "— plus anciennes d'abord",
    "panel.cappedAt": "Limité à {n}",
    "panel.achievements": "Palmarès S-Tier",
    "panel.achievementsLocked": "Palmarès indisponible en mode {mode}",

    "panel.answer.title": "Votre réponse",
    "panel.answer.lede": "Tapez le pseudo du joueur, puis confirmez.",
    "panel.answer.placeholder": "Pseudo du joueur…",
    "panel.answer.confirm": "Confirmer",
    "panel.answer.skip": "Je ne sais pas",
    "panel.answer.next": "Joueur suivant",
    "panel.answer.correct": "Bonne réponse",
    "panel.answer.was": "La réponse était",

    "clues.title": "Indices",
    "clues.flag": "Drapeau",
    "clues.titles": "Titres",
    "clues.allTeams": "Toutes les équipes",
    "clues.nTeams": "{n} équipes",
    "clues.photo": "Photo · révélation",

    "chips.team.one": "{n} équipe",
    "chips.team.other": "{n} équipes",
    "chips.title.one": "{n} titre",
    "chips.title.other": "{n} titres",
    "chips.noTitle": "Aucun titre",
    "chips.achievementsHidden": "Palmarès caché",

    "list.noTitle": "Aucun titre S-tier",

    "rank.roundLabel": "Manche {n}",
    "rank.panelTitle": "Classer par gains en carrière",
    "rank.lede": "Tapez sur les joueurs dans l'ordre — <strong>plus gros gains en carrière en premier</strong>.",
    "rank.reset": "Réinitialiser",
    "rank.next": "Nouvelle manche",

    "end.congrats": "Félicitations !",
    "end.complete": "Manche terminée",
    "end.foundAll": "Vous avez trouvé tous les joueurs en mode {mode}.",
    "end.foundNone": "Vous n'avez trouvé aucun joueur en mode {mode} cette fois.",
    "end.foundSome": "Vous avez trouvé {n} joueurs sur {m} en mode {mode}.",
    "end.finalScore": "Score final",
    "end.finalTime": "Temps final",
    "end.playAgain": "Rejouer",
    "end.menu": "Menu",

    "status.loading": "Chargement des joueurs…",
    "status.stillLoading": "Chargement des données en cours — réessayez dans une seconde.",
    "status.loadError": "Impossible de charger les données. Servez ce dossier via HTTP au lieu d'ouvrir <code>index.html</code> directement — les navigateurs bloquent les requêtes de données <code>file://</code>. Par exemple : <code>npx serve .</code>",
    "status.notEnoughEarnings": "Pas assez de joueurs avec des données de gains — régénérez players.json avec le champ earnings (voir tools/build_data.py) pour jouer ce mode.",
    "status.noPeriodPlayers": "Aucun joueur trouvé pour cette période — régénérez players.json avec firstSTierDate/lastSTierDate (voir tools/build_data.py) pour jouer ce mode.",
    "status.noRegionPlayers": "Aucun joueur trouvé pour cette région — régénérez players.json avec le champ region (voir tools/build_data.py) pour jouer ce mode.",
    "status.noLanPlayers": "Aucun joueur trouvé pour cette LAN — régénérez players.json/lans.json (voir tools/build_data.py) pour jouer ce mode.",
    "status.loadingLan": "Chargement des données LAN — réessayez dans une seconde.",

    "misc.unknown": "Inconnu",
    "misc.flagAlt": "Drapeau {country}"
  },

  // ------------------------------------------------------------
  // AR — arabe (RTL)
  // ------------------------------------------------------------
  ar: {
    "meta.title": "RLGuessr — احزر لاعب روكيت ليغ المحترف",

    "lang.title": "اللغة",

    "hub.brand.label": "لعبة تخمين روكيت ليغ",
    "hub.hero.lede": "احزر لاعبي روكيت ليغ المحترفين من خلال الأدلة: الجنسية، الإنجازات من الفئة S، والفرق التي انضموا إليها. خمسة أوضاع، من الأكثر تسامحًا إلى الأكثر قسوة.",
    "hub.section.modes": "اختر وضعك",
    "hub.section.specials": "أوضاع خاصة",
    "hub.specials.note": "ألعاب صغيرة تجريبية — لا نزال نقرر أيها سيبقى.",

    "modes.classic.tag": "كل الأدلة",
    "modes.classic.name": "كلاسيكي",
    "modes.classic.desc": "الوضع القياسي. يتم عرض العلم والصورة وإنجازات الفئة S وكل الفرق.",
    "modes.medium.tag": "بدون إنجازات",
    "modes.medium.name": "متوسط",
    "modes.medium.desc": "إنجازات الفئة S مخفية. يبقى العلم والصورة والفرق.",
    "modes.hard.tag": "بدون علم",
    "modes.hard.name": "صعب",
    "modes.hard.desc": "الجنسية مخفية. تعتمد على الإنجازات والفرق فقط.",
    "modes.extreme.tag": "فريقان كحد أقصى",
    "modes.extreme.name": "متطرف",
    "modes.extreme.desc": "فريقان كحد أقصى، وبدون إنجازات. للمخضرمين فقط.",
    "modes.timer.tag": "ضد الساعة",
    "modes.timer.name": "مؤقت",
    "modes.timer.desc": "كل الأدلة، لكن الوقت يمر. اجتز القائمة بأسرع ما يمكن.",

    "modes.earnings.aria": "عدد اللاعبين",
    "modes.earnings.name": "ترتيب الأرباح",
    "modes.earnings.desc": "لا أدلة سوى الوجه واللقب. رتب المجموعة من الأعلى إلى الأدنى في أرباح المسيرة.",
    "modes.era.aria": "حقبة المسيرة",
    "modes.era.before": "قبل",
    "modes.era.after": "بعد",
    "modes.era.name": "حقبة المسيرة",
    "modes.era.desc": "كل الأدلة المعتادة، لكن القائمة مقتصرة على اللاعبين النشطين قبل أو بعد الموسم X من RLCS.",
    "modes.era.beforeLabel": "قبل الموسم X",
    "modes.era.afterLabel": "بعد الموسم X",
    "modes.region.aria": "المنطقة التنافسية",
    "modes.region.name": "المشهد الإقليمي",
    "modes.region.desc": "نفس الأدلة كالكلاسيكي، لكن القائمة مقتصرة على اللاعبين المتنافسين حاليًا في منطقة واحدة.",
    "modes.quickten.tag": "10 لاعبين",
    "modes.quickten.name": "العشرة السريعة",
    "modes.quickten.desc": "نفس الأدلة كالكلاسيكي، لكن جولة قصيرة من 10 لاعبين عشوائيين — ثم ملخص ومجموعة جديدة.",
    "modes.lan.aria": "حدث LAN",
    "modes.lan.name": "قائمة LAN",
    "modes.lan.desc": "نفس الأدلة كالكلاسيكي، لكن القائمة مقتصرة على كل من — 3v3، 1v1، 2v2 — نافس في LAN واحدة.",

    "regions.europe": "أوروبا",
    "regions.northAmerica": "أمريكا الشمالية",
    "regions.southAmerica": "أمريكا الجنوبية",
    "regions.mena": "الشرق الأوسط وشمال أفريقيا",
    "regions.ssa": "أفريقيا جنوب الصحراء",
    "regions.asiaPacific": "آسيا والمحيط الهادئ",
    "regions.oceania": "أوقيانوسيا",

    "hub.footer.disclaimer": "موقع للمعجبين، غير تابع بأي شكل من الأشكال لـ Psyonix أو Epic Games. Rocket League علامة تجارية لـ Psyonix LLC.",
    "hub.footer.data": "بيانات وإنجازات اللاعبين: <a href=\"https://liquipedia.net/rocketleague/\" target=\"_blank\" rel=\"noopener noreferrer\">Liquipedia</a> — CC-BY-SA 3.0.",

    "game.btn.menu": "القائمة",
    "hud.mode": "الوضع ·",
    "hud.score": "النتيجة",
    "hud.time": "الوقت",
    "hud.perfectRounds": "جولات مثالية",

    "panel.playerInfo": "بطاقة اللاعب",
    "panel.photo": "الصورة",
    "panel.nationality": "الجنسية",
    "panel.hiddenIn": "مخفي في وضع {mode}",
    "panel.teamsJoined": "الفرق المنضم إليها",
    "panel.oldestFirst": "— الأقدم أولًا",
    "panel.cappedAt": "الحد الأقصى {n}",
    "panel.achievements": "إنجازات الفئة S",
    "panel.achievementsLocked": "الإنجازات غير متوفرة في وضع {mode}",

    "panel.answer.title": "إجابتك",
    "panel.answer.lede": "اكتب لقب اللاعب، ثم أكد.",
    "panel.answer.placeholder": "لقب اللاعب…",
    "panel.answer.confirm": "تأكيد",
    "panel.answer.skip": "لا أعرف",
    "panel.answer.next": "اللاعب التالي",
    "panel.answer.correct": "إجابة صحيحة",
    "panel.answer.was": "الإجابة كانت",

    "clues.title": "الأدلة",
    "clues.flag": "العلم",
    "clues.titles": "الألقاب",
    "clues.allTeams": "كل الفرق",
    "clues.nTeams": "{n} فرق",
    "clues.photo": "الصورة · كشف",

    "chips.team.one": "فريق واحد",
    "chips.team.other": "{n} فرق",
    "chips.title.one": "لقب واحد",
    "chips.title.other": "{n} ألقاب",
    "chips.noTitle": "لا ألقاب",
    "chips.achievementsHidden": "الإنجازات مخفية",

    "list.noTitle": "لا يوجد لقب من الفئة S",

    "rank.roundLabel": "الجولة {n}",
    "rank.panelTitle": "الترتيب حسب أرباح المسيرة",
    "rank.lede": "انقر على اللاعبين بالترتيب — <strong>الأعلى أرباحًا في المسيرة أولًا</strong>.",
    "rank.reset": "إعادة التعيين",
    "rank.next": "جولة جديدة",

    "end.congrats": "تهانينا!",
    "end.complete": "اكتملت الجولة",
    "end.foundAll": "لقد وجدت كل لاعب في وضع {mode}.",
    "end.foundNone": "لم تجد أي لاعب في وضع {mode} هذه المرة.",
    "end.foundSome": "لقد وجدت {n} من {m} لاعبين في وضع {mode}.",
    "end.finalScore": "النتيجة النهائية",
    "end.finalTime": "الوقت النهائي",
    "end.playAgain": "العب مجددًا",
    "end.menu": "القائمة",

    "status.loading": "جاري تحميل اللاعبين…",
    "status.stillLoading": "لا يزال يجري تحميل بيانات اللاعبين — حاول مرة أخرى بعد ثانية.",
    "status.loadError": "تعذر تحميل بيانات اللاعبين. قدم هذا المجلد عبر HTTP بدلاً من فتح <code>index.html</code> مباشرة — المتصفحات تحظر طلبات بيانات <code>file://</code>. مثال: <code>npx serve .</code>",
    "status.notEnoughEarnings": "عدد اللاعبين ذوي بيانات الأرباح غير كافٍ — أعد إنشاء players.json مع حقل الأرباح (انظر tools/build_data.py) للعب هذا الوضع.",
    "status.noPeriodPlayers": "لم يتم العثور على لاعبين لهذه الفترة — أعد إنشاء players.json مع firstSTierDate/lastSTierDate (انظر tools/build_data.py) للعب هذا الوضع.",
    "status.noRegionPlayers": "لم يتم العثور على لاعبين لهذه المنطقة — أعد إنشاء players.json مع حقل المنطقة (انظر tools/build_data.py) للعب هذا الوضع.",
    "status.noLanPlayers": "لم يتم العثور على لاعبين لهذه الـ LAN — أعد إنشاء players.json/lans.json (انظر tools/build_data.py) للعب هذا الوضع.",
    "status.loadingLan": "جاري تحميل بيانات LAN — حاول مرة أخرى بعد ثانية.",

    "misc.unknown": "غير معروف",
    "misc.flagAlt": "علم {country}"
  },

  // ------------------------------------------------------------
  // ES — espagnol
  // ------------------------------------------------------------
  es: {
    "meta.title": "RLGuessr — Adivina al pro de Rocket League",

    "lang.title": "Idioma",

    "hub.brand.label": "Juego de adivinanzas de Rocket League",
    "hub.hero.lede": "Adivina a los jugadores pros de Rocket League a partir de sus pistas: nacionalidad, logros S-Tier y los equipos a los que se unieron. Cinco modos, del más indulgente al más despiadado.",
    "hub.section.modes": "Elige tu modo",
    "hub.section.specials": "Especiales",
    "hub.specials.note": "Minijuegos experimentales — todavía decidiendo cuáles se quedan.",

    "modes.classic.tag": "Todas las pistas",
    "modes.classic.name": "Clásico",
    "modes.classic.desc": "El modo estándar. Se muestran la bandera, la foto, los logros S-tier y todos los equipos.",
    "modes.medium.tag": "Sin logros",
    "modes.medium.name": "Medio",
    "modes.medium.desc": "Los logros S-tier están ocultos. Quedan la bandera, la foto y los equipos.",
    "modes.hard.tag": "Sin bandera",
    "modes.hard.name": "Difícil",
    "modes.hard.desc": "La nacionalidad está oculta. Juegas solo con los logros y los equipos.",
    "modes.extreme.tag": "2 equipos máx.",
    "modes.extreme.name": "Extremo",
    "modes.extreme.desc": "Dos equipos como máximo, y sin logros. Solo para veteranos.",
    "modes.timer.tag": "Contra el reloj",
    "modes.timer.name": "Cronómetro",
    "modes.timer.desc": "Todas las pistas, pero el reloj corre. Despeja la lista lo más rápido posible.",

    "modes.earnings.aria": "Número de jugadores",
    "modes.earnings.name": "Ranking de ganancias",
    "modes.earnings.desc": "Sin pistas más allá de la cara y el apodo. Clasifica al grupo de mayores a menores ganancias en la carrera.",
    "modes.era.aria": "Período de carrera",
    "modes.era.before": "Antes",
    "modes.era.after": "Después",
    "modes.era.name": "Era de carrera",
    "modes.era.desc": "Todas las pistas habituales, pero la lista se reduce a jugadores activos antes o después de la Temporada X de RLCS.",
    "modes.era.beforeLabel": "Antes de la Temporada X",
    "modes.era.afterLabel": "Después de la Temporada X",
    "modes.region.aria": "Región competitiva",
    "modes.region.name": "Escena regional",
    "modes.region.desc": "Las mismas pistas que Clásico, pero la lista se reduce a jugadores actualmente compitiendo en una región.",
    "modes.quickten.tag": "10 jugadores",
    "modes.quickten.name": "Diez Rápidos",
    "modes.quickten.desc": "Las mismas pistas que Clásico, pero una tanda corta de 10 jugadores aleatorios — luego un resumen y una nueva selección.",
    "modes.lan.aria": "Evento LAN",
    "modes.lan.name": "Roster LAN",
    "modes.lan.desc": "Las mismas pistas que Clásico, pero la lista se reduce a todos — 3v3, 1v1, 2v2 — que compitieron en una LAN.",

    "regions.europe": "Europa",
    "regions.northAmerica": "Norteamérica",
    "regions.southAmerica": "Sudamérica",
    "regions.mena": "MENA",
    "regions.ssa": "África subsahariana",
    "regions.asiaPacific": "Asia-Pacífico",
    "regions.oceania": "Oceanía",

    "hub.footer.disclaimer": "Sitio de fans, sin ninguna afiliación con Psyonix o Epic Games. Rocket League es una marca registrada de Psyonix LLC.",
    "hub.footer.data": "Datos y logros de jugadores: <a href=\"https://liquipedia.net/rocketleague/\" target=\"_blank\" rel=\"noopener noreferrer\">Liquipedia</a> — CC-BY-SA 3.0.",

    "game.btn.menu": "Menú",
    "hud.mode": "Modo ·",
    "hud.score": "Puntuación",
    "hud.time": "Tiempo",
    "hud.perfectRounds": "Rondas perfectas",

    "panel.playerInfo": "Ficha del jugador",
    "panel.photo": "Foto",
    "panel.nationality": "Nacionalidad",
    "panel.hiddenIn": "Oculto en modo {mode}",
    "panel.teamsJoined": "Equipos unidos",
    "panel.oldestFirst": "— más antiguos primero",
    "panel.cappedAt": "Limitado a {n}",
    "panel.achievements": "Logros S-Tier",
    "panel.achievementsLocked": "Logros no disponibles en modo {mode}",

    "panel.answer.title": "Tu respuesta",
    "panel.answer.lede": "Escribe el apodo del jugador y confirma.",
    "panel.answer.placeholder": "Apodo del jugador…",
    "panel.answer.confirm": "Confirmar",
    "panel.answer.skip": "No lo sé",
    "panel.answer.next": "Siguiente jugador",
    "panel.answer.correct": "Respuesta correcta",
    "panel.answer.was": "La respuesta era",

    "clues.title": "Pistas",
    "clues.flag": "Bandera",
    "clues.titles": "Títulos",
    "clues.allTeams": "Todos los equipos",
    "clues.nTeams": "{n} equipos",
    "clues.photo": "Foto · revelación",

    "chips.team.one": "{n} equipo",
    "chips.team.other": "{n} equipos",
    "chips.title.one": "{n} título",
    "chips.title.other": "{n} títulos",
    "chips.noTitle": "Sin título",
    "chips.achievementsHidden": "Logros ocultos",

    "list.noTitle": "Sin título S-tier",

    "rank.roundLabel": "Ronda {n}",
    "rank.panelTitle": "Clasificar por ganancias en carrera",
    "rank.lede": "Toca a los jugadores en orden — <strong>mayores ganancias en carrera primero</strong>.",
    "rank.reset": "Reiniciar selección",
    "rank.next": "Nueva ronda",

    "end.congrats": "¡Felicidades!",
    "end.complete": "Ronda completada",
    "end.foundAll": "Encontraste a todos los jugadores en modo {mode}.",
    "end.foundNone": "No encontraste a ningún jugador en modo {mode} esta vez.",
    "end.foundSome": "Encontraste a {n} de {m} jugadores en modo {mode}.",
    "end.finalScore": "Puntuación final",
    "end.finalTime": "Tiempo final",
    "end.playAgain": "Jugar de nuevo",
    "end.menu": "Menú",

    "status.loading": "Cargando jugadores…",
    "status.stillLoading": "Aún cargando los datos de los jugadores — inténtalo de nuevo en un segundo.",
    "status.loadError": "No se pudieron cargar los datos. Sirve esta carpeta por HTTP en lugar de abrir <code>index.html</code> directamente — los navegadores bloquean las solicitudes de datos <code>file://</code>. Por ejemplo: <code>npx serve .</code>",
    "status.notEnoughEarnings": "No hay suficientes jugadores con datos de ganancias — regenera players.json con el campo earnings (ver tools/build_data.py) para jugar este modo.",
    "status.noPeriodPlayers": "No se encontraron jugadores para este período — regenera players.json con firstSTierDate/lastSTierDate (ver tools/build_data.py) para jugar este modo.",
    "status.noRegionPlayers": "No se encontraron jugadores para esta región — regenera players.json con el campo region (ver tools/build_data.py) para jugar este modo.",
    "status.noLanPlayers": "No se encontraron jugadores para esta LAN — regenera players.json/lans.json (ver tools/build_data.py) para jugar este modo.",
    "status.loadingLan": "Aún cargando los datos de LAN — inténtalo de nuevo en un segundo.",

    "misc.unknown": "Desconocido",
    "misc.flagAlt": "Bandera de {country}"
  },

  // ------------------------------------------------------------
  // DE — allemand
  // ------------------------------------------------------------
  de: {
    "meta.title": "RLGuessr — Errate den Rocket-League-Profi",

    "lang.title": "Sprache",

    "hub.brand.label": "Rocket-League-Rate­spiel",
    "hub.hero.lede": "Errate Rocket-League-Profis anhand ihrer Hinweise: Nationalität, S-Tier-Erfolge und die Teams, denen sie beigetreten sind. Fünf Modi, vom nachsichtigsten bis zum gnadenlosesten.",
    "hub.section.modes": "Wähle deinen Modus",
    "hub.section.specials": "Spezialmodi",
    "hub.specials.note": "Experimentelle Mini-Spiele — wir entscheiden noch, welche bleiben.",

    "modes.classic.tag": "Alle Hinweise",
    "modes.classic.name": "Klassisch",
    "modes.classic.desc": "Der Standardmodus. Flagge, Foto, S-Tier-Erfolge und alle Teams werden angezeigt.",
    "modes.medium.tag": "Ohne Erfolge",
    "modes.medium.name": "Mittel",
    "modes.medium.desc": "S-Tier-Erfolge sind verborgen. Die Flagge, das Foto und die Teams bleiben.",
    "modes.hard.tag": "Ohne Flagge",
    "modes.hard.name": "Schwer",
    "modes.hard.desc": "Die Nationalität ist verborgen. Du spielst nur mit Erfolgen und Teams.",
    "modes.extreme.tag": "Max. 2 Teams",
    "modes.extreme.name": "Extrem",
    "modes.extreme.desc": "Höchstens zwei Teams angezeigt, und keine Erfolge. Nur für Veteranen.",
    "modes.timer.tag": "Gegen die Uhr",
    "modes.timer.name": "Timer",
    "modes.timer.desc": "Alle Hinweise, aber die Uhr läuft. Arbeite die Liste so schnell wie möglich ab.",

    "modes.earnings.aria": "Anzahl der Spieler",
    "modes.earnings.name": "Preisgeld-Rangliste",
    "modes.earnings.desc": "Keine Hinweise außer Gesicht und Tag. Ordne die Gruppe vom höchsten zum niedrigsten Karriere-Preisgeld.",
    "modes.era.aria": "Karrierezeit",
    "modes.era.before": "Vorher",
    "modes.era.after": "Danach",
    "modes.era.name": "Karriere-Ära",
    "modes.era.desc": "Alle üblichen Hinweise, aber die Liste ist auf Spieler beschränkt, die vor oder nach RLCS-Saison X aktiv waren.",
    "modes.era.beforeLabel": "Vor Saison X",
    "modes.era.afterLabel": "Nach Saison X",
    "modes.region.aria": "Wettkampfregion",
    "modes.region.name": "Regionale Szene",
    "modes.region.desc": "Gleiche Hinweise wie Klassisch, aber die Liste ist auf Spieler beschränkt, die derzeit in einer Region antreten.",
    "modes.quickten.tag": "10 Spieler",
    "modes.quickten.name": "Schnelle Zehn",
    "modes.quickten.desc": "Gleiche Hinweise wie Klassisch, aber eine kurze Runde mit 10 zufälligen Spielern — danach eine Zusammenfassung und ein neuer Satz.",
    "modes.lan.aria": "LAN-Event",
    "modes.lan.name": "LAN-Roster",
    "modes.lan.desc": "Gleiche Hinweise wie Klassisch, aber die Liste ist auf alle beschränkt — 3v3, 1v1, 2v2 — die auf einer LAN angetreten sind.",

    "regions.europe": "Europa",
    "regions.northAmerica": "Nordamerika",
    "regions.southAmerica": "Südamerika",
    "regions.mena": "MENA",
    "regions.ssa": "Subsahara-Afrika",
    "regions.asiaPacific": "Asien-Pazifik",
    "regions.oceania": "Ozeanien",

    "hub.footer.disclaimer": "Fanseite, in keiner Weise mit Psyonix oder Epic Games verbunden. Rocket League ist eine Marke von Psyonix LLC.",
    "hub.footer.data": "Spielerdaten und Erfolge: <a href=\"https://liquipedia.net/rocketleague/\" target=\"_blank\" rel=\"noopener noreferrer\">Liquipedia</a> — CC-BY-SA 3.0.",

    "game.btn.menu": "Menü",
    "hud.mode": "Modus ·",
    "hud.score": "Punktzahl",
    "hud.time": "Zeit",
    "hud.perfectRounds": "Perfekte Runden",

    "panel.playerInfo": "Spielerkarte",
    "panel.photo": "Foto",
    "panel.nationality": "Nationalität",
    "panel.hiddenIn": "Verborgen im {mode}-Modus",
    "panel.teamsJoined": "Beigetretene Teams",
    "panel.oldestFirst": "— älteste zuerst",
    "panel.cappedAt": "Begrenzt auf {n}",
    "panel.achievements": "S-Tier-Erfolge",
    "panel.achievementsLocked": "Erfolge im {mode}-Modus nicht verfügbar",

    "panel.answer.title": "Deine Antwort",
    "panel.answer.lede": "Gib den Tag des Spielers ein und bestätige.",
    "panel.answer.placeholder": "Spieler-Tag…",
    "panel.answer.confirm": "Bestätigen",
    "panel.answer.skip": "Ich weiß es nicht",
    "panel.answer.next": "Nächster Spieler",
    "panel.answer.correct": "Richtige Antwort",
    "panel.answer.was": "Die Antwort war",

    "clues.title": "Hinweise",
    "clues.flag": "Flagge",
    "clues.titles": "Titel",
    "clues.allTeams": "Alle Teams",
    "clues.nTeams": "{n} Teams",
    "clues.photo": "Foto · aufdecken",

    "chips.team.one": "{n} Team",
    "chips.team.other": "{n} Teams",
    "chips.title.one": "{n} Titel",
    "chips.title.other": "{n} Titel",
    "chips.noTitle": "Kein Titel",
    "chips.achievementsHidden": "Erfolge verborgen",

    "list.noTitle": "Kein S-Tier-Titel",

    "rank.roundLabel": "Runde {n}",
    "rank.panelTitle": "Nach Karriere-Preisgeld ordnen",
    "rank.lede": "Tippe die Spieler in der Reihenfolge an — <strong>höchstes Karriere-Preisgeld zuerst</strong>.",
    "rank.reset": "Auswahl zurücksetzen",
    "rank.next": "Neue Runde",

    "end.congrats": "Glückwunsch!",
    "end.complete": "Runde abgeschlossen",
    "end.foundAll": "Du hast im {mode}-Modus jeden Spieler gefunden.",
    "end.foundNone": "Du hast diesmal im {mode}-Modus keinen Spieler gefunden.",
    "end.foundSome": "Du hast im {mode}-Modus {n} von {m} Spielern gefunden.",
    "end.finalScore": "Endpunktzahl",
    "end.finalTime": "Endzeit",
    "end.playAgain": "Nochmal spielen",
    "end.menu": "Menü",

    "status.loading": "Spieler werden geladen…",
    "status.stillLoading": "Spielerdaten werden noch geladen — versuche es in einer Sekunde erneut.",
    "status.loadError": "Spielerdaten konnten nicht geladen werden. Serviere diesen Ordner über HTTP, statt <code>index.html</code> direkt zu öffnen — Browser blockieren <code>file://</code>-Datenanfragen. Zum Beispiel: <code>npx serve .</code>",
    "status.notEnoughEarnings": "Nicht genug Spieler mit Preisgeld-Daten — regeneriere players.json mit dem earnings-Feld (siehe tools/build_data.py), um diesen Modus zu spielen.",
    "status.noPeriodPlayers": "Keine Spieler für diesen Zeitraum gefunden — regeneriere players.json mit firstSTierDate/lastSTierDate (siehe tools/build_data.py), um diesen Modus zu spielen.",
    "status.noRegionPlayers": "Keine Spieler für diese Region gefunden — regeneriere players.json mit dem region-Feld (siehe tools/build_data.py), um diesen Modus zu spielen.",
    "status.noLanPlayers": "Keine Spieler für diese LAN gefunden — regeneriere players.json/lans.json (siehe tools/build_data.py), um diesen Modus zu spielen.",
    "status.loadingLan": "LAN-Daten werden noch geladen — versuche es in einer Sekunde erneut.",

    "misc.unknown": "Unbekannt",
    "misc.flagAlt": "Flagge {country}"
  }
};

// ============================================================
// Moteur d'application
// ============================================================
let currentLang = "en";

function detectInitialLanguage() {
  try {
    const saved = localStorage.getItem("rlguessr.lang");
    if (saved && I18N[saved]) return saved;
  } catch (e) {
    // localStorage bloqué (mode privé strict, iframe cross-origin, ...) :
    // pas grave, on retombe simplement sur l'anglais par défaut.
  }
  return "en";
}

// t("key", {name: "..."}) — remplace {name} par la valeur fournie.
// Une clé absente de la langue courante retombe sur l'anglais, puis
// sur la clé littérale (lisible dans le pire cas plutôt qu'une chaîne
// vide qui casserait silencieusement une étiquette).
function t(key, params) {
  const table = I18N[currentLang] || I18N.en;
  let value = table[key];
  if (value === undefined) value = I18N.en[key];
  if (value === undefined) return key;
  if (!params) return value;
  return value.replace(/\{(\w+)\}/g, (_, name) =>
    Object.prototype.hasOwnProperty.call(params, name) ? params[name] : "{" + name + "}"
  );
}

// Chips "1 team" / "2 teams" : le pluriel dépend de la langue mais on n'a
// besoin que d'un cas singulier vs pluriel pour ces libellés — pas de
// besoin d'Intl.PluralRules ici (l'arabe a des règles plus riches, mais
// pour "1 vs plusieurs" les deux formes suffisent).
function tPlural(key, count) {
  return t(count === 1 ? `${key}.one` : `${key}.other`, { n: count });
}

function currentLanguage() {
  return currentLang;
}

// Applique les traductions à tous les éléments statiques du DOM.
// Attributs supportés :
//   data-i18n           -> textContent
//   data-i18n-html      -> innerHTML (pour les libellés contenant un <a>, <strong>, etc.)
//   data-i18n-placeholder / -title / -aria-label / -alt -> attribut correspondant
// Les éléments dynamiques (fiches joueur, écran de fin, tuiles d'équipe...)
// sont retraduits par script.js sur l'event `rlg-lang-changed`.
function applyStaticTranslations() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-html]").forEach(el => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    el.setAttribute("placeholder", t(el.dataset.i18nPlaceholder));
  });
  document.querySelectorAll("[data-i18n-title]").forEach(el => {
    el.setAttribute("title", t(el.dataset.i18nTitle));
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach(el => {
    el.setAttribute("aria-label", t(el.dataset.i18nAriaLabel));
  });
  document.querySelectorAll("[data-i18n-alt]").forEach(el => {
    el.setAttribute("alt", t(el.dataset.i18nAlt));
  });
  const titleKey = document.documentElement.dataset.i18nTitle;
  if (titleKey) document.title = t(titleKey);
}

// Bascule la langue globale, met à jour <html lang>/<html dir>, retraduit
// le DOM statique, puis émet `rlg-lang-changed` pour que script.js
// reconstruise les parties dynamiques (fiche joueur en cours, dropdowns
// de modes, écran de fin en cours d'affichage...).
function setLanguage(code) {
  if (!I18N[code]) return;
  currentLang = code;
  try {
    localStorage.setItem("rlguessr.lang", code);
  } catch (e) {
    // Idem detectInitialLanguage() : localStorage bloqué, on laisse tomber.
  }
  document.documentElement.lang = code;
  document.documentElement.dir = RTL_LANGUAGES.has(code) ? "rtl" : "ltr";
  applyStaticTranslations();
  document.dispatchEvent(new CustomEvent("rlg-lang-changed", { detail: { lang: code } }));
}

// Init immédiat : le fichier est chargé en fin de <body>, donc le DOM
// statique est déjà là. On lit la préférence sauvegardée et on l'applique
// avant que script.js commence à peupler quoi que ce soit.
currentLang = detectInitialLanguage();
document.documentElement.lang = currentLang;
document.documentElement.dir = RTL_LANGUAGES.has(currentLang) ? "rtl" : "ltr";
applyStaticTranslations();
