export const LOCALE_COOKIE = "filazo-locale";

export const supportedLocales = ["en", "pt-BR"] as const;

export type Locale = (typeof supportedLocales)[number];

export const defaultLocale: Locale = "en";

const messages = {
  en: {
    "common.home": "Home",
    "common.library": "Library",
    "common.catalog": "Catalog",
    "common.tonight": "Tonight",
    "common.player": "Player",
    "common.search": "Search",
    "common.all": "All",
    "common.backHome": "Back home",
    "common.addGames": "Add games",
    "common.connected": "connected",
    "common.readyWhenYouAre": "Ready when you are",
    "common.anyPlatform": "Any platform",
    "common.listView": "List view",
    "common.gridView": "Grid view",
    "common.chooseGame": "Choose a game",
    "common.clearAll": "Clear all",
    "common.skipToContent": "Skip to content",
    "common.playtimeSoFar": "{value} so far",

    "nav.main": "Main",
    "nav.footer": "Footer",
    "nav.profileSections": "Profile sections",

    "locale.label": "Language",
    "locale.en": "EN",
    "locale.pt-BR": "PT-BR",
    "locale.english": "English",
    "locale.portugueseBrazil": "Portuguese (Brazil)",

    "theme.label": "Theme",
    "theme.day": "Day",
    "theme.night": "Night",
    "theme.dayLabel": "Day - browse the catalog",
    "theme.nightLabel": "Night - pick something to play",

    "auth.trigger.signIn": "Sign in",
    "auth.dialog.account": "filazo account",
    "auth.dialog.title": "Start your game journey",
    "auth.dialog.close": "Close login",
    "auth.dialog.createAccount": "Create account",
    "auth.dialog.signIn": "Sign in",
    "auth.dialog.name": "Name",
    "auth.dialog.email": "E-mail",
    "auth.dialog.password": "Password",
    "auth.dialog.confirmPassword": "Confirm password",
    "auth.dialog.namePlaceholder": "Type your name",
    "auth.dialog.emailPlaceholder": "Type your email",
    "auth.dialog.passwordPlaceholder": "Type your password",
    "auth.dialog.confirmPasswordPlaceholder": "Repeat your password",
    "auth.dialog.hidePassword": "Hide password",
    "auth.dialog.showPassword": "Show password",
    "auth.dialog.termsPrefix": "I agree to the",
    "auth.dialog.terms": "Terms of Service",
    "auth.dialog.privacy": "Privacy Policy",
    "auth.dialog.or": "or",
    "auth.dialog.google": "Continue with Google",
    "auth.dialog.registrationClosed":
      "Public registrations are closed. If you do not have an account yet, request access through the beta tester signup.",
    "auth.dialog.requestBeta": "Request beta access",
    "auth.signOut": "Sign out",

    "auth.error.invalidEmailOrPassword":
      "Use a valid email and a password with at least 8 characters.",
    "auth.error.noPasswordAccount":
      "No filazo password account exists for that email.",
    "auth.error.emailPasswordMismatch": "Email or password did not match.",
    "auth.error.displayNameLength":
      "Choose a profile name with 2 to 48 characters.",
    "auth.error.passwordConfirmation":
      "Password confirmation did not match.",
    "auth.error.acceptTerms": "Accept the terms before creating an account.",
    "auth.error.accountExists":
      "A filazo account already exists for that email.",
    "auth.error.registrationClosed":
      "Public registrations are closed. Request access through the beta signup.",
    "auth.error.googleRegistrationClosed":
      "Public registrations are closed. Use the beta tester signup.",
    "auth.error.steamRegistrationClosed":
      "Public registrations are closed. Request beta access before connecting Steam.",
    "auth.error.xboxRegistrationClosed":
      "Public registrations are closed. Request beta access before connecting Xbox.",
    "auth.error.youtubeStartFailed": "Could not start YouTube login.",
    "auth.error.youtubeMissingCode":
      "YouTube did not return an authorization code.",
    "auth.error.youtubeStateInvalid": "Could not verify YouTube login.",
    "auth.error.youtubeCallbackFailed": "Could not finish YouTube login.",

    "landing.notice.database":
      "{message} Vercel deployments need a production database connection; this repo's SQLite file setup is intended for local development.",
    "landing.kicker": "Calm library for large game collections",
    "landing.title": "Your game backlog\ndoesn't need to be stressful.",
    "landing.body":
      "filazo brings your game lists into one calm library, then keeps tonight's choice close at hand.",
    "landing.openTonight": "Open tonight",
    "landing.openLibrary": "Open library",
    "landing.indexedCount":
      "{count} games indexed here. Browse, sort, or leave them waiting.",
    "landing.howItWorks": "How it works",
    "landing.step1Title": "Bring games in",
    "landing.step1Body":
      "Connect a source or upload a CSV when you want to fill the shelf.",
    "landing.step2Title": "Keep one clean shelf",
    "landing.step2Body":
      "The same game stays together even when it came from more than one place.",
    "landing.step3Title": "Choose without pressure",
    "landing.step3Body":
      "When you want to play, filazo keeps one fitting pick nearby without turning the rest into chores.",
    "landing.catalogLabel": "The catalog",
    "landing.catalogTitle": "One library for every platform.",
    "landing.catalogBody":
      "{count} games are already indexed. These are real catalog entries with enough metadata to represent the shelf cleanly.",
    "landing.noShowcaseTitle": "No catalog showcase yet.",
    "landing.noShowcaseBody":
      "Once real catalog entries have enough metadata, they appear here automatically.",
    "landing.marker.csv": "CSV",
    "landing.marker.metadata": "Metadata",
    "landing.marker.tonight": "Tonight",
    "landing.shortReturn": "short return",
    "landing.quote":
      "A library is allowed\nto be unfinished.\nKeep it readable.\nPick what fits.",
    "landing.ctaTitle":
      "Bring your records in.\nLet the catalog stay legible.",
    "landing.ctaFoot":
      "{count} games here already carry cover art, play times, and stories.",
    "landing.catalogEntry": "catalog entry",

    "login.kicker": "filazo account",
    "login.title": "Sign in once. Keep every library connected after.",
    "login.body":
      "Sign in with an existing filazo account or a known Google account. Public registration is closed; new players can request beta access with YouTube.",
    "login.open": "Open login",

    "beta.status.pending.title": "Application sent",
    "beta.status.pending.body":
      "Your request is waiting for review. You will receive full platform access for 1 year if approved.",
    "beta.status.approved.title": "Access approved",
    "beta.status.approved.body":
      "Your beta access is active. You can use the full platform now.",
    "beta.status.rejected.title": "Application declined",
    "beta.status.rejected.body":
      "You can review your answers and submit the application again.",
    "beta.adminLoggedIn": "You are signed in as admin.",
    "beta.openAdmin": "Open admin area",
    "beta.sent": "Application received. It is now waiting for approval.",
    "beta.kicker": "Beta testers",
    "beta.title": "Apply for early filazo access",
    "beta.body":
      "Public registrations are closed. Approved beta testers receive full platform access for 1 year to test the catalog, imports, integrations, and recommendations.",
    "beta.signInYoutube": "Sign in with YouTube and request access",
    "beta.justification": "Justification: {value}",
    "beta.existingAccount":
      "This account already has platform access. Beta signup is only for new testers.",
    "beta.openPlatform": "Open platform",
    "beta.name": "Name",
    "beta.platforms": "Platforms you play on",
    "beta.retrogames": "Retrogames and other platforms",
    "beta.retrogamesPlaceholder":
      "Ex.: 3DS, Vita, Dreamcast, emulators, arcade...",
    "beta.submit": "Send application",
    "beta.error.invalidApplication":
      "Fill in your name and at least one platform.",

    "admin.restricted":
      "This area is restricted to the admin. Sign in with YouTube using ludmila.omlopes@gmail.com.",
    "admin.signInYoutube": "Sign in with YouTube",
    "admin.reviewed": "Request updated.",
    "admin.kicker": "Admin",
    "admin.title": "Beta testers",
    "admin.body":
      "Approve or decline beta tester applications. Approvals unlock full platform access for 1 year.",
    "admin.pending": "Pending",
    "admin.totalReviewable": "Reviewable total",
    "admin.status.pending": "Pending",
    "admin.status.approved": "Approved",
    "admin.status.rejected": "Declined",
    "admin.status.draft": "Draft",
    "admin.noName": "No name",
    "admin.noEmail": "no email",
    "admin.platforms": "Platforms",
    "admin.retrogames": "Retrogames",
    "admin.notInformed": "not informed",
    "admin.justification": "Justification",
    "admin.accessUntil": "Access until",
    "admin.approve": "Approve",
    "admin.reject": "Decline",
    "admin.empty": "No application has been submitted yet.",
    "admin.error.justificationRequired":
      "Justification is required to approve or decline.",

    "footer.tagline": "Your catalog, your pace.",
    "footer.madeFor": "made for players with too many games",

    "profile.signedOut.label": "Your catalog",
    "profile.signedOut.title": "Connect an account to begin.",
    "profile.signedOut.body":
      "Sign in first, then connect Steam, PlayStation, Xbox, or start with a CSV-only local profile. Start wherever feels easiest.",
    "profile.error.label": "Database unavailable",
    "profile.error.title": "Your library can't load right now.",
    "profile.error.body":
      "{message} Vercel deployments need a production database connection; this repo's SQLite file setup is intended for local development.",

    "profile.greeting.morning":
      "Good morning. The catalog is ready when you are.",
    "profile.greeting.afternoon":
      "Good afternoon. Every entry can wait.",
    "profile.greeting.evening": "Good evening. Pick one, or just browse.",
    "profile.greeting.label": "Library home",
    "profile.greeting.body":
      "{greeting} {count} games have a readable place here.",
    "profile.greeting.connectedOne": "1 source connected.",
    "profile.greeting.connectedMany": "{count} sources connected.",
    "profile.greeting.connectedNone": "No sources connected yet.",
    "profile.greeting.pickTonight": "Pick for tonight",
    "profile.greeting.browseShelf": "Browse shelf",

    "profile.rail.home": "Home",
    "profile.rail.homeHint": "What matters now",
    "profile.rail.sources": "Sources",
    "profile.rail.sourcesHint": "Add or refresh",
    "profile.rail.catalog": "Catalog",
    "profile.rail.catalogHint": "Browse every entry",
    "profile.rail.guide": "Guide",
    "profile.rail.guideHint": "Gentle suggestions",
    "profile.rail.journal": "Journal",
    "profile.rail.journalHint": "Diary pages",
    "profile.rail.setup": "Setup",
    "profile.rail.setupHint": "Preferences",
    "profile.rail.avatarAlt": "{name} avatar",
    "profile.rail.ownedCurious": "{owned} owned / {wishlist} still curious",

    "profile.addGames.label": "Add games",
    "profile.addGames.title": "Bring another shelf in",
    "profile.addGames.latestImport": "Latest import: {date}",
    "profile.addGames.sourcesTitle": "Steam, PlayStation, and Xbox",
    "profile.addGames.manageSources": "Manage sources",
    "profile.addGames.sourcesBody":
      "Connect a source once, then refresh it when you want newer playtime or recently played games.",
    "profile.addGames.connectedOne": "1 connected source",
    "profile.addGames.connectedMany": "{count} connected sources",
    "profile.addGames.fileImport": "File import",
    "profile.addGames.uploadCsv": "Upload a CSV",

    "profile.sources.label": "Sources",
    "profile.sources.title": "Add or refresh your games",
    "profile.sources.description":
      "Connect the places where you already play. Your shelf stays intact if a source is removed later.",
    "profile.sources.disconnectQuestion":
      "What happens when a source is disconnected?",
    "profile.sources.disconnectAnswer":
      "Filazo removes the account connection, but keeps the games already on your shelf.",
    "profile.sources.account": "Account",
    "profile.sources.disconnect": "Disconnect",
    "profile.sources.disconnected": "Disconnected",
    "profile.sources.notSynced": "Not synced",
    "profile.sources.synced": "Synced {date}",
    "profile.sources.tokenGuide": "How to get the token",
    "profile.sources.tokenStep1":
      "1. Sign in to PlayStation in your browser.",
    "profile.sources.tokenStep2Lead": "2. Open",
    "profile.sources.tokenStep2": "2. Open Sony's NPSSO page.",
    "profile.sources.tokenStep3":
      "3. Copy the token value from the response and paste it below. Pasting the whole response works too.",
    "profile.sources.tokenBody":
      "The token is temporary. Filazo exchanges it for a secure connection and does not keep the pasted value.",
    "profile.sources.steamTitle": "Steam library",
    "profile.sources.steamBody":
      "Bring in owned games, playtime, recently played dates, and progress.",
    "profile.sources.refreshSteam": "Refresh Steam",
    "profile.sources.refreshing": "Refreshing...",
    "profile.sources.steamPending":
      "Steam is refreshing your library. Keep this page open.",
    "profile.sources.connectSteam": "Connect Steam",
    "profile.sources.playstationTitle": "PlayStation library",
    "profile.sources.playstationBody":
      "Bring in purchased games and trophy-title history.",
    "profile.sources.refreshPlayStation": "Refresh PlayStation",
    "profile.sources.playstationPending":
      "PlayStation is refreshing your library.",
    "profile.sources.technicalStatus": "Technical status",
    "profile.sources.steamReady": "ready",
    "profile.sources.steamMissingKey": "missing key",
    "profile.sources.igdbMissingKeys": "missing keys",
    "profile.sources.connectedSecurely": "Connected token stored securely.",
    "profile.sources.npsso": "NPSSO token",
    "profile.sources.npssoPlaceholder":
      "Paste token or {\"npsso\":\"...\"}",
    "profile.sources.connectPlayStation": "Connect PlayStation",
    "profile.sources.xboxTitle": "Xbox library",
    "profile.sources.xboxBody":
      "Bring in achievement-title and recently played history.",
    "profile.sources.refreshXbox": "Refresh Xbox",
    "profile.sources.xboxPending": "Xbox is refreshing your library.",
    "profile.sources.connectXbox": "Connect Xbox",
    "profile.sources.xboxUnavailable": "Xbox unavailable",
    "profile.sources.oauthReady": "ready",
    "profile.sources.oauthMissing": "missing client ID",
    "profile.sources.csvNotice":
      "CSV uploads live on the home tab because they are one-time file imports rather than connected sources.",
    "profile.sources.connectedCount": "{count} connected",
    "profile.sources.steamApiStatus":
      "Steam API {steam} / metadata {metadata}",
    "profile.sources.oauthStatus": "OAuth {status}",

    "profile.completion.label": "Completion status",
    "profile.completion.title": "Update finished games",
    "profile.completion.body":
      "Check connected achievements and trophies for games that look complete.",
    "profile.completion.ready": "Ready",
    "profile.completion.needsSource": "Needs Steam or PlayStation",
    "profile.completion.update": "Update completion",
    "profile.completion.checking": "Checking...",
    "profile.completion.pending":
      "Checking completion status. Large libraries can take a few minutes.",
    "profile.completion.connectFirst":
      "Connect Steam or PlayStation first.",

    "profile.currentPlaying.label": "Current playing",
    "profile.currentPlaying.title": "Keep a few games close",
    "profile.currentPlaying.description":
      "Choose up to three shelf entries and pin them to the top of your overview.",
    "profile.currentPlaying.inView": "{count} of 3 in view",
    "profile.currentPlaying.spot": "Spot {slot}",
    "profile.currentPlaying.openTitle": "Open for a game",
    "profile.currentPlaying.openBody":
      "Leave this slot empty, or pick something below when you want it in view.",
    "profile.currentPlaying.suggestedLabel": "Suggested picks",
    "profile.currentPlaying.suggestedTitle": "A calm place to start",
    "profile.currentPlaying.useThese": "Use these picks",
    "profile.currentPlaying.fromProfile": "From your profile",
    "profile.currentPlaying.fromShelf": "From your shelf",
    "profile.currentPlaying.howChosen": "How these picks were chosen",
    "profile.currentPlaying.howChosenBody":
      "Saved player-profile recommendations come first when they exist. Remaining spots fall back to unfinished shelf entries with signals like playing status, recent activity, favorites, playtime, and shared review score. These suggestions come from your own catalog, not live web research.",
    "profile.currentPlaying.emptyTitle": "Nothing is pinned right now.",
    "profile.currentPlaying.emptyBody":
      "Pick up to three games to keep your current rotation visible at a glance.",
    "profile.currentPlaying.chooseChange":
      "Choose or change your three picks",
    "profile.currentPlaying.choose": "Choose your three picks",
    "profile.currentPlaying.leaveOpen": "Leave this open",
    "profile.currentPlaying.save": "Save current playing",
    "profile.currentPlaying.saving": "Saving...",
    "profile.currentPlaying.fillOpenSpots": "Fill open spots",
    "profile.currentPlaying.help":
      "Leave any slot empty to clear it. You can feature fewer than three games if that feels better.",
    "profile.currentPlaying.reason.playing":
      "Already marked as playing now, so it belongs near the top.",
    "profile.currentPlaying.reason.recent":
      "You touched it recently, which makes it a natural keep-in-view pick.",
    "profile.currentPlaying.reason.favorite":
      "It is one of your favorites and still has room to come back into focus.",
    "profile.currentPlaying.reason.playtime":
      "You already have time in it, which makes it a gentle return candidate.",
    "profile.currentPlaying.reason.default":
      "A steady unfinished pick from your own shelf.",

    "profile.favorites.label": "Favorites",
    "profile.favorites.title": "Games you love",
    "profile.favorites.keptClose": "{count} kept close",
    "profile.favorites.emptyTitle": "No favorites yet, and that is fine.",
    "profile.favorites.emptyBody":
      "Tap the heart on any game whenever one feels special.",

    "profile.shelf.label": "Shelf",
    "profile.shelf.title": "Your games",
    "profile.shelf.description":
      "Search first. Filters are tucked away when you need a narrower view.",
    "profile.shelf.searchPlaceholder": "Search your catalog",
    "profile.shelf.clearGuideFilter": "Clear guide filter: {label}",
    "profile.shelf.filterSort": "Filter and sort",
    "profile.shelf.newest": "Newest",
    "profile.shelf.playtime": "Playtime",
    "profile.shelf.titleSort": "Title",
    "profile.shelf.emptyTitle": "Your shelf is ready. Bring some games over.",
    "profile.shelf.emptyBody":
      "Sync a platform or import a CSV, then the catalog becomes browsable.",
    "profile.shelf.gameCount": "{count} games",
    "profile.shelf.gameCountOne": "1 game",

    "csv.chooseFile": "Choose a CSV file",
    "csv.helper":
      "Filazo will read the columns it recognizes and show you a preview before anything is added.",
    "csv.error": "This CSV did not open cleanly.",
    "csv.origin": "Where did this file come from?",
    "csv.generic": "Generic CSV",
    "csv.playstation": "PlayStation CSV",
    "csv.xbox": "Xbox CSV",
    "csv.titleColumn": "Game title column",
    "csv.titlePrompt": "Choose the title column",
    "csv.adjustOptional": "Adjust optional columns",
    "csv.skipField": "Skip this",
    "csv.preview": "Preview",
    "csv.sourceRows":
      "These rows will be treated as {source} games when a matching identifier is present.",
    "csv.noPlatform": "No platform",
    "csv.noProgress": "No progress",
    "csv.choosePreview": "Choose the title column to preview the rows.",
    "csv.import": "Import games",
    "csv.field.title": "Title",
    "csv.field.platform": "Platform",
    "csv.field.status": "Status",
    "csv.field.playtime": "Hours Played",
    "csv.field.completion": "Achievement %",
    "csv.field.notes": "Notes",
    "csv.field.externalId": "External ID",

    "favorite.addTitle": "Add {name} to favorites",
    "favorite.removeTitle": "Remove {name} from favorites",
    "favorite.add": "Add favorite",
    "favorite.current": "Favorite",

    "game.breadcrumb": "Breadcrumb",
    "game.coverAlt": "Cover art for {name}",
    "game.entryLabel": "Catalog entry",
    "game.relationship": "Your relationship with this game",
    "game.placeOnShelf": "Place on shelf",
    "game.recordedPlaytime": "Recorded playtime",
    "game.usualCredits": "Usual credits",
    "game.creditsAround":
      "Most players see credits around {value}.",
    "game.creditsRolled":
      "Credits rolled {date}. This is separate from achievement collecting.",
    "game.achievementSignals":
      "Some achievement signals are on the record, but credits are not marked yet.",
    "game.stillCurious":
      "Still curious. Keep it close until the moment feels right.",
    "game.notMarked":
      "The story has not been marked as credits rolled yet.",
    "game.unmarkCredits": "Unmark credits rolled",
    "game.markCredits": "Mark credits rolled",
    "game.markDropped": "Mark dropped",
    "game.returnToShelf": "Return to shelf",
    "game.released": "Released from the active shelf.",
    "game.releasedOn": "Released from the active shelf {date}.",
    "game.catalogNote": "Catalog note",
    "game.whatRemembers": "What this one remembers",
    "game.reception": "Reception",
    "game.noteNotGrade": "A note, not a grade",
    "game.criticsSaid": "Critics said: {score} - {label}.",
    "game.timeEstimates": "Time estimates",
    "game.playerGuide": "Player guide notes",
    "game.creditsRoll": "credits roll",
    "game.tookTheirTime": "took their time",
    "game.sawEverything": "saw everything",
    "game.photoPrints": "Photo prints",
    "game.fewScenes": "A few scenes from the guide",
    "game.opensLightbox": "Opens in a lightbox",
    "game.whereLives": "Where it lives",
    "game.otherEntries": "Other entries",
    "game.nearbyShelves": "How it sits on nearby shelves",
    "game.entryCountOne": "1 entry",
    "game.entryCountMany": "{count} entries",
    "game.backToCatalog": "Back to catalog",
    "game.noPlaytimeData": "No playtime data",
    "game.notFound": "Game not found | filazo",
    "game.metadataFallback":
      "A filazo memory-card page for {name}, with library context and guide notes.",
    "game.reception.beloved": "beloved",
    "game.reception.strong": "strong reception",
    "game.reception.mixed": "mixed but noticed",
    "game.reception.quiet": "a quieter reception",

    "routeError.label": "Save room paused",
    "routeError.title": "Something jammed.",
    "routeError.body":
      "Your library is safe. Try again, or step back to the shelf for a moment.",
    "routeError.retry": "Try again",
    "routeError.backShelf": "Back to the shelf",

    "tonight.mood.short": "something short",
    "tonight.mood.cozy": "something cozy",
    "tonight.mood.gripping": "something gripping",
    "tonight.mood.oldSave": "back to an old save",
    "tonight.mood.surprise": "surprise me",
    "tonight.emptyTitle": "No evening pick yet.",
    "tonight.emptyBody":
      "Add a few games to your catalog, then come back when the room is dim.",
    "tonight.addCatalog": "Add games to the catalog",
    "tonight.dimLights": "Dim the lights?",
    "tonight.nightMode": "Night Mode",
    "tonight.oldSaveLabel": "Back to an old save?",
    "tonight.oldSaveBody":
      "{name} is already open in the catalog. Continuity beats novelty at night.",
    "tonight.title": "What kind of night is it?",
    "tonight.suggested": "Suggested for tonight",
    "tonight.chooseThis": "Choose this",
    "tonight.notTonight": "Not tonight",
    "tonight.alsoNearby": "also nearby",
    "tonight.signInTitle": "Sign in before choosing from the catalog.",
    "tonight.signInBody": "Your library will be here when you are ready.",
    "tonight.goToCatalog": "Go to the catalog",
    "tonight.fallbackReason":
      "A quiet pick from the games already in your catalog.",

    "status.BACKLOG": "on the shelf",
    "status.OWNED": "owned",
    "status.WISHLIST": "still curious",
    "status.PLAYING": "playing now",
    "status.PAUSED": "paused",
    "status.COMPLETED": "credits rolled",
    "status.FINISHED": "credits rolled",
    "status.DROPPED": "released",

    "signal.UNTOUCHED": "ready when you are",
    "signal.SAMPLED_DROPPED": "sampled once",
    "signal.STALE_PLAYING": "paused mid-journey",
    "signal.FINISHABLE_SOON": "a short return",
    "signal.LIKELY_FINISHED": "credits may have rolled",
    "signal.WISHLIST_RISK": "still curious",
    "signal.BUY_RISK": "pause before buying",
    "signal.RETURN_CANDIDATE": "worth a gentle return",
    "signal.RELEASE_CANDIDATE": "ready to release",

    "statusMessage.steamRefreshed": "Steam refreshed. {count} games updated.",
    "statusMessage.profileCreated":
      "Profile created. Add games whenever you are ready.",
    "statusMessage.signedIn": "Signed in. Your catalog is ready.",
    "statusMessage.googleConnected":
      "Google login connected. Your catalog is ready.",
    "statusMessage.sourceDisconnected":
      "Source disconnected. Existing games stayed on your shelf.",
    "statusMessage.playstationRefreshed":
      "PlayStation refreshed. {count} games updated.",
    "statusMessage.xboxRefreshed": "Xbox refreshed. {count} games updated.",
    "statusMessage.finishedCheck":
      "Finished-game check looked at {scanned} entries and found {count} finished games.",
    "statusMessage.csvImported":
      "CSV import finished. {count} games were added or updated.",
    "statusMessage.currentPlayingUpdated":
      "Current playing updated. Your overview now reflects your picks.",
    "statusMessage.currentPlayingCleared":
      "Current playing cleared. Suggested picks are ready whenever you want them.",
    "statusMessage.sourceConnected":
      "Source connected. Refresh it whenever you are ready.",
    "statusMessage.guideRefreshed":
      "Guide refreshed. {count} suggestions updated.",
    "statusMessage.playerProfileUpdated":
      "Player profile refreshed from your games, feedback, and reviews.",
    "statusMessage.playerProfileEmpty":
      "Your shelf is quiet right now. Add a few games before asking for a player profile.",

    "profileAction.needSteamLogin": "Sign in before syncing Steam.",
    "profileAction.steamSyncFailed": "Steam sync did not complete.",
    "profileAction.needIntegrationsLogin":
      "Sign in before changing integrations.",
    "profileAction.disconnectInvalid":
      "That integration cannot be disconnected.",
    "profileAction.needPlayStationLogin":
      "Sign in before connecting PlayStation.",
    "profileAction.invalidPlayStationToken":
      "Enter a valid PlayStation NPSSO token.",
    "profileAction.playStationConnectFailed":
      "Could not connect PlayStation.",
    "profileAction.needPlayStationSyncLogin":
      "Sign in before syncing PlayStation.",
    "profileAction.playStationSyncFailed":
      "PlayStation sync did not complete.",
    "profileAction.needXboxSyncLogin": "Sign in before syncing Xbox.",
    "profileAction.xboxSyncFailed": "Xbox sync did not complete.",
    "profileAction.needCsvLogin": "Sign in before importing CSV data.",
    "profileAction.invalidCsv": "Please upload a valid CSV file.",
    "profileAction.needTitleMapping":
      "Map a title column before importing.",
    "profileAction.csvImportFailed": "CSV import did not complete.",
    "profileAction.needCurrentPlayingLogin":
      "Sign in before changing Current playing.",
    "profileAction.invalidCurrentPlaying":
      "Choose up to three games for Current playing.",
    "profileAction.duplicateCurrentPlaying":
      "Choose three different games for Current playing.",
    "profileAction.onlyShelfGames":
      "Only games already on your shelf can be featured.",
    "profileAction.needFinishedLogin":
      "Sign in before detecting finished games.",
    "profileAction.finishedCheckFailed":
      "Credits-rolled check did not complete.",
  },
  "pt-BR": {
    "common.home": "Início",
    "common.library": "Biblioteca",
    "common.catalog": "Catálogo",
    "common.tonight": "Hoje",
    "common.player": "Jogadora",
    "common.search": "Buscar",
    "common.all": "Tudo",
    "common.backHome": "Voltar ao início",
    "common.addGames": "Adicionar jogos",
    "common.connected": "conectados",
    "common.readyWhenYouAre": "Pronto quando você quiser",
    "common.anyPlatform": "Qualquer plataforma",
    "common.listView": "Visualização em lista",
    "common.gridView": "Visualização em grade",
    "common.chooseGame": "Escolha um jogo",
    "common.clearAll": "Limpar tudo",
    "common.skipToContent": "Pular para o conteúdo",
    "common.playtimeSoFar": "{value} até agora",

    "nav.main": "Principal",
    "nav.footer": "Rodapé",
    "nav.profileSections": "Seções do perfil",

    "locale.label": "Idioma",
    "locale.en": "EN",
    "locale.pt-BR": "PT-BR",
    "locale.english": "Inglês",
    "locale.portugueseBrazil": "Português (Brasil)",

    "theme.label": "Tema",
    "theme.day": "Dia",
    "theme.night": "Noite",
    "theme.dayLabel": "Dia - navegar pelo catálogo",
    "theme.nightLabel": "Noite - escolher algo para jogar",

    "auth.trigger.signIn": "Entrar",
    "auth.dialog.account": "conta filazo",
    "auth.dialog.title": "Comece sua jornada de jogos",
    "auth.dialog.close": "Fechar login",
    "auth.dialog.createAccount": "Criar conta",
    "auth.dialog.signIn": "Entrar",
    "auth.dialog.name": "Nome",
    "auth.dialog.email": "E-mail",
    "auth.dialog.password": "Senha",
    "auth.dialog.confirmPassword": "Confirmar senha",
    "auth.dialog.namePlaceholder": "Digite seu nome",
    "auth.dialog.emailPlaceholder": "Digite seu e-mail",
    "auth.dialog.passwordPlaceholder": "Digite sua senha",
    "auth.dialog.confirmPasswordPlaceholder": "Repita sua senha",
    "auth.dialog.hidePassword": "Ocultar senha",
    "auth.dialog.showPassword": "Mostrar senha",
    "auth.dialog.termsPrefix": "Eu concordo com os",
    "auth.dialog.terms": "Termos de Uso",
    "auth.dialog.privacy": "Política de Privacidade",
    "auth.dialog.or": "ou",
    "auth.dialog.google": "Continuar com Google",
    "auth.dialog.registrationClosed":
      "Novos registros estão fechados. Se você ainda não tem conta, solicite acesso pelo cadastro de beta tester.",
    "auth.dialog.requestBeta": "Solicitar acesso beta",
    "auth.signOut": "Sair",

    "auth.error.invalidEmailOrPassword":
      "Use um e-mail válido e uma senha com pelo menos 8 caracteres.",
    "auth.error.noPasswordAccount":
      "Não existe uma conta filazo com senha para esse e-mail.",
    "auth.error.emailPasswordMismatch": "E-mail ou senha não conferem.",
    "auth.error.displayNameLength":
      "Escolha um nome de perfil com 2 a 48 caracteres.",
    "auth.error.passwordConfirmation": "A confirmação de senha não confere.",
    "auth.error.acceptTerms":
      "Aceite os termos antes de criar uma conta.",
    "auth.error.accountExists":
      "Já existe uma conta filazo para esse e-mail.",
    "auth.error.registrationClosed":
      "Novos registros estão fechados. Solicite acesso pelo cadastro beta.",
    "auth.error.googleRegistrationClosed":
      "Novos registros estão fechados. Entre pelo cadastro de beta tester.",
    "auth.error.steamRegistrationClosed":
      "Novos registros estão fechados. Solicite acesso pelo cadastro beta antes de conectar Steam.",
    "auth.error.xboxRegistrationClosed":
      "Novos registros estão fechados. Solicite acesso pelo cadastro beta antes de conectar Xbox.",
    "auth.error.youtubeStartFailed":
      "Não foi possível iniciar o login com YouTube.",
    "auth.error.youtubeMissingCode":
      "YouTube não retornou um código de autorização.",
    "auth.error.youtubeStateInvalid":
      "Não foi possível verificar o login com YouTube.",
    "auth.error.youtubeCallbackFailed":
      "Não foi possível finalizar o login com YouTube.",

    "landing.notice.database":
      "{message} Deploys na Vercel precisam de um banco de produção; a configuração com SQLite deste repositório foi feita para desenvolvimento local.",
    "landing.kicker": "Biblioteca calma para coleções grandes de jogos",
    "landing.title": "Seu backlog de jogos\nnão precisa ser estressante.",
    "landing.body":
      "filazo junta suas listas de jogos em uma biblioteca calma e deixa a escolha de hoje sempre por perto.",
    "landing.openTonight": "Abrir hoje",
    "landing.openLibrary": "Abrir biblioteca",
    "landing.indexedCount":
      "{count} jogos já foram indexados aqui. Navegue, organize ou simplesmente deixe eles esperando.",
    "landing.howItWorks": "Como funciona",
    "landing.step1Title": "Traga seus jogos",
    "landing.step1Body":
      "Conecte uma fonte ou envie um CSV quando quiser preencher a estante.",
    "landing.step2Title": "Mantenha uma estante limpa",
    "landing.step2Body":
      "O mesmo jogo continua junto mesmo quando veio de mais de um lugar.",
    "landing.step3Title": "Escolha sem pressão",
    "landing.step3Body":
      "Quando você quiser jogar, a filazo deixa uma escolha que combina com o momento por perto sem transformar o resto em tarefa.",
    "landing.catalogLabel": "O catálogo",
    "landing.catalogTitle": "Uma biblioteca pra todas as plataformas.",
    "landing.catalogBody":
      "{count} jogos já estão indexados. São entradas reais do catálogo com metadados suficientes para representar sua estante com clareza.",
    "landing.noShowcaseTitle": "Ainda não há vitrine do catálogo.",
    "landing.noShowcaseBody":
      "Assim que entradas reais tiverem metadados suficientes, elas aparecem aqui automaticamente.",
    "landing.marker.csv": "CSV",
    "landing.marker.metadata": "Metadados",
    "landing.marker.tonight": "Hoje",
    "landing.shortReturn": "retorno curto",
    "landing.quote":
      "Um backlog inacabado\né fonte de estresse.\nEstá tudo bem largar jogos.\nEscolha o que encaixa.",
    "landing.ctaTitle":
      "Traga seus registros.\nDeixe o catálogo legível.",
    "landing.ctaFoot":
      "{count} jogos daqui já trazem capa, tempo de jogo e histórias.",
    "landing.catalogEntry": "entrada do catálogo",

    "login.kicker": "conta filazo",
    "login.title": "Entre uma vez. Mantenha todas as bibliotecas conectadas depois.",
    "login.body":
      "Entre com uma conta filazo existente ou uma conta Google já conhecida. Novos registros estão fechados; novos jogadores podem solicitar acesso beta com YouTube.",
    "login.open": "Abrir login",

    "beta.status.pending.title": "Cadastro enviado",
    "beta.status.pending.body":
      "Sua solicitação está na fila de análise. Você receberá acesso completo por 1 ano se for aprovada.",
    "beta.status.approved.title": "Acesso aprovado",
    "beta.status.approved.body":
      "Seu acesso beta está ativo. Você já pode usar a plataforma completa.",
    "beta.status.rejected.title": "Cadastro recusado",
    "beta.status.rejected.body":
      "Você pode revisar suas respostas e enviar o cadastro novamente.",
    "beta.adminLoggedIn": "Você está logada como admin.",
    "beta.openAdmin": "Abrir área de admin",
    "beta.sent": "Cadastro recebido. Agora ele aguarda aprovação.",
    "beta.kicker": "Beta testers",
    "beta.title": "Cadastro para acesso antecipado ao filazo",
    "beta.body":
      "Novos registros públicos estão fechados. Beta testers aprovados terão acesso completo à plataforma por 1 ano para testar catálogo, imports, integrações e recomendações.",
    "beta.signInYoutube": "Entrar com YouTube e solicitar acesso",
    "beta.justification": "Justificativa: {value}",
    "beta.existingAccount":
      "Esta conta já tem acesso à plataforma. O cadastro beta é só para novos testers.",
    "beta.openPlatform": "Abrir plataforma",
    "beta.name": "Nome",
    "beta.platforms": "Plataformas que joga",
    "beta.retrogames": "Retrogames e outras plataformas",
    "beta.retrogamesPlaceholder":
      "Ex.: 3DS, Vita, Dreamcast, emuladores, arcade...",
    "beta.submit": "Enviar cadastro",
    "beta.error.invalidApplication":
      "Preencha seu nome e pelo menos uma plataforma.",

    "admin.restricted":
      "Esta área é restrita ao admin. Entre com o YouTube usando ludmila.omlopes@gmail.com.",
    "admin.signInYoutube": "Entrar com YouTube",
    "admin.reviewed": "Solicitação atualizada.",
    "admin.kicker": "Admin",
    "admin.title": "Beta testers",
    "admin.body":
      "Aprove ou recuse cadastros de beta testers. Aprovações liberam acesso completo à plataforma por 1 ano.",
    "admin.pending": "Pendentes",
    "admin.totalReviewable": "Total analisável",
    "admin.status.pending": "Pendente",
    "admin.status.approved": "Aprovado",
    "admin.status.rejected": "Recusado",
    "admin.status.draft": "Rascunho",
    "admin.noName": "Sem nome",
    "admin.noEmail": "sem email",
    "admin.platforms": "Plataformas",
    "admin.retrogames": "Retrogames",
    "admin.notInformed": "não informado",
    "admin.justification": "Justificativa",
    "admin.accessUntil": "Acesso até",
    "admin.approve": "Aprovar",
    "admin.reject": "Recusar",
    "admin.empty": "Nenhuma solicitação enviada ainda.",
    "admin.error.justificationRequired":
      "Justificativa obrigatória para aprovar ou recusar.",

    "footer.tagline": "Seu catálogo, no seu ritmo.",
    "footer.madeFor": "feito para quem tem jogos demais",

    "profile.signedOut.label": "Seu catálogo",
    "profile.signedOut.title": "Conecte uma conta para começar.",
    "profile.signedOut.body":
      "Entre primeiro, depois conecte Steam, PlayStation, Xbox ou comece com um perfil local só de CSV. Comece pelo caminho mais fácil.",
    "profile.error.label": "Banco indisponível",
    "profile.error.title": "Sua biblioteca não pode carregar agora.",
    "profile.error.body":
      "{message} Deploys na Vercel precisam de um banco de produção; a configuração com SQLite deste repositório foi feita para desenvolvimento local.",

    "profile.greeting.morning":
      "Bom dia. O catálogo fica pronto quando você quiser.",
    "profile.greeting.afternoon":
      "Boa tarde. Toda entrada pode esperar.",
    "profile.greeting.evening": "Boa noite. Escolha uma, ou só navegue.",
    "profile.greeting.label": "Início da biblioteca",
    "profile.greeting.body":
      "{greeting} {count} jogos já têm um lugar legível aqui.",
    "profile.greeting.connectedOne": "1 fonte conectada.",
    "profile.greeting.connectedMany": "{count} fontes conectadas.",
    "profile.greeting.connectedNone": "Nenhuma fonte conectada ainda.",
    "profile.greeting.pickTonight": "Escolher para hoje",
    "profile.greeting.browseShelf": "Ver estante",

    "profile.rail.home": "Início",
    "profile.rail.homeHint": "O que importa agora",
    "profile.rail.sources": "Fontes",
    "profile.rail.sourcesHint": "Adicionar ou atualizar",
    "profile.rail.catalog": "Catálogo",
    "profile.rail.catalogHint": "Ver todas as entradas",
    "profile.rail.guide": "Guia",
    "profile.rail.guideHint": "Sugestões leves",
    "profile.rail.journal": "Diário",
    "profile.rail.journalHint": "Páginas do diário",
    "profile.rail.setup": "Ajustes",
    "profile.rail.setupHint": "Preferências",
    "profile.rail.avatarAlt": "avatar de {name}",
    "profile.rail.ownedCurious": "{owned} seus / {wishlist} ainda em observação",

    "profile.addGames.label": "Adicionar jogos",
    "profile.addGames.title": "Traga outra estante",
    "profile.addGames.latestImport": "Última importação: {date}",
    "profile.addGames.sourcesTitle": "Steam, PlayStation e Xbox",
    "profile.addGames.manageSources": "Gerenciar fontes",
    "profile.addGames.sourcesBody":
      "Conecte uma fonte uma vez e depois atualize quando quiser dados mais recentes de tempo de jogo ou partidas recentes.",
    "profile.addGames.connectedOne": "1 fonte conectada",
    "profile.addGames.connectedMany": "{count} fontes conectadas",
    "profile.addGames.fileImport": "Importação de arquivo",
    "profile.addGames.uploadCsv": "Enviar CSV",

    "profile.sources.label": "Fontes",
    "profile.sources.title": "Adicionar ou atualizar seus jogos",
    "profile.sources.description":
      "Conecte os lugares onde você já joga. Sua estante continua intacta mesmo se uma fonte for removida depois.",
    "profile.sources.disconnectQuestion":
      "O que acontece quando uma fonte é desconectada?",
    "profile.sources.disconnectAnswer":
      "A filazo remove a conexão da conta, mas mantém os jogos que já estavam na sua estante.",
    "profile.sources.account": "Conta",
    "profile.sources.disconnect": "Desconectar",
    "profile.sources.disconnected": "Desconectada",
    "profile.sources.notSynced": "Ainda sem sincronizar",
    "profile.sources.synced": "Sincronizada em {date}",
    "profile.sources.tokenGuide": "Como obter o token",
    "profile.sources.tokenStep1":
      "1. Entre na PlayStation pelo navegador.",
    "profile.sources.tokenStep2Lead": "2. Abra",
    "profile.sources.tokenStep2": "2. Abra a página NPSSO da Sony.",
    "profile.sources.tokenStep3":
      "3. Copie o valor do token na resposta e cole abaixo. Colar a resposta inteira também funciona.",
    "profile.sources.tokenBody":
      "O token é temporário. A filazo troca ele por uma conexão segura e não guarda o valor colado.",
    "profile.sources.steamTitle": "Biblioteca Steam",
    "profile.sources.steamBody":
      "Traga jogos seus, tempo de jogo, datas recentes e progresso.",
    "profile.sources.refreshSteam": "Atualizar Steam",
    "profile.sources.refreshing": "Atualizando...",
    "profile.sources.steamPending":
      "A Steam está atualizando sua biblioteca. Deixe esta página aberta.",
    "profile.sources.connectSteam": "Conectar Steam",
    "profile.sources.playstationTitle": "Biblioteca PlayStation",
    "profile.sources.playstationBody":
      "Traga jogos comprados e histórico de troféus.",
    "profile.sources.refreshPlayStation": "Atualizar PlayStation",
    "profile.sources.playstationPending":
      "A PlayStation está atualizando sua biblioteca.",
    "profile.sources.technicalStatus": "Status técnico",
    "profile.sources.steamReady": "pronto",
    "profile.sources.steamMissingKey": "sem chave",
    "profile.sources.igdbMissingKeys": "sem chaves",
    "profile.sources.connectedSecurely": "Token conectado e armazenado com segurança.",
    "profile.sources.npsso": "Token NPSSO",
    "profile.sources.npssoPlaceholder":
      "Cole o token ou {\"npsso\":\"...\"}",
    "profile.sources.connectPlayStation": "Conectar PlayStation",
    "profile.sources.xboxTitle": "Biblioteca Xbox",
    "profile.sources.xboxBody":
      "Traga histórico de conquistas e partidas recentes.",
    "profile.sources.refreshXbox": "Atualizar Xbox",
    "profile.sources.xboxPending": "O Xbox está atualizando sua biblioteca.",
    "profile.sources.connectXbox": "Conectar Xbox",
    "profile.sources.xboxUnavailable": "Xbox indisponível",
    "profile.sources.oauthReady": "pronto",
    "profile.sources.oauthMissing": "sem client ID",
    "profile.sources.csvNotice":
      "Os envios de CSV ficam na aba inicial porque são importações pontuais, não fontes conectadas.",
    "profile.sources.connectedCount": "{count} conectadas",
    "profile.sources.steamApiStatus":
      "API Steam {steam} / metadados {metadata}",
    "profile.sources.oauthStatus": "OAuth {status}",

    "profile.completion.label": "Status de conclusão",
    "profile.completion.title": "Atualizar jogos terminados",
    "profile.completion.body":
      "Verifique conquistas e troféus conectados para jogos que parecem completos.",
    "profile.completion.ready": "Pronto",
    "profile.completion.needsSource": "Precisa de Steam ou PlayStation",
    "profile.completion.update": "Atualizar conclusão",
    "profile.completion.checking": "Verificando...",
    "profile.completion.pending":
      "Verificando status de conclusão. Bibliotecas grandes podem levar alguns minutos.",
    "profile.completion.connectFirst":
      "Conecte Steam ou PlayStation primeiro.",

    "profile.currentPlaying.label": "Jogando agora",
    "profile.currentPlaying.title": "Mantenha alguns jogos por perto",
    "profile.currentPlaying.description":
      "Escolha até três entradas da estante e fixe elas no topo da sua visão geral.",
    "profile.currentPlaying.inView": "{count} de 3 em vista",
    "profile.currentPlaying.spot": "Espaço {slot}",
    "profile.currentPlaying.openTitle": "Aberto para um jogo",
    "profile.currentPlaying.openBody":
      "Deixe esse espaço vazio ou escolha algo abaixo quando quiser manter em foco.",
    "profile.currentPlaying.suggestedLabel": "Sugestões",
    "profile.currentPlaying.suggestedTitle": "Um bom lugar para começar",
    "profile.currentPlaying.useThese": "Usar essas escolhas",
    "profile.currentPlaying.fromProfile": "Do seu perfil",
    "profile.currentPlaying.fromShelf": "Da sua estante",
    "profile.currentPlaying.howChosen": "Como essas escolhas foram feitas",
    "profile.currentPlaying.howChosenBody":
      "Recomendações salvas do perfil entram primeiro quando existem. Os espaços restantes recorrem a jogos inacabados da estante com sinais como status jogando, atividade recente, favoritos, tempo de jogo e nota compartilhada. Essas sugestões saem do seu próprio catálogo, não de pesquisa ao vivo na web.",
    "profile.currentPlaying.emptyTitle": "Nada está fixado agora.",
    "profile.currentPlaying.emptyBody":
      "Escolha até três jogos para manter sua rotação atual visível de relance.",
    "profile.currentPlaying.chooseChange":
      "Escolha ou altere seus três jogos",
    "profile.currentPlaying.choose": "Escolha seus três jogos",
    "profile.currentPlaying.leaveOpen": "Deixar esse espaço vazio",
    "profile.currentPlaying.save": "Salvar jogando agora",
    "profile.currentPlaying.saving": "Salvando...",
    "profile.currentPlaying.fillOpenSpots": "Preencher espaços",
    "profile.currentPlaying.help":
      "Deixe qualquer espaço vazio para limpar. Você pode destacar menos de três jogos se isso fizer mais sentido.",
    "profile.currentPlaying.reason.playing":
      "Já está marcado como jogando agora, então merece ficar perto do topo.",
    "profile.currentPlaying.reason.recent":
      "Você tocou nele recentemente, o que faz dele uma escolha natural para manter em vista.",
    "profile.currentPlaying.reason.favorite":
      "Ele está entre seus favoritos e ainda pode voltar ao foco com leveza.",
    "profile.currentPlaying.reason.playtime":
      "Você já investiu tempo nele, então ele vira um bom candidato para retomar sem peso.",
    "profile.currentPlaying.reason.default":
      "Uma escolha estável e inacabada da sua própria estante.",

    "profile.favorites.label": "Favoritos",
    "profile.favorites.title": "Jogos que você ama",
    "profile.favorites.keptClose": "{count} por perto",
    "profile.favorites.emptyTitle": "Ainda não há favoritos, e tudo bem.",
    "profile.favorites.emptyBody":
      "Toque no coração de qualquer jogo quando algum deles parecer especial.",

    "profile.shelf.label": "Estante",
    "profile.shelf.title": "Seus jogos",
    "profile.shelf.description":
      "Busque primeiro. Os filtros ficam guardados até você precisar afunilar a visão.",
    "profile.shelf.searchPlaceholder": "Buscar no catálogo",
    "profile.shelf.clearGuideFilter": "Limpar filtro do guia: {label}",
    "profile.shelf.filterSort": "Filtrar e ordenar",
    "profile.shelf.newest": "Mais recentes",
    "profile.shelf.playtime": "Tempo de jogo",
    "profile.shelf.titleSort": "Título",
    "profile.shelf.emptyTitle": "Sua estante está pronta. Traga alguns jogos.",
    "profile.shelf.emptyBody":
      "Sincronize uma plataforma ou importe um CSV e o catálogo vira algo navegável.",
    "profile.shelf.gameCount": "{count} jogos",
    "profile.shelf.gameCountOne": "1 jogo",

    "csv.chooseFile": "Escolha um arquivo CSV",
    "csv.helper":
      "A filazo vai ler as colunas reconhecidas e mostrar uma prévia antes de adicionar qualquer coisa.",
    "csv.error": "Esse CSV não abriu direito.",
    "csv.origin": "De onde veio esse arquivo?",
    "csv.generic": "CSV genérico",
    "csv.playstation": "CSV do PlayStation",
    "csv.xbox": "CSV do Xbox",
    "csv.titleColumn": "Coluna do título do jogo",
    "csv.titlePrompt": "Escolha a coluna do título",
    "csv.adjustOptional": "Ajustar colunas opcionais",
    "csv.skipField": "Pular isso",
    "csv.preview": "Prévia",
    "csv.sourceRows":
      "Essas linhas serão tratadas como jogos de {source} quando houver um identificador compatível.",
    "csv.noPlatform": "Sem plataforma",
    "csv.noProgress": "Sem progresso",
    "csv.choosePreview": "Escolha a coluna do título para ver a prévia.",
    "csv.import": "Importar jogos",
    "csv.field.title": "Título",
    "csv.field.platform": "Plataforma",
    "csv.field.status": "Status",
    "csv.field.playtime": "Horas jogadas",
    "csv.field.completion": "% de conquistas",
    "csv.field.notes": "Notas",
    "csv.field.externalId": "ID externo",

    "favorite.addTitle": "Adicionar {name} aos favoritos",
    "favorite.removeTitle": "Remover {name} dos favoritos",
    "favorite.add": "Adicionar favorito",
    "favorite.current": "Favorito",

    "game.breadcrumb": "Navegação",
    "game.entryLabel": "Entrada do catálogo",
    "game.relationship": "Sua relação com este jogo",
    "game.placeOnShelf": "Lugar na estante",
    "game.recordedPlaytime": "Tempo de jogo registrado",
    "game.usualCredits": "Créditos habituais",
    "game.creditsAround":
      "A maioria das pessoas vê os créditos em torno de {value}.",
    "game.achievementSignals":
      "Alguns sinais de conquista estão registrados, mas os créditos ainda não foram marcados.",
    "game.stillCurious":
      "Ainda em observação. Deixe perto até o momento certo chegar.",
    "game.notMarked":
      "A história ainda não foi marcada como créditos concluídos.",
    "game.unmarkCredits": "Desmarcar créditos concluídos",
    "game.markCredits": "Marcar créditos concluídos",
    "game.markDropped": "Largar jogo",
    "game.returnToShelf": "Voltar para a estante",
    "game.released": "Liberado da estante ativa.",
    "game.releasedOn": "Liberado da estante ativa em {date}.",
    "game.catalogNote": "Nota do catálogo",
    "game.whatRemembers": "O que este jogo guarda",
    "game.reception": "Recepção",
    "game.noteNotGrade": "Uma nota, não uma nota final",
    "game.criticsSaid": "Crítica: {score} - {label}.",
    "game.timeEstimates": "Estimativas de tempo",
    "game.playerGuide": "Notas do guia da jogadora",
    "game.creditsRoll": "créditos",
    "game.tookTheirTime": "indo com calma",
    "game.sawEverything": "viu tudo",
    "game.photoPrints": "Capturas",
    "game.fewScenes": "Algumas cenas do guia",
    "game.opensLightbox": "Abre em lightbox",
    "game.whereLives": "Onde ele vive",
    "game.otherEntries": "Outras entradas",
    "game.nearbyShelves": "Como ele aparece em estantes próximas",
    "game.backToCatalog": "Voltar ao catálogo",
    "game.noPlaytimeData": "Sem dados de tempo de jogo",
    "game.notFound": "Jogo não encontrado | filazo",
    "game.metadataFallback":
      "Uma página em formato memory card da filazo para {name}, com contexto da biblioteca e notas de guia.",
    "game.coverAlt": "Capa de {name}",
    "game.creditsRolled":
      "Créditos concluídos em {date}. Isso é separado da coleta de conquistas.",
    "game.entryCountOne": "1 entrada",
    "game.entryCountMany": "{count} entradas",
    "game.reception.beloved": "muito querido",
    "game.reception.strong": "recepção forte",
    "game.reception.mixed": "misto, mas lembrado",
    "game.reception.quiet": "uma recepcao mais discreta",

    "routeError.label": "Sala de save pausada",
    "routeError.title": "Algo travou.",
    "routeError.body":
      "Sua biblioteca está segura. Tente de novo ou volte um pouco para a estante.",
    "routeError.retry": "Tentar de novo",
    "routeError.backShelf": "Voltar para a estante",

    "tonight.mood.short": "algo curto",
    "tonight.mood.cozy": "algo aconchegante",
    "tonight.mood.gripping": "algo envolvente",
    "tonight.mood.oldSave": "voltar para um save antigo",
    "tonight.mood.surprise": "me surpreenda",
    "tonight.emptyTitle": "Ainda não há uma escolha para esta noite.",
    "tonight.emptyBody":
      "Adicione alguns jogos ao seu catálogo e volte quando o clima pedir.",
    "tonight.addCatalog": "Adicionar jogos ao catálogo",
    "tonight.dimLights": "Escurecer as luzes?",
    "tonight.nightMode": "Modo Noite",
    "tonight.oldSaveLabel": "Voltar para um save antigo?",
    "tonight.oldSaveBody":
      "{name} já está aberto no catálogo. Continuidade vence novidade à noite.",
    "tonight.title": "Que tipo de noite é hoje?",
    "tonight.suggested": "Sugestão para hoje",
    "tonight.chooseThis": "Escolher este",
    "tonight.notTonight": "Não hoje",
    "tonight.alsoNearby": "também por perto",
    "tonight.signInTitle": "Entre antes de escolher no catálogo.",
    "tonight.signInBody": "Sua biblioteca vai estar aqui quando você quiser.",
    "tonight.goToCatalog": "Ir para o catálogo",
    "tonight.fallbackReason":
      "Uma escolha silenciosa entre os jogos que já estão no seu catálogo.",

    "status.BACKLOG": "na estante",
    "status.OWNED": "seu",
    "status.WISHLIST": "ainda em observação",
    "status.PLAYING": "jogando agora",
    "status.PAUSED": "pausado",
    "status.COMPLETED": "créditos concluídos",
    "status.FINISHED": "créditos concluídos",
    "status.DROPPED": "liberado",

    "signal.UNTOUCHED": "pronto quando você quiser",
    "signal.SAMPLED_DROPPED": "só experimentado",
    "signal.STALE_PLAYING": "pausado no meio do caminho",
    "signal.FINISHABLE_SOON": "retorno curto",
    "signal.LIKELY_FINISHED": "os créditos podem ter rolado",
    "signal.WISHLIST_RISK": "ainda em observação",
    "signal.BUY_RISK": "espere antes de comprar",
    "signal.RETURN_CANDIDATE": "vale um retorno leve",
    "signal.RELEASE_CANDIDATE": "pronto para liberar",

    "statusMessage.steamRefreshed": "Steam atualizada. {count} jogos mudaram.",
    "statusMessage.profileCreated":
      "Perfil criado. Adicione jogos quando quiser.",
    "statusMessage.signedIn": "Login feito. Seu catálogo está pronto.",
    "statusMessage.googleConnected":
      "Login com Google conectado. Seu catálogo está pronto.",
    "statusMessage.sourceDisconnected":
      "Fonte desconectada. Os jogos continuaram na sua estante.",
    "statusMessage.playstationRefreshed":
      "PlayStation atualizada. {count} jogos mudaram.",
    "statusMessage.xboxRefreshed": "Xbox atualizado. {count} jogos mudaram.",
    "statusMessage.finishedCheck":
      "A verificação de jogos terminados analisou {scanned} entradas e encontrou {count} jogos terminados.",
    "statusMessage.csvImported":
      "Importação de CSV concluída. {count} jogos foram adicionados ou atualizados.",
    "statusMessage.currentPlayingUpdated":
      "Jogando agora atualizado. Sua visão geral já reflete essas escolhas.",
    "statusMessage.currentPlayingCleared":
      "Jogando agora limpo. As sugestões continuam prontas quando você quiser.",
    "statusMessage.sourceConnected":
      "Fonte conectada. Atualize quando quiser.",
    "statusMessage.guideRefreshed":
      "Guia atualizado. {count} sugestões mudaram.",
    "statusMessage.playerProfileUpdated":
      "Perfil de jogadora atualizado com base nos seus jogos, feedbacks e reviews.",
    "statusMessage.playerProfileEmpty":
      "Sua estante está silenciosa agora. Adicione alguns jogos antes de pedir um perfil de jogadora.",

    "profileAction.needSteamLogin":
      "Entre antes de sincronizar a Steam.",
    "profileAction.steamSyncFailed":
      "A sincronização da Steam não terminou.",
    "profileAction.needIntegrationsLogin":
      "Entre antes de alterar as integrações.",
    "profileAction.disconnectInvalid":
      "Essa integração não pode ser desconectada.",
    "profileAction.needPlayStationLogin":
      "Entre antes de conectar a PlayStation.",
    "profileAction.invalidPlayStationToken":
      "Digite um token NPSSO válido da PlayStation.",
    "profileAction.playStationConnectFailed":
      "Não foi possível conectar a PlayStation.",
    "profileAction.needPlayStationSyncLogin":
      "Entre antes de sincronizar a PlayStation.",
    "profileAction.playStationSyncFailed":
      "A sincronização da PlayStation não terminou.",
    "profileAction.needXboxSyncLogin":
      "Entre antes de sincronizar o Xbox.",
    "profileAction.xboxSyncFailed":
      "A sincronização do Xbox não terminou.",
    "profileAction.needCsvLogin":
      "Entre antes de importar dados em CSV.",
    "profileAction.invalidCsv": "Envie um arquivo CSV válido.",
    "profileAction.needTitleMapping":
      "Mapeie uma coluna de título antes de importar.",
    "profileAction.csvImportFailed":
      "A importação do CSV não terminou.",
    "profileAction.needCurrentPlayingLogin":
      "Entre antes de alterar Jogando agora.",
    "profileAction.invalidCurrentPlaying":
      "Escolha até três jogos para Jogando agora.",
    "profileAction.duplicateCurrentPlaying":
      "Escolha três jogos diferentes para Jogando agora.",
    "profileAction.onlyShelfGames":
      "Só jogos que já estão na sua estante podem ser destacados.",
    "profileAction.needFinishedLogin":
      "Entre antes de detectar jogos terminados.",
    "profileAction.finishedCheckFailed":
      "A verificação de créditos concluídos não terminou.",
  },
} satisfies Record<string, Record<string, string>>;

export type TranslationKey = keyof typeof messages.en;

export function parseLocale(value: string | null | undefined): Locale {
  if (!value) {
    return defaultLocale;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "pt-br" || normalized === "pt" || normalized.startsWith("pt-")) {
    return "pt-BR";
  }

  return "en";
}

export function getPreferredLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) {
    return defaultLocale;
  }

  return /\bpt(-br)?\b/i.test(acceptLanguage) ? "pt-BR" : "en";
}

export function translate(
  locale: Locale,
  key: TranslationKey,
  values?: Record<string, string | number>,
) {
  const template = messages[locale][key] ?? messages.en[key] ?? key;

  if (!values) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_, token: string) => {
    const value = values[token];
    return value === undefined ? "" : String(value);
  });
}

export function createTranslator(locale: Locale) {
  return (key: TranslationKey, values?: Record<string, string | number>) =>
    translate(locale, key, values);
}
