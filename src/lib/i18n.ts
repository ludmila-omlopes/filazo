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
    "common.apply": "Apply",
    "common.close": "Close",
    "common.skipToContent": "Skip to content",
    "common.playtimeSoFar": "{value} so far",
    "common.your": "your",

    "nav.main": "Main",
    "nav.footer": "Footer",
    "nav.profileSections": "Profile sections",

    "banner.beta.message": "filazo is in beta.",
    "banner.beta.cta": "Join our Discord",
    "banner.beta.dismiss": "Dismiss beta notice",

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
    "theme.auto": "Auto",
    "theme.autoLabel": "Auto - follow the time of day",
    "theme.phase.morning": "morning",
    "theme.phase.afternoon": "afternoon",
    "theme.phase.dusk": "dusk",
    "theme.phase.evening": "evening",
    "theme.phase.night": "night",

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
    "auth.browserRequired.kicker": "Google sign-in",
    "auth.browserRequired.title": "Open filazo in your browser to continue.",
    "auth.browserRequired.body":
      "Google blocks sign-in inside embedded browsers like Threads, Instagram, and Facebook. Open this page in Chrome, Safari, Edge, or another regular browser, then try Google sign-in again.",
    "auth.browserRequired.notice":
      "If you are seeing this inside an app, use that app's browser menu and choose Open in browser.",
    "auth.browserRequired.addressLabel": "filazo address",
    "auth.browserRequired.back": "Back to filazo",
    "auth.browserRequired.open": "Open filazo",

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
    "auth.error.sessionExpired": "Session expired. Sign in again.",
    "auth.error.googleRegistrationClosed":
      "Public registrations are closed. Use the beta tester signup.",
    "auth.error.steamRegistrationClosed":
      "Public registrations are closed. Request beta access before connecting Steam.",
    "auth.error.xboxRegistrationClosed":
      "Public registrations are closed. Request beta access before connecting Xbox.",
    "auth.error.youtubeStartFailed": "Could not start beta sign-in.",
    "auth.error.youtubeMissingCode":
      "The beta sign-in provider did not return an authorization code.",
    "auth.error.youtubeStateInvalid": "Could not verify beta sign-in.",
    "auth.error.youtubeCallbackFailed": "Could not finish beta sign-in.",

    "landing.notice.database":
      "{message} This environment needs a reachable PostgreSQL database before catalog features can load.",
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
      "Sign in with an existing filazo account or a known Google account. Public registration is closed; new players can request beta access with Google.",
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
    "beta.signInGoogle": "Sign in with Google and request access",
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
      "This area is restricted to the admin. Sign in with Google using ludmila.omlopes@gmail.com.",
    "admin.signInGoogle": "Sign in with Google",
    "admin.reviewed": "Request updated.",
    "admin.email.sent": "Approval email sent.",
    "admin.email.skipped":
      "Approval updated, but the email was not sent because email is not fully configured.",
    "admin.email.failed":
      "Approval updated, but the email failed. Send it manually for now.",
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
    "admin.approvedEmails.kicker": "Manual email fallback",
    "admin.approvedEmails.title": "Approved tester emails",
    "admin.approvedEmails.empty": "No approved testers yet.",
    "admin.error.justificationRequired":
      "Justification is required to approve or decline.",
    "admin.ai.kicker": "AI controls",
    "admin.ai.title": "AI budget and limits",
    "admin.ai.body":
      "Configure which AI features can run and the hard caps each one must respect before opening the platform to testers.",
    "admin.ai.save": "Save AI settings",
    "admin.ai.saved": "AI settings updated.",
    "admin.ai.invalidSettings":
      "AI settings were outside the accepted ranges.",

    "footer.tagline": "Your catalog, your pace.",
    "footer.madeFor": "made for players with too many games",

    "profile.signedOut.label": "Your catalog",
    "profile.signedOut.title": "Connect an account to begin.",
    "profile.signedOut.body":
      "Sign in first, then connect Steam, PlayStation, Xbox, or start with a CSV-only local profile. Start wherever feels easiest.",
    "profile.error.label": "Database unavailable",
    "profile.error.title": "Your library can't load right now.",
    "profile.error.body":
      "{message} This environment needs a reachable PostgreSQL database before catalog features can load.",

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
    "profile.currentPlaying.title": "Currently playing",
    "profile.currentPlaying.description":
      "Pick at most 3 games. It's better for you, trust me.",
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
    "profile.currentPlaying.clearTop": "Clear all",
    "profile.currentPlaying.remove": "Remove {name}",
    "profile.currentPlaying.dragOut": "Drag out to remove",
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

    "profile.playingNext.label": "Playing next",
    "profile.playingNext.title": "Playing next",
    "profile.playingNext.description":
      "Keep up to 3 games ready for when a current game leaves the rotation.",
    "profile.playingNext.inQueue": "{count} of 3 queued",
    "profile.playingNext.spot": "Queue {slot}",
    "profile.playingNext.openTitle": "Open queue spot",
    "profile.playingNext.openBody":
      "Search the catalog for something you want to start as soon as a current slot opens.",
    "profile.playingNext.emptyTitle": "No next games queued yet.",
    "profile.playingNext.emptyBody":
      "Click here to search the catalog and add up to three follow-up picks.",
    "profile.playingNext.chooseChange":
      "Choose or change your next games",
    "profile.playingNext.choose": "Choose your next games",
    "profile.playingNext.leaveOpen": "Leave this open",
    "profile.playingNext.save": "Save playing next",
    "profile.playingNext.saving": "Saving...",
    "profile.playingNext.clearTop": "Clear queue",
    "profile.playingNext.remove": "Remove {name}",
    "profile.playingNext.help":
      "Current and finished games stay out of this queue. Dropped games ask for confirmation before coming back.",
    "profile.playingNext.confirmDropped":
      "{name} is marked as dropped. Are you sure you want to try it again?",
    "profile.playingNext.sameGenreWarning":
      "All three queued games are {genre}. Consider adding a different genre to avoid fatigue.",
    "profile.playingNext.longGamesWarning":
      "All three queued games look long. Consider swapping one for something under {duration}.",
    "profile.playingNext.searchTitle": "Choose a game",
    "profile.playingNext.searchLabel": "Search the game catalog",
    "profile.playingNext.searchPlaceholder": "Search IGDB by title",
    "profile.playingNext.searchFailed": "Game search failed.",
    "profile.playingNext.catalogResult": "Catalog result",
    "profile.playingNext.owned": "in your library",
    "profile.playingNext.notOwned": "not owned yet",
    "profile.playingNext.alreadyQueued": "already queued",
    "profile.playingNext.queueThis": "Queue",
    "profile.playingNext.searching": "Searching...",
    "profile.playingNext.noMatches": "No matches yet.",

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
    "profile.shelf.statusSort": "Status",
    "profile.shelf.newest": "Newest",
    "profile.shelf.playtime": "Playtime",
    "profile.shelf.titleSort": "Title",
    "profile.shelf.emptyTitle": "Your shelf is ready. Bring some games over.",
    "profile.shelf.emptyBody":
      "Sync a platform or import a CSV, then the catalog becomes browsable.",
    "profile.shelf.gameCount": "{count} games",
    "profile.shelf.gameCountOne": "1 game",
    "shelf.unknownPlatform": "Unknown platform",
    "shelf.includeDormantChip": "Including dropped and not-started",
    "shelf.includeDormantLabel": "Include dropped and not-started games",
    "shelf.updateStatus": "Update status",
    "shelf.restoreBeforeCredits": "Restore this game before marking credits rolled",
    "shelf.creditsRolled": "Credits rolled",
    "shelf.rollCredits": "Roll credits",
    "shelf.return": "Return",
    "shelf.dropped": "Dropped",
    "assistant.corner.eyebrow": "Guide notes",
    "assistant.corner.title": "A quieter read on your catalog",
    "assistant.corner.openTonight": "Open tonight",
    "assistant.tab.label": "Guide",
    "assistant.tab.refreshHelp":
      "Refresh suggestions after adding games or changing your shelf.",
    "assistant.tab.usage": "Usage details",
    "assistant.tab.availableToday": "Notes available today:",
    "assistant.tab.usedToday": "Used today:",
    "assistant.tab.nextRefresh": "Next refresh:",
    "assistant.tab.unavailable": "unavailable",
    "assistant.tab.refresh": "Refresh guide",
    "assistant.tab.availableNow": "available now",
    "assistant.tab.inOneMinute": "in 1 minute",
    "assistant.tab.inMinutes": "in {count} minutes",
    "assistant.buy.eyebrow": "Thinking of buying?",
    "assistant.buy.title": "Buy, wait, stay curious, or pass",
    "libraryChat.label": "Library chat",
    "libraryChat.title": "Ask your collection anything",
    "libraryChat.body": "Answers come from your own games, playtime, and notes.",
    "libraryChat.unavailableTitle": "Chat is unavailable right now.",
    "libraryChat.unavailableBody": "The rest of the guide still works.",
    "libraryChat.tryOne": "Try one of these to start:",
    "libraryChat.prompt.shortSession": "What should I play if I only have an hour tonight?",
    "libraryChat.prompt.taste": "What does my library say about my taste lately?",
    "libraryChat.prompt.return": "Which unfinished game feels easiest to return to?",
    "libraryChat.checking": "Checking your library...",
    "libraryChat.paused": "Chat paused:",
    "libraryChat.unexpectedError": "unexpected error.",
    "libraryChat.tryAgain": "Try again when you're ready.",
    "libraryChat.placeholder":
      "Ask about your games, taste, or what to play next",
    "libraryChat.thinking": "Thinking...",
    "libraryChat.send": "Send",
    "libraryChat.tool.overview": "library overview",
    "libraryChat.tool.games": "game list",
    "libraryChat.tool.feedback": "player feedback",
    "libraryChat.tool.genres": "genre stats",
    "playerProfile.label": "Player profile",
    "playerProfile.title": "Who you are as a player",
    "playerProfile.body":
      "A short read on your taste, based on your library, playtime, and notes. Refresh it after adding feedback.",
    "playerProfile.generated": "Generated {date}",
    "playerProfile.notGenerated": "Not generated yet",
    "playerProfile.refresh": "Refresh profile",
    "playerProfile.generate": "Generate profile",
    "playerProfile.reading": "Reading your shelf...",
    "playerProfile.pending":
      "Filazo is reading your library and notes. Keep this page open.",
    "playerProfile.refreshUnavailable": "Refresh is unavailable right now.",
    "playerProfile.emptyCatalogTitle": "Your catalog is quiet right now.",
    "playerProfile.emptyCatalogBody":
      "Add a few games first, then Filazo can say something useful about your taste.",
    "playerProfile.unavailableTitle": "Profile writing is unavailable right now.",
    "playerProfile.unavailableBody": "The rest of the guide still works.",
    "playerProfile.notWrittenTitle": "Your profile hasn't been written yet.",
    "playerProfile.notWrittenBody":
      "Use Generate profile and Filazo will read your games, playtime, favorites, and feedback.",
    "playerProfile.preferredGenres": "Preferred genres",
    "playerProfile.playStyles": "Play styles",
    "playerProfile.behaviorPatterns": "Behavior patterns",
    "playerProfile.fromCatalog": "From your own catalog",
    "playerProfile.traceTitle":
      "How the agent built this ({count} tool calls)",
    "manualSearch.eyebrow": "Manual add",
    "manualSearch.title": "Search for a game",
    "manualSearch.unavailableTitle": "Game search is not configured.",
    "manualSearch.unavailableBody":
      "Add metadata credentials before manually adding games.",
    "manualSearch.searchFailed": "Search failed.",
    "manualSearch.gameTitle": "Game title",
    "manualSearch.placeholder": "Chrono Trigger",
    "manualSearch.catalogResult": "Catalog result",
    "manualSearch.selected": "Selected",
    "manualSearch.add": "Add",
    "manualSearch.noMatches": "No matches yet.",
    "manualSearch.platform": "Platform",
    "manualSearch.platformPlaceholder": "Nintendo 64, PlayStation 1, PC...",
    "manualSearch.status": "Play status",
    "manualSearch.addToShelf": "Add to shelf",
    "manualSearch.status.playing": "Playing now",
    "manualSearch.status.owned": "Owned",
    "manualSearch.status.backlog": "Backlog",
    "manualSearch.status.completed": "Credits rolled",
    "manualSearch.status.dropped": "Dropped",
    "manualSearch.status.wishlist": "Wishlist",
    "voiceMemory.label": "Voice Memory",
    "voiceMemory.prompt": "Say what happened before it fades.",
    "voiceMemory.record": "Record Voice Memory",
    "voiceMemory.stop": "Stop Recording",
    "voiceMemory.recording": "Recording",
    "voiceMemory.none": "No voice memory yet",
    "voiceMemory.uploadInstead": "Upload Audio Instead",
    "voiceMemory.audioFile": "Audio File",
    "voiceMemory.stopBeforeSave":
      "Stop recording before saving this diary page.",
    "voiceMemory.browserUnavailable":
      "Recording is not available in this browser. You can still upload audio.",
    "voiceMemory.couldNotStart":
      "Could not start recording. Check microphone permission or upload audio instead.",
    "journal.label": "Journal",
    "journal.title": "Diary Pages",
    "journal.description":
      "Record the moment first. Writing, screenshots, and uploads stay tucked away as backup options.",
    "journal.openGame": "Open Game",
    "journal.savedCount": "{count} saved",
    "journal.startWithVoice": "Start With Your Voice",
    "journal.writeOrAddMore": "Write Instead Or Add More",
    "journal.pageTitle": "Page Title",
    "journal.pageTitlePlaceholder": "Before the next session",
    "journal.playedAround": "Played Around",
    "journal.dearDiary": "Dear Diary",
    "journal.bodyPlaceholder":
      "I stopped at... I want to remember... Next time I should try...",
    "journal.screenshot": "Screenshot",
    "journal.keepsakeCaption": "Keepsake Caption",
    "journal.keepsakePlaceholder": "What this memory shows",
    "journal.savePage": "Save Diary Page",
    "journal.chooseAnotherGame": "Choose Another Game",
    "journal.noPagesTitle": "No pages for this game yet.",
    "journal.noPagesBody":
      "A short voice note is enough to remember where you left off.",
    "journal.noGamesTitle": "No games available for journaling yet.",
    "journal.noGamesBody":
      "Add a game to your catalog first, then come back here to keep diary pages.",
    "journal.recentPages": "Recent Diary Pages",
    "journal.writingFor": "Writing For",
    "journal.pagesFor": "Pages For {name}",
    "journal.untitledPage": "Untitled Page",
    "journal.keepsakes": "Keepsakes",
    "journal.deletePage": "Delete this page",
    "journal.deleteConfirm":
      "Delete this diary page for good? Attached screenshots and voice notes go too.",
    "journal.deleteConfirmButton": "Delete page",
    "setup.label": "Setup",
    "setup.step1": "Step 1",
    "setup.step2": "Step 2",
    "setup.step.rhythm": "Rhythm",
    "setup.step.platforms": "Platforms",
    "setup.rhythm.title": "How often do you usually play?",
    "setup.rhythm.description":
      "A rough rhythm is enough. It helps keep suggestions realistic.",
    "setup.platforms.title": "Where do your games usually live?",
    "setup.platforms.description":
      "Pick the platforms that matter most right now. You can change this later.",
    "setup.frequency.skip": "Skip for now",
    "setup.frequency.monthly": "A few times a month",
    "setup.frequency.weekly12": "1-2 times a week",
    "setup.frequency.weeklyMany": "Several times a week",
    "setup.frequency.daily": "Daily",
    "setup.frequency.multiDaily": "Multiple times a day",
    "setup.window.morning": "Morning",
    "setup.window.afternoon": "Afternoon",
    "setup.window.evening": "Evening",
    "setup.window.lateNight": "Late night",
    "setup.window.weekdays": "Weekdays",
    "setup.window.weekends": "Weekends",
    "setup.platform.nintendo": "Nintendo",
    "setup.platform.mobile": "Mobile",
    "setup.platform.handheld": "Other handhelds",
    "setup.progress": "Setup progress",
    "setup.back": "Back",
    "setup.finish": "Finish",
    "setup.saveContinue": "Save and continue",
    "setup.playFrequency": "Play frequency",
    "setup.playWindows": "When you usually play",
    "setup.currentPlatforms": "Current platforms",
    "setup.otherPlatform": "Another platform",
    "setup.otherPlatformPlaceholder": "Vita, 3DS, emulator, arcade...",
    "setup.skipNow": "Skip for now",
    "setup.cleanChoices": "Clear these choices",
    "setup.cleanBody":
      "This removes the current setup answers so you can start over later.",
    "setup.cleanConfirm": "Clear setup",
    "setup.titleCompleted": "Play Preferences",
    "setup.titleOptional": "Setup Is Optional",
    "setup.titleStart": "Start With A Light Setup",
    "setup.descriptionFirst":
      "Answer only what helps. Each step saves before moving on.",
    "setup.descriptionEdit":
      "Adjust the preferences that shape recommendations and source prompts.",
    "setup.openSources": "Open Sources",

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
    "profile.importAudit.title": "Recent import audit",
    "profile.importAudit.row": "Row {index}",
    "profile.importAudit.pending": "pending",
    "profile.photoImport.label": "Photo import",
    "profile.photoImport.title": "Read games from screenshots",
    "profile.photoImport.description":
      "Upload screenshots or photos of a catalog page, shelf, or list. Detected titles are resolved into the same canonical catalog.",
    "profile.photoImport.ready": "Vision ready",
    "profile.photoImport.needsKey": "Needs AI key",
    "profile.photoImport.disabled": "Disabled by admin",
    "profile.photoImport.images": "Catalog images",
    "profile.photoImport.needsKeyBody":
      "Photo extraction needs OPENAI_API_KEY. Upload attempts are kept in the import audit with a clear skipped state.",
    "profile.photoImport.disabledBody":
      "Photo extraction is disabled in admin settings.",
    "profile.photoImport.submit": "Import from photos",
    "profile.reviews.label": "Review import",
    "profile.reviews.title": "Bring in your public reviews",
    "profile.reviews.body":
      "Steam public recommendations can be matched back to games already on your shelf. PlayStation and Xbox reviews are not exposed through the current source flows.",
    "profile.reviews.ready": "Steam ready",
    "profile.reviews.needsSteam": "Needs Steam",
    "profile.reviews.sync": "Sync reviews",
    "profile.reviews.checking": "Checking...",
    "profile.reviews.pending": "Checking public Steam recommendations.",
    "profile.reviews.connectFirst": "Connect Steam first.",

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
    "notFound.label": "Missing save",
    "notFound.title": "This save file doesn't exist.",
    "notFound.body":
      "The shelf is still here. Step back and pick up from a known slot.",
    "notFound.backShelf": "Back to the shelf",

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
    "tonight.dealHint": "Can't decide?",
    "tonight.dealMe": "Deal me a game",
    "tonight.signInTitle": "Sign in before choosing from the catalog.",
    "tonight.signInBody": "Your library will be here when you are ready.",
    "tonight.goToCatalog": "Go to the catalog",
    "tonight.fallbackReason":
      "A quiet pick from the games already in your catalog.",
    "tonight.action.pickAnother":
      "Pick another save when you are ready.",
    "tonight.action.alreadyCloseBy":
      "That save is already close by. Pick another when the room is ready.",
    "tonight.action.markedPlaying": "{name} is marked playing now.",

    "status.BACKLOG": "on the shelf",
    "status.OWNED": "owned",
    "status.WISHLIST": "still curious",
    "status.PLAYING": "playing now",
    "status.PLAYING_NEXT": "playing next",
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
    "signal.FINISH_BEFORE_RELEASE": "finish before launch",
    "signal.RISKY_TO_START_BEFORE_RELEASE": "poor launch-window start",
    "signal.UPCOMING_RELEASE_WATCH": "new release soon",

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
    "statusMessage.playingNextUpdated":
      "Playing next updated. Your queue is ready.",
    "statusMessage.playingNextCleared":
      "Playing next cleared. The queue is open whenever you need it.",
    "statusMessage.sourceConnected":
      "Source connected. Refresh it whenever you are ready.",
    "statusMessage.guideRefreshed":
      "Guide refreshed. {count} suggestions updated.",
    "statusMessage.playerProfileUpdated":
      "Player profile refreshed from your games, feedback, and reviews.",
    "statusMessage.playerProfileEmpty":
      "Your shelf is quiet right now. Add a few games before asking for a player profile.",
    "statusMessage.photoImported":
      "Photo import finished. {count} games were added or updated.",
    "statusMessage.manualAdded":
      "Game added. You can adjust it from your catalog whenever you want.",
    "statusMessage.reviewsSynced":
      "Review sync finished. {count} reviews were added or updated.",
    "statusMessage.journalSaved": "Diary page saved.",
    "statusMessage.journalDeleted": "Diary page deleted.",
    "statusMessage.onboardingUpdated":
      "Setup preferences saved. You can revisit them from the Setup tab.",
    "statusMessage.onboardingSkipped":
      "Onboarding skipped. The profile stays open and editable.",
    "statusMessage.onboardingCleared":
      "Setup choices cleared. Start again whenever you are ready.",

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
    "profileAction.needPlayingNextLogin":
      "Sign in before changing Playing next.",
    "profileAction.invalidPlayingNext":
      "Choose up to three games for Playing next.",
    "profileAction.onlyShelfGames":
      "Only games already on your shelf can be featured.",
    "profileAction.needFinishedLogin":
      "Sign in before detecting finished games.",
    "profileAction.finishedCheckFailed":
      "Credits-rolled check did not complete.",
    "profileAction.needReviewsLogin":
      "Sign in before syncing reviews.",
    "profileAction.reviewsSyncFailed": "Review sync did not complete.",
    "profileAction.needPhotoLogin":
      "Sign in before importing catalog photos.",
    "profileAction.photoUploadAtLeastOne":
      "Upload at least one catalog image.",
    "profileAction.photoOnlyImages":
      "Only image files can be used for photo import.",
    "profileAction.photoNoVisibleGames": "No visible games detected.",
    "profileAction.photoVisionUnavailable":
      "OPENAI_API_KEY is not configured for vision extraction.",
    "profileAction.photoNeedsAiKey": "Photo import needs OPENAI_API_KEY.",
    "profileAction.photoAiDisabled":
      "Photo import is disabled in admin settings.",
    "profileAction.photoFileTooLarge":
      "Each catalog image must be 4 MB or smaller.",
    "profileAction.photoLowConfidence":
      "Skipped for manual review because confidence was low.",
    "profileAction.photoRowFailed":
      "Photo import could not add this row.",
    "profileAction.photoImportFailed": "Photo import did not complete.",
    "profileAction.needJournalLogin":
      "Sign in before saving journal entries.",
    "profileAction.journalSaveFailed":
      "Journal entry could not be saved.",
    "profileAction.journalDeleteFailed":
      "Journal entry could not be deleted.",
    "profileAction.needManualAddLogin":
      "Sign in before adding games.",
    "profileAction.manualAddChooseGame":
      "Choose a game result before adding.",
    "profileAction.manualAddLoadFailed":
      "That game could not be loaded.",
    "assistantAction.needRefreshLogin":
      "Sign in before refreshing assistant insights.",
    "assistantAction.refreshFailed":
      "Assistant refresh did not complete.",
    "assistantAction.needProfileLogin":
      "Sign in before generating a player profile.",
    "assistantAction.profileFailed":
      "Player profile generation did not complete.",
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
    "common.apply": "Aplicar",
    "common.close": "Fechar",
    "common.skipToContent": "Pular para o conteúdo",
    "common.playtimeSoFar": "{value} até agora",
    "common.your": "suas",

    "nav.main": "Principal",
    "nav.footer": "Rodapé",
    "nav.profileSections": "Seções do perfil",

    "banner.beta.message": "filazo está em beta.",
    "banner.beta.cta": "Entre no nosso Discord",
    "banner.beta.dismiss": "Dispensar aviso de beta",

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
    "theme.auto": "Auto",
    "theme.autoLabel": "Auto - seguir a hora do dia",
    "theme.phase.morning": "manhã",
    "theme.phase.afternoon": "tarde",
    "theme.phase.dusk": "anoitecer",
    "theme.phase.evening": "noite",
    "theme.phase.night": "madrugada",

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
    "auth.browserRequired.kicker": "Login com Google",
    "auth.browserRequired.title": "Abra a filazo no navegador para continuar.",
    "auth.browserRequired.body":
      "O Google bloqueia login dentro de navegadores internos de apps como Threads, Instagram e Facebook. Abra esta página no Chrome, Safari, Edge ou outro navegador comum e tente o login com Google de novo.",
    "auth.browserRequired.notice":
      "Se você está vendo isto dentro de um app, use o menu do navegador desse app e escolha Abrir no navegador.",
    "auth.browserRequired.addressLabel": "Endereço da filazo",
    "auth.browserRequired.back": "Voltar para a filazo",
    "auth.browserRequired.open": "Abrir filazo",

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
    "auth.error.sessionExpired": "Sua sessão expirou. Entre novamente.",
    "auth.error.googleRegistrationClosed":
      "Novos registros estão fechados. Entre pelo cadastro de beta tester.",
    "auth.error.steamRegistrationClosed":
      "Novos registros estão fechados. Solicite acesso pelo cadastro beta antes de conectar Steam.",
    "auth.error.xboxRegistrationClosed":
      "Novos registros estão fechados. Solicite acesso pelo cadastro beta antes de conectar Xbox.",
    "auth.error.youtubeStartFailed":
      "Não foi possível iniciar o login beta.",
    "auth.error.youtubeMissingCode":
      "O provedor de login beta não retornou um código de autorização.",
    "auth.error.youtubeStateInvalid":
      "Não foi possível verificar o login beta.",
    "auth.error.youtubeCallbackFailed":
      "Não foi possível finalizar o login beta.",

    "landing.notice.database":
      "{message} Este ambiente precisa de um banco PostgreSQL acessível antes de carregar os recursos de catálogo.",
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
      "Entre com uma conta filazo existente ou uma conta Google já conhecida. Novos registros estão fechados; novos jogadores podem solicitar acesso beta com Google.",
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
    "beta.signInGoogle": "Entrar com Google e solicitar acesso",
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
      "Esta área é restrita ao admin. Entre com o Google usando ludmila.omlopes@gmail.com.",
    "admin.signInGoogle": "Entrar com Google",
    "admin.reviewed": "Solicitação atualizada.",
    "admin.email.sent": "E-mail de aprovação enviado.",
    "admin.email.skipped":
      "Aprovação atualizada, mas o e-mail não foi enviado porque o envio não está totalmente configurado.",
    "admin.email.failed":
      "Aprovação atualizada, mas o e-mail falhou. Envie manualmente por enquanto.",
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
    "admin.approvedEmails.kicker": "Fallback manual de e-mail",
    "admin.approvedEmails.title": "E-mails de testers aprovados",
    "admin.approvedEmails.empty": "Nenhum tester aprovado ainda.",
    "admin.error.justificationRequired":
      "Justificativa obrigatória para aprovar ou recusar.",
    "admin.ai.kicker": "Controles de IA",
    "admin.ai.title": "Orcamento e limites de IA",
    "admin.ai.body":
      "Configure quais recursos de IA podem rodar e os limites duros que cada um deve respeitar antes de abrir a plataforma para testers.",
    "admin.ai.save": "Salvar configuracoes de IA",
    "admin.ai.saved": "Configuracoes de IA atualizadas.",
    "admin.ai.invalidSettings":
      "As configuracoes de IA estavam fora dos intervalos aceitos.",

    "footer.tagline": "Seu catálogo, no seu ritmo.",
    "footer.madeFor": "feito para quem tem jogos demais",

    "profile.signedOut.label": "Seu catálogo",
    "profile.signedOut.title": "Conecte uma conta para começar.",
    "profile.signedOut.body":
      "Entre primeiro, depois conecte Steam, PlayStation, Xbox ou comece com um perfil local só de CSV. Comece pelo caminho mais fácil.",
    "profile.error.label": "Banco indisponível",
    "profile.error.title": "Sua biblioteca não pode carregar agora.",
    "profile.error.body":
      "{message} Este ambiente precisa de um banco PostgreSQL acessível antes de carregar os recursos de catálogo.",

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
    "profile.currentPlaying.title": "Jogando atualmente",
    "profile.currentPlaying.description":
      "escolha no máximo 3 jogos. É melhor pra você, confia",
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
    "profile.currentPlaying.clearTop": "Limpar tudo",
    "profile.currentPlaying.remove": "Remover {name}",
    "profile.currentPlaying.dragOut": 'Arraste para fora para remover',
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

    "profile.playingNext.label": "Jogar depois",
    "profile.playingNext.title": "Jogar depois",
    "profile.playingNext.description":
      "Mantenha ate 3 jogos prontos para quando um jogo atual sair da rotacao.",
    "profile.playingNext.inQueue": "{count} de 3 na fila",
    "profile.playingNext.spot": "Fila {slot}",
    "profile.playingNext.openTitle": "Espaco aberto na fila",
    "profile.playingNext.openBody":
      "Busque no catalogo algo para comecar assim que abrir um espaco.",
    "profile.playingNext.emptyTitle": "Ainda nao ha proximos jogos na fila.",
    "profile.playingNext.emptyBody":
      "Clique aqui para buscar no catalogo e adicionar ate tres proximas escolhas.",
    "profile.playingNext.chooseChange":
      "Escolha ou altere seus proximos jogos",
    "profile.playingNext.choose": "Escolha seus proximos jogos",
    "profile.playingNext.leaveOpen": "Deixar esse espaco vazio",
    "profile.playingNext.save": "Salvar jogar depois",
    "profile.playingNext.saving": "Salvando...",
    "profile.playingNext.clearTop": "Limpar fila",
    "profile.playingNext.remove": "Remover {name}",
    "profile.playingNext.help":
      "Jogos atuais e terminados ficam fora desta fila. Jogos largados pedem confirmacao antes de voltar.",
    "profile.playingNext.confirmDropped":
      "{name} esta marcado como largado. Tem certeza que quer tentar de novo?",
    "profile.playingNext.sameGenreWarning":
      "Os tres jogos da fila sao de {genre}. Considere incluir outro genero para evitar cansaco.",
    "profile.playingNext.longGamesWarning":
      "Os tres jogos da fila parecem longos. Considere trocar um por algo abaixo de {duration}.",
    "profile.playingNext.searchTitle": "Escolha um jogo",
    "profile.playingNext.searchLabel": "Buscar no catalogo de jogos",
    "profile.playingNext.searchPlaceholder": "Busque no IGDB por titulo",
    "profile.playingNext.searchFailed": "A busca de jogos falhou.",
    "profile.playingNext.catalogResult": "Resultado do catalogo",
    "profile.playingNext.owned": "na sua biblioteca",
    "profile.playingNext.notOwned": "ainda nao comprado",
    "profile.playingNext.alreadyQueued": "ja esta na fila",
    "profile.playingNext.queueThis": "Enfileirar",
    "profile.playingNext.searching": "Buscando...",
    "profile.playingNext.noMatches": "Ainda sem resultados.",

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
    "profile.shelf.statusSort": "Status",
    "profile.shelf.newest": "Mais recentes",
    "profile.shelf.playtime": "Tempo de jogo",
    "profile.shelf.titleSort": "Título",
    "profile.shelf.emptyTitle": "Sua estante está pronta. Traga alguns jogos.",
    "profile.shelf.emptyBody":
      "Sincronize uma plataforma ou importe um CSV e o catálogo vira algo navegável.",
    "profile.shelf.gameCount": "{count} jogos",
    "profile.shelf.gameCountOne": "1 jogo",
    "shelf.unknownPlatform": "Plataforma desconhecida",
    "shelf.includeDormantChip": "Incluindo largados e não iniciados",
    "shelf.includeDormantLabel": "Incluir jogos largados e não iniciados",
    "shelf.updateStatus": "Atualizar status",
    "shelf.restoreBeforeCredits": "Restaure este jogo antes de marcar créditos concluídos",
    "shelf.creditsRolled": "Créditos concluídos",
    "shelf.rollCredits": "Marcar créditos",
    "shelf.return": "Voltar",
    "shelf.dropped": "Largou",
    "assistant.corner.eyebrow": "Notas do guia",
    "assistant.corner.title": "Uma leitura mais calma do seu catálogo",
    "assistant.corner.openTonight": "Abrir hoje",
    "assistant.tab.label": "Guia",
    "assistant.tab.refreshHelp":
      "Atualize as sugestões depois de adicionar jogos ou mudar sua estante.",
    "assistant.tab.usage": "Detalhes de uso",
    "assistant.tab.availableToday": "Notas disponíveis hoje:",
    "assistant.tab.usedToday": "Usado hoje:",
    "assistant.tab.nextRefresh": "Próxima atualização:",
    "assistant.tab.unavailable": "indisponível",
    "assistant.tab.refresh": "Atualizar guia",
    "assistant.tab.availableNow": "disponível agora",
    "assistant.tab.inOneMinute": "em 1 minuto",
    "assistant.tab.inMinutes": "em {count} minutos",
    "assistant.buy.eyebrow": "Pensando em comprar?",
    "assistant.buy.title": "Comprar, esperar, seguir curiosa ou passar",
    "libraryChat.label": "Chat da biblioteca",
    "libraryChat.title": "Pergunte qualquer coisa para sua coleção",
    "libraryChat.body": "As respostas vêm dos seus próprios jogos, tempo de jogo e notas.",
    "libraryChat.unavailableTitle": "O chat está indisponível agora.",
    "libraryChat.unavailableBody": "O resto do guia continua funcionando.",
    "libraryChat.tryOne": "Tente uma destas para começar:",
    "libraryChat.prompt.shortSession": "O que eu deveria jogar se só tenho uma hora hoje?",
    "libraryChat.prompt.taste": "O que minha biblioteca diz sobre meu gosto ultimamente?",
    "libraryChat.prompt.return": "Qual jogo inacabado parece mais fácil de retomar?",
    "libraryChat.checking": "Olhando sua biblioteca...",
    "libraryChat.paused": "Chat pausado:",
    "libraryChat.unexpectedError": "erro inesperado.",
    "libraryChat.tryAgain": "Tente de novo quando quiser.",
    "libraryChat.placeholder":
      "Pergunte sobre seus jogos, seu gosto ou o que jogar depois",
    "libraryChat.thinking": "Pensando...",
    "libraryChat.send": "Enviar",
    "libraryChat.tool.overview": "visão da biblioteca",
    "libraryChat.tool.games": "lista de jogos",
    "libraryChat.tool.feedback": "feedback da jogadora",
    "libraryChat.tool.genres": "estatísticas de gênero",
    "playerProfile.label": "Perfil de jogadora",
    "playerProfile.title": "Quem você é como jogadora",
    "playerProfile.body":
      "Uma leitura curta do seu gosto, baseada na sua biblioteca, tempo de jogo e notas. Atualize depois de adicionar feedback.",
    "playerProfile.generated": "Gerado em {date}",
    "playerProfile.notGenerated": "Ainda não gerado",
    "playerProfile.refresh": "Atualizar perfil",
    "playerProfile.generate": "Gerar perfil",
    "playerProfile.reading": "Lendo sua estante...",
    "playerProfile.pending":
      "A filazo está lendo sua biblioteca e notas. Deixe esta página aberta.",
    "playerProfile.refreshUnavailable": "A atualização está indisponível agora.",
    "playerProfile.emptyCatalogTitle": "Seu catálogo está silencioso agora.",
    "playerProfile.emptyCatalogBody":
      "Adicione alguns jogos primeiro, então a filazo pode dizer algo útil sobre seu gosto.",
    "playerProfile.unavailableTitle": "A escrita do perfil está indisponível agora.",
    "playerProfile.unavailableBody": "O resto do guia continua funcionando.",
    "playerProfile.notWrittenTitle": "Seu perfil ainda não foi escrito.",
    "playerProfile.notWrittenBody":
      "Use Gerar perfil e a filazo vai ler seus jogos, tempo de jogo, favoritos e feedback.",
    "playerProfile.preferredGenres": "Gêneros preferidos",
    "playerProfile.playStyles": "Estilos de jogo",
    "playerProfile.behaviorPatterns": "Padrões de comportamento",
    "playerProfile.fromCatalog": "Do seu próprio catálogo",
    "playerProfile.traceTitle":
      "Como o agente montou isso ({count} chamadas de ferramenta)",
    "manualSearch.eyebrow": "Adição manual",
    "manualSearch.title": "Buscar um jogo",
    "manualSearch.unavailableTitle": "A busca de jogos não está configurada.",
    "manualSearch.unavailableBody":
      "Adicione credenciais de metadados antes de incluir jogos manualmente.",
    "manualSearch.searchFailed": "A busca falhou.",
    "manualSearch.gameTitle": "Título do jogo",
    "manualSearch.placeholder": "Chrono Trigger",
    "manualSearch.catalogResult": "Resultado do catálogo",
    "manualSearch.selected": "Selecionado",
    "manualSearch.add": "Adicionar",
    "manualSearch.noMatches": "Ainda sem resultados.",
    "manualSearch.platform": "Plataforma",
    "manualSearch.platformPlaceholder": "Nintendo 64, PlayStation 1, PC...",
    "manualSearch.status": "Status de jogo",
    "manualSearch.addToShelf": "Adicionar à estante",
    "manualSearch.status.playing": "Jogando agora",
    "manualSearch.status.owned": "Seu",
    "manualSearch.status.backlog": "Na estante",
    "manualSearch.status.completed": "Créditos concluídos",
    "manualSearch.status.dropped": "Largou",
    "manualSearch.status.wishlist": "Na mira",
    "voiceMemory.label": "Memória de voz",
    "voiceMemory.prompt": "Diga o que aconteceu antes que isso se apague.",
    "voiceMemory.record": "Gravar memória de voz",
    "voiceMemory.stop": "Parar gravação",
    "voiceMemory.recording": "Gravando",
    "voiceMemory.none": "Ainda sem memória de voz",
    "voiceMemory.uploadInstead": "Enviar áudio em vez disso",
    "voiceMemory.audioFile": "Arquivo de áudio",
    "voiceMemory.stopBeforeSave":
      "Pare a gravação antes de salvar esta página do diário.",
    "voiceMemory.browserUnavailable":
      "A gravação não está disponível neste navegador. Você ainda pode enviar áudio.",
    "voiceMemory.couldNotStart":
      "Não foi possível começar a gravar. Verifique a permissão do microfone ou envie áudio no lugar.",
    "journal.label": "Diário",
    "journal.title": "Páginas de diário",
    "journal.description":
      "Registre o momento primeiro. Escrita, screenshots e uploads ficam guardados como opções de apoio.",
    "journal.openGame": "Abrir jogo",
    "journal.savedCount": "{count} salvas",
    "journal.startWithVoice": "Comece com a sua voz",
    "journal.writeOrAddMore": "Escreva em vez disso ou adicione mais",
    "journal.pageTitle": "Título da página",
    "journal.pageTitlePlaceholder": "Antes da próxima sessão",
    "journal.playedAround": "Jogado por volta de",
    "journal.dearDiary": "Querido diário",
    "journal.bodyPlaceholder":
      "Parei em... Quero lembrar... Da próxima vez eu deveria tentar...",
    "journal.screenshot": "Screenshot",
    "journal.keepsakeCaption": "Legenda da lembrança",
    "journal.keepsakePlaceholder": "O que esta memória mostra",
    "journal.savePage": "Salvar página do diário",
    "journal.chooseAnotherGame": "Escolher outro jogo",
    "journal.noPagesTitle": "Ainda não há páginas para este jogo.",
    "journal.noPagesBody":
      "Uma nota de voz curta já basta para lembrar onde você parou.",
    "journal.noGamesTitle": "Ainda não há jogos disponíveis para o diário.",
    "journal.noGamesBody":
      "Adicione um jogo ao seu catálogo primeiro, depois volte aqui para guardar páginas de diário.",
    "journal.recentPages": "Páginas recentes do diário",
    "journal.writingFor": "Escrevendo para",
    "journal.pagesFor": "Páginas para {name}",
    "journal.untitledPage": "Página sem título",
    "journal.keepsakes": "Lembranças",
    "journal.deletePage": "Excluir esta página",
    "journal.deleteConfirm":
      "Excluir esta página do diário de vez? As capturas de tela e notas de voz anexadas também serão removidas.",
    "journal.deleteConfirmButton": "Excluir página",
    "setup.label": "Setup",
    "setup.step1": "Etapa 1",
    "setup.step2": "Etapa 2",
    "setup.step.rhythm": "Ritmo",
    "setup.step.platforms": "Plataformas",
    "setup.rhythm.title": "Com que frequência você costuma jogar?",
    "setup.rhythm.description":
      "Um ritmo aproximado já basta. Isso ajuda a manter as sugestões realistas.",
    "setup.platforms.title": "Onde seus jogos costumam viver?",
    "setup.platforms.description":
      "Escolha as plataformas que mais importam agora. Você pode mudar isso depois.",
    "setup.frequency.skip": "Pular por enquanto",
    "setup.frequency.monthly": "Algumas vezes por mês",
    "setup.frequency.weekly12": "1-2 vezes por semana",
    "setup.frequency.weeklyMany": "Várias vezes por semana",
    "setup.frequency.daily": "Todo dia",
    "setup.frequency.multiDaily": "Várias vezes por dia",
    "setup.window.morning": "Manhã",
    "setup.window.afternoon": "Tarde",
    "setup.window.evening": "Noite",
    "setup.window.lateNight": "Madrugada",
    "setup.window.weekdays": "Dias de semana",
    "setup.window.weekends": "Fins de semana",
    "setup.platform.nintendo": "Nintendo",
    "setup.platform.mobile": "Celular",
    "setup.platform.handheld": "Outros portáteis",
    "setup.progress": "Progresso do setup",
    "setup.back": "Voltar",
    "setup.finish": "Concluir",
    "setup.saveContinue": "Salvar e continuar",
    "setup.playFrequency": "Frequência de jogo",
    "setup.playWindows": "Quando você costuma jogar",
    "setup.currentPlatforms": "Plataformas atuais",
    "setup.otherPlatform": "Outra plataforma",
    "setup.otherPlatformPlaceholder": "Vita, 3DS, emulador, arcade...",
    "setup.skipNow": "Pular por enquanto",
    "setup.cleanChoices": "Limpar estas escolhas",
    "setup.cleanBody":
      "Isso remove as respostas atuais do setup para que você possa recomeçar depois.",
    "setup.cleanConfirm": "Limpar setup",
    "setup.titleCompleted": "Preferências de jogo",
    "setup.titleOptional": "A configuração é opcional",
    "setup.titleStart": "Comece com uma configuração leve",
    "setup.descriptionFirst":
      "Responda só o que ajuda. Cada etapa salva antes de avançar.",
    "setup.descriptionEdit":
      "Ajuste as preferências que moldam recomendações e sugestões de fontes.",
    "setup.openSources": "Abrir fontes",

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
    "profile.importAudit.title": "Auditoria recente de importação",
    "profile.importAudit.row": "Linha {index}",
    "profile.importAudit.pending": "pendente",
    "profile.photoImport.label": "Importação por foto",
    "profile.photoImport.title": "Ler jogos de screenshots",
    "profile.photoImport.description":
      "Envie screenshots ou fotos de uma página de catálogo, estante ou lista. Os títulos detectados são resolvidos no mesmo catálogo canônico.",
    "profile.photoImport.ready": "Visão pronta",
    "profile.photoImport.needsKey": "Precisa de chave de IA",
    "profile.photoImport.disabled": "Desativado pelo admin",
    "profile.photoImport.images": "Imagens do catálogo",
    "profile.photoImport.needsKeyBody":
      "A extração por foto precisa de OPENAI_API_KEY. As tentativas de upload ficam registradas na auditoria de importação com um estado claro de ignorado.",
    "profile.photoImport.disabledBody":
      "A extracao por foto esta desativada nas configuracoes de admin.",
    "profile.photoImport.submit": "Importar das fotos",
    "profile.reviews.label": "Importação de reviews",
    "profile.reviews.title": "Trazer seus reviews públicos",
    "profile.reviews.body":
      "As recomendações públicas da Steam podem ser associadas aos jogos que já estão na sua estante. Reviews de PlayStation e Xbox não são expostos pelos fluxos atuais.",
    "profile.reviews.ready": "Steam pronta",
    "profile.reviews.needsSteam": "Precisa de Steam",
    "profile.reviews.sync": "Sincronizar reviews",
    "profile.reviews.checking": "Verificando...",
    "profile.reviews.pending": "Verificando recomendações públicas da Steam.",
    "profile.reviews.connectFirst": "Conecte a Steam primeiro.",

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
    "notFound.label": "Save perdido",
    "notFound.title": "Esse arquivo de save não existe.",
    "notFound.body":
      "A estante continua aqui. Volte um passo e retome de um slot conhecido.",
    "notFound.backShelf": "Voltar para a estante",

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
    "tonight.dealHint": "Não consegue decidir?",
    "tonight.dealMe": "Sortear um jogo",
    "tonight.signInTitle": "Entre antes de escolher no catálogo.",
    "tonight.signInBody": "Sua biblioteca vai estar aqui quando você quiser.",
    "tonight.goToCatalog": "Ir para o catálogo",
    "tonight.fallbackReason":
      "Uma escolha silenciosa entre os jogos que já estão no seu catálogo.",
    "tonight.action.pickAnother":
      "Escolha outro save quando quiser.",
    "tonight.action.alreadyCloseBy":
      "Esse save já está por perto. Escolha outro quando o clima pedir.",
    "tonight.action.markedPlaying": "{name} foi marcado como jogando agora.",

    "status.BACKLOG": "na estante",
    "status.OWNED": "seu",
    "status.WISHLIST": "ainda em observação",
    "status.PLAYING": "jogando agora",
    "status.PLAYING_NEXT": "jogar depois",
    "status.PAUSED": "pausado",
    "status.COMPLETED": "concluído",
    "status.FINISHED": "concluído",
    "status.DROPPED": "largou",

    "signal.UNTOUCHED": "pronto quando você quiser",
    "signal.SAMPLED_DROPPED": "só experimentado",
    "signal.STALE_PLAYING": "pausado no meio do caminho",
    "signal.FINISHABLE_SOON": "retorno curto",
    "signal.LIKELY_FINISHED": "os créditos podem ter rolado",
    "signal.WISHLIST_RISK": "ainda em observação",
    "signal.BUY_RISK": "espere antes de comprar",
    "signal.RETURN_CANDIDATE": "vale um retorno leve",
    "signal.RELEASE_CANDIDATE": "pronto para liberar",
    "signal.FINISH_BEFORE_RELEASE": "terminar antes do lançamento",
    "signal.RISKY_TO_START_BEFORE_RELEASE": "ruim para começar agora",
    "signal.UPCOMING_RELEASE_WATCH": "lançamento perto",

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
    "statusMessage.playingNextUpdated":
      "Jogar depois atualizado. Sua fila esta pronta.",
    "statusMessage.playingNextCleared":
      "Jogar depois limpo. A fila fica aberta quando voce precisar.",
    "statusMessage.sourceConnected":
      "Fonte conectada. Atualize quando quiser.",
    "statusMessage.guideRefreshed":
      "Guia atualizado. {count} sugestões mudaram.",
    "statusMessage.playerProfileUpdated":
      "Perfil de jogadora atualizado com base nos seus jogos, feedbacks e reviews.",
    "statusMessage.playerProfileEmpty":
      "Sua estante está silenciosa agora. Adicione alguns jogos antes de pedir um perfil de jogadora.",
    "statusMessage.photoImported":
      "Importação de fotos concluída. {count} jogos foram adicionados ou atualizados.",
    "statusMessage.manualAdded":
      "Jogo adicionado. Você pode ajustar isso no seu catálogo quando quiser.",
    "statusMessage.reviewsSynced":
      "Sincronização de reviews concluída. {count} reviews foram adicionados ou atualizados.",
    "statusMessage.journalSaved": "Página do diário salva.",
    "statusMessage.journalDeleted": "Página do diário excluída.",
    "statusMessage.onboardingUpdated":
      "Preferências de configuração salvas. Você pode revisitar isso na aba Setup.",
    "statusMessage.onboardingSkipped":
      "Onboarding pulado. O perfil continua aberto e editável.",
    "statusMessage.onboardingCleared":
      "Escolhas de configuração limpas. Comece de novo quando quiser.",

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
    "profileAction.needPlayingNextLogin":
      "Entre antes de alterar Jogar depois.",
    "profileAction.invalidPlayingNext":
      "Escolha até três jogos para Jogar depois.",
    "profileAction.onlyShelfGames":
      "Só jogos que já estão na sua estante podem ser destacados.",
    "profileAction.needFinishedLogin":
      "Entre antes de detectar jogos terminados.",
    "profileAction.finishedCheckFailed":
      "A verificação de créditos concluídos não terminou.",
    "profileAction.needReviewsLogin":
      "Entre antes de sincronizar reviews.",
    "profileAction.reviewsSyncFailed":
      "A sincronização de reviews não terminou.",
    "profileAction.needPhotoLogin":
      "Entre antes de importar fotos do catálogo.",
    "profileAction.photoUploadAtLeastOne":
      "Envie pelo menos uma imagem do catálogo.",
    "profileAction.photoOnlyImages":
      "A importação por foto aceita apenas arquivos de imagem.",
    "profileAction.photoNoVisibleGames":
      "Nenhum jogo visível foi detectado.",
    "profileAction.photoVisionUnavailable":
      "OPENAI_API_KEY não está configurada para extração por visão.",
    "profileAction.photoNeedsAiKey":
      "A importação por foto precisa de OPENAI_API_KEY.",
    "profileAction.photoAiDisabled":
      "A importacao por foto esta desativada nas configuracoes de admin.",
    "profileAction.photoFileTooLarge":
      "Cada imagem do catalogo deve ter no maximo 4 MB.",
    "profileAction.photoLowConfidence":
      "Ignorado para revisão manual porque a confiança estava baixa.",
    "profileAction.photoRowFailed":
      "A importação por foto não conseguiu adicionar esta linha.",
    "profileAction.photoImportFailed":
      "A importação de fotos não terminou.",
    "profileAction.needJournalLogin":
      "Entre antes de salvar entradas de diário.",
    "profileAction.journalSaveFailed":
      "A entrada de diário não pôde ser salva.",
    "profileAction.journalDeleteFailed":
      "A entrada de diário não pôde ser excluída.",
    "profileAction.needManualAddLogin":
      "Entre antes de adicionar jogos.",
    "profileAction.manualAddChooseGame":
      "Escolha um resultado de jogo antes de adicionar.",
    "profileAction.manualAddLoadFailed":
      "Esse jogo não pôde ser carregado.",
    "assistantAction.needRefreshLogin":
      "Entre antes de atualizar os insights do assistente.",
    "assistantAction.refreshFailed":
      "A atualização do assistente não terminou.",
    "assistantAction.needProfileLogin":
      "Entre antes de gerar um perfil de jogadora.",
    "assistantAction.profileFailed":
      "A geração do perfil de jogadora não terminou.",
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
