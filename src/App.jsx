import React, { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

// ─── SUPABASE CONFIG ──────────────────────────────────────────────────────────
// These come from environment variables (set per-deployment in Vercel,
// or in a local .env file) instead of being hardcoded, so the same codebase
// can be deployed for multiple clans, each pointing at their own Supabase
// project. See the .env.example file / setup notes for how to configure
// these for a new clan.
const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPA_URL || !SUPA_KEY) {
  // Fail loudly and early rather than silently sending requests to
  // "undefined" — this is much easier to debug than mysterious empty
  // tables later.
  throw new Error(
    "Missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY " +
    "in your Vercel project's Environment Variables (Settings \u2192 Environment Variables), " +
    "or in a local .env file for development."
  );
}

// ─── PUSH NOTIFICATIONS CONFIG ───────────────────────────────────────────────
// The PUBLIC VAPID key is safe to ship in frontend code — it's only used by
// the browser to identify which app a push subscription belongs to. The
// matching PRIVATE key lives only in the Vercel serverless function
// (api/send-push.js), never here. If this isn't set, push notifications are
// silently unavailable (no permission prompt shown) rather than crashing
// the app — this feature should be optional, not load-bearing.
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";


// Lets each clan's deployment show its own name/quote without forking the
// code. All four fall back to the original Peaky Blinders branding if a
// clan's Vercel project doesn't set these — so existing deployments that
// haven't added these env vars yet keep working exactly as before.
const CLAN_NAME = import.meta.env.VITE_CLAN_NAME || "Peaky Blinders";
const CLAN_SUBTITLE = import.meta.env.VITE_CLAN_SUBTITLE || "Clan Stronghold";
const CLAN_QUOTE = import.meta.env.VITE_CLAN_QUOTE || "You touch one of us, you fight us all.";
const CLAN_SEASON_LABEL = import.meta.env.VITE_CLAN_SEASON_LABEL || "Season 4";
// Grammatically-correct possessive for any clan name: "Warriors" -> "Warriors'",
// "Peaky Blinders" -> "Peaky Blinders'", "RedTed" -> "RedTed's".
function possessive(name) {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

// ─── i18n (English / Mandarin) ────────────────────────────────────────────────
// A from-scratch, dependency-free translation system. Strings live in TRANSLATIONS
// keyed by a short id; t(key) looks up the current language's string, falling
// back to English if a key is ever missing in the Mandarin dictionary (so a
// missed translation shows English text instead of a blank/broken label).
//
// Adding a new translatable string: pick a key, add it to BOTH the "en" and
// "zh" objects below, then call t("yourKey") in the component instead of a
// literal string.
const TRANSLATIONS = {
  en: {
    // Login screen
    username: "Username",
    password: "Password",
    enterUsername: "Enter username…",
    enterPassword: "Enter password…",
    enter: "Enter",
    continueAsGuest: "Continue as Guest — view without logging in",
    logIn: "Log In",
    guestModeLabel: "Guest — Read Only",
    invalidLogin: "Invalid username or password.",
    contactMaster: "Contact your Master to get access.",
    // Nav
    dashboard: "Dashboard",
    leaderboards: "Leaderboards",
    members: "Members",
    attendance: "Attendance",
    auctions: "Auctions",
    reports: "Reports",
    menu: "Menu",
    logOut: "Log Out",
    addMember: "+ Add Member",
    discord: "Discord",
    linkDiscord: "Link Discord",
    changePasswordLabel: "Password",
    approvals: "Approvals",
    changePassword: "Change Password",
    coinsLabel: "coins",
    welcomeBackTitle: "Welcome back,",
    loginSummaryDesc: "Here's what happened since your last visit:",
    sinceLastVisitLabel: "Since Your Last Visit",
    featuredCountLabel: "featured",
    closestEndsLabel: "closest ends in",
    currentBalanceLabel: "Your current balance",
    fromAttendance: "from attendance",
    fromBonuses: "from bonuses",
    fromDecay: "weekly decay",
    bonusesEarned: "Bonuses Earned",
    auctionsWon: "Auctions Won",
    gotIt: "Got It",
    nothingNewMessage: "Nothing new since last time — check back later!",
    dontShowToday: "Don't show again today",
    loginAnnouncementTitle: "Login Announcement",
    loginAnnouncementDesc: "Posted at the top of everyone's login summary popup until they personally dismiss it.",
    loginAnnouncementLabel: "Current announcement:",
    loginAnnouncementPlaceholder: "e.g. A rare item is now up for auction — check it out!",
    noAnnouncementSet: "No announcement set",
    putInNewsTitle: "Put in News",
    putInNewsBtn: "Put in News",
    postAllToDiscordBtn: "Post Live Auctions to Discord",
    outbidPopupTitle: "You've been outbid!",
    outbidPopupBody1: "just outbid you on",
    outbidPopupNewBid: "New top bid:",
    outbidPopupDismiss: "Dismiss",
    outbidPopupGoBid: "Go Bid",
    postToNewsLabel: "Also post this to everyone's login news",
    postAnnouncementBtn: "Post Announcement",
    dismissAnnouncementTitle: "Dismiss this announcement",
    removeFromNewsTitle: "Remove from News",
    removeFromNewsBtn: "Remove from News",
    auctionNewsTitle: "Up for Auction",
    clearBtn: "Clear",
    balanceRemaining: "Balance Remaining",
    // Page titles
    pageTitle_dashboard: "Clan HQ",
    pageTitle_attendance: "Attendance",
    pageTitle_members: "Members",
    pageTitle_auctions: "Auction House",
    pageTitle_leaderboard: "Hall of Fame",
    pageTitle_export: "Export Data",
    pageTitle_settings: "Settings",
    // Nav sections
    navSection_main: "Main",
    navSection_management: "Management",
    navSection_reports: "Reports",
    navSection_myClan: "My Clan",
    navSection_adminTools: "Admin Tools",
    // Nav sub-items
    sub_clanStats: "Clan Stats",
    sub_worldBoss: "World Boss",
    sub_liveAuctions: "Live Auctions",
    sub_weeklyTop: "Weekly Top",
    sub_topPower: "Top Power",
    sub_richest: "Richest",
    sub_topAttendance: "Top Attendance",
    sub_auctionWinners: "Auction Winners",
    sub_memberRoster: "Member Roster",
    sub_profiles: "Profiles",
    sub_coinPowerAdjust: "Coin & Power Adjust",
    sub_recordAttendance: "Record Attendance",
    sub_history: "History",
    sub_eventTracker: "Event Tracker",
    sub_lootRoulette: "Loot Roulette",
    sub_createAuction: "Create Auction",
    // Dashboard
    warriors: "Warriors",
    liveAuctions: "Live Auctions",
    clanTotalPower: "Clan Total Power",
    acrossWarriors: "Across {count} warriors",
    reigningChampion: "Reigning Champion",
    totalWarriors: "Total Warriors",
    coinsInCirculation: "Coins in Circulation",
    sevenDayStreak: "7-Day Streak",
    yourPower: "Your power",
    yourCoins: "Your coins",
    classComposition: "Class Composition",
    noActiveAuctions: "No active auctions.",
    topBidderLabel: "Top",
    noBids: "No bids",
    viewAllAuctions: "View All Auctions",
    topAttendance: "Top Attendance",
    topPower: "Top Power",
    richest: "Richest",
    recentWinners: "Recent Winners",
    noRecentWinners: "No recent winners.",
    eventPoints: "Event Points",
    // Members page
    searchWarrior: "Search warrior…",
    allClasses: "All",
    sortCoins: "Sort: Coins",
    sortPower: "Sort: Power",
    sortAttendance: "Sort: Attendance",
    sortName: "Sort: Name",
    tableView: "Table",
    cardsView: "Cards",
    colRank: "#",
    colCharacter: "Character",
    colPower: "Power",
    colCoins: "Coins",
    colBalance: "Balance",
    colAttend: "Attend.",
    colWins: "Wins",
    colRole: "Role",
    colActions: "Actions",
    joinedOn: "Joined",
    remove: "Remove",
    memberRemoved: "Member removed.",
    removed: "Removed",
    statCoins: "Coins",
    statAttendance: "Attendance",
    statWins: "Wins",
    statJoined: "Joined",
    powerLabel: "Power",
    adjustCoins: "Adjust Coins",
    adjustPower: "Adjust Power",
    editDiscord: "Edit Discord",
    rename: "✎ Rename",
    changeRole: "Change Role",
    toMember: "→ Member",
    toElder: "→ Elder",
    toMaster: "→ Master",
    removeMember: "Remove Member",
    setToMember: "set to Member.",
    promotedToElder: "promoted to Elder.",
    nowMaster: "is now Master!",
    roleChanged: "Role Changed",
    // Attendance page
    tabRecordAttendance: "Record Attendance",
    tabHistory: "History",
    tabBonuses: "Bonuses",
    tabMyLog: "My Points History",
    tabGlobalLog: "Global Points Log",
    totalLogsLabel: "Total Logs",
    thisWeekLabel: "This Week",
    latestEventLabel: "Latest Event",
    elderOnlyAttendance: "Only Elders and Leaders can record attendance.",
    coinRules: "Coin Rules",
    full: "Full",
    late: "Late",
    afk: "AFK",
    searchMember: "Search member...",
    submitAttendance: "Submit Attendance",
    clear: "Clear",
    addMissingRecord: "+ Add Missing Record",
    noAttendanceYet: "No attendance recorded yet.",
    membersCountLabel: "members",
    downloadCsvTitle: "Download this event's attendance as CSV",
    removeAction: "✕ Remove",
    attendeesLabel: "Attendees",
    pageOf: "Page",
    ofLabel: "of",
    prevPage: "← Prev",
    nextPage: "Next →",
    noWarriorMatch: "No warrior matches your search.",
    bonusRules: "Bonus Rules",
    bonusRuleMajor: "Major Events — attend all 8 event types this week: ISB (×1), CA (×2), STI (×2), CS (×1), and all 4 World Bosses (×2 each):",
    bonusRuleSindri: "Sindri Veteran — attend 2× Sindri's Treasure Island per week for {n} weeks:",
    bonusOneTime: "(one-time)",
    bonusRuleISB: "ISB Veteran — participate in {n} Inter-Server Battles (lifetime):",
    bonusRuleIron: "Iron Streak — attend all major events {n} weeks running (lifetime):",
    bonusSettingsTitle: "Bonus Settings",
    bonusSettingsDesc: "Edit the coin amounts and thresholds for the attendance bonuses below. Changes apply immediately to both new bonus payouts and everyone's progress display.",
    bonusSettingsSaved: "Bonus settings saved.",
    updatedTitle: "Updated",
    majorEventsBonusLabel: "Major Events bonus:",
    sindriVeteranBonusLabel: "Sindri Veteran bonus:",
    sindriVeteranThresholdLabel: "Sindri Veteran weeks required:",
    isbVeteranBonusLabel: "ISB Veteran bonus:",
    isbVeteranThresholdLabel: "ISB Veteran events required:",
    ironStreakBonusLabel: "Iron Streak bonus:",
    ironStreakThresholdLabel: "Iron Streak weeks required:",
    decayWarningPrefix: "Unused coins decay",
    decayWarningSuffix: "every Tuesday. Stay active!",
    decayBadgeSuffix: "week",
    majorEvents: "Major Events",
    earned: "✓ Earned",
    sindriVeteran: "Sindri Veteran",
    weeksLabel: "weeks",
    sindriProgress: "weeks with 2× Sindri's",
    isbVeteran: "ISB Veteran",
    isbProgress: "ISB events",
    ironStreak: "Iron Streak",
    ironStreakProgress: "weeks running",
    myPointsHistoryTitle: "My Points History — Private",
    myPointsHistoryDesc: "Attendance, bonuses, admin coin adjustments, auction wins, and weekly decay. Only you can see this record.",
    adminPointsHistoryTitle: "Points History",
    adminPointsHistoryDesc: "Attendance, bonuses, admin coin adjustments, auction wins, and weekly decay for this member.",
    noPointsHistory: "No points history recorded yet.",
    noEntriesFilter: "No entries match this filter.",
    globalPointsTitle: "Global Points History",
    globalPointsDesc: "Admin manual adjustments, bonuses, and weekly decay — visible to everyone.",
    noGlobalAdjustments: "No global point adjustments yet.",
    colDateTime: "Date & Time",
    colEvent: "Event",
    colMembers: "Members",
    colRecBy: "Rec. By",
    colType: "Type",
    colDetails: "Details",
    colMember: "Member",
    colAmount: "Amount",
    colAddedBy: "Added By",
    colReason: "Reason",
    markMembers: "Mark Members",
    hideAttendees: "▲ Hide",
    showAttendees: "▼ Show",
    weeklyCoinDecay: "Weekly Coin Decay",
    weeklyDecayDetail: "Weekly coin decay",
    // Stored transaction-type category labels (the underlying data stays in
    // English in storage — these are only used to translate them for display).
    type_Attendance: "Attendance",
    type_MajorEventsBonus: "Major Events Bonus",
    type_ISBVeteranBonus: "ISB Veteran Bonus",
    type_SindriVeteranBonus: "Sindri Veteran Bonus",
    type_BonusPoints: "Bonus Points",
    type_ElderRequest: "Elder Request",
    type_AdminManualAdd: "Admin Manual Add",
    type_BidPlaced: "Bid Placed",
    type_OutbidRefund: "Outbid Refund",
    type_AuctionWin: "Auction Win",
    type_WeeklyDecay: "Weekly Decay",
    type_BalanceCorrection: "Balance Correction",
    allMembersLabel: "All Members",
    fileDownloaded: "downloaded!",
    exportLabel: "Export",
    selectEventError: "Please select an event.",
    errorLabel: "Error",
    noMembersSelected: "No members selected.",
    attendanceRecorded: "Attendance recorded!",
    membersUpdated: "members updated.",
    attendanceSaved: "Attendance Saved",
    earnedBonusText: "earned",
    coinsText: "coins",
    bonusText: "Bonus!",
    bonusAwarded: "Bonus Awarded",
    // Auctions page
    tabLiveAuctions: "Live Auctions",
    tabAuctionHistory: "History",
    tabLootRoulette: "Loot Roulette",
    tabCreateAuction: "Create Auction",
    liveBidValueLabel: "Live Bid Value",
    endingSoonestLabel: "Ending Soonest",
    sortLabel: "Sort:",
    viewLabel: "View:",
    sortDefault: "Default",
    sortBidHighLow: "Bid: High → Low",
    sortBidLowHigh: "Bid: Low → High",
    sortRarity: "Rarity",
    sortHasBidder: "Has Bidder",
    viewGrid: "⊞ Grid",
    viewCompact: "≡ Compact",
    noActiveAuctionsNow: "No active auctions right now.",
    noBidsYet: "No bids yet",
    bidButton: "Bid",
    logInToBid: "Log in to bid",
    removeTitle: "Remove",
    currentBidLabel: "Current Bid",
    bidsLabel: "Bids",
    winningBadge: "Winning",
    removeAuctionBtn: "Remove Auction",
    minBidPlaceholder: "Min",
    noEndedAuctions: "No ended auctions.",
    winnerLabel: "Winner",
    noWinner: "No Winner",
    // Bid toasts
    minBidError: "Minimum bid is",
    minBidErrorSuffix: "coins (current + 5).",
    invalidBid: "Invalid Bid",
    insufficientCoins: "Insufficient coins.",
    noFunds: "No Funds",
    coinSyncFailed: "Bid confirmed, but your coin balance couldn't be updated — it will be corrected shortly.",
    alreadyHighestBid: "You already hold the highest bid.",
    alreadyWinning: "Already Winning",
    auctionEnded: "This auction has ended.",
    auctionEndedTitle: "Auction Ended",
    outbidMessage: "Someone just bid higher",
    pleaseRetry: "Please try again.",
    outbidTitle: "Outbid",
    bidPlacedOn: "Bid of",
    placedOn: "placed on",
    snipeProtection: "⏱️ Timer extended 2 mins (snipe protection)",
    bidPlacedTitle: "Bid Placed",
    itemNameRequired: "Item name required.",
    auctionStarted: "Auction started:",
    auctionLive: "Auction Live",
    rarityEpic: "Epic",
    rarityRare: "Rare",
    rarityKari: "Kari",
    rarityMaterial: "Common",
    rarityUncommon: "Uncommon",
    colItem: "Item",
    colRarity: "Rarity",
    colWinner: "Winner",
    colFinalBid: "Final Bid",
    importFromAttendance: "Import from Attendance Log",
    selectingLogHint: "Selecting a log auto-fills the event name, date, and marks all non-AFK attendees.",
    eventNameLabel: "Event Name",
    eventNamePlaceholder: "e.g. World Boss, ISB…",
    dateLabel: "Date",
    importedFrom: "Imported",
    attendeesFrom: "attendees from",
    autoImported: "Auto-Imported",
    sessionInfo: "Session Info",
    selectMembers: "Select Members",
    selectAll: "Select All",
    unselectAll: "Unselect All",
    selectedCount: "selected",
    itemNamePlaceholder: "Item name…",
    addBtn: "+ Add",
    noItemsAdded: "No items added yet.",
    totalItemsLabel: "total items",
    membersLabel2: "members",
    rolling: "Rolling…",
    rollTheLoot: "Roll the Loot!",
    resetBtn: "Reset",
    itemNameFieldLabel: "Item Name",
    rarityLabel: "Rarity",
    itemImageLabel: "Item Image",
    descriptionLabel: "Description",
    itemDescPlaceholder: "Item description…",
    startingBidLabel: "Starting Bid (Coins)",
    durationLabel: "Duration (minutes)",
    previewLabel: "Preview",
    itemNameDefault: "Item Name",
    descriptionDefault: "Description…",
    startAuction: "Start Auction",
    itemNamePlaceholder2: "e.g. Dragon Scale Armor",
    enterItemNameError: "Enter item name.",
    addAtLeastOneItem: "Add at least one item.",
    selectAtLeastOneMember: "Select at least one member.",
    winningBadgeCompact: "✓ WINNING",
    lootRouletteTitle: "Loot Roulette",
    fairRandomDist: "Fair random loot distribution",
    elderControlsActive: "Elder controls active",
    viewResultsHistory: "View results & history",
    historyBtn: "📜 History",
    manageBtn: "Manage",
    defaultEventLabel: "Loot Distribution",
    lootJustRolled: "Loot Just Rolled!",
    dismissBtn: "✕ Dismiss",
    pieceCount: "pc",
    nothingLabel: "Nothing",
    autoRefreshes: "Auto-refreshes every 10s",
    refreshNow: "↺ Refresh Now",
    resultsRefreshed: "Results refreshed!",
    refreshedTitle: "Refreshed",
    allEventsLabel: "All Events",
    newestFirst: "Newest First",
    oldestFirst: "Oldest First",
    sessionsLabel: "session",
    sessionsPluralSuffix: "s",
    historyAutoClears: "History auto-clears every week",
    noSessionsMatch: "No sessions match this filter.",
    hoursAgo: "h ago",
    daysAgo: "d ago",
    participantsLabel: "participants",
    noLootLabel: "No loot:",
    noRouletteHistory: "No roulette history yet.",
    historyAutoClearsTidy: "History auto-clears every week to keep things tidy.",
    selectAttendanceLogPlaceholder: "— Select an attendance log —",
    selectParticipants: "Select Participants",
    lootItemsTitle: "Loot Items",
    createNewAuction: "Create New Auction",
    // DiscordModal
    linkDiscordTitle: "🎮 Link Discord —",
    connectDiscord: "Connect your Discord",
    discordLinkHint: "Link your Discord so clan mates can reach you.",
    discordUsername: "Discord Username",
    discordUsernamePlaceholder: "e.g. username#1234 or username",
    currentLabel: "Current:",
    unlink: "Unlink",
    cancel: "Cancel",
    saveDiscord: "Save Discord",
    // AdjustPowerModal
    adjustPowerTitle: "Adjust Power —",
    currentPowerLabel: "Current:",
    quickAdjust: "Quick Adjust",
    setExactPower: "Set Exact Power",
    changeLabel: "Change",
    savePower: "Save Power",
    // LBList
    yourRank: "Your Rank",
    behindLabel: "behind",
    bpBehind: "BP behind",
    attBehind: "att behind",
    leadingLabel: "Leading!",
    youSuffix: "(You)",
    ofPagination: "of",
    // Leaderboard
    hallOfFame: "Hall of Fame",
    mostPowerful: "Most Powerful",
    richestWarriors: "Richest Warriors",
    mostActive: "Most Active",
    attSuffix: "att",
    multiplierLabel: "Coin Multiplier",
    // Export
    dataExportCenter: "📤 Data Export Center",
    dataExportDesc: "Download clan data as CSV files for external analysis or record keeping.",
    downloadCsvBtn: "Download CSV",
    exportTitle_coinRankings: "Coin Rankings",
    exportDesc_coinRankings: "Member coin balances sorted by rank.",
    exportTitle_attendanceCoins: "Attendance Coin Totals",
    exportDesc_attendanceCoins: "Total coins each member has earned from attendance, alongside their current balance.",
    exportTitle_attendanceLogs: "Attendance Logs",
    exportDesc_attendanceLogs: "All recorded attendance sessions.",
    exportTitle_auctionHistory: "Auction History",
    exportDesc_auctionHistory: "All auction results with winners.",
    exportTitle_powerLeaderboard: "Power Leaderboard",
    exportDesc_powerLeaderboard: "Members sorted by power level.",
    exportTitle_fullReport: "Full Member Report",
    exportDesc_fullReport: "Complete member database export.",
    // Settings
    masterOnly: "Master Only",
    settingsRequireMaster: "Settings require Master privileges.",
    coinDecayTitle: "Coin Decay",
    coinDecayDescPrefix: "Auto-triggers every Tuesday at 7:00 AM (GMT+8). Removes",
    coinDecayDescSuffix: "of each member's coins. You can also trigger it manually below.",
    avgCoinsLabel: "Avg coins:",
    triggerWeeklyDecay: "Trigger Weekly Decay",
    attendanceResetTitle: "Attendance Reset",
    attendanceResetDesc: "Auto-resets on the 1st of every month at midnight (GMT+8). You can also trigger it manually below.",
    totalRecordsLabel: "Total records:",
    resetWeeklyAttendance: "Reset Weekly Attendance",
    eventCoinValues: "Event Coin Values",
    saveBtn: "Save",
    decayRateLabel: "Weekly decay rate:",
    cancelBtn: "Cancel",
    editBtn: "Edit",
    colEventName: "Event",
    colId: "ID",
    elderManagement: "Elder Management",
    colMemberName: "Member",
    colClass: "Class",
    colDiscordName: "Discord",
    colActionName: "Action",
    makeElder: "Make Elder",
    demote: "Demote",
    promotedToElderToast: "promoted to Elder.",
    promotedTitle: "Promoted",
    demotedToast: "demoted.",
    demotedTitle: "Demoted",
    autoDecayApplied: "Weekly 5% coin decay has been applied automatically.",
    autoAttendanceResetApplied: "Monthly attendance counts have been reset automatically.",
    autoDecayTitle: "Auto Decay",
    decayTriggeredTostPrefix: "Weekly coin decay applied:",
    decayTriggeredTostSuffix: "removed.",
    decayTriggeredTitle: "Decay Triggered",
    attendanceResetToast: "Weekly attendance reset for all members.",
    resetTitle: "Reset",
    // AddMemberModal
    nameUsernameRequired: "Name and username required.",
    addMemberTitle: "Add Member",
    characterName: "Character Name",
    inGameNamePlaceholder: "In-game name…",
    usernameLoginLabel: "Username (login)",
    loginUsernamePlaceholder: "Login username…",
    passwordLabel2: "Password",
    initialPasswordPlaceholder: "Initial password…",
    classLabel: "Class",
    powerLevelLabel: "Power Level",
    roleLabel: "Role",
    addedToClan: "added to the clan!",
    memberAddedTitle: "Member Added",
    // AdjustCoinsModal
    enterValidAmount: "Enter a valid amount.",
    adjustCoinsTitle: "Adjust Coins —",
    elderApprovalNotice: "As an Elder, your coin adjustments require Master approval before taking effect.",
    amountLabel: "Amount",
    reasonOptional: "Reason (optional)",
    reasonPlaceholder: "e.g. Bonus, Penalty…",
    requestRemove: "Request Remove",
    removeAmount: "— Remove",
    requestAdd: "Request Add",
    addAmount: "+ Add",
    addedCoinsToast: "Added",
    removedCoinsToast: "Removed",
    coinsToLabel: "coins to",
    coinsFromLabel: "coins from",
    coinsAdjustedTitle: "Coins Adjusted",
    // PendingRequestsModal
    pendingCoinRequestsTitle: "⏳ Pending Coin Requests",
    noPendingRequests: "No pending requests.",
    coinsSuffix: "coins",
    reasonLabel2: "Reason:",
    requestedByLabel: "Requested by",
    recordedByCardLabel: "by",
    approveBtn: "✓ Approve",
    rejectBtn: "✕ Reject",
    closeBtn: "Close",
    // ChangePasswordModal
    currentPasswordIncorrect: "Current password is incorrect.",
    passwordChangeFailed: "Couldn't save your new password — please try again.",
    newPasswordEmpty: "New password cannot be empty.",
    passwordsNoMatch: "Passwords do not match.",
    passwordChangedSuccess: "Password changed successfully.",
    passwordUpdatedTitle: "Password Updated",
    changePasswordTitle: "Change Password",
    currentPasswordLabel: "Current Password",
    currentPasswordPlaceholder: "Your current password…",
    newPasswordLabel: "New Password",
    newPasswordPlaceholder: "Choose a new password…",
    confirmNewPasswordLabel: "Confirm New Password",
    repeatPasswordPlaceholder: "Repeat new password…",
    savePasswordBtn: "Save Password",
    // RenameMemberModal
    nameEmptyError: "Name cannot be empty.",
    renamedToast: "renamed to",
    memberRenamedTitle: "Member Renamed",
    renameMemberTitle: "Rename Member",
    currentNameLabel: "Current name:",
    newNameLabel: "New Name",
    newNamePlaceholder: "Enter new in-game name…",
    saveNameBtn: "Save Name",
    // DeleteAttendanceModal
    removeAttendanceTitle: "Remove Attendance Record",
    permanentlyDeleteWarning: "This will permanently delete",
    fromHistoryWarning: "from the history and automatically deduct the coins it awarded from every participant — including any bonus it triggered.",
    thisWillAffect: "This will affect",
    memberSuffix: "member(s)",
    coinsTotalSuffix: "coins total",
    removeDeductBtn: "✕ Remove & Deduct",
    attendanceDeletedToast: "removed —",
    deductedFromToast: "coins deducted from",
    memberSuffix2: "member(s).",
    attendanceDeletedTitle: "Attendance Deleted",
    // AddMissingAttendanceModal
    pickEventError: "Pick an event.",
    pickDateTimeError: "Pick a date & time.",
    selectAtLeastOneAttendee: "Select at least one member who attended.",
    invalidDateTime: "Invalid date/time.",
    backfilledDistributed: "— coins distributed to",
    memberSuffix3: "member(s).",
    recordAddedTitle: "Record Added",
    backfilledHistoryOnly: "history record — no coins were changed.",
    addMissingRecordTitle: "Add Missing Record",
    backfillDesc: "Backfill a History row for an attendance that was recorded outside the normal flow.",
    coinsFieldLabel: "Coins",
    coinsUntouched: "Coins Untouched",
    distributeCoins: "Distribute Coins",
    distributeCoinsHint: "Pays out coins (and any qualifying bonus) to everyone selected below, exactly like a normal attendance submission — use this when the attendance never actually paid out at all.",
    recordOnlyHintPrefix: "Creates the History row only —",
    recordOnlyHintBold: "no coins, attendance counts, or bonuses change.",
    recordOnlyHintSuffix: "Use this when the payout already happened and only the row is missing.",
    eventFieldLabel: "Event",
    dateTimeFieldLabel: "Date & Time",
    whoAttendedLabel: "Who attended?",
    selectedSuffix: "selected",
    noMembersFound: "No members found.",
    addRecordPayBtn: "Add Record & Pay Coins",
    addRecordBtn: "Add Record",
    mightiestWarriors: "Mightiest Warriors",
  },
  zh: {
    // Login screen
    username: "用户名",
    password: "密码",
    enterUsername: "请输入用户名…",
    enterPassword: "请输入密码…",
    enter: "进入",
    continueAsGuest: "以访客身份继续 — 无需登录即可查看",
    logIn: "登录",
    guestModeLabel: "访客 — 仅供查看",
    invalidLogin: "用户名或密码无效。",
    contactMaster: "请联系您的盟主以获取访问权限。",
    // Nav
    dashboard: "仪表盘",
    leaderboards: "排行榜",
    members: "成员",
    attendance: "出勤",
    auctions: "拍卖",
    reports: "报告",
    menu: "菜单",
    logOut: "登出",
    addMember: "+ 添加成员",
    discord: "Discord",
    linkDiscord: "关联 Discord",
    changePasswordLabel: "密码",
    approvals: "待审批",
    changePassword: "修改密码",
    coinsLabel: "金币",
    welcomeBackTitle: "欢迎回来，",
    loginSummaryDesc: "这是您上次访问后发生的事情：",
    sinceLastVisitLabel: "自您上次访问以来",
    featuredCountLabel: "件上架",
    closestEndsLabel: "最近将于",
    currentBalanceLabel: "您当前的余额",
    fromAttendance: "来自出勤",
    fromBonuses: "来自奖励",
    fromDecay: "每周衰减",
    bonusesEarned: "获得的奖励",
    auctionsWon: "拍下的物品",
    gotIt: "知道了",
    nothingNewMessage: "自上次以来没有新动态，稍后再来看看吧！",
    dontShowToday: "今天不再显示",
    loginAnnouncementTitle: "登录公告",
    loginAnnouncementDesc: "在每个人的登录摘要弹窗顶部显示，直到他们本人关闭为止。",
    loginAnnouncementLabel: "当前公告：",
    loginAnnouncementPlaceholder: "例如：稀有物品现已上架拍卖，快去看看吧！",
    noAnnouncementSet: "未设置公告",
    putInNewsTitle: "发布到公告",
    putInNewsBtn: "发布到公告",
    postAllToDiscordBtn: "将进行中的拍卖发布到 Discord",
    outbidPopupTitle: "您已被超越出价！",
    outbidPopupBody1: "刚刚在以下拍卖中超越了您的出价：",
    outbidPopupNewBid: "最新最高出价：",
    outbidPopupDismiss: "关闭",
    outbidPopupGoBid: "立即出价",
    postToNewsLabel: "同时发布到所有人的登录公告",
    postAnnouncementBtn: "发布公告",
    dismissAnnouncementTitle: "关闭此公告",
    removeFromNewsTitle: "从公告中移除",
    removeFromNewsBtn: "从公告中移除",
    auctionNewsTitle: "拍卖上架",
    clearBtn: "清除",
    balanceRemaining: "剩余余额",
    // Page titles
    pageTitle_dashboard: "公会总部",
    pageTitle_attendance: "出勤",
    pageTitle_members: "成员",
    pageTitle_auctions: "拍卖行",
    pageTitle_leaderboard: "名人堂",
    pageTitle_export: "导出数据",
    pageTitle_settings: "设置",
    // Nav sections
    navSection_main: "主菜单",
    navSection_management: "管理",
    navSection_reports: "报告",
    navSection_myClan: "我的公会",
    navSection_adminTools: "管理工具",
    // Nav sub-items
    sub_clanStats: "公会统计",
    sub_worldBoss: "世界首领",
    sub_liveAuctions: "进行中的拍卖",
    sub_weeklyTop: "本周排名",
    sub_topPower: "战力排行",
    sub_richest: "财富排行",
    sub_topAttendance: "出勤排行",
    sub_auctionWinners: "拍卖赢家",
    sub_memberRoster: "成员名册",
    sub_profiles: "个人资料",
    sub_coinPowerAdjust: "金币与战力调整",
    sub_recordAttendance: "记录出勤",
    sub_history: "历史记录",
    sub_eventTracker: "活动追踪",
    sub_lootRoulette: "战利品轮盘",
    sub_createAuction: "创建拍卖",
    // Dashboard
    warriors: "勇士",
    liveAuctions: "进行中的拍卖",
    clanTotalPower: "军团总战力",
    acrossWarriors: "共 {count} 名勇士",
    reigningChampion: "在位冠军",
    totalWarriors: "勇士总数",
    coinsInCirculation: "流通金币",
    sevenDayStreak: "7天出勤",
    yourPower: "你的战力",
    yourCoins: "你的金币",
    classComposition: "职业构成",
    noActiveAuctions: "暂无进行中的拍卖。",
    topBidderLabel: "最高出价",
    noBids: "暂无出价",
    viewAllAuctions: "查看所有拍卖",
    topAttendance: "出勤排行",
    topPower: "战力排行",
    richest: "财富排行",
    recentWinners: "最近赢家",
    noRecentWinners: "暂无最近赢家。",
    eventPoints: "活动积分",
    // Members page
    searchWarrior: "搜索勇士…",
    allClasses: "全部",
    sortCoins: "排序：金币",
    sortPower: "排序：战力",
    sortAttendance: "排序：出勤",
    sortName: "排序：名称",
    tableView: "表格",
    cardsView: "卡片",
    colRank: "#",
    colCharacter: "角色",
    colPower: "战力",
    colCoins: "金币",
    colBalance: "余额",
    colAttend: "出勤",
    colWins: "胜场",
    colRole: "职位",
    colActions: "操作",
    joinedOn: "加入于",
    remove: "移除",
    memberRemoved: "成员已移除。",
    removed: "已移除",
    statCoins: "金币",
    statAttendance: "出勤",
    statWins: "胜场",
    statJoined: "加入日期",
    powerLabel: "战力",
    adjustCoins: "调整金币",
    adjustPower: "调整战力",
    editDiscord: "编辑 Discord",
    rename: "✎ 重命名",
    changeRole: "更改职位",
    toMember: "→ 成员",
    toElder: "→ 长老",
    toMaster: "→ 盟主",
    removeMember: "移除成员",
    setToMember: "已设为成员。",
    promotedToElder: "已晋升为长老。",
    nowMaster: "现已成为盟主！",
    roleChanged: "职位已更改",
    // Attendance page
    tabRecordAttendance: "记录出勤",
    tabHistory: "历史记录",
    tabBonuses: "奖励",
    tabMyLog: "我的积分历史",
    tabGlobalLog: "全局积分日志",
    totalLogsLabel: "总记录数",
    thisWeekLabel: "本周",
    latestEventLabel: "最新活动",
    elderOnlyAttendance: "只有长老和首领可以记录出勤。",
    coinRules: "金币规则",
    full: "全勤",
    late: "迟到",
    afk: "缺席",
    searchMember: "搜索成员...",
    submitAttendance: "提交出勤",
    clear: "清除",
    addMissingRecord: "+ 添加缺失记录",
    noAttendanceYet: "暂无出勤记录。",
    membersCountLabel: "人",
    downloadCsvTitle: "下载此活动的出勤数据为 CSV",
    removeAction: "✕ 移除",
    attendeesLabel: "出勤成员",
    pageOf: "第",
    ofLabel: "页，共",
    prevPage: "← 上一页",
    nextPage: "下一页 →",
    noWarriorMatch: "没有符合搜索条件的勇士。",
    bonusRules: "奖励规则",
    bonusRuleMajor: "重大活动 — 本周参加全部8种活动类型：ISB(×1)、CA(×2)、STI(×2)、CS(×1)、4只世界首领各(×2)：",
    bonusRuleSindri: "辛德里老兵 — 每周参加2次辛德里的宝藏岛，连续{n}周：",
    bonusOneTime: "（一次性）",
    bonusRuleISB: "ISB老兵 — 参加{n}次跨服战（终身累计）：",
    bonusRuleIron: "钢铁连胜 — 连续{n}周参加全部重大活动（终身累计）：",
    bonusSettingsTitle: "奖励设置",
    bonusSettingsDesc: "编辑下方出勤奖励的金币数额与达成条件。更改将立即应用于新发放的奖励以及所有人的进度显示。",
    bonusSettingsSaved: "奖励设置已保存。",
    updatedTitle: "已更新",
    majorEventsBonusLabel: "重大活动奖励：",
    sindriVeteranBonusLabel: "辛德里老兵奖励：",
    sindriVeteranThresholdLabel: "辛德里老兵所需周数：",
    isbVeteranBonusLabel: "ISB老兵奖励：",
    isbVeteranThresholdLabel: "ISB老兵所需次数：",
    ironStreakBonusLabel: "钢铁连胜奖励：",
    ironStreakThresholdLabel: "钢铁连胜所需周数：",
    decayWarningPrefix: "未使用的金币每周二衰减",
    decayWarningSuffix: "。请保持活跃！",
    decayBadgeSuffix: "周",
    majorEvents: "重大活动",
    earned: "✓ 已获得",
    sindriVeteran: "辛德里老兵",
    weeksLabel: "周",
    sindriProgress: "周（每周2次辛德里）",
    isbVeteran: "ISB老兵",
    isbProgress: "次跨服战",
    ironStreak: "钢铁连胜",
    ironStreakProgress: "周连续",
    myPointsHistoryTitle: "我的积分历史 — 私密",
    myPointsHistoryDesc: "出勤、奖励、管理员金币调整、拍卖获胜以及每周衰减。仅您本人可见此记录。",
    adminPointsHistoryTitle: "积分历史",
    adminPointsHistoryDesc: "该成员的出勤、奖励、管理员金币调整、拍卖获胜以及每周衰减记录。",
    noPointsHistory: "暂无积分历史记录。",
    noEntriesFilter: "没有符合此筛选条件的记录。",
    globalPointsTitle: "全局积分历史",
    globalPointsDesc: "管理员手动调整、奖励以及每周衰减 — 所有人可见。",
    noGlobalAdjustments: "暂无全局积分调整记录。",
    colDateTime: "日期与时间",
    colEvent: "活动",
    colMembers: "成员",
    colRecBy: "记录人",
    colType: "类型",
    colDetails: "详情",
    colMember: "成员",
    colAmount: "金额",
    colAddedBy: "添加人",
    colReason: "原因",
    markMembers: "标记成员",
    hideAttendees: "▲ 隐藏",
    showAttendees: "▼ 显示",
    weeklyCoinDecay: "每周金币衰减",
    weeklyDecayDetail: "每周金币衰减",
    type_Attendance: "出勤",
    type_MajorEventsBonus: "重大活动奖励",
    type_ISBVeteranBonus: "ISB老兵奖励",
    type_SindriVeteranBonus: "辛德里老兵奖励",
    type_BonusPoints: "奖励积分",
    type_ElderRequest: "长老申请",
    type_AdminManualAdd: "管理员手动添加",
    type_BidPlaced: "出价",
    type_OutbidRefund: "被超越退款",
    type_AuctionWin: "拍卖获胜",
    type_WeeklyDecay: "每周衰减",
    type_BalanceCorrection: "余额调整",
    allMembersLabel: "全体成员",
    fileDownloaded: "已下载！",
    exportLabel: "导出",
    selectEventError: "请选择一个活动。",
    errorLabel: "错误",
    noMembersSelected: "未选择任何成员。",
    attendanceRecorded: "出勤已记录！",
    membersUpdated: "名成员已更新。",
    attendanceSaved: "出勤已保存",
    earnedBonusText: "获得",
    coinsText: "金币",
    bonusText: "奖励！",
    bonusAwarded: "奖励已发放",
    tabLiveAuctions: "进行中的拍卖",
    tabAuctionHistory: "历史记录",
    tabLootRoulette: "战利品轮盘",
    tabCreateAuction: "创建拍卖",
    liveBidValueLabel: "实时竞价总额",
    endingSoonestLabel: "即将结束",
    sortLabel: "排序：",
    viewLabel: "视图：",
    sortDefault: "默认",
    sortBidHighLow: "出价：高 → 低",
    sortBidLowHigh: "出价：低 → 高",
    sortRarity: "稀有度",
    sortHasBidder: "有出价者",
    viewGrid: "⊞ 网格",
    viewCompact: "≡ 紧凑",
    noActiveAuctionsNow: "目前没有进行中的拍卖。",
    noBidsYet: "暂无出价",
    bidButton: "出价",
    logInToBid: "登录后即可出价",
    removeTitle: "移除",
    currentBidLabel: "当前出价",
    bidsLabel: "出价数",
    winningBadge: "领先中",
    removeAuctionBtn: "移除拍卖",
    minBidPlaceholder: "最低",
    noEndedAuctions: "没有已结束的拍卖。",
    winnerLabel: "赢家",
    noWinner: "无人中标",
    minBidError: "最低出价为",
    minBidErrorSuffix: "金币（当前出价+5）。",
    invalidBid: "出价无效",
    insufficientCoins: "金币不足。",
    noFunds: "金币不足",
    coinSyncFailed: "出价已确认，但金币余额更新失败，稍后将自动更正。",
    alreadyHighestBid: "您已是最高出价者。",
    alreadyWinning: "已是领先者",
    auctionEnded: "此拍卖已结束。",
    auctionEndedTitle: "拍卖已结束",
    outbidMessage: "已有人出价更高",
    pleaseRetry: "请重试。",
    outbidTitle: "已被超越",
    bidPlacedOn: "出价",
    placedOn: "成功，物品：",
    snipeProtection: "⏱️ 计时已延长2分钟（防狙击保护）",
    bidPlacedTitle: "出价成功",
    itemNameRequired: "请输入物品名称。",
    auctionStarted: "拍卖已开始：",
    auctionLive: "拍卖进行中",
    rarityEpic: "史诗",
    rarityRare: "稀有",
    rarityKari: "卡里",
    rarityMaterial: "普通",
    rarityUncommon: "罕见",
    colItem: "物品",
    colRarity: "稀有度",
    colWinner: "赢家",
    colFinalBid: "最终出价",
    importFromAttendance: "从出勤记录导入",
    selectingLogHint: "选择一条记录将自动填写活动名称、日期，并标记所有未缺席的成员。",
    eventNameLabel: "活动名称",
    eventNamePlaceholder: "例如：世界首领、跨服战…",
    dateLabel: "日期",
    importedFrom: "已导入",
    attendeesFrom: "名出勤成员，来自",
    autoImported: "自动导入",
    sessionInfo: "本次信息",
    selectMembers: "选择成员",
    selectAll: "全选",
    unselectAll: "取消全选",
    selectedCount: "已选",
    itemNamePlaceholder: "物品名称…",
    addBtn: "+ 添加",
    noItemsAdded: "尚未添加物品。",
    totalItemsLabel: "件物品总数",
    membersLabel2: "名成员",
    rolling: "正在抽取…",
    rollTheLoot: "开始抽取战利品！",
    resetBtn: "重置",
    itemNameFieldLabel: "物品名称",
    rarityLabel: "稀有度",
    itemImageLabel: "物品图片",
    descriptionLabel: "描述",
    itemDescPlaceholder: "物品描述…",
    startingBidLabel: "起拍价（金币）",
    durationLabel: "持续时间（分钟）",
    previewLabel: "预览",
    itemNameDefault: "物品名称",
    descriptionDefault: "描述…",
    startAuction: "开始拍卖",
    itemNamePlaceholder2: "例如：龙鳞护甲",
    enterItemNameError: "请输入物品名称。",
    addAtLeastOneItem: "请至少添加一个物品。",
    selectAtLeastOneMember: "请至少选择一名成员。",
    winningBadgeCompact: "✓ 领先中",
    lootRouletteTitle: "战利品轮盘",
    fairRandomDist: "公平随机分配战利品",
    elderControlsActive: "长老控制已启用",
    viewResultsHistory: "查看结果与历史记录",
    historyBtn: "📜 历史记录",
    manageBtn: "管理",
    defaultEventLabel: "战利品分配",
    lootJustRolled: "战利品刚刚开奖！",
    dismissBtn: "✕ 关闭",
    pieceCount: "件",
    nothingLabel: "无",
    autoRefreshes: "每10秒自动刷新",
    refreshNow: "↺ 立即刷新",
    resultsRefreshed: "结果已刷新！",
    refreshedTitle: "已刷新",
    allEventsLabel: "所有活动",
    newestFirst: "最新优先",
    oldestFirst: "最早优先",
    sessionsLabel: "场",
    sessionsPluralSuffix: "",
    historyAutoClears: "历史记录每周自动清除",
    noSessionsMatch: "没有符合此筛选条件的记录。",
    hoursAgo: "小时前",
    daysAgo: "天前",
    participantsLabel: "名参与者",
    noLootLabel: "未获得战利品：",
    noRouletteHistory: "暂无轮盘历史记录。",
    historyAutoClearsTidy: "历史记录每周自动清除，以保持整洁。",
    selectAttendanceLogPlaceholder: "— 选择一条出勤记录 —",
    selectParticipants: "选择参与者",
    lootItemsTitle: "战利品物品",
    createNewAuction: "创建新拍卖",
    linkDiscordTitle: "🎮 关联 Discord —",
    connectDiscord: "连接您的 Discord",
    discordLinkHint: "关联您的 Discord，方便公会成员联系您。",
    discordUsername: "Discord 用户名",
    discordUsernamePlaceholder: "例如：username#1234 或 username",
    currentLabel: "当前：",
    unlink: "取消关联",
    cancel: "取消",
    saveDiscord: "保存 Discord",
    adjustPowerTitle: "调整战力 —",
    currentPowerLabel: "当前：",
    quickAdjust: "快速调整",
    setExactPower: "设置精确战力",
    changeLabel: "变化",
    savePower: "保存战力",
    yourRank: "您的排名",
    behindLabel: "落后于",
    bpBehind: "战力点落后于",
    attBehind: "次出勤落后于",
    leadingLabel: "领先中！",
    youSuffix: "（您）",
    ofPagination: "/",
    hallOfFame: "名人堂",
    mostPowerful: "最强战力",
    richestWarriors: "最富有勇士",
    mostActive: "最活跃",
    attSuffix: "次出勤",
    multiplierLabel: "金币倍率",
    dataExportCenter: "📤 数据导出中心",
    dataExportDesc: "下载公会数据为 CSV 文件，用于外部分析或记录保存。",
    downloadCsvBtn: "下载 CSV",
    exportTitle_coinRankings: "金币排名",
    exportDesc_coinRankings: "按排名排序的成员金币余额。",
    exportTitle_attendanceCoins: "出勤金币总计",
    exportDesc_attendanceCoins: "每位成员通过出勤获得的金币总数，以及当前余额。",
    exportTitle_attendanceLogs: "出勤记录",
    exportDesc_attendanceLogs: "所有已记录的出勤场次。",
    exportTitle_auctionHistory: "拍卖历史",
    exportDesc_auctionHistory: "所有拍卖结果及赢家。",
    exportTitle_powerLeaderboard: "战力排行榜",
    exportDesc_powerLeaderboard: "按战力等级排序的成员。",
    exportTitle_fullReport: "完整成员报告",
    exportDesc_fullReport: "完整的成员数据库导出。",
    masterOnly: "仅限盟主",
    settingsRequireMaster: "设置功能需要盟主权限。",
    coinDecayTitle: "金币衰减",
    coinDecayDescPrefix: "每周二早上7:00（GMT+8）自动触发。扣除每位成员",
    coinDecayDescSuffix: "的金币。您也可以在下方手动触发。",
    avgCoinsLabel: "平均金币：",
    triggerWeeklyDecay: "触发每周衰减",
    attendanceResetTitle: "出勤重置",
    attendanceResetDesc: "每月1日凌晨0点（GMT+8）自动重置。您也可以在下方手动触发。",
    totalRecordsLabel: "总记录数：",
    resetWeeklyAttendance: "重置每周出勤",
    eventCoinValues: "活动金币数值",
    saveBtn: "保存",
    decayRateLabel: "每周衰减比例：",
    cancelBtn: "取消",
    editBtn: "编辑",
    colEventName: "活动",
    colId: "编号",
    elderManagement: "长老管理",
    colMemberName: "成员",
    colClass: "职业",
    colDiscordName: "Discord",
    colActionName: "操作",
    makeElder: "任命为长老",
    demote: "降级",
    promotedToElderToast: "已晋升为长老。",
    promotedTitle: "已晋升",
    demotedToast: "已降级。",
    demotedTitle: "已降级",
    autoDecayApplied: "每周5%金币衰减已自动应用。",
    autoAttendanceResetApplied: "每月出勤次数已自动重置。",
    autoDecayTitle: "自动衰减",
    decayTriggeredTostPrefix: "每周金币衰减已应用：扣除",
    decayTriggeredTostSuffix: "。",
    decayTriggeredTitle: "衰减已触发",
    attendanceResetToast: "已为所有成员重置每周出勤。",
    resetTitle: "已重置",
    nameUsernameRequired: "姓名和用户名为必填项。",
    addMemberTitle: "添加成员",
    characterName: "角色名称",
    inGameNamePlaceholder: "游戏内名称…",
    usernameLoginLabel: "用户名（登录用）",
    loginUsernamePlaceholder: "登录用户名…",
    passwordLabel2: "密码",
    initialPasswordPlaceholder: "初始密码…",
    classLabel: "职业",
    powerLevelLabel: "战力等级",
    roleLabel: "职位",
    addedToClan: "已加入公会！",
    memberAddedTitle: "成员已添加",
    enterValidAmount: "请输入有效金额。",
    adjustCoinsTitle: "调整金币 —",
    elderApprovalNotice: "作为长老，您的金币调整需要盟主批准才能生效。",
    amountLabel: "金额",
    reasonOptional: "原因（可选）",
    reasonPlaceholder: "例如：奖励、惩罚…",
    requestRemove: "申请扣除",
    removeAmount: "— 扣除",
    requestAdd: "申请添加",
    addAmount: "+ 添加",
    addedCoinsToast: "已添加",
    removedCoinsToast: "已扣除",
    coinsToLabel: "金币给",
    coinsFromLabel: "金币，来自",
    coinsAdjustedTitle: "金币已调整",
    pendingCoinRequestsTitle: "⏳ 待处理金币请求",
    noPendingRequests: "暂无待处理请求。",
    coinsSuffix: "金币",
    reasonLabel2: "原因：",
    requestedByLabel: "申请人",
    recordedByCardLabel: "记录人",
    approveBtn: "✓ 批准",
    rejectBtn: "✕ 拒绝",
    closeBtn: "关闭",
    currentPasswordIncorrect: "当前密码不正确。",
    passwordChangeFailed: "保存新密码失败，请重试。",
    newPasswordEmpty: "新密码不能为空。",
    passwordsNoMatch: "两次输入的密码不一致。",
    passwordChangedSuccess: "密码已成功修改。",
    passwordUpdatedTitle: "密码已更新",
    changePasswordTitle: "修改密码",
    currentPasswordLabel: "当前密码",
    currentPasswordPlaceholder: "请输入当前密码…",
    newPasswordLabel: "新密码",
    newPasswordPlaceholder: "请设置新密码…",
    confirmNewPasswordLabel: "确认新密码",
    repeatPasswordPlaceholder: "请再次输入新密码…",
    savePasswordBtn: "保存密码",
    nameEmptyError: "姓名不能为空。",
    renamedToast: "已重命名为",
    memberRenamedTitle: "成员已重命名",
    renameMemberTitle: "重命名成员",
    currentNameLabel: "当前名称：",
    newNameLabel: "新名称",
    newNamePlaceholder: "请输入新的游戏内名称…",
    saveNameBtn: "保存名称",
    removeAttendanceTitle: "移除出勤记录",
    permanentlyDeleteWarning: "这将永久删除",
    fromHistoryWarning: "从历史记录中，并自动从每位参与者扣除该记录发放的金币——包括其触发的任何奖励。",
    thisWillAffect: "这将影响",
    memberSuffix: "名成员",
    coinsTotalSuffix: "金币总计",
    removeDeductBtn: "✕ 移除并扣除",
    attendanceDeletedToast: "已移除 —",
    deductedFromToast: "金币已从",
    memberSuffix2: "名成员扣除。",
    attendanceDeletedTitle: "出勤记录已删除",
    pickEventError: "请选择一个活动。",
    pickDateTimeError: "请选择日期与时间。",
    selectAtLeastOneAttendee: "请至少选择一名出勤成员。",
    invalidDateTime: "日期/时间无效。",
    backfilledDistributed: "— 金币已分配给",
    memberSuffix3: "名成员。",
    recordAddedTitle: "记录已添加",
    backfilledHistoryOnly: "历史记录 — 未变更任何金币。",
    addMissingRecordTitle: "添加缺失记录",
    backfillDesc: "为未按正常流程记录的出勤补充一条历史记录。",
    coinsFieldLabel: "金币",
    coinsUntouched: "金币不变",
    distributeCoins: "分配金币",
    distributeCoinsHint: "将金币（及任何符合条件的奖励）发放给下方所选的所有人，与正常出勤提交完全相同 — 适用于出勤从未实际发放金币的情况。",
    recordOnlyHintPrefix: "仅创建历史记录 —",
    recordOnlyHintBold: "不会更改任何金币、出勤次数或奖励。",
    recordOnlyHintSuffix: "适用于已经发放过金币，仅缺少记录行的情况。",
    eventFieldLabel: "活动",
    dateTimeFieldLabel: "日期与时间",
    whoAttendedLabel: "谁参加了？",
    selectedSuffix: "已选",
    noMembersFound: "未找到成员。",
    addRecordPayBtn: "添加记录并发放金币",
    addRecordBtn: "添加记录",
    mightiestWarriors: "最强勇士",
  },
};

const LANG_STORAGE_KEY = "cf_lang";
function getInitialLang() {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === "en" || saved === "zh") return saved;
  } catch {}
  return "en";
}

const LangContext = React.createContext({ lang: "en", setLang: () => {}, t: (k) => k });

function LangProvider({ children }) {
  const [lang, setLangState] = useState(getInitialLang);
  const setLang = useCallback((next) => {
    setLangState(next);
    try { localStorage.setItem(LANG_STORAGE_KEY, next); } catch {}
  }, []);
  const t = useCallback((key) => {
    return TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.en[key] ?? key;
  }, [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

function useLang() {
  return React.useContext(LangContext);
}

// Small pill toggle shown in the nav bar — switches between English and
// Mandarin and persists the choice via LangProvider/localStorage.
function LangSwitcher() {
  const { lang, setLang } = useLang();
  return (
    <div style={{display:"flex",alignItems:"center",gap:2,background:"rgba(0,0,0,0.25)",borderRadius:20,padding:2,border:"1px solid var(--border)"}}>
      <button
        onClick={()=>setLang("en")}
        style={{
          padding:"4px 10px",borderRadius:18,fontSize:11,fontWeight:700,letterSpacing:0.5,
          border:"none",cursor:"pointer",
          background: lang==="en" ? "var(--gold)" : "transparent",
          color: lang==="en" ? "#1a1208" : "var(--text-dim)",
        }}
      >EN</button>
      <button
        onClick={()=>setLang("zh")}
        style={{
          padding:"4px 10px",borderRadius:18,fontSize:11,fontWeight:700,letterSpacing:0.5,
          border:"none",cursor:"pointer",
          background: lang==="zh" ? "var(--gold)" : "transparent",
          color: lang==="zh" ? "#1a1208" : "var(--text-dim)",
        }}
      >中文</button>
    </div>
  );
}


// Wrap fetch with a timeout so a slow/hanging response (e.g. under high
// concurrent load) can never leave the app stuck on the loading screen.
async function fetchWithTimeout(url, opts = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

// Schedules a repeating async task with small random jitter so that many
// concurrent clients (e.g. 50 users all loading around the same time)
// don't all hit the DB in the same instant on every interval tick.
function useJitteredInterval(fn, baseMs, jitterMs, deps) {
  useEffect(() => {
    let cancelled = false;
    let timer;
    async function tick() {
      if (cancelled) return;
      try { await fn(); } catch {}
      if (cancelled) return;
      const delay = baseMs + Math.random() * jitterMs;
      timer = setTimeout(tick, delay);
    }
    // Stagger the very first call too
    timer = setTimeout(tick, Math.random() * jitterMs);
    return () => { cancelled = true; clearTimeout(timer); };
  }, deps);
}

const supa = {
  async from(table) {
    const base = `${SUPA_URL}/rest/v1/${table}`;
    const headers = {
      "apikey": SUPA_KEY,
      "Authorization": `Bearer ${SUPA_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
    };
    return {
      async select(query="*") {
        const res = await fetchWithTimeout(`${base}?select=${query}`, { headers });
        if (!res.ok) throw new Error(`select ${table} failed: ${res.status}`);
        const json = await res.json();
        if (!Array.isArray(json)) throw new Error(`select ${table} returned non-array (likely an error response)`);
        return json;
      },
      async upsert(data) {
        // members specifically needs return=minimal now: return=representation
        // asks PostgREST to SELECT the row back after writing it, and since
        // anon no longer has SELECT on members.password (see
        // scripts/lock_down_password_column_v2.sql), that implicit
        // select-back was failing with 42501 even on a fully successful
        // write — confirmed live, this broke every member upsert (new
        // members, password changes, coin/log syncs, everything) the
        // instant the password column got locked down. No caller anywhere
        // in this file actually uses the returned row data (checked before
        // making this change), so return=minimal is a pure fix, not a
        // behavior trade-off. Scoped to just "members" — every other table
        // still gets the row back as before.
        const preferReturn = table === "members" ? "return=minimal" : "return=representation";
        const res = await fetchWithTimeout(base, {
          method: "POST",
          headers: { ...headers, "Prefer": `resolution=merge-duplicates,${preferReturn}` },
          body: JSON.stringify(Array.isArray(data) ? data : [data]),
        });
        const json = await res.json().catch(() => null);
        // A non-2xx response is always a failure, even if the error body
        // doesn't happen to carry a `code` or `message` field (e.g. a plain
        // text error, or a body that fails to parse as JSON at all) — without
        // this check, dbUpsert's "throw if res.code || res.message" guard
        // could be bypassed by an error shape it doesn't recognize, and the
        // write would be silently treated as successful.
        if (!res.ok) {
          throw new Error(`upsert ${table} failed: HTTP ${res.status} ${json ? JSON.stringify(json) : "(no body)"}`);
        }
        return json;
      },
      // Plain insert — deliberately WITHOUT the merge-duplicates Prefer
      // header upsert() uses, so a primary-key conflict genuinely fails
      // the request (HTTP 409) instead of silently overwriting. This is
      // what gives auction_win_claims real protection: only the first of
      // however many browser tabs/sessions are racing to claim the same
      // auction_id actually succeeds — Postgres itself enforces it, not
      // any client-side "have I already done this?" check, which can't
      // see what a DIFFERENT tab/session just did a moment ago.
      async insert(data) {
        const res = await fetchWithTimeout(base, {
          method: "POST",
          headers,
          body: JSON.stringify(Array.isArray(data) ? data : [data]),
        });
        if (res.status === 409) return { conflict: true };
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(`insert ${table} failed: HTTP ${res.status} ${json ? JSON.stringify(json) : "(no body)"}`);
        }
        return { conflict: false, data: json };
      },
      async delete(match) {
        const params = Object.entries(match).map(([k,v])=>`${k}=eq.${encodeURIComponent(v)}`).join("&");
        const res = await fetchWithTimeout(`${base}?${params}`, {
          method: "DELETE",
          headers: { "apikey": SUPA_KEY, "Authorization": `Bearer ${SUPA_KEY}`, "Prefer": "return=minimal" }
        });
        return res.status;
      },
    };
  }
};

async function dbLoad(table, columns="*") {
  try { const t = await supa.from(table); return await t.select(columns); } catch (e) { console.error(`dbLoad(${table}) failed:`, e); return null; }
}
// Checks a username/password against members.password SERVER-SIDE, via a
// SECURITY DEFINER Postgres function (see scripts/verify_login.sql) that
// can read the password column even though the anon key itself no longer
// can (see MEMBER_ALL_COLS_NO_PASSWORD above for why that column got
// locked down). Returns the matching member's id (string) on success, or
// null on a bad username/password or any request failure — callers should
// treat null as "not authenticated," not distinguish it from a network
// error, so a transient failure never gets treated as a valid login.
async function verifyLogin(username, password) {
  try {
    const res = await fetchWithTimeout(`${SUPA_URL}/rest/v1/rpc/verify_login`, {
      method: "POST",
      headers: {
        "apikey": SUPA_KEY,
        "Authorization": `Bearer ${SUPA_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_username: username, p_password: password }),
    });
    if (!res.ok) throw new Error(`verify_login failed: HTTP ${res.status}`);
    const matchedId = await res.json();
    return typeof matchedId === "string" && matchedId ? matchedId : null;
  } catch (e) {
    console.error("verifyLogin failed:", e);
    return null;
  }
}
// Sets a member's password server-side via a SECURITY DEFINER RPC (see
// scripts/set_member_password.sql) instead of ever putting `password` in a
// generic members upsert payload — PostgreSQL requires SELECT on any
// column an ON CONFLICT DO UPDATE writes to, which anon no longer has for
// password (see MEMBER_ALL_COLS_NO_PASSWORD). Returns true on confirmed
// success, false otherwise — callers should treat false as "the password
// was NOT changed," not assume it landed.
async function setMemberPasswordAtomic(memberId, newPassword, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(`${SUPA_URL}/rest/v1/rpc/set_member_password`, {
        method: "POST",
        headers: {
          "apikey": SUPA_KEY,
          "Authorization": `Bearer ${SUPA_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_member_id: String(memberId), p_new_password: newPassword }),
      });
      if (!res.ok) throw new Error(`set_member_password failed: HTTP ${res.status}`);
      return true;
    } catch (e) {
      if (attempt < retries) { await new Promise(r => setTimeout(r, 600 * (attempt + 1))); continue; }
      console.error(`setMemberPasswordAtomic(${memberId}) failed after retries:`, e);
      return false;
    }
  }
  return false;
}
// auctions.image_data stores base64 image blobs that can be large enough
// to cause "select=*" to hit the statement timeout. List/poll queries
// fetch everything except image_data; fetch it separately per-item only
// when needed (e.g. opening an auction's detail/edit view).
const AUCTION_LIST_COLS = "id,name,description,rarity,status,ends_at,started_at,current_bid,min_bid,top_bidder,image_name,bids";
// ROOT CAUSE of a real egress (data transfer) overage: the old members
// poll used `select=*`, re-downloading every member's ENTIRE history
// (attend_log, tx_log, decay_log, power_log — potentially hundreds of
// past entries each) every single 5 seconds, for every open browser tab.
// With 49 members and weeks of accumulated history, this alone could
// generate several GB per day from just one tab left open. Those log
// arrays barely change minute-to-minute, so there's no real need to
// re-fetch them that often — only the few fields that genuinely need to
// stay live (coins, power, etc.) are fetched on the fast 5s cycle below;
// the full logs are fetched separately on a much slower cycle instead.
const MEMBER_LIVE_COLS = "id,name,username,role,cls,power,coins,attendance,join_date,auction_wins,discord,profile_rarity,awakening_level,last_login_ts";
// Every members column EXCEPT password — see verifyLogin/verify_login.sql:
// the app used to fetch every member's plaintext password into every
// visitor's browser (before anyone even logged in) just so LoginScreen
// could compare it locally. That's also what made the password readable
// to anyone who copied the public anon key out of the site's own JS
// bundle and queried the table directly. Login/password-change now go
// through the verify_login RPC (checks server-side, never returns the
// password), so nothing client-side needs this column anymore.
const MEMBER_ALL_COLS_NO_PASSWORD = "id,name,username,role,cls,power,coins,attendance,join_date,auction_wins,discord,profile_rarity,awakening_level,last_login_ts,decay_log,tx_log,attend_log,power_log";
async function dbLoadAuctionImage(id) {
  try {
    const t = await supa.from("auctions");
    const rows = await t.select(`image_data,image_name&id=eq.${encodeURIComponent(id)}`);
    if (Array.isArray(rows) && rows[0]) return rows[0];
    return null;
  } catch { return null; }
}
// Every visible <AuctionImage> with an uncached photo mounts its own
// dbLoadAuctionImage call — fine for a handful of rows, but paging through
// Auction History can mount 15 of them at once, all racing the same
// unbounded burst of requests as everything else's regular polling. That
// burst is what was blowing the 8s fetchWithTimeout budget on totally
// unrelated tables (members, auctions, bid_events, ...) and leaving pages
// beyond the first couple looking broken. Capping how many image loads run
// at once keeps a page turn from ever competing with the rest of the app's
// traffic.
const MAX_CONCURRENT_IMAGE_LOADS = 3;
let _activeImageLoads = 0;
const _imageLoadQueue = [];
function _runNextImageLoad() {
  if (_activeImageLoads >= MAX_CONCURRENT_IMAGE_LOADS) return;
  const next = _imageLoadQueue.shift();
  if (!next) return;
  _activeImageLoads++;
  dbLoadAuctionImage(next.id)
    .then(next.resolve)
    .finally(() => { _activeImageLoads--; _runNextImageLoad(); });
}
function queueLoadAuctionImage(id) {
  return new Promise(resolve => {
    _imageLoadQueue.push({ id, resolve });
    _runNextImageLoad();
  });
}
// Genuine cross-session lock for "has this auction's win already been
// logged" — unlike checking a member's local txLog (which can't see
// what a DIFFERENT browser tab/session just wrote a moment ago, the
// actual root cause of duplicate "Auction Win" entries even after the
// single-codepath fix), this uses the auction_win_claims table's
// auction_id PRIMARY KEY: Postgres itself guarantees only the first
// insert for a given auction_id can ever succeed, no matter how many
// tabs/sessions race for it simultaneously. Returns true only for
// whichever caller actually wins that race — everyone else gets false
// and should NOT proceed to log the win.
// ROOT CAUSE of a real incident: a batch of ~20 auctions sharing the exact
// same deadline all fired their claim INSERTs at the same instant (this
// project's small DB tier is already known to strain under write bursts —
// see setAuctions above), and a plain network/HTTP failure here was
// indistinguishable from a genuine 409 "someone else already claimed it" —
// both just returned false, no retry. Once that happens, the win is lost
// for good: the auction's status flips to "ended" regardless (a separate,
// unrelated write — see finalizeAuctionClose), and nothing ever revisits
// an "ended" auction again, so a transient failure here was as permanent
// as a legitimate rejection. Retrying only on the genuinely-transient
// path (a thrown error) — never on an actual 409 conflict, which is a
// real, final answer — closes that gap without risking a double-claim.
async function claimAuctionWin(auctionId, claimedBy, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const t = await supa.from("auction_win_claims");
      const result = await t.insert({ auction_id: String(auctionId), claimed_by: claimedBy, claimed_at: Date.now() });
      return !result.conflict;
    } catch {
      if (attempt < retries) { await new Promise(r => setTimeout(r, 600 * (attempt + 1))); continue; }
      // Exhausted retries on a transient error (not a conflict) — default
      // to NOT proceeding here; the broader safety net below (retrying
      // claimAuctionWinAndLog for any recently-ended auction that still
      // shows no confirmed win) is what actually recovers from this now,
      // since the insert itself is safely idempotent to attempt again.
      return false;
    }
  }
  return false;
}
// Attempts the real cross-session claim for this specific auction, and
// only appends the "Auction Win" txLog entry if that claim genuinely
// succeeded — called as a fire-and-forget side effect (not awaited by
// its caller) since it needs to run async but the surrounding code is a
// synchronous state updater.
//
// The win increment itself goes through incrementAuctionWinAtomic (a
// single indivisible database UPDATE) instead of the old "read this
// browser's local auctionWins, add 1 in JS, write the whole roster back
// via setMembers" path — that path could silently lose a win if the same
// member won two different auctions closing around the same time, since
// whichever client's blanket write landed last in Postgres would
// overwrite the other's increment. setMembersRaw (the bare state setter,
// no DB side effects) is used afterward only to reflect the CONFIRMED
// value the RPC returned in this browser's local state immediately,
// rather than waiting for the next member poll.
async function claimAuctionWinAndLog(auction, setMembersRaw) {
  const won = await claimAuctionWin(auction.id, auction.topBidder);
  if (!won) return; // someone/something else already claimed this exact auction
  // change:0 — the actual coin deduction already happened (and is already
  // logged as its own "Bid Placed" entry) the moment this member placed
  // their winning bid, in placeBid below. Logging -auction.currentBid
  // AGAIN here would double-count the same money: once as this member's
  // "Bid Placed" entry, once more as this "Auction Win" entry. This entry
  // is purely a confirmation marker ("you won, no further charge") now
  // that Points History shows the individual bid instead of only the
  // final winning total.
  const txEntry = {change:0, reason:`Won auction: ${auction.name}`, date:new Date().toLocaleDateString(), ts:Date.now(), logType:"Auction Win", addedBy:"System", auctionId:auction.id};
  const newWins = await incrementAuctionWinAtomic(auction.topBidder, txEntry);
  if (newWins === null) return; // RPC failed — DB write didn't happen, so don't desync local state from it
  setMembersRaw(ms => ms.map(m => {
    if (m.name !== auction.topBidder) return m;
    return {...m, auctionWins: newWins, txLog: [...(m.txLog||[]), txEntry]};
  }));
}
// Re-fetches the TRUE current state of one specific auction from the
// database before declaring a winner, writing "ended" to the DB, or
// notifying Discord — see the long comment at the call site for the
// real bug this fixes (a locally-cached, possibly-stale topBidder
// occasionally being wrongly declared the winner when a fresh bid landed
// in the gap since this browser's last 3s poll). `localFallback` is the
// browser's own (possibly stale) copy, used only if the fresh re-fetch
// itself fails for some unrelated reason — better to proceed with
// slightly-stale data than to leave an auction stuck mid-close forever.
async function finalizeAuctionClose(localFallback, setMembersRaw, addToast) {
  let fresh = localFallback;
  try {
    const rows = await dbLoad("auctions", `id,current_bid,top_bidder,bids,status&id=eq.${encodeURIComponent(localFallback.id)}`);
    const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (row) {
      fresh = {
        ...localFallback,
        currentBid: Number(row.current_bid) || localFallback.currentBid,
        topBidder: row.top_bidder ?? localFallback.topBidder,
        bids: (() => { try { const b = typeof row.bids === "string" ? JSON.parse(row.bids) : row.bids; return Array.isArray(b) && b.length > 0 ? b : localFallback.bids; } catch { return localFallback.bids; } })(),
      };
    }
  } catch {
    // Network blip or similar — proceed with the local snapshot rather
    // than leaving the auction stuck. This reintroduces a small chance
    // of the original staleness bug, but only on actual fetch failure,
    // not as the default path the way it was before this fix.
  }
  if (fresh.topBidder) {
    addToast(`${fresh.topBidder} won ${fresh.name} for ${fmt(fresh.currentBid)} coins!`, "gold", "Auction Ended");
    claimAuctionWinAndLog(fresh, setMembersRaw);
  }
  const endImageData = fresh.image?.dataUrl || _auctionImageCache.get(String(fresh.id)) || undefined;
  const endRow = {
    id:          String(fresh.id),
    name:        fresh.name ?? "",
    description: fresh.description ?? fresh.desc ?? "",
    status:      "ended",
    ends_at:     fresh.endsAt ?? 0,
    started_at:  fresh.startedAt ?? Date.now(),
    current_bid: fresh.currentBid ?? 0,
    top_bidder:  fresh.topBidder ?? null,
    min_bid:     fresh.minBid ?? fresh.startBid ?? 0,
    image_name:  fresh.image?.name ?? null,
    // See setAuctions for why this must NOT be JSON.stringify'd again —
    // `bids` is a genuine jsonb array column and dbUpsert already
    // stringifies the whole row object once.
    bids:        fresh.bids ?? [],
  };
  if (endImageData) endRow.image_data = endImageData;
  dbUpsert("auctions", endRow);
  notifyAuctionEndedOnce(fresh);
}
async function dbUpsert(table, data) {
  try {
    const t = await supa.from(table);
    const res = await t.upsert(data);
    // Supabase returns an array on success. On failure (RLS violation, schema
    // mismatch, payload too large, etc.) it returns an error object instead —
    // previously this was returned as-is and treated as "success" by every
    // caller, so a write could fail completely with zero visibility anywhere
    // in the app. Surface that as a thrown error so callers (and the retry
    // wrapper below) can actually react to it.
    if (res && !Array.isArray(res) && (res.code || res.message)) {
      throw new Error(`${table} upsert rejected: ${res.message || res.code}`);
    }
    return res;
  } catch (e) {
    console.error(`dbUpsert(${table}) failed:`, e);
    return null;
  }
}
// Same as dbUpsert, but retries on failure and reports back whether it
// ultimately succeeded — for writes where silent data loss is unacceptable
// (e.g. attendance records, which directly control coin payouts).
async function dbUpsertReliable(table, data, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const result = await dbUpsert(table, data);
    if (result !== null) return true;
    if (attempt < retries) await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
  }
  return false;
}
async function dbDelete(table, match) {
  // Returns true/false based on whether the delete actually succeeded,
  // instead of the previous behavior of returning the raw HTTP status with
  // no caller ever checking it — every call site fired this and moved on,
  // so a failed delete (RLS rejection, network blip, schema mismatch) was
  // invisible: the row vanished from the deleter's own optimistic local
  // state, but never actually left the database, so it reappeared for
  // every other client on their next poll.
  try {
    const t = await supa.from(table);
    const status = await t.delete(match);
    return status >= 200 && status < 300;
  } catch (e) {
    console.error(`dbDelete(${table}) failed:`, e);
    return false;
  }
}
// Same as dbDelete, but retries on failure — for deletes where silently
// failing to remove a row (and the coin refund/state change that came with
// it) would leave clients permanently out of sync with each other.
async function dbDeleteReliable(table, match, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ok = await dbDelete(table, match);
    if (ok) return true;
    if (attempt < retries) await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
  }
  return false;
}

// ─── PUSH NOTIFICATIONS ───────────────────────────────────────────────────────
// Converts the VAPID public key from the base64url format the web-push spec
// uses into the raw byte array the browser's PushManager API expects.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// True if this browser can support web push at all. Notably false on iOS
// Safari unless the site has been added to the home screen — there's no
// way to detect that distinction in advance, so we just let the permission
// prompt fail gracefully on unsupported browsers rather than guessing.
function pushNotificationsSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && !!VAPID_PUBLIC_KEY;
}

// Returns "granted" | "denied" | "default" | "unsupported"
function getPushPermissionState() {
  if (!pushNotificationsSupported()) return "unsupported";
  return Notification.permission; // "granted" | "denied" | "default"
}

// Registers the service worker (idempotent — safe to call repeatedly),
// asks the browser for notification permission, subscribes to push, and
// saves the subscription in Supabase tied to this member's name. Returns
// true on success, false if the user declined or something failed.
async function enablePushNotifications(memberName) {
  if (!pushNotificationsSupported()) return false;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const subJson = subscription.toJSON();
    await dbUpsert("push_subscriptions", {
      id: subJson.endpoint,
      member_name: memberName,
      endpoint: subJson.endpoint,
      p256dh: subJson.keys.p256dh,
      auth: subJson.keys.auth,
      created_at: Date.now(),
    });
    return true;
  } catch (e) {
    console.error("enablePushNotifications failed:", e);
    return false;
  }
}

// Unsubscribes this browser from push and removes its subscription row from
// Supabase, so this device stops receiving notifications for this member.
async function disablePushNotifications(memberName) {
  try {
    if (!("serviceWorker" in navigator)) return true;
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    if (!registration) return true;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await dbDelete("push_subscriptions", { id: endpoint });
    }
    return true;
  } catch (e) {
    console.error("disablePushNotifications failed:", e);
    return false;
  }
}

// Fire-and-forget call to the backend to send a push to a specific member.
// Never throws — a failed push should never break the calling code path
// (e.g. a bid succeeding shouldn't roll back because a notification failed).
async function sendPushNotification(memberName, title, body, url, tag) {
  try {
    await fetchWithTimeout("/api/send-push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberName, title, body, url, tag }),
    }, 5000);
  } catch (e) {
    console.error("sendPushNotification failed:", e);
  }
}

// ─── ATOMIC COIN ADJUSTMENTS ──────────────────────────────────────────────────
// Calls the adjust_member_coins Postgres function (see atomic_coin_fix.sql)
// to add/subtract coins as a single indivisible database operation, instead
// of the old "read balance in JS, compute new balance in JS, write the whole
// number back" pattern. That pattern has a real lost-update race: if the
// same member is refunded or charged by two concurrent bids around the same
// moment (e.g. they're outbid on two different auctions within milliseconds
// of each other), both reads can see the same stale starting balance, and
// whichever write lands last silently overwrites the other — discarding one
// of the refunds entirely. Postgres serializes row updates, so this RPC call
// can never lose an adjustment that way, no matter how many bids land at once.
// Returns the member's new balance on success, or null on failure (caller
// should treat null as "couldn't confirm — fall back / let the next poll
// reconcile local state from the DB" rather than assuming the write happened).
//
// ROOT CAUSE of Points History silently drifting from members' real coins
// (found while investigating EKUPMANN and 10 other currently-active
// bidders all showing a coins-vs-history gap): placeBid used to call this
// with zero retries AND without awaiting the result at all, then write the
// "Bid Placed"/"Outbid Refund" tx_log entry unconditionally regardless of
// whether this RPC actually succeeded. A single transient failure here
// (network blip, Supabase hiccup) meant the log claimed a coin change that
// never actually landed — in either direction, since this same call
// handles both the bidder's deduction and the outbid party's refund.
// Retrying here (same pattern as incrementAuctionWinAtomic above) closes
// most of that gap; placeBid below now also awaits this and only logs the
// side(s) that actually confirmed success.
async function adjustMemberCoinsAtomic(memberName, delta, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(`${SUPA_URL}/rest/v1/rpc/adjust_member_coins`, {
        method: "POST",
        headers: {
          "apikey": SUPA_KEY,
          "Authorization": `Bearer ${SUPA_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ member_name: memberName, delta }),
      });
      if (!res.ok) throw new Error(`adjust_member_coins failed: HTTP ${res.status}`);
      const newBalance = await res.json();
      return typeof newBalance === "number" ? newBalance : null;
    } catch (e) {
      if (attempt < retries) { await new Promise(r => setTimeout(r, 600 * (attempt + 1))); continue; }
      console.error(`adjustMemberCoinsAtomic(${memberName}, ${delta}) failed after retries:`, e);
      return null;
    }
  }
  return null;
}
// Same atomic pattern as adjustMemberCoinsAtomic above, but also appends
// the matching tx_log entry in the SAME single UPDATE (see
// scripts/adjust_member_coins_and_log.sql) instead of leaving the log
// write to setMembers.
//
// ROOT CAUSE this closes (found by actually driving competing bids through
// the app while verifying the fix above): even after adjustMemberCoinsAtomic
// was awaited/retried, placeBid still persisted its "Bid Placed"/"Outbid
// Refund" entry via setMembers, which writes this browser's ENTIRE locally-
// cached tx_log array for the target member — not an atomic append. That's
// exactly the same class of lost-update race incrementAuctionWinAtomic was
// built to avoid for auction_wins (see claimAuctionWinAndLog): outbidding
// someone from a SECOND browser writes that browser's stale local copy of
// the outbid member's tx_log back to the database, silently discarding
// whatever entry the outbid member's OWN browser had just appended (their
// "Bid Placed" entry vanishing the instant they're refunded). `coins`
// itself was never at risk either way — only the log. Returns the
// member's new balance on success, or null on failure (same contract as
// adjustMemberCoinsAtomic).
async function adjustMemberCoinsAndLogAtomic(memberName, delta, txEntry, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(`${SUPA_URL}/rest/v1/rpc/adjust_member_coins_and_log`, {
        method: "POST",
        headers: {
          "apikey": SUPA_KEY,
          "Authorization": `Bearer ${SUPA_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_member_name: memberName, p_delta: delta, p_tx_entry: txEntry }),
      });
      if (!res.ok) throw new Error(`adjust_member_coins_and_log failed: HTTP ${res.status}`);
      const newBalance = await res.json();
      return typeof newBalance === "number" ? newBalance : null;
    } catch (e) {
      if (attempt < retries) { await new Promise(r => setTimeout(r, 600 * (attempt + 1))); continue; }
      console.error(`adjustMemberCoinsAndLogAtomic(${memberName}, ${delta}) failed after retries:`, e);
      return null;
    }
  }
  return null;
}
// Same atomic-single-UPDATE pattern as adjustMemberCoinsAndLogAtomic above
// (see scripts/record_attendance_and_log.sql) — replaces the old
// "build every present member's full new row from local state, write them
// all at once via setMembers" path used by RecordAttendancePanel and
// AddMissingAttendanceModal, which raced the exact same way the bidding and
// admin-coin-adjust bugs did. Coins, attendance count, the new attendLog
// entry, and any bonus txLog entries all land in one indivisible statement
// per member.
async function recordAttendanceAndLogAtomic(memberName, coinsDelta, attendanceDelta, attendEntry, bonusTxEntries, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(`${SUPA_URL}/rest/v1/rpc/record_attendance_and_log`, {
        method: "POST",
        headers: {
          "apikey": SUPA_KEY,
          "Authorization": `Bearer ${SUPA_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_member_name: memberName,
          p_coins_delta: coinsDelta,
          p_attendance_delta: attendanceDelta,
          p_attend_entry: attendEntry,
          p_bonus_tx_entries: bonusTxEntries,
        }),
      });
      if (!res.ok) throw new Error(`record_attendance_and_log failed: HTTP ${res.status}`);
      const newBalance = await res.json();
      return typeof newBalance === "number" ? newBalance : null;
    } catch (e) {
      if (attempt < retries) { await new Promise(r => setTimeout(r, 600 * (attempt + 1))); continue; }
      console.error(`recordAttendanceAndLogAtomic(${memberName}) failed after retries:`, e);
      return null;
    }
  }
  return null;
}
// Same atomic-single-UPDATE pattern as recordAttendanceAndLogAtomic above
// (see scripts/revert_attendance_and_log.sql) — replaces the old
// "build every affected member's full new row from local state, write them
// all at once via setMembers" path used by DeleteAttendanceModal, the same
// lost-update race already fixed for bidding, admin coin adjustments, and
// attendance recording, just never applied to attendance *deletion*.
async function revertAttendanceAndLogAtomic(memberName, refund, attendanceDelta, attendEntry, entryTs, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(`${SUPA_URL}/rest/v1/rpc/revert_attendance_and_log`, {
        method: "POST",
        headers: {
          "apikey": SUPA_KEY,
          "Authorization": `Bearer ${SUPA_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_member_name: memberName,
          p_refund: refund,
          p_attendance_delta: attendanceDelta,
          p_attend_entry: attendEntry,
          p_entry_ts: entryTs != null ? String(entryTs) : null,
        }),
      });
      if (!res.ok) throw new Error(`revert_attendance_and_log failed: HTTP ${res.status}`);
      const newBalance = await res.json();
      return typeof newBalance === "number" ? newBalance : null;
    } catch (e) {
      if (attempt < retries) { await new Promise(r => setTimeout(r, 600 * (attempt + 1))); continue; }
      console.error(`revertAttendanceAndLogAtomic(${memberName}) failed after retries:`, e);
      return null;
    }
  }
  return null;
}
// Same atomic-single-UPDATE pattern as adjustMemberCoinsAtomic above (see
// increment_auction_win in scripts/increment_auction_win.sql) — replaces
// the old "read auctionWins from this browser's local members state, add
// 1 in JS, write the whole roster back via setMembers" path, which could
// silently lose a win: if the same member won two different auctions
// closing around the same time, both reads could see the same stale win
// count, and whichever write landed last in Postgres discarded the other
// increment entirely. This runs the increment and the tx_log append as
// one indivisible database statement, so it can't happen no matter how
// many auctions close for the same member at once.
// ROOT CAUSE of winners' coin deduction silently never appearing: this had
// zero retries — a single transient failure here (after claimAuctionWin
// had ALREADY recorded the claim) permanently stranded the win in a
// "claimed but never paid" state, since claimAuctionWin correctly refuses
// to re-claim an auction this same call chain already owns. Retrying here
// (like dbUpsertReliable elsewhere in this file) closes that gap. Not
// perfectly exactly-once — a response lost after the server-side UPDATE
// already committed could in principle double-apply on retry — but that's
// the same trade-off dbUpsertReliable already accepts for every other
// at-least-once write in this app, and it's far preferable to silently
// losing the payment entirely, which is what real members hit in production.
async function incrementAuctionWinAtomic(memberName, txEntry, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(`${SUPA_URL}/rest/v1/rpc/increment_auction_win`, {
        method: "POST",
        headers: {
          "apikey": SUPA_KEY,
          "Authorization": `Bearer ${SUPA_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_member_name: memberName, p_tx_entry: txEntry }),
      });
      if (!res.ok) throw new Error(`increment_auction_win failed: HTTP ${res.status}`);
      const newWins = await res.json();
      return typeof newWins === "number" ? newWins : null;
    } catch (e) {
      if (attempt < retries) { await new Promise(r => setTimeout(r, 600 * (attempt + 1))); continue; }
      console.error(`incrementAuctionWinAtomic(${memberName}) failed after retries:`, e);
      return null;
    }
  }
  return null;
}
// ROOT CAUSE FIX for "a lower bid sometimes beats a higher one": the old
// flow checked the live database value, THEN did more work (coin
// adjustments, etc.), THEN finally wrote the new bid via setAuctions's
// upsert — a real gap during which a second bid could pass its OWN
// check (against the still-old value) and later overwrite this one,
// regardless of which amount was actually higher, since the final write
// itself never re-verified anything. place_bid_atomic runs the check AND
// the write as a single locked database transaction (`for update` in the
// SQL), so no other bid attempt can read or write that row until this
// one fully completes — closing the gap instead of just narrowing it.
// ROOT CAUSE of "I bid but wasn't deducted coins": place_bid_atomic now
// deducts the bidder's coins (and refunds whoever it just outbid) inside
// the SAME transaction as claiming the bid slot — see
// scripts/place_bid_atomic_v2.sql. Before this, the auction claim and the
// coin deduction were two independent calls; if the deduction failed
// after the claim had already succeeded, the bidder was recorded as
// winning with nothing ever taken from their balance. Retries here (like
// every other atomic RPC in this file) only apply to genuine transport
// failures — a real business-logic rejection (outbid/ended/insufficient
// funds) comes back as a normal { success:false, reason } response, not
// a thrown error, so it's never retried.
async function placeBidAtomic(auctionId, bidder, amount, minIncrement = 5, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(`${SUPA_URL}/rest/v1/rpc/place_bid_atomic`, {
        method: "POST",
        headers: {
          "apikey": SUPA_KEY,
          "Authorization": `Bearer ${SUPA_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_auction_id: String(auctionId), p_bidder: bidder, p_amount: amount, p_min_increment: minIncrement }),
      });
      if (!res.ok) {
        // Surface PostgREST/Postgres's own error body (e.g. a SQL exception
        // message) instead of discarding it — a bare "HTTP 400" here gives
        // no way to tell a genuine outbid from a real server-side failure,
        // which is exactly what made this bug (bids always rejected, even
        // with zero competing bidders) invisible until logged properly.
        const bodyText = await res.text().catch(() => "");
        throw new Error(`place_bid_atomic failed: HTTP ${res.status} ${bodyText}`);
      }
      return await res.json();
    } catch (e) {
      if (attempt < retries) { await new Promise(r => setTimeout(r, 600 * (attempt + 1))); continue; }
      console.error(`placeBidAtomic(${auctionId}, ${bidder}, ${amount}) failed after retries:`, e);
      return { success: false, reason: "network_error" };
    }
  }
  return { success: false, reason: "network_error" };
}

const GMT8_OFFSET_MS_GLOBAL = 8 * 60 * 60 * 1000;

// ─── PROFILE CARD ASSETS (Player Info page) ────────────────────────────────────
// Hosted in Supabase Storage (profile-card-assets bucket) rather than
// embedded as base64 in the bundle — these are only needed when someone
// actually opens a Player Info page, so loading them on demand keeps the
// app's initial load fast for everyone else.
const PROFILE_ASSETS_BASE = `${SUPA_URL}/storage/v1/object/public/profile-card-assets`;
const PROFILE_RARITY_BG = {
  uncommon:  `${PROFILE_ASSETS_BASE}/uncommon.webp`,
  rare:      `${PROFILE_ASSETS_BASE}/rare.webp`,
  epic:      `${PROFILE_ASSETS_BASE}/epic.webp`,
  legendary: `${PROFILE_ASSETS_BASE}/legendary.webp`,
  mythic:    `${PROFILE_ASSETS_BASE}/mythic.webp`,
};
const PROFILE_CLASS_PORTRAIT = {
  "Archer":       `${PROFILE_ASSETS_BASE}/archer.webp`,
  "Berserker":    `${PROFILE_ASSETS_BASE}/berserker.webp`,
  "Rune Fighter": `${PROFILE_ASSETS_BASE}/runefighter.webp`,
  "Skald":        `${PROFILE_ASSETS_BASE}/skald.webp`,
  "Volva":        `${PROFILE_ASSETS_BASE}/volva.webp`,
  "Warlord":      `${PROFILE_ASSETS_BASE}/warlord.webp`,
};
// Special-tier portraits shown instead of the normal class art when a
// member's profile rarity is set to "mythic" (see PROFILE_RARITY_OPTS /
// SetRarityModal — no new admin UI needed, this just reacts to the rarity
// that's already settable there). Filenames follow the same convention as
// PROFILE_CLASS_PORTRAIT with a "_mythic" suffix; upload them to the same
// "profile-card-assets" Supabase Storage bucket. Volva's mythic art hasn't
// been provided yet — ProfileCard falls back to the regular portrait for
// any class missing here, so nothing breaks once Volva is added later.
const PROFILE_CLASS_PORTRAIT_MYTHIC = {
  "Archer":       `${PROFILE_ASSETS_BASE}/archer_mythic.webp`,
  "Berserker":    `${PROFILE_ASSETS_BASE}/berserker_mythic.webp`,
  "Rune Fighter": `${PROFILE_ASSETS_BASE}/runefighter_mythic.webp`,
  "Skald":        `${PROFILE_ASSETS_BASE}/skald_mythic.webp`,
  "Warlord":      `${PROFILE_ASSETS_BASE}/warlord_mythic.webp`,
};
const PROFILE_FRAME_URL = `${PROFILE_ASSETS_BASE}/frame.webp`;
const PROFILE_NAME_CONTAINER_URL = `${PROFILE_ASSETS_BASE}/name_container.webp`;
const PROFILE_AWAKENING_BADGE_URL = `${PROFILE_ASSETS_BASE}/awakening.webp`;
// Rank-1 (clan's strongest, by Power) profile backdrop — a class-linked
// video plays an intro clip once, then loops a second clip seamlessly,
// behind the whole Player Info page. `bg` is a wide image matching the
// video's own scene (same lighting/architecture), used to fill the
// space around the centered square video so it doesn't look like a
// floating box. Berserker doesn't have video assets uploaded yet (only
// its _bg.webp still exists) and falls back to no video until they are,
// same graceful-fallback approach as the mythic portraits.
const PROFILE_RANK1_VIDEO = {
  "Archer": {
    intro: `${PROFILE_ASSETS_BASE}/archer_intro.mp4`,
    loop:  `${PROFILE_ASSETS_BASE}/archer_looping.mp4`,
    bg:    `${PROFILE_ASSETS_BASE}/archer_bg.webp`,
  },
  "Rune Fighter": {
    intro: `${PROFILE_ASSETS_BASE}/runefighter_intro.mp4`,
    loop:  `${PROFILE_ASSETS_BASE}/runefighter_looping.mp4`,
    bg:    `${PROFILE_ASSETS_BASE}/runefighter_bg.webp`,
    // This source video frames the character smaller/more distant than
    // Archer's does, so a plain 1:1 cover crop reads as "too small" —
    // zoom in to compensate. Starting value, tune after visual check.
    scale: 1.3,
    // Closes a visible gap between the video's own top edge and the
    // container's — pulls it up. Starting value, tune after visual check.
    shiftY: -60,
  },
  "Skald": {
    intro: `${PROFILE_ASSETS_BASE}/skald_intro.mp4`,
    loop:  `${PROFILE_ASSETS_BASE}/skald_looping.mp4`,
    bg:    `${PROFILE_ASSETS_BASE}/skald_bg.webp`,
    // Standing pose, same framing issue as Rune Fighter — same starting
    // values, tune after visual check.
    scale: 1.3,
    shiftY: -60,
  },
  "Volva": {
    intro: `${PROFILE_ASSETS_BASE}/volva_intro.mp4`,
    loop:  `${PROFILE_ASSETS_BASE}/volva_looping.mp4`,
    bg:    `${PROFILE_ASSETS_BASE}/volva_bg.webp`,
    // Standing pose, same framing issue as Rune Fighter — same starting
    // values, tune after visual check.
    scale: 1.3,
    shiftY: -60,
  },
  "Warlord": {
    intro: `${PROFILE_ASSETS_BASE}/warlord_intro.mp4`,
    loop:  `${PROFILE_ASSETS_BASE}/warlord_looping.mp4`,
    bg:    `${PROFILE_ASSETS_BASE}/warlord_bg.webp`,
    // Bent-down pose, same as Archer's — no scale/shiftY needed.
  },
};
// Static per-class background stills for the ranks 4-10 "notable roster"
// banner (Player Info page) — separate from PROFILE_RANK1_VIDEO above
// since these are confirmed uploaded for all 6 classes already (verified
// directly against the storage bucket), unlike the intro/looping videos
// which currently only exist for Archer. "Rune Fighter" -> "runefighter"
// (no space/underscore) was confirmed the same way, since it's the one
// class name that doesn't lowercase-map obviously.
const PROFILE_CLASS_BG = {
  "Archer":       `${PROFILE_ASSETS_BASE}/archer_bg.webp`,
  "Berserker":    `${PROFILE_ASSETS_BASE}/berserker_bg.webp`,
  "Warlord":      `${PROFILE_ASSETS_BASE}/warlord_bg.webp`,
  "Skald":        `${PROFILE_ASSETS_BASE}/skald_bg.webp`,
  "Volva":        `${PROFILE_ASSETS_BASE}/volva_bg.webp`,
  "Rune Fighter": `${PROFILE_ASSETS_BASE}/runefighter_bg.webp`,
};
// One-line flavor tagline shown next to the character on the rank-1/2/3
// video page (the open space beside the sidebar) — same pattern as the
// reference site's "Ruthless and Bloodthirsty Fighter" under each class
// name. Populated for all 6 classes now, even though PROFILE_RANK1_VIDEO
// above only has assets for Archer — this text is inert (never rendered)
// until a class also has video assets, same graceful-fallback approach as
// the mythic portraits, so it's ready the moment the remaining classes'
// intro/looping videos are uploaded rather than needing a second pass.
// Keyed by class, then by power rank (1, 2, or 3) — restructured from a
// flat per-class map because two of the top 3 can be the SAME class
// (e.g. two Archers), and they need their own distinct tagline/flavor
// text rather than literally identical copy just because they share a
// class and video asset.
const CLASS_TAGLINES = {
  "Archer": {
    1: "Precise and Unforgiving Hunter",
    2: "Relentless Marksman of the Arena",
    3: "Sharp-Eyed Vanguard of the Hunt",
  },
  "Berserker": {
    1: "Unstoppable Fury Incarnate",
    2: "Undefeated Storm of Blades",
    3: "Feared Vanguard of Ruin",
  },
  "Warlord": {
    1: "Undisputed Master of the Field",
    2: "Iron Will of the Clan",
    3: "Battle-Forged Commander",
  },
  "Skald": {
    1: "Voice That Rallies Armies",
    2: "Keeper of a Thousand Victories",
    3: "Bard of the Battle-Line",
  },
  "Volva": {
    1: "Seer of Fates Unwritten",
    2: "Whisperer of the Old Ways",
    3: "Oracle of the Coming Storm",
  },
  "Rune Fighter": {
    1: "Blade Bound in Ancient Runes",
    2: "Warrior of the Old Script",
    3: "Runeblade of the Vanguard",
  },
};
// Short lore/flavor line for the second, lower section on the rank-1/2/3
// video page — positioned further down than the title block so it clears
// the rune circle's lower arc instead of crossing through it. Same
// per-class-then-per-rank, graceful-fallback pattern as CLASS_TAGLINES.
const CLASS_FLAVOR_LINES = {
  "Archer": {
    1: "No target escapes her sight. Every arrow loosed has found its mark.",
    2: "He has broken more duelists than he can count. His bowstring sings only one note: victory.",
    3: "Her aim thins every enemy line before the clash even begins.",
  },
  "Berserker": {
    1: "She wades into battle laughing, and the battlefield remembers why. No shield has ever held against her for long.",
    2: "His rage has broken shield walls and reputations alike. Few dare stand where he chooses to fight.",
    3: "Every clash leaves fewer standing. Her charge is the last sound many enemies ever hear.",
  },
  "Warlord": {
    1: "Armies fall in line at a single word from her. Where she stands, the battle is already decided.",
    2: "His command has turned routs into victories more times than anyone can count.",
    3: "Every warrior under his banner fights harder, knowing he never yields ground.",
  },
  "Skald": {
    1: "Her songs have turned the tide of battles no blade could win alone. Warriors fight fiercer when she sings.",
    2: "His verses are sung in every hall of the clan — each one earned in blood and glory.",
    3: "Where her voice carries, courage follows. The clan fights on when she calls them forward.",
  },
  "Volva": {
    1: "She reads the battle before it begins, and bends it to her will before the first blow lands.",
    2: "His visions have saved the clan from ruin more than once. Few question what he foresees.",
    3: "Every rune she casts reveals a path others cannot see. The clan walks it because she's never wrong.",
  },
  "Rune Fighter": {
    1: "Her strikes carry a weight no ordinary steel can match. Runes glow brightest when she draws her blade.",
    2: "Every rune he's mastered adds another edge no enemy has found a way past.",
    3: "Steel and sorcery move as one in her hands. Few survive to describe how she fights.",
  },
};

// Start-of-today timestamp in GMT+8, used to sum "diamonds donated today"
// for the daily cap check — donations are timestamped in real UTC ms, so
// this just needs to find the right boundary to compare against.
function getStartOfTodayGmt8() {
  const nowMs = Date.now();
  const shifted = new Date(nowMs + GMT8_OFFSET_MS_GLOBAL);
  const dayStartShifted = new Date(shifted);
  dayStartShifted.setUTCHours(0, 0, 0, 0);
  return dayStartShifted.getTime() - GMT8_OFFSET_MS_GLOBAL;
}

// Converts a <input type="datetime-local"> value (e.g. "2026-06-26T15:30",
// which carries NO timezone of its own) into a real timestamp, treating
// the typed numbers as GMT+8 wall-clock time regardless of what timezone
// the Elder's own device/browser happens to be set to. This keeps "ends
// June 26, 3:30 PM" meaning the same real moment for every Elder, no
// matter where they're browsing from — matching how the rest of the app
// (weekly decay, push notification scheduling) is anchored to GMT+8.
function gmt8StringToTimestamp(datetimeLocalStr) {
  if (!datetimeLocalStr) return null;
  const asIfUTC = new Date(datetimeLocalStr + ":00.000Z");
  if (isNaN(asIfUTC.getTime())) return null;
  return asIfUTC.getTime() - GMT8_OFFSET_MS_GLOBAL;
}
// The inverse — used to pre-fill the picker with a sensible default and to
// show the picked value back for confirmation.
function timestampToGmt8String(ts) {
  const shifted = new Date(ts + GMT8_OFFSET_MS_GLOBAL);
  const pad = n => String(n).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth()+1)}-${pad(shifted.getUTCDate())}T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
}

// ─── SUPABASE STORAGE (auction images) ───────────────────────────────────────
const STORAGE_BUCKET = "auction-images";
// Uploads a File/Blob to the auction-images bucket and returns its public URL.
// Returns null on failure (caller should fall back to base64/local handling).
async function uploadAuctionImage(file) {
  try {
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const res = await fetchWithTimeout(
      `${SUPA_URL}/storage/v1/object/${STORAGE_BUCKET}/${path}`,
      {
        method: "POST",
        headers: {
          "apikey": SUPA_KEY,
          "Authorization": `Bearer ${SUPA_KEY}`,
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      },
      20000 // uploads can take longer than reads
    );
    if (!res.ok) return null;
    return `${SUPA_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`;
  } catch { return null; }
}
// ROOT CAUSE of "uploaded images don't show up in the library" on this
// (newer) Supabase project — confirmed directly against the live bucket:
// storage/v1/object/list/auction-images returns HTTP 200 with an empty
// array via the anon key, even though the bucket genuinely has files in
// it (auctions display their own images fine via direct known-path GET,
// which anon CAN do). Anonymous LIST on this bucket is simply blocked —
// the same class of restriction already documented elsewhere in this app
// for a different bucket. The previous fix for "library empties on
// refresh" relied entirely on this LIST call to backfill from Storage,
// so it silently regressed to doing nothing the moment this project's
// bucket policy didn't allow it — every session again started from
// whatever this one browser had uploaded itself, same as before that fix.
//
// Storage's LIST isn't the only way to know what's been uploaded: every
// addImage() call already has the {name, dataUrl} pair in hand at upload
// time, so instead of asking Storage what's there, the library's own
// growing list is persisted directly to app_state (same key/value table
// already used for decay_rate, login_announcements, featured_auction_id
// — all things anon CAN reliably read/write on this project).
async function loadImageLibraryFromAppState() {
  try {
    const rows = await dbLoad("app_state");
    const row = Array.isArray(rows) && rows.find(r => r.key === "auction_image_library");
    if (!row) return [];
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

const KARI_BG = "data:image/jpeg;base64,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AABSZCAgZG91YkBv4AAAAAAAAAAAAEdybiBkb3ViQG/gAAAAAAAAAAAAQmwgIGRvdWJAb+AAAAAAAAAAAABCcmRUVW50RiNSbHQAAAAAAAAAAAAAAABCbGQgVW50RiNSbHQAAAAAAAAAAAAAAABSc2x0VW50RiNQeGxAUgAAAAAAAAAAAAp2ZWN0b3JEYXRhYm9vbAEAAAAAUGdQc2VudW0AAAAAUGdQcwAAAABQZ1BDAAAAAExlZnRVbnRGI1JsdAAAAAAAAAAAAAAAAFRvcCBVbnRGI1JsdAAAAAAAAAAAAAAAAFNjbCBVbnRGI1ByY0BZAAAAAAAAAAAAEGNyb3BXaGVuUHJpbnRpbmdib29sAAAAAA5jcm9wUmVjdEJvdHRvbWxvbmcAAAAAAAAADGNyb3BSZWN0TGVmdGxvbmcAAAAAAAAADWNyb3BSZWN0UmlnaHRsb25nAAAAAAAAAAtjcm9wUmVjdFRvcGxvbmcAAAAAADhCSU0D7QAAAAAAEABIAAAAAQABAEgAAAABAAE4QklNBCYAAAAAAA4AAAAAAAAAAAAAP4AAADhCSU0EDQAAAAAABAAAAFo4QklNBBkAAAAAAAQAAAAeOEJJTQPzAAAAAAAJAAAAAAAAAAABADhCSU0nEAAAAAAACgABAAAAAAAAAAE4QklNA/UAAAAAAEgAL2ZmAAEAbGZmAAYAAAAAAAEAL2ZmAAEAoZmaAAYAAAAAAAEAMgAAAAEAWgAAAAYAAAAAAAEANQAAAAEALQAAAAYAAAAAAAE4QklNA/gAAAAAAHAAAP////////////////////////////8D6AAAAAD/////////////////////////////A+gAAAAA/////////////////////////////wPoAAAAAP////////////////////////////8D6AAAOEJJTQQAAAAAAAACAAM4QklNBAIAAAAAAAgAAAAAAAAAADhCSU0EMAAAAAAABAEBAQE4QklNBC0AAAAAAAoAAgAAAAMAAAAEOEJJTQQIAAAAAAAQAAAAAQAAAkAAAAJAAAAAADhCSU0ERAAAAAAAEAAAAAIAAAJAAAACQAAAAAA4QklNBEkAAAAAAAQAAAAAOEJJTQQeAAAAAAAEAAAAADhCSU0EGgAAAAADSQAAAAYAAAAAAAAAAAAAA+gA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IiB4bXA6TWV0YWRhdGFEYXRlPSIyMDI2LTA2LTE1VDAxOjI3OjExKzA4OjAwIiBkYzpmb3JtYXQ9ImltYWdlL2pwZWciIHBob3Rvc2hvcDpDb2xvck1vZGU9IjMiIHBob3Rvc2hvcDpJQ0NQcm9maWxlPSJzUkdCIElFQzYxOTY2LTIuMSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDoxODRjYjBiOC05ZWE4LTgwNGItYjVhNC04ZGU4NDMxM2VmYzkiIHhtcE1NOkRvY3VtZW50SUQ9ImFkb2JlOmRvY2lkOnBob3Rvc2hvcDpjYmJhMDE3OC0zNDQzLWE3NGItYmNlZi0xYmY1MDQzZjk4OGUiIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDpiZTFiMjg3ZC02YTUyLTAzNDctYjcwZC0zYmFjOTNlNjI1MTUiPiA8eG1wTU06SGlzdG9yeT4gPHJkZjpTZXE+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJjcmVhdGVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOmJlMWIyODdkLTZhNTItMDM0Ny1iNzBkLTNiYWM5M2U2MjUxNSIgc3RFdnQ6d2hlbj0iMjAyNi0wNi0xNVQwMTowMTowOCswODowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIDI3LjcgKFdpbmRvd3MpIi8+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJjb252ZXJ0ZWQiIHN0RXZ0OnBhcmFtZXRlcnM9ImZyb20gYXBwbGljYXRpb24vdm5kLmFkb2JlLnBob3Rvc2hvcCB0byBpbWFnZS9qcGVnIi8+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJzYXZlZCIgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDoxODRjYjBiOC05ZWE4LTgwNGItYjVhNC04ZGU4NDMxM2VmYzkiIHN0RXZ0OndoZW49IjIwMjYtMDYtMTVUMDE6Mjc6MTErMDg6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCAyNy43IChXaW5kb3dzKSIgc3RFdnQ6Y2hhbmdlZD0iLyIvPiA8L3JkZjpTZXE+IDwveG1wTU06SGlzdG9yeT4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPD94cGFja2V0IGVuZD0idyI/Pv/iDFhJQ0NfUFJPRklMRQABAQAADEhMaW5vAhAAAG1udHJSR0IgWFlaIAfOAAIACQAGADEAAGFjc3BNU0ZUAAAAAElFQyBzUkdCAAAAAAAAAAAAAAABAAD21gABAAAAANMtSFAgIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEWNwcnQAAAFQAAAAM2Rlc2MAAAGEAAAAbHd0cHQAAAHwAAAAFGJrcHQAAAIEAAAAFHJYWVoAAAIYAAAAFGdYWVoAAAIsAAAAFGJYWVoAAAJAAAAAFGRtbmQAAAJUAAAAcGRtZGQAAALEAAAAiHZ1ZWQAAANMAAAAhnZpZXcAAAPUAAAAJGx1bWkAAAP4AAAAFG1lYXMAAAQMAAAAJHRlY2gAAAQwAAAADHJUUkMAAAQ8AAAIDGdUUkMAAAQ8AAAIDGJUUkMAAAQ8AAAIDHRleHQAAAAAQ29weXJpZ2h0IChjKSAxOTk4IEhld2xldHQtUGFja2FyZCBDb21wYW55AABkZXNjAAAAAAAAABJzUkdCIElFQzYxOTY2LTIuMQAAAAAAAAAAAAAAEnNSR0IgSUVDNjE5NjYtMi4xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABYWVogAAAAAAAA81EAAQAAAAEWzFhZWiAAAAAAAAAAAAAAAAAAAAAAWFlaIAAAAAAAAG+iAAA49QAAA5BYWVogAAAAAAAAYpkA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";
const CLASSES = ["Berserker","Warlord","Archer","Skald","Volva","Rune Fighter"];
const CLASS_COLORS = {
  Berserker:"#e85d3a", Warlord:"#c0392b", Archer:"#27ae60",
  Skald:"#8e44ad", Volva:"#2980b9", "Rune Fighter":"#f39c12"
};
const CLASS_ICONS = {
  "Berserker": "data:image/webp;base64,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",
  "Warlord": "data:image/webp;base64,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",
  "Archer": "data:image/webp;base64,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",
  "Skald": "data:image/webp;base64,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",
  "Volva": "data:image/webp;base64,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",
  "Rune Fighter": "data:image/webp;base64,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",
};

function ClassIcon({ cls, size = 24, noShadow = false }) {
  const src = CLASS_ICONS[cls];
  if (!src) return null;
  return (
    <img
      src={src}
      alt={cls}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        filter: noShadow ? "none" : "drop-shadow(0 0 4px rgba(201,151,42,0.4))",
        display: "inline-block",
        verticalAlign: "middle",
        flexShrink: 0,
      }}
    />
  );
}

const POWER_ICON = "data:image/webp;base64,UklGRnYQAABXRUJQVlA4WAoAAAAQAAAATwAATwAAQUxQSJYKAAABx6egbRtpDn/e9wKIiBx/5Gok6zyIPAtADMC2bRMAjAIa0v8Hj6T9IKL/E/D6T3zec67xVQuoCQz7mwZKgs1bkoASkvmcpCRh2wIuZFJhSwLJg11VdZC6N82cWhLwPK+WlGxsCUCVu6WMcdGBpDK85cAjQtoke5KbXRB76zYL6nYVIHmRpKsgnZY0Nw5grRNwIfabBJR/OPefXOEJ27ZDkrZt2/bjPCMSxa6qdl9suy/ztm1j9Fgj27Zt27Ybl+22Uc7KyIw4j0FmVddV9WgYERPA/2tLyLQkCZNWi0I9y4xGLZP1UYhZsCwGrQrF5sSGWB/IBjPLBzODkNVIWX0gJmJMSSvM8rHN2997z4H1zXe9/haywbpRi9p959bm/lvXF91ZJ7cVpTAQd37m8wfp2/rUtqxJ98ZPvKlB333NM5MDQSvJ6rWdDw5SOQhC8+5bJzj4/oIKHGSNiRfqdVtByuKeESpJgEPFcLN6ezEfcAOcZPW9MWrFCKvfiyQunNemdbjEvIqF3MXVM6zfIND9dWPFRk1vzJN07ReOzDB852c3gUA4U7/xnVMM3XlZSvmGadlKqXVObRJ0//JYWqDO1m/GAUTx3Om5dmran3dAW8524koZPPtyhPrkxbJ2sHg0xftudAPScOapfrD+ePvylQYeTp9ZKRp+/EUlHcg0+t27+c9vmxv6TOaIxs7KBz/1AM99jeyA3E49GrQyAAEuvWd3qfCn39u8gANvGKzOX6ZK2S/+agQIrEzJsloLedg6fLXVcC5/0XwDSLvva3V/+ILcWj80vDdzcS13T/5qybJ63hw8Uwb4yF8uLAhNfVlxM5b46Gh54lPXzG3y9z/6HrDy5QGyqkCviuLQQFy//dYts2ucsU8DKT7+NXdsdnHwLdZ57vVHrYz01dT291w+Mx2zV4cQN77/q74mA4S78Fj8RvcuS8m2zlqrU50fM9yTi97ixb/6kyx7NTxp7C27M9wNkIGd+Imj6+/EnMEFFR3O//MJmURvkuAx95CWTZ1ytkGZABfgOvOn/3HSb9nkhE5lpFT6xb/4rXN4j7vwFN9z2V3LFYpzD4MJGQlDPn5z1Sj2k5ynWtEdqw+Nvf6BQSBh4KJ734YTCsuVhVve6QF05cz6jSQJNW78sasHkXOkCsjL2eqGugCMy+c3C6K/fWtctoZ2jSLn+e8/l9350R0kqPjGX92IQvVYFHLiMBUk4/jvHSk2PYOLkV0sW5NRd5yHj8/M/dbmj3667qDNX9jAOX88l6K3Rd/uv/7T6TQ4dBQn+ZhsuRrMS8DNqT1lJ370gS8H8FFwjl/NpXx6CsA59+i5TiuNj9+AI7XclyvPswdAbPyHa+2q6HTPXGLxE+1MmZ+k78Xj3W5Rtaf+uTAX9+eZlivkc8N5EqGbZcq8ZHauR8CVKrM0RN/WnJeeKauXQlW2Zi5nuZV4ZcgQNG670fKQKI1e0fIYF3ZZAlSSQh623DEAGMOvuC8foXiuEsK5fX8jRpGPIQC3+lx9yBHjuYixceg2HETt6QVDyyNZVvpjP/A5NzlKrD20xqLZ2htcOIP12rVbJMjWKUQbO7SeJJzTP3t08tqcpGVQrDe6zRt27xwQAktsW6uQ6+CECzYMFame5I1zlkdbv41kILh4/Pn/fOLKQC5dj0KoZ5vecE8qWFTO+gmLtdG3gNgxdm2dyTVwqhY1vgEXi3cf/4taNmDSkhQGY/2uDxZF0UXq09tsWD3efbuLHTfPDmGsn+7WrNlgie4YfGpT2TCW6sgGDu0hJSm5g7sAEWSNsU8H98E778WTNkw2QwoISC7J3Q2HvbcNmvDFSISNJAwPAcBACaBqN7N33w68dTfG+tyzVgmQJBZNEm43RhKLV1W7IBluXH7k2YvtfHzbIYQDxWxj++cZrBvEbW9VH1kAHHHy8Rcut/N1++5YR0IVZVFVi3VaL9P36u/9zOl2mdxq63/xEcxxLrdHPh/HwbnBa7fjuPHkLx2+0E5YbGx5w8fXgeDl+W4/d/lBHHjhP85QplR1iirNXakdoPdy+UFAAGt91wTA/D/+y6m5hVYRY6hFtn4x4FYcKfolmxzPHJi8nKkaaLYnO94uqqxsTPbwwiEMwLyx5maA6eeudOdnC1JjTa3VquX1y0Cyo0+ockhV99wWCYY8+q4vuGOs9SIXyk4nxThdgttsaxYHZzpsB6imq267VBx9x1u2Nq8++jcvDmgMsOpXOsmhShcmYxJ71ioeet8+4B3beWym6JATBhA6MUPfK0N1RDOjqpLbmre+nd65n/kDJvaiSr9+1kuwbPgOlPiLs532KJWD0PRfZlRtsXE0ga9FICYGHR/ZINzLqruG5A4KfHvn/F+QxKGRaCAb2wKhPFaNXYAIYGX4146lpBj35kg5fUch2b4YlbrF1ZdJgd6kaxPVkU6AzeNmYAwPAVfPd/cj98eeveVeUGcyVa4Q1z7AkpMdX5dFVfOtP+2Yuw4f33VQbgfLCxeBwWEJII84kws+SqXxH7zinz3gHibPp8pVC3ftSLYE+OVQkxeto79gCX7nl1n7nVtKm0jtaZyY07foAtH82vd0LWUXa381Y87eZhRUujhiabFkj/y9SpDVbsY1/adTl8LPhJRddMuAbuFA8ulpxLrhePQn9jB76trA1DVgtCEc9057sxaDP77qjmNZHZiambl65k+aPPkfcWgdYmaKBCldecU9De/z6fUfGv+Tl5zGKELQk+LUTUr9kp063OkDCTHcwF964zsnf2/Wd69x9+NXqgTenfsvCd6/Jp9tJaee3zWaYLrtOLgVQ+Pez/mnc4WDk7otSGvuyGuVmzWz4Q/i0uGZrgOE+d0InmvNdbsp+pMXXLBdWQ+YDoR+diCT6Mm0FfCzj3tIlmXFCyD2zAfRZ6bdrASDv/rKgo1t7AhZyk2iNyv3knqSDqTc6bVQS2ao2DI2kxq3joBSvTtj3ifpJTcQs0+crX/mRlClh6dzp1+6Ge9xtpYZ/bPpY6oEt37mlc7m/Qis8bISfb1cONYGd6N/UvnzXad/sHWoR2y0sAjdny4ssajjpIdblfdDwWKbkOQgkSxuzxthEWVVsh7zk2XpfTwp31GTO8lBVWA2UzQWl3z26VIkBxlFCtFsEfI0i4PTupgq+ns3xjRP8AQy+dNXXCzZq+rSP/3z3cMAxeHnSzeWmDHZA9MznhYhie5zRxYwYPaf//58qrhOLzut/7p175aR4tzTz3TKxJLCLIAz1XJfzPFu98mf/f5fakyffvbf5jqddF3ebRXBgnmZqlRoSV61e6DdXUrfRrCoVKWBqjCuP5XtGIM8lSXXm6p+yZ2lu8XM5FXZZZkdBM51S6FfMF1Hr8BZ4SIb6FfLpOtbjaaBMQRiYjjYfwOKbJjoN74ly7T6QqPcFyuAKjzQHIpaXQp5o7tpu1uP+bv3Do83olaPLGsEs3Oif7LHv/uZ0MxMqyWErHnbu25gicmu/OXtzSysFtV95P0fG8eXQDI+8f4Rt1Viwxc8lp1U9e2De5n5RdLqyPK7/prlfbfF1RGzvV8bU5WSu+Mgs5DnMZv/JrPVoVo9DmRynEUlM8rZwlglFmtBsCQEXhVplYAQztIF4L5q/m8KVlA4ILoFAABwGACdASpQAFAAPqE8mkkmIyKhMftroMAUCWQAxjghUd+d52o00OFt2OfD04igHf6B2fd6/jiBjoG41mT47zcKKxZpfk2+ufYP6V7U/kTfsBgOmE0JgAJ7P8gwzldVnfnJcXAhgXHVuABAdOpJhyeFdTb/E8J/fdJ1OQEuA7sCA3kU8NDhjxgRy5oyhwcDiLSQpjYZmM+SjVGfd2P3uDDHUwE0Xy5YuQBlBKLURjgX6M/L/XaKlmHrcTO12nXbbqrY+e5ije+MH/teQAAA/v02bkDF2iDvRIr/6ryURDL8jsDhE4SdcaMxB8yy0nVGPwmJZ6Y+pgVpH2rYYC5fl4UtmsKgz5v34KDSUZH0YWT9AZ3byCQh5Tifj41IWS+0aKEx4PAWBQwl5MxV2MmtaWuCJD0PZ8Sgqxoqc5n3p6pAed2yXYR49UJRVMcLAv1Tw+vp96LZx65t6LIyLuTd//5z30hWps73q9E8GPYEzVqgIdPHAdnsW5jlg027ao2a84ni0itc/PzxzvgPnKjo28U94hIB1375pBPXWnrzOc8OsZ8pF/pLzFwtOD+qQcSUq+Ns6m6YhTD613XaNcH/7VpiSymqBZXfaHGm6pGyNo+Fz5oGXRZOfrGgABJ08yNwvkrFWR8LiqEAiFpb9PdWd8lDq2z+bM64sNX59Viky4iwrGNPOeEk6F7qcCS9tslheIIKl14OTj1i4lV2uS8mAbHm9eTa09QBhJxVZz4w+is7pz6rK17Rwhk2iUN1/om2anE0PLAgQ+9968HkKIJTAXySsRhs9dNx46hv8nFYwDJwMuv+u1764mrUau4NmaDeSY7AjeaCX3jQXhFfiwLb9PqvpLX7raTlrab7D7wlgMWo6cI3Yz3IAHJgkMzjh9A221meqRUAkDy6z1xWntEZOVVw1wF+4Ixok3X0jfwKwpMmbbUuE0uOdfQ17JSvg9D49zHLvzuir0nKJVyGqnJst/rPTvn9z9OpAVeWocyOxXruOLr26VonnO1/V4ooCau5UhKvPGmUp5XaiKBazXObUjfUip003TQszTi7FkDu/a7r+4DBnnllZTAtsL35QPm1ijVabXy8/8QSm6MD3u9mp7eqGAiMyhJqyQqD3kDaLJcgNiu+FzdXkYUb1Qa2BF+klNx72PqolMkfy+McTo7WLfgMu0XuqjfKFzyeEQUPWtsTjE7STwIPQMfhvLh0LnJ1pUcmwqjrItSP9LnwgFo6UxOIKibxZrygWcE5lpveSKARwyChtQZTnthn1yPHeJfBZqMaQZ/L1tB/egwZWDswcmObw8+Rz3YYiLAaCG0v+xXtXK0BZwv0tR1OxmBansKuTb7IDrm2y09IGyFiUddAKAA7/m4juShPrYOnXZK0aaIuWmudrv3PV4Jsn9qTFRkbY0GYMYRu4RGMl80Ma1EUu6jEOxZmqXEpdsIzcfZ4vu5vXdAT56ujiQ6J57KPsnbq5RM9kQBySB+Nv1xLzGNowRfvUUIpL3NbrUVITo+bZz7BOSDWZBFVUlCRQ4aVjoQtf9oe9ENeM3tONqXPWeyXvVX+Y8+T6JAQ77kN72ZoiOC2hpcdAZoegJIvsso2RiWoymJZMwFHz5umB1a93+JitipbvNv5/X8cNwAYmQgy8V0ouluVUQbsu3riBRfqbLOWBKhP894A9rK4p53uFjyp2MdrXh7cBuc4C3b7Pw8L2E5iWiehbvA+3uCbs34hTjQ8mQSqC6tvHqu1mFr+BAylMoojHGcWXC2agKPpBVgGfOWGhnxwR+uKUUPcvbMSmku5VSr9H7gx6gkgBiJULFySGuStO6M9oZHJ4gWkkRSmkMihBuywTQ27UpeRb/hOmOZC8Ww2r1MLCK/Nn1HULdHl0V2kD4I9Rb+42zxsQeKElMuvNjd1y6jO8E4ggt74trdbzLi094Q4RWzCbmEAh5UfD2yHwvyJzYGRXvTAAA==";

const RICHEST_ICON = "data:image/webp;base64,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";
const LEADERBOARD_ICON = "data:image/webp;base64,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";
const MOSTACTIVE_ICON = "data:image/webp;base64,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";

const ATTENDANCE_ICON = "data:image/webp;base64,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";
const WARRIORS_ICON   = "data:image/webp;base64,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";
const COINS_ICON      = "data:image/webp;base64,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";
const AUCTION_ICON    = "data:image/webp;base64,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";

function StatIcon({ src, size=18 }) {
  return <img src={src} alt="" style={{width:size,height:size,objectFit:"contain",
    filter:"drop-shadow(0 0 3px rgba(200,146,42,0.45))",display:"inline-block",
    verticalAlign:"middle",flexShrink:0}} />;
}

// Fires a burst of coin particles from a screen point (e.g. the bid button
// that was just clicked). Pure CSS animation per-particle via custom
// properties, so we can have N differently-angled coins without writing
// N keyframe blocks. Cleans itself out of the DOM via the caller's timeout.
function CoinBurst({ x, y }) {
  const COUNT = 14;
  const particles = useMemo(() => Array.from({length: COUNT}, (_, i) => {
    const angle = (i / COUNT) * 360 + (Math.random()*26 - 13);
    const distance = 70 + Math.random()*70;
    const rad = angle * Math.PI / 180;
    return {
      id: i,
      dx: Math.cos(rad) * distance,
      dy: Math.sin(rad) * distance - 30, // bias upward so it reads as a "pop" not a flat ring
      rot: (Math.random()*540 - 270).toFixed(0),
      size: 14 + Math.random()*10,
      delay: Math.random()*60,
      dur: 750 + Math.random()*250,
    };
  }), []);
  return (
    <div className="coin-burst-root" style={{left:x, top:y}}>
      {particles.map(p => (
        <img
          key={p.id}
          src={COINS_ICON}
          alt=""
          className="coin-burst-particle"
          style={{
            "--dx": `${p.dx}px`,
            "--dy": `${p.dy}px`,
            "--rot": `${p.rot}deg`,
            width: p.size, height: p.size,
            animationDelay: `${p.delay}ms`,
            animationDuration: `${p.dur}ms`,
          }}
        />
      ))}
    </div>
  );
}

// Small floating chip showing the bidder's remaining balance right after a
// bid lands. Anchored above the click point (same x/y as the coin burst)
// so the two effects read as one connected moment instead of two separate
// notifications competing for attention.
function BalancePopup({ x, y, amount, label }) {
  return (
    <div className="balance-popup" style={{left:x, top:y}}>
      <div className="balance-popup-inner">
        <img src={COINS_ICON} alt="" className="balance-popup-icon" />
        <div className="balance-popup-text">
          <div className="balance-popup-amount">{amount}</div>
          <div className="balance-popup-label">{label}</div>
        </div>
      </div>
    </div>
  );
}


function LBIcon({ src, size = 28 }) {
  return (
    <img src={src} alt="" style={{width:size,height:size,objectFit:"contain",
      filter:"drop-shadow(0 0 4px rgba(200,146,42,0.5))",display:"inline-block",
      verticalAlign:"middle",flexShrink:0}} />
  );
}


function PowerIcon({ size = 16 }) {
  return (
    <img
      src={POWER_ICON}
      alt="Power"
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        filter: "drop-shadow(0 0 3px rgba(200,146,42,0.5))",
        display: "inline-block",
        verticalAlign: "middle",
        flexShrink: 0,
      }}
    />
  );
}

// ─── LINE ICON SET ────────────────────────────────────────────────────────────
// Replaces emoji used as UI chrome (🏆👑⚔⚜🔒🔔🎲🪙📅⚠) with crisp SVG line
// icons that inherit currentColor and the app's signature gold-glow drop
// shadow — so they render identically across every OS/browser, instead of
// each platform drawing its own colorful emoji glyph.
function Icon({ size = 16, style, children, viewBox = "0 0 24 24" }) {
  return (
    <svg width={size} height={size} viewBox={viewBox} fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, verticalAlign: "middle", display: "inline-block",
        filter: "drop-shadow(0 0 3px rgba(200,146,42,0.4))", ...style }}>
      {children}
    </svg>
  );
}
function TrophyIcon(p) { return <Icon {...p}><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4.5A1.5 1.5 0 0 0 3 7.5C3 9 4 10 6 10M17 6h2.5A1.5 1.5 0 0 1 21 7.5C21 9 20 10 18 10"/></Icon>; }
function CrownIcon(p) { return <Icon {...p}><path d="M3 18h18M4 18l-1-9 5 4 4-7 4 7 5-4-1 9"/></Icon>; }
function SwordsIcon(p) { return <Icon {...p}><path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M9.5 9.5 21 21M21 3h-3v3l-2 2"/></Icon>; }
function ShieldIcon(p) { return <Icon {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></Icon>; }
function LockIcon(p) { return <Icon {...p}><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></Icon>; }
function BellIcon(p) { return <Icon {...p}><path d="M6 8a6 6 0 1 1 12 0c0 3 1 4.5 2 6H4c1-1.5 2-3 2-6Z"/><path d="M10 21a2 2 0 0 0 4 0"/></Icon>; }
function DiceIcon(p) { return <Icon {...p}><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1" fill="currentColor" stroke="none"/><circle cx="16" cy="8" r="1" fill="currentColor" stroke="none"/><circle cx="8" cy="16" r="1" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></Icon>; }
function CalendarIcon(p) { return <Icon {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></Icon>; }
function WarningIcon(p) { return <Icon {...p}><path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17h.01"/></Icon>; }
function ColumnIcon(p) { return <Icon {...p}><path d="M4 21h16M5 21V8M19 21V8M3 8h18l-9-5-9 5Z M9 21V8M15 21V8"/></Icon>; }
function GearIcon(p) { return <Icon {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></Icon>; }
function VolumeOnIcon(p) { return <Icon {...p}><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></Icon>; }
function VolumeMutedIcon(p) { return <Icon {...p}><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M16 9l5 6M21 9l-5 6"/></Icon>; }

// ─── BACKGROUND MUSIC (ambient audio for Login + Leaderboard pages) ──────────
// One persistent <audio> element lives for the whole app session (mounted
// once in AppRoot, never unmounted) so we can fade it smoothly instead of
// hard-cutting playback every time the page changes. `desiredTrack` is
// "login" | "leaderboard" | null — the component crossfades to match.
//
// Browsers block autoplay-with-sound until the user's first click/tap
// anywhere on the page. That "unlock" only ever needs to happen ONCE per
// tab, so it's tracked in a module-level variable (not component state) —
// otherwise remounting the component (e.g. switching pages) would forget
// the unlock and silently fail to play, which was the leaderboard bug.
const BGM_TRACKS = { login: "/audio/loginscreen.mp3", leaderboard: "/audio/leaderboards.mp3" };
const BGM_VOLUME_KEY = "cf_bgm_volume";   // 0..1, persisted
const BGM_MUTED_KEY  = "cf_bgm_muted";    // "true"/"false", persisted
const BGM_TARGET_VOLUME = 0.45;           // moderate default level
const BGM_FADE_MS = 900;                  // fade duration for both directions
let _bgmUnlocked = false;                 // shared across remounts, once per tab
const _bgmUnlockListeners = new Set();
function _bgmTriggerUnlock() {
  if (_bgmUnlocked) return;
  _bgmUnlocked = true;
  _bgmUnlockListeners.forEach(fn => fn());
}
if (typeof window !== "undefined") {
  window.addEventListener("click", _bgmTriggerUnlock, { once: true });
  window.addEventListener("keydown", _bgmTriggerUnlock, { once: true });
  window.addEventListener("touchstart", _bgmTriggerUnlock, { once: true });
}

function BackgroundMusic({ desiredTrack }) {
  const audioRef = React.useRef(null);
  const fadeRef = React.useRef(null); // requestAnimationFrame handle for in-flight fade
  const loadedTrackRef = React.useRef(null); // which track's src is currently loaded
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem(BGM_MUTED_KEY) === "true"; } catch { return false; }
  });
  const [, forceTick] = useState(0); // re-render once unlock fires, to (re)attempt play
  const targetVolumeRef = React.useRef(BGM_TARGET_VOLUME);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(BGM_VOLUME_KEY);
      if (saved !== null) targetVolumeRef.current = parseFloat(saved);
    } catch {}
  }, []);

  // Listen for the shared one-time unlock event (works even if it already
  // fired before this instance mounted).
  useEffect(() => {
    if (_bgmUnlocked) return; // already unlocked elsewhere — nothing to wait for
    const onUnlock = () => forceTick(t => t + 1);
    _bgmUnlockListeners.add(onUnlock);
    return () => _bgmUnlockListeners.delete(onUnlock);
  }, []);

  // Smoothly ramp an <audio> element's volume from its current value to
  // `to` over BGM_FADE_MS, using an ease-out exponential curve (fast at
  // first, gently settling) rather than a linear ramp. Cancels any fade
  // already in progress on this element first.
  function fadeTo(el, to, onDone) {
    if (!el) return;
    if (fadeRef.current) { cancelAnimationFrame(fadeRef.current); fadeRef.current = null; }
    const from = el.volume;
    if (Math.abs(to - from) < 0.001) { onDone && onDone(); return; }
    const start = performance.now();
    // ROOT CAUSE FIX: el.volume only accepts values in [0,1] — assigning
    // anything outside that range throws IndexSizeError, uncaught, right
    // in the middle of a requestAnimationFrame callback. Floating point
    // rounding in the eased curve (or a leftover slightly-out-of-range
    // `from` value from a previous fade that got interrupted mid-flight,
    // e.g. by quickly navigating between pages) could push the computed
    // value a hair past 0 or 1. Clamping before every assignment makes
    // this impossible regardless of how the input values drifted.
    function step(now) {
      const p = Math.min(1, (now - start) / BGM_FADE_MS);
      // Exponential ease-out: moves fast initially, eases into the target.
      const eased = 1 - Math.pow(1 - p, 3);
      const raw = from + (to - from) * eased;
      el.volume = Math.min(1, Math.max(0, raw));
      if (p < 1) {
        fadeRef.current = requestAnimationFrame(step);
      } else {
        el.volume = Math.min(1, Math.max(0, to));
        fadeRef.current = null;
        onDone && onDone();
      }
    }
    fadeRef.current = requestAnimationFrame(step);
  }

  // Core reconciliation: whenever the desired track, mute state, or unlock
  // status changes, fade the current audio out (if playing something else
  // or going silent), swap source if needed, then fade in the new target.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const wantsSrc = desiredTrack ? BGM_TRACKS[desiredTrack] : null;
    const targetVol = (!muted && _bgmUnlocked && wantsSrc) ? targetVolumeRef.current : 0;

    if (!wantsSrc) {
      // Nothing should be playing on this page — fade out, then pause.
      fadeTo(el, 0, () => el.pause());
      return;
    }

    if (loadedTrackRef.current !== desiredTrack) {
      // Switching tracks: fade current one out, swap source, fade new one in.
      fadeTo(el, 0, () => {
        el.src = wantsSrc;
        el.currentTime = 0;
        loadedTrackRef.current = desiredTrack;
        if (targetVol > 0) {
          el.play().then(() => fadeTo(el, targetVol)).catch(() => {});
        }
      });
    } else {
      // Same track, just volume/mute/unlock state changed.
      if (targetVol > 0 && el.paused) {
        el.volume = 0;
        el.play().then(() => fadeTo(el, targetVol)).catch(() => {});
      } else if (targetVol === 0 && !el.paused) {
        fadeTo(el, 0, () => el.pause());
      } else {
        fadeTo(el, targetVol);
      }
    }
  }, [desiredTrack, muted]);

  // Re-evaluate once unlock fires (forceTick bump above triggers this render).
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !_bgmUnlocked || muted || !desiredTrack) return;
    if (el.paused) {
      el.volume = 0;
      if (loadedTrackRef.current !== desiredTrack) {
        el.src = BGM_TRACKS[desiredTrack];
        el.currentTime = 0;
        loadedTrackRef.current = desiredTrack;
      }
      el.play().then(() => fadeTo(el, targetVolumeRef.current)).catch(() => {});
    }
  });

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    try { localStorage.setItem(BGM_MUTED_KEY, next ? "true" : "false"); } catch {}
  }

  if (!desiredTrack) return (
    <audio ref={audioRef} loop preload="auto" style={{display:"none"}} />
  );
  return (
    <>
      <audio ref={audioRef} loop preload="auto" style={{display:"none"}} />
      <button className="bgm-toggle" onClick={toggleMute}
        aria-label={muted ? "Unmute background music" : "Mute background music"}
        title={muted ? "Unmute music" : "Mute music"}>
        {muted ? <VolumeMutedIcon size={18}/> : <VolumeOnIcon size={18}/>}
      </button>
    </>
  );
}

const EVENTS = [
  { id:"ISB",  name:"Inter Server Battle", coins:100, color:"#e74c3c" },
  { id:"CA",   name:"Clan Annihilation",   coins:40,  color:"#e67e22" },
  { id:"CS",   name:"Clan Sanctuary",      coins:60,  color:"#3498db" },
  { id:"STI",  name:"Sindris Treasure Island", coins:40, color:"#9b59b6" },
  // World Boss used to be one generic entry covering Mon/Wed/Fri, which made
  // recording attendance ambiguous once members started asking "which boss?"
  // Split into the 4 actual named bosses, each appearing on its own 2 days
  // a week (see WEEKLY_SCHEDULE) - RecordAttendancePanel lists these
  // straight from this array, so admins now pick the real boss by name.
  { id:"CWTD", name:"Canyon of the World Tree Depth", coins:10, color:"#27ae60" },
  { id:"CN1F", name:"Canyon of Nidavellir 1f",         coins:10, color:"#16a085" },
  { id:"COR",  name:"Crossroad of Ragnarok",           coins:10, color:"#2ecc71" },
  { id:"F5F",  name:"Folkvang 5f",                     coins:10, color:"#1abc9c" },
];
// ─── EVENT IMAGES (compressed WebP thumbnails) ────────────────────────────────
const WORLDBOSS_IMG = "data:image/webp;base64,UklGRlYOAABXRUJQVlA4IEoOAAAQTgCdASrIAMgAPsFUpE8npCM2pTTMAtAYCWNsPkKa+5k/IVRtub96FP1bnTs9hAnoQIiQP190UVenZMhZnuVknTmperLngFyQ145/dfojIkja8pjgNzh9oVDddcHuqYb/ypqKlgsLBAr9FyQLoIRyt1ewsjgKUbB9um0sc+12Bzj2+kb6j6kuz6+lANct/4pBDBPkvAUC54yy8mXDClPIl3EchNpoUmSTEmDuoUxrth6mCK1QeEDluCFNBRl340ga06cdfSNcPlHmNThupuIl5sqipURQgwvoYETmqh0vDltr48OOYfFDFCQoquuomm/GnDR6iyxY07h5p2VNJ3qJwMfP7P/2yNltz9zz46zS7+Ov98HqooV7BtPHRZLac402qJVj99zY+hitd1J8Rq/SWrFlfbk6ERVJh7Kavnuw2UQ14wHOXlESZaTsfzpjL23nInxMWYMJ+Y2luQ3tPOfBfmm4OWR0OLOlKjkWiUjrR+Qahkzum4GPLii5oIbi+IcVEeU2RUCxjqQ/2161P8srkS8nYBwKofspxNxlEr6pKOVy0avhK8uFP/K+ZLLcv8kbi5XKAT6CTqVsIjQLNpolZ48pR76LrEYJQSSI2tIwX9yFlKRfd9gZ/Cdls+64UnA0xBTEBwTrA+y1/shrGUiUdw+2f+LvCTdDpjou/8pYSI/36l53hC2NW1b8qBzfkpmyv+UwC639NNgkJIuovIc4O5/55O23qnoqnUgWWVm/SHJ/w9t/pcMS2L7N1YDb5GtvcdRVlyvtRmKduaMUNJhLXHu61T99FF9jxT3nhfvBm5JizX/whklWUZ9QJ8wPXmemxoBCVYrsGAAA/vtrwfTr3h0hKwYZtPynWw8t+7aUu/jdZ7W2OL1wsbV3wpOZFMqh5Uo5B2ma+g2BY0ELp84fpNGhqjIFQDzH2vUVJBdBoBoQPEeL+pTtOOnwmPhso338uLE/Z1FtfItOrpDtzynJ+MEK9yPnik6YClm8qBbBw0QE8vPuqGfbNhNX/OEJ7Nd29JjHchDorZxs0sEXchHnuQ+1SXOob0ABHEDiiqBdo5GeNJ/yxr3KJ4y8BV28nDg2jloTK67vy/WFIesHxoFB5ZX9fQH5po4l/l+Dn31Jsyv8d/fF0oBl4zRstUkUOhYtizBaYG3xog7qf9fEMdmuftLIK/qwPl5exVGYoBhFymkZpij1IQ9dIdkZ4dTEJAMnOy7UktwgOXxzrWoyzCZ5sKUNuQHA4JEj+Ve8uOntSh0/I4MnpKG8zis9XsheQ6ODUj0P80ceZWtkFbmilwTaT1FzqURIfsDc3ndwyOe4Wb2xEzaLlTMy8S23rcjSORZ2AQxiri6/FM/d++aEHxmLxG6III7BnerbHI/ukm0HUpSmPlgtHWGKMGxR/g0u2Qgw4u5irg4jfyOkUNtWixBoPZeNLgzpb1hnsWrK2CVI2MyK2959ocFWjpUiTsAKvdPgq7fR6r8WHRYGgrQhjmW/wiGSaO/K5R3Bix9eyJfQEoLTgkkYecUJSzOCiLnrnaoH4b1Gvfk16q7Fa2IanE2d5OtU2V4QeEETTd6l+lBvln8tUyJeknI68W9Mj4jLmaip/C7zh3TOvBVybeZfFziC7fLltYk7WoqVLtEkkrZQfjMGFUzsDeobRnuDcmitIKntOoX8rTb4rs7A1iV5ppCuDqqMREPThiKvScbpawgD+VY0k+r1FzWlwbsxI+4a85OnzRlIDsukvllzYCz+lh0DsuYjkZUE1lPb+M+SxJPXrqwDlpdhDG7OSt5ppEz3OMB4tGf+qXC6A6b+jiW97Lj9ei9FWs00AcWvFrMsJ4L6skiUMRrIOQp87/SJgesu077wGGJIUEBCjAAiPVKOk1VIij4lEzYnTeUUPnVj6aB201c12p3sGMmWbraoMT8ArujaBG+aXieB2bTY/1QjNjYXSurrCi0IQ0JRj5dr2MQ+N8kwNtzKdqv3kvFcQz00AnsXiH0PKmBkhoSYf+yzxU38ccliyVrGOpHtGswjuVjfkOD2goYCCw9Qoah9bNcpz/7/KHw6KNvGQiW329+cBxSqaFzTnkxhMnUzK+tHYEw3VAt+FMGfQICC5RTeayWk+poou9pw/4NL+E7AEGyEB3BO4Q75+LKz+Mchi9GT1SwN+s9bg/lTq4RJF7FotVuKMKr07BqXCv3MWM/Y4+zBlPIIjF7tBM3ztli7LXwa3ORgZgeHtGV9162kQwNyoNtyUNql3KXHCfwlDnOewdYnKLmrToP79Z2GizAEOk+8Gqc4jQOapog7W1FMPF258tdYiyUOIUh9EjO7rEpW6Iewi94NwKKYRFbHC7tVRwhNAKiK1hGQbx/piI/2yl52A8So1UC3ywOyvXO2V2d8tnAh54QY+NcLiynPC/h5PtAaRkQYAvJNKi/+MG2QAIOtPuajzko2dPfFItfVDpyeCFLmv0kQ7wmSossuXU5zk917RzjdjfwXULNReVYDpx8OCNJlnWZryrpyPlBAKaEp0RorvlvYQnF5bDVAsWkbOgHLcrtm/ydqAtodGL9hjG+5IyvE+IGXwOlqLktk79qLL3HbMI7jk0g1Cu8IEoM7l3q9Ll75Xm/enL/BXABc9fRya6RxfHbVqvRY2daYqWUz05Gx28yPkYaHoDXau4+HRdX3J5yxuaqZ0gjbQC+F/h0UnHlQOc4M1FRRXw3mq3S/+UbumSgKgjKcnrzXH6pROScEwsx/8t5gAXKXyAZAqzwO3u+iLHdanzSVLeoe/5vH6CiC7NR1LeJCAuOOdQIPYJGgfv5NM56GdBuDkjnwn6B4DISFk70dxH91uOdDWHL674tdVCS7y4N1Ghbn+Z0mzaRe8405/bjjBaoCJOw9NLir5+rh834bXtypuMV4DPyfiXn7bf8vnJNYOQxYG86A2xAC0DZr/GGNEbyldmdqfwKA8fvzvWbLXIES8TElKMV+pUb5QSAUBYFq6UTJIAk2RixWwGiSHFTkEAYnwHvNRhsYZCDGHPk4GNzAKgce8DmSV3BReOsc2E1MkQ/pFnWkmVIobQXrzBUVpxdGjx7D+a18rtpfqytWbgkl4iUyVStT67Xgnjal1gC4Dl1hOr06RpRN5s8SEZfFNxecXFTueVHbHZYsVZMK7PD64zZrzdPNj5quGLy0oi2lwyXskES1WrDJS7zqXtd5FwsDH0qbRMyPz1aETah4aYjSR5WdEkqC4G/Bv/OAQxWOFYZNi7FgKLtkdbLIz56GmPdV4DrHNvCkizlbzE5Jp0do9HlTEf3ayfAZlZZrXpVG4K6Hfl2rqaH0ATZAMZy4aMVG3RzmP/y2xa1bwagzFAj+pEbPtTuGoxqXiYXmlPfA/rRMoyGzrf/rlAZ0j3ge0c8898FpQ6td5X/n4fX89s1PT2f6RSq2Atn0OMptvboyztFk3PQujg9yZQnAkt30qgDsx7kjL2yCI/GpBEX2tzB/6GPBrBDYz+Acs7mIZx9qV/ThHUmy+jpx8zR7hA9nRmEUn3XFFmH6KRm8u1i3NlRTx+N4Xa/NjpqFP6GWZlNzwPePvk5QKpELAycz7aVXZApmvC5xqmh95MFSebJqTNTliUftmGXWBOWLc+PgpH+bkSfWU8+yPPgrpZYdyNZa2CYX71ECCyvgv5uPc/l3L419GIPYx41yHUlYQKb9VLvUdoK8J4Cy0P/P6etHJOnswWQricMj7ehTBHb65Yv/doOKJQ6qABcxD7W1ciIUCb/UZNkG+T7WTf2AJlPrrF0cN5y6MfH3tKJDa9J3L23dv89duzqgrqVh7aJwKt4YJ+5e3shyQZeRJtFJMC4MStEwzRJovdM9b2lQzUbfeb3aiS5HjHMXJKnF0rhAEYbIMR6gF7eSWFvpBaq4OCvQ4vinf3HLKo2yJSungSJk7dzFFEowxfDANXuryugbIxJyVy72c7usbJhhnhvmyBzwYzGDLpaGkqbfxl/x0q/UcLZGHZEL2rLIdmG6abviNvMMq5B+LBVCY16wLhjdhh7uWTqi+g0KqryEI6qB/6aYDl7kc9Bvrpw19kZ5xmfjBYL/8J4+UnvEk65u673LwOb6MbDAlgZgOj74GvvuwLOYlStnaV3nlTbU7IkOZhKKHhBAYsgq8ac4SHbpYgR1sKCa6r1w7eKmLksY/w9zMsZ98Vcy0od68BoVFeDRbB7SmUCo7EmmYFG01GiN2GQhXBDchETjMnIM7V35vpPawUd3i+pGqCegXzoWxnFFQvnEv/MkvPDFsAMqxK+up6OWpNO0F+YKMba9Si+qizYSGyvCnkO8j2iIrLPNFPJoW0Y0P2rd6QtQ4Cgbg6QfCcmklt3F3+FhYV2kdNU6OtLBRliMWVCCWUZFwnLfMWJ/bO1/QrLCuSYXPxSmA895XLtx5YvxdIqNnM6giQocI3Xasbwq/p5vTCNpOdFq1Xt8oBC3jv2/vcgqNeyMVc6Rf0KjWDRcThyrBFGGDxbg+4QwvDcmYLk539pXzWfsKKwu/hMqZTQvF19fw1uzd0tLtDMBdKE3dxl19WWzycdG8DU5Jzs/wwXlSVwmBQGwxaWNhj2p2hc5vrOqJU9hbBNH4d8FzXrBnZD7EiRxuj4lBvczykiMO9vD1N9k3KgvPXnKhc+gnEibNla8GKdjc33LBKVVP+WTgXks0OPoznmRLjkXLZ1338cb27alqpH1x1b/wJV80TPgsqZMk0iQ5tcoPaeKHy5lC4khldctuW1mrlgKyTDEEvIAHlRBYJrnYZtWo1a5YfO5VcgBX+IoJzMv7ZZ9IEUaxULdPcBGS0DVYV3/eZjyFQ2xRb4aYP9kOcAoR4dD0vLM/4OttUIab6xJi9suhq28aMlvJEMpbLZP060M9Y5EZlGdBPf8aiZ4AAAA";
const SERVERBATTLE_IMG = "data:image/webp;base64,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";
const SINDRIS_IMG = "data:image/webp;base64,UklGRkgYAABXRUJQVlA4IDwYAABQdQCdASrIAMgAPsFQnUsnpKKlLptr0PAYCUAYG1Dbm9rc8PRcHlxfOvsIKUZhPTlS2O+qsRs4zaLAk9ycAjeB1DM7X4PdQ89T6h/QlS+ruJOvFob1Fmn5rMdPiK3C71o6h0F8OdsAj5wX/zMrHlxHiPS4u2OkYhzKX9KYAZhSooOdLO61MdfvXP4kYxeM5OfFqkMqTjX3SP947a10KyOuj/p6lw6sFrKXcfSyNqz9/G+FpwaOU5/cUNElzCxp6gNGWg8wq8G2zWLrn9ocdXbU9aytNdpySmWrB7JeK0j34GvRAzZQgRfgQkHSP7bmEv1YwTlkRR/zOa6+1pafvBT10Mldt3r4BCvg5R0yZtEyFA6q/INKZaViuh2ZGhck8JO4z9NU3H4xgRLW1N8Jq5iiRIhcUIfL11T+0XKxYbmAp1yTmbrHJ2IJWElq2ybwsJKvkJ97dYk2NATFilwlPsShyjOn9C6/zUOdm5Qz0GSH3tOmZU/4tl/Mjo+GwC9TWIE6680vVbN1y8V77gDt4o8D8x6nDaJozvq+Csb+EoMtj6Y34hmVCSGTjZIw0R5rtW+raWnhz1FsecPOelzA2ct/i0HTsg6xP45jfoZrzEdOweP3uWsDASUGw3BVE+0QWCn/9Uc1aElIDsOXbvpiezf30h3rbh2Mvq7Jn/c2zNPdRmoPsLlapcJ3OUWtJQmDA3ZBgmnystKJwnyqquWAiga2vxuEwJvCH62VyhUwxUp0iEz8abSs/YH5u+5RWzTE9UXmtFtihwLP13GWJX7n+Yexe2GIIwXY5e7lLA+bkZLtsxyPiaYeMVbgbI7qTT6jH7J26+ZzewBHL4931ojkx3Y1SHdOClPAOmBzzZm38rWcPStHByK/LnIHBhCKSGjNKpKVR81I19XtIjkKgeFl97wMiqiJgsqpSgDx9dmnyTjqthp9oAdJ/qL7S0Qw5LxaPGNSH3WwNtghjpZF9zuTf5nJD5ZGQeBte6oj06nfV5DUVclzgb4TAHpEQjH9we9EqunJPDBFgKAWZf8SRknaYnROAxpxgdypDOmBjIZ/TsKBhsyEXBmlHJzaBfwmmSbM5Rb9Rr0t9n32S+zqoGvO4N6epIC+O04vIJF7jjQRQNNIPJ6pC0r+fDHfNkdDI6+VITQrbCh8JcNl+OLmA8/9mmBC48WatvbGYID7ZVo4/NhkRu7OQN/MpDCWZgY58nGChXo2cW45gvhNWcc7JKP4nj4Hp/Pubwy+NdYssYUkzyVuvXKxAAD+a+j+PKm30ynjRSE3WVmKGqsjd2amDrsXgL64Ak0Of1ubmlWEvU5K1GuFkJA5vEpkXhVChujEzzB9B0tV9S6sysH+UgTE1sgshKGt8NYcIrA75WmRSzE990ihJjHJsN29nQPo5rS3Wulj91hpnZ9e027FFJvhX5S3JUSwVr9Qa8EqqgMW97+ugwmvnCtZZtodvTkGlL3Rq/RuYsvGkrAJXHIdQxPHb634U4A7wniV5/ig5UXJe9xAzFthG5UU7J0VKHSNe4/XxPTty1DuR39JVJEb/LKFkuImNqUF9zQTnvnLhetiA0j5qzpOGXaSOkVBBedkXRr5QlFFs2ZMBNc1JsrLGV6LgKifO+dvxAOYf80oWtJ9S9lILA8K/tzg6btA8cD84Zw7CC6Q8YIL7WBkHafAuIgSKaDQDafMKjDlgMm0zEB0RH7gwfbbVrWj449JmLkmwmbVO9NMW8FjsoTYP9n+iql/ldUzZm7BGgl/ShkwF1YhLzoPbbh69BcCo7rIdTI/JNHDiFy1AZnNZf85FjyVrv5eP3wqAMzumEgaT6CkNcgf4SPclzaAoWWdHhDICOlL7Spu2bzQglQVScRLmmIFiMQVgZWSFckWAl08tll5OAmV5ClRDu1Qxgc8o/wsj+l6e5vXrXX0dON2PwJ+D4guk79EN8b+ZSkm12ExBqJzUshNtwGhOW4NFcp/9YoX+fNtSWxK2c1q4jUrW9bK7HvtAyfXVeGmcqFONbT2wi8VejNLFUjocc/cZEPs6TxSznWs8EwJaFVTUUddr/m3/GJSScCfqtXdvh1vhDz5/ZZS2UUxvVt5IG7CmNnOFiOLEdBR9LEkbAf40Co2cgbDh7vgtTi3+MRUEsB8LFXsCuADhT3g4grWlOhVZhaGLhfGV+9k8gUZNGVrlzB04Db7iXNHN94wUkahIYaHeGPZZ7rAJdAor8HWzLwv53JI+YFxYklG3++DAPJJB/1BeYVjWz53rQS/k8h+vYQuNtHBpurA1EU6qvCSn72OpOFDiHm6rpytwkI0nK4ogBMZzqqFp8n/0QY1BWnfn5LROIPfiAKeCYng97Lu3rMqMIZg9ChjnG+o9OgBteyfWvzQ9YVoQlqdkFlV9ncU83kCdJ9LO5zzVY2Ye5NdUqb/0AiqBe1IYLd2Uz0R8k4OD+9dAG3nPdzApFS77vcRGkWvb+iWr70gkrpXfCw2WVkVH6mxgysOdVB8dvVKz24yxsHbfSrethDGEwbCMC+72At7tUA32DBaNcYHLGmTDlkp7uJhDBvyW/BXoehB2HmWzFTm3JbF11HNBWiawl92i/arZZ1U+yBOK3J3sEeMz3Cj7PLVEh2C/G1Wqi5UgRwM3vtYRlSoAJOZOfP0eWgDmJEuCAWycrQEL8sCtJbmDB5u+o+Rofoz8sEm3KZ+csobBZU7zDIf5Va2+XQkBA+h6xUREhbqif4wvS1k3n0YrVlABsAuZE+uaNjCi+gZA/aJQ9aCrE7EWV+2ZcxujfHt27hls27+hyA1dsPX5SM9A8nt2upRnMsiiarAkNckMUI0Lg90nT7f6g/1ueWtT4/2ayRdyjH93iMxofdT6j2/NRj0VNriDR+nJiqJPiVZWyiDBoQrfxOmD0frdLAmSlZtNNF8K+zmBmD0bx89ifBZX5Tr4UCVxEWR5I1CTDoNO+n7lBpU0arksZsx4Zer/2zm0gE4ULge7GK05JWlO2SYV678loeet3IfhxoqUObekcR1yANESM6DPCfEClcrIWZsjYo/FpR7VLFBooJZ2xHzltAbIo/MMXKG22SFvD1IPUsc6y6AKaaQFn6mww/YlQwdeSNP5HcAKZp/Fngm1+whrquZ8s0eGFh4vfp2AKcCHzw2Kc2RfUxqQBq9l4mOzwAx+CWHRdDcZXtsot0YlSPGQuHGxq29lpJc8jSLZ+FBeJf60+r96FipyGOSqi5KTc6+NjBekhYQQv6k+HpJ9qRna9Q8mcFwJMTVXuH7eY1/s+3F+oMpJ/bFKHarkK0xLjsN32+fp4rLXSKKXmSjBnJmwEv22e+Sy9frjn7i/eS+OKdYFjQ2IJRtJjeLZggLyhlNDCsAnB3uELH+53tKLVaZhzE2aWRudhKZEKdu0LhWuCj5+R6pfUTcAlwUBfR+sDtvSvx5woDAr8a4xy0ScwtR7d0P8ivQGtDTeHB6vMdOTWrRIEefYi+l9QMAa2MfeNLb++oGwrx0dAbuW4qUJp6O2K7Ay6W8X9vp9gO6PS6Npx2PUHhjVVVCy/kIDLNK+KdkdCaAPTJGmiCnY5DrfzVLMVwLyt7KoxNt7DW75lMZQVpXIBTlT1MNbJOBPa523an/+3XpSaw9dXns+Ddm8vB6IhaJWFsOA9aIFMockg6dqopBoBzLLGnjus+C1ND8LdrFlZeVjiltEm2Omb/XqZ793VJlJmPB+0kxiCywkKi61IK6RcaWSirBv4XL22djGbWiLvJg/jioQ6hc9hS3ib5CmqD4piDmWC0z0Dt2JXFSrRf2UNvee5dky6D79BeMyC82KcsFGmKYg3sf3H0SkNQ82oXHGf5StTZJMl9zX7pddqNneo7TkQyjzDy1wJ6qczoKgpzGWQsXEVY4ct32WAdksxRKQiUlcm6dBU4hxVhAVXXQdPFkrUlj/xMzsRS11PyUadk3OEU2nGJA1wJCHuGKMhGBYqr/MX/YaKqImbwvoO4qlOp1eBj2swGuX5OH8olsX766S72OfZ7cRjY4mRjnZe7bCx0T4t5uMTXag5TdWb3DuIIKVfbg+/tsqDqZI3pTMzJUcW2sNaEy+qDQoLIQpRmt7cxqAElIhMJ+EJgj6i+7tpSJUIad8y6A+hkV8yWucJrvWO8h24sTpQ/fcGEA1LVL3gMYZW6H/7jfJYdYCQ8ZuQFPDgxL8SSK3vwJpQ6fuYzGXbvT+dLCif+Q2jJsrwlG/Wg3m4DF8uGL4w43yzLM0BlsEhOFIE3Ghx0ZXJ3ssKFW6zoyvITwXI8Z764E3DxrrWL4wJK5iQNPmyMJW2RG4YQ0+0kfs5D8vuZNjp1tx1CPdj39A7/LuPhfu4/1jJXRNHFQFlxxG5Ia14PJWHocU8U9KyxtUrS7+sCTho36hR00jfM8puI7tSlCK1/KmxlO+PAdMMf/WN8m9o8K0zOpIOM/iPUIYoJOEQreRqY3xR/Mldc1aVzVW5zOERy/pIoTO2K2FzWe6/n0oroi0StilnkBMgfO69KgOnJovjvr1wLc8BRN68QOkKj6rweZh1u46oQcKhQGrQO74s3kxxJsBqGsbiiOxp+JFG0nNfbUrUzBlXn/0inQ8rGTPAtvoyZThZZu6zP369fbV28ZlRgATpFngw9I5JoSiSj6UUsNaoaQAIfw4sUDuLSSZz+7X0Gz5u/tKsP+fg/dV3I06CFixyX0vqmhyOX6MJEupsTn8RfIYvZonQwdO1ygZWBaZql1fIjcOqhwuKcwlXQmQoOFh/T5SKvN6AJnB3yY4oRUj4osmY6XDR4dGygkYMTCEhKkaieURocENj/r0A8qsi36aIXomrb4EWqXpMyjstmdxIUxdKk3PtopAkG7fsUhJz1D0MxaQZrNpM/CG9HE0owD4UpDjVZT4Z5Bsmmo/kVhbohdJLFJsENSxpoDJAsYyTx7+FXlp3nP70oBFclhr+TaGSA/bPO/WkrFQxBTXWFOZSFX8V0I1Q35gUfq98IIlE5KK8BlK8xY1Or302f8El3gbDSi7G9CNDJ411t6C6arZsVsLCcVLzXOkz9fTr2AupOor8uekz0vdMGYmG0YHWdEvxjIDvKMXbCe1x6M7f6a56SpfOyqaiUPnMe1YCM6dcq8PuoxRxc308mXP6dEaZTo01NQohZ8DXL1/Mo+pGPJ/alRl7CcnnMGfDIOgWmR+utwwS3u5pQyOlESFU96djPmla27KuIvhWr2lFC57w9KnOPS1/6c4AjF/W1/pDIkmOP8N7Iukv/AUNjUMPcO31KWdHuVXaWE25WR9nCyZRhFYt8ThMmyVbt3H49QcSjGjIzk6VPej9LI/XYZTCtpM0MdkfKhMKWUouBfFyKBHrD8uUKcsYO2nT2GIsHpKsw5fpT+iUJNOKymdKCVHxIvh0dVgCmSBDzIAgrolGSzBHHXTnCJZg0ust7EsW/QHRIoy4YU7zDbiz5/loiEII6MRrF8HfMFwo4NC34Vpje0htKwhmtovIGAOGFS/0ENWQbyzKJvv5pEgGKM2AnPrdPwGDW13JMEsj+gG3ASbzcf1BBK8RteFcIcVJD+mP0lqUozX8fSjQPHj9MMUpGCaDDO7dpFrGlJ+7OpnDjIV+Aw7Qodm5vhs0Ql6YSsCTQJMhPMhipU7W8kPjatEVeiy5nq4NaUa3Mq1j2dqnL9mQh225TSQyEN6lAVTZ+3pz3WF+g/qIcnnWbE+PVZ45L5Ko7XBMI6FwbNixFlVTmsiaJQDOQKHJwRFxITyjnTQk1IThTrnqtn2YkTWdD6zucyCa9Q7WUiDj7aAg+G8ylxTxLJIs10zuNCzcrMUHPX5sqJqg7h+xA5BAJ4Xw1g09q+VncvQ4/uh31q/PhD7z2dHYRDxHopPsjjNDmuwxfSCkusY5STI6H+Z5RQVR0cNRRp3USUsIO9lWkV0kXB/EgQc1CMfs3w8eG1IDTq15V2I4M9NFTdT8p+KJ8RgtLQ6RKVdUrXspyJtUWSM8XZkvN0i/UwVptZr8l32+O/ASdk5UWbrKHaO7+OJB/3k1R7fdq27xc4Dn9v9FRVLV3b5L/huKQVAhLItuRkcLzn1Sd1GvHq4jD2QR8CX0bAN5JzsDamV/jGA3Mshh/7wyou/r85kAsK4r+LhXc3c9FokHRU3gJBNZ3+blgSxMWk9gMmuprm26DBjlb0oByecPRGuYOz+XFH/Uc1CFHXNPxFZJUXi3/PC1C2XYG/i9K0qq//Zr2ROluBmOU+EDswqXFooBVT7DL2eidapp3sdaPlufVrU4zg3wi5CxuDVFzNL6/cYLVGVB3jLysmGTOW2hk3NXuc8zaxfUYMlycFdnRegV/Of03tyRKyKDnmILcG67cvQxNY6FIEUk+a7l17EbNL3kkfjm7EZTUzeuFHfJzUEZUkm/zhulSQaj7A5HNbb+3hDC7H5ZO+gjpMz2AxhIH6Xe3nPzSJcOHIhWnTsqUtQbMiUTzl6svS72nrNKGVZb++WeRhyv0NfuliTvlC71IOFZ6BMcd0UaA3XIBT7XYB9mBI7Ovq7eZO6x+hjINUsPhHAc5cfLexICVYXDT7NEr2yLwBhGes9NESlD7w6ytnr07TZqt7QlOpcbh7P122p5mh04Na+qi5lVMyt5jcEtFg6F4nerecxfOpCEhWdEUkh/i2HGHw8Gza2OZes2jqoayiJyYOevZuYlvnoAyOnqaMqtv9tLlMaL8XCHODZmFEIfNq1u30kfT16tevSrfuNZkSYWvz3maxy5M8quJJzsDfc7bsjXdEdYNjT4ToTRmhUt7UBsXau38EpLgIvZfpzqmY2alnIYJpS0qMn7uTqWRYHaxmz0bJRdhrF28eBBbQttruFwIcG6ckZRkCNKcMv0Ef5oe15b6q5N36k9BgKTHOjB4WvttvJO5SEUOaxyFdBA3E7mILXMPy4l517/o6bsB7tcAuX1n7oFtrUeSLJhevg/IVwJrqfvtOX9RNsCgAlfvTwXgNHU258a91vhE7YP8HCEc3YZg1X9cIF4zL1c+WyFVkEOJeQ4dLxKQZ1/bmYjL4DInd1C9moAb9O2XHYErUlyaXAtbR3C0qcb7K6FZX8w8TKRI7UbbPaFZisEyxQLnApfUYnIsWhRvo5Q6sd3zgQS45BnH3ydQv+XxSYE2/UEd9x6e/ODn+F7OSxdohhbIl1vlg6HC8opfkp4f8RvalR6f2/4C1SoOdxiHtWX5uyBbFIX3xTfnMUscLP3tWFN5twNFdIlC76Rd9+T3HcHJyMURx5Bsas8EroYs+3E//CqPJ88i/RRQ3v+q6bUB4rzlPoDI0/ryWBhof1RBRcCuvzWUpSq1mcDLFQMdK+lr1CWvOSwy0PthVtM13hoHyw70X5W+e2QSxPt84/uw1INHzQxh+ZsUm8i82clIvTd1vshr9hgnIt4yt9X07h88ij/s2Or4xOfm60ZUeOYHMdNuROYJ/aPj9eqLem0QwLkBfeuYksvm0CUvj3er0ZboTtjsh3xfesOAt0MVndPoA8ks3CA8jDJRG1qNMGHxr55FKIGv7GpUmfP1BPSATuxktPA6SoLkB2+GN2MCQdqFh+5MkcJsEJYzRzsjigJwbTOlmM4hBhdHeuk5ynRb9evHPDs7TlkEVjTiOA69jGC/EKj9HcUgY/sYqA259Axerqz43/AjvKqNYCK7wGk/ETY7HpNExRTZLqqypHlQTH//DN8eyG6SmuFxDZSJGNOuqVx1/l/XiLb9Mr9NLxSgLC5pIOlPOBoYlPOSvlJQkUhQnrd+RthIJ0GKVmmHLw62t1UwGvU4dRvS23tgXlW1tcD2OrSm0iCQcLRCHeOkXnbIEFygkShU22tSz8eIB11tME93esGabcfbxYb6ix/6vdF4+MSrmEm4z6dsFwcbpKkTezFtsTEWJ0jWHNfl5a7ATuATi6dZWq27SsvAHuEhbQCONLwTcfIlb1Y2uN/xce4fQJuqpOIBtBsmUNllJaiREr0feXRlCXsVQqEOetwGJmyfV0gViyPhgon2iWYRLEQsmvsheuCqJQ2DnKgc2fcz87jZDjRlvx9UmdRvSl1dBWoe1VvekMXfJVin38nmWLDtkzjArSM4id5QQ5WkSabuuSJkrrmb5Osi/0LILf6U/lHhsQSrSR/4s4KBtRflhL01W2cU31zRwobQFB9Om/gwifcGSm3qXqxBT8TDs8IhXdRS65ygKnI72U47TQJkdcohxk8oEv4PsL1z09r+okdE9NtyiQ0PLgr2EBI11BDpeMTxL/u3rdq2B2pw9hxSmOWFKCwtW5LzQVNnHI0E6/JcJsuT+x28Klr9gAAA=";
const CLANSANCTUARY_IMG = "data:image/webp;base64,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";
const CLAN_ANNIHILATION_IMG = "data:image/webp;base64,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";

// ROOT CAUSE FIX: each event here used to carry its own hardcoded `coins`
// value, completely separate from the one in EVENTS (used for the real
// attendance payout math and the Settings table). Editing a value in
// Settings updated real payouts but left these schedule cards showing the
// old number forever — there was no connection between the two. Looking
// the value up from EVENTS by id means there's only ever one real number
// per event; this is just a display reference to it.
function coinsForEvent(id) { return EVENTS.find(e => e.id === id)?.coins ?? 0; }
const WEEKLY_SCHEDULE = [
  { day:"Sunday",    events:[{ name:"Canyon of Nidavellir 1f",         time:"1st Boss", img:WORLDBOSS_IMG, get coins(){return coinsForEvent("CN1F");}, id:"CN1F" },
                              { name:"Canyon of the World Tree Depth", time:"2nd Boss", img:WORLDBOSS_IMG, get coins(){return coinsForEvent("CWTD");}, id:"CWTD" },
                              { name:"Clan Sanctuary",                 time:"22:00",     img:CLANSANCTUARY_IMG, get coins(){return coinsForEvent("CS");}, id:"CS"  }]},
  { day:"Monday",    events:[{ name:"Canyon of Nidavellir 1f",         time:"1st Boss", img:WORLDBOSS_IMG, get coins(){return coinsForEvent("CN1F");}, id:"CN1F" },
                              { name:"Folkvang 5f",                    time:"2nd Boss", img:WORLDBOSS_IMG, get coins(){return coinsForEvent("F5F");},  id:"F5F"  }]},
  { day:"Tuesday",   events:[{ name:"Inter-Server Battle",     time:"20:00",               img:SERVERBATTLE_IMG,     get coins(){return coinsForEvent("ISB");}, id:"ISB" }]},
  { day:"Wednesday", events:[{ name:"Canyon of the World Tree Depth", time:"1st Boss", img:WORLDBOSS_IMG, get coins(){return coinsForEvent("CWTD");}, id:"CWTD" },
                              { name:"Crossroad of Ragnarok",          time:"2nd Boss", img:WORLDBOSS_IMG, get coins(){return coinsForEvent("COR");},  id:"COR"  }]},
  { day:"Thursday",  events:[{ name:"Clan Annihilation",       time:"13:00",               img:CLAN_ANNIHILATION_IMG,get coins(){return coinsForEvent("CA");},  id:"CA"  },
                              { name:"Clan Annihilation",       time:"20:00",               img:CLAN_ANNIHILATION_IMG,get coins(){return coinsForEvent("CA");},  id:"CA"  }]},
  { day:"Friday",    events:[{ name:"Folkvang 5f",             time:"1st Boss", img:WORLDBOSS_IMG, get coins(){return coinsForEvent("F5F");}, id:"F5F" },
                              { name:"Crossroad of Ragnarok",   time:"2nd Boss", img:WORLDBOSS_IMG, get coins(){return coinsForEvent("COR");}, id:"COR" }]},
  { day:"Saturday",  events:[{ name:"Sindris Treasure Island", time:"13:00",               img:SINDRIS_IMG,          get coins(){return coinsForEvent("STI");}, id:"STI" },
                              { name:"Sindris Treasure Island", time:"20:00",               img:SINDRIS_IMG,          get coins(){return coinsForEvent("STI");}, id:"STI" }]},
];
const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

const EVENT_DESCRIPTIONS = {
  ISB: "Inter-Server Battle — clash against rival servers for massive rewards. Top performers earn bonus coins.",
  CA:  "Clan Annihilation — an all-out war between clans. Coordinate with your team to secure victory.",
  CS:  "Clan Sanctuary — defend your clan's territory and earn coins for every successful defence.",
  STI: "Sindris Treasure Island — race to collect treasures across the island before time runs out.",
  CWTD: "Canyon of the World Tree Depth — unite the clan to bring down this world boss and share the spoils of battle.",
  CN1F: "Canyon of Nidavellir 1f — unite the clan to bring down this world boss and share the spoils of battle.",
  COR:  "Crossroad of Ragnarok — unite the clan to bring down this world boss and share the spoils of battle.",
  F5F:  "Folkvang 5f — unite the clan to bring down this world boss and share the spoils of battle.",
};
// Hoisted to module scope (was previously redeclared inside WorldBossSchedule)
// so the compact banner teaser can share the exact same event colors instead
// of maintaining a second copy that could drift out of sync.
const EVENT_COLOR = { ISB:"#e74c3c", CA:"#e67e22", CS:"#3498db", STI:"#9b59b6", CWTD:"#27ae60", CN1F:"#16a085", COR:"#2ecc71", F5F:"#1abc9c" };
const EVENT_GLOW  = { ISB:"rgba(231,76,60,0.45)", CA:"rgba(230,126,22,0.45)", CS:"rgba(52,152,219,0.45)", STI:"rgba(155,89,182,0.45)", CWTD:"rgba(39,174,96,0.45)", CN1F:"rgba(22,160,133,0.45)", COR:"rgba(46,204,113,0.45)", F5F:"rgba(26,188,156,0.45)" };

const SEED_MEMBERS = [
  { id:1, name:"ThomasShelby", username:"thomasshelby", password:"master123", role:"Master", cls:"Archer", power:123205, coins:0, attendance:0, joinDate:"2024-01-01", auctionWins:0, decayLog:[], txLog:[], attendLog:[], discord:"" },
];
let _imageLibrary = [];
let _imageLibraryFetched = false; // guards against re-fetching Storage's file list on every useImageLibrary mount
const MUSPEL_AXE_IMG = "data:image/png;base64,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";

const SEED_AUCTIONS = [];

function fmt(n) { return n?.toLocaleString() ?? "0"; }

// Sends a message to Discord via our own /api/discord-notify serverless
// function (see that file for why — keeps the real webhook URL out of
// the browser entirely). Failures here are deliberately swallowed rather
// than surfaced as an error toast: a Discord notification not going
// through should never block or appear to break the actual in-app action
// it's attached to (posting an announcement, starting an auction, etc.)
// — those already succeeded by the time this runs.
// `channel` picks which Discord channel this goes to (see WEBHOOK_MAP in
// discord-notify.js) — e.g. "general" for clan announcements, "auctions"
// for auction start/end notifications, so they don't all flood into one
// channel.
async function notifyDiscord(payload, channel = "general") {
  try {
    const res = await fetch("/api/discord-notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, ...payload }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
// Wraps notifyDiscord with a best-effort dedupe check for the auction-
// ended case specifically — every currently-online client independently
// notices the same auction ending within the same few milliseconds and
// will try to close it (see the AUCTION EXPIRY LOGIC effect), so without
// this guard they'd all fire a Discord notification for the same auction.
// This isn't a perfect lock — two browsers could still both pass the
// check before either one's claim write lands — but it meaningfully
// reduces how often duplicates actually happen, which is the realistic
// goal here rather than a strict guarantee.
async function notifyAuctionEndedOnce(auction) {
  const claimKey = `discord_auction_ended_${auction.id}`;
  try {
    // dbLoad always returns the whole table — there's no per-row filter
    // parameter — so the matching key is found client-side, the same
    // pattern already used elsewhere for app_state (e.g. decay_rate).
    const rows = await dbLoad("app_state");
    if (Array.isArray(rows) && rows.some(r => r.key === claimKey)) return; // someone already claimed it
  } catch {
    // If the check itself fails, proceed anyway — better to risk an
    // occasional duplicate than to silently never notify because of an
    // unrelated read error.
  }
  await dbUpsert("app_state", { key: claimKey, value: "1", updated_at: Date.now() });
  // Same fix as auctionImageUrl in the Auctions component: the real,
  // fetchable image URL (when the upload actually succeeded) is already
  // sitting in image.dataUrl — reconstructing one from image.name used
  // the original filename, which was never the actual Storage path.
  const imgUrl = (auction?.image?.dataUrl && auction.image.dataUrl.startsWith("http"))
    ? auction.image.dataUrl
    : null;
  notifyDiscord({ embeds: [{
    title: auction.topBidder ? `🏆 Auction ended: ${auction.name}` : `🔨 Auction ended: ${auction.name}`,
    description: auction.topBidder
      ? `Won by ${auction.topBidder} for ${fmt(auction.currentBid)} coins!`
      : "No bids were placed.",
    color: auction.topBidder ? 0xc8922a : 0x8a7a64,
    url: `${window.location.origin}/?page=auctions`,
    ...(imgUrl ? { thumbnail: { url: imgUrl } } : {}),
  }] }, "auctions");
}
// Formats a log entry's date for display — uses a precise millisecond
// timestamp when available (either an explicit `ts` field, or an `id` that
// was generated with Date.now()) so users see time-of-day, not just the day.
// Falls back to the plain date string for older entries recorded before
// timestamps existed.
function formatLogDateTime(entry) {
  const idNum = Number(entry?.id);
  const ms = entry?.ts || (Number.isFinite(idNum) && idNum > 1e11 ? idNum : null);
  if (ms) {
    const d = new Date(ms);
    if (!isNaN(d)) return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}`;
  }
  return entry?.date || "";
}
// Best-effort chronological sort key for a log entry: prefers a precise
// timestamp (ts, or a Date.now()-based id), falls back to parsing the
// date-only string for older entries.
function logSortKey(entry) {
  if (entry?.ts) return entry.ts;
  const idNum = Number(entry?.id);
  if (Number.isFinite(idNum) && idNum > 1e11) return idNum;
  const d = new Date(entry?.date);
  return isNaN(d) ? 0 : d.getTime();
}
function timeLeft(ms) {
  const diff = ms - Date.now();
  // FIX: Show the real countdown all the way down to 0s. The GRACE_MS buffer
  // (10s) is an internal safety margin only — it should NOT be visible to users
  // as premature "Closing…" text. Members were seeing "30s" then suddenly
  // "Closing…" because the old code showed "Closing…" as soon as diff<=0,
  // which happened 5–10s before the auction actually closed in the DB.
  // Now we show accurate seconds, then "Closing…" only after the real deadline,
  // and "Ended" once the auction is confirmed ended in DB state.
  if (diff <= -10000) return "Ended";
  if (diff <= 0) return "Closing…";
  const rem=Math.max(0,diff);
  const days=Math.floor(rem/86400000), h=Math.floor((rem%86400000)/3600000), m=Math.floor((rem%3600000)/60000), s=Math.floor((rem%60000)/1000);
  if (days>0) return `${days}d ${h}h`;
  return h>0?`${h}h ${m}m`:m>0?`${m}m ${s}s`:`${s}s`;
}
function rankIcon(i){return `#${i+1}`;}

// Maps a stored (always-English) transaction-type category name to its
// translation key, for display only — the underlying stored data never
// changes, so historical records stay consistent regardless of which
// language is currently selected.
const TYPE_LABEL_KEYS = {
  "Attendance": "type_Attendance",
  "Major Events Bonus": "type_MajorEventsBonus",
  "ISB Veteran Bonus": "type_ISBVeteranBonus",
  "Sindri Veteran Bonus": "type_SindriVeteranBonus",
  "Bonus Points": "type_BonusPoints",
  "Elder Request": "type_ElderRequest",
  "Admin Manual Add": "type_AdminManualAdd",
  "Bid Placed": "type_BidPlaced",
  "Outbid Refund": "type_OutbidRefund",
  "Auction Win": "type_AuctionWin",
  "Weekly Decay": "type_WeeklyDecay",
  "Balance Correction": "type_BalanceCorrection",
};
function typeLabel(type, t) {
  const key = TYPE_LABEL_KEYS[type];
  return key ? t(key) : type;
}

// Merges a member's attendLog/decayLog/txLog into one chronological points-
// history feed. Shared by the self-view "My Points History" tab (Attendance)
// and the admin-only points-history panel on PlayerInfo, so both always stay
// in sync instead of maintaining two copies of this merge logic.
function buildPointsHistoryEntries(member, t) {
  const attendEntries = (member.attendLog||[]).map(l=>({
    date:l.date, ts:l.ts, type:"Attendance",
    details:`${l.event}${l.qualifier&&l.qualifier!=="full"?` — ${l.qualifier}`:""}`,
    coins:l.coins,
  }));
  const decayEntries = (member.decayLog||[]).map(d=>({
    date:d.date, ts:d.ts, type:"Weekly Decay",
    details:t("weeklyDecayDetail"),
    coins:d.amount,
  }));
  const adjustmentEntries = (member.txLog||[]).filter(entry=>entry.logType!=="Weekly Decay").map(entry=>({
    date:entry.date, ts:entry.ts, type:entry.logType||"Admin Manual Add",
    details:entry.reason||"—",
    coins:entry.change,
  }));
  const sorted = [...attendEntries, ...decayEntries, ...adjustmentEntries]
    .sort((a,b)=>logSortKey(b)-logSortKey(a));
  // Running balance column: anchored to the member's actual current coin
  // total (always correct for the newest row), then walked backwards
  // subtracting each entry's own delta to reconstruct what the balance was
  // right after it landed. This is only as accurate as the log itself —
  // a manual DB correction that was never mirrored into attendLog/decayLog/
  // txLog would shift every "Balance" value before that point, even though
  // the current total (and the newest row) is always right.
  let running = member.coins;
  sorted.forEach(e => { e.balanceAfter = running; running -= e.coins; });
  return sorted;
}
function pointsHistoryBadgeClass(e) {
  return e.type==="Attendance"?"badge-blue":e.type==="Weekly Decay"?"badge-red":e.type==="Auction Win"?"badge-silver":e.coins>=0?"badge-gold":"badge-red";
}
// Shared page size for the full-width history tabs (My Points History,
// Global Points History) — same idea as MEMBERS_PAGE_SIZE, so a long log
// renders as pages instead of one ever-growing table.
const HISTORY_TAB_PAGE_SIZE = 10;

// Maps a stored rarity key (always lowercase English: epic/rare/kari/material/uncommon) to its
// translated display label. The stored value never changes — only the
// rendered text does.
const RARITY_LABEL_KEYS = { epic: "rarityEpic", rare: "rarityRare", kari: "rarityKari", material: "rarityMaterial", uncommon: "rarityUncommon" };
function rarityLabel(rarity, t) {
  const key = RARITY_LABEL_KEYS[rarity];
  return (key ? t(key) : (rarity||"")).toUpperCase();
}

// "Loot Distribution" is the stored default event label when no custom name
// was given to a roll — translate it for display without changing storage.
function eventLabelDisplay(label, t) {
  return label === "Loot Distribution" ? t("defaultEventLabel") : label;
}

// ─── GLOBAL CSS ───────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,600&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}

:root{
  --gold:#c8922a;--gold-light:#e6b048;--gold-dim:#7c540f;--gold-bright:#f2cc60;
  --blood:#6b1414;--blood-light:#951c1c;--crimson:#a83228;--crimson-light:#cc4a3a;
  --rare:#1c3a5c;--rare-light:#2a5c8a;
  --bg-void:#0a0706;--bg-deep:#100c0a;--bg-dark:#161110;--bg-mid:#1c1714;
  --bg-card:#221a16;--bg-raised:#2a2018;--bg-panel:#1e1612;
  --border:rgba(200,146,42,0.2);--border-bright:rgba(200,146,42,0.48);--border-dim:rgba(200,146,42,0.1);
  --text:#e0cdb0;--text-dim:#6e5840;--text-mid:#9c7e5c;--text-bright:#f4e8cc;
  --shadow:0 8px 40px rgba(0,0,0,0.85);
}

body{
  background-color:var(--bg-void);
  background-image:
    radial-gradient(ellipse 900px 600px at 18% 8%, rgba(200,146,42,0.10) 0%, transparent 55%),
    radial-gradient(ellipse 700px 500px at 85% 88%, rgba(200,146,42,0.06) 0%, transparent 55%),
    linear-gradient(180deg, rgba(5,4,3,0.82) 0%, rgba(6,4,3,0.9) 35%, rgba(5,4,3,0.96) 70%, rgba(5,4,3,1) 100%),
    url('/images/dashboard-bg.jpg');
  background-attachment:scroll,scroll,scroll,scroll;
  background-size:100% 100%,100% 100%,100% 100%,cover;
  background-position:0% 0%,0% 0%,0 0,center top;
  background-repeat:no-repeat,no-repeat,no-repeat,no-repeat;
  color:var(--text);font-family:'Inter',sans-serif;font-size:16px;min-height:100vh;
  /* Companion to .sidebar::before's 100vw full-bleed cloud overlay — 100vw
     can be a hair wider than the visible viewport on some browsers (it
     doesn't subtract the scrollbar's own width), which would otherwise
     introduce a few px of unwanted horizontal scroll on every page. */
  overflow-x:hidden;
}
::-webkit-scrollbar{width:5px;height:5px;}
::-webkit-scrollbar-track{background:var(--bg-dark);}
::-webkit-scrollbar-thumb{background:var(--gold-dim);border-radius:2px;}

/* Auction House background — overrides body's own background-image
   when the bg-auctions class is toggled on (see AppInner's useEffect).
   The ::before box uses aspect-ratio matching the photo's real
   dimensions (1584x1905), so at ANY screen width the browser works
   out the exact height needed to show the FULL image at its true
   proportions — nothing cropped, nothing squeezed. The gradient
   overlay is sized to that same box, so it only starts blending to
   the page's plain dark color once the real photo content has
   finished, not before. Scrolls normally with the page (not fixed). */
body.bg-auctions{
  background-color:var(--bg-void);
  background-image:none;
  position:relative;
}
body.bg-auctions::before{
  content:"";
  position:absolute;
  top:0;left:0;right:0;
  width:100%;
  aspect-ratio:1584/1905;
  z-index:0;
  pointer-events:none;
  background-image:
    linear-gradient(180deg, rgba(5,4,3,0.6) 0%, rgba(5,4,3,0.45) 8%, rgba(5,4,3,0.18) 16%, rgba(5,4,3,0.3) 55%, rgba(5,4,3,0.75) 80%, rgba(5,4,3,1) 100%),
    url('/images/auction-bg.jpg');
  background-size:100% 100%,100% 100%;
  background-position:0% 0%,center top;
  background-repeat:no-repeat,no-repeat;
}
#root{position:relative;z-index:1;}

/* Leaderboard background — same exact pattern as the Auction House
   background (body.bg-auctions above): toggled via a body class, sized
   with aspect-ratio matched to the source video's real dimensions
   (2560x1440), positioned behind everything via z-index, scrolls
   completely normally with the page since it's just an absolutely
   positioned element sitting in the body's own flow, not position:fixed.
   The only difference from the auction pattern is using a real <video>
   element instead of a CSS background-image, since video can't be set
   as a background-image — everything else (sizing, layering, the
   fade-to-black gradient) follows that same proven approach exactly. */
body.bg-leaderboard{
  background-color:#040301;
  background-image:none;
  position:relative;
}
.leaderboard-bg-video{
  position:absolute;
  top:0;left:0;right:0;
  width:100%;
  aspect-ratio:2560/1440;
  z-index:0;
  pointer-events:none;
  object-fit:cover;object-position:right center;
}
.leaderboard-bg-scrim{
  content:"";
  position:absolute;
  top:0;left:0;right:0;
  width:100%;
  aspect-ratio:2560/1440;
  z-index:0;
  pointer-events:none;
  background-image:linear-gradient(180deg, rgba(4,3,1,0.5) 0%, rgba(4,3,1,0.2) 12%, rgba(4,3,1,0.25) 50%, rgba(4,3,1,0.85) 82%, rgba(4,3,1,1) 100%);
}
@media(max-width:760px){
  /* Match the Login screen's approach exactly (.login-video-bg above),
     since that one is already confirmed to look right on real devices.
     The earlier attempts here used a guessed fixed pixel height, which
     is a different effective zoom level than the login screen's — and
     since object-position's percentage is scale-dependent, reusing "78%"
     without reusing the same height made the centering wrong again.
     Using 100vh + the same 78% position reproduces the login screen's
     proven framing here too. */
  .leaderboard-bg-video{
    height:100vh;aspect-ratio:unset;
    object-position:78% center;
  }
  .leaderboard-bg-scrim{
    height:100vh;aspect-ratio:unset;
    background-image:linear-gradient(180deg, rgba(4,3,1,0.4) 0%, rgba(4,3,1,0.15) 10%, rgba(4,3,1,0.2) 60%, rgba(4,3,1,0.88) 80%, rgba(4,3,1,1) 92%);
  }
}

/* Leaderboard headline — wraps and shrinks properly on narrow screens
   instead of forcing one line that overflows the viewport. The
   flourish lines shrink out of the way on mobile (rather than fighting
   the text for the same limited width), and the text itself is allowed
   to wrap to two lines and use a smaller, viewport-aware font size. */
.leaderboard-headline-row{
  display:flex;align-items:center;justify-content:center;gap:18px;
  margin-bottom:30px;padding:0 20px;
}
.leaderboard-headline-flourish{
  flex:1;max-width:140px;height:1px;
}
.leaderboard-headline-flourish--left{background:linear-gradient(90deg, transparent, var(--gold-dim));}
.leaderboard-headline-flourish--right{background:linear-gradient(90deg, var(--gold-dim), transparent);}
.leaderboard-headline-text{
  flex-shrink:1;min-width:0;text-align:center;
  font-family:'Spectral',serif;font-weight:800;
  font-size:clamp(18px,3.6vw,32px);
  color:var(--gold-light);letter-spacing:1.5px;line-height:1.25;
  text-shadow:0 0 28px rgba(201,151,42,0.5), 0 2px 8px rgba(0,0,0,0.8);
  word-wrap:break-word;
}
@media(max-width:600px){
  .leaderboard-headline-row{gap:10px;padding:0 12px;}
  .leaderboard-headline-flourish{max-width:36px;}
  .leaderboard-headline-text{font-size:18px;letter-spacing:0.5px;}
}

/* ── ORNAMENTAL ELEMENTS ── */
.orn-border{
  position:relative;
  border:1px solid var(--border);
}
.orn-border::before{
  content:'';position:absolute;inset:3px;
  border:1px solid var(--border-dim);pointer-events:none;border-radius:inherit;
}
.corner-ornament{
  position:relative;
  background:var(--bg-card);
  border:1px solid var(--border-bright);
}
.corner-ornament::before,.corner-ornament::after{
  content:'';position:absolute;width:10px;height:10px;
  border-color:var(--gold);border-style:solid;
}
.corner-ornament::before{top:-1px;left:-1px;border-width:2px 0 0 2px;}
.corner-ornament::after{bottom:-1px;right:-1px;border-width:0 2px 2px 0;}

.divider-ornament{
  display:flex;align-items:center;gap:12px;margin:16px 0;
}
.divider-ornament::before,.divider-ornament::after{
  content:'';flex:1;height:1px;
  background:linear-gradient(90deg,transparent,var(--gold-dim),transparent);
}

/* ── APP SHELL ── */
.app-shell{display:flex;flex-direction:column;min-height:100vh;}

/* ── TOP NAV — spacious horizontal bar (Legend of Ymir reference) ── */
.nav-wrapper{}
.sidebar{
  pointer-events:all;
  /* fixed rather than sticky — sticky reserves its own space in the
     .app-shell flex column, which is fine in theory, but fixed guarantees
     it stays pinned to the viewport regardless of any ancestor's overflow/
     scroll-container quirks. .main below carries the compensating
     margin-top so content doesn't render underneath it. */
  position:fixed;top:0;left:0;right:0;z-index:100;
  width:100%;height:68px;
  background:none;border:none;box-shadow:none;
  display:grid;grid-template-columns:auto 1fr auto;align-items:center;
  padding:0 clamp(20px,4vw,64px);
  flex-shrink:0;
}
/* Soft misty cloud gradient behind the nav row instead of a solid bar —
   taller than the bar itself and masked to fade out downward, so it reads
   as mist drifting behind the nav rather than a hard-edged background
   image. Negative z-index keeps it behind the nav content without needing
   every nav child to carry its own z-index. */
.sidebar::before{
  content:'';
  /* Full-bleed trick: anchored to the exact viewport width via left:50% +
     width:100vw + translateX(-50%), rather than left:0;right:0 relative to
     .sidebar's own box — that version wasn't reliably reaching the true
     screen edge. This version is anchored to the viewport directly, so
     it's independent of .sidebar's own width/padding/box model entirely. */
  position:absolute;top:0;left:50%;width:100vw;transform:translateX(-50%);height:240px;
  background-image:url(/images/cloud.webp);
  background-size:100% auto;background-position:top center;background-repeat:no-repeat;
  -webkit-mask-image:linear-gradient(to bottom, black 0%, black 20%, transparent 92%);
  mask-image:linear-gradient(to bottom, black 0%, black 20%, transparent 92%);
  pointer-events:none;
  z-index:-1;
}
.sidebar-logo{
  grid-column:1;
  padding:0;border:none;margin:0;
  display:flex;align-items:center;justify-content:center;
  width:auto;height:auto;flex-shrink:0;
}
.sidebar-logo-mark{
  width:40px;height:40px;object-fit:contain;display:block;
  filter:drop-shadow(0 0 5px rgba(201,151,42,0.4));
}
.logo-emblem{font-size:20px;filter:drop-shadow(0 0 8px rgba(200,146,42,0.8));}
.logo-title{font-family:'Spectral',serif;font-size:14px;font-weight:800;color:var(--gold-light);letter-spacing:1.5px;text-align:left;line-height:1;}
.logo-sub{font-size:7px;color:var(--text-dim);letter-spacing:2px;text-transform:uppercase;font-weight:600;margin-top:2px;text-align:left;line-height:1;}

/* Main "My Clan" row — generous gaps are the whole point of this redesign.
   grid-column:2 + justify-content:center means it's truly centered in the
   bar as a whole, not just centered within the leftover space next to the
   logo (which would drift off-center whenever the logo/icon groups differ
   in width). */
/* clamp()-based sizing (not fixed px) so the row scales proportionally
   between the mobile breakpoint and very wide desktop monitors, instead of
   staying rigidly one size and either cramping on narrower windows or
   looking undersized/lost on ultra-wide ones. */
.topnav-items{grid-column:2;display:flex;align-items:center;justify-content:center;gap:clamp(20px,3vw,40px);}
.topnav-item{
  position:relative;
  font-family:'Spectral',serif;font-weight:600;
  font-size:clamp(11px,0.85vw,14px);
  letter-spacing:clamp(1px,0.15vw,2px);text-transform:uppercase;
  color:var(--text-mid);cursor:pointer;
  padding:4px 0;white-space:nowrap;
  transition:color 0.2s;
  display:flex;align-items:center;gap:6px;
}
.topnav-item:hover{color:var(--gold-light);}
.topnav-item.active{color:var(--gold-bright);}
.topnav-item.active::after{
  content:'';position:absolute;left:0;right:0;bottom:-10px;height:2px;
  background:var(--gold);
}
.topnav-item-chevron{font-size:8px;opacity:0.6;transition:transform 0.18s;}
.topnav-item.dd-open .topnav-item-chevron{transform:rotate(180deg);}

/* Admin Tools dropdown — reuses the same dark/gold-bordered panel look as
   the profile dropdown (.user-dropdown-inner) rather than inventing a
   fourth visual style for popovers in this app. */
.topnav-admin{position:relative;}
.topnav-admin-dropdown{
  position:absolute;top:100%;left:0;
  padding-top:14px;
  opacity:0;pointer-events:none;
  transform:translateY(-6px);
  transition:opacity 0.18s, transform 0.18s;
  z-index:9999;
}
.topnav-admin.dd-open .topnav-admin-dropdown{opacity:1;pointer-events:all;transform:translateY(0);}

.nav-section-divider{width:calc(100% - 32px);height:1px;background:linear-gradient(90deg,transparent,rgba(200,146,42,0.2),transparent);margin:10px 16px;flex-shrink:0;}
.nav-item-badge{display:inline-flex;align-items:center;justify-content:center;min-width:15px;height:15px;padding:0 4px;margin-left:4px;border-radius:50%;background:#e85d3a;color:#fff;font-size:9px;font-weight:900;flex-shrink:0;}
.nav-dd-sep{height:1px;background:linear-gradient(90deg,transparent,var(--border),transparent);margin:4px 10px;}
.nav-dd-label{
  font-size:8px;font-weight:700;letter-spacing:2.5px;color:var(--text-dim);
  padding:6px 16px 2px;text-transform:uppercase;font-family:'Inter',sans-serif;
}
/* ── ICON GROUP (right side) — profile chip + language switcher ── */
.topnav-icons{grid-column:3;display:flex;align-items:center;gap:18px;flex-shrink:0;}
.user-menu{position:relative;flex-shrink:0;}
.user-menu:hover .user-dropdown,.user-menu.dd-open .user-dropdown{opacity:1;pointer-events:all;transform:translateY(0);}
.profile-chip{
  box-sizing:border-box;
  position:relative;overflow:hidden;
  display:flex;align-items:center;gap:9px;
  background:rgba(200,146,42,0.05);
  border:1px solid var(--border);
  border-radius:8px;
  padding:5px 10px 5px 6px;
  cursor:pointer;transition:all 0.2s;
  font:inherit;line-height:normal;
  -webkit-appearance:none;appearance:none;
  user-select:none;-webkit-user-select:none;
  outline:none;
}
.profile-chip:hover{background:rgba(200,146,42,0.1);border-color:var(--gold-dim);}
.profile-chip-info{display:flex;flex-direction:column;align-items:flex-start;min-width:0;line-height:1.3;}
.profile-chip-sub{
  display:flex;align-items:center;gap:3px;
  font-size:10px;color:var(--gold);font-weight:700;
}
.profile-chip-caret{
  font-size:8px;color:var(--text-dim);margin-left:2px;
  transition:transform 0.2s,color 0.2s;
}
.profile-chip:hover .profile-chip-caret,.user-menu.dd-open .profile-chip-caret{color:var(--gold-light);}
.user-menu.dd-open .profile-chip-caret{transform:rotate(180deg);}
.user-dropdown{
  position:absolute;top:100%;bottom:auto;right:0;left:auto;
  background:transparent;
  padding-top:10px;padding-bottom:0;
  opacity:0;pointer-events:none;
  transform:translateY(-6px);
  transition:opacity 0.18s, transform 0.18s;
  z-index:9999;
}
.user-dropdown-inner{
  background:linear-gradient(160deg,rgba(16,12,10,0.99),rgba(12,9,7,0.99));
  border:1px solid var(--border-bright);border-radius:8px;
  min-width:180px;padding:6px 0;
  box-shadow:0 8px 32px rgba(0,0,0,0.9),0 0 0 1px rgba(201,151,42,0.06);
}
.user-dd-item{
  display:flex;align-items:center;gap:8px;
  padding:8px 14px;cursor:pointer;
  color:var(--text-mid);font-size:11px;font-weight:600;
  font-family:'Inter',sans-serif;transition:all 0.15s;white-space:nowrap;
}
.user-dd-item:hover{color:var(--gold-light);background:rgba(200,146,42,0.08);}
.user-dd-item.danger{color:#e07070;}
.user-dd-item.danger:hover{color:#ff9090;background:rgba(122,26,26,0.12);}

.user-avatar{
  width:28px;height:28px;border-radius:50%;
  background:linear-gradient(135deg,var(--gold-dim),var(--gold));
  display:flex;align-items:center;justify-content:center;font-size:13px;
  border:1px solid var(--border-bright);
  flex-shrink:0;overflow:hidden;
}
.user-name{font-family:'Inter',sans-serif;font-size:11px;font-weight:700;color:var(--gold-light);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100px;}
.user-role{font-size:8px;color:var(--text-dim);text-transform:uppercase;letter-spacing:2px;font-weight:600;}
.user-coins{font-size:11px;color:var(--gold);font-family:'Inter',sans-serif;font-weight:700;}

/* ── HAMBURGER ── */
.hamburger{grid-column:3;display:none;flex-direction:column;justify-content:center;gap:5px;cursor:pointer;
  padding:6px;margin-left:auto;flex-shrink:0;background:none;border:none;}
.hamburger span{display:block;width:20px;height:2px;background:var(--gold-light);border-radius:2px;
  transition:all 0.3s;}

/* ── MOBILE DRAWER ── */
.mobile-drawer{display:none;position:fixed;inset:0;z-index:200;}
.mobile-drawer.open{display:block;}
.drawer-overlay{position:absolute;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(4px);animation:overlayFadeIn 0.2s ease both;}
.drawer-panel{
  position:absolute;top:0;left:0;bottom:0;width:270px;
  background:linear-gradient(180deg,rgba(16,12,10,0.99),rgba(12,9,7,0.99));
  border-right:1px solid var(--border-bright);
  display:flex;flex-direction:column;overflow-y:auto;
  box-shadow:8px 0 40px rgba(0,0,0,0.8);
  animation:drawerSlideIn 0.25s cubic-bezier(0.16,1,0.3,1) both;
}
@keyframes drawerSlideIn{from{transform:translateX(-100%);}to{transform:translateX(0);}}
.drawer-header{display:flex;align-items:center;justify-content:space-between;
  padding:16px 20px;border-bottom:1px solid var(--border);flex-shrink:0;}
.drawer-close{background:none;border:none;color:var(--text-dim);font-size:18px;cursor:pointer;
  padding:4px 8px;transition:color 0.2s;}
.drawer-close:hover{color:var(--gold-light);}
.drawer-nav{padding:12px 0;flex:1;}
.drawer-section-label{font-size:8px;font-weight:700;letter-spacing:3px;text-transform:uppercase;
  color:var(--text-dim);padding:10px 20px 6px;font-family:'Inter',sans-serif;}
.drawer-section-label.collapsible{cursor:pointer;color:#e07070;display:flex;align-items:center;}
.drawer-nav-item{display:flex;align-items:center;gap:10px;padding:11px 20px;cursor:pointer;
  color:var(--text-mid);font-size:13px;font-weight:600;letter-spacing:0.5px;
  transition:all 0.2s;border-left:2px solid transparent;font-family:'Inter',sans-serif;}
.drawer-nav-item:hover{color:var(--gold-light);background:rgba(200,146,42,0.07);border-left-color:var(--gold-dim);}
.drawer-nav-item.active{color:var(--gold-bright);background:rgba(200,146,42,0.12);border-left-color:var(--gold);}
.drawer-user{padding:14px 20px;border-top:1px solid var(--border);flex-shrink:0;
  display:flex;flex-direction:column;gap:10px;}
.drawer-user-row{display:flex;align-items:center;gap:10px;}
.drawer-user-actions{display:flex;gap:8px;flex-wrap:wrap;}

/* ── MAIN ── */
.main{flex:1;display:flex;flex-direction:column;margin-top:68px;margin-left:0;}
.topbar{
  padding:20px 80px 28px;display:flex;align-items:center;justify-content:space-between;
  flex-wrap:wrap;gap:12px;
}
.page-title{font-family:'Spectral',serif;font-size:24px;font-weight:800;color:var(--text-bright);letter-spacing:2px;text-align:left;}
.page-sub{font-size:10px;color:var(--text-dim);letter-spacing:2px;text-transform:uppercase;margin-top:2px;font-weight:600;text-align:left;}
.topbar-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end;}
.content{padding:28px 80px;flex:1;max-width:1600px;width:100%;margin:0 auto;box-sizing:border-box;}

/* ── TABLE — stacking cards on mobile ── */
.table-wrap{overflow-x:auto;}
table{width:100%;border-collapse:collapse;}
thead{background:rgba(10,11,15,0.6);}
th{padding:10px 14px;text-align:left;font-family:'Inter',sans-serif;font-size:9px;font-weight:700;
   color:var(--gold-dim);letter-spacing:2.5px;text-transform:uppercase;border-bottom:1px solid var(--border);}
td{padding:12px 14px;border-bottom:1px solid var(--border-dim);font-size:13px;font-family:'Inter',sans-serif;}
tr:hover td{background:rgba(201,151,42,0.03);}
tbody tr:last-child td{border-bottom:none;}

/* Normal table — stacks on mobile only */
.table-stack thead{display:table-header-group;}
.table-stack tbody tr{display:table-row;background:transparent;border:none;border-radius:0;margin-bottom:0;padding:0;}
.table-stack tbody tr:hover{border-color:transparent;}
.table-stack tbody tr:last-child td{border-bottom:none;}
.table-stack td{display:table-cell;align-items:unset;justify-content:unset;padding:12px 14px;border-bottom:1px solid var(--border-dim);font-size:13px;gap:0;text-align:left;}
.table-stack td::before{display:none;}

/* ── RESPONSIVE ── */
@media(max-width:1100px){
  .topbar{padding:13px 40px;}
  .content{padding:28px 40px;}
}
@media(max-width:900px){
  .topbar{padding:12px 20px;}
  .content{padding:20px 20px;}

}
@media(max-width:700px){
  .sidebar{height:48px;padding:0 14px;}
  .sidebar::before{height:140px;}
  .topnav-items,.topnav-icons{display:none;}
  .hamburger{display:flex;}
  .main{margin-top:48px;margin-left:0;}
  .topbar{padding:10px 16px;}
  .topbar .page-title{font-size:18px;text-align:left;}
  .topbar .page-sub{text-align:left;}
  .content{padding:14px 16px;}
  .grid-4{grid-template-columns:1fr 1fr;}
  .stat-card{padding:18px 10px;}
  .stat-value{font-size:22px;}
  .patch-title{flex-basis:100%!important;order:3;margin-top:2px;}
  .table-stack td[data-label="Attendees"] .btn-sm{padding:5px 9px;font-size:8px;}
  .members-table-wrap{position:relative;}
  .members-table-wrap::after{content:"";position:absolute;top:0;right:0;bottom:0;width:18px;background:linear-gradient(90deg,transparent,var(--bg-card));pointer-events:none;}
  .event-card-thumb{width:78px!important;height:72px!important;}
  .event-card-text{padding:10px 12px!important;}
  .members-table th:nth-child(6),.members-table td:nth-child(6),
  .members-table th:nth-child(7),.members-table td:nth-child(7){display:none!important;}
  .event-card-row{flex-direction:column!important;}
  .event-card-row .event-card-thumb{width:100%!important;height:150px!important;}
  .attendance-table-view{display:none!important;}
  .attendance-card-view{display:block!important;}
  .update-notes-badge{flex-basis:100%;margin-left:46px;}
  .event-card-coins{padding:3px 10px!important;bottom:6px!important;}
  .event-card-coins-num{font-size:14px!important;}
  /* Stacking tables on mobile */
  .table-wrap{overflow-x:visible;}
  .table-stack thead{display:none;}
  .table-stack tbody tr{display:block;background:var(--bg-card);border:1px solid var(--border);border-radius:4px;margin-bottom:10px;padding:4px 0;}
  .table-stack td{display:flex;align-items:center;justify-content:flex-start;padding:9px 14px;border-bottom:1px solid var(--border-dim);font-size:12px;gap:10px;}
  .table-stack td:last-child{border-bottom:none;}
  .table-stack td::before{content:attr(data-label);font-size:8px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold-dim);font-family:'Inter',sans-serif;flex-shrink:0;min-width:72px;display:block;}
  .modal{max-width:calc(100vw - 24px);}
  .modal-body{padding:18px;}
  .modal-header{padding:16px 18px;}
  .modal-footer{padding:12px 18px;}
  .toast-container{bottom:16px;right:12px;left:12px;}
  .toast{min-width:0;width:100%;}
  .lb-row{gap:7px;padding:9px 0;}
  .lb-val{min-width:60px;font-size:12px;}
  .lb-name{font-size:11px;}
  .lb-rank{min-width:22px;width:22px;font-size:11px;}
  /* Members table used to be force-kept as a real, horizontally-scrolling
     table on mobile instead of the stacked-card format every other table
     uses — that got worse as more columns were added over time. Now it
     just hides like the rest, replaced by .members-card-view below
     (same table-view/card-view toggle pattern as Attendance). */
  .members-table-view{display:none!important;}
  .members-card-view{display:block!important;}
}
.members-table-wrap{overflow-x:auto;}
.attendance-card-view{display:none;}
.members-card-view{display:none;}
@media(max-width:400px){
  .grid-4{grid-template-columns:1fr;}
  .lb-val{min-width:52px;font-size:11px;}
}

/* ── CARDS ── */
.card{
  background:var(--bg-card);border:1px solid var(--border);
  border-radius:4px;padding:20px;
  transition:border-color 0.2s,box-shadow 0.2s;
  position:relative;
}
.card:hover{border-color:rgba(201,151,42,0.35);}
.card-gold{
  border-color:rgba(201,151,42,0.3);
  background:linear-gradient(135deg,var(--bg-card) 0%,rgba(201,151,42,0.04) 100%);
}
.card-red{
  border-color:rgba(122,26,26,0.5);
  background:linear-gradient(135deg,var(--bg-card) 0%,rgba(122,26,26,0.07) 100%);
}
.card-blue{
  border-color:rgba(26,90,138,0.5);
  background:linear-gradient(135deg,var(--bg-card) 0%,rgba(26,90,138,0.07) 100%);
}

/* ── PREMIUM PANELS — the Clan HQ dashboard's ornament language (gradient
   panel + hover lift/glow), now also reused on Attendance for visual
   consistency across pages. Deliberately NOT part of .card (used 37+ times
   app-wide) so this treatment stays opt-in rather than leaking everywhere. */
.dash-panel{
  transition:transform 0.2s ease-out, box-shadow 0.2s ease-out, border-color 0.2s ease-out;
}
.dash-panel:hover{
  transform:translateY(-2px);
  box-shadow:0 10px 32px rgba(0,0,0,0.6), 0 0 20px rgba(200,146,42,0.12);
  border-color:rgba(200,146,42,0.5)!important;
}
/* Lighter-weight sibling for repeated list-item cards (log rows, per-member
   bonus cards) — same panel material as .dash-panel, but no corner-bracket
   ornamentation, since dozens of bracket sets on a long list reads as
   cluttered rather than premium. Brackets stay reserved for the handful of
   distinct structural panels per page. */
.dash-subcard{
  background:linear-gradient(135deg,#161110 0%,#1c1410 60%,#161110 100%);
  border:1px solid rgba(200,146,42,0.15);border-radius:5px;
  transition:border-color 0.2s ease-out, background 0.2s ease-out;
}
.dash-subcard:hover{border-color:rgba(200,146,42,0.35);}

/* Connected-spine bulleting for the Welcome Back popup's activity digest
   — a single vertical line with a small glowing dot per row, colored
   per category via each row's own --dot custom property, instead of
   giving every category its own separately bordered box. Pseudo-
   elements can't be expressed as inline styles, hence real CSS classes
   here rather than the usual style={{}} objects used everywhere else. */
.login-summary-spine{position:relative;padding-left:20px;}
.login-summary-spine::before{content:'';position:absolute;left:5px;top:6px;bottom:6px;width:1px;background:linear-gradient(180deg,rgba(200,146,42,0.5),rgba(200,146,42,0.1));}
.login-summary-row{position:relative;padding:9px 0;border-bottom:1px solid rgba(200,146,42,0.08);}
.login-summary-row:last-child{border-bottom:none;}
.login-summary-row::before{content:'';position:absolute;left:-19px;top:16px;width:7px;height:7px;border-radius:50%;background:var(--dot,var(--gold));box-shadow:0 0 6px var(--dot,var(--gold));}

.stat-card{text-align:center;padding:28px 16px;overflow:hidden;}
.dashboard-banner-left{text-align:left!important;}
.stat-card::before{
  content:'';position:absolute;top:0;left:0;right:0;height:2px;
  background:linear-gradient(90deg,transparent,var(--gold-dim),transparent);
}
.stat-icon{font-size:30px;margin-bottom:10px;filter:drop-shadow(0 0 6px rgba(201,151,42,0.4));}
.stat-value{font-family:'Spectral',serif;font-size:30px;font-weight:800;color:var(--gold-light)}
.stat-label{font-size:9px;color:var(--text-dim);letter-spacing:3px;text-transform:uppercase;margin-top:6px;font-weight:700;}

/* ── GRID ── */
.grid-2{display:flex;flex-wrap:wrap;gap:20px;}.grid-2>*{flex:1 1 280px;min-width:0;}
.grid-3{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:20px;}
.grid-4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:16px;}

/* ── BUTTONS ── */
.btn{
  padding:9px 22px;border-radius:2px;border:none;cursor:pointer;
  font-family:'Inter',sans-serif;font-size:11px;font-weight:700;letter-spacing:1px;
  text-transform:uppercase;
  transition:all 0.2s;display:inline-flex;align-items:center;gap:7px;
  position:relative;overflow:hidden;
}
.btn::before{content:'';position:absolute;inset:0;opacity:0;transition:opacity 0.2s;}
.btn:hover::before{opacity:1;}
.btn-gold{
  background:linear-gradient(135deg,#5a3800,var(--gold));
  color:#000;font-weight:800;
  box-shadow:0 2px 12px rgba(201,151,42,0.25);
}
.btn-gold::before{background:linear-gradient(135deg,rgba(255,255,255,0.1),transparent);}
.btn-gold:hover{box-shadow:0 4px 20px rgba(201,151,42,0.45);}
.btn-outline{background:transparent;border:1px solid var(--border-bright);color:var(--gold-light);}
.btn-outline:hover{background:rgba(201,151,42,0.1);border-color:var(--gold);}
.btn-red{background:linear-gradient(135deg,#3d0000,var(--blood-light));color:#fff;font-weight:700;box-shadow:0 2px 12px rgba(122,26,26,0.3);}
.btn-red:hover{box-shadow:0 4px 20px rgba(192,57,43,0.5);}
.btn-blue{background:linear-gradient(135deg,#071824,var(--rare));color:#fff;}
.btn-blue:hover{box-shadow:0 4px 16px rgba(26,90,138,0.4);}
.btn-discord{background:linear-gradient(135deg,#2d3380,#7289da);color:#fff;font-weight:700;}
.btn-discord:hover{box-shadow:0 4px 16px rgba(114,137,218,0.4);}
.btn-sm{padding:5px 14px;font-size:9px;letter-spacing:1.5px;}
.btn-ghost{background:transparent;border:none;color:var(--text-dim);font-size:11px;font-family:'Inter',sans-serif;font-weight:600;cursor:pointer;letter-spacing:1px;padding:4px 8px;}
.btn-ghost:hover{color:var(--gold-light);}

/* ── INPUTS ── */
.input,.select{
  background:rgba(10,11,15,0.8);border:1px solid var(--border);
  color:var(--text);padding:9px 14px;border-radius:2px;font-size:13px;
  font-family:'Inter',sans-serif;font-weight:500;outline:none;width:100%;
  transition:border-color 0.2s,box-shadow 0.2s;
}
.input:focus,.select:focus{border-color:var(--gold);box-shadow:0 0 0 1px rgba(201,151,42,0.2);}
.input::placeholder{color:var(--text-dim);}
.select option{background:var(--bg-dark);}

/* ── MEMBERS ── */
.members-layout{display:flex;gap:20px;}
.player-info-layout{display:flex;gap:24px;flex-wrap:wrap;}
.player-info-sidebar{width:220px;flex-shrink:0;}
.player-info-main{flex:1;min-width:280px;}
@media(max-width:700px){
  .player-info-layout{flex-direction:column;}
  .player-info-sidebar{width:100%;max-width:280px;margin:0 auto;}
  /* The rank-1/2 video page's title/tagline text is positioned with
     left:calc(sidebar-width + gaps) specifically so it starts right where
     the sidebar ends — that math assumes a wide horizontal layout. Below
     700px the layout stacks vertically instead (rule above), so that
     fixed-offset positioning no longer makes sense and the text was
     running off the visible area. Hidden below this breakpoint; a
     separate mobile-only caption renders instead (see .rank1-mobile-*
     rules and the JSX that uses them). */
  .rank1-video-caption{display:none;}
  /* The desktop hero-wrapper's fixed minHeight:760 (set inline, since it
     depends on the rank1VideoAssets condition) would force a huge,
     mostly-empty vertical space once the layout stacks to one column —
     the video behind it, sized off that height, would also try to
     render far wider than the narrow viewport, clipped uselessly by
     overflow:hidden. Overriding it back to auto here, and hiding the
     desktop backdrop entirely (replaced by .rank1-mobile-video below,
     a separate element designed for a vertical layout instead of
     trying to force the desktop one to adapt). */
  .rank1-hero-wrapper{min-height:auto !important;}
  .rank1-desktop-backdrop{display:none;}
}
@media(min-width:701px){
  .rank1-mobile-video{display:none;}
  .rank1-mobile-caption{display:none;}
}
@media(max-width:700px){.members-layout{flex-direction:column;}}

/* ── LEADERBOARD PODIUM (top 3 Most Powerful) ── */
.podium-banner{
  position:relative;
  padding:48px 24px 36px;margin-bottom:30px;
  min-height:560px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;
}
.podium-row{position:relative;z-index:2;display:flex;align-items:flex-end;justify-content:center;gap:18px;flex-wrap:wrap;width:100%;}
.podium-slot{display:flex;flex-direction:column;align-items:center;}
.podium-card-frame{border-radius:10px;overflow:hidden;position:relative;transition:transform 0.2s;}
.podium-card-frame:hover{transform:translateY(-4px);}
/* Metallic gradient ring around each podium card — border-image (the
   normal way to do gradient borders) doesn't support border-radius, so
   instead we use a wrapping element: its own background is the metallic
   gradient, and padding reveals a ring of it around the rounded card
   sitting inside. Band sequences are sampled directly from the actual
   rarity background images' real brightness distribution (roughly 70%
   dark, 20% mid-tone, 10% bright highlight across the full image) rather
   than centering on the bright core — dark is the dominant tone with a
   brief bright glint in the middle, like a real metal surface where most
   of what you see is shadow and only a thin edge catches the light. */
.podium-metal-ring{border-radius:13px;display:inline-block;position:relative;}
.podium-rank-1 .podium-metal-ring{
  padding:3px;
  background:linear-gradient(135deg,#211022,#211022,#6d2d7b,#d65cf0,#6d2d7b,#211022,#211022);
  box-shadow:0 0 20px rgba(199,125,255,0.35);
}
.podium-rank-2 .podium-metal-ring{
  padding:2px;
  background:linear-gradient(135deg,#2b2215,#2b2215,#725f38,#f3e79d,#725f38,#2b2215,#2b2215);
  box-shadow:0 0 12px rgba(242,204,96,0.3);
}
.podium-rank-3 .podium-metal-ring{
  padding:2px;
  background:linear-gradient(135deg,#311714,#311714,#99463f,#fca699,#99463f,#311714,#311714);
  box-shadow:0 0 10px rgba(254,126,115,0.3);
}
.podium-rank-1 .podium-card-frame{width:252px;}
.podium-rank-2 .podium-card-frame{width:192px;}
.podium-rank-3 .podium-card-frame{width:180px;}
@media(max-width:600px){
  .podium-rank-1 .podium-card-frame{width:130px;}
  .podium-rank-2 .podium-card-frame{width:98px;}
  .podium-rank-3 .podium-card-frame{width:92px;}
}
.podium-name{font-family:'Spectral',serif;font-weight:700;color:var(--text-bright);margin-top:6px;text-align:center;}
.podium-rank-1 .podium-name{font-size:17px;}
.podium-rank-2 .podium-name,.podium-rank-3 .podium-name{font-size:13px;}
.podium-power{font-size:12px;color:var(--gold-bright);margin-top:2px;}

/* Honorable mentions (ranks 4-5) — same metallic-ring technique as the
   podium's gold/mythical/epic tiers, in a dark-dominant silver sequence,
   but noticeably smaller and without the crown or oversized glow that
   the actual podium uses, so #4/#5 read as quieter runners-up rather
   than a 4th medal tier competing with the top 3. */
.podium-honorable-row{
  display:flex;align-items:flex-end;justify-content:center;gap:20px;
  margin-top:28px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.06);
  flex-wrap:wrap;
}
.podium-honorable-slot{display:flex;flex-direction:column;align-items:center;}
.podium-honorable-ring{
  border-radius:11px;display:inline-block;padding:2px;
  background:linear-gradient(135deg,#1c1c1c,#1c1c1c,#6e7073,#dcdee1,#6e7073,#1c1c1c,#1c1c1c);
  box-shadow:0 0 8px rgba(220,222,225,0.2);
}
.podium-honorable-frame{width:104px;border-radius:9px;overflow:hidden;position:relative;}
.podium-honorable-name{font-family:'Spectral',serif;font-weight:700;font-size:11px;color:var(--text-bright);margin-top:8px;text-align:center;}
.podium-honorable-power{font-size:10px;color:var(--gold-bright);margin-top:2px;text-align:center;}
@media(max-width:600px){
  .podium-honorable-frame{width:78px;}
  .podium-honorable-row{gap:12px;margin-top:20px;padding-top:14px;}
}

@media(max-width:600px){
  .podium-banner{min-height:340px;padding:40px 16px 28px;}
}

/* ── MEMBER CARD GRID (compact roster view) ── */
.member-card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;}
.member-row-card{display:flex;align-items:center;gap:10px;
  background:linear-gradient(135deg,rgba(28,24,20,0.9),rgba(16,13,11,0.95));
  border:1px solid var(--border-dim);border-radius:4px;padding:8px 12px;
  transition:border-color 0.2s,transform 0.15s;
}
.member-row-card:hover{border-color:rgba(201,151,42,0.4);transform:translateY(-1px);}
.member-row-icon{width:46px;height:46px;border-radius:4px;flex-shrink:0;
  background:linear-gradient(160deg,#1c1712,#0c0a08);border:1px solid var(--border-bright);
  display:flex;align-items:center;justify-content:center;position:relative;
}
.member-row-diamond{position:absolute;top:-4px;left:-4px;width:11px;height:11px;
  transform:rotate(45deg);border:1.5px solid var(--bg-dark);
}

/* ── BADGES ── */
.badge{display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:1px;
   font-size:9px;font-weight:700;font-family:'Inter',sans-serif;letter-spacing:1px;text-transform:uppercase;}
.badge-gold{background:rgba(201,151,42,0.12);color:var(--gold-light);border:1px solid rgba(201,151,42,0.35);}
.badge-red{background:rgba(122,26,26,0.2);color:#e07070;border:1px solid rgba(122,26,26,0.5);}
.badge-blue{background:rgba(26,90,138,0.15);color:#5dade2;border:1px solid rgba(26,90,138,0.4);}
.badge-silver{background:rgba(168,184,200,0.1);color:#a8b8c8;border:1px solid rgba(168,184,200,0.25);}
.badge-green{background:rgba(39,174,96,0.12);color:#58d68d;border:1px solid rgba(39,174,96,0.3);}
.badge-epic{background:rgba(122,26,26,0.25);color:#ff8080;border:1px solid rgba(192,57,43,0.55);text-transform:uppercase;}
.badge-rare{background:rgba(26,90,138,0.2);color:#60aadd;border:1px solid rgba(46,134,193,0.5);text-transform:uppercase;}
.badge-kari{background:rgba(0,80,160,0.35);color:#a0d8ff;border:1px solid rgba(100,200,255,0.6);text-transform:uppercase;}
.badge-material{background:rgba(120,120,120,0.25);color:#cccccc;border:1px solid rgba(160,160,160,0.55);text-transform:uppercase;}
.badge-uncommon{background:rgba(46,138,46,0.2);color:#7ddc7d;border:1px solid rgba(80,180,80,0.55);text-transform:uppercase;}

/* ── SECTION HEADER ── */
.section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;}
.section-title{font-family:'Spectral',serif;font-size:15px;font-weight:700;color:var(--gold-light);letter-spacing:1px}

/* ── DIVIDER ── */
.divider{height:1px;background:linear-gradient(90deg,transparent,var(--border),transparent);margin:18px 0;}

/* ── TABS ── */
.tabs{display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:24px;position:relative;overflow-x:auto;-webkit-overflow-scrolling:touch;}
.tabs::-webkit-scrollbar{height:0;}
.tabs::after{content:'';position:absolute;bottom:0;left:0;right:0;height:1px;
  background:linear-gradient(90deg,transparent,var(--border),transparent);}
.tab{
  padding:10px 22px;cursor:pointer;color:var(--text-mid);
  font-family:'Inter',sans-serif;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;
  border-bottom:2px solid transparent;margin-bottom:-1px;
  transition:all 0.2s;white-space:nowrap;flex-shrink:0;
}
.tab:hover{color:var(--gold-light);}
.tab.active{color:var(--gold-bright);border-bottom-color:var(--gold);}

/* ── DASH TABS — same underline-tab mechanics as .tabs/.tab (kept as a
   separate scoped class rather than editing .tab directly, since .tab is
   shared with at least one other page), styled to match the top nav's
   Spectral-serif + wider tracking instead of Inter, for full nav→hero→tabs
   consistency on pages using the Clan HQ ornament language. ── */
.dash-tabs{display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:24px;position:relative;overflow-x:auto;-webkit-overflow-scrolling:touch;}
.dash-tabs::-webkit-scrollbar{height:0;}
.dash-tabs::after{content:'';position:absolute;bottom:0;left:0;right:0;height:1px;
  background:linear-gradient(90deg,transparent,var(--border),transparent);}
.dash-tab{
  padding:10px 24px;cursor:pointer;color:var(--text-mid);
  font-family:'Spectral',serif;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;
  border-bottom:2px solid transparent;margin-bottom:-1px;
  transition:all 0.2s;white-space:nowrap;flex-shrink:0;
}
.dash-tab:hover{color:var(--gold-light);}
.dash-tab.active{color:var(--gold-bright);border-bottom-color:var(--gold);text-shadow:0 0 12px rgba(200,146,42,0.4);}

/* ── AUCTION CARD ── */
.auction-card{min-width:0;word-break:break-word;
  background:var(--bg-card);border:1px solid var(--border);
  border-radius:4px;overflow:hidden;
  /* box-shadow/border-color only — NOT transform: the hover-reveal cards
     drive their own scale/lift via framer-motion's whileHover (spring
     physics), and a CSS transition on the same "transform" property would
     fight the motion-value updates framer-motion writes inline. */
  transition:box-shadow 0.25s, border-color 0.25s;
}
.auction-card:hover{box-shadow:0 6px 30px rgba(0,0,0,0.5);}
.auction-card.rarity-epic{border-color:rgba(122,26,26,0.5);}
.auction-card.rarity-epic:hover{border-color:var(--blood-light);box-shadow:0 6px 30px rgba(122,26,26,0.2);}
.auction-card.rarity-rare{border-color:rgba(26,90,138,0.5);}
.auction-card.rarity-kari{border-color:rgba(100,180,255,0.7);box-shadow:0 0 18px rgba(80,160,255,0.25);}
.auction-card.rarity-material{border-color:rgba(160,160,160,0.5);}
.auction-card.rarity-material:hover{border-color:#cccccc;box-shadow:0 6px 30px rgba(120,120,120,0.2);}
.auction-card.rarity-uncommon{border-color:rgba(80,180,80,0.5);}
.auction-card.rarity-uncommon:hover{border-color:#7ddc7d;box-shadow:0 6px 30px rgba(46,138,46,0.2);}
.auction-card.rarity-rare:hover{border-color:var(--rare-light);box-shadow:0 6px 30px rgba(26,90,138,0.2);}
.auction-img{width:100%;aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;font-size:52px;position:relative;overflow:hidden;}
.auction-img.rarity-epic{background:radial-gradient(ellipse at 50% 50%,rgba(180,30,30,0.55) 0%,rgba(90,10,10,0.8) 55%,#0d0a0a 100%);}
.auction-img.rarity-rare{background:radial-gradient(ellipse at 50% 50%,rgba(30,100,180,0.55) 0%,rgba(10,40,90,0.8) 55%,#090d12 100%);}
.auction-img.rarity-material{background:radial-gradient(ellipse at 50% 50%,rgba(140,140,140,0.5) 0%,rgba(60,60,60,0.8) 55%,#0d0d0d 100%);}
.auction-img.rarity-uncommon{background:radial-gradient(ellipse at 50% 50%,rgba(60,180,60,0.5) 0%,rgba(20,70,20,0.8) 55%,#0a0d0a 100%);}
.auction-img.rarity-kari{background-size:cover!important;background-position:center!important;background-repeat:no-repeat!important;}
.auction-img img{width:80%;height:80%;object-fit:contain;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);filter:drop-shadow(0 4px 16px rgba(0,0,0,0.7));}
.auction-timer{position:absolute;top:8px;right:8px;background:rgba(122,26,26,0.92);color:#f0a0a0;
  font-family:'Inter',sans-serif;font-size:10px;font-weight:700;padding:3px 8px;
  border:1px solid rgba(192,57,43,0.5);letter-spacing:1px;}
.auction-rarity-badge{position:absolute;top:8px;left:8px;z-index:10;line-height:1;}
.auction-body{padding:12px;min-width:0;}
.auction-name{font-family:'Spectral',serif;font-size:14px;font-weight:700;color:var(--text-bright);margin-bottom:4px;text-align:left;}
.auction-desc{font-size:12px;color:var(--text-dim);margin-bottom:12px;line-height:1.6;font-weight:400;text-align:left;}
.auction-bid-row{display:flex;align-items:center;justify-content:space-between;}
.current-bid{font-family:'Spectral',serif;font-size:20px;font-weight:800;color:var(--gold-light)}
.bid-label{font-size:9px;color:var(--text-dim);text-transform:uppercase;letter-spacing:2px;font-weight:700;text-align:left;}
.top-bidder{font-size:11px;color:var(--text-mid);margin-top:4px;font-weight:500;text-align:left;}

/* ── IMAGE UPLOAD ── */
.image-library{display:grid;grid-template-columns:repeat(auto-fill,minmax(60px,1fr));gap:8px;margin-top:10px;}
.image-thumb{width:60px;height:60px;border-radius:2px;overflow:hidden;border:1px solid var(--border);cursor:pointer;transition:all 0.2s;}
.image-thumb:hover{border-color:var(--gold-dim);}
.image-thumb.selected{border-color:var(--gold);}
.image-thumb img{width:100%;height:100%;object-fit:cover;}

/* ── MODAL ── */
.modal-overlay{
  position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:200;
  display:flex;align-items:center;justify-content:center;padding:20px;
  backdrop-filter:blur(6px);
  animation:overlayFadeIn 0.2s ease both;
}
.modal{
  background:var(--bg-panel);border:1px solid var(--border-bright);
  border-radius:4px;width:100%;max-width:520px;
  box-shadow:0 30px 80px rgba(0,0,0,0.8),0 0 60px rgba(201,151,42,0.06);
  max-height:90vh;overflow-y:auto;
  position:relative;
  animation:modalPopIn 0.25s cubic-bezier(0.16,1,0.3,1) both;
}
@keyframes overlayFadeIn{from{opacity:0;}to{opacity:1;}}
@keyframes modalPopIn{from{opacity:0;transform:scale(0.95) translateY(8px);}to{opacity:1;transform:scale(1) translateY(0);}}
.modal::before{
  content:'';position:absolute;top:0;left:0;right:0;height:2px;
  background:linear-gradient(90deg,transparent,var(--gold-dim),transparent);
  pointer-events:none;
}
.modal-header{padding:22px 26px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;}
.modal-title{font-family:'Spectral',serif;font-size:17px;font-weight:800;color:var(--gold-light)letter-spacing:1px;}
.modal-body{padding:26px;}
.modal-footer{padding:16px 26px;border-top:1px solid var(--border);display:flex;gap:10px;justify-content:flex-end;}

/* ── LEADERBOARD ── */
.lb-grid{display:flex;flex-wrap:wrap;gap:20px;width:100%;box-sizing:border-box;align-items:start;}.lb-grid>*{flex:1 1 300px;min-width:0;}
.lb-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border-dim);width:100%;}
.lb-rank{font-family:'Inter',sans-serif;font-size:12px;font-weight:700;min-width:28px;width:28px;text-align:center;flex-shrink:0;color:var(--text-dim);letter-spacing:0.5px;}
.lb-name{font-family:'Spectral',serif;font-size:12px;font-weight:700;color:var(--text-bright);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left;}
.lb-val{font-family:'Inter',sans-serif;font-size:13px;font-weight:800;color:var(--gold-light);min-width:72px;text-align:right;flex-shrink:0;}
.lb-bar-bg{height:3px;background:rgba(255,255,255,0.06);border-radius:2px;margin-top:5px;}
.lb-bar{height:3px;background:linear-gradient(90deg,var(--gold-dim),var(--gold-light));border-radius:2px;}

/* ── FORM ── */
.form-group{margin-bottom:16px;}
.form-label{display:block;font-family:'Inter',sans-serif;font-size:9px;font-weight:700;
  color:var(--text-dim);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:7px;}

/* ── TOAST ── */
.toast-container{position:fixed;bottom:24px;right:24px;z-index:300;display:flex;flex-direction:column;gap:10px;}

/* ── COIN BURST (bid-placed celebration) ── */
.coin-burst-root{
  position:fixed;z-index:500;pointer-events:none;
  width:0;height:0;
}
.coin-burst-particle{
  position:absolute;left:0;top:0;
  margin-left:-10px;margin-top:-10px;
  border-radius:50%;
  filter:drop-shadow(0 0 4px rgba(255,210,110,0.7));
  opacity:0;
  animation-name:coinBurstFly;
  animation-timing-function:cubic-bezier(0.16,0.8,0.3,1);
  animation-fill-mode:forwards;
}
@keyframes coinBurstFly{
  0%{
    opacity:1;
    transform:translate(0,0) rotate(0deg) scale(0.4);
  }
  12%{
    opacity:1;
    transform:translate(calc(var(--dx) * 0.3),calc(var(--dy) * 0.3)) rotate(calc(var(--rot) * 0.3)) scale(1.15);
  }
  65%{
    opacity:1;
    transform:translate(calc(var(--dx) * 0.75),calc(var(--dy) * 0.75 + 30px)) rotate(calc(var(--rot) * 0.8)) scale(0.95);
  }
  100%{
    opacity:0;
    transform:translate(var(--dx),calc(var(--dy) + 90px)) rotate(var(--rot)) scale(0.7);
  }
}
@media (prefers-reduced-motion: reduce){
  .coin-burst-particle{animation:none;display:none;}
}

/* ── BALANCE POPUP (shows remaining coins right after a bid) ── */
.balance-popup{
  position:fixed;z-index:501;pointer-events:none;
  transform:translate(-50%,-50%);
  animation:balancePopupLift 2.2s cubic-bezier(0.16,0.8,0.3,1) forwards;
}
.balance-popup-inner{
  display:flex;align-items:center;gap:9px;
  background:linear-gradient(160deg,rgba(20,16,12,0.96),rgba(14,11,9,0.97));
  border:1px solid var(--gold-dim);
  border-radius:8px;
  padding:8px 14px 8px 10px;
  box-shadow:0 10px 30px rgba(0,0,0,0.55),0 0 0 1px rgba(201,151,42,0.1);
  white-space:nowrap;
}
.balance-popup-icon{width:22px;height:22px;object-fit:contain;
  filter:drop-shadow(0 0 4px rgba(255,210,110,0.6));flex-shrink:0;}
.balance-popup-text{display:flex;flex-direction:column;align-items:flex-start;line-height:1.2;}
.balance-popup-amount{font-family:'Spectral',serif;font-weight:800;font-size:16px;color:var(--gold-bright);}
.balance-popup-label{font-size:9px;color:var(--text-dim);letter-spacing:1.5px;text-transform:uppercase;font-weight:600;}
@keyframes balancePopupLift{
  0%{opacity:0;transform:translate(-50%,-50%) translateY(6px) scale(0.85);}
  10%{opacity:1;transform:translate(-50%,-50%) translateY(-46px) scale(1);}
  78%{opacity:1;transform:translate(-50%,-50%) translateY(-58px) scale(1);}
  100%{opacity:0;transform:translate(-50%,-50%) translateY(-74px) scale(0.96);}
}
@media (prefers-reduced-motion: reduce){
  .balance-popup{animation:none;opacity:0;display:none;}
}
.toast{
  background:var(--bg-panel);border:1px solid var(--border-bright);
  border-radius:2px;padding:13px 18px;min-width:270px;
  box-shadow:0 6px 30px rgba(0,0,0,0.6);
  animation:slideIn 0.3s ease;font-size:13px;font-family:'Inter',sans-serif;
}
.toast::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;
  background:linear-gradient(90deg,transparent,var(--gold-dim),transparent);}
.toast-gold{border-left:3px solid var(--gold);}
.toast-red{border-left:3px solid var(--crimson);}
.toast-blue{border-left:3px solid var(--rare);}
.toast-green{border-left:3px solid #27ae60;}
@keyframes slideIn{from{transform:translateX(80px);opacity:0;}to{transform:translateX(0);opacity:1;}}
@keyframes slideOut{from{transform:translateX(0) scale(1);opacity:1;}to{transform:translateX(40px) scale(0.96);opacity:0;}}
.toast-exit{animation:slideOut 0.22s ease forwards!important;}
@keyframes spin{to{transform:rotate(360deg);}}
@keyframes profileCardShimmer{0%{background-position:200% 0;}100%{background-position:-200% 0;}}
@keyframes fadeInUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}

/* ── LOADING SIGIL — "rune ring draw-in" loading indicator ──
   The ring inscribes itself (stroke-dasharray/dashoffset, not a spinning
   conic-gradient) like a rune being drawn, the clan logo settles into
   place once it completes, then both fade and the cycle restarts —
   implies something actually completing rather than decoration that
   loops forever with no meaning. Pure CSS/SVG, no new image assets
   beyond the logo that was already shipped elsewhere in the app (login
   screen, sidebar), so it costs nothing extra on top of actual load time. */
@keyframes sigilDrawRing{
  0%{stroke-dashoffset:280;opacity:0.3;}
  45%{stroke-dashoffset:0;opacity:1;}
  70%{stroke-dashoffset:0;opacity:1;}
  100%{stroke-dashoffset:-280;opacity:0.3;}
}
@keyframes sigilLogoSettle{
  0%,40%{opacity:0;transform:scale(0.75);}
  55%,85%{opacity:1;transform:scale(1);}
  100%{opacity:0;transform:scale(0.75);}
}
.loading-sigil{position:relative;width:120px;height:120px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.loading-sigil-ring-svg{position:absolute;inset:0;width:100%;height:100%;}
.loading-sigil-ring-svg circle{
  fill:none;stroke:var(--gold-light);stroke-width:2;stroke-linecap:round;
  stroke-dasharray:280;stroke-dashoffset:280;
  animation:sigilDrawRing 2.8s cubic-bezier(0.65,0,0.35,1) infinite;
  filter:drop-shadow(0 0 4px rgba(230,176,72,0.5));
}
.loading-sigil-logo-wrap{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;}
.loading-sigil-logo{
  width:62px;height:62px;object-fit:contain;
  animation:sigilLogoSettle 2.8s cubic-bezier(0.34,1.56,0.64,1) infinite;
  filter:drop-shadow(0 0 6px rgba(230,176,72,0.5));
}
@media (prefers-reduced-motion: reduce){
  .loading-sigil-ring-svg circle{animation:none;stroke-dashoffset:0;opacity:0.85;}
  .loading-sigil-logo{animation:none;opacity:1;transform:none;}
}

/* ── MISC ── */
.pulse{animation:pulse 2s infinite;}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.6;}}
.event-pill{
  padding:9px 14px;border-radius:2px;cursor:pointer;
  border:1px solid rgba(255,255,255,0.08);transition:all 0.2s;
  background:rgba(10,11,15,0.6);font-family:'Inter',sans-serif;font-size:12px;font-weight:600;
}
.event-pill:hover{border-color:var(--gold-dim);}
.event-pill.selected{background:rgba(201,151,42,0.12);border-color:var(--gold);color:var(--gold-light);}
.winner-banner{
  background:linear-gradient(135deg,rgba(201,151,42,0.18),rgba(201,151,42,0.04));
  border:1px solid var(--gold);border-radius:4px;padding:18px;text-align:center;
  animation:fadeGlow 1.5s ease-in-out;
}
@keyframes fadeGlow{from{box-shadow:0 0 40px rgba(201,151,42,0.5);}to{box-shadow:0 0 10px rgba(201,151,42,0.08);}}
.discord-tag{display:inline-flex;align-items:center;gap:5px;background:rgba(71,82,196,0.18);
  border:1px solid rgba(114,137,218,0.4);color:#8ba4e8;border-radius:2px;padding:3px 9px;
  font-size:11px;font-weight:600;font-family:'Inter',sans-serif;}

/* ── LOGIN ── */
/* Portaled directly into <body> (see LoginScreen) — position:fixed here
   pins it to the viewport regardless of where in the DOM tree it lives. */
.login-wrap{
  position:fixed;inset:0;
  min-height:100vh;overflow:hidden;
  background:#05040a;
  z-index:9999;
}
.login-video-bg{
  position:absolute;inset:0;width:100%;height:100%;
  object-fit:cover;object-position:right center;
  z-index:0;
}
.login-scrim{
  position:absolute;inset:0;z-index:1;pointer-events:none;
  background:linear-gradient(90deg,
    rgba(4,3,8,0.97) 0%,
    rgba(4,3,8,0.93) 18%,
    rgba(4,3,8,0.72) 34%,
    rgba(4,3,8,0.32) 50%,
    rgba(4,3,8,0.08) 64%,
    rgba(4,3,8,0.0) 78%
  );
}
.login-topbar{
  position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;
  padding:28px 40px;
}
.login-brand{display:flex;align-items:center;gap:9px;}
.login-brand-mark{
  width:30px;height:30px;object-fit:contain;
  display:block;flex-shrink:0;
  filter:drop-shadow(0 0 6px rgba(201,151,42,0.35));
}
.login-content{
  position:relative;z-index:2;min-height:calc(100vh - 86px);
  display:flex;flex-direction:column;justify-content:center;
  padding:0 40px 60px;max-width:480px;
}
.login-eyebrow{
  font-family:'Inter',sans-serif;font-size:11px;font-weight:700;letter-spacing:4px;
  text-transform:uppercase;color:var(--gold);margin-bottom:14px;
}
.login-hero-title--left{
  text-align:left;font-size:clamp(34px,5vw,48px);margin-bottom:18px;
}
.login-quote--left{
  text-align:left;margin-bottom:28px;max-width:380px;
}
.login-card--left{margin:0;width:100%;max-width:380px;}
.login-footnote--left{
  margin-top:18px;text-align:left;font-size:11px;color:var(--text-dim);
  font-family:'Inter',sans-serif;letter-spacing:0.5px;
}
.login-card{position:relative;z-index:1;
  background:linear-gradient(160deg,rgba(18,19,30,0.88),rgba(13,14,24,0.94));
  border:1px solid rgba(201,151,42,0.35);
  border-radius:6px;padding:26px;width:100%;max-width:380px;
  box-shadow:0 30px 80px rgba(0,0,0,0.6),0 0 60px rgba(201,151,42,0.08);
  backdrop-filter:blur(4px);
  overflow:hidden;
}
.login-card::before{
  content:'';position:absolute;top:0;left:0;right:0;height:2px;
  background:linear-gradient(90deg,transparent,var(--gold),transparent);
}
.login-card::after{
  content:'';position:absolute;inset:0;
  background:radial-gradient(ellipse at 50% 0%,rgba(201,151,42,0.07) 0%,transparent 60%);
  pointer-events:none;
}
.login-quote{font-family:'Inter',sans-serif;font-style:italic;font-size:13px;font-weight:500;
  color:#b09572;letter-spacing:0.5px;margin-bottom:14px;}
.login-hero-title{font-family:'Spectral',serif;font-size:clamp(32px,7vw,46px);font-weight:800;
  color:var(--gold-light);letter-spacing:1px;line-height:1.05;
  text-shadow:0 0 40px rgba(201,151,42,0.35);}
.login-hero-sub{font-size:10px;color:#a08860;letter-spacing:5px;text-transform:uppercase;
  margin-top:12px;font-weight:600;margin-bottom:32px;}
.login-error{background:rgba(122,26,26,0.2);border:1px solid rgba(122,26,26,0.5);color:#e07070;
  border-radius:2px;padding:10px 14px;font-size:12px;margin-bottom:16px;font-weight:600;
  font-family:'Inter',sans-serif;letter-spacing:0.5px;}
.register-link{text-align:center;margin-top:20px;font-size:12px;color:var(--text-dim);font-weight:500;font-family:'Inter',sans-serif;}
.register-link span{color:var(--gold-light);cursor:pointer;font-weight:700;}
.register-link span:hover{text-decoration:underline;}
@media (max-width:760px){
  .login-video-bg{object-position:78% center;}
  .login-scrim{
    background:linear-gradient(180deg,
      rgba(4,3,8,0.55) 0%,
      rgba(4,3,8,0.85) 45%,
      rgba(4,3,8,0.97) 70%,
      rgba(4,3,8,0.99) 100%
    );
  }
  .login-topbar{padding:20px 20px;}
  .login-content{padding:0 20px 40px;max-width:none;justify-content:flex-end;}
  .login-hero-title--left,.login-quote--left,.login-eyebrow{text-align:center;}
  .login-card--left{margin:0 auto;}
  .login-footnote--left{text-align:center;}
}


/* ── RESPONSIVE ── */
@media(max-width:900px){
  .grid-4{grid-template-columns:1fr 1fr;}.grid-3{grid-template-columns:1fr 1fr;}
}
@media(max-width:640px){
  .content{padding:16px 20px;}.grid-2,.grid-3,.grid-4{grid-template-columns:1fr;}
}

/* ── ENTRANCE ANIMATION (plays once per login, between LoginScreen and dashboard) ── */
.entrance-overlay{
  position:fixed;inset:0;z-index:9998;
  background:var(--bg-void);
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  animation:entranceOverlayFade 3.6s ease forwards;
  overflow:hidden;
}
.entrance-video-bg{
  position:absolute;inset:0;width:100%;height:100%;
  object-fit:cover;object-position:right center;
  z-index:0;
  animation:entranceVideoZoom 3.6s ease forwards;
}
@media (max-width:760px){
  /* Match the login screen's already-proven mobile crop position exactly
     (see .login-video-bg above) — this is the real value confirmed to
     correctly frame the angel's face/wings/trophy together on phones,
     rather than guessing at a new percentage for this second video
     instance of the same footage. */
  .entrance-video-bg{object-position:78% center;}
}
@keyframes entranceVideoZoom{
  0%{transform:scale(1.08);opacity:0.85;}
  100%{transform:scale(1);opacity:1;}
}
.entrance-scrim{
  position:absolute;inset:0;z-index:1;pointer-events:none;
  background:linear-gradient(180deg,
    rgba(8,6,5,0.35) 0%,
    rgba(8,6,5,0.15) 30%,
    rgba(8,6,5,0.4) 60%,
    rgba(8,6,5,0.85) 100%
  );
}
@media (max-width:760px){
  /* Match the login screen's proven mobile scrim curve exactly. */
  .entrance-scrim{
    background:linear-gradient(180deg,
      rgba(8,6,5,0.45) 0%,
      rgba(8,6,5,0.8) 45%,
      rgba(8,6,5,0.95) 70%,
      rgba(8,6,5,0.98) 100%
    );
  }
}
/* Dedicated solid panel behind the text block, independent of the
   scrim above — guarantees strong readable contrast for the logo,
   clan name, and quote no matter where the video's visible band ends
   up landing (which shifts depending on cover vs contain / screen
   shape), instead of relying only on the overall scrim gradient. */
.entrance-text-backdrop{
  position:absolute;left:0;right:0;bottom:0;z-index:1;pointer-events:none;
  height:36%;
  background:linear-gradient(180deg, rgba(8,6,5,0) 0%, rgba(8,6,5,0.75) 40%, rgba(8,6,5,0.97) 100%);
}
.entrance-logo{
  width:64px;height:64px;object-fit:contain;
  opacity:0;position:relative;z-index:2;margin-bottom:10px;
  filter:drop-shadow(0 0 0px rgba(242,204,96,0));
  animation:entranceLogoIn 1.1s cubic-bezier(0.16,0.8,0.3,1) 0.15s forwards;
}
@keyframes entranceLogoIn{
  0%{opacity:0;transform:scale(0.4);filter:drop-shadow(0 0 0px rgba(242,204,96,0));}
  60%{opacity:1;transform:scale(1.12);filter:drop-shadow(0 0 22px rgba(242,204,96,0.85));}
  100%{opacity:1;transform:scale(1);filter:drop-shadow(0 0 14px rgba(242,204,96,0.6));}
}
.entrance-name{
  font-family:'Spectral',serif;font-weight:800;
  font-size:34px;letter-spacing:1px;color:var(--text-bright);
  margin-top:18px;opacity:0;position:relative;z-index:2;
  text-shadow:0 2px 20px rgba(0,0,0,0.8),0 0 18px rgba(242,204,96,0.35);
  animation:fadeInUp 0.7s ease 0.85s forwards;
  max-width:90vw;text-align:center;word-break:break-word;
}
.entrance-quote{
  font-family:'Spectral',serif;font-style:italic;font-size:14px;
  color:var(--text-bright);margin-top:10px;opacity:0;position:relative;z-index:2;
  text-shadow:0 1px 12px rgba(0,0,0,0.85);
  animation:fadeInUp 0.7s ease 1.25s forwards;
  max-width:80vw;text-align:center;padding:0 20px;
}
.entrance-welcome{
  font-size:11px;letter-spacing:3px;text-transform:uppercase;font-weight:700;
  color:var(--gold-bright);opacity:0;position:relative;z-index:2;margin-bottom:8px;
  text-shadow:0 1px 10px rgba(0,0,0,0.85);
  animation:fadeInUp 0.6s ease 0.55s forwards;
  max-width:90vw;text-align:center;
}
.entrance-text-anchor{
  position:relative;z-index:2;margin-top:auto;padding-bottom:22%;
  display:flex;flex-direction:column;align-items:center;
}
@media(max-width:480px){
  .entrance-name{font-size:24px;}
  .entrance-quote{font-size:12px;}
  .entrance-logo{width:48px;height:48px;}
}
@keyframes entranceOverlayFade{
  0%{opacity:1;}
  80%{opacity:1;}
  100%{opacity:0;visibility:hidden;}
}
@media (prefers-reduced-motion: reduce){
  .entrance-overlay{animation:entranceOverlayFadeReduced 2.2s ease forwards;}
  .entrance-video-bg{animation:none;}
  .entrance-logo,.entrance-name,.entrance-quote,.entrance-welcome{animation:none;opacity:1;}
}
@keyframes entranceOverlayFadeReduced{
  0%{opacity:1;}85%{opacity:1;}100%{opacity:0;visibility:hidden;}
}
.bgm-toggle{
  position:fixed;bottom:24px;left:24px;z-index:300;
  width:42px;height:42px;border-radius:50%;
  background:rgba(20,16,12,0.85);border:1px solid var(--border-bright);
  display:flex;align-items:center;justify-content:center;
  cursor:pointer;transition:background 0.15s,border-color 0.15s,transform 0.15s;
}
.bgm-toggle:hover{background:rgba(30,24,18,0.92);border-color:var(--gold);}
.bgm-toggle:active{transform:scale(0.94);}
.bgm-toggle svg{color:var(--gold-light);}
@media(max-width:480px){
  .bgm-toggle{bottom:16px;left:16px;width:38px;height:38px;}
}
`;

// ─── UTILITIES ────────────────────────────────────────────────────────────────
function EntranceAnimation({ onDone }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3600); // matches entranceOverlayFade duration
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="entrance-overlay" onClick={onDone}>
      <video
        className="entrance-video-bg"
        autoPlay
        loop
        muted
        playsInline
        poster="/video/login-bg-poster.jpg"
      >
        <source src="/video/login-bg.webm" type="video/webm" />
      </video>
      <div className="entrance-scrim" />
      <div className="entrance-text-backdrop" />
      <div className="entrance-text-anchor">
        <img src="/images/ymir-logo-gold.png" alt="" className="entrance-logo" />
        <div className="entrance-welcome">{CLAN_SUBTITLE}</div>
        <div className="entrance-name">{CLAN_NAME}</div>
        <div className="entrance-quote">"{CLAN_QUOTE}"</div>
      </div>
    </div>
  );
}

function Toast({ toasts, remove }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type||'gold'}${t.exiting?' toast-exit':''}`} style={{position:"relative"}} onClick={() => remove(t.id)}>
          <div style={{fontFamily:"'Inter',sans-serif",fontWeight:800,fontSize:10,color:"var(--gold-light)",marginBottom:3,letterSpacing:2,textTransform:"uppercase"}}>{t.title||"Notice"}</div>
          <div style={{color:"var(--text)",fontWeight:500,fontSize:13}}>{t.msg}</div>
        </div>
      ))}
    </div>
  );
}

function useImageLibrary() {
  const [library, setLibrary] = useState(_imageLibrary);
  // Load the persisted library from app_state once per app load and merge
  // it in — this is the actual fix for images "disappearing"/not showing
  // up across sessions. Guarded by a module-level flag so re-mounting
  // this hook (e.g. navigating away from and back to the auction page)
  // doesn't re-fetch every time; once populated for this session, newly
  // uploaded images are added via addImage() same as before.
  useEffect(() => {
    if (_imageLibraryFetched) return;
    _imageLibraryFetched = true;
    loadImageLibraryFromAppState().then(remoteEntries => {
      if (remoteEntries.length === 0) return;
      const existingNames = new Set(_imageLibrary.map(e => e.name));
      const newOnes = remoteEntries.filter(e => !existingNames.has(e.name));
      if (newOnes.length === 0) return;
      _imageLibrary = [..._imageLibrary, ...newOnes];
      setLibrary([..._imageLibrary]);
    });
  }, []);
  const addImage = useCallback((name, dataUrl) => {
    const entry = { id: Date.now() + Math.random(), name, dataUrl };
    _imageLibrary = [..._imageLibrary, entry];
    setLibrary([..._imageLibrary]);
    // Fire-and-forget — the entry is already usable locally regardless of
    // whether this write succeeds; a failed persist just means this one
    // upload won't be there for a future session (same as before this
    // fix existed at all), not that anything breaks right now.
    dbUpsertReliable("app_state", { key: "auction_image_library", value: JSON.stringify(_imageLibrary), updated_at: Date.now() });
    return entry;
  }, []);
  return [library, addImage];
}

// Module-level cache so each auction's image is fetched at most once per
// page load, regardless of how many components render it.
const _auctionImageCache = new Map();

// Renders an auction's image. Auction list/poll queries omit image_data
// (it can be large enough to cause DB statement timeouts), so this
// component lazily fetches image_data on demand the first time an
// auction with image_name is rendered, then caches it.
function AuctionImage({ auction, alt="", style, fallback }) {
  const cacheKey = auction?.id ? String(auction.id) : null;

  const [dataUrl, setDataUrl] = useState(() => {
    if (auction?.image?.dataUrl) return auction.image.dataUrl;
    if (cacheKey && _auctionImageCache.has(cacheKey)) return _auctionImageCache.get(cacheKey);
    return null;
  });

  // Sync: if local state is null but the cache or parent now has the URL, apply it immediately
  useEffect(() => {
    if (!dataUrl && auction?.image?.dataUrl) { setDataUrl(auction.image.dataUrl); return; }
    if (!dataUrl && cacheKey && _auctionImageCache.has(cacheKey)) { setDataUrl(_auctionImageCache.get(cacheKey)); return; }
  }, [auction?.image?.dataUrl, cacheKey, dataUrl]);

  useEffect(() => {
    if (dataUrl) return;
    if (!auction?.image?.name) return;
    if (!cacheKey) return;
    let cancelled = false;
    queueLoadAuctionImage(cacheKey).then(row => {
      if (cancelled) return;
      if (row?.image_data) {
        _auctionImageCache.set(cacheKey, row.image_data);
        setDataUrl(row.image_data);
      }
    });
    return () => { cancelled = true; };
  }, [cacheKey, auction?.image?.name, dataUrl]);

  if (dataUrl) return <img src={dataUrl} alt={alt} style={style} />;
  // ROOT CAUSE: this component has a genuine async gap — the bulk auction
  // load intentionally omits full image data (kept out for load speed),
  // so dbLoadAuctionImage above is a real separate fetch, not instant
  // decode time. Previously this fell straight to the generic auction
  // icon while that fetch was in flight, identical to "this item simply
  // has no photo" — no way to tell the two apart. A real photo is named
  // (auction.image.name) but not yet loaded; show a shimmer for that
  // case specifically, and only fall back to the plain icon when there's
  // genuinely no image at all.
  if (auction?.image?.name) {
    return (
      <div style={{
        ...style, position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",
        width:"80%",height:"80%",borderRadius:6,
        background:"linear-gradient(110deg, #1a1410 30%, #2a2118 50%, #1a1410 70%)",
        backgroundSize:"200% 100%",animation:"profileCardShimmer 1.6s ease-in-out infinite",
      }} />
    );
  }
  return fallback || null;
}

function ItemImagePicker({ value, onChange, library, addImage }) {
  const fileRef = useRef();
  const [showLib, setShowLib] = useState(false);
  const [uploading, setUploading] = useState(false);
  async function handleFile(e) {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true);
    const url = await uploadAuctionImage(file);
    if (url) {
      const entry = addImage(file.name, url);
      onChange(entry);
      setUploading(false);
    } else {
      // Storage upload failed — fall back to embedding base64 directly.
      const reader = new FileReader();
      reader.onload = ev => { const entry = addImage(file.name, ev.target.result); onChange(entry); setUploading(false); };
      reader.onerror = () => setUploading(false);
      reader.readAsDataURL(file);
    }
  }
  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:8}}>
        <button type="button" className="btn btn-outline btn-sm" onClick={()=>fileRef.current.click()} disabled={uploading}>{uploading?"⏳ Uploading…":"📁 Upload Image"}</button>
        {library.length > 0 && <button type="button" className="btn btn-outline btn-sm" onClick={()=>setShowLib(v=>!v)}>{showLib?"Hide":"Show"} Library ({library.length})</button>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleFile} />
      {value && (
        <div style={{marginBottom:8,display:"flex",alignItems:"center",gap:10}}>
          <img src={value.dataUrl} alt={value.name} style={{width:64,height:64,objectFit:"cover",borderRadius:2,border:"1px solid var(--gold-dim)"}} />
          <div>
            <div style={{fontSize:12,fontWeight:600,color:"var(--text-bright)",fontFamily:"'Inter',sans-serif"}}>{value.name}</div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={()=>onChange(null)}>✕ Remove</button>
          </div>
        </div>
      )}
      {showLib && library.length > 0 && (
        <div>
          <div style={{fontSize:9,color:"var(--text-dim)",fontWeight:700,letterSpacing:2,marginBottom:6,textTransform:"uppercase"}}>Saved Images — click to reuse</div>
          <div className="image-library">
            {library.map(img => (
              <div key={img.id} className={`image-thumb${value?.id===img.id?" selected":""}`} onClick={()=>{onChange(img);setShowLib(false);}}>
                <img src={img.dataUrl} alt={img.name} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginScreen({ members, onLogin, onGuest }) {
  const { t } = useLang();
  const [form, setForm] = useState({ username:"", password:"" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Plain state (submitting) re-renders too slowly to block a fast
  // double-click/double-Enter before the button actually disables — same
  // gap already found and fixed elsewhere in this app (AdjustCoinsModal,
  // placeBid) via a synchronous ref instead.
  const submittingRef = useRef(false);

  async function doLogin() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    // Checked server-side now (see verifyLogin/verify_login.sql) instead
    // of comparing against a locally-loaded members array — the anon key
    // no longer has read access to the password column at all, since that
    // column used to be readable by anyone who copied the public anon key
    // out of the site's own JS bundle.
    const matchedId = await verifyLogin(form.username, form.password);
    const m = matchedId ? members.find(m => String(m.id) === matchedId) : null;
    submittingRef.current = false;
    setSubmitting(false);
    if (!m) { setError(t("invalidLogin")); return; }
    onLogin(m);
  }

  // Clan Total Power + Reigning Champion — both computed straight from
  // members (already passed to this screen), same "sum of all power" /
  // "top by power" logic used by the Dashboard hero and the Leaderboard
  // podium, so these numbers always agree with what's shown once logged
  // in. Guarded for an empty members array (fresh clan, nothing seeded
  // yet) so the login screen never shows a misleading "0 Power" moment —
  // both blocks simply don't render instead.
  const totalPower = members.reduce((s,m)=>s+(m.power||0),0);
  const topByPower = members.length > 0 ? [...members].sort((a,b)=>b.power-a.power)[0] : null;

  // Rendered via a portal straight into <body>, NOT in place. This is
  // deliberate: the login screen must always fill the entire viewport,
  // and if it's mounted inside whatever wrapper happens to contain the
  // <App/> root (a centered/max-width shell, a flex container, anything
  // with overflow:hidden, etc.) it can get visually squeezed or clipped
  // no matter what CSS we throw at it from the inside. Portaling to
  // document.body sidesteps that entirely — this node's nearest
  // positioning/overflow context is the page itself.
  return createPortal(
    <div className="login-wrap">
      <video
        className="login-video-bg"
        autoPlay
        loop
        muted
        playsInline
        poster="/video/login-bg-poster.jpg"
      >
        <source src="/video/login-bg.webm" type="video/webm" />
      </video>
      <div className="login-scrim" />

      <div className="login-topbar">
        <div className="login-brand">
          <img src="/images/ymir-logo-gold.png" alt="Legend of Ymir" className="login-brand-mark" />
          <div>
            <div className="logo-title">LEGEND OF YMIR</div>
            <div className="logo-sub">Clan Management</div>
          </div>
        </div>
        <LangSwitcher />
      </div>

      <div className="login-content">
        <div className="login-eyebrow">{CLAN_SEASON_LABEL}</div>
        <div className="login-hero-title login-hero-title--left">{CLAN_NAME}</div>
        <div className="login-quote login-quote--left">"{CLAN_QUOTE}"</div>

        {/* Addition 1 — Clan Total Power, same stat/wording the Dashboard
            hero already uses, so the number agrees with what's shown
            once logged in. Hidden for a fresh clan with no members yet
            rather than showing a misleading "0 Power". */}
        {members.length > 0 && (
          <div style={{marginBottom:24}}>
            <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:"rgba(200,146,42,0.7)",fontWeight:700,fontFamily:"'Inter',sans-serif",marginBottom:4}}>{t("clanTotalPower")}</div>
            <div style={{fontFamily:"'Spectral',serif",fontSize:30,fontWeight:800,color:"var(--gold-bright)",textShadow:"0 0 22px rgba(200,146,42,0.4)",lineHeight:1,fontVariantNumeric:"tabular-nums"}}>{fmt(totalPower)}</div>
            <div style={{fontSize:11,color:"var(--text-dim)",marginTop:4,fontFamily:"'Inter',sans-serif"}}>{t("acrossWarriors").replace("{count}", members.length)}</div>
          </div>
        )}

        {/* Addition 2 — corner brackets on the login card, matching the
            ornament language every other panel in the app now uses.
            The card's existing gradient/glow/top-accent-line stay as-is. */}
        <div className="login-card login-card--left">
          <CornerBrackets size={13} thickness={1.5} inset={8} opacity={0.4}/>
          {error && <div className="login-error">{error}</div>}
          <div className="form-group">
            <label className="form-label">{t("username")}</label>
            <input className="input" placeholder={t("enterUsername")} value={form.username} onChange={e=>setForm(p=>({...p,username:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&doLogin()} autoComplete="username" disabled={submitting} />
          </div>
          <div className="form-group">
            <label className="form-label">{t("password")}</label>
            <input className="input" type="password" placeholder={t("enterPassword")} value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&doLogin()} autoComplete="current-password" disabled={submitting} />
          </div>
          <button className="btn btn-gold" style={{width:"100%",justifyContent:"center",padding:"12px 20px"}} onClick={doLogin} disabled={submitting}>{submitting ? "…" : t("enter")}</button>
          {onGuest && (
            <div
              onClick={submitting ? undefined : onGuest}
              style={{textAlign:"center",marginTop:12,fontSize:12,color:"var(--text-dim)",cursor:submitting?"default":"pointer",textDecoration:"underline",textUnderlineOffset:3}}
            >
              {t("continueAsGuest")}
            </div>
          )}
        </div>

        {/* Addition 3 — Reigning Champion tag: current #1 by Power, name
            + power split by a thin divider, sized tightly to that content
            rather than a pill built with room for more than a name. */}
        {topByPower && (
          <div style={{
            display:"inline-flex",alignItems:"center",gap:7,marginTop:16,
            background:"rgba(200,146,42,0.08)",border:"1px solid rgba(200,146,42,0.28)",
            borderRadius:8,padding:"7px 12px",
          }}>
            <div style={{
              width:16,height:16,borderRadius:"50%",flexShrink:0,
              background:"radial-gradient(circle,rgba(200,146,42,0.4),rgba(20,15,10,0.9) 70%)",
              border:"1px solid rgba(200,146,42,0.5)",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,
            }}><CrownIcon size={9} style={{color:"var(--gold-light)"}}/></div>
            <div>
              <div style={{fontSize:7.5,letterSpacing:1.5,textTransform:"uppercase",color:"rgba(200,146,42,0.7)",fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{t("reigningChampion")}</div>
              <div style={{fontFamily:"'Spectral',serif",fontSize:12,fontWeight:800,color:"var(--gold-bright)"}}>{topByPower.name}</div>
            </div>
            <div style={{width:1,alignSelf:"stretch",background:"rgba(200,146,42,0.25)",margin:"0 2px"}}/>
            <div style={{display:"flex",alignItems:"center",gap:3,fontSize:11,fontWeight:700,color:"var(--text-dim)",fontVariantNumeric:"tabular-nums"}}>
              <span style={{color:"var(--gold-light)",fontWeight:800}}>{fmt(topByPower.power)}</span>&nbsp;{t("powerLabel")}
            </div>
          </div>
        )}

        <div className="login-footnote login-footnote--left">
          {t("contactMaster")}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── DISCORD MODAL ────────────────────────────────────────────────────────────
function DiscordModal({ member, onSave, onClose }) {
  const { t } = useLang();
  const [val, setVal] = useState(member.discord || "");
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{t("linkDiscordTitle")} {member.name}</div>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{display:"flex",alignItems:"center",gap:14,padding:16,background:"rgba(71,82,196,0.08)",border:"1px solid rgba(114,137,218,0.25)",borderRadius:2,marginBottom:20}}>
            <span style={{fontSize:30}}>🎮</span>
            <div>
              <div style={{fontWeight:700,fontSize:13,color:"var(--text-bright)",fontFamily:"'Inter',sans-serif"}}>{t("connectDiscord")}</div>
              <div style={{fontSize:11,color:"var(--text-dim)",marginTop:3,fontFamily:"'Inter',sans-serif"}}>{t("discordLinkHint")}</div>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{t("discordUsername")}</label>
            <input className="input" placeholder={t("discordUsernamePlaceholder")} value={val} onChange={e=>setVal(e.target.value)} />
          </div>
          {member.discord && <div style={{fontSize:12,color:"var(--text-dim)",fontFamily:"'Inter',sans-serif"}}>{t("currentLabel")} <span className="discord-tag">🎮 {member.discord}</span></div>}
        </div>
        <div className="modal-footer">
          {member.discord && <button className="btn btn-red" onClick={()=>onSave("")}>{t("unlink")}</button>}
          <button className="btn btn-outline" onClick={onClose}>{t("cancel")}</button>
          <button className="btn btn-discord" onClick={()=>onSave(val.trim())}>{t("saveDiscord")}</button>
        </div>
      </div>
    </div>
  );
}

// ─── PROFILE RARITY (Player Info card tier) ────────────────────────────────────
// Separate from RARITY_OPTS used for auction loot items (epic/rare/kari/
// uncommon/material) — this is its own five-tier system specifically for
// the Player Info profile card, matching the uploaded rarity background
// assets (uncommon/rare/epic/legendary/mythic).
const PROFILE_RARITY_OPTS = [
  { value: "uncommon",  label: "Uncommon",  color: "#7ddc7d" },
  { value: "rare",      label: "Rare",      color: "#60aadd" },
  { value: "epic",      label: "Epic",      color: "#ff8080" },
  { value: "legendary", label: "Legendary", color: "#f2cc60" },
  { value: "mythic",    label: "Mythic",    color: "#c77dff" },
];

function SetRarityModal({ member, onSave, onClose }) {
  const [rarity, setRarity] = useState(member.profileRarity || "uncommon");
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Set Rarity — {member.name}</div>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{fontSize:12,color:"var(--text-dim)",marginBottom:16}}>
            Sets the rarity tier shown on {member.name}'s Player Info profile card.
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {PROFILE_RARITY_OPTS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={()=>setRarity(opt.value)}
                style={{
                  display:"flex",alignItems:"center",gap:10,padding:"10px 14px",
                  borderRadius:2,cursor:"pointer",textAlign:"left",
                  background: rarity===opt.value ? "rgba(201,151,42,0.1)" : "rgba(255,255,255,0.02)",
                  border: rarity===opt.value ? "1px solid var(--gold)" : "1px solid var(--border)",
                }}
              >
                <span style={{width:12,height:12,borderRadius:"50%",background:opt.color,flexShrink:0}} />
                <span style={{fontFamily:"'Inter',sans-serif",fontSize:13,fontWeight:700,color:"var(--text-bright)"}}>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-gold" onClick={()=>onSave(rarity)}>Save Rarity</button>
        </div>
      </div>
    </div>
  );
}

function SetAwakeningModal({ member, onSave, onClose }) {
  const [level, setLevel] = useState(member.awakeningLevel || 0);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Set Awakening — {member.name}</div>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{fontSize:12,color:"var(--text-dim)",marginBottom:16}}>
            Sets the awakening level badge shown on {member.name}'s Player Info profile card. Use 0 to hide the badge.
          </div>
          <div style={{marginBottom:16,padding:12,background:"rgba(10,11,15,0.7)",border:"1px solid var(--border)",borderRadius:2}}>
            <div style={{fontSize:10,color:"var(--text-dim)",letterSpacing:2,textTransform:"uppercase",fontFamily:"'Inter',sans-serif",fontWeight:700,marginBottom:6}}>Quick Set</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {[0,1,2,3,4,5].map(n => (
                <button key={n} type="button" className={`btn btn-sm ${level===n?"btn-gold":"btn-outline"}`} onClick={()=>setLevel(n)}>{n}</button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Exact Awakening Level</label>
            <input className="input" type="number" min={0} value={level} onChange={e=>setLevel(Math.max(0,parseInt(e.target.value)||0))} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-gold" onClick={()=>onSave(level)}>Save Awakening</button>
        </div>
      </div>
    </div>
  );
}

// ─── ADJUST POWER MODAL ───────────────────────────────────────────────────────
function AdjustPowerModal({ member, onSave, onClose }) {
  const { t } = useLang();
  const [power, setPower] = useState(member.power);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title"><span style={{display:"inline-flex",alignItems:"center",gap:6}}><PowerIcon size={16} /> {t("adjustPowerTitle")} {member.name}</span></div>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{textAlign:"center",marginBottom:20,fontFamily:"'Spectral',serif",fontWeight:800,fontSize:24,color:"var(--gold-light)"}}>
            <span style={{display:"inline-flex",alignItems:"center",gap:6}}><PowerIcon size={20} />{t("currentPowerLabel")} {fmt(member.power)}</span>
          </div>
          <div style={{marginBottom:16,padding:12,background:"rgba(10,11,15,0.7)",border:"1px solid var(--border)",borderRadius:2}}>
            <div style={{fontSize:10,color:"var(--text-dim)",letterSpacing:2,textTransform:"uppercase",fontFamily:"'Inter',sans-serif",fontWeight:700,marginBottom:6}}>{t("quickAdjust")}</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {[-5000,-1000,-500,500,1000,5000].map(d => (
                <button key={d} type="button" className={`btn btn-sm ${d<0?"btn-red":"btn-outline"}`}
                  onClick={()=>setPower(p => Math.max(0,p+d))}>
                  {d>0?"+":""}{fmt(d)}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{t("setExactPower")}</label>
            <input className="input" type="number" min={0} value={power} onChange={e=>setPower(parseInt(e.target.value)||0)} />
          </div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"rgba(201,151,42,0.06)",border:"1px solid var(--border)",borderRadius:2}}>
            <span style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:"var(--text-dim)",fontWeight:600}}>{t("changeLabel")}</span>
            <span style={{fontFamily:"'Inter',sans-serif",fontSize:14,fontWeight:800,color:power>member.power?"#58d68d":power<member.power?"#e07070":"var(--text-dim)"}}>
              {power>member.power?"+":""}{fmt(power-member.power)}
            </span>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>{t("cancel")}</button>
          <button className="btn btn-gold" onClick={()=>onSave(power)}>{t("savePower")}</button>
        </div>
      </div>
    </div>
  );
}

// ─── LOOT ROULETTE ────────────────────────────────────────────────────────────
function LootRoulette({ ctx }) {
  const { members, addToast, currentUser } = ctx;
  const isAdmin = !!currentUser && (currentUser.role==="Elder"||currentUser.role==="Master");

  // attendees
  const [memberSearch, setMemberSearch] = useState("");
  const [presentMembers, setPresentMembers] = useState({});

  // loot list
  const [lootItems, setLootItems] = useState([]);
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState(1);

  // results
  const [distribution, setDistribution] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [spinAngle, setSpinAngle] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const spinRef = useRef();

  const presentIds = Object.entries(presentMembers).filter(([,v])=>v).map(([id])=>parseInt(id));
  const presentList = members.filter(m=>presentIds.includes(m.id));
  const totalLootQty = lootItems.reduce((s,i)=>s+i.qty, 0);

  function toggleMember(id) { setPresentMembers(p=>({...p,[id]:!p[id]})); }

  function addItem() {
    const name = newItemName.trim();
    if (!name) { addToast("Enter an item name.", "red", "Error"); return; }
    const qty = Math.max(1, parseInt(newItemQty)||1);
    setLootItems(p => {
      const existing = p.findIndex(i=>i.name.toLowerCase()===name.toLowerCase());
      if (existing>=0) return p.map((i,idx)=>idx===existing?{...i,qty:i.qty+qty}:i);
      return [...p, {id:Date.now(), name, qty}];
    });
    setNewItemName(""); setNewItemQty(1);
  }

  function removeItem(id) { setLootItems(p=>p.filter(i=>i.id!==id)); }
  function updateQty(id, qty) { if(qty<1) return; setLootItems(p=>p.map(i=>i.id===id?{...i,qty}:i)); }

  function distribute() {
    if (!lootItems.length) { addToast("Add at least one loot item.", "red", "Error"); return; }
    if (!presentList.length) { addToast("Select at least one member.", "red", "Error"); return; }
    setSpinning(true); setRevealed(false); setDistribution(null);

    // spin animation
    const totalSpin = 1440 + Math.random()*720;
    let start = null;
    const duration = 2800;
    function animate(ts) {
      if (!start) start = ts;
      const p = Math.min((ts-start)/duration, 1);
      const ease = 1-Math.pow(1-p,3);
      setSpinAngle(ease*totalSpin);
      if (p<1) { spinRef.current = requestAnimationFrame(animate); }
      else {
        setSpinning(false);
        // fair round-robin distribution on shuffled members
        const shuffled = [...presentList].sort(()=>Math.random()-0.5);
        const result = shuffled.map(m=>({member:m, items:[]}));
        // expand all items into individual units then deal round-robin
        const pool = [];
        lootItems.forEach(item=>{ for(let i=0;i<item.qty;i++) pool.push(item.name); });
        // shuffle pool too for variety
        pool.sort(()=>Math.random()-0.5);
        pool.forEach((name, idx)=>{ result[idx%result.length].items.push(name); });
        // sort result by original member order for display
        result.sort((a,b)=>members.indexOf(a.member)-members.indexOf(b.member));
        setDistribution(result);
        setTimeout(()=>setRevealed(true), 200);
      }
    }
    spinRef.current = requestAnimationFrame(animate);
  }

  function reset() { setDistribution(null); setRevealed(false); setSpinAngle(0); }

  useEffect(()=>{return()=>{ if(spinRef.current) cancelAnimationFrame(spinRef.current); };},[]);

  if (!isAdmin) return (
    <div className="card" style={{textAlign:"center",padding:56,color:"var(--text-dim)"}}>
      <div style={{marginBottom:14,display:"flex",justifyContent:"center"}}><LockIcon size={44}/></div>
      <div style={{fontFamily:"'Spectral',serif",fontWeight:800,fontSize:18,color:"var(--text)"}}>Admin Only</div>
      <div style={{marginTop:8,fontSize:13}}>Only Elders and Leaders can use Loot Roulette.</div>
    </div>
  );

  return (
    <div>
      {/* ── Header ── */}
      <div className="card card-red" style={{marginBottom:24,padding:"20px 24px"}}>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <div style={{width:52,height:52,borderRadius:6,
            background:"linear-gradient(135deg,#3d0000,var(--blood-light))",
            display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
            boxShadow:"0 0 24px rgba(168,50,40,0.55)"}}><SwordsIcon size={26} style={{color:"#fff"}}/></div>
          <div>
            <div style={{fontFamily:"'Spectral',serif",fontWeight:800,fontSize:20,color:"#ff9090",letterSpacing:1}}>Loot Roulette</div>
            <div style={{fontSize:12,color:"var(--text-dim)",marginTop:3}}>
              Select attendees · list the loot · press Distribute — done.
            </div>
          </div>
          {distribution && (
            <button className="btn btn-outline btn-sm" style={{marginLeft:"auto"}} onClick={reset}>↺ Reset</button>
          )}
        </div>
      </div>

      {!distribution && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>

          {/* ── Step 1: Attendees ── */}
          <div className="card">
            <SectionTitle>1 · Select Attendees</SectionTitle>
            <input className="input" placeholder="Search members…" value={memberSearch}
              onChange={e=>setMemberSearch(e.target.value)} style={{marginBottom:10}} />
            <div style={{display:"flex",gap:6,marginBottom:10,alignItems:"center"}}>
              <button className="btn btn-outline btn-sm"
                onClick={()=>setPresentMembers(Object.fromEntries(members.map(m=>[m.id,true])))}>All</button>
              <button className="btn btn-ghost btn-sm" onClick={()=>setPresentMembers({})}>None</button>
              <span style={{marginLeft:"auto",fontFamily:"'Inter',sans-serif",fontSize:11,
                color:"var(--gold)",fontWeight:700}}>{presentList.length} selected</span>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:360,overflowY:"auto"}}>
              {members.filter(m=>m.name.toLowerCase().includes(memberSearch.toLowerCase())).map(m=>(
                <div key={m.id} onClick={()=>toggleMember(m.id)}
                  style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",
                    borderRadius:4,cursor:"pointer",transition:"all 0.15s",
                    background:presentMembers[m.id]?"rgba(200,146,42,0.08)":"rgba(0,0,0,0.3)",
                    border:`1px solid ${presentMembers[m.id]?"rgba(200,146,42,0.35)":"rgba(200,146,42,0.08)"}`}}>
                  <input type="checkbox" checked={!!presentMembers[m.id]} onChange={()=>{}}
                    style={{accentColor:"var(--gold)",flexShrink:0,pointerEvents:"none"}} />
                  <ClassIcon cls={m.cls} size={30} />
                  <div style={{flex:1}}>
                    <div style={{fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:13,
                      color:presentMembers[m.id]?"var(--gold-light)":"var(--text)"}}>{m.name}</div>
                    <div style={{fontSize:9,color:"var(--text-dim)",letterSpacing:1,textTransform:"uppercase"}}>{m.cls}</div>
                  </div>
                  {presentMembers[m.id] && <span style={{width:8,height:8,borderRadius:"50%",background:"var(--gold)",boxShadow:"0 0 6px var(--gold)",flexShrink:0}}/>}
                </div>
              ))}
            </div>
          </div>

          {/* ── Step 2: Loot List ── */}
          <div className="card">
            <SectionTitle>2 · List the Loot</SectionTitle>

            {/* Add item row */}
            <div style={{display:"flex",gap:8,marginBottom:14}}>
              <input className="input" placeholder="Item name…" value={newItemName}
                onChange={e=>setNewItemName(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&addItem()}
                style={{flex:1}} />
              <input className="input" type="number" min={1} value={newItemQty}
                onChange={e=>setNewItemQty(parseInt(e.target.value)||1)}
                style={{width:64,textAlign:"center"}} />
              <button className="btn btn-gold" onClick={addItem} style={{flexShrink:0,padding:"9px 16px"}}>+</button>
            </div>

            {lootItems.length===0 && (
              <div style={{textAlign:"center",padding:"32px 0",color:"var(--text-dim)",
                fontFamily:"'Inter',sans-serif",fontSize:13}}>No loot added yet.<br/>
                <span style={{fontSize:11,opacity:0.6}}>Type an item name and press +</span>
              </div>
            )}

            <div style={{display:"flex",flexDirection:"column",gap:5,maxHeight:300,overflowY:"auto"}}>
              {lootItems.map(item=>(
                <div key={item.id} style={{display:"flex",alignItems:"center",gap:8,
                  padding:"9px 12px",borderRadius:4,
                  background:"rgba(168,50,40,0.07)",border:"1px solid rgba(200,80,80,0.15)"}}>
                  <div style={{flex:1,fontFamily:"'Inter',sans-serif",fontWeight:700,
                    fontSize:13,color:"var(--text-bright)"}}>{item.name}</div>
                  <button onClick={()=>updateQty(item.id,item.qty-1)}
                    className="btn btn-ghost btn-sm" style={{padding:"2px 8px",fontSize:14}}>−</button>
                  <span style={{fontFamily:"'Inter',sans-serif",fontWeight:800,fontSize:13,
                    color:"#ff9090",minWidth:24,textAlign:"center"}}>×{item.qty}</span>
                  <button onClick={()=>updateQty(item.id,item.qty+1)}
                    className="btn btn-ghost btn-sm" style={{padding:"2px 8px",fontSize:14}}>+</button>
                  <button onClick={()=>removeItem(item.id)}
                    className="btn btn-ghost btn-sm" style={{padding:"2px 6px",color:"#e07070",fontSize:13}}>✕</button>
                </div>
              ))}
            </div>

            {lootItems.length>0 && (
              <div style={{marginTop:12,padding:"8px 12px",borderRadius:4,
                background:"rgba(0,0,0,0.3)",border:"1px solid rgba(200,146,42,0.1)",
                display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:11,color:"var(--text-dim)",fontFamily:"'Inter',sans-serif"}}>
                  {lootItems.length} item types
                </span>
                <span style={{fontFamily:"'Inter',sans-serif",fontWeight:800,
                  color:"var(--gold)",fontSize:13}}>{totalLootQty} total pieces</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Roulette Wheel + Distribute button ── */}
      {!distribution && (
        <div className="card" style={{textAlign:"center",padding:"36px 24px",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:2,
            background:"linear-gradient(90deg,transparent,#e07070,transparent)"}} />

          {/* Wheel */}
          <div style={{position:"relative",display:"inline-block",marginBottom:28}}>
            <svg width="180" height="180" viewBox="0 0 180 180">
              {(presentList.length>0 ? presentList : [{name:"???",cls:"Berserker"}]).map((m,i,arr)=>{
                const sliceAngle = 360/arr.length;
                const startRad = (sliceAngle*i - 90)*Math.PI/180;
                const endRad   = (sliceAngle*(i+1) - 90)*Math.PI/180;
                const x1=90+82*Math.cos(startRad), y1=90+82*Math.sin(startRad);
                const x2=90+82*Math.cos(endRad),   y2=90+82*Math.sin(endRad);
                const midRad = (sliceAngle*i+sliceAngle/2-90)*Math.PI/180;
                const lx=90+56*Math.cos(midRad),   ly=90+56*Math.sin(midRad);
                const largeArc = sliceAngle>180?1:0;
                const colors=["#6b1414","#1c3a5c","#2d4a1c","#4a2d1c","#2d1c4a","#1c4a3c","#4a3d1c","#1c3d4a"];
                return (
                  <g key={i} style={{transform:`rotate(${spinAngle}deg)`,transformOrigin:"90px 90px",
                    transition:spinning?"none":"transform 0.1s"}}>
                    <path d={`M90,90 L${x1},${y1} A82,82 0 ${largeArc},1 ${x2},${y2} Z`}
                      fill={colors[i%colors.length]} stroke="rgba(200,146,42,0.25)" strokeWidth="1"/>
                    <text x={lx} y={ly} fill="rgba(240,220,180,0.9)" fontSize="7" fontWeight="bold"
                      textAnchor="middle" dominantBaseline="middle"
                      transform={`rotate(${sliceAngle*i+sliceAngle/2},${lx},${ly})`}
                      style={{fontFamily:"'Inter',sans-serif"}}>
                      {m.name.slice(0,9)}
                    </text>
                  </g>
                );
              })}
              <circle cx="90" cy="90" r="14" fill="#0a0706" stroke="rgba(200,146,42,0.5)" strokeWidth="2"/>
              <text x="90" y="90" fill="var(--gold)" fontSize="11" textAnchor="middle" dominantBaseline="middle">✦</text>
            </svg>
            {/* Pointer */}
            <div style={{position:"absolute",top:-10,left:"50%",transform:"translateX(-50%)",
              width:0,height:0,borderLeft:"9px solid transparent",borderRight:"9px solid transparent",
              borderTop:"22px solid var(--gold)",filter:"drop-shadow(0 0 8px rgba(200,146,42,0.9))"}} />
          </div>

          <div style={{marginBottom:20}}>
            <div style={{fontFamily:"'Inter',sans-serif",fontWeight:800,fontSize:17,
              color:"var(--gold-light)",marginBottom:6}}>Ready to Distribute</div>
            <div style={{fontSize:12,color:"var(--text-dim)"}}>
              <span style={{color:presentList.length?"var(--gold)":"#e07070",fontWeight:700}}>{presentList.length} warriors</span>
              {" · "}
              <span style={{color:totalLootQty?"var(--gold)":"#e07070",fontWeight:700}}>{totalLootQty} loot pieces</span>
              {presentList.length>0&&totalLootQty>0&&(
                <span style={{color:"var(--text-dim)"}}>{" · ~"}{Math.floor(totalLootQty/presentList.length)} per person</span>
              )}
            </div>
          </div>

          <button className="btn btn-gold"
            style={{padding:"15px 56px",fontSize:13,letterSpacing:3,justifyContent:"center",display:"flex",alignItems:"center",gap:8,
              boxShadow:spinning?"none":"0 0 36px rgba(200,146,42,0.45)",
              opacity:(spinning||!lootItems.length||!presentList.length)?0.5:1}}
            onClick={distribute}
            disabled={spinning||!lootItems.length||!presentList.length}>
            {spinning?<span style={{display:"inline-flex",alignItems:"center",gap:8}}><GearIcon size={14}/>Distributing…</span>:<span style={{display:"inline-flex",alignItems:"center",gap:8}}><SwordsIcon size={14}/>SPIN & DISTRIBUTE</span>}
          </button>

          {(!lootItems.length||!presentList.length)&&!spinning&&(
            <div style={{marginTop:12,fontSize:11,color:"var(--text-dim)"}}>
              {!presentList.length?"← Select attendees first.":"← Add loot items first."}
            </div>
          )}
        </div>
      )}

      {/* ── Distribution Results ── */}
      {distribution && revealed && (
        <div>
          {/* Summary banner */}
          <div className="card card-gold" style={{marginBottom:20,padding:"16px 22px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
              <div>
                <div style={{fontFamily:"'Inter',sans-serif",fontWeight:800,fontSize:16,
                  color:"var(--gold-light)",marginBottom:2,display:"flex",alignItems:"center",gap:6}}><SwordsIcon size={13}/>Distribution Complete</div>
                <div style={{fontSize:12,color:"var(--text-dim)"}}>
                  {totalLootQty} pieces distributed across {presentList.length} warriors
                </div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button className="btn btn-outline btn-sm" onClick={reset}>↺ New Distribution</button>
              </div>
            </div>
          </div>

          {/* Cards grid */}
          <div className="grid-3">
            {distribution.map((entry,i)=>{
              // group items by name for display
              const grouped = entry.items.reduce((acc,name)=>{acc[name]=(acc[name]||0)+1;return acc;},{});
              return (
                <div key={i} className="card" style={{
                  animation:`fadeInUp 0.35s ease ${i*0.06}s both`,
                  borderColor:entry.items.length?"rgba(200,146,42,0.3)":"rgba(200,146,42,0.08)"}}>
                  {/* Member header */}
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,
                    paddingBottom:10,borderBottom:"1px solid rgba(200,146,42,0.1)"}}>
                    <ClassIcon cls={entry.member.cls} size={38} />
                    <div style={{flex:1}}>
                      <div style={{fontFamily:"'Inter',sans-serif",fontWeight:800,fontSize:14,
                        color:"var(--gold-light)"}}>{entry.member.name}</div>
                      <div style={{fontSize:9,color:"var(--text-dim)",letterSpacing:1,
                        textTransform:"uppercase"}}>{entry.member.cls}</div>
                    </div>
                    <span className="badge badge-gold">{Object.keys(grouped).length} type{Object.keys(grouped).length!==1?"s":""}{entry.items.length>Object.keys(grouped).length?" ("+entry.items.length+" pcs)":""}</span>
                  </div>

                  {/* Items */}
                  {entry.items.length===0 ? (
                    <div style={{fontSize:11,color:"var(--text-dim)",textAlign:"center",
                      fontStyle:"italic",padding:"10px 0"}}>Nothing this round</div>
                  ) : (
                    <div style={{display:"flex",flexDirection:"column",gap:4}}>
                      {Object.entries(grouped).map(([name,qty],j)=>(
                        <div key={j} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                          padding:"6px 10px",borderRadius:3,
                          background:qty>1?"rgba(200,146,42,0.1)":"rgba(200,146,42,0.05)",
                          border:qty>1?"1px solid rgba(200,146,42,0.28)":"1px solid rgba(200,146,42,0.1)"}}>
                          <span style={{fontFamily:"'Inter',sans-serif",fontSize:12,
                            color:"var(--text-bright)",fontWeight:600}}>{name}</span>
                          <span style={{
                            fontFamily:"'Inter',sans-serif",fontSize:11,fontWeight:900,
                            color:qty>1?"var(--gold-light)":"rgba(180,150,100,0.55)",
                            letterSpacing:0.5,flexShrink:0,marginLeft:6
                          }}>×{qty}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Full text summary */}
          <div className="card" style={{marginTop:20,padding:0,overflow:"hidden"}}>
            <div style={{padding:"14px 20px",borderBottom:"1px solid rgba(200,146,42,0.12)"}}>
              <div style={{fontFamily:"'Inter',sans-serif",fontWeight:800,fontSize:14,color:"var(--gold-light)"}}>
                📋 Full Distribution Summary
              </div>
            </div>
            <div className="table-wrap">
              <table className="table-stack">
                <thead><tr><th>Warrior</th><th>Class</th><th>Items Received</th><th>Count</th></tr></thead>
                <tbody>
                  {distribution.map((entry,i)=>{
                    const grouped = entry.items.reduce((acc,name)=>{acc[name]=(acc[name]||0)+1;return acc;},{});
                    return (
                      <tr key={i}>
                        <td data-label="Warrior">
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <ClassIcon cls={entry.member.cls} size={28}/>
                            <span style={{fontFamily:"'Inter',sans-serif",fontWeight:700,color:"var(--text-bright)"}}>{entry.member.name}</span>
                          </div>
                        </td>
                        <td data-label="Class"><span className="badge badge-silver">{entry.member.cls}</span></td>
                        <td data-label="Items Received">
                          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                            {Object.entries(grouped).map(([name,qty],j)=>(
                              <span key={j} style={{fontFamily:"'Inter',sans-serif",fontSize:11,
                                color:"var(--text-bright)",background:qty>1?"rgba(200,146,42,0.12)":"rgba(200,146,42,0.07)",
                                border:qty>1?"1px solid rgba(200,146,42,0.3)":"1px solid rgba(200,146,42,0.15)",borderRadius:2,
                                padding:"2px 7px",fontWeight:600,display:"inline-flex",alignItems:"center",gap:4}}>
                                {name}
                                <span style={{color:qty>1?"var(--gold-light)":"rgba(180,150,100,0.5)",fontWeight:900,fontSize:10}}>×{qty}</span>
                              </span>
                            ))}
                            {entry.items.length===0&&<span style={{color:"var(--text-dim)",fontSize:11,fontStyle:"italic"}}>—</span>}
                          </div>
                        </td>
                        <td data-label="Count" style={{fontFamily:"'Inter',sans-serif",fontWeight:800,color:"var(--gold)"}}>{entry.items.length===0?"—":entry.items.length+" pc"+(entry.items.length!==1?"s":"")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
function AppInner({ onMusicTrackChange }) {
  const { t } = useLang();
  // ── Browser tab title + favicon ──────────────────────────────────────────────
  useEffect(() => {
    document.title = CLAN_NAME;
    // Set favicon to COINS_ICON
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = COINS_ICON;
  }, []);

  const [page, setPage] = useState("dashboard");
  // Lets ANY page (Leaderboard podium, Members list, etc.) trigger the
  // Player Info view for a given member, by id, without that page needing
  // to know about Members' own internal state.
  const [globalViewingProfile, setGlobalViewingProfile] = useState(null);
  // The content area checks globalViewingProfile BEFORE page, so once a
  // profile is open, regular nav clicks were updating `page` correctly in
  // the background but never actually showing it — globalViewingProfile
  // stayed set and kept overriding the view, with "Back to Members" being
  // the only way out. Routing all real navigation through this wrapper
  // (instead of calling setPage directly) clears the profile view first,
  // so clicking any nav item now correctly leaves the profile page.
  function navigateToPage(newPage) {
    setGlobalViewingProfile(null);
    setPage(newPage);
  }

  // Swap the body background image depending on which page is active —
  // same mechanism as the rest of the app's single full-bleed background,
  // just pointed at a different photo on the Auctions page. Doing it this
  // way (instead of a nested div) guarantees it always covers the full
  // viewport width with zero seams, since it's the same element/rule that
  // already paints Clan HQ's background everywhere else.
  useEffect(() => {
    // !globalViewingProfile on both — PlayerInfo can render on top of ANY
    // underlying page (page itself doesn't change when a profile opens),
    // so without this guard bg-auctions could stay active behind the
    // profile view too. bg-leaderboard already had this guard; bg-auctions
    // was missing it.
    document.body.classList.toggle("bg-auctions", page === "auctions" && !globalViewingProfile);
    document.body.classList.toggle("bg-leaderboard", page === "leaderboard" && !globalViewingProfile);
  }, [page, globalViewingProfile]);

  const [members, setMembersRaw] = useState(SEED_MEMBERS);
  const [auctions, setAuctionsRaw] = useState(SEED_AUCTIONS);
  const [attendanceLogs, setAttendanceLogsRaw] = useState([]);
  const [loggedIn, setLoggedIn] = useState(false);
  // Lets a non-member browse a trimmed, read-only slice of the site
  // (Dashboard/Auctions/Leaderboard, no financial detail, no write
  // actions) without logging in — see the login gate below. Deliberately
  // NOT persisted to localStorage the way cf_user_id is for real logins:
  // a refresh should land back on the real login screen, not silently
  // re-enter guest mode. currentUser stays null for guests rather than a
  // synthesized fake member object, so any place that forgets to guard
  // against a null currentUser crashes loudly during testing instead of
  // silently sending a bad write to Supabase.
  const [isGuest, setIsGuest] = useState(false);
  // Lets a public ?guest=1 link drop a visitor straight into guest mode
  // without them needing to find/click the "Continue as Guest" link —
  // never overrides an already-logged-in session.
  useEffect(() => {
    if (!loggedIn && new URLSearchParams(window.location.search).get("guest") === "1") {
      setIsGuest(true);
    }
  }, []);
  // Set once on login to {since, until} — the window the post-login
  // "what's new" popup summarizes over. null means no popup should show
  // (e.g. first-ever login, or already dismissed this session).
  const [loginSummaryWindow, setLoginSummaryWindow] = useState(null);
  // Set when the 3s auction poll detects the current user just got
  // outbid while actively on the site — separate from the existing
  // browser push notification (which fires even when the tab isn't
  // open/focused). This is the in-app version: a popup with a direct
  // "go bid" link, shown only while they're already here to act on it.
  const [outbidPopup, setOutbidPopup] = useState(null);
  // ── Background music: tell the persistent <BackgroundMusic> player (mounted
  // in App, above AppInner, so it survives login/logout) which track — if
  // any — should be playing for the current screen.
  useEffect(() => {
    if (!onMusicTrackChange) return;
    if (!loggedIn && !isGuest) onMusicTrackChange("login");
    else if (page === "leaderboard") onMusicTrackChange("leaderboard");
    else onMusicTrackChange(null);
  }, [loggedIn, isGuest, page, onMusicTrackChange]);
  const [showEntrance, setShowEntrance] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  // Mirrors currentUser into a ref so callbacks captured once (e.g. the
  // 3s auction poll below, which intentionally has an empty dependency
  // array so its interval timer isn't torn down and recreated on every
  // login/logout) can still read the LATEST currentUser instead of being
  // stuck with whatever it was when that effect first ran.
  const currentUserRef = useRef(null);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);
  const [toasts, setToasts] = useState([]);
  const [coinBursts, setCoinBursts] = useState([]);
  function fireCoinBurst(x, y) {
    const id = Date.now()+Math.random();
    setCoinBursts(b => [...b, {id, x, y}]);
    // Each burst animates for ~1.1s; clean it up after so the DOM doesn't
    // accumulate stale burst containers during a busy auction session.
    setTimeout(() => setCoinBursts(b => b.filter(c => c.id !== id)), 1200);
  }
  const [balancePopups, setBalancePopups] = useState([]);
  function fireBalancePopup(x, y, amount) {
    const id = Date.now()+Math.random();
    setBalancePopups(b => [...b, {id, x, y, amount}]);
    // Matches the 2.2s lift-and-fade animation duration with a little headroom.
    setTimeout(() => setBalancePopups(b => b.filter(c => c.id !== id)), 2400);
  }
  const [modal, setModal] = useState(null);
  const [tick, setTick] = useState(0);
  const [imageLibrary, addImage] = useImageLibrary();
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [lootResults, setLootResults] = useState([]);
  // Bumped whenever EVENTS' coin values are updated (loaded from Storage,
  // or edited live in Settings) — EVENTS itself is a plain mutated object,
  // not React state, so nothing would normally tell already-mounted
  // components to re-render and show the new numbers without this.
  const [eventsVersion, setEventsVersion] = useState(0);
  // Weekly coin decay rate (e.g. 0.05 = 5%) — loaded from app_state below,
  // defaulting to the existing 5% if nothing's been saved yet. Editable in
  // Settings; the server-side cron job (api/check-weekly-decay.js) reads
  // its own copy from the same app_state row, since that file runs
  // independently and can't share React state with this one.
  const [decayRate, setDecayRate] = useState(0.05);
  // Major Events / ISB Veteran / Sindri Veteran bonus amounts + thresholds
  // — loaded from app_state below (key "bonus_config"), defaulting to
  // DEFAULT_BONUS_CONFIG if nothing's been saved yet. Editable in Settings
  // (BonusConfigEditor); performAttendancePayout (awarding) and
  // Attendance's computeBonuses (progress display) both read from this
  // same state so they can never drift out of sync with each other.
  const [bonusConfig, setBonusConfig] = useState(DEFAULT_BONUS_CONFIG);
  // Admin-authored announcements shown at the top of the login summary
  // popup (e.g. "an item is up for auction") — stored in app_state under
  // key "login_announcements" (plural — this used to be a single object
  // under "login_announcement", but multiple announcements need to be
  // able to coexist: a manually-written one from Settings AND one or
  // more auction "put in news" posts, all visible at once, each
  // independently dismissible). Each entry: {id, text, postedAt}.
  const [loginAnnouncements, setLoginAnnouncements] = useState([]);
  // Weekly decay's clan-wide summary ("X% decay applied to all N members").
  // Stored in app_state under "decay_announcements" (an array, capped
  // server-side) instead of being appended to one arbitrary member's own
  // tx_log — writing it into an individual's personal history made that
  // member's own coins look wildly wrong against their My Points History
  // (see check-weekly-decay.js), since the combined total has nothing to
  // do with their own balance. Each entry: {date, ts, ratePct, memberCount, totalDecayed}.
  const [decayAnnouncements, setDecayAnnouncements] = useState([]);
  // The one auction (if any) currently pulled out of the regular grid and
  // shown in its own spotlight banner at the top of the Auction House.
  // Stored in app_state under "featured_auction_id" (a single id, not an
  // array — only one auction can be featured at a time; setting a new one
  // replaces the old one rather than appending, unlike loginAnnouncements).
  const [featuredAuctionId, setFeaturedAuctionId] = useState(null);

  // ── Load all data from Supabase on mount ──────────────────────────────────
  useEffect(() => {
    async function loadAll() {
    try {
      const [mRows, aRows, lRows, cRows, rRows, evRows, asRows] = await Promise.all([
        dbLoad("members", MEMBER_ALL_COLS_NO_PASSWORD),
        // Deliberately NOT ",image_data" here — this fetches EVERY auction
        // row ever created (all-time history, no status/date filter), and
        // image_data can be a large base64 blob on older pre-bucket-storage
        // rows. Pulling that for the entire table on every single app load
        // is exactly the "large enough to cause DB statement timeouts"
        // scenario documented at AUCTION_LIST_COLS above — the real source
        // of the lag/crash reports, not just the ended-history buildup.
        // AuctionImage already lazily fetches image_data per-item on demand
        // (see its comment) and caches it in _auctionImageCache, so nothing
        // here needs it eagerly.
        dbLoad("auctions", AUCTION_LIST_COLS),
        dbLoad("attendance_logs"),
        dbLoad("coin_requests"),
        dbLoad("loot_results"),
        dbLoad("event_coin_values"),
        dbLoad("app_state"),
      ]);
      if (Array.isArray(mRows) && mRows.length > 0) {
        const safeJson = (v) => {
          if (Array.isArray(v)) return v;
          if (typeof v === "string") { try { return JSON.parse(v); } catch { return []; } }
          return [];
        };
        setMembersRaw(mRows.map(r => ({
          ...r,
          // ROOT CAUSE FIX: Supabase's `id` column is text, so it always
          // comes back as a string (e.g. "1"). Every other part of the app
          // (checkbox selection state, the `present` array built from
          // parseInt(id) in submitAttendance, role-change handlers, etc.)
          // works with NUMERIC ids. Without this conversion, comparisons
          // like `present.includes(m.id)` silently fail (1 !== "1"), so a
          // member could be checked, submitted, and the History row would
          // save correctly — but that member's own coins/attendance would
          // never update, with no error at all, since the code correctly
          // (from its own perspective) decided they weren't in `present`.
          id:          Number(r.id),
          coins:       Number(r.coins)       || 0,
          power:       Number(r.power)       || 0,
          attendance:  Number(r.attendance)  || 0,
          auctionWins: Number(r.auction_wins ?? r.auctionWins) || 0,
          joinDate:    r.join_date || r.joinDate || "",
          decayLog:    safeJson(r.decay_log),
          txLog:       safeJson(r.tx_log),
          attendLog:   safeJson(r.attend_log),
          powerLog:    safeJson(r.power_log),
          profileRarity: r.profile_rarity || "uncommon",
          awakeningLevel: Number(r.awakening_level) || 0,
          lastLoginTs: Number(r.last_login_ts) || 0,
        })));
      } else if (Array.isArray(mRows) && mRows.length === 0) {
        // Table genuinely empty (confirmed by a successful query) — safe to seed.
        // Guard against many concurrent users all seeding at once: only
        // one tab seeds (localStorage flag), others just proceed with
        // SEED_MEMBERS in memory and pick it up on next poll/refresh.
        const seedFlag = "cf_seed_in_progress";
        if (!localStorage.getItem(seedFlag)) {
          localStorage.setItem(seedFlag, "1");
          // password set via the dedicated RPC below, not in this upsert
          // payload -- see set_member_password.sql for why including it
          // here would 401 the whole seed write.
          await Promise.all(SEED_MEMBERS.map(m => dbUpsert("members", {
            id: String(m.id), name: m.name, username: m.username,
            role: m.role, cls: m.cls, power: m.power, coins: m.coins,
            attendance: m.attendance, join_date: m.joinDate, auction_wins: m.auctionWins,
            decay_log: "[]", tx_log: "[]", attend_log: "[]", discord: m.discord || "",
          })));
          await Promise.all(SEED_MEMBERS.map(m => setMemberPasswordAtomic(String(m.id), m.password)));
        }
      } else {
        // mRows is null: the request failed/errored (e.g. Supabase project
        // paused or unreachable). Do NOT seed — that would risk overwriting
        // real data once the connection comes back. Surface a connection
        // error instead of silently showing empty/default state.
        setDbError(true);
        return;
      }
      if (Array.isArray(aRows) && aRows.length > 0) {
        setAuctionsRaw(aRows.map(r => ({
          id:          String(r.id),
          name:        r.name ?? "",
          desc:        r.description ?? "",
          description: r.description ?? "",
          rarity:      r.rarity ?? "epic",
          status:      r.status ?? "active",
          endsAt:      Number(r.ends_at)    || 0,
          startedAt:   Number(r.started_at) || 0,
          currentBid:  Number(r.current_bid) || 0,
          minBid:      Number(r.min_bid)    || 0,
          startBid:    Number(r.min_bid)    || 0,
          topBidder:   r.top_bidder ?? null,
          bids:        (() => { try { const b = typeof r.bids === "string" ? JSON.parse(r.bids) : (Array.isArray(r.bids) ? r.bids : []); return b || []; } catch { return []; } })(),
          // dataUrl is intentionally not eager here — AuctionImage fetches
          // and caches it on demand per-item (see loadAll's dbLoad above).
          image:       r.image_name ? { dataUrl: _auctionImageCache.get(String(r.id)) || null, name: r.image_name } : null,
        })));
      } else if (aRows === null) {
        // Auctions fetch failed/errored (network blip, etc). Don't block
        // the whole app over this — just log it and show an empty auction
        // house. The 3s poll will retry.
        console.warn("auctions failed to load (will retry via poll):", aRows);
      }
      // If table is empty, nothing is seeded (SEED_AUCTIONS is empty by design)
      if (Array.isArray(lRows) && lRows.length > 0) {
        setAttendanceLogsRaw(lRows.map(r => ({
          ...r,
          recordedBy: r.recorded_by || r.recordedBy || "",
          members:    Number(r.members) || 0,
          ts:         Number(r.ts) || (Number(r.id) > 1e11 ? Number(r.id) : null) || null,
          attendees:  (() => { try { return typeof r.attendees === "string" ? JSON.parse(r.attendees) : (r.attendees || []); } catch { return []; } })(),
        })));
      }
      if (Array.isArray(cRows) && cRows.length > 0) setPendingCoinRequests(cRows.map(r => ({
        ...r,
        memberId: r.member_id ?? r.memberId,
        memberName: r.member_name ?? r.memberName,
        requestedBy: r.requested_by ?? r.requestedBy,
        requestedAt: r.requested_at ?? r.requestedAt,
      })));
      if (Array.isArray(rRows) && rRows.length > 0) {
        setLootResults(rRows.map(r => ({
          id: r.id,
          timestamp: Number(r.timestamp) || 0,
          date: r.date || "",
          eventLabel: r.event_label || "Loot Distribution",
          results: (() => { try { return typeof r.results === "string" ? JSON.parse(r.results) : (r.results || []); } catch { return []; } })(),
        })).filter(r => Date.now() - r.timestamp < 7*24*60*60*1000).sort((a,b)=>b.timestamp-a.timestamp));
      }
      // Apply saved event coin value overrides directly onto the shared
      // EVENTS array's objects. EVENTS is a module-level constant used by
      // many components (Attendance's event picker, the real payout math
      // in performAttendancePayout, the Settings table, the Dashboard
      // event-points widget) — mutating the existing objects' `coins`
      // field in place means every one of those call sites sees the
      // updated value automatically, since EVENTS.find(...) always
      // returns the same shared object reference rather than a copy.
      // Reassigning EVENTS itself isn't possible (const) and isn't
      // needed — only the numbers inside need to change.
      if (Array.isArray(evRows) && evRows.length > 0) {
        evRows.forEach(row => {
          const ev = EVENTS.find(e => e.id === row.id);
          if (ev && Number.isFinite(Number(row.coins))) ev.coins = Number(row.coins);
        });
        setEventsVersion(v => v + 1); // force a re-render so already-mounted components show the new numbers
      }
      if (Array.isArray(asRows) && asRows.length > 0) {
        const rateRow = asRows.find(r => r.key === "decay_rate");
        const parsedRate = rateRow ? parseFloat(rateRow.value) : NaN;
        if (Number.isFinite(parsedRate) && parsedRate >= 0) setDecayRate(parsedRate);
        const bonusConfigRow = asRows.find(r => r.key === "bonus_config");
        if (bonusConfigRow) {
          try {
            const parsed = JSON.parse(bonusConfigRow.value);
            // Merge over the defaults rather than replacing outright, so an
            // older saved row (before a new field existed) still gets a
            // sane value for that field instead of undefined/NaN.
            setBonusConfig(prev => ({ ...prev, ...parsed }));
          } catch {}
        }
        const announcementsRow = asRows.find(r => r.key === "login_announcements");
        if (announcementsRow) {
          try {
            const parsed = JSON.parse(announcementsRow.value);
            setLoginAnnouncements(Array.isArray(parsed) ? parsed : []);
          } catch {}
        } else {
          // Migration: an older session may have left a single-object
          // value under the old "login_announcement" key (singular) —
          // pick it up once and treat it as a one-item array, rather than
          // silently losing whatever was already posted there.
          const oldRow = asRows.find(r => r.key === "login_announcement");
          if (oldRow) {
            try {
              const old = JSON.parse(oldRow.value);
              if (old && old.text) setLoginAnnouncements([old]);
            } catch {}
          }
        }
        const featuredRow = asRows.find(r => r.key === "featured_auction_id");
        if (featuredRow && featuredRow.value) setFeaturedAuctionId(featuredRow.value);
        const decayAnnRow = asRows.find(r => r.key === "decay_announcements");
        if (decayAnnRow) {
          try {
            const parsed = JSON.parse(decayAnnRow.value);
            setDecayAnnouncements(Array.isArray(parsed) ? parsed : []);
          } catch {}
        }
      }
      // ── Restore session from localStorage ───────────────────────────────
      const savedId = localStorage.getItem("cf_user_id");
      if (savedId) {
        const allMembers = Array.isArray(mRows) && mRows.length > 0 ? mRows : SEED_MEMBERS;
        const found = allMembers.find(m => String(m.id) === String(savedId));
        if (found) {
          const parseLog = (v) => { if (Array.isArray(v)) return v; if (typeof v === "string") { try { return JSON.parse(v); } catch {} } return []; };
          setCurrentUser({
            ...found,
            coins: Number(found.coins) || 0,
            power: Number(found.power) || 0,
            attendance: Number(found.attendance) || 0,
            auctionWins: Number(found.auction_wins ?? found.auctionWins) || 0,
            joinDate: found.join_date || found.joinDate || "",
            decayLog: parseLog(found.decay_log),
            txLog: parseLog(found.tx_log),
            attendLog: parseLog(found.attend_log),
            powerLog: parseLog(found.power_log),
            profileRarity: found.profile_rarity || "uncommon",
            awakeningLevel: Number(found.awakening_level) || 0,
            lastLoginTs: Date.now(),
          });
          setLoggedIn(true);
          // Always show the popup on every page open (including a plain
          // refresh) — per direct request, this isn't trying to detect
          // "genuinely new sessions" anymore, it just always checks what
          // changed since the last time this ran and shows something
          // either way (see getLoginSummary's hasAnything flag for the
          // "nothing changed" case).
          const previousLoginTs = Number(found.last_login_ts) || 0;
          setLoginSummaryWindow({ since: previousLoginTs, until: Date.now() });
          setMembers(ms => ms.map(x => String(x.id)===String(savedId) ? {...x, lastLoginTs: Date.now()} : x));
        }
      }
    } catch (e) {
      // Even if something unexpected blew up, never leave the user
      // stuck on the loading screen.
      console.error("loadAll failed:", e);
    } finally {
      setDbReady(true);
    }
    }
    loadAll();
  }, [retryCount]);

  // ── Wrapped setters that also sync to Supabase ────────────────────────────
  // skipCoinsWrite: when true, this write omits `coins` from the dbUpsert
  // payload entirely. Needed by callers (like placeBid) that already
  // applied a coin change atomically via adjustMemberCoinsAtomic — without
  // this, setMembers's own dbUpsert would immediately overwrite that atomic
  // change with a locally-computed value that may already be stale by the
  // time this write lands, silently undoing the race-condition fix.
  function setMembers(updater, skipCoinsWrite=false) {
    setMembersRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      next.forEach(m => {
        const row = {
          // password deliberately NOT included here -- see set_member_password.sql:
          // PostgreSQL's ON CONFLICT DO UPDATE (what this upsert becomes)
          // requires SELECT on any column it SETs, which anon no longer
          // has for password. Every write through this function used to
          // send whatever this browser's local copy of m.password
          // happened to be (usually undefined anyway, dropped by
          // JSON.stringify, since password isn't loaded client-side
          // anymore either) -- including it here at all would 401 the
          // ENTIRE row's write the moment it was ever a real value.
          // Password changes go through setMemberPasswordAtomic instead.
          id: String(m.id), name: m.name, username: m.username,
          role: m.role, cls: m.cls, power: m.power,
          attendance: m.attendance, join_date: m.joinDate || m.join_date,
          auction_wins: m.auctionWins,
          decay_log: JSON.stringify(m.decayLog || []),
          tx_log: JSON.stringify(m.txLog || []),
          attend_log: JSON.stringify(m.attendLog || []),
          power_log: JSON.stringify(m.powerLog || []),
          profile_rarity: m.profileRarity || "uncommon",
          awakening_level: m.awakeningLevel || 0,
          last_login_ts: m.lastLoginTs || 0,
          discord: m.discord || "",
        };
        if (!skipCoinsWrite) row.coins = m.coins;
        dbUpsert("members", row);
      });
      return next;
    });
  }

  const deletedAuctionIds = useRef(new Set());
  const endedAuctionIds = useRef(new Set());
  // Safety net for winners' coin deduction silently never landing (see
  // claimAuctionWin/incrementAuctionWinAtomic comments) — even with
  // retries there, a sustained outage could still exhaust them, and once
  // an auction is "ended" nothing else ever revisits it. Re-attempting
  // claimAuctionWinAndLog is always safe to repeat (a genuinely-already-
  // claimed auction just gets rejected via the auction_win_claims 409), so
  // the 3s poll below opportunistically retries any recently-ended auction
  // this browser session hasn't already tried, catching failures that
  // happened in a completely different session. Per-session only (not
  // persisted) — harmless, since a later session tries again anyway, and
  // avoids hammering every ended auction on every single poll tick forever.
  const reconciledWinClaims = useRef(new Set());
  const deletedAttendanceIds = useRef(new Set());
  // Tracks topBidder as last CONFIRMED by a DB poll read, per auction id —
  // deliberately separate from the `auctions` React state, which placeBid
  // updates optimistically (see setAuctions call in placeBid) the instant a
  // bid succeeds, before the next poll has actually re-read the row. The
  // outbid-detection check below used to compare against that optimistic
  // state directly, so if a poll landed between the optimistic update and
  // the DB catching up with it (any lag — replication, RPC latency, etc.),
  // it would see "was me a moment ago, now isn't" and fire a false outbid
  // popup on the bidder's OWN first bid. Comparing against this
  // poll-confirmed-only map instead means the check can only ever "turn on"
  // once a poll has actually verified the DB shows you as top bidder — so
  // an outbid can only be flagged once your own win was for-real confirmed.
  const confirmedTopBidders = useRef(new Map());

  function setAuctions(updater) {
    setAuctionsRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const safe = next.filter(a => !deletedAuctionIds.current.has(a.id));
      const prevById = new Map(prev.map(a => [String(a.id), a]));
      safe.forEach(a => {
        const prevAuction = prevById.get(String(a.id));
        // ROOT CAUSE of "can't add auctions past a certain count, no error
        // shown": every call to setAuctions rewrote EVERY auction in the
        // array to the database, not just the one that actually changed —
        // createAuction's `[...prev, a]` and placeBid's `.map(x => x.id
        // === id ? {...x} : x)` both preserve object identity for
        // untouched auctions, so adding ONE new auction with N existing
        // ones queued up N+1 concurrent writes instead of 1. That burst
        // scaled with the total auction count, and against this project's
        // small (nano-tier) database — already shown elsewhere to throw
        // real errors under load — a big enough burst could make ANY one
        // of those N+1 writes fail, including the new auction itself,
        // while N others succeeded fine and masked it. Skipping the write
        // entirely when the object reference hasn't changed means a
        // single new/updated auction now writes exactly once, regardless
        // of how many other auctions already exist.
        if (a === prevAuction) return;
        const imageData = a.image?.dataUrl || _auctionImageCache.get(String(a.id)) || undefined;
        // Whenever the end time changes (a brand-new auction, or an
        // existing one extended by snipe protection), reset the
        // "ending soon" notification flag so the cron check can fire
        // again for the new deadline — otherwise an extended auction
        // would silently never re-notify its bidder.
        const endsAtChanged = !prevAuction || prevAuction.endsAt !== a.endsAt;
        const row = {
          id:          String(a.id),
          name:        a.name ?? "",
          description: a.description ?? a.desc ?? "",
          rarity:      a.rarity ?? "epic",
          status:      a.status ?? "active",
          ends_at:     a.endsAt ?? 0,
          started_at:  a.startedAt ?? Date.now(),
          current_bid: a.currentBid ?? a.startBid ?? 0,
          top_bidder:  a.topBidder ?? null,
          min_bid:     a.minBid ?? a.startBid ?? 0,
          image_name:  a.image?.name ?? null,
          // `bids` is a genuine jsonb array column (see place_bid_atomic) —
          // dbUpsert already JSON.stringifies the whole `row` object once
          // when building the HTTP body, exactly like every other field
          // here. Stringifying this value AGAIN would double-encode it
          // into a jsonb STRING scalar (e.g. "[]") instead of a real jsonb
          // ARRAY, breaking place_bid_atomic's `bids || jsonb_build_array(...)`
          // concatenation for any row that goes through this write path.
          bids:        a.bids ?? [],
        };
        if (endsAtChanged) row.ending_soon_notified = false;
        // Only write image_data if we actually have it — never overwrite DB with null
        if (imageData) row.image_data = imageData;
        // ROOT CAUSE of "a new auction appears then immediately disappears":
        // this used to be a fire-and-forget dbUpsert with no retry and no
        // failure feedback — same class of bug already fixed for
        // attendance_logs below. If this write failed (a network blip, or
        // a slow/erroring database), the new auction never actually landed
        // in Postgres, and the very next 3s poll overwrote local state with
        // the DB's (auction-less) truth, silently wiping it with zero
        // indication anything went wrong. Now retries a couple times and
        // tells whoever's admin panel this is if it still doesn't stick.
        const isNewAuction = !prevAuction;
        dbUpsertReliable("auctions", row).then(ok => {
          if (!ok && isNewAuction) addToast(<span style={{display:"inline-flex",alignItems:"center",gap:6}}><WarningIcon size={13}/>"{row.name}" failed to save to the shared auction list — please try adding it again.</span>, "red", "Save Failed");
        });
      });
      return safe;
    });
  }

  function setAttendanceLogs(updater) {
    setAttendanceLogsRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      // Compare by stringified id — local entries are created with a numeric
      // Date.now() id, while rows that have round-tripped through Supabase
      // come back with a string id. Without normalizing, a freshly-submitted
      // local entry and its own DB row would never be recognized as "the
      // same" entry, since `Set.has` never coerces types.
      const prevIds = new Set(prev.map(l => String(l.id)));
      const nextIds = new Set(next.map(l => String(l.id)));
      const newEntries = next.filter(l => !prevIds.has(String(l.id)));
      newEntries.forEach(l => {
        const row = {
          // ROOT CAUSE FIX: every other table (auctions, loot_results,
          // bid_events) stringifies its Date.now()-based id before writing —
          // this was the only one sending a raw number. Left as a number,
          // it round-trips back from Supabase as a string (the column is
          // text, like its siblings), so a strict `Set.has(id)` comparison
          // in the poll-merge below would never match the local numeric id
          // against the DB's string id, and the freshly-submitted row could
          // fail to reconcile correctly for other clients reading it back.
          id:          String(l.id),
          event:       l.event,
          date:        l.date,
          ts:          l.ts || (Number(l.id) > 1e11 ? Number(l.id) : null) || null,
          members:     l.members || 0,
          recorded_by: l.recordedBy || "",
          attendees:   JSON.stringify(l.attendees || []),
        };
        // This write directly controls coin payouts, so a failure here can't
        // be allowed to disappear silently — retry a few times, and if it
        // still fails, tell the recorder directly so they know to re-submit
        // rather than discovering it's missing days later.
        dbUpsertReliable("attendance_logs", row).then(ok => {
          if (!ok) addToast(<span style={{display:"inline-flex",alignItems:"center",gap:6}}><WarningIcon size={13}/>"{l.event}" attendance failed to save to the shared log — please re-submit it.</span>, "red", "Save Failed");
        });
      });
      // Anything that was present before but isn't in `next` was deleted
      // (e.g. Master removing an attendance record) — propagate the delete
      // to the DB and remember the id so a lagging poll can't bring it back.
      // ROOT CAUSE FIX: this used to fire dbDelete and ignore its result —
      // every other client's poll just reads from the DB, so if the actual
      // DELETE request failed (RLS, network blip, schema mismatch) nobody
      // would ever know: the row vanished from the Master's own optimistic
      // local state, but never actually left the database, so it reappeared
      // for everyone else on their next poll. Now we retry and warn if it
      // ultimately doesn't succeed, the same way the upsert side already does.
      const removedEntries = prev.filter(l => !nextIds.has(String(l.id)));
      removedEntries.forEach(l => {
        const id = l.id;
        deletedAttendanceIds.current.add(id);
        dbDeleteReliable("attendance_logs", { id }).then(ok => {
          if (!ok) {
            addToast(
              <span style={{display:"inline-flex",alignItems:"center",gap:6}}><WarningIcon size={13}/>"{l.event}" couldn't be removed from the shared log — it may reappear for other members. Try removing it again.</span>,
              "red", "Delete Failed"
            );
          }
        });
      });
      return next;
    });
  }

  useEffect(() => { const iv = setInterval(() => setTick(t=>t+1), 1000); return () => clearInterval(iv); }, []);
  // TWO-TIER MEMBERS POLL — replaces the old single `select=*` every 5s
  // that was the root cause of the egress overage (re-downloading every
  // member's entire log history every 5 seconds, for every open tab).
  //
  // Fast poll (5s): only the small fields that genuinely need to stay
  // live — coins, power, role, etc. Does NOT include the four large log
  // arrays (attend_log, tx_log, decay_log, power_log) which barely change
  // minute-to-minute and were responsible for the bulk of the data usage.
  //
  // Slow poll (60s): full select=* including all log arrays, for the
  // union-merge logic that catches anything that might have drifted.
  // Still correct, just not done wastefully on every 5-second tick.
  useJitteredInterval(async () => {
      const lRows = await dbLoad("attendance_logs");
      const mRows = await dbLoad("members", MEMBER_LIVE_COLS);
      if (Array.isArray(lRows) && lRows.length > 0) {
        const fromDb = lRows.map(r => ({
          ...r,
          recordedBy: r.recorded_by || r.recordedBy || "",
          members:    Number(r.members) || 0,
          ts:         Number(r.ts) || (Number(r.id) > 1e11 ? Number(r.id) : null) || null,
          attendees:  (() => { try { return typeof r.attendees === "string" ? JSON.parse(r.attendees) : (r.attendees || []); } catch { return []; } })(),
        }));
        setAttendanceLogsRaw(prev => {
          const dbIds = new Set(fromDb.map(l => String(l.id)));
          const localOnly = prev.filter(l => !dbIds.has(String(l.id)) && !deletedAttendanceIds.current.has(l.id));
          return [...fromDb, ...localOnly].sort((a,b) => (b.ts||0) - (a.ts||0) || new Date(b.date) - new Date(a.date));
        });
      }
      if (!Array.isArray(mRows) || mRows.length === 0) return;
      const safeJson = (v) => {
        if (Array.isArray(v)) return v;
        if (typeof v === "string") { try { return JSON.parse(v); } catch { return []; } }
        return [];
      };
      setMembersRaw(prev => {
        const incoming = mRows.map(r => ({
          ...r,
          id:          Number(r.id),
          coins:       Number(r.coins)       || 0,
          power:       Number(r.power)       || 0,
          attendance:  Number(r.attendance)  || 0,
          auctionWins: Number(r.auction_wins ?? r.auctionWins) || 0,
          joinDate:    r.join_date || r.joinDate || "",
          profileRarity: r.profile_rarity || "uncommon",
          awakeningLevel: Number(r.awakening_level) || 0,
          lastLoginTs: Number(r.last_login_ts) || 0,
        }));
        // Fast poll only updates the live fields — never touches the log
        // arrays, since those aren't included in MEMBER_LIVE_COLS. This
        // preserves any locally-pending log writes that haven't yet
        // round-tripped back from the database.
        return incoming.map(dbM => {
          const local = prev.find(m => m.id === dbM.id);
          if (!local) return dbM;
          return {
            ...local,
            coins:         dbM.coins,
            auctionWins:   dbM.auctionWins,
            power:         dbM.power,
            attendance:    dbM.attendance,
            profileRarity: dbM.profileRarity,
            awakeningLevel: dbM.awakeningLevel,
            lastLoginTs:   Math.max(dbM.lastLoginTs || 0, local.lastLoginTs || 0),
            role:          dbM.role,
            cls:           dbM.cls,
            discord:       dbM.discord,
          };
        });
      });
  }, 5000, 1500, []);

  // Slow poll: full member data including all log arrays, for the
  // union-merge logic. 60s interval dramatically reduces egress from
  // the log arrays while still keeping history synced across tabs.
  useJitteredInterval(async () => {
      const mRows = await dbLoad("members", MEMBER_ALL_COLS_NO_PASSWORD);
      if (!Array.isArray(mRows) || mRows.length === 0) return;
      const safeJson = (v) => {
        if (Array.isArray(v)) return v;
        if (typeof v === "string") { try { return JSON.parse(v); } catch { return []; } }
        return [];
      };
      setMembersRaw(prev => {
        const incoming = mRows.map(r => ({
          ...r,
          id:          Number(r.id),
          coins:       Number(r.coins)       || 0,
          power:       Number(r.power)       || 0,
          attendance:  Number(r.attendance)  || 0,
          auctionWins: Number(r.auction_wins ?? r.auctionWins) || 0,
          joinDate:    r.join_date || r.joinDate || "",
          decayLog:    safeJson(r.decay_log),
          txLog:       safeJson(r.tx_log),
          attendLog:   safeJson(r.attend_log),
          powerLog:    safeJson(r.power_log),
          profileRarity: r.profile_rarity || "uncommon",
          awakeningLevel: Number(r.awakening_level) || 0,
          lastLoginTs: Number(r.last_login_ts) || 0,
        }));
        return incoming.map(dbM => {
          const local = prev.find(m => m.id === dbM.id);
          if (!local) return dbM;
          function unionLogs(dbLog, localLog) {
            const key = (e) => `${e.event}|${e.ts}`;
            const seen = new Set(dbLog.map(key));
            const onlyLocal = localLog.filter(e => !seen.has(key(e)));
            return [...dbLog, ...onlyLocal].sort((a,b) => (a.ts||0) - (b.ts||0));
          }
          function unionByTs(dbLog, localLog) {
            const seen = new Set(dbLog.map(e => e.ts));
            const onlyLocal = localLog.filter(e => !seen.has(e.ts));
            return [...dbLog, ...onlyLocal].sort((a,b) => (a.ts||0) - (b.ts||0));
          }
          return {
            ...local,
            coins:         dbM.coins,
            auctionWins:   dbM.auctionWins,
            power:         dbM.power,
            attendance:    dbM.attendance,
            profileRarity: dbM.profileRarity,
            awakeningLevel: dbM.awakeningLevel,
            lastLoginTs:   Math.max(dbM.lastLoginTs || 0, local.lastLoginTs || 0),
            attendLog:     unionLogs(dbM.attendLog, local.attendLog || []),
            decayLog:      unionByTs(dbM.decayLog, local.decayLog || []),
            txLog:         unionByTs(dbM.txLog, local.txLog || []),
            powerLog:      unionByTs(dbM.powerLog, local.powerLog || []),
          };
        });
      });
  }, 60000, 5000, []);

  // Poll auctions every 3s so all users see live bid updates
  useJitteredInterval(async () => {
      const aRows = await dbLoad("auctions", AUCTION_LIST_COLS);
      if (!Array.isArray(aRows)) return;
      // Guard: if the DB momentarily returns an empty list while we already
      // have auctions loaded locally, don't wipe them — a transient/empty
      // response shouldn't erase real data. Only accept an empty result if
      // we currently have nothing to lose.
      setAuctionsRaw(prev => {
        if (aRows.length === 0 && prev.length > 0) return prev;
        const updated = aRows.map(r => {
          const prevA = prev.find(a => String(a.id) === String(r.id));
          const next = {
            id:          String(r.id),
            name:        r.name ?? "",
            desc:        r.description ?? "",
            description: r.description ?? "",
            rarity:      r.rarity ?? "epic",
            status:      r.status ?? "active",
            endsAt:      Number(r.ends_at)    || 0,
            startedAt:   Number(r.started_at) || 0,
            currentBid:  Number(r.current_bid) || 0,
            minBid:      Number(r.min_bid)    || 0,
            startBid:    Number(r.min_bid)    || 0,
            topBidder:   r.top_bidder ?? null,
            bids:        (() => { try { const db = typeof r.bids === "string" ? JSON.parse(r.bids) : (Array.isArray(r.bids) ? r.bids : null); if (db && db.length > 0) return db; } catch {} return prevA?.bids || []; })(),
            image:       r.image_name ? { dataUrl: prevA?.image?.dataUrl || _auctionImageCache.get(String(r.id)) || null, name: r.image_name } : null,
          };
          // ROOT CAUSE of duplicate "Auction Win" entries in My Points
          // History: this poll used to ALSO log the win here (whenever it
          // noticed the DB already said "ended"), as a backup for browsers
          // that didn't trigger the transition themselves. But the
          // separate local-clock-based expiry effect below already logs
          // the win unconditionally on EVERY browser, every second,
          // regardless of admin role (only the actual DB write to flip
          // status is role-gated, not the win-logging) — so that backup
          // was never actually needed, and instead created a real race:
          // two independent timers (this 3s poll and that 1s effect) each
          // running their own "already logged?" check against txLog, with
          // no coordination between them, occasionally both passing the
          // check before either's update had been applied. Removing the
          // duplicate here leaves exactly one place that logs the win.
          if (next.status === "ended" && prevA && prevA.status === "active" && !endedAuctionIds.current.has(next.id)) {
            endedAuctionIds.current.add(next.id);
            if (next.topBidder) {
              addToast(`${next.topBidder} won ${next.name} for ${fmt(next.currentBid)} coins!`, "gold", "Auction Ended");
            }
          }
          // Reconciliation safety net (see reconciledWinClaims above) — not
          // just newly-transitioned auctions, ANY ended auction with a
          // topBidder this session hasn't tried yet, since the original
          // claim could have failed in a totally different session. Capped
          // to a recent window so this doesn't replay the entire history
          // on every load; 7 days comfortably covers any realistic retry gap.
          if (
            next.status === "ended" && next.topBidder &&
            !reconciledWinClaims.current.has(next.id) &&
            (Date.now() - next.endsAt) < 7 * 24 * 60 * 60 * 1000
          ) {
            reconciledWinClaims.current.add(next.id);
            claimAuctionWinAndLog(next, setMembersRaw);
          }
          // Live in-app outbid detection: this poll already has the fresh
          // state of every auction every 3s — if the current user was
          // CONFIRMED (by a previous poll) as top bidder and now the DB
          // shows someone else (auction still active, not ended — that's a
          // different, already-handled case above), they were just outbid
          // while actively on the site. Surfaced as a real popup here,
          // distinct from the existing push notification
          // (sendPushNotification), which is the right channel for when
          // they're NOT actively looking at the app, but is just a
          // fire-and-forget OS-level notification, not something this code
          // can drive an in-app UI from.
          // Reads currentUserRef.current rather than the closed-over
          // currentUser directly — this poll's effect has an empty
          // dependency array ([]), so a direct reference would be frozen
          // at whatever currentUser was when the component first mounted
          // (likely null, before login), never updating after that.
          const liveUser = currentUserRef.current;
          const auctionKey = String(next.id);
          const prevConfirmed = confirmedTopBidders.current.get(auctionKey);
          if (
            next.status === "active" &&
            !!liveUser?.name &&
            prevConfirmed === liveUser.name &&
            next.topBidder &&
            next.topBidder !== liveUser.name
          ) {
            setOutbidPopup({
              auctionId: next.id,
              name: next.name,
              newBid: next.currentBid,
              outbidBy: next.topBidder,
            });
          }
          confirmedTopBidders.current.set(auctionKey, next.topBidder ?? null);
          return next;
        }).filter(a => !deletedAuctionIds.current.has(a.id));
        // ROOT CAUSE of "a new auction appears then immediately disappears"
        // (still reproducible even with dbUpsertReliable's retries on the
        // write side — see setAuctions above): this poll used to replace
        // local state with EXACTLY what aRows contains, full stop. A
        // brand-new auction is added to local state optimistically the
        // instant createAuction runs, but its write to the DB is still an
        // in-flight async call — if this poll's own fetch lands first (a
        // real, ordinary race, not a failure), aRows simply doesn't have
        // the row yet, and the auction vanished from every screen even
        // though the write goes on to succeed moments later. Bridge that
        // gap: keep any local-only auction that isn't in aRows yet, as
        // long as it's new enough to plausibly still be in flight (ids are
        // Date.now()-based) and wasn't an explicit delete. Once the DB
        // catches up, the next poll's aRows naturally includes the real
        // row and replaces this optimistic placeholder.
        const CREATE_GRACE_MS = 20000;
        const updatedIds = new Set(updated.map(a => String(a.id)));
        const pendingLocal = prev.filter(a =>
          !updatedIds.has(String(a.id)) &&
          !deletedAuctionIds.current.has(a.id) &&
          (Date.now() - (Number(a.id) || 0)) < CREATE_GRACE_MS
        );
        return [...updated, ...pendingLocal];
      });
  }, 3000, 1000, []);

  // Poll loot_results every 10s so all users see new distributions
  const [latestLootId, setLatestLootId] = useState(null);
  const deletedLootIds = useRef(new Set());
  useEffect(() => {
    const iv = setInterval(async () => {
      const rows = await dbLoad("loot_results");
      if (Array.isArray(rows)) {
        const parsed = rows.map(r => ({
          id: r.id,
          timestamp: Number(r.timestamp) || 0,
          date: r.date || "",
          eventLabel: r.event_label || "Loot Distribution",
          results: (() => { try { return typeof r.results === "string" ? JSON.parse(r.results) : (r.results || []); } catch { return []; } })(),
        })).filter(r => Date.now() - r.timestamp < 7*24*60*60*1000).sort((a,b)=>b.timestamp-a.timestamp);
        setLootResults(prev => {          // ROOT CAUSE FIX: this used to be a hard overwrite (`return parsed`).
          // A roll is saved optimistically into local state immediately, then
          // written to Supabase asynchronously (with retries, which can take
          // a couple seconds). This poll runs on its own independent 10s timer,
          // not synchronized with that write at all — if a tick landed in the
          // gap before the write finished, it would read the DB's still-stale
          // rows and stomp over the optimistic entry, erasing it from this
          // client's memory before the write ever had a chance to land (and
          // permanently if the user refreshed in that window). Now we merge
          // by id-union, the same way attendance_logs already does: a row
          // that exists locally but not yet in the DB read is kept, not
          // dropped, until it either appears in a DB read or its id is
          // confirmed deleted.
          const dbIds = new Set(parsed.map(r => String(r.id)));
          const localOnly = prev.filter(r => !dbIds.has(String(r.id)) && !deletedLootIds.current.has(String(r.id)));
          const merged = [...parsed, ...localOnly]
            .filter(r => Date.now() - r.timestamp < 7*24*60*60*1000)
            .sort((a,b)=>b.timestamp-a.timestamp);
          const prevNewest = prev.length > 0 ? prev[0].id : null;
          const newNewest = merged.length > 0 ? merged[0].id : null;
          if (newNewest && String(newNewest) !== String(prevNewest)) {
            setLatestLootId(String(newNewest));
          }
          return merged;
        });
      }
    }, 10000);
    return () => clearInterval(iv);
  }, []);

  // Poll coin_requests every 10s too — this was previously only loaded
  // once on page mount, so a Master who already had the app open before
  // an Elder submitted a request would never see it appear (no error, no
  // feedback, the approval button simply never showed up since nothing
  // ever told this client a new request existed). Same merge-by-id-union
  // approach as loot_results above, so a request submitted locally but
  // not yet confirmed in the DB isn't briefly erased by a poll that races
  // ahead of that write.
  const deletedCoinReqIds = useRef(new Set());
  useEffect(() => {
    const iv = setInterval(async () => {
      const rows = await dbLoad("coin_requests");
      if (Array.isArray(rows)) {
        // ROOT CAUSE FIX: previously only `localOnly` (locally-pending,
        // not-yet-confirmed requests) was filtered against
        // deletedCoinReqIds — the `parsed` rows straight from the
        // database were NOT filtered at all. So if a request's
        // dbDeleteReliable call failed (the row never actually left the
        // coin_requests table, even though it was optimistically removed
        // from the screen), the very next 10s poll would fetch that same
        // row again and re-add it to pendingCoinRequests — fully visible
        // and approvable again, with no indication anything had gone
        // wrong. Repeatedly clicking Approve on that reappearing request
        // would pay the coins out again each time. Filtering `parsed`
        // against the same set closes that gap: once a request has been
        // approved or rejected locally, it stays gone from this client's
        // view regardless of whether the delete actually landed — and
        // the existing "couldn't be cleared from the queue" warning
        // toast is still the signal to go double check/delete it
        // manually in Supabase if that ever happens.
        const parsed = rows
          .filter(r => !deletedCoinReqIds.current.has(String(r.id)))
          .map(r => ({
            ...r,
            memberId: r.member_id ?? r.memberId,
            memberName: r.member_name ?? r.memberName,
            requestedBy: r.requested_by ?? r.requestedBy,
            requestedAt: r.requested_at ?? r.requestedAt,
          }));
        setPendingCoinRequests(prev => {
          const dbIds = new Set(parsed.map(r => String(r.id)));
          const localOnly = prev.filter(r => !dbIds.has(String(r.id)) && !deletedCoinReqIds.current.has(String(r.id)));
          return [...parsed, ...localOnly];
        });
      }
    }, 10000);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => {
    // ── AUCTION EXPIRY LOGIC ────────────────────────────────────────────────
    // ROOT CAUSE FIX: Previously every client (all 50 members) would race to
    // write status="ended" to the DB the moment their local clock ticked past
    // endsAt. Whichever client had the fastest/most-ahead clock won, ending
    // the auction early for everyone else.
    //
    // NEW APPROACH:
    // 1. GRACE_MS raised to 10s (was 5s) — accommodates real-world clock drift
    //    and network lag. A client that is 5s ahead will NOT close the auction
    //    while others still show ~5-10s on their timers.
    // 2. Any logged-in client can perform the DB write — restricting this to
    //    Master/Elder used to seem safer, but it meant an auction whose timer
    //    lapsed while no Master/Elder had the site open would NEVER close:
    //    every other client only flipped local display state, and the next
    //    3s poll just re-fetched "active" from the DB forever (real incident:
    //    a member-created auction stayed biddable indefinitely). The actual
    //    fix for the original race (see finalizeAuctionClose) is re-fetching
    //    the auction's true state from the DB before writing, which makes
    //    concurrent closers harmless — they all write the same fresh values
    //    — so gating by role bought no extra correctness, only outages.
    // 3. endedAuctionIds ref prevents any double-fires even across re-renders.
    const GRACE_MS = 10000; // 10s buffer — wide enough for most clock skew

    setAuctionsRaw(prev => prev
      .filter(a => !deletedAuctionIds.current.has(a.id))
      .map(a => {
        if (a.status==="active" && Date.now() > a.endsAt + GRACE_MS && !endedAuctionIds.current.has(a.id)) {
          endedAuctionIds.current.add(a.id);
          // ROOT CAUSE of a real, concrete coin/winner-accuracy bug: this
          // used to act on `a` directly — the version of this auction
          // already sitting in this browser's local state, which could
          // be UP TO ONE FULL POLL CYCLE STALE (the 3s auction poll).
          // If a winning bid landed in that window (a genuinely realistic
          // case — bids racing right up to the deadline are exactly when
          // this matters most), this browser would close the auction,
          // log the win, and notify Discord using the WRONG, outdated
          // top bidder — while the database (and everyone else's next
          // poll) already had the real, correct winner. The website's
          // OWN displayed state was always right; only the one-time
          // "declare the winner" action, taken from a stale snapshot,
          // was wrong — which is exactly the mismatch reported (site
          // says one winner, Discord announced another, and the actual
          // winner's coins were never deducted because the wrong
          // person's txLog got the entry instead).
          // Fix: hand off to a separate async function that re-fetches
          // this specific auction's TRUE current state from the database
          // first, and only acts on THAT — never on the possibly-stale
          // `a` from local memory. The local state below still flips to
          // "ended" immediately for a snappy UI; it's the consequential
          // actions (DB write, win claim, Discord) that wait for fresh
          // data.
          finalizeAuctionClose(a, setMembersRaw, addToast);
          return {...a, status:"ended"};
        }
        return a;
      })
    );
  }, [tick, currentUser]);
  useEffect(() => {
    if (currentUser) { const u = members.find(m=>String(m.id)===String(currentUser.id)); if (u) setCurrentUser(u); }
  }, [members]);

  // Poll bid_events every 3s and show a global toast to all users when someone bids
  const [bidFeed, setBidFeed] = useState([]);
  const seenBidEvents = useRef(new Set());
  useJitteredInterval(async () => {
    const rows = await dbLoad("bid_events", "id,bidder,auction_name,amount,ts");
    if (!Array.isArray(rows)) return;
    const fresh = [];
    rows.forEach(r => {
      if (!seenBidEvents.current.has(r.id)) {
        seenBidEvents.current.add(r.id);
        if (currentUser && r.bidder !== currentUser.name) {
          addToast(`${r.bidder} bid ${fmt(Number(r.amount))} coins on ${r.auction_name}!`, "blue", "🔨 New Bid");
        }
      }
      fresh.push({ id: r.id, bidder: r.bidder, auction_name: r.auction_name, amount: Number(r.amount), ts: Number(r.ts) });
    });
    setBidFeed(fresh.sort((a,b) => b.ts - a.ts).slice(0, 5));
  }, 3000, 800, [currentUser]);

  function addToast(msg, type="gold", title="") {
    const id = Date.now()+Math.random();
    setToasts(t => [...t,{id,msg,type,title,exiting:false}]);
    setTimeout(() => dismissToast(id), 4000);
  }
  // Two-phase removal: flag the toast as exiting (triggers the CSS exit
  // animation), then actually drop it from state once that animation has
  // had time to finish — instead of yanking it out of the DOM instantly.
  function dismissToast(id) {
    setToasts(t => t.map(x => x.id===id ? {...x, exiting:true} : x));
    setTimeout(() => setToasts(t => t.filter(x=>x.id!==id)), 250);
  }
  function removeToast(id) { dismissToast(id); }
  function handleLogin(m) {
    // Capture the OLD lastLoginTs before overwriting it — this is the
    // actual boundary the "what's new since you logged in" popup needs
    // to compare against. If we updated lastLoginTs first and then tried
    // to read it, we'd just see "now" and the summary would always be
    // empty.
    const previousLoginTs = m.lastLoginTs || 0;
    const now = Date.now();
    setCurrentUser({...m, lastLoginTs: now});
    setLoggedIn(true);
    setShowEntrance(true);
    localStorage.setItem("cf_user_id", m.id);
    setMembers(ms => ms.map(x => x.id===m.id ? {...x, lastLoginTs: now} : x));
    setLoginSummaryWindow({ since: previousLoginTs, until: now });
  }
  function handleLogout() {
    setLoggedIn(false);
    setCurrentUser(null);
    setGlobalViewingProfile(null);
    setPage("dashboard");
    localStorage.removeItem("cf_user_id");
  }
  function linkDiscord(id, tag) {
    setMembers(ms => ms.map(m => m.id===id ? {...m,discord:tag} : m));
    addToast(tag?`Discord linked: ${tag}`:"Discord unlinked.","blue","Discord");
    setModal(null);
  }
  function removeAuction(id) {
    deletedAuctionIds.current.add(id);
    setAuctionsRaw(a => a.filter(x => x.id !== id));
    (async () => {
      try {
        const res = await fetch(`${SUPA_URL}/rest/v1/auctions?id=eq.${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: {
            "apikey": SUPA_KEY,
            "Authorization": `Bearer ${SUPA_KEY}`,
            "Prefer": "return=minimal",
          }
        });
        if (res.ok) addToast("Auction removed.", "gold", "Auction Removed");
        else addToast("Removed locally. DB sync may be delayed.", "gold", "Auction Removed");
      } catch { addToast("Auction removed.", "gold", "Auction Removed"); }
    })();
  }
  async function submitCoinRequest(memberId, amount, type, reason) {
    const m = members.find(x=>x.id===memberId);
    if (!m) return false;
    // ROOT CAUSE FIX: ids used to be Date.now()+Math.random(), a floating
    // point number with many decimal digits. Sending that as a URL filter
    // (id=eq.<value>) depends on the exact same decimal string being sent
    // every time — but the value read back from Supabase after a page
    // reload may not stringify identically to the original (numeric
    // column round-tripping, or PostgREST's own JSON number formatting,
    // can legitimately trim/shift trailing digits). When that happens,
    // the delete's WHERE clause matches zero rows — it doesn't error, it
    // just silently deletes nothing — so dbDelete reports the HTTP 2xx
    // "success" status even though the row is still sitting in the
    // table. That's exactly why a request could vanish from the screen
    // and the "Rejected"/"Approved" toast could fire, yet the row
    // reappear after a refresh: it was never actually gone. A plain
    // string id (timestamp + random suffix, same pattern already used
    // for auction image filenames) has no such ambiguity — it's compared
    // as an exact string both ways, every time.
    const reqId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const req = { id: reqId, memberId, member_id: memberId, memberName: m.name, member_name: m.name, amount: parseInt(amount)||0, type, reason: reason||"_", requestedBy: currentUser.name, requested_by: currentUser.name, requestedAt: new Date().toLocaleString(), requested_at: new Date().toISOString() };
    setPendingCoinRequests(prev=>[...prev, req]);
    // ROOT CAUSE FIX: this used to be fire-and-forget (no `await`, no
    // return value) — the caller (AdjustCoinsModal) closed its dialog
    // immediately on click, before this promise had even started
    // resolving. If the write was actually just slow rather than truly
    // failed, the Elder would see a "Request Failed" toast seconds later
    // for a request that may already have landed — with every reason to
    // assume nothing was sent and try again, creating a second, genuinely
    // separate row for the same intended action. Now this function is
    // awaited by the caller and returns the real outcome, so the dialog
    // only closes (and the Elder only sees a reason to retry) once we
    // actually know what happened.
    const ok = await dbUpsertReliable("coin_requests", { id: req.id, member_id: req.memberId, member_name: req.memberName, amount: req.amount, type: req.type, reason: req.reason, requested_by: req.requestedBy, requested_at: req.requested_at });
    if (ok) {
      addToast("Coin request sent for approval.", "gold", "Pending Approval");
    } else {
      setPendingCoinRequests(prev=>prev.filter(r=>r.id!==req.id));
      addToast(
        <span style={{display:"inline-flex",alignItems:"center",gap:6}}><WarningIcon size={13}/>Couldn't send the coin request — please try again.</span>,
        "red", "Request Failed"
      );
    }
    return ok;
  }
  // ROOT CAUSE of GinisangOtin's coins silently drifting -705 from her own
  // Points History (found while investigating a report of drift right
  // after a duplicate-log-entry cleanup — the cleanup was fine, this was
  // the real cause): this used to compute the new balance from THIS
  // browser's locally-cached m.coins and overwrite the whole member row
  // via setMembers, in one indivisible database write bundled with the
  // rest of that row's fields. Exactly the same lost-update race already
  // found and fixed for bidding (see adjustMemberCoinsAndLogAtomic above)
  // — if this browser's local snapshot was stale, or another write to the
  // same member landed around the same time, the log entry could get
  // written while the real coins change it describes silently didn't.
  async function approveCoinRequest(reqId) {
    const req = pendingCoinRequests.find(r=>r.id===reqId);
    if (!req) return;
    const change = req.type==="add" ? req.amount : -req.amount;
    const txEntry = {change,reason:req.reason,date:new Date().toLocaleDateString(),logType:"Elder Request",addedBy:req.requestedBy,ts:Date.now()};
    const newBalance = await adjustMemberCoinsAndLogAtomic(req.memberName, change, txEntry);
    if (newBalance === null) {
      addToast(
        <span style={{display:"inline-flex",alignItems:"center",gap:6}}><WarningIcon size={13}/>Couldn't approve "{req.memberName}"'s request — please try again.</span>,
        "red", "Approval Failed"
      );
      return;
    }
    setMembersRaw(ms=>ms.map(m=>m.id===req.memberId?{...m,coins:newBalance,txLog:[...(m.txLog||[]),txEntry]}:m));
    setPendingCoinRequests(prev=>prev.filter(r=>r.id!==reqId));
    deletedCoinReqIds.current.add(String(reqId));
    // If this delete fails, the request could reappear on the next poll and
    // potentially be approved a second time, double-paying the coins — so
    // retry and warn rather than fire-and-forget.
    dbDeleteReliable("coin_requests", { id: reqId }).then(ok => {
      if (!ok) {
        addToast(
          <span style={{display:"inline-flex",alignItems:"center",gap:6}}><WarningIcon size={13}/>Approved request for "{req.memberName}" couldn't be cleared from the queue — it may reappear. Don't approve it again if it does.</span>,
          "red", "Delete Failed"
        );
      }
    });
    addToast("Approved: "+req.amount+" coins for "+req.memberName+".", "gold", "Approved");
  }
  function rejectCoinRequest(reqId) {
    const req = pendingCoinRequests.find(r=>r.id===reqId);
    if (!req) return;
    setPendingCoinRequests(prev=>prev.filter(r=>r.id!==reqId));
    deletedCoinReqIds.current.add(String(reqId));
    dbDeleteReliable("coin_requests", { id: reqId }).then(ok => {
      if (!ok) {
        addToast(
          <span style={{display:"inline-flex",alignItems:"center",gap:6}}><WarningIcon size={13}/>Rejected request for "{req.memberName}" couldn't be cleared from the queue — it may reappear.</span>,
          "red", "Delete Failed"
        );
      }
    });
    addToast("Rejected coin request for "+req.memberName+".", "red", "Rejected");
  }
  function adjustPower(id, power) {
    const m = members.find(x=>x.id===id);
    const ts = Date.now();
    setMembers(ms => ms.map(x => x.id===id ? {...x,power,powerLog:[...(x.powerLog||[]),{power,ts}]} : x));
    addToast(`${m?.name}'s power updated to ${fmt(power)}.`, "gold", "Power Updated");
    setModal(null);
  }
  function setProfileRarity(id, profileRarity) {
    const m = members.find(x=>x.id===id);
    setMembers(ms => ms.map(x => x.id===id ? {...x,profileRarity} : x));
    addToast(`${m?.name}'s profile rarity set to ${profileRarity}.`, "gold", "Rarity Updated");
    setModal(null);
  }
  function setAwakeningLevel(id, awakeningLevel) {
    const m = members.find(x=>x.id===id);
    setMembers(ms => ms.map(x => x.id===id ? {...x,awakeningLevel} : x));
    addToast(`${m?.name}'s awakening level set to ${awakeningLevel}.`, "gold", "Awakening Updated");
    setModal(null);
  }

  const [pendingCoinRequests, setPendingCoinRequests] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openUserMenu, setOpenUserMenu] = useState(false);
  // adminToolsOpen: the MOBILE DRAWER's collapsible "Admin Tools" section
  // (expanded by default is the desired drawer behavior). adminDropdownOpen:
  // the DESKTOP nav's Admin Tools dropdown POPOVER — a separate state
  // because a popover must default to closed like any other dropdown;
  // these two used to share one variable, which meant the desktop dropdown
  // incorrectly rendered open on every page load (it inherited the
  // drawer-section's "start expanded" default of true).
  const [adminToolsOpen, setAdminToolsOpen] = useState(true);
  const [adminDropdownOpen, setAdminDropdownOpen] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  // Reflects actual subscription state (not just browser permission) —
  // checked once on load so the toggle shows correctly if the member
  // already enabled this in a previous session.
  useEffect(() => {
    if (!pushNotificationsSupported() || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.getRegistration("/sw.js").then(reg => {
      if (!reg) return;
      reg.pushManager.getSubscription().then(sub => setPushEnabled(!!sub));
    }).catch(() => {});
  }, []);
  async function togglePushNotifications() {
    if (pushBusy) return;
    setPushBusy(true);
    if (pushEnabled) {
      const ok = await disablePushNotifications(currentUser.name);
      if (ok) { setPushEnabled(false); addToast("Notifications turned off", "blue", "Notifications"); }
    } else {
      const permState = getPushPermissionState();
      if (permState === "unsupported") {
        addToast("Your browser doesn't support notifications. On iPhone, add this site to your Home Screen first.", "red", "Not Supported");
      } else if (permState === "denied") {
        addToast("Notifications are blocked for this site in your browser settings.", "red", "Blocked");
      } else {
        const ok = await enablePushNotifications(currentUser.name);
        if (ok) { setPushEnabled(true); addToast("Notifications enabled!", "gold", "Notifications"); }
        else addToast("Couldn't enable notifications. Please try again.", "red", "Error");
      }
    }
    setPushBusy(false);
  }


  const ctx = { members, setMembers, setMembersRaw, auctions, setAuctions, attendanceLogs, setAttendanceLogs,
    currentUser, setCurrentUser, isGuest, addToast, fireCoinBurst, fireBalancePopup, modal, setModal, tick, imageLibrary, addImage, linkDiscord, adjustPower, removeAuction, pendingCoinRequests, setPendingCoinRequests, submitCoinRequest, approveCoinRequest, rejectCoinRequest, lootResults, setLootResults, latestLootId, setLatestLootId, bidFeed, globalViewingProfile, setGlobalViewingProfile, eventsVersion, setEventsVersion, decayRate, setDecayRate, bonusConfig, setBonusConfig, loginAnnouncements, setLoginAnnouncements, featuredAuctionId, setFeaturedAuctionId, decayAnnouncements, setDecayAnnouncements };

  const PAGE_TITLES = {dashboard:t("pageTitle_dashboard"),attendance:t("pageTitle_attendance"),members:t("pageTitle_members"),auctions:t("pageTitle_auctions"),leaderboard:t("pageTitle_leaderboard"),export:t("pageTitle_export"),settings:t("pageTitle_settings"),"record-attendance":t("tabRecordAttendance"),"create-auction":t("tabCreateAuction")};

  // ── Connection error screen (DB unreachable — do NOT show empty/seed state) ─
  if (dbError) return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{position:"fixed",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg-dark)",flexDirection:"column",gap:16,padding:24,textAlign:"center",zIndex:9999}}>
        <div style={{display:"flex",justifyContent:"center"}}><WarningIcon size={36} style={{color:"var(--gold-light)"}}/></div>
        <div style={{fontFamily:"'Spectral',serif",fontWeight:800,fontSize:18,color:"var(--gold-light)",letterSpacing:2}}>Connection Problem</div>
        <div style={{fontSize:13,color:"var(--text-dim)",maxWidth:360}}>
          Couldn't reach the database. Your data is safe — please check your connection and try again.
        </div>
        <button className="btn btn-gold" onClick={()=>{ setDbError(false); setDbReady(false); setRetryCount(c=>c+1); }}>Retry</button>
      </div>
    </>
  );

  // ── Loading screen while DB data loads ────────────────────────────────────
  // position:fixed + inset:0 (rather than a plain flow div sized off
  // minHeight:100vh) so this genuinely fills the real viewport — #root
  // carries a leftover Vite-template max-width:1920px (see src/index.css)
  // that centers everything on wider screens. A plain block div here just
  // stretches to fill THAT capped column, leaving equal dead space (the
  // page's own body background bleeding through) on both sides on any
  // screen wider than 1920px. Fixed positioning escapes that constraint
  // entirely, the same way the login screen's video background already
  // does — that's the actual bug behind the "awkward box with black bars"
  // report, not something specific to this screen's own styling.
  if (!dbReady) return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{position:"fixed",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg-dark)",flexDirection:"column",gap:16,zIndex:9999}}>
        <div className="loading-sigil">
          <svg className="loading-sigil-ring-svg" viewBox="0 0 120 120"><circle cx="60" cy="60" r="45" transform="rotate(-90 60 60)"/></svg>
          <div className="loading-sigil-logo-wrap">
            <img className="loading-sigil-logo" src="/images/ymir-logo-gold.png" alt="Legend of Ymir" />
          </div>
        </div>
        <div style={{fontFamily:"'Spectral',serif",fontWeight:800,fontSize:18,color:"var(--gold-light)",letterSpacing:2}}>Sharpening Blades…</div>
        <div style={{fontSize:12,color:"var(--text-dim)"}}>Loading the war table</div>
      </div>
    </>
  );

  if (!loggedIn && !isGuest) return (
    <>
      <style>{GLOBAL_CSS}</style>
      <LoginScreen members={members} onLogin={handleLogin} onGuest={()=>setIsGuest(true)} />
      <Toast toasts={toasts} remove={removeToast} />
    </>
  );

  const _isLeader = !!currentUser && currentUser.role==="Leader";
  const _isElder  = !!currentUser && currentUser.role==="Elder";
  const _isMaster = !!currentUser && currentUser.role==="Master";
  const _reportPages = [];
  if (_isLeader || _isElder || _isMaster) _reportPages.push({id:"export",label:t("pageTitle_export")});
  if (_isLeader || _isMaster) _reportPages.push({id:"settings",label:t("pageTitle_settings")});
  const isAdmin = !!currentUser && (currentUser.role==="Elder"||currentUser.role==="Master");
  // Two-tier nav: "My Clan" is always shown (every member's own stats/
  // actions); "Admin Tools" is Elder/Master-only and visually separated
  // (own section + collapse toggle) rather than admin controls being
  // scattered across the sidebar dropdowns, the topbar, and in-page tabs
  // as they were before this reorg. The old per-item `sub` arrays were
  // decorative only — clicking any of those labels just navigated to the
  // same parent page regardless of which label was clicked — so they're
  // dropped here rather than carried forward; `subPages` (Reports) are
  // real distinct routes and are kept.
  const NAV = [
    { section:t("navSection_myClan"), items:[
        {id:"dashboard",icon:<StatIcon src={WARRIORS_ICON} size={16}/>,label:t("pageTitle_dashboard")},
        {id:"leaderboard",icon:<LBIcon src={LEADERBOARD_ICON} size={14}/>,label:t("leaderboards")},
        ...(!isGuest ? [
          {id:"members",icon:<StatIcon src={WARRIORS_ICON} size={16}/>,label:t("members")},
          {id:"attendance",icon:<StatIcon src={ATTENDANCE_ICON} size={16}/>,label:t("attendance")},
        ] : []),
        {id:"auctions",icon:<StatIcon src={AUCTION_ICON} size={16}/>,label:t("auctions")},
      ]},
  ];
  if (isAdmin) {
    NAV.push({
      section: t("navSection_adminTools"),
      collapsible: true,
      items: [
        {id:"record-attendance",icon:<StatIcon src={ATTENDANCE_ICON} size={16}/>,label:t("tabRecordAttendance")},
        {id:"create-auction",icon:<StatIcon src={AUCTION_ICON} size={16}/>,label:t("tabCreateAuction")},
        {id:"add-member",icon:"➕",label:t("addMember"),action:()=>setModal({type:"addMember"})},
        ...(_isMaster?[{id:"approvals",icon:"⏳",label:t("approvals"),action:()=>setModal({type:"pendingRequests"}),badge:pendingCoinRequests.length}]:[]),
        ...(_reportPages.length>0?[{id:"reports",icon:"📊",label:t("reports"),subPages:_reportPages}]:[]),
      ],
    });
  }

  // Shared vertical nav list — rendered both as the persistent desktop
  // sidebar and inside the mobile slide-in drawer, so the two never drift
  // out of sync with each other (they used to be two separately-maintained
  // NAV.map blocks with different markup). setDrawerOpen(false) on click is
  // a harmless no-op when there's no drawer open (desktop context).
  const navContent = (
    <div className="drawer-nav">
      {NAV.map((section, si) => (
        <div key={section.section}>
          {si > 0 && <div className="nav-section-divider"/>}
          <div
            className={`drawer-section-label${section.collapsible?" collapsible":""}`}
            onClick={section.collapsible?()=>setAdminToolsOpen(v=>!v):undefined}
          >
            {section.section}
            {section.collapsible && <span style={{marginLeft:6,display:"inline-block",transform:adminToolsOpen?"none":"rotate(-90deg)",transition:"transform 0.18s"}}>▾</span>}
          </div>
          <AnimatePresence initial={false}>
          {(!section.collapsible || adminToolsOpen) && section.items.map(item => (
            item.subPages ? item.subPages.map(sp=>(
              <motion.div key={sp.id} className={`drawer-nav-item${page===sp.id?" active":""}`}
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.16 }} style={{ overflow: "hidden" }}
                onClick={()=>{navigateToPage(sp.id);setDrawerOpen(false);}}>
                {item.icon && <span style={{display:"flex",alignItems:"center",opacity:0.8}}>{item.icon}</span>}{sp.label}
              </motion.div>
            )) : (
              <motion.div key={item.id} className={`drawer-nav-item${page===item.id?" active":""}`}
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.16 }} style={{ overflow: "hidden" }}
                onClick={()=>{
                  if(item.action){ item.action(); setDrawerOpen(false); }
                  else { navigateToPage(item.id); setDrawerOpen(false); }
                }}>
                {item.icon && <span style={{display:"flex",alignItems:"center",opacity:0.8}}>{item.icon}</span>}{item.label}
                {!!item.badge && <span className="nav-item-badge">{item.badge}</span>}
              </motion.div>
            )
          ))}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      {page==="leaderboard" && !globalViewingProfile && createPortal(
        <>
          <video className="leaderboard-bg-video" autoPlay loop muted playsInline poster="/video/login-bg-poster.jpg">
            <source src="/video/login-bg.webm" type="video/webm" />
          </video>
          <div className="leaderboard-bg-scrim" />
        </>,
        document.body
      )}
      <div className="app-shell">
        <div className="nav-wrapper">
        <nav className="sidebar">
          <div className="sidebar-logo" onClick={currentUser ? ()=>setGlobalViewingProfile(currentUser.id) : undefined} style={{cursor:currentUser?"pointer":"default"}} title={currentUser ? "View your profile" : undefined}>
            <img src="/images/ymir-logo-gold.png" alt="" className="sidebar-logo-mark" />
          </div>
          {(() => {
            const mainSection = NAV.find(s => !s.collapsible);
            const adminSection = NAV.find(s => s.collapsible);
            const isAdminActive = adminSection && adminSection.items.some(item =>
              item.subPages ? item.subPages.some(sp => sp.id === page) : page === item.id
            );
            return (
              <div className="topnav-items">
                {mainSection && mainSection.items.map(item => (
                  <div key={item.id} className={`topnav-item${page===item.id?" active":""}`} onClick={()=>navigateToPage(item.id)}>
                    {item.label}
                  </div>
                ))}
                {adminSection && (
                  <div
                    className={`topnav-item topnav-admin${isAdminActive?" active":""}${adminDropdownOpen?" dd-open":""}`}
                    onClick={()=>setAdminDropdownOpen(v=>!v)}
                    onMouseLeave={()=>setAdminDropdownOpen(false)}
                  >
                    {adminSection.section}
                    <span className="topnav-item-chevron">▾</span>
                    <div className="topnav-admin-dropdown">
                      <div className="user-dropdown-inner">
                        <div className="nav-dd-label">{adminSection.section}</div>
                        <div className="nav-dd-sep"/>
                        {adminSection.items.map(item => (
                          item.subPages ? item.subPages.map(sp => (
                            <div key={sp.id} className={`user-dd-item${page===sp.id?" active":""}`}
                              onClick={(e)=>{e.stopPropagation();navigateToPage(sp.id);setAdminDropdownOpen(false);}}>
                              {sp.label}
                            </div>
                          )) : (
                            <div key={item.id} className={`user-dd-item${page===item.id?" active":""}`}
                              onClick={(e)=>{
                                e.stopPropagation();
                                if(item.action){ item.action(); } else { navigateToPage(item.id); }
                                setAdminDropdownOpen(false);
                              }}>
                              {item.label}{!!item.badge && <span className="nav-item-badge">{item.badge}</span>}
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          <div className="topnav-icons">
          <LangSwitcher />
          {currentUser ? (
          <div className={`user-menu${openUserMenu?" dd-open":""}`} onMouseLeave={()=>setOpenUserMenu(false)}>
            <div
              className="profile-chip"
              onClick={()=>setOpenUserMenu(v=>!v)}
            >
              <div className="user-avatar"><ClassIcon cls={currentUser.cls} size={20} noShadow /></div>
              <div className="profile-chip-info">
                <div className="user-name">{currentUser.name}</div>
                <div className="profile-chip-sub">
                  <StatIcon src={COINS_ICON} size={11}/>{fmt(currentUser.coins)}
                </div>
              </div>
              <span className="profile-chip-caret">▾</span>
            </div>
            <div className="user-dropdown">
              <div className="user-dropdown-inner">
                <div className="nav-dd-label">{currentUser.name}</div>
                <div className="nav-dd-sep"/>
                <div className="user-dd-item" onClick={()=>{setGlobalViewingProfile(currentUser.id);setOpenUserMenu(false);}}>
                  Your Profile
                </div>
                <div className="nav-dd-sep"/>
                <div className="user-dd-item" style={{fontSize:10,color:"var(--gold)",pointerEvents:"none"}}>
                  <StatIcon src={COINS_ICON} size={22}/>{fmt(currentUser.coins)} {t("coinsLabel")}
                </div>
                <div className="nav-dd-sep"/>
                <div className="user-dd-item" onClick={()=>{setModal({type:"changePassword",data:currentUser});setOpenUserMenu(false);}}>
                  {t("changePassword")}
                </div>
                <div className="user-dd-item" onClick={togglePushNotifications} style={pushBusy?{opacity:0.6,pointerEvents:"none"}:undefined}>
                  {pushEnabled ? "🔔 Notifications: On" : "🔕 Enable Notifications"}
                </div>
                <div className="user-dd-item danger" onClick={handleLogout}>{t("logOut")}</div>
              </div>
            </div>
          </div>
          ) : (
            <button className="btn btn-outline btn-sm" onClick={()=>setIsGuest(false)}>{t("logIn")}</button>
          )}
          </div>
          {/* Hamburger — mobile only */}
          <button className="hamburger" onClick={()=>setDrawerOpen(true)} aria-label="Open menu">
            <span/><span/><span/>
          </button>
        </nav>
        </div>

        {/* Mobile Drawer */}
        <div className={`mobile-drawer${drawerOpen?" open":""}`}>
          <div className="drawer-overlay" onClick={()=>setDrawerOpen(false)}/>
          <div className="drawer-panel">
            <div className="drawer-header">
              <button className="drawer-close" onClick={()=>setDrawerOpen(false)}>✕</button>
            </div>
            {navContent}
            {currentUser ? (
            <div className="drawer-user">
              <div className="drawer-user-row">
                <div className="user-avatar"><ClassIcon cls={currentUser.cls} size={22}/></div>
                <div>
                  <div className="user-name">{currentUser.name}</div>
                  <div className="user-role">{currentUser.role}</div>
                </div>
                <div className="user-coins" style={{marginLeft:"auto"}}><span style={{display:"inline-flex",alignItems:"center",gap:4}}><StatIcon src={COINS_ICON} size={24}/>{fmt(currentUser.coins)}</span></div>
              </div>
              <div className="drawer-user-actions">
                <button className="btn btn-gold btn-sm" onClick={()=>{setGlobalViewingProfile(currentUser.id);setDrawerOpen(false);}}>
                  Your Profile
                </button>
                <button className="btn btn-discord btn-sm" onClick={()=>{setModal({type:"discord",data:currentUser});setDrawerOpen(false);}}>
                  {currentUser.discord?t("discord"):t("linkDiscord")}
                </button>
                <button className="btn btn-outline btn-sm" onClick={()=>{setModal({type:"changePassword",data:currentUser});setDrawerOpen(false);}}>
                  {t("changePasswordLabel")}
                </button>
                <button className="btn btn-outline btn-sm" onClick={togglePushNotifications} disabled={pushBusy}>
                  {pushEnabled ? "🔔 Notifications: On" : "🔕 Enable Notifications"}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={handleLogout}>{t("logOut")}</button>
              </div>
            </div>
            ) : (
              <div className="drawer-user">
                <button className="btn btn-gold btn-sm" style={{width:"100%",justifyContent:"center"}} onClick={()=>{setIsGuest(false);setDrawerOpen(false);}}>{t("logIn")}</button>
              </div>
            )}
          </div>
        </div>

        <main className="main">
          <div className="topbar">
            <div>
              <div className="page-title">{PAGE_TITLES[page]||page}</div>
              <div className="page-sub">{currentUser ? `${currentUser.name} · ${currentUser.role}` : t("guestModeLabel")}</div>
            </div>
            <div className="topbar-actions">
              {/* Add Member / Approvals live in the top nav's Admin Tools
                  dropdown (see NAV construction above) — this keeps admin
                  actions in one visually distinct place instead of split
                  between the topbar and the nav. The "always render for
                  Master, badge only when count>0" behavior from the old
                  Approvals button is preserved on the nav item itself.
                  LangSwitcher now lives in the nav bar's icon group
                  (.topnav-icons) instead of here. */}
            </div>
          </div>
          <div className="content">
            {/* mode="popLayout" lets a ProfileCard's shared layoutId project
                across this exit/enter boundary (see ProfileCard) instead of
                the outgoing and incoming trees fighting for layout space
                while both are briefly mounted during the transition. */}
            <AnimatePresence mode="popLayout" initial={false}>
              {globalViewingProfile ? (
                <motion.div key="profile" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.25}}>
                  <PlayerInfo
                    member={members.find(m => m.id === globalViewingProfile) || globalViewingProfile}
                    members={members}
                    onBack={() => setGlobalViewingProfile(null)}
                  />
                </motion.div>
              ) : (
                <motion.div key="page" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.25}}>
                  {page==="dashboard"   && <Dashboard ctx={ctx} setPage={navigateToPage} />}
                  {page==="members"     && !isGuest && <Members ctx={ctx} />}
                  {page==="attendance"  && !isGuest && <Attendance ctx={ctx} />}
                  {page==="auctions"    && <Auctions ctx={ctx} />}
                  {page==="leaderboard" && <Leaderboard ctx={ctx} />}
                  {/* Admin-only pages — gated here too (not just hidden from
                      nav) as defense-in-depth, matching how Reports/Settings
                      already gate by role rather than relying solely on the
                      sidebar not showing a link. isAdmin is already false for
                      guests (currentUser is null), so this also covers them. */}
                  {page==="export"      && isAdmin && <Export ctx={ctx} />}
                  {page==="settings"    && isAdmin && <Settings ctx={ctx} />}
                  {page==="record-attendance" && isAdmin && <RecordAttendancePanel ctx={ctx} />}
                  {page==="create-auction"    && isAdmin && <CreateAuctionPanel ctx={ctx} />}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>

      {modal?.type==="addMember"    && <AddMemberModal ctx={ctx} />}
      {modal?.type==="adjustCoins"  && <AdjustCoinsModal ctx={ctx} />}
      {modal?.type==="pendingRequests" && <PendingRequestsModal ctx={ctx} />}
      {modal?.type==="adjustPower"  && <AdjustPowerModal member={modal.data} onSave={(p)=>adjustPower(modal.data.id,p)} onClose={()=>setModal(null)} />}
      {modal?.type==="setRarity"    && <SetRarityModal member={modal.data} onSave={(r)=>setProfileRarity(modal.data.id,r)} onClose={()=>setModal(null)} />}
      {modal?.type==="setAwakening" && <SetAwakeningModal member={modal.data} onSave={(l)=>setAwakeningLevel(modal.data.id,l)} onClose={()=>setModal(null)} />}
      {modal?.type==="discord"      && <DiscordModal member={modal.data} onSave={(tag)=>linkDiscord(modal.data.id,tag)} onClose={()=>setModal(null)} />}
      {modal?.type==="changePassword" && <ChangePasswordModal ctx={ctx} />}
      {modal?.type==="renameMember"   && <RenameMemberModal ctx={ctx} />}
      {(() => {
        if (!loginSummaryWindow || !currentUser) return null;
        // "Don't show again today" now suppresses the WHOLE popup for
        // the rest of the day — summary AND any announcements — per
        // direct request. This means an announcement could go unseen by
        // someone who dismissed today before it was posted, reappearing
        // for them tomorrow instead of immediately; that's an accepted
        // tradeoff in exchange for "today" genuinely meaning "nothing
        // else from this popup today," not a partial dismissal.
        const todayKey = `cf_login_summary_dismissed_${currentUser.id}_${new Date().toDateString()}`;
        if (localStorage.getItem(todayKey)) return null;

        const announcementsToShow = (loginAnnouncements || []).filter(
          ann => !localStorage.getItem(`cf_announcement_dismissed_${currentUser.id}_${ann.id}`)
        );
        const summary = getLoginSummary(currentUser, loginSummaryWindow);

        // Nothing to show at all (genuinely first login with no
        // announcements — summary itself is never null anymore, see
        // getLoginSummary, but announcements can still be empty).
        if (!summary && announcementsToShow.length === 0) return null;

        return (
          <LoginSummaryModal
            summary={summary}
            announcements={announcementsToShow}
            memberName={currentUser.name}
            onClose={() => setLoginSummaryWindow(null)}
            onDismissToday={() => localStorage.setItem(todayKey, "1")}
            onDismissAnnouncement={(id) => localStorage.setItem(`cf_announcement_dismissed_${currentUser.id}_${id}`, "1")}
          />
        );
      })()}
      {outbidPopup && (
        <OutbidPopup
          info={outbidPopup}
          onClose={() => setOutbidPopup(null)}
          onGoBid={() => { navigateToPage("auctions"); setOutbidPopup(null); }}
        />
      )}
      {modal?.type==="deleteAttendance" && <DeleteAttendanceModal ctx={ctx} />}
      {modal?.type==="addMissingAttendance" && <AddMissingAttendanceModal ctx={ctx} />}
      <Toast toasts={toasts} remove={removeToast} />
      {coinBursts.map(b => <CoinBurst key={b.id} x={b.x} y={b.y} />)}
      {balancePopups.map(b => <BalancePopup key={b.id} x={b.x} y={b.y} amount={b.amount} label={t("balanceRemaining")} />)}
      {showEntrance && <EntranceAnimation onDone={()=>setShowEntrance(false)} />}
    </>
  );
}

export default function App() {
  // Lives here (not in AppInner) so the single <audio> element survives
  // login/logout and every page navigation, which is what makes the
  // crossfade between tracks possible — nothing remounts it mid-transition.
  const [musicTrack, setMusicTrack] = useState(null); // "login" | "leaderboard" | null
  return (
    <LangProvider>
      <BackgroundMusic desiredTrack={musicTrack} />
      <AppInner onMusicTrackChange={setMusicTrack} />
    </LangProvider>
  );
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function SectionTitle({ children }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20}}>
      <div style={{fontFamily:"'Inter',sans-serif",fontSize:15,fontWeight:800,color:"var(--gold-light)",letterSpacing:1,whiteSpace:"nowrap"}}>{children}</div>
      <div style={{flex:1,height:1,background:"linear-gradient(90deg,var(--gold-dim),transparent)"}} />
    </div>
  );
}


// ─── WORLD BOSS SCHEDULE ──────────────────────────────────────────────────────
function WorldBossSchedule() {
  const [schedTab, setSchedTab] = useState("today");
  const todaySched = WEEKLY_SCHEDULE[new Date().getDay()];
  const dayName = DAY_NAMES[new Date().getDay()];

  function EventCard({ ev, compact }) {
    const col = EVENT_COLOR[ev.id] || "#c8922a";
    const glow = EVENT_GLOW[ev.id] || "rgba(200,146,42,0.4)";
    const desc = EVENT_DESCRIPTIONS[ev.id] || "";
    const thumbW = compact ? 110 : 170;
    const thumbH = compact ? 102 : 170;
    return (
      <div
        onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow=`0 10px 40px rgba(0,0,0,0.85), 0 0 24px ${glow}`;}}
        onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=`0 4px 20px rgba(0,0,0,0.7)`;}}
        style={{
          display:"flex", flexDirection:"column",
          background:`linear-gradient(135deg, #0e0b09 0%, #181310 60%, #0e0b09 100%)`,
          border:`1px solid ${col}44`,
          borderRadius:6, overflow:"hidden", position:"relative",
          boxShadow:`0 4px 20px rgba(0,0,0,0.7)`,
          transition:"transform 0.2s, box-shadow 0.2s",
        }}>
        <div style={{height:2, background:`linear-gradient(90deg, transparent 5%, ${col} 40%, ${col} 60%, transparent 95%)`}} />
        <div className={compact?"":"event-card-row"} style={{display:"flex"}}>
          {/* Thumbnail */}
          <div className="event-card-thumb" style={{position:"relative", flexShrink:0, width:thumbW, height:thumbH}}>
            <img src={ev.img} alt={ev.name} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} />
            {/* Vignette — dark right fade for both cards (event-id badge
                readability), plus a soft bottom fade for visual depth.
                Compact's bottom fade is lighter than non-compact's since it
                no longer needs to hide a coin badge behind it — just gives
                the image a bit of grounding instead of looking flat. */}
            <div style={{position:"absolute",inset:0,background: compact
              ? "linear-gradient(to right, rgba(0,0,0,0.05) 0%, rgba(14,11,9,0.55) 85%), linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 40%)"
              : "linear-gradient(to right, rgba(0,0,0,0.05) 0%, rgba(14,11,9,0.85) 85%), linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 45%)"
            }} />
            {/* Coins overlay — only for the non-compact (Today) card. The
                compact (Full Week) card shows coins inline in the text
                column instead, see below — overlaying it on the smaller
                compact thumbnail looked cramped/oversized against the image. */}
            {!compact && (
              <div className="event-card-coins" style={{
                position:"absolute", bottom:10, left:"50%", transform:"translateX(-50%)",
                background:"rgba(0,0,0,0.72)", border:`1px solid ${col}99`,
                borderRadius:20, padding:"4px 14px",
                backdropFilter:"blur(6px)", whiteSpace:"nowrap",
                display:"flex", alignItems:"center", gap:4,
                boxShadow:`0 0 12px ${glow}`,
              }}>
                <span className="event-card-coins-num" style={{fontSize:19, fontFamily:"'Inter',sans-serif", fontWeight:900, color:"#f2cc60", lineHeight:1}}>{`+${ev.coins}`}</span>
                <span style={{fontSize:8, color:"rgba(200,146,42,0.7)", fontWeight:700, letterSpacing:1, textTransform:"uppercase", alignSelf:"flex-end", paddingBottom:1}}>coins</span>
              </div>
            )}
            {/* Event ID badge */}
            <div style={{
              position:"absolute", top:8, left:8,
              background:`linear-gradient(135deg,${col}cc,${col}88)`,
              borderRadius:3, padding:"2px 8px",
              fontSize:8, fontWeight:900, color:"#fff", letterSpacing:2,
              textTransform:"uppercase", backdropFilter:"blur(4px)",
              boxShadow:`0 2px 8px ${glow}`,
            }}>{ev.id}</div>
          </div>
          {/* Text content */}
          <div className="event-card-text" style={{flex:1, padding: compact?"12px 14px":"18px 20px", display:"flex", flexDirection:"column", justifyContent:"flex-start", minWidth:0}}>
            <div style={{
              display:"flex", alignItems:"center", gap:8, flexWrap:"wrap",
              marginBottom:6,
            }}>
              <div style={{
                fontFamily:"'Inter',sans-serif", fontWeight:900,
                fontSize: compact?14:19, color:"#f4e8cc",
                lineHeight:1.2,
                textShadow:`0 0 20px ${col}66`,
                textAlign:"left",
              }}>{ev.name}</div>
              {compact && (
                <span style={{
                  display:"inline-flex", alignItems:"center", gap:3, flexShrink:0,
                  background:"rgba(0,0,0,0.45)", border:`1px solid ${col}66`,
                  borderRadius:12, padding:"2px 8px",
                }}>
                  <span style={{fontSize:11, fontFamily:"'Inter',sans-serif", fontWeight:900, color:"#f2cc60", lineHeight:1.3}}>{`+${ev.coins}`}</span>
                  <span style={{fontSize:7, color:"rgba(200,146,42,0.7)", fontWeight:700, letterSpacing:0.5, textTransform:"uppercase"}}>coins</span>
                </span>
              )}
            </div>
            <div style={{
              display:"inline-flex", alignItems:"flex-start", gap:5, marginBottom: compact?8:12,
              background:`${col}18`, border:`1px solid ${col}44`,
              borderRadius:14, padding:"5px 10px", maxWidth:"100%",
            }}>
              <span style={{fontSize:10,flexShrink:0,lineHeight:1.4,paddingTop:1}}>🕐</span>
              <span style={{fontSize: compact?9:11, fontWeight:800, color:col, fontFamily:"'Inter',sans-serif", letterSpacing:0.5, lineHeight:1.4}}>{ev.time} SERVER TIME</span>
            </div>
            <div style={{
              fontSize: compact?10:11, color:"rgba(156,126,92,0.85)", lineHeight: compact?1.4:1.65,
              fontFamily:"'Inter',sans-serif", fontStyle:"italic",
              display:"-webkit-box", WebkitLineClamp: compact?2:3,
              WebkitBoxOrient:"vertical", overflow:"hidden",
              textAlign:"left",
            }}>{desc}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="world-boss-schedule" style={{
      background:"linear-gradient(135deg,rgba(10,8,6,0.65) 0%,rgba(18,14,11,0.9) 100%)",
      border:"1px solid rgba(200,146,42,0.2)", borderRadius:8,
      padding:"22px 24px", marginBottom:36, position:"relative", overflow:"hidden",
    }}>
      {/* Rune pattern bg */}
      <div style={{position:"absolute",inset:0,opacity:0.025,backgroundImage:"repeating-linear-gradient(45deg,#c8922a 0,#c8922a 1px,transparent 0,transparent 50%)",backgroundSize:"22px 22px",pointerEvents:"none"}} />
      {/* Corner ornaments */}
      <div style={{position:"absolute",top:6,left:6,width:18,height:18,borderTop:"2px solid rgba(200,146,42,0.4)",borderLeft:"2px solid rgba(200,146,42,0.4)",borderRadius:"2px 0 0 0",pointerEvents:"none"}} />
      <div style={{position:"absolute",top:6,right:6,width:18,height:18,borderTop:"2px solid rgba(200,146,42,0.4)",borderRight:"2px solid rgba(200,146,42,0.4)",borderRadius:"0 2px 0 0",pointerEvents:"none"}} />
      <div style={{position:"absolute",bottom:6,left:6,width:18,height:18,borderBottom:"2px solid rgba(200,146,42,0.4)",borderLeft:"2px solid rgba(200,146,42,0.4)",borderRadius:"0 0 0 2px",pointerEvents:"none"}} />
      <div style={{position:"absolute",bottom:6,right:6,width:18,height:18,borderBottom:"2px solid rgba(200,146,42,0.4)",borderRight:"2px solid rgba(200,146,42,0.4)",borderRadius:"0 0 2px 0",pointerEvents:"none"}} />

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:10,position:"relative"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{
            width:42,height:42,borderRadius:5,
            background:"linear-gradient(135deg,#6b1414,#a83228)",
            border:"1px solid rgba(200,146,42,0.35)",
            display:"flex",alignItems:"center",justifyContent:"center",
            boxShadow:"0 0 16px rgba(168,50,40,0.6)",
            flexShrink:0,
          }}><StatIcon src={WARRIORS_ICON} size={28}/></div>
          <div>
            <div style={{fontFamily:"'Inter',sans-serif",fontWeight:900,fontSize:17,color:"#e6b048",letterSpacing:2,textTransform:"uppercase",textShadow:"0 0 20px rgba(200,146,42,0.5)",textAlign:"left"}}>Event Schedule</div>
            <div style={{fontSize:9,color:"rgba(110,88,64,0.9)",letterSpacing:3,fontWeight:700,textTransform:"uppercase",marginTop:1,textAlign:"left"}}>{CLAN_NAME} · Server Time</div>
          </div>
        </div>
        <div style={{display:"flex",gap:2,background:"rgba(0,0,0,0.5)",borderRadius:5,border:"1px solid rgba(200,146,42,0.15)",padding:3}}>
          {[["today","Today"],["week","Full Week"]].map(([id,label])=>(
            <button key={id} onClick={()=>setSchedTab(id)} style={{
              padding:"6px 14px", border:"none", borderRadius:4, cursor:"pointer",
              fontFamily:"'Inter',sans-serif", fontWeight:800, fontSize:10, letterSpacing:1,
              background: schedTab===id ? "linear-gradient(135deg,rgba(200,146,42,0.5),rgba(200,146,42,0.3))" : "transparent",
              color: schedTab===id ? "#f2cc60" : "rgba(110,88,64,0.9)",
              boxShadow: schedTab===id ? "0 0 10px rgba(200,146,42,0.2)" : "none",
              transition:"all 0.2s",
            }}>{label}</button>
          ))}
        </div>
      </div>

      {schedTab==="today" && (
        <div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
            <div style={{flex:1,height:1,background:"linear-gradient(90deg,rgba(200,146,42,0.4),transparent)"}} />
            <span style={{fontFamily:"'Inter',sans-serif",fontWeight:800,fontSize:10,color:"rgba(200,146,42,0.6)",letterSpacing:4,textTransform:"uppercase"}}>{dayName}</span>
            <div style={{flex:1,height:1,background:"linear-gradient(270deg,rgba(200,146,42,0.4),transparent)"}} />
          </div>
          {todaySched && todaySched.events.length>0 ? (
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {todaySched.events.map((ev,i)=><EventCard key={i} ev={ev} compact={false}/>)}
            </div>
          ) : (
            <div style={{textAlign:"center",padding:"40px 0",color:"rgba(110,88,64,0.7)",fontFamily:"'Inter',sans-serif"}}>
              <div style={{fontSize:40,marginBottom:10,opacity:0.3}}>🌙</div>
              <div style={{fontSize:14,fontStyle:"italic"}}>No events today, warrior. Rest and prepare.</div>
            </div>
          )}
        </div>
      )}

      {schedTab==="week" && (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {WEEKLY_SCHEDULE.map((day,di)=>{
            const isToday = dayName===day.day;
            return (
              <div key={di} style={{
                background: isToday?"rgba(200,146,42,0.05)":"transparent",
                border: isToday?"1px solid rgba(200,146,42,0.18)":"1px solid rgba(200,146,42,0.05)",
                borderRadius:5, padding: isToday?"12px 14px":"8px 4px",
              }}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  <span style={{
                    fontFamily:"'Inter',sans-serif",fontWeight:900,fontSize:11,letterSpacing:3,textTransform:"uppercase",
                    color: isToday?"#e6b048":"rgba(110,88,64,0.8)",
                    minWidth:90,
                  }}>{day.day}</span>
                  {isToday&&<div style={{
                    background:"linear-gradient(90deg,rgba(200,146,42,0.5),rgba(200,146,42,0.3))",
                    color:"#f2cc60",fontSize:7,fontWeight:900,letterSpacing:2,
                    padding:"2px 8px",borderRadius:20,textTransform:"uppercase",
                    boxShadow:"0 0 8px rgba(200,146,42,0.3)",
                  }}>TODAY</div>}
                  <div style={{flex:1,height:1,background:"linear-gradient(90deg,rgba(200,146,42,0.2),transparent)"}} />
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {day.events.map((ev,ei)=><EventCard key={ei} ev={ev} compact={true}/>)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ─── UPDATE NOTES ─────────────────────────────────────────────────────────────
const UPDATE_NOTES = [
  {
    version: "v2.3",
    date: "July 2026",
    title: "Clan HQ Visual Overhaul & Real Bug Fixes",
    color: "#b388ff",
    changes: [
      { icon: "🏛️", text: "Dashboard, Attendance, Auction House, Leaderboard, Members, and the login screen all got a full visual pass — corner-bracket panels, a stats strip up top on each page, and consistent gold/crimson styling throughout, instead of the old plain cards." },
      { icon: "🖱️", text: "Auction House: hovering an active auction's image now reveals its description and most recent bids without opening anything. Fixed a real bug where item images could get stuck permanently blurred after someone placed a bid." },
      { icon: "🔗", text: "Leaderboard and Members: every name is now clickable, jumping straight to that member's profile instead of needing an extra step." },
      { icon: "👑", text: "Player Info: rank #3 now gets the exact same premium treatment as #1 and #2. Ranks #4–10 get their own distinct banner style across Power, Richest, and Active — a clear step up from ranks 11+, without reusing the top-3 look. Top-10 Power members also get their class's artwork as their profile background." },
      { icon: "🐛", text: "Fixed a layout bug where a member ranking in the top 10 of more than one leaderboard (Power, Richest, Active) at once could see their profile banners overlap and break." },
      { icon: "📌", text: "The top navigation bar now stays properly pinned in place while scrolling, and the Admin Tools dropdown no longer pops open automatically when the page loads." },
      { icon: "🎉", text: "The \"Welcome back\" popup was redesigned with a cleaner layout, and featured auction items now show a ×N count instead of repeating the same item over and over when it's been featured multiple times." },
      { icon: "🔑", text: "The login screen now shows the clan's total power at a glance, plus a subtle tag naming the current #1 by Power." },
      { icon: "👥", text: "Members tab overhaul: a stats strip up top (total warriors, clan total power, coins in circulation, class breakdown), class filters you can click instead of a dropdown, a 7-day attendance streak per member, and the default sort changed from Coins to Power." },
      { icon: "🏆", text: "Fixed a real bug where some members' Auction Wins count on their profile didn't match how many auctions they'd actually won — a historical bug had inflated the number for 20 members. Corrected for everyone affected, and it's now protected against happening again, even if the same member wins multiple auctions closing at the same time." },
    ],
    // Short, atomic New/Fixed lines for the Discord announcement embed —
    // deliberately separate from `changes` above, which is written as
    // flowing in-app prose (often mixing a feature and a fix in the same
    // bullet) that doesn't split cleanly into one-line-per-item.
    discordSummary: {
      new: [
        "Full visual overhaul across every page",
        "Auction hover previews",
        "Clickable names everywhere",
        "Rank #4–10 profile banners",
        "7-day attendance streak",
        "Nav bar stays pinned while scrolling",
      ],
      fixed: [
        "Blurred auction images after bidding",
        "Profile banner overlap on multi-tier members",
        "Admin dropdown auto-opening on load",
        "Auction Wins count accuracy",
      ],
    },
  },
  {
    version: "v2.2",
    date: "June 2026",
    title: "Login News & Real Data-Loss Fixes",
    color: "#c8922a",
    changes: [
      { icon: "👋", text: "New: a welcome-back popup now shows every time you open the app — your current coin balance, plus anything new since your last visit (coins earned, bonuses, power changes, auctions won). If there's nothing new it just says so. Tick \"Don't show again today\" to skip it for the rest of the day." },
      { icon: "📢", text: "New: Masters and Elders can post announcements in Settings that show at the top of everyone's welcome-back popup until each person personally closes it — great for things like \"Clan Sanctuary tonight at 8pm.\"" },
      { icon: "🔨", text: "New: a \"Put in News\" button on any auction (and a checkbox when creating one) posts it straight to that same announcement space, with its image, current bid, and time left — exactly like the Live Auctions preview. Multiple items can be featured at once, and announcements + auction posts all coexist independently." },
      { icon: "🪙", text: "Fixed a real and serious bug: the background sync that keeps coins and history in sync across devices used to assume \"whichever copy has more entries is the newest one.\" That assumption could be wrong, and it was silently deleting real attendance and bonus history — coins were unaffected, but the record of how they were earned could vanish. Replaced with a proper check that compares actual entries, not just counts, so this can't happen again." },
      { icon: "🔧", text: "Recovered and restored attendance history that had been silently lost to the bug above for two recent events (Clan Sanctuary and World Boss), and manually paid out the Major Events Bonus to everyone who'd genuinely earned it but didn't receive it because of the missing records." },
      { icon: "📊", text: "Fixed the Power Surge chart on Player Info showing no movement even after a power update — a background music crash was silently interrupting the save partway through. Power history now records correctly going forward; everyone's chart has been given a fresh starting point so gains begin tracking immediately." },
      { icon: "🎬", text: "The clan's #1 and #2 most powerful members now get a special animated video backdrop on their Player Info page (currently live for Archer, more classes coming as assets are ready), with a class-specific title and flavor line. Falls back gracefully to the normal page on mobile and for classes without video yet." },
    ],
  },
  {
    version: "v2.1",
    date: "June 2026",
    title: "Push Notifications & Coin Economy Fixes",
    color: "#ff8a65",
    changes: [
      { icon: "🔔", text: "New: browser push notifications! Enable them from your profile menu (top right) to get notified the instant you're outbid, and again when an auction you're winning is about to end — even if you don't have ClanForge open. Works on PC and Android out of the box; on iPhone, add ClanForge to your Home Screen first for it to work." },
      { icon: "🖼️", text: "The Auction House now has its own full background image, matching the treasury theme of the rest of the app." },
      { icon: "🪙", text: "Fixed a real coin bug: getting outbid on multiple auctions around the same moment could cause part of your refund to be silently lost. Refunds are now applied as a single, indivisible operation so this can no longer happen, no matter how many auctions end at once." },
      { icon: "📋", text: "Fixed \"My Points History\" showing the same auction win duplicated many times across different timestamps. Existing duplicate entries have been cleaned up; this can no longer happen going forward." },
      { icon: "📅", text: "Weekly coin decay no longer depends on the Master happening to have the app open at the right time — it now runs on a real, independent schedule every Tuesday at 7:00 AM GMT+8, automatically." },
    ],
  },
  {
    version: "v2.0",
    date: "June 2026",
    title: "Mandarin Support & Major Bug Fixes",
    color: "#e8b84a",
    changes: [
      { icon: "🌐", text: "Full Mandarin (中文) translation added across the entire app — switch languages anytime with the EN / 中文 toggle on the login screen or top bar. Your choice is remembered." },
      { icon: "🎲", text: "Fixed Loot Roulette results disappearing after a refresh and not showing up for other members — results now save and sync reliably for everyone." },
      { icon: "📋", text: "Fixed attendance recorded by Elders sometimes not appearing in the History tab, even though coins were correctly given out." },
      { icon: "🪙", text: "Fixed a bug where submitted attendance could fail to credit coins to the member, with no error shown." },
      { icon: "✨", text: "Two new item rarities added to the Auction House: Uncommon and Common." },
      { icon: "📜", text: "Auction History redesigned as a compact table showing Date & Time, Item, Rarity, Winner, and Final Bid at a glance." },
      { icon: "⬇️", text: "Elders and Master can now download a CSV of any single attendance event's roster directly from the History tab." },
      { icon: "✅", text: "Elders can now use Add Missing Record to backfill attendance, previously Master-only." },
      { icon: "📅", text: "One-time exception: this week's coin decay runs on Wednesday, June 24 instead of Tuesday. The regular Tuesday 7:00 AM GMT+8 schedule resumes the following week — and that schedule is now fixed to GMT+8 for everyone, regardless of where you're browsing from." },
      { icon: "🔄", text: "Attendance counts now automatically reset to 0 at the start of every month (midnight GMT+8 on the 1st)." },
      { icon: "📈", text: "The Power leaderboard now shows each member's coin multiplier next to their rank." },
    ],
  },
  {
    version: "v1.9",
    date: "June 2026",
    title: "Auction Timer Fix & QoL Changes",
    color: "#6dbf76",
    changes: [
      { icon: "⏱️", text: "Auction timer now accurate — fixed a bug where auctions could close while members still had 20–30s on their timer due to clock differences between devices" },
      { icon: "🛡️", text: "Snipe protection added — a bid placed in the last 60 seconds extends the auction by 2 minutes so no one gets sniped at the last second" },
      { icon: "❌", text: "Retract Bid removed — it was causing too many issues and has been disabled for now" },
      { icon: "📋", text: "Global Points Log cleaned up — now only shows Admin Manual Adjustments and coins earned from bonuses" },
      { icon: "📅", text: "My Attendance fixed — you can now correctly view your own attendance history again" },
    ],
  },
  {
    version: "v1.8",
    date: "June 2026",
    title: "Auction House Fixes & Live Ticker",
    color: "#4fc3f7",
    changes: [
      { icon: "📢", text: "New live bid ticker — a scrolling marquee at the top of the Auction House shows the last 5 bids in real time for everyone to see" },
      { icon: "🏆", text: "Auctions you're currently winning always float to the top of the list so you can instantly tell if you've been outbid" },

      { icon: "🖼", text: "Fixed auction item images disappearing when switching pages or after bids are placed" },
      { icon: "📋", text: "Bid history is now saved to the database — bid counts are accurate and history persists across refreshes" },
      { icon: "🔒", text: "Only the Master rank can now remove auctions" },
    ],
  },
  {
    version: "v1.7",
    date: "June 2026",
    title: "Bid Safety & Stability",
    color: "#4fc3f7",
    changes: [
      { icon: "🔒", text: "Last-second bid protection — if someone outbids you in the exact moment you click Submit, the app catches it and lets you know instead of silently overwriting the bid." },
      { icon: "⏱", text: "Smoother refreshing — bid and coin updates are now staggered so the app stays snappy even when lots of members are online at the same time." },
      { icon: "⏳", text: "No more infinite loading — if the app takes too long to connect, it now gives up cleanly after 8 seconds instead of getting stuck on a blank screen." },
    ],
  },
  {
    version: "v1.6",
    date: "June 2026",
    title: "Auction House Overhaul",
    color: "#c8922a",
    changes: [
      { icon: "📋", text: "Collapsed view removed — Compact view now handles dense listings cleanly" },
      { icon: "⊞", text: "Sort and View controls converted to dropdowns — cleaner toolbar, less clutter" },
      { icon: "📐", text: "Compact view: bidder name now sits directly below item name, left-aligned" },
      { icon: "🏷", text: "Compact view: rarity badge and WINNING tag stay on the name row for quick scanning" },
      { icon: "📡", text: "Live bid sync — all users see updated bids and coin balances within 3–5 seconds" },
      { icon: "💰", text: "Coin balances sync across all sessions so refunds and deductions show instantly" },
      { icon: "🪙", text: "Browser tab now shows PeakyBlinders with the gold coins icon" },

    ],
  },
  {
    version: "v1.5",
    date: "June 2026",
    title: "Auction House Improvements",
    color: "#d4a017",
    changes: [
      { icon: "🔃", text: "Auction House can now be sorted by Bid (High → Low), Bid (Low → High), or Rarity" },
      { icon: "🏆", text: "Top bidder name now shown as a prominent green badge — easy to see at a glance who's leading" },
      { icon: "💡", text: "Sorting applies to both Live Auctions and History tabs" },
    ],
  },
  {
    version: "v1.4",
    date: "June 2026",
    title: "Bonus System Revamp",
    color: "#9b59b6",
    changes: [
      { icon: "🏆", text: "Major Events bonus reduced to +300 coins (was +500) for attending all event types in a week" },
      { icon: "🔮", text: "New: Sindri Veteran bonus — attend 2× Sindri's Treasure Island per week for 5 weeks to earn +400 coins (one-time)" },
      { icon: "⚔", text: "ISB Veteran bonus reduced to +500 coins (was +1,000) for reaching 10 lifetime ISB events" },
      { icon: "❌", text: "Streak Bonus removed and replaced by Sindri Veteran" },
    ],
  },
  {
    version: "v1.3",
    date: "June 2026",
    title: "Event Attendance Requirements",
    color: "#e67e22",
    changes: [
      { icon: "🗡", text: "Clan Annihilation now requires 2× attendance per week to count toward Major Events bonus" },
      { icon: "🔮", text: "Sindri's Treasure Island now requires 2× attendance per week to count toward Major Events bonus" },
      { icon: "🌍", text: "World Boss now requires 3× attendance per week to count toward Major Events bonus" },
      { icon: "✅", text: "Bonuses are now automatically paid out when attendance is recorded — no manual action needed" },
    ],
  },
  {
    version: "v1.2",
    date: "June 2026",
    title: "Loot Roulette Fix",
    color: "#e74c3c",
    changes: [
      { icon: "🎲", text: "Fixed: Loot Roulette results now visible to all members after a roll, not just the Elder who rolled" },
      { icon: "📡", text: "Results auto-sync to all members within 10 seconds via live database polling" },
      { icon: "🔔", text: "New gold banner appears for everyone when a new loot roll is published" },
      { icon: "↺", text: "Added manual Refresh Now button on the History tab for instant updates" },
    ],
  },
  {
    version: "v1.1",
    date: "June 2026",
    title: "Rank Multiplier & Coin System",
    color: "#27ae60",
    changes: [
      { icon: "📊", text: "Power rank multiplier applied to all attendance coin rewards (top ranked members earn more)" },
      { icon: "💰", text: "Coin decay of -5% applies every Tuesday to encourage spending" },
      { icon: "🏅", text: "Auction wins now tracked on member profiles and leaderboard" },
    ],
  },
];

function UpdateNotes({ ctx }) {
  const { currentUser, addToast } = ctx;
  const isAdmin = !!currentUser && (currentUser.role === "Elder" || currentUser.role === "Master");
  const [expanded, setExpanded] = React.useState(null);
  const [showAll, setShowAll] = React.useState(false);
  const [posting, setPosting] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(() => {
    try { return localStorage.getItem("update_notes_dismissed") === "true"; } catch { return false; }
  });

  if (dismissed) return null;

  // Builds the announcement from whichever version is currently
  // "LATEST" (UPDATE_NOTES[0]) — New/Fixed columns come from that
  // version's own discordSummary, kept separate from the flowing in-app
  // prose in `changes` (which often mixes a feature and a fix in the
  // same bullet and doesn't split cleanly into one line per item).
  async function postLatestUpdateToDiscord() {
    const latest = UPDATE_NOTES[0];
    if (!latest.discordSummary) {
      addToast("This version has no Discord summary configured yet.", "red", "Can't Post");
      return;
    }
    setPosting(true);
    const colorInt = parseInt(latest.color.replace("#", ""), 16);
    const fields = [];
    // Discord only renders a bullet marker with explicit markdown syntax
    // ("- item" per line) — a plain \n-joined list just shows as stacked
    // lines with no marker at all.
    if (latest.discordSummary.new?.length) {
      fields.push({ name: "New", value: latest.discordSummary.new.map(x => `- ${x}`).join("\n"), inline: true });
    }
    if (latest.discordSummary.fixed?.length) {
      fields.push({ name: "Fixed", value: latest.discordSummary.fixed.map(x => `- ${x}`).join("\n"), inline: true });
    }
    const ok = await notifyDiscord({ embeds: [{
      title: latest.title,
      description: `Update · ${latest.version}`,
      color: colorInt,
      fields,
      footer: { text: `ClanForge · ${latest.date}` },
    }] }, "general");
    setPosting(false);
    if (ok) addToast(`Posted ${latest.version} to Discord.`, "gold", "Announced");
    else addToast("Couldn't reach Discord — try again in a moment.", "red", "Post Failed");
  }

  const VISIBLE = 5;
  const visibleNotes = showAll ? UPDATE_NOTES : UPDATE_NOTES.slice(0, VISIBLE);
  const hasMore = UPDATE_NOTES.length > VISIBLE;

  return (
    <div style={{
      marginBottom: 24, position: "relative", overflow: "hidden",
      background: "linear-gradient(135deg,rgba(10,8,6,0.9),rgba(18,14,11,0.95))",
      border: "1px solid rgba(200,146,42,0.25)", borderRadius: 8, textAlign: "left",
    }}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,rgba(200,146,42,0.8),transparent)"}} />
      {/* Header */}
      <div className="update-notes-header" style={{
        display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"16px 20px",borderBottom:"1px solid rgba(200,146,42,0.12)",flexWrap:"wrap",gap:10,textAlign:"left"
      }}>
        <div className="update-notes-header-left" style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <div style={{
            width:36,height:36,borderRadius:5,flexShrink:0,
            background:"linear-gradient(135deg,rgba(200,146,42,0.3),rgba(200,146,42,0.1))",
            border:"1px solid rgba(200,146,42,0.35)",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,
          }}>📋</div>
          <div>
            <div style={{fontFamily:"'Inter',sans-serif",fontWeight:900,fontSize:14,color:"var(--gold-light)",letterSpacing:1}}>Update Notes</div>
            <div style={{fontSize:10,color:"var(--text-dim)",fontWeight:600,letterSpacing:2,textTransform:"uppercase"}}>Recent Changes</div>
          </div>
          <span className="update-notes-badge" style={{
            fontSize:9,fontWeight:900,letterSpacing:2,textTransform:"uppercase",whiteSpace:"nowrap",
            background:"linear-gradient(135deg,rgba(200,146,42,0.4),rgba(200,146,42,0.2))",
            border:"1px solid rgba(200,146,42,0.4)",borderRadius:20,padding:"2px 10px",
            color:"var(--gold-light)",
          }}>{UPDATE_NOTES[0].version} · LATEST</span>
          {isAdmin && (
            <button
              className="btn btn-outline btn-sm"
              disabled={posting}
              style={{fontSize:10,opacity:posting?0.6:1}}
              onClick={postLatestUpdateToDiscord}
            >{posting ? "Posting…" : "Announce in Discord"}</button>
          )}
        </div>
        <button
          className="btn btn-ghost btn-sm"
          style={{fontSize:10,color:"var(--text-dim)",opacity:0.7}}
          onClick={()=>{ setDismissed(true); try{localStorage.setItem("update_notes_dismissed","true");}catch{} }}
        >✕ Dismiss</button>
      </div>
      {/* Patches list */}
      <div style={{padding:"12px 20px",display:"flex",flexDirection:"column",gap:4,textAlign:"left"}}>
        {visibleNotes.map((patch,pi)=>(
          <div key={pi} style={{borderRadius:5,overflow:"hidden",border:`1px solid ${patch.color}22`,background:"rgba(0,0,0,0.25)"}}>
            {/* Patch row */}
            <div
              onClick={()=>setExpanded(expanded===pi?null:pi)}
              style={{
                display:"flex",alignItems:"center",gap:12,padding:"10px 14px",cursor:"pointer",
                transition:"background 0.15s",flexWrap:"wrap",rowGap:4,
                background:expanded===pi?`${patch.color}12`:"transparent",
              }}
              onMouseEnter={e=>e.currentTarget.style.background=`${patch.color}10`}
              onMouseLeave={e=>e.currentTarget.style.background=expanded===pi?`${patch.color}12`:"transparent"}
            >
              <div style={{width:6,height:6,borderRadius:"50%",background:patch.color,boxShadow:`0 0 6px ${patch.color}`,flexShrink:0}} />
              <span style={{fontFamily:"'Inter',sans-serif",fontWeight:800,fontSize:11,color:patch.color,minWidth:32,flexShrink:0,letterSpacing:0.5,textAlign:"left"}}>{patch.version}</span>
              <span className="patch-title" style={{fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:12,color:"var(--text-bright)",flex:"1 1 160px",minWidth:0,textAlign:"left"}}>{patch.title}</span>
              <span style={{fontSize:10,color:"var(--text-dim)",fontFamily:"'Inter',sans-serif",flexShrink:0,textAlign:"left",marginLeft:"auto"}}>{patch.date}</span>
              <span style={{fontSize:9,color:"var(--text-dim)",marginLeft:4,flexShrink:0,transition:"transform 0.2s",display:"inline-block",transform:expanded===pi?"rotate(180deg)":"rotate(0deg)"}}>▼</span>
            </div>
            {/* Change list */}
            {expanded===pi&&(
              <div style={{padding:"6px 14px 12px 14px",borderTop:`1px solid ${patch.color}18`,textAlign:"left"}}>
                {patch.changes.map((c,ci)=>(
                  <div key={ci} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"5px 0",borderBottom:ci<patch.changes.length-1?`1px solid rgba(255,255,255,0.04)`:"none"}}>
                    <span style={{width:5,height:5,borderRadius:"50%",background:"var(--text-dim)",flexShrink:0,marginTop:6,opacity:0.6}}></span>
                    <span style={{fontSize:12,color:"var(--text-dim)",fontFamily:"'Inter',sans-serif",lineHeight:1.6,textAlign:"left"}}>{c.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {/* Show all / collapse button */}
        {hasMore && (
          <button
            onClick={()=>{ setShowAll(s=>!s); if(showAll) setExpanded(null); }}
            style={{
              marginTop:6,width:"100%",padding:"8px 0",cursor:"pointer",
              background:"transparent",border:"1px solid rgba(200,146,42,0.2)",borderRadius:4,
              fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:11,
              color:"var(--gold-dim)",letterSpacing:1,textTransform:"uppercase",
              transition:"all .15s",
            }}
            onMouseEnter={e=>{e.currentTarget.style.background="rgba(200,146,42,0.08)";e.currentTarget.style.borderColor="rgba(200,146,42,0.4)";}}
            onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor="rgba(200,146,42,0.2)";}}
          >
            {showAll ? `▲ Show less` : `▼ See all ${UPDATE_NOTES.length} updates (${UPDATE_NOTES.length - VISIBLE} older)`}
          </button>
        )}
      </div>
    </div>
  );
}

// Reusable 4-corner bracket ornament — the hero banner and World Boss
// Schedule sections each hand-rolled their own copy of this same 4-div
// pattern; extracted here since Dashboard's redesign reuses it several
// more times across differently-sized cards (hence the size/inset/opacity
// knobs, so smaller cards can get proportionally smaller brackets instead
// of the hero's full-size ones looking oversized on a compact stat card).
function CornerBrackets({ size = 18, thickness = 2, inset = 6, opacity = 0.4 }) {
  const base = { position:"absolute", width:size, height:size, pointerEvents:"none" };
  const color = `rgba(200,146,42,${opacity})`;
  return (
    <>
      <div style={{...base, top:inset, left:inset, borderTop:`${thickness}px solid ${color}`, borderLeft:`${thickness}px solid ${color}`}} />
      <div style={{...base, top:inset, right:inset, borderTop:`${thickness}px solid ${color}`, borderRight:`${thickness}px solid ${color}`}} />
      <div style={{...base, bottom:inset, left:inset, borderBottom:`${thickness}px solid ${color}`, borderLeft:`${thickness}px solid ${color}`}} />
      <div style={{...base, bottom:inset, right:inset, borderBottom:`${thickness}px solid ${color}`, borderRight:`${thickness}px solid ${color}`}} />
    </>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ ctx, setPage }) {
  const { members, auctions, currentUser, isGuest } = ctx;
  const { t } = useLang();
  const [wtMode, setWtMode] = useState("attendance");
  const activeAuctions = auctions.filter(a=>a.status==="active");
  const recentWinners = auctions.filter(a=>a.status==="ended"&&a.topBidder).slice(0,3);

  const ROLE_COLOR = { Master:"#c8922a", Elder:"#e07070", Member:"#7098c8" };
  const roleColor = ROLE_COLOR[currentUser?.role] || "#9c8c7c";

  // ── Clan Power & Class Composition (derived live from members, no extra
  // data needed — recomputed on every render since `members` already
  // changes whenever anyone's power/class updates elsewhere in the app) ──
  const totalPower = members.reduce((sum, m) => sum + (m.power || 0), 0);
  const classBreakdown = useMemo(() => {
    const counts = {};
    members.forEach(m => { counts[m.cls] = (counts[m.cls] || 0) + 1; });
    const total = members.length || 1;
    return CLASSES
      .map(cls => ({ cls, count: counts[cls] || 0, pct: (counts[cls] || 0) / total * 100 }))
      .filter(c => c.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [members]);
  const maxClassPct = Math.max(...classBreakdown.map(c => c.pct), 1);


  return (
    <div>
      {/* ── EPIC WELCOME BANNER ─────────────────────────────────────────────── */}
      <div style={{
        position:"relative", overflow:"hidden", borderRadius:8, marginBottom:28,
        background:"linear-gradient(135deg,#070507 0%,#100a0a 35%,#0a0d14 65%,#070507 100%)",
        border:"1px solid rgba(200,146,42,0.18)",
        boxShadow:"0 8px 48px rgba(0,0,0,0.8), inset 0 1px 0 rgba(200,146,42,0.12)",
      }}>
        {/* Animated background orbs */}
        <div style={{position:"absolute",inset:0,pointerEvents:"none"}}>
          <div style={{position:"absolute",top:"-30%",left:"-10%",width:"55%",height:"200%",background:"radial-gradient(ellipse,rgba(122,26,26,0.12) 0%,transparent 65%)"}} />
          <div style={{position:"absolute",top:"-20%",right:"-5%",width:"45%",height:"180%",background:"radial-gradient(ellipse,rgba(201,151,42,0.09) 0%,transparent 60%)"}} />
          <div style={{position:"absolute",bottom:0,left:"30%",width:"40%",height:"60%",background:"radial-gradient(ellipse,rgba(70,30,100,0.08) 0%,transparent 70%)"}} />
        </div>
        {/* Top accent line */}
        <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent 0%,rgba(122,26,26,0.6) 20%,rgba(200,146,42,0.9) 50%,rgba(122,26,26,0.6) 80%,transparent 100%)"}} />
        {/* Bottom accent line */}
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:1,background:"linear-gradient(90deg,transparent 0%,rgba(200,146,42,0.2) 40%,rgba(200,146,42,0.2) 60%,transparent 100%)"}} />
        {/* Corner rune marks */}
        <div style={{position:"absolute",top:14,left:14,width:18,height:18,borderTop:"2px solid rgba(200,146,42,0.4)",borderLeft:"2px solid rgba(200,146,42,0.4)"}} />
        <div style={{position:"absolute",top:14,right:14,width:18,height:18,borderTop:"2px solid rgba(200,146,42,0.4)",borderRight:"2px solid rgba(200,146,42,0.4)"}} />
        <div style={{position:"absolute",bottom:14,left:14,width:18,height:18,borderBottom:"2px solid rgba(200,146,42,0.4)",borderLeft:"2px solid rgba(200,146,42,0.4)"}} />
        <div style={{position:"absolute",bottom:14,right:14,width:18,height:18,borderBottom:"2px solid rgba(200,146,42,0.4)",borderRight:"2px solid rgba(200,146,42,0.4)"}} />

        <div style={{position:"relative",padding:"clamp(18px,4vw,32px) clamp(18px,4vw,36px)"}}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:20,textAlign:"left"}}>

            {/* Left — clan identity */}
            <div className="dashboard-banner-left" style={{flex:"1 1 280px",textAlign:"left"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <div style={{width:28,height:1,background:"linear-gradient(90deg,transparent,rgba(200,146,42,0.6))"}} />
                <span style={{fontSize:9,color:"rgba(200,146,42,0.7)",letterSpacing:5,textTransform:"uppercase",fontFamily:"'Inter',sans-serif",fontWeight:700}}>Clan HQ · {CLAN_SEASON_LABEL}</span>
                <div style={{width:28,height:1,background:"linear-gradient(90deg,rgba(200,146,42,0.6),transparent)"}} />
              </div>
              <div style={{fontFamily:"'Spectral',serif",fontSize:42,fontWeight:900,lineHeight:1,marginBottom:12,
                background:"linear-gradient(135deg,#f2d98a 0%,#c8922a 45%,#f2d98a 75%,#a06820 100%)",
                WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",
                textShadow:"none",letterSpacing:1,
              }}>{CLAN_NAME}</div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
                <span style={{fontSize:10,fontWeight:700,letterSpacing:2,textTransform:"uppercase",
                  background:"rgba(122,26,26,0.35)",border:"1px solid rgba(200,80,80,0.3)",
                  borderRadius:20,padding:"3px 12px",color:"#e07070"
                }}><span style={{display:"inline-flex",alignItems:"center",gap:5}}><SwordsIcon size={11}/>{members.length} {t("warriors")}</span></span>
                <span style={{fontSize:10,fontWeight:700,letterSpacing:2,textTransform:"uppercase",
                  background:"rgba(201,151,42,0.15)",border:"1px solid rgba(201,151,42,0.3)",
                  borderRadius:20,padding:"3px 12px",color:"var(--gold-light)"
                }}><span style={{display:"inline-flex",alignItems:"center",gap:5}}><ColumnIcon size={11}/>{auctions.filter(a=>a.status==="active").length} {t("liveAuctions")}</span></span>
              </div>
              {currentUser && (
              <>
              {/* Divider */}
              <div style={{height:1,background:"linear-gradient(90deg,rgba(200,146,42,0.25),transparent)",marginBottom:16,width:"80%"}} />
              {/* Greeter */}
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:36,height:36,borderRadius:"50%",border:`2px solid ${roleColor}66`,
                  background:`radial-gradient(circle,${roleColor}22,rgba(10,8,6,0.6))`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:16,flexShrink:0,
                }}>
                  {currentUser.role==="Master"?<CrownIcon size={17}/>:currentUser.role==="Elder"?<ShieldIcon size={17}/>:<SwordsIcon size={17}/>}
                </div>
                <div>
                  <div style={{fontFamily:"'Inter',sans-serif",fontWeight:800,fontSize:15,color:"var(--text-bright)"}}>
                    {currentUser.name}
                  </div>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:roleColor}}>
                    {currentUser.role} · {currentUser.cls}
                  </div>
                </div>
              </div>
              </>
              )}
            </div>

            {/* Right — Total Power + Class Composition, folded into the hero
                itself (rather than separate cards below it) so identity and
                at-a-glance stats read as one unified zone instead of two. */}
            <div style={{flex:"1 1 280px",minWidth:0,textAlign:"left"}}>
              <div style={{fontSize:10,letterSpacing:3,textTransform:"uppercase",color:"rgba(200,146,42,0.7)",fontWeight:700,marginBottom:6,fontFamily:"'Inter',sans-serif"}}>{t("clanTotalPower")}</div>
              <div style={{
                fontFamily:"'Spectral',serif",fontSize:40,fontWeight:800,lineHeight:1,marginBottom:4,
                background:"linear-gradient(135deg,#f2d98a 0%,#c8922a 50%,#f2d98a 100%)",
                WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",
                textShadow:"0 0 30px rgba(200,146,42,0.35)",
              }}>{fmt(totalPower)}</div>
              <div style={{fontSize:11,color:"#7c6d58",marginBottom:16,fontFamily:"'Inter',sans-serif"}}>{t("acrossWarriors").replace("{count}", members.length)}</div>

              {currentUser && (
              <div style={{display:"flex",gap:24,marginBottom:18}}>
                <div>
                  <div style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:"#7c6d58",marginBottom:4,fontFamily:"'Inter',sans-serif"}}>{t("yourPower")}</div>
                  <div style={{fontSize:15,fontWeight:800,color:"var(--gold-light)",fontFamily:"'Inter',sans-serif",display:"inline-flex",alignItems:"center",gap:5}}><PowerIcon size={14}/>{fmt(currentUser.power)}</div>
                </div>
                <div>
                  <div style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:"#7c6d58",marginBottom:4,fontFamily:"'Inter',sans-serif"}}>{t("yourCoins")}</div>
                  <div style={{fontSize:15,fontWeight:800,color:"var(--gold-light)",fontFamily:"'Inter',sans-serif",display:"inline-flex",alignItems:"center",gap:4}}><StatIcon src={COINS_ICON} size={22}/>{fmt(currentUser.coins)}</div>
                </div>
              </div>
              )}

              {/* Class Composition — condensed to the top 3 classes as
                  slim glowing bars, rather than the full bar-chart the
                  standalone card used to show; this is a hero readout, not
                  a detailed breakdown. */}
              <div style={{fontSize:10,letterSpacing:3,textTransform:"uppercase",color:"rgba(200,146,42,0.7)",fontWeight:700,marginBottom:10,fontFamily:"'Inter',sans-serif"}}>{t("classComposition")}</div>
              <div style={{display:"flex",flexDirection:"column",gap:7}}>
                {classBreakdown.slice(0,3).map(({cls,pct}) => {
                  const col = CLASS_COLORS[cls] || "#9c8c7c";
                  return (
                    <div key={cls} style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:10,color:"#9c8c7c",width:76,flexShrink:0,fontFamily:"'Inter',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cls}</span>
                      <div style={{flex:1,height:5,background:"rgba(255,255,255,0.06)",borderRadius:3,overflow:"hidden"}}>
                        <div style={{width:`${(pct/maxClassPct)*100}%`,height:"100%",background:`linear-gradient(90deg,${col},${col}cc)`,boxShadow:`0 0 6px ${col}66`}} />
                      </div>
                      <span style={{fontSize:10,fontWeight:800,color:col,width:30,textAlign:"right",flexShrink:0,fontFamily:"'Inter',sans-serif"}}>{Math.round(pct)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Update Notes — clan-wide announcements, sits just under the hero
          rather than inside either column below since it isn't part of
          either column's theme (timely activity vs. at-a-glance stats). */}
      <div style={{marginBottom:36}}><UpdateNotes ctx={ctx} /></div>

      {/* ── Command Deck — asymmetric two-column split below the hero:
          a wide primary column for timely/content-rich material (World
          Boss Schedule, Live Auctions) and a narrower sidebar column for
          at-a-glance secondary widgets (Mini Leaderboard, Recent Winners,
          Event Points) — replaces the previous uniform stacked-card-row
          structure with real hierarchy between primary and secondary
          content. Stacks to a single column below ~900px. */}
      <div style={{display:"flex",flexWrap:"wrap",gap:24}}>
        {/* Primary column */}
        <div style={{flex:"2 1 500px",minWidth:0}}>
          <WorldBossSchedule />

          {/* Live Auctions Preview */}
          <div className="dash-panel" style={{
            marginTop:24,position:"relative",overflow:"hidden",
            background:"linear-gradient(135deg,#161110 0%,#1c1410 60%,#161110 100%)",
            border:"1px solid rgba(200,146,42,0.2)",borderRadius:6,padding:20,
          }}>
          <CornerBrackets size={11} thickness={1.5} inset={7} opacity={0.35}/>
          <SectionTitle><span style={{display:"inline-flex",alignItems:"center",gap:6}}><StatIcon src={AUCTION_ICON} size={32}/>{t("liveAuctions")}</span></SectionTitle>
          {activeAuctions.length===0&&<div style={{color:"var(--text-dim)",fontSize:13,fontFamily:"'Inter',sans-serif"}}>{t("noActiveAuctions")}</div>}
          {[...activeAuctions].sort((a,b)=>b.currentBid-a.currentBid).slice(0,3).map(a=>(
            <div key={a.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid var(--border-dim)"}}>
              <div style={{width:42,height:42,borderRadius:2,overflow:"hidden",background:a.rarity==="epic"?"rgba(122,26,26,0.3)":"rgba(26,90,138,0.3)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:"1px solid var(--border)"}}>
                {a.image?<AuctionImage auction={a} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} fallback={<span style={{fontSize:22}}>{a.emoji}</span>}/>:<span style={{fontSize:22}}>{a.emoji}</span>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:13,color:"var(--text-bright)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</div>
                <div style={{fontSize:11,color:"var(--text-dim)",fontWeight:500}}>{t("topBidderLabel")}: {a.topBidder||t("noBids")}</div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontFamily:"'Inter',sans-serif",fontWeight:800,fontSize:15,color:"var(--gold-light)",display:"inline-flex",alignItems:"center",gap:4}}><StatIcon src={COINS_ICON} size={24}/>{fmt(a.currentBid)}</div>
                <div style={{fontSize:10,color:"#e07070",fontWeight:700,letterSpacing:1}}>{timeLeft(a.endsAt)}</div>
              </div>
            </div>
          ))}
          <button className="btn btn-outline btn-sm" style={{marginTop:14,width:"100%"}} onClick={()=>setPage("auctions")}>{t("viewAllAuctions")}</button>
          </div>
        </div>

        {/* Sidebar column — at-a-glance secondary widgets */}
        <div style={{flex:"1 1 320px",minWidth:0}}>
        {/* Mini Leaderboard Switcher */}
        <div className="dash-panel" style={{
          position:"relative",overflow:"hidden",
          background:"linear-gradient(135deg,#161110 0%,#1c1410 60%,#161110 100%)",
          border:"1px solid rgba(200,146,42,0.2)",borderRadius:6,padding:20,
        }}>
          <CornerBrackets size={11} thickness={1.5} inset={7} opacity={0.35}/>
          {(()=>{
            const WT_MODES=[{id:"attendance",label:t("topAttendance")},{id:"power",label:t("topPower")},...(!isGuest?[{id:"coins",label:t("richest")}]:[])];
            const sorted=[...members].sort((a,b)=>b[wtMode]-a[wtMode]).slice(0,5);
            const valFn=m=>wtMode==="attendance"?`${m.attendance} att`:wtMode==="power"?fmt(m.power):fmt(m.coins);
            const valColor=wtMode==="attendance"?"#60aadd":wtMode==="power"?"#a8b8c8":"var(--gold-light)";
            return(<>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
                <span style={{display:"inline-flex",alignItems:"center",gap:6,fontFamily:"'Inter',sans-serif",fontWeight:800,fontSize:15,color:"var(--gold-light)"}}><LBIcon src={LEADERBOARD_ICON} size={16}/>{WT_MODES.find(m=>m.id===wtMode)?.label}</span>
                <select style={{background:"rgba(10,8,6,0.85)",border:"1px solid var(--border)",color:"var(--gold-light)",fontFamily:"'Inter',sans-serif",fontSize:10,fontWeight:700,padding:"4px 8px",borderRadius:4,cursor:"pointer",letterSpacing:1}} value={wtMode} onChange={e=>setWtMode(e.target.value)}>
                  {WT_MODES.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </div>
              {sorted.map((m,i)=>(
                <div key={m.id} className="lb-row">
                  <div className="lb-rank">{rankIcon(i)}</div>
                  <ClassIcon cls={m.cls} size={36}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div className="lb-name" style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textAlign:"left"}}>{m.name}</div>
                    <div style={{fontSize:10,color:"var(--text-dim)",fontWeight:600,letterSpacing:1,textAlign:"left"}}>{m.cls}</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontFamily:"'Inter',sans-serif",fontWeight:800,fontSize:14,color:valColor}}>{valFn(m)}</div>
                    {wtMode!=="coins"&&!isGuest&&<div style={{fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:11,color:"var(--gold-light)",display:"inline-flex",alignItems:"center",gap:3}}><StatIcon src={COINS_ICON} size={20}/>{fmt(m.coins)}</div>}
                  </div>
                </div>
              ))}
            </>);
          })()}
        </div>

        {/* Recent Winners */}
        <div className="dash-panel" style={{
          marginTop:24,position:"relative",overflow:"hidden",
          background:"linear-gradient(135deg,#161110 0%,rgba(201,151,42,0.08) 60%,#161110 100%)",
          border:"1px solid rgba(201,151,42,0.3)",borderRadius:6,padding:20,
        }}>
          <CornerBrackets size={11} thickness={1.5} inset={7} opacity={0.4}/>
          <SectionTitle>{t("recentWinners")}</SectionTitle>
          {recentWinners.length===0&&<div style={{color:"var(--text-dim)",fontSize:13,fontFamily:"'Inter',sans-serif"}}>{t("noRecentWinners")}</div>}
          {recentWinners.map(a=>(
            <div key={a.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid var(--border-dim)"}}>
              <div style={{width:36,height:36,borderRadius:2,overflow:"hidden",background:"var(--bg-mid)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {a.image?<AuctionImage auction={a} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} fallback={<StatIcon src={AUCTION_ICON} size={32}/>}/>:<StatIcon src={AUCTION_ICON} size={32}/>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:12,color:"var(--gold-light)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.topBidder}</div>
                <div style={{fontSize:11,color:"var(--text-dim)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</div>
              </div>
              <div style={{fontFamily:"'Inter',sans-serif",fontWeight:800,fontSize:15,color:"var(--gold)",flexShrink:0}}><span style={{display:"inline-flex",alignItems:"center",gap:4}}><StatIcon src={COINS_ICON} size={24}/>{fmt(a.currentBid)}</span></div>
            </div>
          ))}
        </div>

        {/* Event Points */}
        <div className="dash-panel" style={{
          marginTop:24,position:"relative",overflow:"hidden",
          background:"linear-gradient(135deg,#0d1218 0%,rgba(26,90,138,0.1) 60%,#0d1218 100%)",
          border:"1px solid rgba(26,90,138,0.4)",borderRadius:6,padding:20,
        }}>
          <CornerBrackets size={11} thickness={1.5} inset={7} opacity={0.35}/>
          <SectionTitle>{t("eventPoints")}</SectionTitle>
          {EVENTS.map(ev=>(
            <div key={ev.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid rgba(26,90,138,0.12)"}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:ev.color,flexShrink:0,boxShadow:`0 0 6px ${ev.color}`}}/>
              <div style={{flex:1,fontSize:12,color:"var(--text)",fontFamily:"'Inter',sans-serif",fontWeight:500}}>{ev.name}</div>
              <div style={{fontFamily:"'Inter',sans-serif",fontWeight:800,fontSize:13,color:"var(--gold-light)"}}>+{ev.coins}</div>
              <span className="badge badge-blue">{ev.id}</span>
            </div>
          ))}
        </div>
        </div>
      </div>
    </div>
  );
}

// ─── MEMBERS ──────────────────────────────────────────────────────────────────
function Members({ ctx }) {
  const { members, setMembers, currentUser, addToast, setModal } = ctx;
  const { t } = useLang();
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("All");
  const [sortBy, setSortBy] = useState("power");
  const [selectedMember, setSelectedMember] = useState(null);
  const [viewingProfile, setViewingProfile] = useState(null);
  const [page, setPage] = useState(0);
  const isAdmin = !!currentUser && (currentUser.role==="Elder"||currentUser.role==="Master");

  // Power rank computed independent of the table's current sort/search/
  // filter, so the tier accent stripe always reflects a member's real
  // standing — same byPower pattern PlayerInfo uses for its own rank
  // badges, and the same colors ProfileCard's ribbon already uses.
  const byPower = [...members].sort((a,b)=>b.power-a.power);
  const powerRankOf = id => byPower.findIndex(m=>m.id===id)+1;
  const TIER_STRIPE_COLOR = {1:"#c77dff",2:"#f2cc60",3:"#fe7e73"};

  const totalPower = members.reduce((s,m)=>s+(m.power||0),0);
  const totalCoins = members.reduce((s,m)=>s+(m.coins||0),0);
  // Classes with zero members don't get a row — a clan that's never
  // recruited a given class shouldn't see an empty bar cluttering the
  // composition chart.
  const classComposition = CLASSES
    .map(c => ({cls:c, count: members.filter(m=>m.cls===c).length}))
    .filter(c => c.count > 0)
    .sort((a,b) => b.count-a.count);
  const maxClassCount = Math.max(1, ...classComposition.map(c=>c.count));

  const filtered = members
    .filter(m=>m.name.toLowerCase().includes(search.toLowerCase()))
    .filter(m=>classFilter==="All"||m.cls===classFilter)
    .sort((a,b)=>{
      if(sortBy==="coins") return b.coins-a.coins;
      if(sortBy==="power") return b.power-a.power;
      if(sortBy==="attendance") return b.attendance-a.attendance;
      if(sortBy==="name") return a.name.localeCompare(b.name);
      return 0;
    });

  // Same paging approach as the Leaderboard's LBList (10 per page) — reset
  // to page 0 whenever the search/filter/sort changes the underlying list,
  // so a stale page index never points past the end of a newly-shortened
  // filtered result.
  const MEMBERS_PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / MEMBERS_PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visibleMembers = filtered.slice(safePage*MEMBERS_PAGE_SIZE, (safePage+1)*MEMBERS_PAGE_SIZE);
  useEffect(() => { setPage(0); }, [search, classFilter, sortBy]);

  function removeMember(id) {
    if(!isAdmin) return;
    const target = members.find(m=>m.id===id);
    setMembers(ms=>ms.filter(m=>m.id!==id));
    dbDeleteReliable("members", {id}).then(ok => {
      if (!ok) {
        addToast(
          <span style={{display:"inline-flex",alignItems:"center",gap:6}}><WarningIcon size={13}/>"{target?.name||"Member"}" couldn't be removed from the shared roster — they may reappear. Try again.</span>,
          "red", "Delete Failed"
        );
      }
    });
    addToast(t("memberRemoved"),"red",t("removed"));
    setSelectedMember(null);
  }

  if (viewingProfile) {
    const liveMember = members.find(m => m.id === viewingProfile) || viewingProfile;
    return <PlayerInfo member={liveMember} members={members} onBack={()=>setViewingProfile(null)} />;
  }

  return (
    <div>
      {/* Hero stats — same wrapping-flex + divider + corner-bracket pattern
          Auctions' hero uses (not a fixed-column grid), so this actually
          reflows on narrow screens instead of squeezing 4 rigid columns
          into a phone width, and looks consistent with the rest of the app. */}
      <div className="dash-panel" style={{
        position:"relative",display:"flex",flexWrap:"wrap",gap:20,alignItems:"center",padding:"16px 18px",marginBottom:12,
        background:"linear-gradient(135deg,#0e0b09 0%,#161110 50%,#0e0b09 100%)",
        border:"1px solid rgba(200,146,42,0.18)",borderRadius:8,
        boxShadow:"0 6px 32px rgba(0,0,0,0.7), inset 0 1px 0 rgba(200,146,42,0.1)",
      }}>
        <CornerBrackets size={11} thickness={1.5} inset={7} opacity={0.35}/>
        <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 15% 0%,rgba(200,146,42,0.08) 0%,transparent 55%)",pointerEvents:"none"}}/>
        <div>
          <div style={{fontSize:9.5,letterSpacing:1.5,textTransform:"uppercase",color:"var(--text-dim)",fontWeight:700,marginBottom:6}}>{t("totalWarriors")}</div>
          <div style={{fontFamily:"'Spectral',serif",fontSize:22,fontWeight:800,color:"var(--gold-light)",textShadow:"0 0 16px rgba(242,204,96,0.25)",fontVariantNumeric:"tabular-nums"}}>{members.length}</div>
        </div>
        <div style={{width:1,height:32,background:"var(--border)"}}/>
        <div>
          <div style={{fontSize:9.5,letterSpacing:1.5,textTransform:"uppercase",color:"var(--text-dim)",fontWeight:700,marginBottom:6}}>{t("clanTotalPower")}</div>
          <div style={{fontFamily:"'Spectral',serif",fontSize:22,fontWeight:800,color:"var(--gold-light)",textShadow:"0 0 16px rgba(242,204,96,0.25)",fontVariantNumeric:"tabular-nums"}}>{fmt(totalPower)}</div>
        </div>
        <div style={{width:1,height:32,background:"var(--border)"}}/>
        <div>
          <div style={{fontSize:9.5,letterSpacing:1.5,textTransform:"uppercase",color:"var(--text-dim)",fontWeight:700,marginBottom:6}}>{t("coinsInCirculation")}</div>
          <div style={{display:"inline-flex",alignItems:"center",gap:6,fontFamily:"'Spectral',serif",fontSize:22,fontWeight:800,color:"var(--gold-light)",textShadow:"0 0 16px rgba(242,204,96,0.25)",fontVariantNumeric:"tabular-nums"}}>
            <StatIcon src={COINS_ICON} size={20}/>{fmt(totalCoins)}
          </div>
        </div>
      </div>

      {/* Class Composition gets its own panel below — it's a small bar
          chart, not a single stat value, so it doesn't fit the flex-wrap
          row above the same way the three numbers do. */}
      <div className="dash-panel" style={{
        position:"relative",padding:"14px 18px",marginBottom:20,
        background:"linear-gradient(135deg,#0e0b09 0%,#161110 50%,#0e0b09 100%)",
        border:"1px solid rgba(200,146,42,0.18)",borderRadius:8,
        boxShadow:"0 6px 32px rgba(0,0,0,0.7), inset 0 1px 0 rgba(200,146,42,0.1)",
      }}>
        <CornerBrackets size={11} thickness={1.5} inset={7} opacity={0.35}/>
        <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 15% 0%,rgba(200,146,42,0.08) 0%,transparent 55%)",pointerEvents:"none"}}/>
        <div style={{fontSize:9.5,letterSpacing:1.5,textTransform:"uppercase",color:"var(--text-dim)",fontWeight:700,marginBottom:6}}>{t("classComposition")}</div>
        {classComposition.map(c => {
          const col = CLASS_COLORS[c.cls] || "#9c8c7c";
          return (
            <div key={c.cls} style={{display:"grid",gridTemplateColumns:"70px 1fr 20px",alignItems:"center",gap:8,marginTop:5}}>
              <span style={{fontSize:10,color:"var(--text-mid)",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.cls}</span>
              <div style={{height:7,background:"rgba(255,255,255,0.05)",borderRadius:4,overflow:"hidden"}}>
                <div style={{height:"100%",borderRadius:4,width:`${(c.count/maxClassCount)*100}%`,background:`linear-gradient(90deg,${col},${col}cc)`,boxShadow:`0 0 6px ${col}66`}} />
              </div>
              <span style={{fontSize:10.5,color:col,fontWeight:800,textAlign:"right",fontVariantNumeric:"tabular-nums"}}>{c.count}</span>
            </div>
          );
        })}
      </div>

      <div className="dash-panel" style={{
        position:"relative",display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",padding:"14px 16px",marginBottom:16,
        background:"linear-gradient(135deg,#0e0b09 0%,#161110 50%,#0e0b09 100%)",
        border:"1px solid rgba(200,146,42,0.18)",borderRadius:8,
        boxShadow:"0 6px 32px rgba(0,0,0,0.7), inset 0 1px 0 rgba(200,146,42,0.1)",
      }}>
        <CornerBrackets size={11} thickness={1.5} inset={7} opacity={0.35}/>
        <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 15% 0%,rgba(200,146,42,0.08) 0%,transparent 55%)",pointerEvents:"none"}}/>
        <input className="input" style={{maxWidth:200}} placeholder={t("searchWarrior")} value={search} onChange={e=>setSearch(e.target.value)} />
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {["All",...CLASSES].map(c => (
            <span
              key={c}
              onClick={()=>setClassFilter(c)}
              style={{
                fontSize:11,padding:"6px 12px",borderRadius:16,cursor:"pointer",fontWeight:600,whiteSpace:"nowrap",
                border:`1px solid ${classFilter===c?"var(--border-bright)":"var(--border-dim)"}`,
                background:classFilter===c?"rgba(201,151,42,0.14)":"transparent",
                color:classFilter===c?"var(--gold-light)":"var(--text-dim)",
              }}
            >{c==="All"?t("allClasses"):c}</span>
          ))}
        </div>
        <select className="select" style={{maxWidth:160}} value={sortBy} onChange={e=>setSortBy(e.target.value)}>
          <option value="coins">{t("sortCoins")}</option><option value="power">{t("sortPower")}</option>
          <option value="attendance">{t("sortAttendance")}</option><option value="name">{t("sortName")}</option>
        </select>
        {isAdmin && <button className="btn btn-gold" style={{marginLeft:"auto"}} onClick={()=>setModal({type:"addMember"})}>{t("addMember")}</button>}
      </div>

      <div className="members-layout">
        <div style={{flex:1,minWidth:0}}>
          <div className="dash-panel members-table-view" style={{
            position:"relative",padding:0,overflow:"hidden",
            background:"linear-gradient(135deg,#0e0b09 0%,#161110 50%,#0e0b09 100%)",
            border:"1px solid rgba(200,146,42,0.18)",borderRadius:8,
            boxShadow:"0 6px 32px rgba(0,0,0,0.7), inset 0 1px 0 rgba(200,146,42,0.1)",
          }}>
            <CornerBrackets size={11} thickness={1.5} inset={7} opacity={0.35}/>
            <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 15% 0%,rgba(200,146,42,0.08) 0%,transparent 55%)",pointerEvents:"none"}}/>
            <div className="table-wrap members-table-wrap">
              <table className="table-stack members-table">
                <thead><tr><th>{t("colRank")}</th><th>{t("colCharacter")}</th><th>{t("colPower")}</th><th>{t("colCoins")}</th><th>{t("sevenDayStreak")}</th><th>{t("colWins")}</th><th>{t("colRole")}</th>{isAdmin&&<th>{t("colActions")}</th>}</tr></thead>
                <tbody>
                  {visibleMembers.map((m,i) => {
                    const powerRank = powerRankOf(m.id);
                    const stripeColor = TIER_STRIPE_COLOR[powerRank];
                    const pulse = getLast7DaysPulseGmt8(m.attendLog);
                    return (
                    <tr key={m.id} style={{cursor:"pointer",borderLeft:`2px solid ${stripeColor||"transparent"}`,background:selectedMember?.id===m.id?"rgba(201,151,42,0.05)":""}} onClick={()=>setSelectedMember(m)}>
                      <td data-label="#" style={{color:"var(--text-dim)",fontWeight:700,fontSize:11}}>{rankIcon(safePage*MEMBERS_PAGE_SIZE+i)}</td>
                      <td data-label="Character">
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <ClassIcon cls={m.cls} size={40} />
                          <div>
                            <div
                              style={{fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:13,color:"var(--text-bright)",textAlign:"left",cursor:"pointer"}}
                              onClick={e=>{e.stopPropagation();setViewingProfile(m.id);}}
                              onMouseEnter={e=>e.currentTarget.style.textDecoration="underline"}
                              onMouseLeave={e=>e.currentTarget.style.textDecoration="none"}
                            >{m.name}</div>
                            <div style={{fontSize:10,color:"var(--text-dim)",fontWeight:500}}>{t("joinedOn")} {m.joinDate}</div>
                          </div>
                        </div>
                      </td>
                      <td data-label="Power" style={{fontFamily:"'Inter',sans-serif",fontWeight:700,color:"#a8b8c8"}}><span style={{display:"inline-flex",alignItems:"center",gap:5}}><PowerIcon size={14} />{fmt(m.power)}</span></td>
                      <td data-label="Coins" style={{fontFamily:"'Inter',sans-serif",fontWeight:800,color:"var(--gold-light)"}}><span style={{display:"inline-flex",alignItems:"center",gap:4}}><StatIcon src={COINS_ICON} size={28}/>{fmt(m.coins)}</span></td>
                      <td data-label="Streak">
                        <div style={{display:"inline-flex",gap:2}}>
                          {pulse.map((on,pi) => (
                            <span key={pi} style={{width:5,height:12,borderRadius:1,background:on?"linear-gradient(180deg, var(--gold-light), var(--gold))":"rgba(255,255,255,0.08)"}} />
                          ))}
                        </div>
                      </td>
                      <td data-label="Wins" style={{color:"var(--gold)",fontWeight:700}}>{m.auctionWins}×</td>
                      <td data-label="Role"><span className={`badge ${m.role==="Master"?"badge-gold":m.role==="Elder"?"badge-red":"badge-silver"}`}>{m.role}</span></td>
                      {isAdmin && <td data-label="Action"><button className="btn btn-ghost btn-sm" onClick={e=>{e.stopPropagation();removeMember(m.id);}}>{t("remove")}</button></td>}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages>1 && (
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px",borderTop:"1px solid var(--border-dim)",flexWrap:"wrap",gap:8}}>
                <span style={{fontSize:10,color:"var(--text-dim)",fontFamily:"'Inter',sans-serif"}}>
                  {safePage*MEMBERS_PAGE_SIZE+1}&ndash;{Math.min((safePage+1)*MEMBERS_PAGE_SIZE,filtered.length)} {t("ofPagination")} {filtered.length}
                </span>
                <div style={{display:"flex",gap:6}}>
                  <button className="btn btn-outline btn-sm" disabled={safePage===0} onClick={()=>setPage(p=>p-1)} style={{opacity:safePage===0?0.4:1,fontSize:10,padding:"3px 10px"}}>{t("prevPage")}</button>
                  <button className="btn btn-outline btn-sm" disabled={safePage>=totalPages-1} onClick={()=>setPage(p=>p+1)} style={{opacity:safePage>=totalPages-1?0.4:1,fontSize:10,padding:"3px 10px"}}>{t("nextPage")}</button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile card view — same data as the table above, shown only
              on narrow screens (see .members-card-view media query).
              Deliberately compact (name/class + Power/Coins only, same
              as the desktop quick-view panel's summary) rather than
              cramming every column in — tap a name to see everything
              else on that member's profile. */}
          <div className="members-card-view">
            {visibleMembers.map((m,i) => {
              const powerRank = powerRankOf(m.id);
              const stripeColor = TIER_STRIPE_COLOR[powerRank];
              return (
                <div
                  key={`card-${m.id}`} className="dash-subcard"
                  style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",marginBottom:8,borderLeft:`2px solid ${stripeColor||"transparent"}`,cursor:"pointer"}}
                  onClick={()=>setSelectedMember(m)}
                >
                  <ClassIcon cls={m.cls} size={30} />
                  <div style={{minWidth:0,flex:1}}>
                    <div
                      style={{fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:13,color:"var(--gold-light)",textDecoration:"underline",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}
                      onClick={e=>{e.stopPropagation();setViewingProfile(m.id);}}
                    >{m.name}</div>
                    <div style={{fontSize:10,color:"var(--text-dim)"}}>{m.cls}</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontFamily:"'Inter',sans-serif",fontWeight:800,fontSize:13,color:"var(--gold-light)"}}>{fmt(m.power)}</div>
                    <div style={{fontSize:10,color:"var(--text-dim)"}}>{fmt(m.coins)} coins</div>
                  </div>
                </div>
              );
            })}
            {totalPages>1 && (
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 4px",gap:8}}>
                <span style={{fontSize:10,color:"var(--text-dim)",fontFamily:"'Inter',sans-serif"}}>
                  {safePage*MEMBERS_PAGE_SIZE+1}&ndash;{Math.min((safePage+1)*MEMBERS_PAGE_SIZE,filtered.length)} {t("ofPagination")} {filtered.length}
                </span>
                <div style={{display:"flex",gap:6}}>
                  <button className="btn btn-outline btn-sm" disabled={safePage===0} onClick={()=>setPage(p=>p-1)} style={{opacity:safePage===0?0.4:1,fontSize:10,padding:"3px 10px"}}>{t("prevPage")}</button>
                  <button className="btn btn-outline btn-sm" disabled={safePage>=totalPages-1} onClick={()=>setPage(p=>p+1)} style={{opacity:safePage>=totalPages-1?0.4:1,fontSize:10,padding:"3px 10px"}}>{t("nextPage")}</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {selectedMember && (
          <div className="card" style={{width:260,flexShrink:0}}>
            <div style={{textAlign:"center",marginBottom:16}}>
              <ClassIcon cls={selectedMember.cls} size={80} />
              <div style={{fontFamily:"'Spectral',serif",fontWeight:800,fontSize:18,color:"var(--gold-light)"}}>{selectedMember.name}</div>
              <div style={{fontSize:10,color:"var(--text-dim)",marginBottom:10,fontWeight:600,letterSpacing:2,textTransform:"uppercase"}}>{selectedMember.cls}</div>
              <span className={`badge ${selectedMember.role==="Master"?"badge-gold":selectedMember.role==="Elder"?"badge-red":"badge-silver"}`}>{selectedMember.role}</span>
            </div>
            {selectedMember.discord && <div style={{textAlign:"center",marginBottom:10}}><span className="discord-tag">🎮 {selectedMember.discord}</span></div>}
            <button className="btn btn-outline btn-sm" style={{width:"100%",marginBottom:12}} onClick={()=>setViewingProfile(selectedMember.id)}>View Profile</button>
            <div className="divider" />
            {/* "Joined" used to be a fourth row here — folded into the
                table's name sub-line instead (already shown there),
                since it's rarely the reason someone opens a quick-view. */}
            {[[t("statCoins"),fmt(selectedMember.coins)],[t("statAttendance"),selectedMember.attendance],[t("statWins"),selectedMember.auctionWins]].map(([k,v]) => (
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--border-dim)",fontSize:12}}>
                <span style={{color:"var(--text-dim)",fontFamily:"'Inter',sans-serif",fontWeight:500}}>{k}</span>
                <span style={{color:"var(--text-bright)",fontFamily:"'Inter',sans-serif",fontWeight:700}}>{v}</span>
              </div>
            ))}
            <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--border-dim)",fontSize:12}}>
              <span style={{display:"inline-flex",alignItems:"center",gap:5,color:"var(--text-dim)",fontFamily:"'Inter',sans-serif",fontWeight:500}}><PowerIcon size={13} /> {t("powerLabel")}</span>
              <span style={{color:"var(--text-bright)",fontFamily:"'Inter',sans-serif",fontWeight:700}}>{fmt(selectedMember.power)}</span>
            </div>
            {isAdmin && (
              <div style={{marginTop:16,display:"flex",flexDirection:"column",gap:8}}>
                <button className="btn btn-outline btn-sm" onClick={()=>setModal({type:"adjustCoins",data:selectedMember})}>{t("adjustCoins")}</button>
                <button className="btn btn-blue btn-sm" onClick={()=>setModal({type:"adjustPower",data:selectedMember})}><span style={{display:"inline-flex",alignItems:"center",gap:5}}><PowerIcon size={12} />{t("adjustPower")}</span></button>
                <button className="btn btn-outline btn-sm" onClick={()=>setModal({type:"setRarity",data:selectedMember})}>Set Rarity</button>
                <button className="btn btn-outline btn-sm" onClick={()=>setModal({type:"setAwakening",data:selectedMember})}>Set Awakening</button>
                <button className="btn btn-discord btn-sm" onClick={()=>setModal({type:"discord",data:selectedMember})}>{selectedMember.discord?t("editDiscord"):t("linkDiscord")}</button>
                {currentUser.role==="Master" && (
                  <button className="btn btn-outline btn-sm" onClick={()=>setModal({type:"renameMember",data:selectedMember})}>{t("rename")}</button>
                )}
                {currentUser.role==="Master" && selectedMember.id!==currentUser.id && (
                  <div style={{borderTop:"1px solid var(--border-dim)",paddingTop:8}}>
                    <div style={{fontSize:9,color:"var(--text-dim)",letterSpacing:2,textTransform:"uppercase",fontFamily:"'Inter',sans-serif",marginBottom:6}}>{t("changeRole")}</div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      {selectedMember.role!=="Member"&&<button className="btn btn-ghost btn-sm" onClick={()=>{setMembers(ms=>ms.map(x=>x.id===selectedMember.id?{...x,role:"Member"}:x));setSelectedMember(p=>({...p,role:"Member"}));addToast(`${selectedMember.name} ${t("setToMember")}`,"gold",t("roleChanged"));}}>{t("toMember")}</button>}
                      {selectedMember.role!=="Elder"&&<button className="btn btn-outline btn-sm" onClick={()=>{setMembers(ms=>ms.map(x=>x.id===selectedMember.id?{...x,role:"Elder"}:x));setSelectedMember(p=>({...p,role:"Elder"}));addToast(`${selectedMember.name} ${t("promotedToElder")}`,"gold",t("roleChanged"));}}>{t("toElder")}</button>}
                      {selectedMember.role!=="Master"&&<button className="btn btn-gold btn-sm" onClick={()=>{setMembers(ms=>ms.map(x=>x.id===selectedMember.id?{...x,role:"Master"}:x));setSelectedMember(p=>({...p,role:"Master"}));addToast(`${selectedMember.name} ${t("nowMaster")}`,"gold",t("roleChanged"));}}>{t("toMaster")}</button>}
                    </div>
                  </div>
                )}
                <button className="btn btn-red btn-sm" onClick={()=>removeMember(selectedMember.id)}>{t("removeMember")}</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PLAYER INFO PAGE — stat computation helpers ───────────────────────────────
// Returns [monthStart, monthEnd) timestamps for the calendar month that
// `monthsAgo` months before `now` falls in, anchored to GMT+8 — so "this
// month" always means the 1st through the end of the current GMT+8
// calendar month, not a rolling 30-day window.
function getMonthBoundaryGmt8(now, monthsAgo) {
  const shifted = new Date(now + GMT8_OFFSET_MS_GLOBAL);
  const y = shifted.getUTCFullYear(), m = shifted.getUTCMonth();
  const start = Date.UTC(y, m - monthsAgo, 1) - GMT8_OFFSET_MS_GLOBAL;
  const end = Date.UTC(y, m - monthsAgo + 1, 1) - GMT8_OFFSET_MS_GLOBAL;
  return [start, end];
}
// Oldest-to-newest booleans for whether a member checked into anything
// (qualifier !== "afk") on each of the last 7 GMT+8 calendar days,
// including today — powers the Battle Streak banner's pulse row. Real
// calendar-day boundaries (not a rolling 7*24h window) for the same
// reason getMonthBoundaryGmt8 anchors to GMT+8 calendar months instead
// of a rolling 30 days.
function getLast7DaysPulseGmt8(attendLog, now = Date.now()) {
  const log = attendLog || [];
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const shifted = new Date(now - i*24*60*60*1000 + GMT8_OFFSET_MS_GLOBAL);
    const y = shifted.getUTCFullYear(), m = shifted.getUTCMonth(), d = shifted.getUTCDate();
    const dayStart = Date.UTC(y, m, d) - GMT8_OFFSET_MS_GLOBAL;
    const dayEnd = dayStart + 24*60*60*1000;
    days.push(log.some(e => e.qualifier!=="afk" && (e.ts||0) >= dayStart && (e.ts||0) < dayEnd));
  }
  return days;
}
// Maximum possible attendances per event WITHIN A SPECIFIC CALENDAR MONTH —
// computed by counting how many times each weekday actually falls in that
// month (4 or 5 times, depending on the month) and multiplying by how many
// times that event runs on that weekday. This is more accurate than a fixed
// "x4" estimate, since calendar months don't divide evenly into weeks.
function getEventMaxForMonth(monthStart, monthEnd) {
  const weekdayCounts = {};
  let cursor = monthStart;
  while (cursor < monthEnd) {
    const dayName = DAY_NAMES[new Date(cursor + GMT8_OFFSET_MS_GLOBAL).getUTCDay()];
    weekdayCounts[dayName] = (weekdayCounts[dayName] || 0) + 1;
    cursor += 24 * 60 * 60 * 1000;
  }
  const result = {};
  WEEKLY_SCHEDULE.forEach(day => {
    const occurrences = weekdayCounts[day.day] || 0;
    day.events.forEach(ev => { result[ev.id] = (result[ev.id] || 0) + occurrences; });
  });
  return result;
}
// Maps an attendLog entry's stored event NAME back to its schedule id, so
// "Inter-Server Battle" / "Inter Server Battle" naming differences (seen
// across different parts of the codebase) don't cause a stat to read 0.
const EVENT_NAME_TO_ID = {};
WEEKLY_SCHEDULE.forEach(day => day.events.forEach(ev => { EVENT_NAME_TO_ID[ev.name] = ev.id; }));
EVENT_NAME_TO_ID["Inter Server Battle"] = "ISB"; // alternate spelling used elsewhere in the app

// Counts how many times a member attended a given event id within the last
// N days (qualifier !== "afk" matches the existing convention elsewhere —
// an AFK check-in doesn't count as real participation).
function countEventAttendance(attendLog, eventId, sinceTs, untilTs = Infinity) {
  return (attendLog || []).filter(e => {
    const id = EVENT_NAME_TO_ID[e.event];
    return id === eventId && e.qualifier !== "afk" && (e.ts || 0) >= sinceTs && (e.ts || 0) < untilTs;
  }).length;
}

// Battle-Ready: 25+ attendances within the current calendar month (roughly
// two-thirds of a typical month's ~38 total event opportunities across all
// events combined). Present: 1+. Otherwise Absent.
function getActivityStatus(attendLog, now = Date.now()) {
  const [monthStart] = getMonthBoundaryGmt8(now, 0);
  const recentCount = (attendLog || []).filter(e => e.qualifier !== "afk" && (e.ts || 0) >= monthStart).length;
  if (recentCount >= 25) return "battle_ready";
  if (recentCount >= 1) return "present";
  return "absent";
}

// Most recent attendance timestamp, for the "Last activity X days ago" line.
function getLastActivityTs(attendLog) {
  const entries = (attendLog || []).filter(e => e.qualifier !== "afk");
  if (entries.length === 0) return null;
  return Math.max(...entries.map(e => e.ts || 0));
}

// Groups attendLog entries into 4 calendar-month buckets (oldest to newest)
// for the "Call to Arms" chart — counts event check-ins per month.
function getMonthlyEventActivity(attendLog, now = Date.now()) {
  const buckets = [0, 0, 0, 0]; // [3 months ago, 2 months ago, last month, this month]
  for (let i = 3; i >= 0; i--) {
    const [start, end] = getMonthBoundaryGmt8(now, i);
    buckets[3-i] = (attendLog || []).filter(e =>
      e.qualifier !== "afk" && (e.ts||0) >= start && (e.ts||0) < end
    ).length;
  }
  return buckets;
}

// Groups powerLog entries into weekly gains (current power minus the most
// recent recorded power from the prior month) for the "Power Surge" chart.
// Returns null for months with no recorded data — the chart should show
// those as empty rather than zero, since zero would falsely imply "no
// growth" rather than "no data yet".
function getMonthlyPowerGains(powerLog, now = Date.now()) {
  const sorted = [...(powerLog || [])].sort((a, b) => (a.ts||0) - (b.ts||0));
  const gains = [null, null, null, null];
  for (let i = 3; i >= 0; i--) {
    const [monthStart, monthEnd] = getMonthBoundaryGmt8(now, i);
    const upToMonthEnd = sorted.filter(p => (p.ts||0) < monthEnd);
    if (upToMonthEnd.length === 0) continue;
    // Baseline: the most recent point AT OR BEFORE this month's start. If
    // none exists (this is the very first month ever tracked), fall back
    // to the earliest point we have at all, so that first partial month
    // still shows whatever gain happened between its first and last
    // recorded snapshot instead of nothing.
    const atOrBeforeMonthStart = upToMonthEnd.filter(p => (p.ts||0) < monthStart);
    const startPower = atOrBeforeMonthStart.length > 0
      ? atOrBeforeMonthStart[atOrBeforeMonthStart.length-1].power
      : upToMonthEnd[0].power;
    const endPower = upToMonthEnd[upToMonthEnd.length-1].power;
    if (atOrBeforeMonthStart.length === 0 && upToMonthEnd.length < 2) continue;
    gains[3-i] = endPower - startPower;
  }
  return gains;
}

// Groups attendLog entries into 4 weekly buckets (oldest to newest) for the
// "Event Activity" chart — counts event check-ins per week. Same logic as
// getMonthlyEventActivity, just on a 7-day cadence instead of calendar
// months, per a later correction: the two charts (Power Surge, Event
// Activity) stay weekly, while the four named-event breakdown stats
// (Server Battle, Sindris, Sanctuary, Annihilation) stay on a monthly
// cadence.
function getWeeklyEventActivity(attendLog, now = Date.now()) {
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const buckets = [0, 0, 0, 0]; // [3 weeks ago, 2 weeks ago, last week, this week]
  (attendLog || []).forEach(e => {
    if (e.qualifier === "afk") return;
    const ts = e.ts || 0;
    const weeksAgo = Math.floor((now - ts) / weekMs);
    if (weeksAgo >= 0 && weeksAgo <= 3) buckets[3 - weeksAgo]++;
  });
  return buckets;
}

// Weekly version of getMonthlyPowerGains — same verified baseline-fallback
// logic, on a 7-day cadence.
// Builds the "what's new since you last logged in" summary shown right
// after login. Pulls from data that's already tracked (attendLog, txLog,
// powerLog) — nothing new recorded here besides the lastLoginTs window
// itself. Returns null if there's nothing worth showing (e.g. first-ever
// login, or genuinely nothing happened), so the caller can skip the
// popup entirely rather than show an empty one.
// login, or genuinely nothing happened) but always shows the current
// balance regardless — keeping coins visible is the point of this even
// when there's no prior visit to compare against.
function getLoginSummary(member, window) {
  // First-ever login: no prior point in time to compare against, so
  // there's nothing to report changing — but the balance itself should
  // still show, since "always aware of their balance" doesn't depend on
  // having a previous session to diff against.
  if (!window || !window.since) {
    return {
      hasAnything: false,
      coinsFromAttendance: 0, coinsFromBonuses: 0, coinsFromDecay: 0, totalCoins: 0,
      bonusCount: 0, bonusEntries: [],
      auctionWins: [],
      decayEntries: [],
      powerChange: 0,
      currentBalance: member.coins || 0,
    };
  }
  const { since, until } = window;

  const attendanceEntries = (member.attendLog || []).filter(e => (e.ts||0) > since && (e.ts||0) <= until && e.qualifier !== "afk");
  const coinsFromAttendance = attendanceEntries.reduce((s,e) => s + (e.coins||0), 0);

  const bonusEntries = (member.txLog || []).filter(e => (e.ts||0) > since && (e.ts||0) <= until && /Bonus$/.test(e.logType||""));
  const coinsFromBonuses = bonusEntries.reduce((s,e) => s + (e.change||0), 0);

  const auctionWins = (member.txLog || []).filter(e => (e.ts||0) > since && (e.ts||0) <= until && e.logType === "Auction Win");

  const decayEntries = (member.decayLog || []).filter(e => (e.ts||0) > since && (e.ts||0) <= until);
  const coinsFromDecay = decayEntries.reduce((s,e) => s + (e.amount||0), 0);

  const powerEntries = (member.powerLog || []).filter(e => (e.ts||0) > since && (e.ts||0) <= until).sort((a,b)=>a.ts-b.ts);
  const powerChange = powerEntries.length > 0
    ? powerEntries[powerEntries.length-1].power - (member.powerLog.filter(e=>(e.ts||0)<=since).sort((a,b)=>b.ts-a.ts)[0]?.power ?? powerEntries[0].power)
    : 0;

  const hasAnything = attendanceEntries.length > 0 || bonusEntries.length > 0 || auctionWins.length > 0 || decayEntries.length > 0 || powerChange !== 0;

  return {
    hasAnything,
    coinsFromAttendance, coinsFromBonuses, coinsFromDecay,
    totalCoins: coinsFromAttendance + coinsFromBonuses + coinsFromDecay,
    bonusCount: bonusEntries.length, bonusEntries,
    auctionWins,
    decayEntries,
    powerChange,
    currentBalance: member.coins || 0,
  };
}

// Shown once right after login if getLoginSummary found anything to
// report. Purely informational — closing it doesn't lose anything, since
// the underlying data (attendLog/txLog/powerLog) is unaffected either way.
// Shown immediately when the 3s auction poll detects the current user
// just lost the top-bidder spot on an auction they're not actively
// viewing/bidding on right this second (if they ARE actively bidding,
// the existing inline "you were outbid, please retry" toast in placeBid
// already covers that more specific moment). Distinct from the popup
// system this app uses — deliberately lighter-weight (no "don't show
// again" state, no dismiss persistence) since this is a one-off, timely
// nudge tied to a specific live event, not recurring content to manage.
function OutbidPopup({ info, onClose, onGoBid }) {
  const { t } = useLang();
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:380}} onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">⚠️ {t("outbidPopupTitle")}</div>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{fontSize:13,color:"var(--text)",lineHeight:1.6,marginBottom:14}}>
            <strong style={{color:"var(--text-bright)"}}>{info.outbidBy}</strong> {t("outbidPopupBody1")} <strong style={{color:"var(--text-bright)"}}>{info.name}</strong>.
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10,background:"rgba(180,80,80,0.08)",border:"1px solid rgba(180,80,80,0.25)",borderRadius:6,padding:"10px 14px"}}>
            <StatIcon src={COINS_ICON} size={20}/>
            <div style={{fontSize:14,fontWeight:700,color:"#e07070"}}>{t("outbidPopupNewBid")} {fmt(info.newBid)} {t("coinsLabel")}</div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>{t("outbidPopupDismiss")}</button>
          <button className="btn btn-gold" onClick={onGoBid}>{t("outbidPopupGoBid")}</button>
        </div>
      </div>
    </div>
  );
}

// Groups auction-news items that share the same name (this app allows
// the identical item to be listed as several separate auctions — same
// name, different auction IDs, different bids/end times) into one entry
// with a count, instead of rendering N near-identical rows. The
// representative item shown is whichever of the group is closing
// soonest, since that's the most actionable one to surface.
function groupNewsItemsByName(items) {
  const groups = {};
  (items || []).forEach(item => {
    (groups[item.name] = groups[item.name] || []).push(item);
  });
  return Object.values(groups).map(group => {
    const soonest = [...group].sort((a,b) => (a.endsAt ?? Infinity) - (b.endsAt ?? Infinity))[0];
    return { ...soonest, count: group.length };
  });
}

function LoginSummaryModal({ summary, memberName, announcements, onClose, onDismissToday, onDismissAnnouncement }) {
  const { t } = useLang();
  const [dontShowToday, setDontShowToday] = useState(false);
  const [locallyDismissed, setLocallyDismissed] = useState(() => new Set());
  function handleClose() {
    if (dontShowToday) onDismissToday();
    onClose();
  }
  function dismissAnnouncement(id) {
    onDismissAnnouncement(id);
    // Also hide it immediately within this already-open popup, rather
    // than waiting for a re-render from the parent's state — otherwise
    // a dismissed announcement would still visually sit there until the
    // whole popup is closed and reopened.
    const remaining = new Set(locallyDismissed); remaining.add(id);
    setLocallyDismissed(remaining);
    const stillVisible = (announcements || []).filter(a => !remaining.has(a.id));
    if (stillVisible.length === 0 && !summary) onClose();
  }
  // Auction-news cards are a static snapshot taken when an admin clicks
  // "Post to News" (see postAuctionToNews) — nothing ever re-checks it
  // against the auction's real live status, so an ended auction just sits
  // here forever unless someone manually removes it. Filtering by endsAt
  // here means it naturally drops off the moment it ends, no manual
  // cleanup required, regardless of how stale the underlying stored list
  // has gotten.
  const visibleAnnouncements = (announcements || [])
    .filter(a => !locallyDismissed.has(a.id))
    .map(a => a.type === "auctions" ? { ...a, items: (a.items||[]).filter(i => (i.endsAt||0) > Date.now()) } : a)
    .filter(a => a.type !== "auctions" || a.items.length > 0);
  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal" style={{maxWidth:420,position:"relative",overflow:"hidden",padding:0}} onClick={e=>e.stopPropagation()}>
        <CornerBrackets size={14} thickness={1.5} inset={10} opacity={0.4}/>

        {/* ── HERO BAND — eyebrow, welcome title, glowing balance number.
            Same weight/language as the Dashboard/Auctions/Profile hero
            strips built earlier, so this popup finally reads as part of
            the same redesigned app instead of a leftover utility modal. ── */}
        <div style={{
          position:"relative",overflow:"hidden",padding:"26px 24px 20px",
          background:"radial-gradient(ellipse at 30% -10%, rgba(200,146,42,0.22) 0%, transparent 60%), linear-gradient(160deg,#1c140c 0%,#120d08 70%)",
          borderBottom:"1px solid rgba(200,146,42,0.48)",
        }}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,var(--gold),transparent)"}}/>
          <button className="btn btn-ghost" style={{position:"absolute",top:14,right:14}} onClick={handleClose}>✕</button>
          <div style={{fontSize:9.5,letterSpacing:3,textTransform:"uppercase",color:"rgba(200,146,42,0.75)",fontWeight:700,fontFamily:"'Inter',sans-serif",marginBottom:6}}>
            {CLAN_SEASON_LABEL} &middot; {CLAN_NAME}
          </div>
          <div style={{fontFamily:"'Spectral',serif",fontSize:22,fontWeight:800,color:"var(--text-bright)",marginBottom: summary?14:0}}>
            {t("welcomeBackTitle")} {memberName}
          </div>
          {summary && (
            <>
              <div style={{fontFamily:"'Spectral',serif",fontSize:36,fontWeight:800,color:"var(--gold-bright)",textShadow:"0 0 26px rgba(200,146,42,0.5)",lineHeight:1,display:"inline-flex",alignItems:"center",gap:8}}>
                <StatIcon src={COINS_ICON} size={30}/>{fmt(summary.currentBalance)}
              </div>
              <div style={{fontSize:9.5,letterSpacing:2,textTransform:"uppercase",color:"var(--text-dim)",fontFamily:"'Inter',sans-serif",marginTop:6}}>{t("currentBalanceLabel")}</div>
            </>
          )}
        </div>

        {/* ── AUCTION / CLAN NEWS — its own zone between the hero and the
            personal digest, since this is admin-curated clan-wide content,
            not this member's own activity, and shouldn't blend into their
            personal history below it. ── */}
        {visibleAnnouncements.length > 0 && (
          <div style={{padding:"16px 24px 4px"}}>
            {visibleAnnouncements.map(ann => (
              ann.type === "auctions" ? (
                <div key={ann.id} style={{marginBottom:14}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                    <span style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:9.5,letterSpacing:2,textTransform:"uppercase",fontWeight:700,color:"rgba(200,146,42,0.75)",fontFamily:"'Inter',sans-serif"}}><BellIcon size={12}/>{t("auctionNewsTitle")}</span>
                    <button
                      onClick={()=>dismissAnnouncement(ann.id)}
                      title={t("dismissAnnouncementTitle")}
                      style={{background:"none",border:"none",color:"var(--text-dim)",cursor:"pointer",fontSize:13,padding:0,lineHeight:1}}
                    >✕</button>
                  </div>
                  <div style={{
                    background:"linear-gradient(135deg, rgba(200,146,42,0.1) 0%, rgba(200,146,42,0.03) 100%)",
                    border:"1px solid rgba(200,146,42,0.3)",borderRadius:7,padding:"12px 14px",
                  }}>
                    {groupNewsItemsByName(ann.items).map((item,i) => (
                      <div key={item.auctionId} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 0",borderTop: i>0 ? "1px solid rgba(200,146,42,0.12)" : "none"}}>
                        <div style={{position:"relative",width:38,height:38,borderRadius:4,overflow:"hidden",background:item.rarity==="epic"?"rgba(122,26,26,0.3)":"rgba(26,90,138,0.3)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:"1px solid var(--border)"}}>
                          {item.image?<AuctionImage auction={item} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} fallback={<StatIcon src={AUCTION_ICON} size={20}/>}/>:<StatIcon src={AUCTION_ICON} size={20}/>}
                          {item.count > 1 && (
                            <span style={{position:"absolute",bottom:-5,right:-5,background:"var(--gold)",color:"#241a08",fontSize:9,fontWeight:800,padding:"1px 5px",borderRadius:8,border:"1.5px solid var(--bg-card)",fontFamily:"'Inter',sans-serif",lineHeight:1.3}}>&times;{item.count}</span>
                          )}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:12,color:"var(--text-bright)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</div>
                          <div style={{fontSize:10,color:"var(--text-dim)"}}>
                            {item.count > 1
                              ? `${item.count} ${t("featuredCountLabel")} · ${t("closestEndsLabel")} ${timeLeft(item.endsAt)}`
                              : (item.topBidder ? `${t("topBidderLabel")}: ${item.topBidder}` : t("noBids"))}
                          </div>
                        </div>
                        <div style={{textAlign:"right",flexShrink:0}}>
                          <div style={{fontFamily:"'Inter',sans-serif",fontWeight:800,fontSize:13,color:"var(--gold-light)",display:"inline-flex",alignItems:"center",gap:3}}><StatIcon src={COINS_ICON} size={16}/>{fmt(item.currentBid)}</div>
                          <div style={{fontSize:9,color:"#e07070",fontWeight:700}}>{timeLeft(item.endsAt)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div key={ann.id} style={{
                  display:"flex",alignItems:"flex-start",gap:10,marginBottom:14,
                  background:"linear-gradient(135deg, rgba(200,146,42,0.1) 0%, rgba(200,146,42,0.03) 100%)",
                  border:"1px solid rgba(200,146,42,0.3)",borderRadius:7,padding:"12px 14px",
                }}>
                  <span style={{fontSize:16,flexShrink:0}}>📢</span>
                  <div style={{fontSize:13,color:"var(--gold-light)",lineHeight:1.5,flex:1}}>{ann.text}</div>
                  <button
                    onClick={()=>dismissAnnouncement(ann.id)}
                    title={t("dismissAnnouncementTitle")}
                    style={{background:"none",border:"none",color:"var(--text-dim)",cursor:"pointer",fontSize:13,flexShrink:0,padding:0,lineHeight:1}}
                  >✕</button>
                </div>
              )
            ))}
          </div>
        )}

        {/* ── PERSONAL ACTIVITY DIGEST — labeled section, connected-spine
            bulleting (see .login-summary-spine/.login-summary-row in
            GLOBAL_CSS) instead of five separately bordered colored boxes. ── */}
        {summary && (
          <div style={{padding:"4px 24px 18px"}}>
            {!summary.hasAnything ? (
              <div style={{textAlign:"center",padding:"20px 0",color:"var(--text-dim)",fontSize:13}}>{t("nothingNewMessage")}</div>
            ) : (
              <>
                <div style={{fontSize:9.5,letterSpacing:2,textTransform:"uppercase",color:"var(--text-dim)",fontWeight:700,fontFamily:"'Inter',sans-serif",margin: visibleAnnouncements.length>0 ? "14px 0 8px" : "0 0 8px", paddingTop: visibleAnnouncements.length>0 ? 12 : 0, borderTop: visibleAnnouncements.length>0 ? "1px solid var(--border)" : "none"}}>
                  {t("sinceLastVisitLabel")}
                </div>
                <div className="login-summary-spine">
                  {summary.totalCoins !== 0 && (
                    <div className="login-summary-row" style={{"--dot":"#e6b048",display:"flex",alignItems:"center",gap:12}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12.5,fontWeight:700,color:"var(--text-bright)"}}>{t("coinsLabel").charAt(0).toUpperCase()+t("coinsLabel").slice(1)}</div>
                        <div style={{fontSize:10.5,color:"var(--text-dim)",marginTop:1}}>
                          {summary.coinsFromAttendance>0 && `${fmt(summary.coinsFromAttendance)} ${t("fromAttendance")}`}
                          {summary.coinsFromAttendance>0 && summary.coinsFromBonuses!==0 && " · "}
                          {summary.coinsFromBonuses!==0 && `${summary.coinsFromBonuses>0?"+":""}${fmt(summary.coinsFromBonuses)} ${t("fromBonuses")}`}
                          {(summary.coinsFromAttendance>0 || summary.coinsFromBonuses!==0) && summary.coinsFromDecay!==0 && " · "}
                          {summary.coinsFromDecay!==0 && `${fmt(summary.coinsFromDecay)} ${t("fromDecay")}`}
                        </div>
                      </div>
                      <div style={{fontSize:13,fontWeight:800,color:"#e6b048",flexShrink:0,fontVariantNumeric:"tabular-nums",display:"inline-flex",alignItems:"center",gap:3}}><StatIcon src={COINS_ICON} size={16}/>{summary.totalCoins>0?"+":""}{fmt(summary.totalCoins)}</div>
                    </div>
                  )}
                  {summary.decayEntries.length > 0 && (
                    <div className="login-summary-row" style={{"--dot":"#e07070",display:"flex",alignItems:"center",gap:12}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12.5,fontWeight:700,color:"var(--text-bright)"}}>{t("weeklyCoinDecay")}</div>
                        <div style={{fontSize:10.5,color:"var(--text-dim)",marginTop:1}}>{summary.decayEntries.map(d=>d.date).join(" · ")}</div>
                      </div>
                      <div style={{fontSize:13,fontWeight:800,color:"#e07070",flexShrink:0,fontVariantNumeric:"tabular-nums",display:"inline-flex",alignItems:"center",gap:3}}><StatIcon src={COINS_ICON} size={16}/>{fmt(summary.coinsFromDecay)}</div>
                    </div>
                  )}
                  {summary.bonusEntries.length > 0 && (
                    <div className="login-summary-row" style={{"--dot":"#e6b048",display:"flex",alignItems:"center",gap:12}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12.5,fontWeight:700,color:"var(--text-bright)"}}>{t("bonusesEarned")}</div>
                        <div style={{fontSize:10.5,color:"var(--text-dim)",marginTop:1}}>{summary.bonusEntries.map(b=>b.logType).join(" · ")}</div>
                      </div>
                      <div style={{fontSize:13,fontWeight:800,color:"#e6b048",flexShrink:0,fontVariantNumeric:"tabular-nums",display:"inline-flex",alignItems:"center",gap:3}}><StatIcon src={COINS_ICON} size={16}/>+{fmt(summary.coinsFromBonuses)}</div>
                    </div>
                  )}
                  {summary.powerChange !== 0 && (
                    <div className="login-summary-row" style={{"--dot":"#8cc0f0",display:"flex",alignItems:"center",gap:12}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12.5,fontWeight:700,color:"var(--text-bright)"}}>{t("powerLabel")}</div>
                      </div>
                      <div style={{fontSize:13,fontWeight:800,color:"#8cc0f0",flexShrink:0,fontVariantNumeric:"tabular-nums"}}>{summary.powerChange>0?"+":""}{fmt(summary.powerChange)}</div>
                    </div>
                  )}
                  {summary.auctionWins.length > 0 && (
                    <div className="login-summary-row" style={{"--dot":"#e6b048",display:"flex",alignItems:"center",gap:12}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12.5,fontWeight:700,color:"var(--text-bright)"}}>{t("auctionsWon")}</div>
                        <div style={{fontSize:10.5,color:"var(--text-dim)",marginTop:1}}>{summary.auctionWins.map(a=>a.reason).join(" · ")}</div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <div className="modal-footer" style={{display:"flex",alignItems:"center",justifyContent:summary?"space-between":"flex-end",gap:12}}>
          {summary && (
            <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:"var(--text-dim)",cursor:"pointer"}}>
              <input type="checkbox" checked={dontShowToday} onChange={e=>setDontShowToday(e.target.checked)} />
              {t("dontShowToday")}
            </label>
          )}
          <button className="btn btn-gold" onClick={handleClose}>{t("gotIt")}</button>
        </div>
      </div>
    </div>
  );
}

function getWeeklyPowerGains(powerLog, now = Date.now()) {
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const sorted = [...(powerLog || [])].sort((a, b) => (a.ts||0) - (b.ts||0));
  const gains = [null, null, null, null];
  for (let w = 3; w >= 0; w--) {
    const weekEnd = now - w * weekMs;
    const weekStart = weekEnd - weekMs;
    const upToWeekEnd = sorted.filter(p => (p.ts||0) <= weekEnd);
    if (upToWeekEnd.length === 0) continue;
    const atOrBeforeWeekStart = upToWeekEnd.filter(p => (p.ts||0) <= weekStart);
    const startPower = atOrBeforeWeekStart.length > 0
      ? atOrBeforeWeekStart[atOrBeforeWeekStart.length-1].power
      : upToWeekEnd[0].power;
    const endPower = upToWeekEnd[upToWeekEnd.length-1].power;
    if (atOrBeforeWeekStart.length === 0 && upToWeekEnd.length < 2) continue;
    gains[3-w] = endPower - startPower;
  }
  return gains;
}


function getRankMultiplier(members, memberId) {
  const sorted = [...members].sort((a, b) => b.power - a.power);
  const rank = sorted.findIndex(m => m.id === memberId) + 1; // 1-based
  if (rank === 1)               return 1.15;
  if (rank === 2)               return 1.12;
  if (rank === 3)               return 1.10;
  if (rank >= 4  && rank <= 10) return 1.07;
  if (rank >= 11 && rank <= 20) return 1.05;
  if (rank >= 21 && rank <= 30) return 1.03;
  return 1.00; // rank 31–50+
}
// Monday-00:00 week start for an arbitrary reference date, used by
// performAttendancePayout so a backdated attendance entry's bonus
// eligibility is computed relative to ITS OWN week, not the current one.
function getWeekStartFor(refDate) {
  const now = new Date(refDate);
  const day = now.getDay(); // 0=Sun
  const diff = day===0 ? 6 : day-1;
  const mon = new Date(now); mon.setHours(0,0,0,0); mon.setDate(now.getDate()-diff);
  return mon;
}
// ─── SHARED ATTENDANCE PAYOUT LOGIC ───────────────────────────────────────────
// Single source of truth for "what does attending this event pay out,
// including bonuses" — used by both the live Attendance submit flow and the
// Master's "Add Missing Record" backfill (when the Master chooses to
// distribute coins rather than record-only). Keeping this in one place means
// the backfill path can never drift out of sync with the real payout math.
//
// Default values for the 3 configurable attendance bonuses — overridden by
// whatever's saved in app_state under key "bonus_config" (see
// BonusConfigEditor in Settings). Centralized here so this function
// (awarding) and Attendance's computeBonuses (progress display) both read
// from the same object instead of each hardcoding their own copy of the
// numbers, which is exactly how the ISB "0/10" display bug happened to
// drift out of sync with the real 10-event award threshold.
const DEFAULT_BONUS_CONFIG = {
  majorEventsBonusAmount: 300,
  isbVeteranBonusAmount: 500,
  isbVeteranThreshold: 10,
  sindriVeteranBonusAmount: 400,
  sindriVeteranWeeksThreshold: 5,
  ironStreakBonusAmount: 300,
  ironStreakWeeksThreshold: 4,
};
// params: { ev: EVENTS entry, date: locale date string, ts: ms timestamp,
//           present: [memberId], qualifierMap: {memberId: "full"|"late"|"afk"} }
// bonusConfig: see DEFAULT_BONUS_CONFIG above.
// Returns { payouts, bonusToasts, presentNames } — pure computation only,
// no writes. payouts is one descriptor per present member (id, name,
// coinsDelta, attendanceDelta, attendEntry, bonusTxEntries); caller is
// responsible for actually applying each one via applyAttendancePayout
// below (or an equivalent atomic write) and showing toasts.
function performAttendancePayout(members, { ev, date, ts, present, qualifierMap }, bonusConfig = DEFAULT_BONUS_CONFIG) {
  const weekStart = getWeekStartFor(date);
  const EVENT_REQUIRED = { CA: 2, STI: 2, CWTD: 2, CN1F: 2, COR: 2, F5F: 2 };
  const totalEvents = EVENTS.length;
  function getAttendedIds(log) {
    const weekLog = log.filter(e=>{ const d=new Date(e.date); return !isNaN(d)&&d>=weekStart; });
    const counts = {};
    weekLog.filter(e=>e.qualifier!=="afk").forEach(e=>{
      const evObj=EVENTS.find(x=>x.name===e.event); if(evObj?.id){ counts[evObj.id]=(counts[evObj.id]||0)+1; }
    });
    const ids = new Set();
    Object.entries(counts).forEach(([id,count])=>{ if(count>=(EVENT_REQUIRED[id]||1)) ids.add(id); });
    return ids;
  }
  function alreadyReceivedThisWeek(txLog, bonusLabel) {
    return (txLog||[]).some(tx=>tx.logType===bonusLabel && tx.date && new Date(tx.date)>=weekStart);
  }
  const presentNames = present.map(id => {
    const m = members.find(x=>x.id===id);
    const q = qualifierMap[id]||"full";
    const mult=q==="full"?1:q==="late"?0.5:0;
    const rankMult=getRankMultiplier(members,id);
    const earned=Math.floor(ev.coins*mult*rankMult);
    return {name:m?.name, qualifier:q, earned};
  });
  const bonusToasts = [];
  const payouts = [];
  members.forEach(m=>{
    if(!present.includes(m.id)) return;
    const q=qualifierMap[m.id]||"full";
    const mult=q==="full"?1:q==="late"?0.5:0;
    const rankMult=getRankMultiplier(members,m.id);
    const earned=Math.floor(ev.coins*mult*rankMult);
    const attendEntry={event:ev.name,coins:earned,date,qualifier:q,ts};
    const newAttendLog=[...(m.attendLog||[]),attendEntry];
    let bonusCoins = 0;
    const bonusEntries = [];
    // ── Major Events bonus ──
    const prevAttended = getAttendedIds(m.attendLog||[]);
    const newAttended  = getAttendedIds(newAttendLog);
    if(newAttended.size>=totalEvents && prevAttended.size<totalEvents && !alreadyReceivedThisWeek(m.txLog,"Major Events Bonus")) {
      bonusCoins += bonusConfig.majorEventsBonusAmount;
      bonusEntries.push({change:bonusConfig.majorEventsBonusAmount,reason:"Attended all major events this week",date,logType:"Major Events Bonus",addedBy:"System",ts});
      bonusToasts.push({name:m.name,bonus:"Major Events",coins:bonusConfig.majorEventsBonusAmount});
    }
    // ── ISB Veteran bonus ──
    // ROOT CAUSE of "0/10 ISB events" for everyone despite real ISB
    // attendance: this filtered on the literal string "Inter-Server
    // Battle" (hyphenated), but attend_log entries are actually written
    // with "Inter Server Battle" (space) -- see EVENT_NAME_TO_ID's own
    // comment, which already exists specifically to paper over this exact
    // naming inconsistency elsewhere in the app. Using that shared mapping
    // here (like countEventAttendance already does) instead of a hardcoded
    // spelling fixes it for both variants, present or future.
    const isbCountNew = newAttendLog.filter(e=>EVENT_NAME_TO_ID[e.event]==="ISB"&&e.qualifier!=="afk").length;
    const isbCountOld = (m.attendLog||[]).filter(e=>EVENT_NAME_TO_ID[e.event]==="ISB"&&e.qualifier!=="afk").length;
    if(isbCountNew>=bonusConfig.isbVeteranThreshold && isbCountOld<bonusConfig.isbVeteranThreshold && !alreadyReceivedThisWeek(m.txLog,"ISB Veteran Bonus")) {
      bonusCoins += bonusConfig.isbVeteranBonusAmount;
      bonusEntries.push({change:bonusConfig.isbVeteranBonusAmount,reason:`Reached ${bonusConfig.isbVeteranThreshold} ISB events (ISB Veteran)`,date,logType:"ISB Veteran Bonus",addedBy:"System",ts});
      bonusToasts.push({name:m.name,bonus:"ISB Veteran",coins:bonusConfig.isbVeteranBonusAmount});
    }
    // ── Sindri Veteran bonus — 2 STI/week for N weeks ──
    function getISOWeekSV(dateStr) {
      const d = new Date(dateStr); if(isNaN(d)) return null;
      const thu = new Date(d); thu.setDate(d.getDate() - ((d.getDay()+6)%7) + 3);
      const jan4 = new Date(thu.getFullYear(),0,4);
      return thu.getFullYear()+"W"+Math.ceil(((thu-jan4)/86400000+1)/7);
    }
    function countStiQualWeeks(log) {
      const byWeek = {};
      log.filter(e=>e.event==="Sindris Treasure Island"&&e.qualifier!=="afk").forEach(e=>{
        const wk=getISOWeekSV(e.date); if(wk){ byWeek[wk]=(byWeek[wk]||0)+1; }
      });
      return Object.values(byWeek).filter(c=>c>=2).length;
    }
    const stiWeeksOld = countStiQualWeeks(m.attendLog||[]);
    const stiWeeksNew = countStiQualWeeks(newAttendLog);
    if(stiWeeksNew>=bonusConfig.sindriVeteranWeeksThreshold && stiWeeksOld<bonusConfig.sindriVeteranWeeksThreshold && !(m.txLog||[]).some(tx=>tx.logType==="Sindri Veteran Bonus")) {
      bonusCoins += bonusConfig.sindriVeteranBonusAmount;
      bonusEntries.push({change:bonusConfig.sindriVeteranBonusAmount,reason:`Attended 2 Sindri's per week for ${bonusConfig.sindriVeteranWeeksThreshold} weeks`,date,logType:"Sindri Veteran Bonus",addedBy:"System",ts});
      bonusToasts.push({name:m.name,bonus:"Sindri Veteran",coins:bonusConfig.sindriVeteranBonusAmount});
    }
    // ── Iron Streak bonus — Major Events completed N consecutive weeks
    // running (unlike Sindri Veteran above, which only needs N total
    // qualifying weeks, not consecutive ones). Reuses the same
    // EVENT_REQUIRED/totalEvents completeness check getAttendedIds uses,
    // just bucketed per calendar week instead of only the current one.
    // "Streak" here means the run of consecutive completed weeks ending at
    // the most recent completed week — the moment that run first reaches
    // the threshold is a permanent achievement (guarded by the txLog
    // check below), even if the streak later breaks.
    function countMajorEventsStreak(log) {
      const weekCounts = {};
      log.filter(e=>e.qualifier!=="afk").forEach(e=>{
        const d = new Date(e.date); if(isNaN(d)) return;
        const evObj = EVENTS.find(x=>x.name===e.event); if(!evObj?.id) return;
        const wsTs = getWeekStartFor(e.date).getTime();
        if(!weekCounts[wsTs]) weekCounts[wsTs] = {};
        weekCounts[wsTs][evObj.id] = (weekCounts[wsTs][evObj.id]||0) + 1;
      });
      const completedWeeks = Object.entries(weekCounts)
        .filter(([, counts]) => {
          const ids = new Set();
          Object.entries(counts).forEach(([id,count])=>{ if(count>=(EVENT_REQUIRED[id]||1)) ids.add(id); });
          return ids.size >= totalEvents;
        })
        .map(([ws]) => Number(ws))
        .sort((a,b)=>b-a);
      if (completedWeeks.length === 0) return 0;
      let streak = 1;
      for (let i=1; i<completedWeeks.length; i++) {
        if (completedWeeks[i-1] - completedWeeks[i] === 7*24*60*60*1000) streak++;
        else break;
      }
      return streak;
    }
    const ironStreakOld = countMajorEventsStreak(m.attendLog||[]);
    const ironStreakNew = countMajorEventsStreak(newAttendLog);
    if(ironStreakNew>=bonusConfig.ironStreakWeeksThreshold && ironStreakOld<bonusConfig.ironStreakWeeksThreshold && !(m.txLog||[]).some(tx=>tx.logType==="Iron Streak Bonus")) {
      bonusCoins += bonusConfig.ironStreakBonusAmount;
      bonusEntries.push({change:bonusConfig.ironStreakBonusAmount,reason:`Attended all major events ${bonusConfig.ironStreakWeeksThreshold} weeks running (Iron Streak)`,date,logType:"Iron Streak Bonus",addedBy:"System",ts});
      bonusToasts.push({name:m.name,bonus:"Iron Streak",coins:bonusConfig.ironStreakBonusAmount});
    }
    payouts.push({
      id: m.id, name: m.name,
      coinsDelta: earned+bonusCoins,
      attendanceDelta: q!=="afk"?1:0,
      attendEntry,
      bonusEntries,
    });
  });
  return { payouts, bonusToasts, presentNames };
}

// Applies the payouts computed by performAttendancePayout — one atomic
// recordAttendanceAndLogAtomic call per present member, awaited, so a
// concurrent write to any of them (another bid closing, another admin
// action) can't silently drop a coin/log change the way the old bulk
// setMembers write could. Shared by both callers (a live attendance
// submission and AddMissingAttendanceModal's backdated "distribute" mode)
// instead of duplicating this loop twice.
async function applyAttendancePayout(payouts, setMembersRaw, addToast) {
  const results = await Promise.all(payouts.map(async p => {
    const newCoins = await recordAttendanceAndLogAtomic(p.name, p.coinsDelta, p.attendanceDelta, p.attendEntry, p.bonusEntries);
    return { ...p, newCoins };
  }));
  const succeeded = results.filter(r => r.newCoins !== null);
  const failed = results.filter(r => r.newCoins === null);
  if (succeeded.length > 0) {
    setMembersRaw(ms => ms.map(m => {
      const r = succeeded.find(x => x.id === m.id);
      if (!r) return m;
      return {
        ...m,
        coins: r.newCoins,
        attendance: m.attendance + r.attendanceDelta,
        attendLog: [...(m.attendLog||[]), r.attendEntry],
        txLog: [...(m.txLog||[]), ...r.bonusEntries],
      };
    }));
  }
  if (failed.length > 0) {
    addToast(
      <span style={{display:"inline-flex",alignItems:"center",gap:6}}><WarningIcon size={13}/>Couldn't record attendance for {failed.map(f=>f.name).join(", ")} — please try again for {failed.length===1?"them":"those members"}.</span>,
      "red", "Attendance Failed"
    );
  }
  return { succeeded, failed };
}

// ─── ATTENDANCE ───────────────────────────────────────────────────────────────
// ─── RECORD ATTENDANCE (Admin-only page) ───────────────────────────────────
// Extracted from Attendance's old "record" tab, which used to render as
// the FIRST tab everyone landed on — even though non-admins just saw a
// blank "Elder only" placeholder there (Attendance defaulted to
// useState("record")). Reachable only via the Admin Tools sidebar section
// now, so regular members land on the actually-useful History tab instead.
function RecordAttendancePanel({ ctx }) {
  const { t } = useLang();
  const { members, setMembersRaw, addToast, currentUser, setAttendanceLogs, bonusConfig } = ctx;
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedMembers, setSelectedMembers] = useState({});
  const [qualifier, setQualifier] = useState({});

  function toggleMember(id) {
    setSelectedMembers(p=>({...p,[id]:!p[id]}));
    if(!qualifier[id]) setQualifier(p=>({...p,[id]:"full"}));
  }

  async function submitAttendance() {
    if(!selectedEvent){addToast(t("selectEventError"),"red",t("errorLabel"));return;}
    const ev=EVENTS.find(e=>e.id===selectedEvent);
    const present=Object.entries(selectedMembers).filter(([,v])=>v).map(([id])=>parseInt(id));
    if(present.length===0){addToast(t("noMembersSelected"),"red",t("errorLabel"));return;}
    const today = new Date().toLocaleDateString();
    const nowTs = Date.now();
    const qualifierMap = {...qualifier};
    const presentNames = present.map(id => {
      const m = members.find(x=>x.id===id);
      const q = qualifierMap[id]||"full";
      const mult=q==="full"?1:q==="late"?0.5:0;
      const rankMult=getRankMultiplier(members,id);
      const earned=Math.floor(ev.coins*mult*rankMult);
      return {name:m?.name, qualifier:q, earned};
    });
    const { payouts, bonusToasts } = performAttendancePayout(members, { ev, date: today, ts: nowTs, present, qualifierMap }, bonusConfig);
    await applyAttendancePayout(payouts, setMembersRaw, addToast);
    setTimeout(()=>{
      bonusToasts.forEach(bonus=>addToast(<span style={{display:"inline-flex",alignItems:"center",gap:6}}><TrophyIcon size={14}/>{bonus.name} {t("earnedBonusText")} +{bonus.coins} {t("coinsText")} — {bonus.bonus} {t("bonusText")}</span>,"gold",t("bonusAwarded")));
    }, 200);
    const logEntry = {id:Date.now(),event:ev.name,date:today,ts:nowTs,members:present.length,recordedBy:currentUser.name,attendees:presentNames};
    setAttendanceLogs(p=>[logEntry,...p]);
    addToast(`${t("attendanceRecorded")} ${present.length} ${t("membersUpdated")}`,"blue",t("attendanceSaved"));
    setSelectedMembers({});setQualifier({});setSelectedEvent(null);
  }

  return (
    <div className="grid-2">
      <div>
        <div className="card" style={{marginBottom:20}}>
          <SectionTitle>Select Event</SectionTitle>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {EVENTS.map(ev=>(
              <div key={ev.id} className={`event-pill${selectedEvent===ev.id?" selected":""}`} onClick={()=>setSelectedEvent(ev.id)}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span>{ev.name}</span>
                  <span style={{color:"var(--gold)",fontFamily:"'Inter',sans-serif",fontWeight:800}}>+{ev.coins}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        {selectedEvent && (
          <div className="card card-blue">
            <div style={{fontSize:11,color:"var(--text-dim)",marginBottom:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>{t("coinRules")}</div>
            <div style={{fontSize:13,marginBottom:4,fontFamily:"'Inter',sans-serif"}}>{t("full")}: <strong style={{color:"var(--gold)"}}>{EVENTS.find(e=>e.id===selectedEvent)?.coins}</strong></div>
            <div style={{fontSize:13,marginBottom:4,fontFamily:"'Inter',sans-serif"}}>{t("late")}: <strong style={{color:"var(--gold)"}}>{Math.floor(EVENTS.find(e=>e.id===selectedEvent)?.coins*0.5)}</strong></div>
            <div style={{fontSize:13,fontFamily:"'Inter',sans-serif"}}>{t("afk")}: <strong style={{color:"var(--text-dim)"}}>0</strong></div>
          </div>
        )}
      </div>
      <div className="card">
        <SectionTitle>{t("markMembers")}</SectionTitle>
        <input
          className="input"
          type="text"
          placeholder={t("searchMember")}
          value={memberSearch}
          onChange={e=>setMemberSearch(e.target.value)}
          style={{marginBottom:10,width:"100%"}}
        />
        <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:340,overflowY:"auto"}}>
          {members.filter(m=>m.name.toLowerCase().includes(memberSearch.toLowerCase())).map(m=>(
            <div key={m.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:2,background:selectedMembers[m.id]?"rgba(201,151,42,0.07)":"rgba(10,11,15,0.5)",border:`1px solid ${selectedMembers[m.id]?"var(--gold-dim)":"transparent"}`,cursor:"pointer"}} onClick={()=>toggleMember(m.id)}>
              <input type="checkbox" checked={!!selectedMembers[m.id]} onChange={()=>toggleMember(m.id)} style={{accentColor:"var(--gold)"}} />
              <ClassIcon cls={m.cls} size={32} />
              <span style={{flex:1,fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:13,color:"var(--text-bright)"}}>{m.name}</span>
              {selectedMembers[m.id] && (
                <select className="select" style={{width:"auto",padding:"3px 8px",fontSize:11}} value={qualifier[m.id]||"full"} onClick={e=>e.stopPropagation()} onChange={e=>{e.stopPropagation();setQualifier(p=>({...p,[m.id]:e.target.value}));}}>
                  <option value="full">{t("full")}</option><option value="late">{t("late")}</option><option value="afk">{t("afk")}</option>
                </select>
              )}
            </div>
          ))}
        </div>
        <div style={{marginTop:16,display:"flex",gap:10}}>
          <button className="btn btn-gold" style={{flex:1}} onClick={submitAttendance}>{t("submitAttendance")}</button>
          <button className="btn btn-outline" onClick={()=>{setSelectedMembers({});setQualifier({});}}>{t("clear")}</button>
        </div>
      </div>
    </div>
  );
}

function Attendance({ ctx }) {
  const { t } = useLang();
  const { members, addToast, currentUser, attendanceLogs, setAttendanceLogs, setModal, decayRate, decayAnnouncements, bonusConfig } = ctx;
  const [tab, setTab] = useState("logs");
  const [bonusSearch, setBonusSearch] = useState("");
  const [historyFilter, setHistoryFilter] = useState("All");
  const [historyPage, setHistoryPage] = useState(0);
  const [globalLogPage, setGlobalLogPage] = useState(0);
  const isAdmin = !!currentUser && (currentUser.role==="Elder"||currentUser.role==="Master");
  const isMaster = !!currentUser && currentUser.role==="Master";
  const [logPage, setLogPage] = useState(0);
  const [expandedLog, setExpandedLog] = useState(null);
  const PAGE_SIZE = 10;

  // Downloads a single attendance log's attendee list (name, qualifier,
  // coins earned) as a CSV — for Elders/Master to keep an offline record of
  // one specific event without having to export everything.
  function downloadLogCSV(log) {
    const headers = ["Member", "Qualifier", "CoinsEarned"];
    const csvRow = (vals) => vals.map(v => JSON.stringify(v===undefined||v===null?"":v)).join(",");
    const lines = [csvRow(headers)];
    (log.attendees||[]).forEach(a => {
      lines.push(csvRow([a.name||"", a.qualifier||"full", a.earned||0]));
    });
    const csv = lines.join("\n");
    const blob = new Blob([csv], {type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const safeEvent = (log.event||"attendance").replace(/[^a-z0-9]+/gi,"_");
    const safeDate = (log.date||"").replace(/[^a-z0-9]+/gi,"_");
    const filename = `${safeEvent}_${safeDate||log.id}.csv`;
    const link = document.createElement("a");
    link.href = url; link.download = filename; link.click();
    URL.revokeObjectURL(url);
    addToast(`${filename} ${t("fileDownloaded")}`,"green",t("exportLabel"));
  }

  // Bonus calculation — weekly window resets every Monday 00:00 (end of Sunday)
  function getWeekStart() {
    const now = new Date();
    const day = now.getDay(); // 0=Sun
    const diff = day===0 ? 6 : day-1;
    const mon = new Date(now); mon.setHours(0,0,0,0); mon.setDate(now.getDate()-diff);
    return mon;
  }
  function computeBonuses(member) {
    const log = member.attendLog||[];
    const weekStart = getWeekStart();
    // Only count this week's attendance for Perfect Attendance
    const weekLog = log.filter(e=>{ const d=new Date(e.date); return !isNaN(d)&&d>=weekStart; });
    const totalEvents = EVENTS.length;
    const recentEvents = weekLog;

    // Count weekly attendances per event (excluding AFK)
    const weekEventCounts = {};
    weekLog.filter(e=>e.qualifier!=="afk").forEach(e=>{
      const ev=EVENTS.find(ev=>ev.name===e.event);
      if(ev?.id){ weekEventCounts[ev.id]=(weekEventCounts[ev.id]||0)+1; }
    });

    // Build the set of "counted" events this week:
    // CA requires 2x, STI requires 2x, each World Boss requires 2x; all others require 1x.
    const EVENT_REQUIRED = { CA: 2, STI: 2, CWTD: 2, CN1F: 2, COR: 2, F5F: 2 };
    const attendedIds = new Set();
    Object.entries(weekEventCounts).forEach(([id, count])=>{
      const required = EVENT_REQUIRED[id] || 1;
      if(count >= required) attendedIds.add(id);
    });
    const attendedAll = attendedIds.size>=totalEvents;
    // Sindri Veteran: attended 2 STI per week for 5 consecutive weeks
    // Count distinct ISO week strings where STI count >= 2
    function getISOWeek(dateStr) {
      const d = new Date(dateStr); if(isNaN(d)) return null;
      const thu = new Date(d); thu.setDate(d.getDate() - ((d.getDay()+6)%7) + 3);
      const jan4 = new Date(thu.getFullYear(),0,4);
      return thu.getFullYear()+"W"+Math.ceil(((thu-jan4)/86400000+1)/7);
    }
    const stiByWeek = {};
    log.filter(e=>e.event==="Sindris Treasure Island"&&e.qualifier!=="afk").forEach(e=>{
      const wk=getISOWeek(e.date); if(wk){ stiByWeek[wk]=(stiByWeek[wk]||0)+1; }
    });
    const stiQualWeeks = Object.values(stiByWeek).filter(c=>c>=2).length;
    const sindriVet = stiQualWeeks>=bonusConfig.sindriVeteranWeeksThreshold;
    // ISB Veteran: all-time ISB count (see EVENT_NAME_TO_ID -- attend_log
    // stores "Inter Server Battle", not the hyphenated schedule name)
    const isbCount = log.filter(e=>EVENT_NAME_TO_ID[e.event]==="ISB"&&e.qualifier!=="afk").length;
    const isbVet = isbCount>=bonusConfig.isbVeteranThreshold;
    // Iron Streak: consecutive weeks (not just total, unlike Sindri Veteran
    // above) with all major events completed — same completeness rule as
    // attendedAll, bucketed per calendar week instead of only this one.
    // Mirrors performAttendancePayout's countMajorEventsStreak exactly, so
    // this progress display can never drift from what actually pays out.
    const ironWeekCounts = {};
    log.filter(e=>e.qualifier!=="afk").forEach(e=>{
      const d = new Date(e.date); if(isNaN(d)) return;
      const evObj = EVENTS.find(x=>x.name===e.event); if(!evObj?.id) return;
      const wsTs = getWeekStartFor(e.date).getTime();
      if(!ironWeekCounts[wsTs]) ironWeekCounts[wsTs] = {};
      ironWeekCounts[wsTs][evObj.id] = (ironWeekCounts[wsTs][evObj.id]||0) + 1;
    });
    const ironCompletedWeeks = Object.entries(ironWeekCounts)
      .filter(([, counts]) => {
        const ids = new Set();
        Object.entries(counts).forEach(([id,count])=>{ if(count>=(EVENT_REQUIRED[id]||1)) ids.add(id); });
        return ids.size >= totalEvents;
      })
      .map(([ws]) => Number(ws))
      .sort((a,b)=>b-a);
    let ironStreak = 0;
    if (ironCompletedWeeks.length > 0) {
      ironStreak = 1;
      for (let i=1; i<ironCompletedWeeks.length; i++) {
        if (ironCompletedWeeks[i-1] - ironCompletedWeeks[i] === 7*24*60*60*1000) ironStreak++;
        else break;
      }
    }
    const ironVet = ironStreak>=bonusConfig.ironStreakWeeksThreshold;
    return {attendedAll,sindriVet,stiQualWeeks,isbVet,isbCount,ironVet,ironStreak,recentEvents,totalEvents,attendedNames:attendedIds};
  }

  const pagedLogs = attendanceLogs.slice(logPage*PAGE_SIZE, (logPage+1)*PAGE_SIZE);
  const totalPages = Math.ceil(attendanceLogs.length/PAGE_SIZE);

  // ── Hero strip stats — clan-wide orientation numbers shown above the
  // tabs, reusing logSortKey/getWeekStart rather than re-deriving sort/
  // week-boundary logic that already exists for this exact data. ──
  const heroWeekStart = getWeekStart().getTime();
  const logsThisWeek = attendanceLogs.filter(l => logSortKey(l) >= heroWeekStart).length;
  const latestLog = attendanceLogs.length > 0
    ? [...attendanceLogs].sort((a,b)=>logSortKey(b)-logSortKey(a))[0]
    : null;

  return (
    <div>
      {/* ── WAR LEDGER STRIP — compact hero-adjacent orientation zone,
          shorter than Clan HQ's full banner since this is a working data
          page, not a showcase. Same corner-bracket/glow language. ── */}
      <div style={{
        position:"relative",overflow:"hidden",borderRadius:8,marginBottom:24,
        background:"linear-gradient(135deg,#0e0b09 0%,#161110 50%,#0e0b09 100%)",
        border:"1px solid rgba(200,146,42,0.18)",
        boxShadow:"0 6px 32px rgba(0,0,0,0.7), inset 0 1px 0 rgba(200,146,42,0.1)",
        padding:"18px 24px",
      }}>
        <CornerBrackets size={14} thickness={2} inset={10} opacity={0.4}/>
        <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 15% 0%,rgba(200,146,42,0.08) 0%,transparent 55%)",pointerEvents:"none"}}/>
        <div style={{position:"relative",display:"flex",flexWrap:"wrap",gap:28,alignItems:"center"}}>
          <div>
            <div style={{fontFamily:"'Spectral',serif",fontSize:18,fontWeight:800,color:"var(--gold-light)",letterSpacing:1}}>{t("tabHistory")} &amp; {t("tabBonuses")}</div>
            <div style={{fontSize:10,color:"#7c6d58",letterSpacing:2,textTransform:"uppercase",marginTop:2,fontFamily:"'Inter',sans-serif"}}>{CLAN_NAME}</div>
          </div>
          <div style={{width:1,height:32,background:"rgba(200,146,42,0.2)"}}/>
          <div>
            <div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"rgba(200,146,42,0.7)",fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{t("totalLogsLabel")}</div>
            <div style={{fontFamily:"'Spectral',serif",fontSize:22,fontWeight:800,color:"var(--gold-bright)",textShadow:"0 0 16px rgba(200,146,42,0.3)"}}>{fmt(attendanceLogs.length)}</div>
          </div>
          <div>
            <div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"rgba(200,146,42,0.7)",fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{t("thisWeekLabel")}</div>
            <div style={{fontFamily:"'Spectral',serif",fontSize:22,fontWeight:800,color:"var(--gold-bright)",textShadow:"0 0 16px rgba(200,146,42,0.3)"}}>{fmt(logsThisWeek)}</div>
          </div>
          {latestLog && (
            <div style={{minWidth:0}}>
              <div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"rgba(200,146,42,0.7)",fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{t("latestEventLabel")}</div>
              <div style={{fontFamily:"'Inter',sans-serif",fontSize:14,fontWeight:700,color:"var(--text-bright)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:220}}>{latestLog.event}</div>
            </div>
          )}
        </div>
      </div>

      <div className="dash-tabs">
        <div className={`dash-tab${tab==="logs"?" active":""}`} onClick={()=>setTab("logs")}>{t("tabHistory")}</div>
        <div className={`dash-tab${tab==="bonuses"?" active":""}`} onClick={()=>setTab("bonuses")}>{t("tabBonuses")}</div>
        <div className={`dash-tab${tab==="mylog"?" active":""}`} onClick={()=>setTab("mylog")}>{t("tabMyLog")}</div>
        <div className={`dash-tab${tab==="globallog"?" active":""}`} onClick={()=>setTab("globallog")}>{t("tabGlobalLog")}</div>
      </div>

      {tab==="logs" && (
        <>
        {isAdmin && (
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
            <button className="btn btn-outline btn-sm" onClick={()=>setModal({type:"addMissingAttendance"})}>{t("addMissingRecord")}</button>
          </div>
        )}
        <div className="dash-panel attendance-table-view" style={{
          padding:0,position:"relative",overflow:"hidden",
          background:"linear-gradient(135deg,#161110 0%,#1c1410 60%,#161110 100%)",
          border:"1px solid rgba(200,146,42,0.2)",borderRadius:6,
        }}>
          <CornerBrackets size={13} thickness={1.5} inset={8} opacity={0.4}/>
          <div className="table-wrap">
            <table className="table-stack">
              <thead><tr><th>{t("colDateTime")}</th><th>{t("colEvent")}</th><th>{t("colMembers")}</th><th>{t("colRecBy")}</th><th>{t("attendeesLabel")}</th>{isMaster&&<th>{t("colActions")}</th>}</tr></thead>
              <tbody>
                {attendanceLogs.length===0 && <tr><td colSpan={isMaster?6:5} style={{textAlign:"center",color:"var(--text-dim)",padding:32}}>{t("noAttendanceYet")}</td></tr>}
                {pagedLogs.map(l=>(
                  <>
                    <tr key={l.id}>
                      <td data-label="Date & Time" style={{fontWeight:500,whiteSpace:"nowrap"}}>{formatLogDateTime(l)}</td>
                      <td data-label="Event" style={{fontFamily:"'Inter',sans-serif",fontWeight:700}}>{l.event}</td>
                      <td data-label="Members"><span className="badge badge-blue">{l.members} {t("membersCountLabel")}</span></td>
                      <td data-label="Rec. By" style={{color:"var(--gold-light)",fontWeight:700}}>{l.recordedBy}</td>
                      <td data-label="Attendees">
                        <div style={{display:"flex",gap:6}}>
                          <button className="btn btn-ghost btn-sm" onClick={()=>setExpandedLog(expandedLog===l.id?null:l.id)}>
                            {expandedLog===l.id?t("hideAttendees"):t("showAttendees")}
                          </button>
                          {isAdmin && (
                            <button className="btn btn-ghost btn-sm" title={t("downloadCsvTitle")} onClick={()=>downloadLogCSV(l)}>
                              ⬇ CSV
                            </button>
                          )}
                        </div>
                      </td>
                      {isMaster && (
                        <td data-label="Actions">
                          <button className="btn btn-red btn-sm" onClick={()=>setModal({type:"deleteAttendance",data:l})}>{t("removeAction")}</button>
                        </td>
                      )}
                    </tr>
                    {expandedLog===l.id && (
                      <tr key={`${l.id}-expand`}>
                        <td colSpan={isMaster?6:5} style={{padding:"10px 18px",background:"rgba(10,11,15,0.7)"}}>
                          <div style={{fontFamily:"'Inter',sans-serif",fontSize:10,color:"var(--gold-dim)",fontWeight:700,letterSpacing:2,marginBottom:8,textTransform:"uppercase"}}>{t("attendeesLabel")}</div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                            {(l.attendees||[]).map((a,i)=>(
                              <div key={i} style={{display:"flex",alignItems:"center",gap:6,background:"rgba(201,151,42,0.08)",border:"1px solid var(--border)",borderRadius:2,padding:"4px 10px"}}>
                                <span style={{fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:12,color:"var(--text-bright)"}}>{a.name}</span>
                                <span className={`badge ${a.qualifier==="full"?"badge-gold":a.qualifier==="late"?"badge-blue":"badge-red"}`}>{a.qualifier}</span>
                                {a.earned>0&&<span style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:"var(--gold)",fontWeight:700}}>+{a.earned}</span>}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages>1 && (
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 18px",borderTop:"1px solid var(--border)",justifyContent:"flex-end"}}>
              <span style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:"var(--text-dim)"}}>{t("pageOf")} {logPage+1} {t("ofLabel")} {totalPages}</span>
              <button className="btn btn-outline btn-sm" disabled={logPage===0} onClick={()=>setLogPage(p=>p-1)} style={{opacity:logPage===0?0.4:1}}>{t("prevPage")}</button>
              <button className="btn btn-outline btn-sm" disabled={logPage>=totalPages-1} onClick={()=>setLogPage(p=>p+1)} style={{opacity:logPage>=totalPages-1?0.4:1}}>{t("nextPage")}</button>
            </div>
          )}
        </div>

        {/* Mobile card view — same data as the table above, shown only on narrow screens (see .attendance-card-view media query) */}
        <div className="attendance-card-view">
          {attendanceLogs.length===0 && <div className="dash-subcard" style={{textAlign:"center",color:"var(--text-dim)",padding:32}}>{t("noAttendanceYet")}</div>}
          {pagedLogs.map(l=>(
            <div key={`card-${l.id}`} className="dash-subcard" style={{marginBottom:10,padding:"14px 16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8,marginBottom:6}}>
                <span style={{fontFamily:"'Inter',sans-serif",fontWeight:800,fontSize:14,color:"var(--text-bright)",minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.event}</span>
                <span style={{fontSize:10,color:"var(--text-dim)",flexShrink:0,whiteSpace:"nowrap"}}>{formatLogDateTime(l)}</span>
              </div>
              <div style={{display:"flex",gap:14,fontSize:11,color:"var(--text-mid)",marginBottom:10,flexWrap:"wrap"}}>
                <span>{l.members} {t("membersCountLabel")}</span>
                <span>{t("recordedByCardLabel")} <span style={{color:"var(--gold-light)",fontWeight:700}}>{l.recordedBy}</span></span>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button className="btn btn-ghost btn-sm" style={{flex:1}} onClick={()=>setExpandedLog(expandedLog===l.id?null:l.id)}>
                  {expandedLog===l.id?t("hideAttendees"):t("showAttendees")}
                </button>
                {isAdmin && (
                  <button className="btn btn-ghost btn-sm" style={{flexShrink:0,width:38}} title={t("downloadCsvTitle")} onClick={()=>downloadLogCSV(l)}>⬇</button>
                )}
                {isMaster && (
                  <button className="btn btn-red btn-sm" style={{flexShrink:0,width:38}} title={t("removeAction")} onClick={()=>setModal({type:"deleteAttendance",data:l})}>✕</button>
                )}
              </div>
              {expandedLog===l.id && (
                <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid var(--border-dim)"}}>
                  <div style={{fontFamily:"'Inter',sans-serif",fontSize:9,color:"var(--gold-dim)",fontWeight:700,letterSpacing:2,marginBottom:8,textTransform:"uppercase"}}>{t("attendeesLabel")}</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                    {(l.attendees||[]).map((a,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:6,background:"rgba(201,151,42,0.08)",border:"1px solid var(--border)",borderRadius:2,padding:"4px 10px"}}>
                        <span style={{fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:12,color:"var(--text-bright)"}}>{a.name}</span>
                        <span className={`badge ${a.qualifier==="full"?"badge-gold":a.qualifier==="late"?"badge-blue":"badge-red"}`}>{a.qualifier}</span>
                        {a.earned>0&&<span style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:"var(--gold)",fontWeight:700}}>+{a.earned}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          {totalPages>1 && (
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 4px",justifyContent:"center"}}>
              <button className="btn btn-outline btn-sm" disabled={logPage===0} onClick={()=>setLogPage(p=>p-1)} style={{opacity:logPage===0?0.4:1}}>{t("prevPage")}</button>
              <span style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:"var(--text-dim)"}}>{logPage+1} {t("ofLabel")} {totalPages}</span>
              <button className="btn btn-outline btn-sm" disabled={logPage>=totalPages-1} onClick={()=>setLogPage(p=>p+1)} style={{opacity:logPage>=totalPages-1?0.4:1}}>{t("nextPage")}</button>
            </div>
          )}
        </div>
        </>
      )}

      {tab==="bonuses" && (
        <div style={{display:"flex",flexWrap:"wrap",gap:24}}>
          {/* Primary column — search + member bonus-progress grid */}
          <div style={{flex:"2 1 500px",minWidth:0}}>
          <div style={{marginBottom:16}}>
            <input className="input" placeholder={t("searchWarrior")} value={bonusSearch} onChange={e=>setBonusSearch(e.target.value)} style={{maxWidth:300}} />
          </div>
          <div className="grid-3">
            {members.filter(m=>m.name.toLowerCase().includes(bonusSearch.toLowerCase())).map(m=>{
              const b = computeBonuses(m);
              return (
                <div key={m.id} className="dash-subcard" style={{padding:18}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                    <ClassIcon cls={m.cls} size={36}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:13,color:"var(--text-bright)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.name}</div>
                      <div style={{fontSize:10,color:"var(--text-dim)",fontWeight:600,letterSpacing:1}}>{m.cls}</div>
                    </div>
                  </div>
                  {/* Major Events */}
                  <div style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                      <span style={{fontFamily:"'Inter',sans-serif",fontSize:11,fontWeight:700,color:b.attendedAll?"var(--gold-light)":"var(--text-dim)"}}>{t("majorEvents")}</span>
                      {b.attendedAll?<span className="badge badge-gold">+{bonusConfig.majorEventsBonusAmount}</span>:<span style={{fontSize:9,color:"var(--text-dim)",fontFamily:"'Inter',sans-serif"}}>{b.attendedNames.size}/{b.totalEvents}</span>}
                    </div>
                    <div style={{height:4,background:"rgba(255,255,255,0.07)",borderRadius:2}}>
                      <div style={{height:4,borderRadius:2,background:"linear-gradient(90deg,var(--gold-dim),var(--gold-light))",width:`${Math.min(100,(b.attendedNames.size/b.totalEvents)*100)}%`,transition:"width 0.4s"}} />
                    </div>
                    <div style={{fontSize:9,color:"var(--text-dim)",marginTop:3,fontFamily:"'Inter',sans-serif"}}>ISB · CA×2 · STI×2 · CS · CWTD×2 · CN1F×2 · COR×2 · F5F×2</div>
                  </div>
                  {/* Sindri Veteran */}
                  <div style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                      <span style={{fontFamily:"'Inter',sans-serif",fontSize:11,fontWeight:700,color:b.sindriVet?"var(--gold-light)":"var(--text-dim)"}}>{t("sindriVeteran")}</span>
                      {b.sindriVet?<span className="badge badge-gold">{t("earned")}</span>:<span style={{fontSize:9,color:"var(--text-dim)",fontFamily:"'Inter',sans-serif"}}>{b.stiQualWeeks}/{bonusConfig.sindriVeteranWeeksThreshold} {t("weeksLabel")}</span>}
                    </div>
                    <div style={{height:4,background:"rgba(255,255,255,0.07)",borderRadius:2}}>
                      <div style={{height:4,borderRadius:2,background:"linear-gradient(90deg,#6c1e6c,#9b59b6)",width:`${Math.min(100,(b.stiQualWeeks/bonusConfig.sindriVeteranWeeksThreshold)*100)}%`,transition:"width 0.4s"}} />
                    </div>
                    <div style={{fontSize:9,color:"var(--text-dim)",marginTop:3,fontFamily:"'Inter',sans-serif"}}>{b.stiQualWeeks}/{bonusConfig.sindriVeteranWeeksThreshold} {t("sindriProgress")}</div>
                  </div>
                  {/* ISB Veteran */}
                  <div style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                      <span style={{fontFamily:"'Inter',sans-serif",fontSize:11,fontWeight:700,color:b.isbVet?"var(--gold-light)":"var(--text-dim)"}}>{t("isbVeteran")}</span>
                      {b.isbVet && <span className="badge badge-gold">+{bonusConfig.isbVeteranBonusAmount}</span>}
                    </div>
                    <div style={{height:4,background:"rgba(255,255,255,0.07)",borderRadius:2}}>
                      <div style={{height:4,borderRadius:2,background:"linear-gradient(90deg,#6c1e6c,#8e44ad)",width:`${Math.min(100,(b.isbCount/bonusConfig.isbVeteranThreshold)*100)}%`,transition:"width 0.4s"}} />
                    </div>
                    <div style={{fontSize:9,color:"var(--text-dim)",marginTop:3,fontFamily:"'Inter',sans-serif"}}>{b.isbCount}/{bonusConfig.isbVeteranThreshold} {t("isbProgress")}</div>
                  </div>
                  {/* Iron Streak */}
                  <div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                      <span style={{fontFamily:"'Inter',sans-serif",fontSize:11,fontWeight:700,color:b.ironVet?"var(--gold-light)":"var(--text-dim)"}}>{t("ironStreak")}</span>
                      {b.ironVet && <span className="badge badge-gold">+{bonusConfig.ironStreakBonusAmount}</span>}
                    </div>
                    <div style={{height:4,background:"rgba(255,255,255,0.07)",borderRadius:2}}>
                      <div style={{height:4,borderRadius:2,background:"linear-gradient(90deg,#6c3a1e,#d47a2e)",width:`${Math.min(100,(b.ironStreak/bonusConfig.ironStreakWeeksThreshold)*100)}%`,transition:"width 0.4s"}} />
                    </div>
                    <div style={{fontSize:9,color:"var(--text-dim)",marginTop:3,fontFamily:"'Inter',sans-serif"}}>{b.ironStreak}/{bonusConfig.ironStreakWeeksThreshold} {t("ironStreakProgress")}</div>
                  </div>
                </div>
              );
            })}
            {members.filter(m=>m.name.toLowerCase().includes(bonusSearch.toLowerCase())).length===0&&(
              <div style={{gridColumn:"1/-1",textAlign:"center",padding:32,color:"var(--text-dim)",fontFamily:"'Inter',sans-serif"}}>{t("noWarriorMatch")}</div>
            )}
          </div>
          </div>

          {/* Sidebar column — persistent reference rules, no longer
              stacked below the grid competing for the same vertical space */}
          <div style={{flex:"1 1 300px",minWidth:0}}>
          <div className="dash-panel" style={{
            marginBottom:24,position:"relative",overflow:"hidden",
            background:"linear-gradient(135deg,#161110 0%,rgba(201,151,42,0.08) 60%,#161110 100%)",
            border:"1px solid rgba(201,151,42,0.3)",borderRadius:6,padding:20,
          }}>
            <CornerBrackets size={11} thickness={1.5} inset={7} opacity={0.4}/>
            <div style={{fontSize:10,letterSpacing:3,textTransform:"uppercase",color:"rgba(200,146,42,0.7)",fontWeight:700,marginBottom:4,fontFamily:"'Inter',sans-serif"}}>{t("bonusRules")}</div>
            <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:10}}>
              <div style={{fontSize:12,color:"var(--text-dim)"}}>{t("bonusRuleMajor")} <strong style={{color:"var(--gold)"}}>+{bonusConfig.majorEventsBonusAmount} {t("coinsText")}</strong></div>
              <div style={{fontSize:12,color:"var(--text-dim)"}}>{t("bonusRuleSindri").replace("{n}",bonusConfig.sindriVeteranWeeksThreshold)} <strong style={{color:"var(--gold)"}}>+{bonusConfig.sindriVeteranBonusAmount} {t("coinsText")}</strong> {t("bonusOneTime")}</div>
              <div style={{fontSize:12,color:"var(--text-dim)"}}>{t("bonusRuleISB").replace("{n}",bonusConfig.isbVeteranThreshold)} <strong style={{color:"var(--gold)"}}>+{bonusConfig.isbVeteranBonusAmount} {t("coinsText")}</strong> {t("bonusOneTime")}</div>
              <div style={{fontSize:12,color:"var(--text-dim)"}}>{t("bonusRuleIron").replace("{n}",bonusConfig.ironStreakWeeksThreshold)} <strong style={{color:"var(--gold)"}}>+{bonusConfig.ironStreakBonusAmount} {t("coinsText")}</strong> {t("bonusOneTime")}</div>
            </div>
          </div>
          <div className="dash-panel" style={{
            position:"relative",overflow:"hidden",
            background:"linear-gradient(135deg,#1c1210 0%,rgba(168,50,40,0.1) 60%,#1c1210 100%)",
            border:"1px solid rgba(168,50,40,0.35)",borderRadius:6,padding:20,
          }}>
            <CornerBrackets size={11} thickness={1.5} inset={7} opacity={0.35}/>
            <div style={{fontSize:10,letterSpacing:3,textTransform:"uppercase",color:"rgba(224,112,112,0.8)",fontWeight:700,marginBottom:4,fontFamily:"'Inter',sans-serif"}}>{t("weeklyCoinDecay")}</div>
            <div style={{fontSize:12,color:"var(--text-dim)",lineHeight:1.7,marginTop:10}}>{t("decayWarningPrefix")} {Math.round(decayRate*1000)/10}% {t("decayWarningSuffix")}</div>
            <span className="badge badge-red" style={{marginTop:8,display:"inline-block"}}>-{Math.round(decayRate*1000)/10}% / {t("decayBadgeSuffix")}</span>
          </div>
          </div>
        </div>
      )}

      {tab==="mylog" && (
        <div className="dash-panel" style={{
          padding:0,position:"relative",overflow:"hidden",
          background:"linear-gradient(135deg,#161110 0%,#1c1410 60%,#161110 100%)",
          border:"1px solid rgba(200,146,42,0.2)",borderRadius:6,
        }}>
          <CornerBrackets size={13} thickness={1.5} inset={8} opacity={0.4}/>
          <div style={{padding:"18px 20px",borderBottom:"1px solid var(--border)"}}>
            <div style={{fontFamily:"'Spectral',serif",fontSize:18,fontWeight:700,color:"var(--gold-light)"}}>{t("myPointsHistoryTitle")}</div>
            <div style={{fontSize:11,color:"var(--text-dim)",marginTop:3,fontFamily:"'Inter',sans-serif"}}>{t("myPointsHistoryDesc")}</div>
          </div>
          {(()=>{
            const rawEntries = buildPointsHistoryEntries(currentUser, t);
            // Build the filter options from whichever types actually appear,
            // preferring a sensible fixed order with anything unexpected tacked on.
            const PREFERRED_ORDER = ["Attendance","Major Events Bonus","ISB Veteran Bonus","Sindri Veteran Bonus","Iron Streak Bonus","Bonus Points","Elder Request","Admin Manual Add","Bid Placed","Outbid Refund","Auction Win","Weekly Decay","Balance Correction"];
            const presentTypes = PREFERRED_ORDER.filter(type=>rawEntries.some(e=>e.type===type));
            rawEntries.forEach(e=>{ if(!presentTypes.includes(e.type)) presentTypes.push(e.type); });
            const filteredEntries = historyFilter==="All" ? rawEntries : rawEntries.filter(e=>e.type===historyFilter);
            const totalPages = Math.max(1, Math.ceil(filteredEntries.length / HISTORY_TAB_PAGE_SIZE));
            const safePage = Math.min(historyPage, totalPages-1);
            const pagedEntries = filteredEntries.slice(safePage*HISTORY_TAB_PAGE_SIZE, (safePage+1)*HISTORY_TAB_PAGE_SIZE);
            const badgeClass = pointsHistoryBadgeClass;
            return (
              <>
                {presentTypes.length>0 && (
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",padding:"12px 20px",borderBottom:"1px solid var(--border)"}}>
                    {["All",...presentTypes].map(filterType=>(
                      <button key={filterType} className={`btn btn-sm ${historyFilter===filterType?"btn-gold":"btn-outline"}`} onClick={()=>{setHistoryFilter(filterType);setHistoryPage(0);}}>{filterType}</button>
                    ))}
                  </div>
                )}
                {rawEntries.length===0 ? (
                  <div style={{padding:32,textAlign:"center",color:"var(--text-dim)",fontFamily:"'Inter',sans-serif"}}>{t("noPointsHistory")}</div>
                ) : filteredEntries.length===0 ? (
                  <div style={{padding:32,textAlign:"center",color:"var(--text-dim)",fontFamily:"'Inter',sans-serif"}}>{t("noEntriesFilter")}</div>
                ) : (
                  <>
                  <div className="table-wrap attendance-table-view">
                    <table className="table-stack">
                      <thead><tr><th>{t("colDateTime")}</th><th>{t("colType")}</th><th>{t("colDetails")}</th><th>{t("colCoins")}</th><th>{t("colBalance")}</th></tr></thead>
                      <tbody>
                        {pagedEntries.map((e,i)=>(
                          <tr key={i}>
                            <td data-label="Date & Time" style={{fontWeight:500,whiteSpace:"nowrap"}}>{formatLogDateTime(e)}</td>
                            <td data-label="Type"><span className={`badge ${badgeClass(e)}`}>{typeLabel(e.type,t)}</span></td>
                            <td data-label="Details" style={{fontFamily:"'Inter',sans-serif",fontWeight:600}}>{e.details}</td>
                            <td data-label="Coins" style={{fontFamily:"'Inter',sans-serif",fontWeight:800,color:e.coins>=0?"var(--gold-light)":"#e07070"}}><span style={{display:"inline-flex",alignItems:"center",gap:4}}><StatIcon src={COINS_ICON} size={22}/>{e.coins>0?`+${e.coins}`:e.coins}</span></td>
                            <td data-label="Balance" style={{fontFamily:"'Inter',sans-serif",fontWeight:700,color:"var(--text-mid)"}}><span style={{display:"inline-flex",alignItems:"center",gap:4}}><StatIcon src={COINS_ICON} size={18}/>{fmt(e.balanceAfter)}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="attendance-card-view" style={{padding:"4px 16px 16px"}}>
                    {pagedEntries.map((e,i)=>(
                      <div key={`card-${i}`} className="dash-subcard" style={{marginBottom:8,padding:"12px 14px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8,marginBottom:6}}>
                          <span className={`badge ${badgeClass(e)}`}>{typeLabel(e.type,t)}</span>
                          <span style={{fontSize:10,color:"var(--text-dim)",whiteSpace:"nowrap"}}>{formatLogDateTime(e)}</span>
                        </div>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                          <span style={{fontFamily:"'Inter',sans-serif",fontWeight:600,fontSize:12,color:"var(--text-bright)",minWidth:0,overflow:"hidden",textOverflow:"ellipsis"}}>{e.details}</span>
                          <span style={{fontFamily:"'Inter',sans-serif",fontWeight:800,fontSize:13,color:e.coins>=0?"var(--gold-light)":"#e07070",flexShrink:0,display:"inline-flex",alignItems:"center",gap:4}}><StatIcon src={COINS_ICON} size={18}/>{e.coins>0?`+${e.coins}`:e.coins}</span>
                        </div>
                        <div style={{display:"flex",justifyContent:"flex-end",marginTop:4}}>
                          <span style={{fontSize:10,color:"var(--text-dim)"}}>{t("colBalance")}: <span style={{color:"var(--text-mid)",fontWeight:700}}>{fmt(e.balanceAfter)}</span></span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {totalPages>1 && (
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 20px",gap:8,borderTop:"1px solid var(--border)"}}>
                      <span style={{fontSize:10,color:"var(--text-dim)",fontFamily:"'Inter',sans-serif"}}>
                        {safePage*HISTORY_TAB_PAGE_SIZE+1}&ndash;{Math.min((safePage+1)*HISTORY_TAB_PAGE_SIZE,filteredEntries.length)} {t("ofPagination")} {filteredEntries.length}
                      </span>
                      <div style={{display:"flex",gap:6}}>
                        <button className="btn btn-outline btn-sm" disabled={safePage===0} onClick={()=>setHistoryPage(p=>p-1)} style={{opacity:safePage===0?0.4:1,fontSize:10,padding:"3px 10px"}}>{t("prevPage")}</button>
                        <button className="btn btn-outline btn-sm" disabled={safePage>=totalPages-1} onClick={()=>setHistoryPage(p=>p+1)} style={{opacity:safePage>=totalPages-1?0.4:1,fontSize:10,padding:"3px 10px"}}>{t("nextPage")}</button>
                      </div>
                    </div>
                  )}
                  </>
                )}
              </>
            );
          })()}
        </div>
      )}

      {tab==="globallog" && (
        <div className="dash-panel" style={{
          padding:0,position:"relative",overflow:"hidden",
          background:"linear-gradient(135deg,#161110 0%,#1c1410 60%,#161110 100%)",
          border:"1px solid rgba(200,146,42,0.2)",borderRadius:6,
        }}>
          <CornerBrackets size={13} thickness={1.5} inset={8} opacity={0.4}/>
          <div style={{padding:"18px 20px",borderBottom:"1px solid var(--border)"}}>
            <div style={{fontFamily:"'Spectral',serif",fontSize:18,fontWeight:700,color:"var(--gold-light)"}}>{t("globalPointsTitle")}</div>
            <div style={{fontSize:11,color:"var(--text-dim)",marginTop:3,fontFamily:"'Inter',sans-serif"}}>{t("globalPointsDesc")}</div>
          </div>
          {(()=>{
            // Show admin manual adds and all bonus entries
            const BONUS_TYPES = new Set(["Major Events Bonus","ISB Veteran Bonus","Sindri Veteran Bonus","Iron Streak Bonus","Bonus Points","Elder Request","Weekly Decay"]);
            // Weekly decay's clan-wide summary lives in app_state
            // (decayAnnouncements), not in any one member's tx_log — see
            // the decayAnnouncements state comment. Older entries from
            // before that fix still live in whichever member's tx_log
            // happened to get picked that week; the "Weekly Decay" branch
            // below still relabels those as "All Members" for display,
            // but going forward new ones only come from decayAnnouncements.
            const decayEntries = (decayAnnouncements||[]).map(entry=>({
              date:entry.date,ts:entry.ts,member:t("allMembersLabel"),type:"Weekly Decay",
              amount:-entry.totalDecayed,addedBy:"System",
              reason:`${entry.ratePct}% weekly coin decay applied to all ${entry.memberCount} members`,cls:undefined,
            }));
            const allEntries = members.flatMap(m=>
              (m.txLog||[])
                .filter(entry=>entry.logType==="Admin Manual Add" || BONUS_TYPES.has(entry.logType) || (!entry.logType && entry.addedBy && entry.addedBy!=="System"))
                .map(entry=>({date:entry.date,ts:entry.ts,member:entry.logType==="Weekly Decay"?t("allMembersLabel"):m.name,type:entry.logType||"Admin Manual Add",amount:entry.change,addedBy:entry.addedBy||"—",reason:entry.reason||"—",cls:m.cls}))
            ).concat(decayEntries).sort((a,b)=>logSortKey(b)-logSortKey(a));
            if (allEntries.length===0) return (
              <div style={{textAlign:"center",color:"var(--text-dim)",padding:32}}>{t("noGlobalAdjustments")}</div>
            );
            const totalPages = Math.max(1, Math.ceil(allEntries.length / HISTORY_TAB_PAGE_SIZE));
            const safePage = Math.min(globalLogPage, totalPages-1);
            const pagedEntries = allEntries.slice(safePage*HISTORY_TAB_PAGE_SIZE, (safePage+1)*HISTORY_TAB_PAGE_SIZE);
            return (
              <>
              <div className="table-wrap attendance-table-view">
                <table className="table-stack">
                  <thead><tr><th>{t("colDateTime")}</th><th>{t("colMember")}</th><th>{t("colType")}</th><th>{t("colAmount")}</th><th>{t("colAddedBy")}</th><th>{t("colReason")}</th></tr></thead>
                  <tbody>
                    {pagedEntries.map((entry,i)=>(
                      <tr key={i}>
                        <td data-label="Date & Time" style={{fontWeight:500,whiteSpace:"nowrap"}}>{formatLogDateTime(entry)}</td>
                        <td data-label="Member" style={{fontFamily:"'Inter',sans-serif",fontWeight:700,color:"var(--text-bright)"}}>{entry.member}</td>
                        <td data-label="Type"><span className={`badge ${entry.amount>0?"badge-gold":"badge-red"}`}>{typeLabel(entry.type,t)}</span></td>
                        <td data-label="Amount" style={{fontFamily:"'Inter',sans-serif",fontWeight:800,color:entry.amount>=0?"var(--gold-light)":"#e07070"}}>{entry.amount>=0?`+${entry.amount}`:entry.amount}</td>
                        <td data-label="Added By" style={{fontFamily:"'Inter',sans-serif",fontWeight:600,color:"var(--gold)",fontSize:12}}>{entry.addedBy}</td>
                        <td data-label="Reason" style={{fontSize:11,color:"var(--text-dim)"}}>{entry.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="attendance-card-view" style={{padding:"4px 16px 16px"}}>
                {pagedEntries.map((entry,i)=>(
                  <div key={`card-${i}`} className="dash-subcard" style={{marginBottom:8,padding:"12px 14px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8,marginBottom:6}}>
                      <span style={{fontFamily:"'Inter',sans-serif",fontWeight:800,fontSize:13,color:"var(--text-bright)"}}>{entry.member}</span>
                      <span style={{fontSize:10,color:"var(--text-dim)",whiteSpace:"nowrap"}}>{formatLogDateTime(entry)}</span>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:6}}>
                      <span className={`badge ${entry.amount>0?"badge-gold":"badge-red"}`}>{typeLabel(entry.type,t)}</span>
                      <span style={{fontFamily:"'Inter',sans-serif",fontWeight:800,fontSize:13,color:entry.amount>=0?"var(--gold-light)":"#e07070"}}>{entry.amount>=0?`+${entry.amount}`:entry.amount}</span>
                    </div>
                    <div style={{fontSize:11,color:"var(--text-dim)",display:"flex",justifyContent:"space-between",gap:8}}>
                      <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{entry.reason}</span>
                      <span style={{color:"var(--gold)",fontWeight:600,flexShrink:0}}>{entry.addedBy}</span>
                    </div>
                  </div>
                ))}
              </div>
              {totalPages>1 && (
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 20px",gap:8,borderTop:"1px solid var(--border)"}}>
                  <span style={{fontSize:10,color:"var(--text-dim)",fontFamily:"'Inter',sans-serif"}}>
                    {safePage*HISTORY_TAB_PAGE_SIZE+1}&ndash;{Math.min((safePage+1)*HISTORY_TAB_PAGE_SIZE,allEntries.length)} {t("ofPagination")} {allEntries.length}
                  </span>
                  <div style={{display:"flex",gap:6}}>
                    <button className="btn btn-outline btn-sm" disabled={safePage===0} onClick={()=>setGlobalLogPage(p=>p-1)} style={{opacity:safePage===0?0.4:1,fontSize:10,padding:"3px 10px"}}>{t("prevPage")}</button>
                    <button className="btn btn-outline btn-sm" disabled={safePage>=totalPages-1} onClick={()=>setGlobalLogPage(p=>p+1)} style={{opacity:safePage>=totalPages-1?0.4:1,fontSize:10,padding:"3px 10px"}}>{t("nextPage")}</button>
                  </div>
                </div>
              )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ─── BID MARQUEE ──────────────────────────────────────────────────────────────
function BidMarquee({ feed, auctions }) {
  const trackRef = useRef(null);
  const posRef   = useRef(null); // current translateX in px (negative = scrolled left)
  const rafRef   = useRef(null);
  const SPEED    = 0.7; // px per frame — increase for faster scroll

  // Build the display list from DB feed or fallback to local auction bids
  const items = useMemo(() => {
    if (feed && feed.length > 0) return feed;
    const local = [];
    (auctions || []).forEach(a => {
      (a.bids || []).forEach(b => local.push({ bidder: b.bidder, auction_name: a.name, amount: b.amount, ts: b.time || 0 }));
    });
    return local.sort((a, b) => b.ts - a.ts).slice(0, 5);
  }, [feed, auctions]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || items.length === 0) return;

    // On first mount initialise position; on re-renders (new bid) keep it
    if (posRef.current === null) posRef.current = 0;

    function tick() {
      if (!trackRef.current) return;
      posRef.current -= SPEED;
      // The track contains the list duplicated twice; half-width = one full copy
      const halfW = trackRef.current.scrollWidth / 2;
      if (halfW > 0 && Math.abs(posRef.current) >= halfW) {
        posRef.current += halfW; // seamless jump back without visual reset
      }
      trackRef.current.style.transform = `translateX(${posRef.current}px)`;
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [items]); // restart RAF when items change, but posRef keeps the position

  if (items.length === 0) return null;

  return (
    <div style={{
      overflow:"hidden", whiteSpace:"nowrap", background:"rgba(0,0,0,0.35)",
      border:"1px solid rgba(255,185,40,0.25)", borderRadius:8, margin:"10px 0 4px",
      padding:"7px 0",
    }}>
      <div ref={trackRef} style={{ display:"inline-block", willChange:"transform" }}>
        {[...items, ...items].map((b, i) => (
          <span key={i} style={{
            marginRight:60, fontSize:13, fontFamily:"'Inter',sans-serif",
            color:"var(--gold)", letterSpacing:0.5,
          }}>
            🔨 <strong style={{color:"#fff"}}>{b.bidder}</strong> bid{" "}
            <strong style={{color:"var(--gold)"}}>{fmt(b.amount)}</strong> coins on{" "}
            <strong style={{color:"#c8e6ff"}}>{b.auction_name}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── AUCTIONS ─────────────────────────────────────────────────────────────────
// ─── CREATE AUCTION (Admin-only page) ──────────────────────────────────────
// Extracted from Auctions' old "create" tab (previously hidden behind
// isAdmin inside the member-facing Auctions page). Reachable only via the
// Admin Tools sidebar section now. Uses the module-level auctionImageUrl/
// postAuctionToNews helpers below (shared with Auctions' Live tab) instead
// of duplicating the Discord/news-posting logic.
function CreateAuctionPanel({ ctx }) {
  const { t } = useLang();
  const { setAuctions, addToast, imageLibrary, addImage } = ctx;
  const [newAuction, setNewAuction] = useState({name:"",image:null,rarity:"epic",desc:"",startBid:100,endsAtInput:timestampToGmt8String(Date.now()+30*60000),postToNews:false,featureAtTop:false});

  const RARITY_OPTS=[
    {value:"epic",label:t("rarityEpic"),color:"#ff8080",bg:"rgba(122,26,26,0.25)",border:"rgba(192,57,43,0.55)"},
    {value:"rare",label:t("rarityRare"),color:"#60aadd",bg:"rgba(26,90,138,0.2)",border:"rgba(46,134,193,0.5)"},
    {value:"kari",label:t("rarityKari"),color:"#a0d8ff",bg:"rgba(0,80,160,0.35)",border:"rgba(100,200,255,0.6)"},
    {value:"uncommon",label:t("rarityUncommon"),color:"#7ddc7d",bg:"rgba(46,138,46,0.2)",border:"rgba(80,180,80,0.55)"},
    {value:"material",label:t("rarityMaterial"),color:"#b8b8b8",bg:"rgba(120,120,120,0.25)",border:"rgba(160,160,160,0.55)"},
  ];

  function createAuction() {
    if(!newAuction.name){addToast(t("itemNameRequired"),"red",t("errorLabel"));return;}
    const now = Date.now();
    const minBid = parseInt(newAuction.startBid)||100;
    const endsAt = gmt8StringToTimestamp(newAuction.endsAtInput);
    if (!endsAt) {
      addToast("Please pick a valid end date and time.","red",t("errorLabel"));
      return;
    }
    if (endsAt <= now) {
      addToast("The end time must be in the future.","red",t("errorLabel"));
      return;
    }
    const a={
      id: String(now),
      name: newAuction.name,
      image: newAuction.image,
      emoji: "",
      rarity: newAuction.rarity,
      desc: newAuction.desc || "",
      description: newAuction.desc || "",
      startBid: minBid,
      minBid: minBid,
      currentBid: minBid,
      topBidder: null,
      startedAt: now,
      endsAt: endsAt,
      status: "active",
      bids: [],
    };
    setAuctions(prev=>[...prev,a]);
    addToast(`${t("auctionStarted")} ${a.name}`,"gold",t("auctionLive"));
    if (newAuction.postToNews) postAuctionToNews(a, ctx);
    if (newAuction.featureAtTop) setFeaturedAuction(a.id, ctx);
    {
      const imgUrl = auctionImageUrl(a);
      notifyDiscord({ embeds: [{
        title: `🔨 New auction: ${a.name}`,
        description: `Starting bid: ${fmt(minBid)} coins · Ends ${timeLeft(endsAt)}`,
        color: 0xc8922a,
        url: `${window.location.origin}/?page=auctions`,
        ...(imgUrl ? { thumbnail: { url: imgUrl } } : {}),
      }] }, "auctions");
    }
    setNewAuction({name:"",image:null,rarity:"epic",desc:"",startBid:100,endsAtInput:timestampToGmt8String(Date.now()+30*60000),postToNews:false,featureAtTop:false});
  }

  return (
    <div className="card" style={{maxWidth:560}}>
      <SectionTitle>{t("createNewAuction")}</SectionTitle>
      <div className="form-group">
        <label className="form-label">{t("itemNameFieldLabel")}</label>
        <input className="input" placeholder={t("itemNamePlaceholder2")} value={newAuction.name} onChange={e=>setNewAuction(p=>({...p,name:e.target.value}))} />
      </div>
      <div className="form-group">
        <label className="form-label">{t("rarityLabel")}</label>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(80px,1fr))",gap:8}}>
          {RARITY_OPTS.map(r=>(
            <div key={r.value} onClick={()=>setNewAuction(p=>({...p,rarity:r.value}))}
              style={{padding:"10px 8px",borderRadius:2,cursor:"pointer",textAlign:"center",
                background:newAuction.rarity===r.value?r.bg:"rgba(10,11,15,0.6)",
                border:`1px solid ${newAuction.rarity===r.value?r.border:"var(--border)"}`,
                color:newAuction.rarity===r.value?r.color:"var(--text-dim)",
                fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:13,
                transition:"all 0.2s"}}>
              {r.label}
            </div>
          ))}
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">{t("itemImageLabel")}</label>
        <ItemImagePicker value={newAuction.image} onChange={img=>setNewAuction(p=>({...p,image:img}))} library={imageLibrary} addImage={addImage} />
      </div>
      <div className="form-group">
        <label className="form-label">{t("descriptionLabel")}</label>
        <input className="input" placeholder={t("itemDescPlaceholder")} value={newAuction.desc} onChange={e=>setNewAuction(p=>({...p,desc:e.target.value}))} />
      </div>
      <div className="grid-2">
        <div className="form-group">
          <label className="form-label">{t("startingBidLabel")}</label>
          <input className="input" type="number" min={1} value={newAuction.startBid} onChange={e=>setNewAuction(p=>({...p,startBid:e.target.value}))} />
        </div>
        <div className="form-group">
          <label className="form-label">Ends At (GMT+8)</label>
          <input
            className="input" type="datetime-local"
            value={newAuction.endsAtInput}
            min={timestampToGmt8String(Date.now())}
            onChange={e=>setNewAuction(p=>({...p,endsAtInput:e.target.value}))}
          />
        </div>
      </div>
      {/* Preview */}
      <div style={{marginBottom:20,padding:14,background:"rgba(10,11,15,0.7)",border:"1px solid var(--border)",borderRadius:2}}>
        <div style={{fontSize:9,color:"var(--text-dim)",fontWeight:700,letterSpacing:2,marginBottom:10,textTransform:"uppercase"}}>{t("previewLabel")}</div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:52,height:52,borderRadius:2,overflow:"hidden",background:newAuction.rarity==="epic"?"rgba(122,26,26,0.3)":"rgba(26,90,138,0.3)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:"1px solid var(--border)"}}>
            {newAuction.image?<img src={newAuction.image.dataUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} />:<StatIcon src={AUCTION_ICON} size={30}/>}
          </div>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
              <span style={{fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:14,color:"var(--text-bright)"}}>{newAuction.name||t("itemNameDefault")}</span>
              <span className={`badge badge-${newAuction.rarity}`}>{rarityLabel(newAuction.rarity,t).toLowerCase()}</span>
            </div>
            <div style={{fontSize:12,color:"var(--text-dim)"}}>{newAuction.desc||t("descriptionDefault")}</div>
            <div style={{fontSize:11,color:"var(--gold)",marginTop:4,fontWeight:600}}>
              {newAuction.endsAtInput
                ? `Ends ${new Date(gmt8StringToTimestamp(newAuction.endsAtInput)).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:"Asia/Manila"})} (GMT+8)`
                : "Pick an end date and time"}
            </div>
          </div>
        </div>
      </div>
      <label style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,fontSize:13,color:"var(--text)",cursor:"pointer"}}>
        <input type="checkbox" checked={newAuction.postToNews||false} onChange={e=>setNewAuction(p=>({...p,postToNews:e.target.checked}))} />
        <BellIcon size={14} style={{color:"var(--gold)"}}/>
        {t("postToNewsLabel")}
      </label>
      <label style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,fontSize:13,color:"var(--text)",cursor:"pointer"}}>
        <input type="checkbox" checked={newAuction.featureAtTop||false} onChange={e=>setNewAuction(p=>({...p,featureAtTop:e.target.checked}))} />
        Feature this at the top of the Auction House (replaces any currently featured item)
      </label>
      <button className="btn btn-gold" onClick={createAuction} style={{width:"100%",justifyContent:"center"}}><span style={{display:"inline-flex",alignItems:"center",gap:6}}><StatIcon src={AUCTION_ICON} size={28}/>{t("startAuction")}</span></button>
    </div>
  );
}

// Pure helper — hoisted to module scope (no component state involved) so
// both Auctions (Live tab's "Put in News"/broadcast buttons) and
// CreateAuctionPanel can build a Discord embed without duplicating the logic.
function auctionImageUrl(auction) {
  // Falls back to _auctionImageCache: since the initial bulk load no longer
  // eagerly fetches image_data (see loadAll), auction.image.dataUrl from
  // shared ctx.auctions state is null until AuctionImage renders that item
  // and lazily populates the cache — which, in practice, has already
  // happened by the time a user can click "Put in News" on a visible card.
  const dataUrl = auction?.image?.dataUrl || (auction?.id ? _auctionImageCache.get(String(auction.id)) : null);
  if (dataUrl && dataUrl.startsWith("http")) return dataUrl;
  return null;
}
function auctionToEmbed(a) {
  const imgUrl = auctionImageUrl(a);
  const bidder = a.topBidder || "No bids yet";
  return {
    title: a.name,
    description: `${fmt(a.currentBid)} coins · ${bidder} · ${timeLeft(a.endsAt)} left`,
    color: 0xc8922a,
    url: `${window.location.origin}/?page=auctions`,
    ...(imgUrl ? { thumbnail: { url: imgUrl } } : {}),
  };
}
// Posts an auction item into a single shared "auctions" announcement
// (app_state key "login_announcements") — every "Put in News" click adds
// to the SAME card's item list rather than creating a separate
// announcement each time, so multiple highlighted items show together
// in one rich preview (image, current bid, time left) instead of
// several plain-text lines. Coexists independently with any
// manually-written text announcement from Settings. Hoisted to module
// scope (taking ctx explicitly) so both Auctions and CreateAuctionPanel
// share one implementation instead of duplicating the news-merging logic.
async function postAuctionToNews(auction, ctx) {
  const { loginAnnouncements, setLoginAnnouncements, addToast } = ctx;
  const snapshot = { auctionId: auction.id, name: auction.name, image: auction.image, rarity: auction.rarity, currentBid: auction.currentBid, topBidder: auction.topBidder, endsAt: auction.endsAt };
  const list = loginAnnouncements || [];
  const existingIdx = list.findIndex(a => a.type === "auctions");
  let next;
  if (existingIdx >= 0) {
    // Already an auction-news card — replace this item if it's already
    // in there (re-clicking "Put in News" refreshes the bid/time shown
    // instead of creating a duplicate row), otherwise append it.
    const existing = list[existingIdx];
    // Drop anything that's already ended while we're here, so this list
    // doesn't grow forever from posts nobody ever manually removed - the
    // one being posted right now is exempt even if its own endsAt is
    // somehow already past, since posting it is an explicit request to
    // show it.
    const live = existing.items.filter(i => i.auctionId === auction.id || (i.endsAt||0) > Date.now());
    const itemIdx = live.findIndex(i => i.auctionId === auction.id);
    const items = itemIdx >= 0
      ? live.map((it,i) => i===itemIdx ? snapshot : it)
      : [...live, snapshot];
    next = list.map((a,i) => i===existingIdx ? {...a, items, postedAt: Date.now()} : a);
  } else {
    next = [...list, { id: Date.now(), type: "auctions", items: [snapshot], postedAt: Date.now() }];
  }
  const ok = await dbUpsertReliable("app_state", { key: "login_announcements", value: JSON.stringify(next), updated_at: Date.now() });
  if (ok) {
    setLoginAnnouncements(next);
    addToast(`Posted "${auction.name}" to the login news — everyone will see it next time they open the app.`, "gold", "Posted to News");
    {
      const imgUrl = auctionImageUrl(auction);
      notifyDiscord({ embeds: [{
        title: `📌 Featured: ${auction.name}`,
        description: `${fmt(auction.currentBid)} coins · ${auction.topBidder || "No bids yet"}`,
        color: 0xc8922a,
        url: `${window.location.origin}/?page=auctions`,
        ...(imgUrl ? { thumbnail: { url: imgUrl } } : {}),
      }] }, "auctions");
    }
  } else {
    addToast(
      <span style={{display:"inline-flex",alignItems:"center",gap:6}}><WarningIcon size={13}/>Couldn't post — please try again.</span>,
      "red", "Post Failed"
    );
  }
}

// Sets (or clears, if auctionId is null) the ONE auction currently pulled
// out of the regular grid into its own spotlight banner. Unlike
// postAuctionToNews's list, this is a single value — setting a new
// featured auction always replaces whichever one was featured before,
// it never appends. Hoisted to module scope, same reasoning as
// postAuctionToNews (shared between Auctions and CreateAuctionPanel).
async function setFeaturedAuction(auctionId, ctx) {
  const { setFeaturedAuctionId, addToast } = ctx;
  const ok = await dbUpsertReliable("app_state", { key: "featured_auction_id", value: auctionId ? String(auctionId) : "", updated_at: Date.now() });
  if (ok) {
    setFeaturedAuctionId(auctionId || null);
    if (auctionId) addToast("Pulled out to the spotlight at the top of the Auction House.", "gold", "Featured");
    else addToast("No longer featured.", "gold", "Unfeatured");
  } else {
    addToast(
      <span style={{display:"inline-flex",alignItems:"center",gap:6}}><WarningIcon size={13}/>Couldn't update the featured item — please try again.</span>,
      "red", "Failed"
    );
  }
}

// ─── Live Auctions grid card — its own component (not inlined in a .map())
// specifically so it can hold real local hover state via useState. An
// earlier version tried to drive the image hover-reveal through
// framer-motion's string-variant propagation from a middle-layer element
// that had no variants object of its own — that left the reveal's opacity
// undefined/inconsistent, which showed up as the art rendering permanently
// blurred (backdrop-filter still sampling) on any card with bid history,
// even at rest. onHoverStart/onHoverEnd + a plain boolean + explicit
// animate={...} is the reliable version of the same interaction. ───
function AuctionGridCard({ a, isWinning, minBid, rc2, t, bidAmounts, setBidAmounts, bidSubmitting, placeBid, isAdmin, isMaster, isGuest, isAuctionInNews, removeAuctionFromNews, postAuctionToNews, ctx, removeAuction, isHoverCapable }) {
  const [imgHovered, setImgHovered] = useState(false);
  const recentBids = [...(a.bids||[])].reverse().slice(0,2);
  const hasRevealContent = !!a.desc || recentBids.length>0 || !!a.topBidder;
  return (
    <motion.div className={`auction-card rarity-${a.rarity||"epic"}`}
      initial={{scale:1,y:0}} whileHover={{scale:1.035,y:-4}}
      transition={{type:"spring",stiffness:300,damping:22}}>
      {/* Own hover trigger, scoped to the art only — the outer card's
          hover (above) covers the whole card including the bid input/
          button in the body, so a bidder's mouse sitting on "Bid" would
          otherwise also trigger this reveal over the image it has
          nothing to do with. */}
      <motion.div className={`auction-img rarity-${a.rarity||"epic"}`} style={a.rarity==="kari"?{backgroundImage:`url(${KARI_BG})`}:{}}
        onHoverStart={()=>setImgHovered(true)} onHoverEnd={()=>setImgHovered(false)}>
        {a.image?<AuctionImage auction={a} alt={a.name} style={{width:"80%",height:"80%",objectFit:"contain",position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",filter:"drop-shadow(0 4px 16px rgba(0,0,0,0.7))"}} fallback={<StatIcon src={AUCTION_ICON} size={56}/>}/>:<StatIcon src={AUCTION_ICON} size={56}/>}
        <div className="auction-timer pulse">{timeLeft(a.endsAt)}</div>
        {(()=>{const r=rc2;return(<div style={{position:"absolute",top:8,left:8,zIndex:10,background:r.bg,fontFamily:"'Inter',sans-serif",fontSize:10,fontWeight:700,padding:"3px 8px",border:`1px solid ${r.border}`,letterSpacing:1,color:r.color}}>{rarityLabel(a.rarity||"epic",t)}</div>);})()}
        {isWinning&&<div style={{position:"absolute",bottom:8,right:8,background:"rgba(39,174,96,0.85)",color:"#fff",fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:9,padding:"3px 8px",letterSpacing:1.5,textTransform:"uppercase"}}>{t("winningBadge")}</div>}
        {/* ── Hover-reveal: description + recent bids, over the art.
            Desktop-pointer-only — see isHoverCapable. On touch, this
            content stays in the always-visible body below instead (no
            hover event to trigger it there). ── */}
        {isHoverCapable && hasRevealContent && (
          <>
            <motion.div animate={{opacity: imgHovered?1:0}} transition={{duration:0.32}}
              style={{position:"absolute",inset:0,zIndex:2,
                background:"linear-gradient(180deg, rgba(8,6,5,0) 0%, rgba(8,6,5,0.55) 55%, rgba(8,6,5,0.94) 100%)",
                backdropFilter:"blur(3px)", WebkitBackdropFilter:"blur(3px)"}} />
            <motion.div animate={imgHovered?{opacity:1,y:0}:{opacity:0,y:14}} transition={{type:"spring",stiffness:300,damping:24}}
              style={{position:"absolute",left:0,right:0,bottom:0,zIndex:3,padding:"12px 14px 11px"}}>
              {a.desc && <div style={{fontSize:11.5,color:"#d8c6a8",lineHeight:1.55,marginBottom:8,fontFamily:"'Inter',sans-serif"}}>{a.desc}</div>}
              {(recentBids.length>0 || a.topBidder) && (
                <div style={{borderTop:"1px solid rgba(200,146,42,0.18)",paddingTop:7}}>
                  {recentBids.length>0
                    ? recentBids.map((b,i)=>(
                        <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:10.5,color:"#b8a082",fontFamily:"'Inter',sans-serif",padding:"1.5px 0"}}>
                          <span>{b.bidder}</span><span style={{color:"var(--gold-light)",fontWeight:700}}>{fmt(b.amount)}</span>
                        </div>
                      ))
                    : a.topBidder && (
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:10.5,color:"#b8a082",fontFamily:"'Inter',sans-serif",padding:"1.5px 0"}}>
                          <span>{a.topBidder}</span><span style={{color:"var(--gold-light)",fontWeight:700}}>{fmt(a.currentBid)}</span>
                        </div>
                      )
                  }
                </div>
              )}
            </motion.div>
          </>
        )}
      </motion.div>
      <div className="auction-body">
        <div className="auction-name">{a.name}</div>
        {!isHoverCapable && <div className="auction-desc">{a.desc}</div>}
        <div className="auction-bid-row">
          <div style={{textAlign:"left"}}>
            <div className="bid-label">{t("currentBidLabel")}</div>
            <div className="current-bid"><span style={{display:"inline-flex",alignItems:"center",gap:4}}><StatIcon src={COINS_ICON} size={28}/>{fmt(a.currentBid)}</span></div>
            {a.topBidder ? (
              <div style={{display:"inline-flex",alignItems:"center",gap:5,marginTop:5,background:"rgba(39,174,96,0.15)",border:"1px solid rgba(39,174,96,0.45)",padding:"3px 8px",borderRadius:2}}>
                <TrophyIcon size={12} style={{color:"rgba(39,174,96,0.85)"}}/>
                <span style={{fontSize:12,color:"#6ee89a",fontWeight:800,fontFamily:"'Inter',sans-serif",letterSpacing:0.5}}>{a.topBidder}</span>
              </div>
            ) : (
              <div style={{marginTop:5,fontSize:11,color:"var(--text-dim)",fontStyle:"italic",fontFamily:"'Inter',sans-serif"}}>{t("noBidsYet")}</div>
            )}
          </div>
          <div style={{textAlign:"right"}}>
            <div className="bid-label">{t("bidsLabel")}</div>
            <div style={{fontFamily:"'Spectral',serif",fontWeight:800,fontSize:20,color:"#a8b8c8"}}>{(a.bids||[]).length || (a.topBidder ? 1 : 0)}</div>
          </div>
        </div>
        {isGuest ? (
          <div style={{marginTop:12,fontSize:11,color:"var(--text-dim)",fontStyle:"italic",textAlign:"center"}}>{t("logInToBid")}</div>
        ) : (
        <div style={{marginTop:12,display:"flex",gap:8}}>
          <input className="input" type="number" min={minBid} placeholder={`${t("minBidPlaceholder")} ${fmt(minBid)}`} value={bidAmounts[a.id]||""} onChange={e=>setBidAmounts(p=>({...p,[a.id]:e.target.value}))} style={{flex:1}} />
          <button className="btn btn-gold" onClick={(e)=>placeBid(a.id,e)} disabled={!!bidSubmitting[a.id]}>{bidSubmitting[a.id]?"…":t("bidButton")}</button>
        </div>
        )}

        {isAdmin&&<button className="btn btn-outline btn-sm" style={{width:"100%",marginTop:6}} onClick={()=>setFeaturedAuction(a.id, ctx)}>Feature at top</button>}
        {isAdmin&&<button className={isAuctionInNews(a.id)?"btn btn-gold btn-sm":"btn btn-outline btn-sm"} style={{width:"100%",marginTop:6,display:"flex",alignItems:"center",justifyContent:"center",gap:6}} onClick={()=>isAuctionInNews(a.id)?removeAuctionFromNews(a.id):postAuctionToNews(a, ctx)}><BellIcon size={13}/>{isAuctionInNews(a.id)?t("removeFromNewsBtn"):t("putInNewsBtn")}</button>}
        {isMaster&&<button className="btn btn-red btn-sm" style={{width:"100%",marginTop:6}} onClick={()=>removeAuction(a.id)}>{t("removeAuctionBtn")}</button>}
        {!isHoverCapable && ((a.bids||[]).length>0 || a.topBidder)&&(
          <div style={{marginTop:10,fontSize:11,color:"var(--text-dim)",borderTop:"1px solid var(--border-dim)",paddingTop:8}}>
            {recentBids.length>0
              ? recentBids.map((b,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",fontFamily:"'Inter',sans-serif"}}>
                    <span>{b.bidder}</span><span style={{color:"var(--gold)",fontWeight:700}}>{fmt(b.amount)}</span>
                  </div>
                ))
              : a.topBidder && (
                  <div style={{display:"flex",justifyContent:"space-between",fontFamily:"'Inter',sans-serif"}}>
                    <span>{a.topBidder}</span><span style={{color:"var(--gold)",fontWeight:700}}>{fmt(a.currentBid)}</span>
                  </div>
                )
            }
          </div>
        )}
      </div>
    </motion.div>
  );
}

// The one auction pulled out of the regular grid into its own spotlight
// banner at the top of the Active tab — cinematic full-bleed art with a
// warm spotlight glow behind the item and a heavy vignette (the "B4"
// treatment), rather than another grid card. Still fully biddable from
// here; it just isn't shown a second time in the grid below.
function FeaturedAuctionSpotlight({ a, isWinning, minBid, t, bidAmounts, setBidAmounts, bidSubmitting, placeBid, isAdmin, isGuest, ctx }) {
  // Same rarity color map AuctionGridCard uses — the spotlight was
  // shipping with a fixed gold border and no rarity badge at all,
  // dropping the one visual signal (rarity color) that's meaningful and
  // consistent across every other auction card on the page.
  const rc={epic:{bg:"rgba(122,26,26,0.92)",color:"#ff8080",border:"rgba(192,57,43,0.5)"},rare:{bg:"rgba(26,90,138,0.92)",color:"#60aadd",border:"rgba(46,134,193,0.5)"},kari:{bg:"rgba(0,60,130,0.92)",color:"#a0d8ff",border:"rgba(100,200,255,0.6)"},material:{bg:"rgba(120,120,120,0.92)",color:"#cccccc",border:"rgba(160,160,160,0.5)"},uncommon:{bg:"rgba(46,138,46,0.92)",color:"#7ddc7d",border:"rgba(80,180,80,0.5)"}};
  const rc2=rc[a.rarity]||rc.epic;
  // Same radial vignette every .auction-img.rarity-X already uses in the
  // grid (bright/saturated near the item, fading through a darker mid
  // tone to near-black at the edges) — re-centered toward the right
  // where the item art sits here, instead of dead-center like a square
  // grid card. Replaces an earlier linear left-to-right wash + a bolted-
  // on separate inset-shadow "vignette", which was really just an
  // approximation of this exact effect the grid already has.
  const VIGNETTE_MAP={
    epic:"radial-gradient(ellipse at 74% 50%,rgba(180,30,30,0.55) 0%,rgba(90,10,10,0.85) 50%,#0d0a0a 100%)",
    rare:"radial-gradient(ellipse at 74% 50%,rgba(30,100,180,0.55) 0%,rgba(10,40,90,0.85) 50%,#090d12 100%)",
    material:"radial-gradient(ellipse at 74% 50%,rgba(140,140,140,0.5) 0%,rgba(60,60,60,0.85) 50%,#0d0d0d 100%)",
    uncommon:"radial-gradient(ellipse at 74% 50%,rgba(60,180,60,0.5) 0%,rgba(20,70,20,0.85) 50%,#0a0d0a 100%)",
    kari:"radial-gradient(ellipse at 74% 50%,rgba(0,80,170,0.55) 0%,rgba(0,40,90,0.85) 50%,#090d12 100%)",
  };
  const vignette=VIGNETTE_MAP[a.rarity]||VIGNETTE_MAP.epic;
  return (
    <div style={{
      position:"relative", overflow:"hidden", borderRadius:10, minHeight:230,
      border:`1px solid ${rc2.border}`,
      // Solid opaque base BEHIND the vignette — the grid cards' own
      // .auction-card has this same var(--bg-card) sitting under their
      // vignette for exactly this reason. The vignette's bright/mid
      // stops are semi-transparent by design (matching the grid's own
      // rgba values), so without an opaque layer under it, whatever's
      // actually behind this element (the page body's own background
      // image) shows straight through instead of a solid dark card.
      background:"var(--bg-card)",
      boxShadow:"0 0 50px rgba(201,151,42,0.08), 0 20px 50px rgba(0,0,0,0.5)",
      marginBottom:20, display:"flex", alignItems:"flex-end",
    }}>
      <div style={{position:"absolute", inset:0, background:vignette}} />
      {/* Item art floats free with no container — just a soft rarity-
          tinted glow behind it and a drop-shadow on the image itself
          (not a box-shadow, since there's no box) so it doesn't read as
          pasted flat onto the gradient. Falls back to the same glow
          alone (no image) if this auction has no photo. */}
      <div style={{
        position:"absolute", right:70, top:"50%", transform:"translateY(-50%)",
        width:220, height:220, borderRadius:"50%",
        background:`radial-gradient(circle, ${rc2.border} 0%, transparent 72%)`,
        filter:"blur(2px)", zIndex:1, pointerEvents:"none",
      }} />
      {a.image && (
        <AuctionImage auction={a} alt={a.name} style={{
          position:"absolute", right:60, top:"50%", transform:"translateY(-50%)",
          width:180, height:180, objectFit:"contain", zIndex:2,
          filter:`drop-shadow(0 12px 20px rgba(0,0,0,0.55)) drop-shadow(0 0 20px ${rc2.border})`,
        }} fallback={null}/>
      )}
      <div style={{position:"absolute", top:8, left:8, zIndex:3, background:rc2.bg, fontFamily:"'Inter',sans-serif", fontSize:10, fontWeight:700, padding:"3px 8px", border:`1px solid ${rc2.border}`, letterSpacing:1, color:rc2.color}}>{rarityLabel(a.rarity||"epic",t)}</div>
      <div style={{
        position:"absolute", top:36, left:0, zIndex:3,
        background:"linear-gradient(135deg, var(--gold-light), var(--gold))", color:"#241a08",
        fontSize:10, fontWeight:800, letterSpacing:2, textTransform:"uppercase",
        padding:"6px 16px 6px 12px", borderRadius:"0 4px 4px 0",
        boxShadow:"2px 2px 8px rgba(0,0,0,0.4)",
      }}>Featured</div>
      {isAdmin && (
        <button
          className="btn btn-ghost btn-sm"
          style={{position:"absolute", top:14, right:14, zIndex:3, fontSize:10}}
          onClick={()=>setFeaturedAuction(null, ctx)}
        >Unfeature</button>
      )}
      {/* padding-top:66 (not 26) — clears BOTH the rarity badge and the
          Featured ribbon stacked above it; at 26 the ribbon's own height
          overlapped this block's first line (the eyebrow text), a real
          bug caught in an early screenshot, not just a mockup artifact.
          Capped max-width clears the item art + its glow on the right so
          nothing in this column, including the bid input, can reach
          into that space. */}
      <div style={{position:"relative", zIndex:2, padding:"66px 32px 26px", width:"100%", maxWidth:"calc(100% - 260px)"}}>
        <div style={{fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"var(--gold-light)", fontWeight:700, marginBottom:8, textShadow:"0 1px 6px rgba(0,0,0,0.9)"}}>{CLAN_SEASON_LABEL} &middot; Featured Item</div>
        <div style={{fontFamily:"'Spectral',serif", fontSize:26, fontWeight:800, color:"var(--text-bright)", marginBottom:8, textShadow:"0 0 30px rgba(242,204,96,0.3), 0 2px 12px rgba(0,0,0,0.9)"}}>{a.name}</div>
        {a.desc && <div style={{fontSize:12.5, color:"var(--text-mid)", lineHeight:1.6, marginBottom:16, maxWidth:"52ch", textShadow:"0 1px 6px rgba(0,0,0,0.6)"}}>{a.desc}</div>}
        <div style={{display:"flex", alignItems:"center", gap:20, flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:9, letterSpacing:1.5, textTransform:"uppercase", color:"var(--text-mid)", marginBottom:3, textShadow:"0 1px 5px rgba(0,0,0,0.95), 0 1px 2px rgba(0,0,0,1)"}}>Current Bid</div>
            <div style={{fontFamily:"'Spectral',serif", fontSize:19, fontWeight:800, color:"var(--gold-light)", textShadow:"0 1px 6px rgba(0,0,0,0.9)"}}>{fmt(a.currentBid)} Coins</div>
            {/* Grid cards show who's currently winning right under the bid
                (green trophy pill) — the spotlight had no such indicator
                at all. Same style, reused here. */}
            {a.topBidder && (
              <div style={{display:"inline-flex", alignItems:"center", gap:5, marginTop:5, background:"rgba(39,174,96,0.15)", border:"1px solid rgba(39,174,96,0.45)", padding:"3px 8px", borderRadius:2}}>
                <TrophyIcon size={12} style={{color:"rgba(39,174,96,0.85)"}}/>
                <span style={{fontSize:12, color:"#6ee89a", fontWeight:800, fontFamily:"'Inter',sans-serif", letterSpacing:0.5}}>{a.topBidder}</span>
              </div>
            )}
          </div>
          <div>
            <div style={{fontSize:9, letterSpacing:1.5, textTransform:"uppercase", color:"var(--text-mid)", marginBottom:3, textShadow:"0 1px 5px rgba(0,0,0,0.95), 0 1px 2px rgba(0,0,0,1)"}}>Ends In</div>
            <div style={{fontFamily:"'Spectral',serif", fontSize:19, fontWeight:800, color:"#e08585", textShadow:"0 1px 6px rgba(0,0,0,0.9)"}}>{timeLeft(a.endsAt)}</div>
          </div>
          {isWinning ? (
            <div style={{fontSize:12, fontWeight:800, color:"#7ddc7d"}}>You're winning this!</div>
          ) : isGuest ? (
            <div style={{fontSize:12, color:"var(--text-mid)", fontStyle:"italic"}}>{t("logInToBid")}</div>
          ) : (
            <div style={{display:"flex", gap:8}}>
              <input
                type="number" className="input" placeholder={String(minBid)} style={{width:100}}
                value={bidAmounts[a.id]||""} onChange={e=>setBidAmounts(p=>({...p, [a.id]: e.target.value}))}
              />
              <button
                className="btn btn-gold" disabled={bidSubmitting[a.id]}
                style={{opacity:bidSubmitting[a.id]?0.6:1}}
                onClick={e=>placeBid(a.id, e)}
              >{bidSubmitting[a.id] ? "…" : t("bidButton")}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Auctions({ ctx }) {
  const { auctions, setAuctions, members, setMembers, setMembersRaw, currentUser, isGuest, addToast, fireCoinBurst, fireBalancePopup, tick, removeAuction, attendanceLogs, lootResults, setLootResults, latestLootId, setLatestLootId, bidFeed, loginAnnouncements, setLoginAnnouncements, featuredAuctionId, setFeaturedAuctionId } = ctx;
  const { t } = useLang();
  const [tab, setTab] = useState("active");
  const [bidAmounts, setBidAmounts] = useState({});
  const [bidSubmitting, setBidSubmitting] = useState({});
  const [sortBy, setSortBy] = useState("default");
  const [viewMode, setViewMode] = useState("grid");
  const [historyPage, setHistoryPage] = useState(0);
  const isAdmin = !!currentUser && (currentUser.role==="Elder"||currentUser.role==="Master");
  const isMaster = !!currentUser && currentUser.role==="Master";
  // Real mouse/trackpad hover only — excludes touchscreens. The auction
  // card's hover-reveal (description + recent bids sliding up over the
  // art on hover) is a desktop-only enhancement; touch devices have no
  // hover event at all, so they keep showing that info inline in the
  // card body instead, exactly as before this feature existed.
  // Deliberately checking (hover: hover) ALONE, not also "and (pointer:
  // fine)" — the combined query is stricter than this feature actually
  // needs and adds a second real-world condition that can silently make
  // the whole feature a no-op (falls back to the pre-existing layout,
  // indistinguishable from "nothing changed") on any device/browser
  // combination that doesn't satisfy both.
  const [isHoverCapable] = useState(() =>
    typeof window!=="undefined" && !!window.matchMedia?.("(hover: hover)")?.matches
  );


  const RARITY_ORDER = { kari: 0, epic: 1, rare: 2, uncommon: 3, material: 4 };

  function sortAuctions(list) {
    let sorted;
    if (sortBy === "bid-desc")        sorted = [...list].sort((a,b) => b.currentBid - a.currentBid);
    else if (sortBy === "bid-asc")    sorted = [...list].sort((a,b) => a.currentBid - b.currentBid);
    else if (sortBy === "rarity")     sorted = [...list].sort((a,b) => (RARITY_ORDER[a.rarity]??99) - (RARITY_ORDER[b.rarity]??99));
    else if (sortBy === "has-bidder") sorted = [...list].sort((a,b) => (b.topBidder?1:0) - (a.topBidder?1:0));
    else sorted = [...list];
    // Always float items the current user is winning to the very top
    return sorted.sort((a,b) => {
      const aWin = a.topBidder === currentUser?.name ? 1 : 0;
      const bWin = b.topBidder === currentUser?.name ? 1 : 0;
      return bWin - aWin;
    });
  }

  const active = sortAuctions(auctions.filter(a=>a.status==="active"));
  const ended  = [...auctions.filter(a=>a.status==="ended")].sort((a,b)=>(b.endsAt||0)-(a.endsAt||0));
  // ROOT CAUSE of the History tab locking up/lagging: this list used to
  // render with zero pagination, in BOTH the desktop table and the
  // duplicate mobile card list at once — and each row's AuctionImage
  // fires its own independent fetch the instant it mounts (see
  // AuctionImage's effect above), with no concurrency limit. With
  // hundreds of ended auctions sitting in the 14-day retention window
  // (see api/clear-auction-history.js), that's hundreds of DOM rows and
  // hundreds of simultaneous network requests firing at once. Paginating
  // caps both to whatever fits on one page.
  const HISTORY_PAGE_SIZE = 15;
  const historyTotalPages = Math.max(1, Math.ceil(ended.length / HISTORY_PAGE_SIZE));
  const safeHistoryPage = Math.min(historyPage, historyTotalPages - 1);
  const pagedEnded = ended.slice(safeHistoryPage*HISTORY_PAGE_SIZE, (safeHistoryPage+1)*HISTORY_PAGE_SIZE);
  // Pulled out of the grid entirely (not duplicated) once it's found here
  // — if the featured auction has since ended or been removed, this is
  // simply null and the grid renders exactly as it did before this
  // feature existed.
  const featuredAuction = featuredAuctionId ? active.find(a => String(a.id) === String(featuredAuctionId)) || null : null;
  const gridAuctions = featuredAuction ? active.filter(a => a.id !== featuredAuction.id) : active;

  async function placeBid(auctionId, clickEvent) {
    // Defense-in-depth: the bid input/button are already hidden for
    // guests in every place that renders them (AuctionGridCard,
    // FeaturedAuctionSpotlight, the compact view below), so this should
    // never actually be reachable without a real currentUser — but this
    // function reads currentUser.name unconditionally below, so bail
    // loudly rather than let a null currentUser crash mid-bid.
    if (!currentUser) return;
    // Grab the button's screen position synchronously — React's synthetic
    // event won't reliably survive across the awaits below, so capture
    // coordinates now, before any async work begins.
    let burstX = null, burstY = null;
    if (clickEvent && clickEvent.currentTarget) {
      const rect = clickEvent.currentTarget.getBoundingClientRect();
      burstX = rect.left + rect.width/2;
      burstY = rect.top + rect.height/2;
    }
    const a=auctions.find(x=>x.id===auctionId);
    const amount=parseInt(bidAmounts[auctionId]||0);
    const me=members.find(m=>m.name===currentUser.name);
    if(!a||a.status!=="active") return;
    // Cheap, local-only checks first — these don't need a DB round trip,
    // they're just immediate feedback against what THIS browser already
    // has cached. The REAL check (and the actual write) happens inside
    // placeBidAtomic below, which is what genuinely matters.
    if(amount<a.currentBid+5){addToast(`${t("minBidError")} ${fmt(a.currentBid+5)} ${t("minBidErrorSuffix")}`,"red",t("invalidBid"));return;}
    if(!me||me.coins<amount){addToast(t("insufficientCoins"),"red",t("noFunds"));return;}
    if(a.topBidder===currentUser.name){addToast(t("alreadyHighestBid"),"gold",t("alreadyWinning"));return;}

    // ROOT CAUSE FIX for "a lower bid sometimes beat a higher one": the
    // old flow re-checked the live DB value here, then did MORE work
    // (coin adjustments, etc.) before finally writing the new bid — a
    // real gap during which a second, slightly later bid could pass ITS
    // OWN check (against the still-old value) and then overwrite this
    // one's write, regardless of which amount was actually higher, since
    // the final write itself never re-verified anything against what was
    // truly there at write-time. placeBidAtomic runs the check AND the
    // write as one locked database transaction, so the result it returns
    // is the actual, final truth — not a snapshot that can go stale
    // between here and the write.
    setBidSubmitting(prev=>({...prev,[auctionId]:true}));
    const result = await placeBidAtomic(auctionId, currentUser.name, amount);
    setBidSubmitting(prev=>({...prev,[auctionId]:false}));

    if (!result?.success) {
      if (result?.reason === "ended") {
        addToast(t("auctionEnded"),"red",t("auctionEndedTitle"));
      } else if (result?.reason === "outbid") {
        addToast(`${t("outbidMessage")} (${fmt(result.current_bid)}). ${t("pleaseRetry")}`,"red",t("outbidTitle"));
      } else if (result?.reason === "not_found") {
        addToast(t("auctionEnded"),"red",t("auctionEndedTitle"));
      } else if (result?.reason === "insufficient_funds") {
        addToast(t("insufficientCoins"),"red",t("noFunds"));
      } else if (result?.reason === "bidder_not_found") {
        addToast(`${t("outbidMessage")}. ${t("pleaseRetry")}`,"red",t("outbidTitle"));
      } else {
        // network_error or anything unrecognized — don't claim success,
        // but also don't pretend we know exactly what happened.
        addToast(`${t("outbidMessage")}. ${t("pleaseRetry")}`,"red",t("outbidTitle"));
      }
      return;
    }

    // ROOT CAUSE of "I bid but wasn't deducted coins": place_bid_atomic
    // now deducts the bidder's coins and refunds whoever it just outbid
    // INSIDE its own locked transaction (see scripts/place_bid_atomic_v2.sql)
    // — before this fix, that was a separate adjustMemberCoinsAndLogAtomic
    // call made AFTER the bid claim already succeeded, so a failure there
    // left the bidder recorded as winning with nothing ever actually taken
    // from their balance. result.success now means the coins genuinely
    // moved, not just that the auction row was claimed. The previous
    // bidder/amount/new balances all come from place_bid_atomic's own
    // response (captured inside its locked transaction), not this
    // browser's local `a` — `a` is only as fresh as this client's last 3s
    // poll, and using it here would refer to the WRONG member whenever
    // another client's bid had already changed the real top bidder in the
    // gap since this browser's last poll.
    //
    // Local state below (via the bare setMembersRaw, no DB side effects)
    // is just an optimistic preview for instant UI feedback, built to
    // exactly mirror what the RPC already wrote server-side; the next
    // poll cycle reconciles it with the database regardless.
    //
    // Log each side of this individually, not just the eventual winning
    // total — Points History previously only ever showed a single lump
    // "Auction Win" entry with no visibility into the actual bidding war
    // that led there. Every bid gets its own "Bid Placed" entry; whoever
    // it just outbid gets a matching "Outbid Refund" entry for the exact
    // amount handed back. These two always net to zero for anyone who
    // doesn't end up winning, and the running balance still comes out
    // correct for the eventual winner too — see the change:0 comment on
    // claimAuctionWinAndLog's own entry for why that one doesn't also
    // carry the amount (it would double-count this "Bid Placed" entry).
    const prevBidder = result.prev_bidder || null;
    const prevRefund = prevBidder ? (Number(result.prev_amount) || 0) : 0;
    const bidLogTs = result.bid_ts || Date.now();
    const bidTxEntry = {change:-amount, reason:`Bid on ${a.name}`, date:new Date().toLocaleDateString(), ts:bidLogTs, logType:"Bid Placed", addedBy:"System", auctionId:auctionId};
    setMembersRaw(ms=>ms.map(m=>m.name===currentUser.name ? {...m,coins:result.new_bidder_coins,txLog:[...(m.txLog||[]),bidTxEntry]} : m));

    if (prevBidder && prevRefund > 0) {
      const refundTxEntry = {change:prevRefund, reason:`Outbid on ${a.name}`, date:new Date().toLocaleDateString(), ts:bidLogTs, logType:"Outbid Refund", addedBy:"System", auctionId:auctionId};
      setMembersRaw(ms=>ms.map(m=>m.name===prevBidder ? {...m,coins:result.new_prev_bidder_coins,txLog:[...(m.txLog||[]),refundTxEntry]} : m));
    }
    // SNIPE PROTECTION: if a bid lands in the last 60s, extend the auction by
    // 60s so no one can snipe in the final moment. This also helps with the
    // race where a bid is placed while another client's clock is closing it.
    // This extension is a separate, best-effort write AFTER the bid itself
    // is already confirmed valid — a rare race here could mean the
    // extension is missed or double-applied, but that's a far smaller
    // harm than the original bug (wrong winner declared), and keeping it
    // separate avoids a much larger change to the locked RPC transaction.
    const SNIPE_WINDOW_MS = 60000;
    const SNIPE_EXTEND_MS = 120000;
    const now2 = Date.now();
    const timeRemaining = a.endsAt - now2;
    const newEndsAt = timeRemaining < SNIPE_WINDOW_MS ? now2 + SNIPE_EXTEND_MS : a.endsAt;
    const endsAtChanged = newEndsAt !== a.endsAt;
    if (endsAtChanged) {
      dbUpsert("auctions", { id: String(auctionId), ends_at: newEndsAt });
    }

    setAuctions(prev=>prev.map(x=>x.id===auctionId?{...x,currentBid:amount,topBidder:currentUser.name,endsAt:newEndsAt,bids:[...(x.bids||[]),{bidder:currentUser.name,amount,time:Date.now()}]}:x));
    addToast(`${t("bidPlacedOn")} ${fmt(amount)} ${t("placedOn")} ${a.name}!${endsAtChanged?" "+t("snipeProtection"):""}`, "gold",t("bidPlacedTitle"));
    if (burstX !== null) {
      fireCoinBurst(burstX, burstY);
      fireBalancePopup(burstX, burstY, fmt(me.coins - amount));
    }
    setBidAmounts(prev=>({...prev,[auctionId]:""}));
    // Notify the person who just got outbid, if push is set up for them.
    // Fire-and-forget — never block the bid flow on this.
    if (prevBidder && prevBidder !== currentUser.name) {
      sendPushNotification(
        prevBidder,
        "You've been outbid!",
        `${currentUser.name} outbid you on ${a.name} (${fmt(amount)} coins).`,
        "/?page=auctions",
        `outbid-${auctionId}`
      );
    }
    // Write to bid_events so all other users get a global announcement.
    // (The poll loop in AppInner already skips toasting the bidder's own
    // event via the currentUser.name check, so no local dedupe needed here.)
    const bidEventId = `${auctionId}_${Date.now()}`;
    const bidTs = Date.now();
    dbUpsert("bid_events", { id: bidEventId, bidder: currentUser.name, auction_name: a.name, amount, ts: bidTs });
  }


  // Posts every currently active auction to the auctions Discord channel
  // as its own message (with image, current bid, top bidder, time left)
  // — separate from "Put in News" (which features specific items in the
  // in-app popup) and from the automatic start/end notifications. This
  // is purely a manual "here's what's live right now" broadcast,
  // triggered only when an admin clicks the button.
  //
  // Sent in small batches with a pause between each — Discord allows 5
  // requests per 2 seconds per webhook; firing dozens of messages all at
  // once would blow through that limit and the later ones would simply
  // fail. Batching keeps this reliable regardless of how many auctions
  // are live at once, rather than capping the list and silently dropping
  // anything past a fixed count.
  async function postAllActiveAuctionsToDiscord() {
    if (active.length === 0) {
      addToast("There are no active auctions right now.", "red", "Nothing to Post");
      return;
    }
    addToast(`Posting ${active.length} auction${active.length===1?"":"s"} to Discord — this may take a moment for a large list...`, "gold", "Posting");
    const BATCH_SIZE = 4;       // stay comfortably under the 5-per-2s limit
    const BATCH_DELAY_MS = 2200; // a little over 2s, leaving margin for network lag
    for (let i = 0; i < active.length; i += BATCH_SIZE) {
      const batch = active.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(a => notifyDiscord({ embeds: [auctionToEmbed(a)] }, "auctions")));
      if (i + BATCH_SIZE < active.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }
    addToast(`Posted all ${active.length} active auctions to Discord.`, "gold", "Posted");
  }
  // True if this specific auction is currently featured in the shared
  // auction-news card — drives the Put-in-News button's toggle state
  // (filled/active vs outline) so admins can see at a glance which items
  // are already featured without needing to open the popup separately.
  function isAuctionInNews(auctionId) {
    const card = (loginAnnouncements || []).find(a => a.type === "auctions");
    return !!card?.items?.some(i => i.auctionId === auctionId);
  }
  async function removeAuctionFromNews(auctionId) {
    const list = loginAnnouncements || [];
    const idx = list.findIndex(a => a.type === "auctions");
    if (idx < 0) return;
    const items = list[idx].items.filter(i => i.auctionId !== auctionId);
    // If that was the last item, drop the whole card rather than leaving
    // an empty one sitting in the list.
    const next = items.length > 0
      ? list.map((a,i) => i===idx ? {...a, items} : a)
      : list.filter((_,i) => i!==idx);
    const ok = await dbUpsertReliable("app_state", { key: "login_announcements", value: JSON.stringify(next), updated_at: Date.now() });
    if (ok) {
      setLoginAnnouncements(next);
      addToast("Removed from the login news.", "gold", "Updated");
    } else {
      addToast(
        <span style={{display:"inline-flex",alignItems:"center",gap:6}}><WarningIcon size={13}/>Couldn't remove — please try again.</span>,
        "red", "Remove Failed"
      );
    }
  }

  // Loot Roulette state (lifted into Auctions)
  const [lrMemberSearch, setLrMemberSearch] = React.useState("");
  const [lrTab, setLrTab] = React.useState("history");
  const [lrItems, setLrItems] = React.useState([]);
  const [lrPresent, setLrPresent] = React.useState({});
  const [lrNewItem, setLrNewItem] = React.useState("");
  const [lrNewQty, setLrNewQty] = React.useState(1);
  const [lrDist, setLrDist] = React.useState(null);
  const [lrSpinning, setLrSpinning] = React.useState(false);
  const [lrAngle, setLrAngle] = React.useState(0);
  const [lrRevealed, setLrRevealed] = React.useState(false);
  const [lrEventLabel, setLrEventLabel] = React.useState("");
  const [lrEventDate, setLrEventDate] = React.useState(new Date().toISOString().slice(0,10));
  const [lrSelectedLog, setLrSelectedLog] = React.useState("");
  const lrRef = React.useRef();
  // lrLatestId comes from ctx (shared via poll) so all users see new-result banner
  const lrLatestId = latestLootId;
  const setLrLatestId = setLatestLootId;
  const ONE_WEEK_MS = 7*24*60*60*1000;
  // Use shared lootResults from ctx (synced via Supabase) instead of local state
  const lrHistory = (lootResults || []);
  const setLrHistory = (updater) => {
    setLootResults(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      return next;
    });
  };
  const [lrHistFilter, setLrHistFilter] = React.useState("all");
  const [lrHistSort, setLrHistSort] = React.useState("newest");

  const lrPresentIds = Object.entries(lrPresent).filter(([,v])=>v).map(([id])=>parseInt(id));
  const lrPresentList = members.filter(m=>lrPresentIds.includes(m.id));
  const lrTotalQty = lrItems.reduce((s,i)=>s+i.qty,0);

  function lrAddItem(){
    const name=lrNewItem.trim();
    if(!name){addToast(t("enterItemNameError"),"red",t("errorLabel"));return;}
    const qty=Math.max(1,parseInt(lrNewQty)||1);
    setLrItems(p=>{const ex=p.findIndex(i=>i.name.toLowerCase()===name.toLowerCase());
      if(ex>=0)return p.map((i,idx)=>idx===ex?{...i,qty:i.qty+qty}:i);
      return[...p,{id:Date.now(),name,qty}];});
    setLrNewItem("");setLrNewQty(1);
  }
  function lrRemoveItem(id){setLrItems(p=>p.filter(i=>i.id!==id));}
  function lrUpdateQty(id,qty){if(qty<1)return;setLrItems(p=>p.map(i=>i.id===id?{...i,qty}:i));}

  function lrDistribute(){
    if(!lrItems.length){addToast(t("addAtLeastOneItem"),"red",t("errorLabel"));return;}
    if(!lrPresentList.length){addToast(t("selectAtLeastOneMember"),"red",t("errorLabel"));return;}
    setLrSpinning(true);setLrRevealed(false);setLrDist(null);
    const totalSpin=1440+Math.random()*720;let start=null;const dur=2800;
    function animate(ts){
      if(!start)start=ts;const p=Math.min((ts-start)/dur,1);const ease=1-Math.pow(1-p,3);
      setLrAngle(ease*totalSpin);
      if(p<1){lrRef.current=requestAnimationFrame(animate);}
      else{
        setLrSpinning(false);
        const shuffled=[...lrPresentList].sort(()=>Math.random()-0.5);
        const result=shuffled.map(m=>({member:m,items:[]}));
        const pool=[];
        lrItems.forEach(item=>{for(let i=0;i<item.qty;i++)pool.push(item.name);});
        pool.sort(()=>Math.random()-0.5);
        pool.forEach((name,idx)=>{result[idx%result.length].items.push(name);});
        result.sort((a,b)=>members.indexOf(a.member)-members.indexOf(b.member));
        setLrDist(result);setTimeout(()=>setLrRevealed(true),200);
        // Save to history + persist to Supabase so all users see it.
        // ROOT CAUSE FIX: this write used to be fire-and-forget (no await,
        // result ignored). dbUpsert swallows its own errors and returns
        // null on failure, so a rejected write (RLS, timeout, oversized
        // payload, etc.) was invisible — the roller's local state updated
        // regardless, so only they ever saw the result, and every other
        // client's poll kept reading the same stale rows forever.
        // Now we await a retrying upsert and tell the roller if it never
        // actually made it to the DB, so they know to retry rather than
        // assume everyone else can already see it.
        const entry={id:Date.now(),timestamp:Date.now(),date:lrEventDate||new Date().toLocaleDateString(),eventLabel:lrEventLabel||"Loot Distribution",results:result.map(r=>({memberName:r.member.name,items:r.items}))};
        setLrHistory(h=>[entry,...h].filter(e=>Date.now()-e.timestamp<ONE_WEEK_MS).slice(0,50));
        setLrLatestId(String(entry.id));
        // Switch to history tab so admin also sees the results
        setTimeout(()=>setLrTab("history"),400);
        (async () => {
          const ok = await dbUpsertReliable("loot_results", {
            id: String(entry.id),
            timestamp: entry.timestamp,
            date: entry.date,
            event_label: entry.eventLabel,
            results: JSON.stringify(entry.results),
          });
          if (!ok) {
            addToast(
              "Couldn't sync this roll to other members — they won't see it until you retry. Check your connection and re-roll.",
              "red",
              "Sync Failed"
            );
          }
        })();
      }
    }
    lrRef.current=requestAnimationFrame(animate);
  }
  function lrReset(){setLrDist(null);setLrRevealed(false);setLrAngle(0);}
  React.useEffect(()=>{return()=>{if(lrRef.current)cancelAnimationFrame(lrRef.current);};},[]);

  // ── Hero strip stats — same recipe as Attendance's War Ledger strip:
  // cheap, inline-computed orientation numbers from data already in scope. ──
  const liveBidValue = active.reduce((s,a)=>s+(a.currentBid||0),0);
  const endingSoonest = active.length > 0
    ? [...active].sort((a,b)=>(a.endsAt||Infinity)-(b.endsAt||Infinity))[0]
    : null;

  return (
    <div>
      {/* ── AUCTION HOUSE STRIP — same compact hero language as Attendance's
          War Ledger: orientation numbers above the tabs, not a full banner. ── */}
      <div style={{
        position:"relative",overflow:"hidden",borderRadius:8,marginBottom:24,
        background:"linear-gradient(135deg,#0e0b09 0%,#161110 50%,#0e0b09 100%)",
        border:"1px solid rgba(200,146,42,0.18)",
        boxShadow:"0 6px 32px rgba(0,0,0,0.7), inset 0 1px 0 rgba(200,146,42,0.1)",
        padding:"18px 24px",
      }}>
        <CornerBrackets size={14} thickness={2} inset={10} opacity={0.4}/>
        <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 15% 0%,rgba(200,146,42,0.08) 0%,transparent 55%)",pointerEvents:"none"}}/>
        <div style={{position:"relative",display:"flex",flexWrap:"wrap",gap:28,alignItems:"center"}}>
          <div>
            <div style={{fontFamily:"'Spectral',serif",fontSize:18,fontWeight:800,color:"var(--gold-light)",letterSpacing:1}}>{t("tabLiveAuctions")}</div>
            <div style={{fontSize:10,color:"#7c6d58",letterSpacing:2,textTransform:"uppercase",marginTop:2,fontFamily:"'Inter',sans-serif"}}>{CLAN_NAME}</div>
          </div>
          <div style={{width:1,height:32,background:"rgba(200,146,42,0.2)"}}/>
          <div>
            <div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"rgba(200,146,42,0.7)",fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{t("liveAuctions")}</div>
            <div style={{fontFamily:"'Spectral',serif",fontSize:22,fontWeight:800,color:"var(--gold-bright)",textShadow:"0 0 16px rgba(200,146,42,0.3)"}}>{fmt(active.length)}</div>
          </div>
          <div>
            <div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"rgba(200,146,42,0.7)",fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{t("liveBidValueLabel")}</div>
            <div style={{fontFamily:"'Spectral',serif",fontSize:22,fontWeight:800,color:"var(--gold-bright)",textShadow:"0 0 16px rgba(200,146,42,0.3)",display:"inline-flex",alignItems:"center",gap:5}}><StatIcon src={COINS_ICON} size={24}/>{fmt(liveBidValue)}</div>
          </div>
          {endingSoonest && (
            <div style={{minWidth:0}}>
              <div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"rgba(200,146,42,0.7)",fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{t("endingSoonestLabel")}</div>
              <div style={{fontFamily:"'Inter',sans-serif",fontSize:14,fontWeight:700,color:"var(--text-bright)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:200}}>{endingSoonest.name} <span style={{color:"#f0a0a0",fontWeight:800}}>· {timeLeft(endingSoonest.endsAt)}</span></div>
            </div>
          )}
        </div>
      </div>

      <div className="dash-tabs">
        <div className={`dash-tab${tab==="active"?" active":""}`} onClick={()=>setTab("active")}>{t("tabLiveAuctions")} ({active.length})</div>
        <div className={`dash-tab${tab==="ended"?" active":""}`} onClick={()=>setTab("ended")}>{t("tabAuctionHistory")}</div>
        {!isGuest && <div className={`dash-tab${tab==="roulette"?" active":""}`} onClick={()=>setTab("roulette")}>{t("tabLootRoulette")}</div>}
      </div>

      <BidMarquee feed={bidFeed} auctions={auctions} />

      {(tab==="active"||tab==="ended") && (
        <div className="dash-panel" style={{
          display:"flex",alignItems:"center",gap:10,margin:"14px 0 4px",padding:"10px 16px",flexWrap:"wrap",justifyContent:"flex-end",
          background:"linear-gradient(135deg,#161110 0%,#1c1410 60%,#161110 100%)",
          border:"1px solid rgba(200,146,42,0.15)",borderRadius:6,
        }}>
          {tab==="active" && isAdmin && (
            <button className="btn btn-outline btn-sm" onClick={postAllActiveAuctionsToDiscord} style={{display:"flex",alignItems:"center",gap:6}}>
              <BellIcon size={13}/>{t("postAllToDiscordBtn")}
            </button>
          )}
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:11,color:"var(--text-dim)",textTransform:"uppercase",letterSpacing:2,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{t("sortLabel")}</span>
            <select className="select" style={{width:"auto",fontSize:11,padding:"4px 10px",cursor:"pointer"}} value={sortBy} onChange={e=>setSortBy(e.target.value)}>
              <option value="default">{t("sortDefault")}</option>
              <option value="bid-desc">{t("sortBidHighLow")}</option>
              <option value="bid-asc">{t("sortBidLowHigh")}</option>
              <option value="rarity">{t("sortRarity")}</option>
              <option value="has-bidder">{t("sortHasBidder")}</option>
            </select>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:11,color:"var(--text-dim)",textTransform:"uppercase",letterSpacing:2,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{t("viewLabel")}</span>
            <select className="select" style={{width:"auto",fontSize:11,padding:"4px 10px",cursor:"pointer"}} value={viewMode} onChange={e=>setViewMode(e.target.value)}>
              <option value="grid">{t("viewGrid")}</option>
              <option value="compact">{t("viewCompact")}</option>
            </select>
          </div>
        </div>
      )}

      {tab==="active" && featuredAuction && (
        <FeaturedAuctionSpotlight
          a={featuredAuction} isWinning={featuredAuction.topBidder===currentUser?.name} minBid={featuredAuction.currentBid+5}
          t={t} bidAmounts={bidAmounts} setBidAmounts={setBidAmounts} bidSubmitting={bidSubmitting} placeBid={placeBid}
          isAdmin={isAdmin} isGuest={isGuest} ctx={ctx}
        />
      )}

      {tab==="active" && (
        <div className={viewMode==="grid"?"grid-3":""} style={viewMode==="compact"?{display:"flex",flexDirection:"column",gap:6}:{}}>
          {gridAuctions.length===0&&!featuredAuction&&<div style={{color:"var(--text-dim)",gridColumn:"1/-1",textAlign:"center",padding:48,fontFamily:"'Inter',sans-serif"}}>{t("noActiveAuctionsNow")}</div>}
          {gridAuctions.map(a=>{
            const isWinning=a.topBidder===currentUser?.name;
            const minBid=a.currentBid+5;
            const rc={epic:{bg:"rgba(122,26,26,0.92)",color:"#ff8080",border:"rgba(192,57,43,0.5)"},rare:{bg:"rgba(26,90,138,0.92)",color:"#60aadd",border:"rgba(46,134,193,0.5)"},kari:{bg:"rgba(0,60,130,0.92)",color:"#a0d8ff",border:"rgba(100,200,255,0.6)"},material:{bg:"rgba(120,120,120,0.92)",color:"#cccccc",border:"rgba(160,160,160,0.5)"},uncommon:{bg:"rgba(46,138,46,0.92)",color:"#7ddc7d",border:"rgba(80,180,80,0.5)"}};
            const rc2=rc[a.rarity]||rc.epic;
            if (viewMode==="compact") return (
              <div key={a.id} style={{
                border:"1px solid var(--border)",
                borderLeft:`3px solid ${rc2.color}`,
                background: isWinning ? "rgba(39,174,96,0.06)" : "var(--bg-card)",
                borderRadius:6,
                overflow:"hidden",
                marginBottom:2,
              }}>
                {/* ROW 1: thumbnail + info + bid stats */}
                <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px"}}>
                  {/* Thumbnail */}
                  <div style={{width:48,height:48,borderRadius:4,overflow:"hidden",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:a.rarity==="epic"?"rgba(122,26,26,0.3)":a.rarity==="kari"?"rgba(0,60,130,0.4)":"rgba(26,90,138,0.3)",border:`1px solid ${rc2.border}`}}>
                    {a.image?<AuctionImage auction={a} alt={a.name} style={{width:"100%",height:"100%",objectFit:"cover"}} fallback={<StatIcon src={AUCTION_ICON} size={24}/>}/>:<StatIcon src={AUCTION_ICON} size={24}/>}
                  </div>
                  {/* Name + bidder */}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap",marginBottom:3}}>
                      <span style={{fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:13,color:"var(--text-bright)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:130}}>{a.name}</span>
                      <span style={{fontSize:8,fontWeight:700,padding:"2px 5px",background:rc2.bg,border:`1px solid ${rc2.border}`,color:rc2.color,letterSpacing:1,borderRadius:2,flexShrink:0}}>{rarityLabel(a.rarity||"epic",t)}</span>
                      {isWinning&&<span style={{fontSize:8,fontWeight:700,padding:"2px 5px",background:"rgba(39,174,96,0.2)",border:"1px solid rgba(39,174,96,0.5)",color:"#6ee89a",borderRadius:2,flexShrink:0}}>{t("winningBadgeCompact")}</span>}
                    </div>
                    {a.topBidder
                      ? <div style={{display:"flex",alignItems:"center",gap:3}}><TrophyIcon size={11} style={{color:"#6ee89a",filter:"drop-shadow(0 0 3px rgba(110,232,154,0.4))"}}/><span style={{fontSize:11,color:"#6ee89a",fontWeight:700,fontFamily:"'Inter',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:110}}>{a.topBidder}</span></div>
                      : <div style={{fontSize:10,color:"var(--text-dim)",fontStyle:"italic"}}>{t("noBidsYet")}</div>
                    }
                  </div>
                  {/* Stats: bid + timer */}
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:3}}>
                      <StatIcon src={COINS_ICON} size={14}/>
                      <span style={{fontFamily:"'Inter',sans-serif",fontWeight:800,fontSize:14,color:"var(--gold-light)"}}>{fmt(a.currentBid)}</span>
                    </div>
                    <div style={{fontSize:11,fontWeight:700,color:"#f0a0a0",fontFamily:"'Inter',sans-serif"}}>{timeLeft(a.endsAt)}</div>
                  </div>
                </div>
                {/* ROW 2: bid input + buttons */}
                <div style={{display:"flex",gap:6,padding:"0 12px 10px",alignItems:"center"}}>
                  {isGuest ? (
                    <div style={{fontSize:11,color:"var(--text-dim)",fontStyle:"italic"}}>{t("logInToBid")}</div>
                  ) : (
                  <>
                  <input className="input" type="number" min={minBid} placeholder={`${t("minBidPlaceholder")} ${fmt(minBid)}`}
                    value={bidAmounts[a.id]||""} onChange={e=>setBidAmounts(p=>({...p,[a.id]:e.target.value}))}
                    style={{flex:1,minWidth:0,fontSize:12,padding:"5px 8px"}} />
                  <button className="btn btn-gold btn-sm" onClick={(e)=>placeBid(a.id,e)} disabled={!!bidSubmitting[a.id]} style={{flexShrink:0,padding:"5px 14px"}}>
                    {bidSubmitting[a.id]?"…":t("bidButton")}
                  </button>
                  </>
                  )}

                  {isAdmin&&<button className={isAuctionInNews(a.id)?"btn btn-gold btn-sm":"btn btn-outline btn-sm"} onClick={()=>isAuctionInNews(a.id)?removeAuctionFromNews(a.id):postAuctionToNews(a, ctx)} title={isAuctionInNews(a.id)?t("removeFromNewsTitle"):t("putInNewsTitle")} style={{flexShrink:0,padding:"5px 10px"}}><BellIcon size={12}/></button>}
                  {isMaster&&<button className="btn btn-red btn-sm" onClick={()=>removeAuction(a.id)} title={t("removeTitle")} style={{flexShrink:0,padding:"5px 10px"}}>✕</button>}
                </div>
              </div>
            );
            return (
              <AuctionGridCard key={a.id} a={a} isWinning={isWinning} minBid={minBid} rc2={rc2} t={t}
                bidAmounts={bidAmounts} setBidAmounts={setBidAmounts} bidSubmitting={bidSubmitting} placeBid={placeBid}
                isAdmin={isAdmin} isMaster={isMaster} isGuest={isGuest} isAuctionInNews={isAuctionInNews}
                removeAuctionFromNews={removeAuctionFromNews} postAuctionToNews={postAuctionToNews} ctx={ctx}
                removeAuction={removeAuction} isHoverCapable={isHoverCapable} />
            );
          })}
        </div>
      )}

      {tab==="ended" && (
        <>
        <div className="dash-panel attendance-table-view" style={{
          padding:0,position:"relative",overflow:"hidden",
          background:"linear-gradient(135deg,#161110 0%,#1c1410 60%,#161110 100%)",
          border:"1px solid rgba(200,146,42,0.2)",borderRadius:6,
        }}>
          <CornerBrackets size={13} thickness={1.5} inset={8} opacity={0.4}/>
          <div className="table-wrap">
            <table className="table-stack">
              <thead><tr><th>{t("colDateTime")}</th><th>{t("colItem")}</th><th>{t("colRarity")}</th><th>{t("colWinner")}</th><th>{t("colFinalBid")}</th></tr></thead>
              <tbody>
                {ended.length===0 && <tr><td colSpan={5} style={{textAlign:"center",color:"var(--text-dim)",padding:32}}>{t("noEndedAuctions")}</td></tr>}
                {pagedEnded.map(a=>(
                  <tr key={a.id}>
                    <td data-label="Date & Time" style={{fontWeight:500,whiteSpace:"nowrap"}}>{formatLogDateTime({ts:a.endsAt})}</td>
                    <td data-label="Item">
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:28,height:28,borderRadius:2,overflow:"hidden",background:a.rarity==="epic"?"rgba(122,26,26,0.2)":"rgba(26,90,138,0.2)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:"1px solid var(--border)"}}>
                          {a.image?<AuctionImage auction={a} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} fallback={<StatIcon src={AUCTION_ICON} size={16}/>}/>:<StatIcon src={AUCTION_ICON} size={16}/>}
                        </div>
                        <span style={{fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:13,color:"var(--text-bright)"}}>{a.name}</span>
                      </div>
                    </td>
                    <td data-label="Rarity"><span className={`badge badge-${a.rarity||"epic"}`}>{rarityLabel(a.rarity||"epic",t).toLowerCase()}</span></td>
                    <td data-label="Winner">{a.topBidder ? <span style={{color:"var(--gold-light)",fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{a.topBidder}</span> : <span className="badge badge-silver">{t("noWinner")}</span>}</td>
                    <td data-label="Final Bid">{a.topBidder ? <span style={{display:"inline-flex",alignItems:"center",gap:4,color:"var(--gold)",fontWeight:700,fontFamily:"'Inter',sans-serif"}}><StatIcon src={COINS_ICON} size={20}/>{fmt(a.currentBid)}</span> : <span style={{color:"var(--text-dim)"}}>—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {historyTotalPages>1 && (
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 18px",borderTop:"1px solid var(--border)",justifyContent:"flex-end"}}>
              <span style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:"var(--text-dim)"}}>{t("pageOf")} {safeHistoryPage+1} {t("ofLabel")} {historyTotalPages}</span>
              <button className="btn btn-outline btn-sm" disabled={safeHistoryPage===0} onClick={()=>setHistoryPage(p=>p-1)} style={{opacity:safeHistoryPage===0?0.4:1}}>{t("prevPage")}</button>
              <button className="btn btn-outline btn-sm" disabled={safeHistoryPage>=historyTotalPages-1} onClick={()=>setHistoryPage(p=>p+1)} style={{opacity:safeHistoryPage>=historyTotalPages-1?0.4:1}}>{t("nextPage")}</button>
            </div>
          )}
        </div>

        {/* Mobile card view */}
        <div className="attendance-card-view">
          {ended.length===0 && <div className="dash-subcard" style={{textAlign:"center",color:"var(--text-dim)",padding:32}}>{t("noEndedAuctions")}</div>}
          {pagedEnded.map(a=>(
            <div key={`card-${a.id}`} className="dash-subcard" style={{marginBottom:10,padding:"14px 16px"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <div style={{width:36,height:36,borderRadius:3,overflow:"hidden",background:a.rarity==="epic"?"rgba(122,26,26,0.2)":"rgba(26,90,138,0.2)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:"1px solid var(--border)"}}>
                  {a.image?<AuctionImage auction={a} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} fallback={<StatIcon src={AUCTION_ICON} size={18}/>}/>:<StatIcon src={AUCTION_ICON} size={18}/>}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:"'Inter',sans-serif",fontWeight:800,fontSize:13,color:"var(--text-bright)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</div>
                  <div style={{fontSize:10,color:"var(--text-dim)"}}>{formatLogDateTime({ts:a.endsAt})}</div>
                </div>
                <span className={`badge badge-${a.rarity||"epic"}`} style={{flexShrink:0}}>{rarityLabel(a.rarity||"epic",t).toLowerCase()}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:8,borderTop:"1px solid var(--border-dim)"}}>
                <div>
                  <div style={{fontSize:9,color:"var(--text-dim)",letterSpacing:1,textTransform:"uppercase",marginBottom:2}}>{t("colWinner")}</div>
                  {a.topBidder ? <span style={{color:"var(--gold-light)",fontWeight:700,fontFamily:"'Inter',sans-serif",fontSize:12}}>{a.topBidder}</span> : <span className="badge badge-silver">{t("noWinner")}</span>}
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:9,color:"var(--text-dim)",letterSpacing:1,textTransform:"uppercase",marginBottom:2}}>{t("colFinalBid")}</div>
                  {a.topBidder ? <span style={{display:"inline-flex",alignItems:"center",gap:4,color:"var(--gold)",fontWeight:700,fontFamily:"'Inter',sans-serif",fontSize:13}}><StatIcon src={COINS_ICON} size={18}/>{fmt(a.currentBid)}</span> : <span style={{color:"var(--text-dim)"}}>—</span>}
                </div>
              </div>
            </div>
          ))}
          {historyTotalPages>1 && (
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 4px",justifyContent:"center"}}>
              <button className="btn btn-outline btn-sm" disabled={safeHistoryPage===0} onClick={()=>setHistoryPage(p=>p-1)} style={{opacity:safeHistoryPage===0?0.4:1}}>{t("prevPage")}</button>
              <span style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:"var(--text-dim)"}}>{safeHistoryPage+1} {t("ofLabel")} {historyTotalPages}</span>
              <button className="btn btn-outline btn-sm" disabled={safeHistoryPage>=historyTotalPages-1} onClick={()=>setHistoryPage(p=>p+1)} style={{opacity:safeHistoryPage>=historyTotalPages-1?0.4:1}}>{t("nextPage")}</button>
            </div>
          )}
        </div>
        </>
      )}

      {tab==="roulette"&&!isGuest&&(
        <div>
          {/* ── Header ── */}
          <div className="dash-panel" style={{
            marginBottom:20,padding:"18px 22px",position:"relative",overflow:"hidden",
            background:"linear-gradient(135deg,#1c1210 0%,rgba(168,50,40,0.1) 60%,#1c1210 100%)",
            border:"1px solid rgba(168,50,40,0.35)",borderRadius:6,
          }}>
            <CornerBrackets size={12} thickness={1.5} inset={8} opacity={0.4}/>
            <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
              <div style={{width:46,height:46,borderRadius:6,background:"linear-gradient(135deg,#3d0000,var(--blood-light))",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 0 20px rgba(168,50,40,0.5)"}}><SwordsIcon size={24} style={{color:"#fff"}}/></div>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'Spectral',serif",fontWeight:900,fontSize:18,color:"#f4e8cc",letterSpacing:1}}>{t("lootRouletteTitle")}</div>
                <div style={{fontSize:11,color:"var(--text-dim)",marginTop:2}}>{t("fairRandomDist")} · {isAdmin?t("elderControlsActive"):t("viewResultsHistory")}</div>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"flex-end",flexShrink:0}}>
                <button className={`btn btn-sm${lrTab==="history"?" btn-red":" btn-ghost"}`} onClick={()=>setLrTab("history")}>{t("historyBtn")}</button>
                {isAdmin&&<button className={`btn btn-sm${lrTab==="manage"?" btn-gold":" btn-outline"}`} onClick={()=>setLrTab("manage")}><span style={{display:"inline-flex",alignItems:"center",gap:6}}><GearIcon size={11}/>{t("manageBtn")}</span></button>}
              </div>
            </div>
          </div>

          {/* ── History Tab ── */}
          {lrTab==="history"&&(
            <div>
              {/* NEW RESULT banner — shown right after a roll */}
              {lrLatestId && lrHistory.find(e=>String(e.id)===lrLatestId) && (()=>{
                const latest = lrHistory.find(e=>String(e.id)===lrLatestId);
                return (
                  <div style={{marginBottom:16,padding:"14px 18px",borderRadius:6,
                    background:"linear-gradient(135deg,rgba(200,146,42,0.18),rgba(200,146,42,0.06))",
                    border:"1px solid var(--gold)",position:"relative",overflow:"hidden"}}>
                    <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,var(--gold),transparent)"}} />
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,flexWrap:"wrap"}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:"#27ae60",boxShadow:"0 0 8px #27ae60",animation:"pulse 1s infinite",flexShrink:0}} />
                      <span style={{fontFamily:"'Inter',sans-serif",fontWeight:900,fontSize:15,color:"var(--gold-light)",letterSpacing:1,display:"inline-flex",alignItems:"center",gap:6}}><SwordsIcon size={14}/>{t("lootJustRolled")}</span>
                      <span style={{fontSize:10,color:"var(--text-dim)",fontFamily:"'Inter',sans-serif"}}>{eventLabelDisplay(latest.eventLabel,t)} · {latest.date}</span>
                      <button className="btn btn-ghost btn-sm" style={{marginLeft:"auto",fontSize:10}} onClick={()=>setLrLatestId(null)}>{t("dismissBtn")}</button>
                    </div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                      {latest.results.map((r,ri)=>{
                        const grp=r.items.reduce((a,n)=>{a[n]=(a[n]||0)+1;return a;},{});
                        return(
                          <div key={ri} style={{background:"rgba(10,8,6,0.7)",border:"1px solid rgba(200,146,42,0.25)",borderRadius:5,padding:"8px 12px",minWidth:130}}>
                            <div style={{fontFamily:"'Inter',sans-serif",fontWeight:800,fontSize:12,color:r.items.length?"var(--gold-light)":"var(--text-dim)",marginBottom:4,display:"flex",justifyContent:"space-between",gap:6}}>
                              <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.memberName}</span>
                              <span style={{fontSize:9,color:"rgba(200,146,42,0.5)",flexShrink:0}}>{r.items.length}{t("pieceCount")}</span>
                            </div>
                            {r.items.length===0
                              ? <div style={{fontSize:10,color:"var(--text-dim)",fontStyle:"italic"}}>{t("nothingLabel")}</div>
                              : Object.entries(grp).map(([name,qty],j)=>(
                                  <div key={j} style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--text-dim)"}}>
                                    <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</span>
                                    <span style={{fontFamily:"'Inter',sans-serif",fontWeight:900,color:qty>1?"var(--gold-light)":"rgba(180,150,100,0.4)",flexShrink:0,marginLeft:4}}>×{qty}</span>
                                  </div>
                                ))
                            }
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              {/* Refresh button */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:7,height:7,borderRadius:"50%",background:"#27ae60",boxShadow:"0 0 6px #27ae60",animation:"pulse 2s infinite"}}/>
                  <span style={{fontSize:10,color:"var(--text-dim)",fontFamily:"'Inter',sans-serif"}}>{t("autoRefreshes")}</span>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={async ()=>{
                  const rows=await dbLoad("loot_results");
                  if(Array.isArray(rows)&&rows.length>0){
                    setLootResults(rows.map(r=>({id:r.id,timestamp:Number(r.timestamp)||0,date:r.date||"",eventLabel:r.event_label||"Loot Distribution",results:(()=>{try{return typeof r.results==="string"?JSON.parse(r.results):(r.results||[]);}catch{return[];}})()})).filter(r=>Date.now()-r.timestamp<7*24*60*60*1000).sort((a,b)=>b.timestamp-a.timestamp));
                    addToast(t("resultsRefreshed"),"blue",t("refreshedTitle"));
                  }
                }}>{t("refreshNow")}</button>
              </div>
              {/* Filter + Sort toolbar */}
              {lrHistory.length>0&&(()=>{
                const allLabels=["all",...[...new Set(lrHistory.map(e=>e.eventLabel||"Loot Distribution"))].sort()];
                const filtered=lrHistory
                  .filter(e=>lrHistFilter==="all"||(e.eventLabel||"Loot Distribution")===lrHistFilter)
                  .sort((a,b)=>lrHistSort==="newest"?b.timestamp-a.timestamp:a.timestamp-b.timestamp);
                return(
                  <>
                    <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
                      {/* Event filter pills */}
                      <div style={{display:"flex",gap:6,flexWrap:"wrap",flex:1}}>
                        {allLabels.map(label=>(
                          <button key={label} onClick={()=>setLrHistFilter(label)}
                            className={`btn btn-sm${lrHistFilter===label?" btn-red":" btn-ghost"}`}
                            style={{fontSize:10,padding:"3px 12px",textTransform:label==="all"?"uppercase":"none",letterSpacing:label==="all"?1:0}}>
                            {label==="all"?t("allEventsLabel"):eventLabelDisplay(label,t)}
                            {label!=="all"&&<span style={{marginLeft:5,opacity:0.6,fontSize:9}}>({lrHistory.filter(e=>(e.eventLabel||"Loot Distribution")===label).length})</span>}
                          </button>
                        ))}
                      </div>
                      {/* Sort dropdown */}
                      <select className="select" style={{width:"auto",padding:"4px 10px",fontSize:11}} value={lrHistSort} onChange={e=>setLrHistSort(e.target.value)}>
                        <option value="newest">{t("newestFirst")}</option>
                        <option value="oldest">{t("oldestFirst")}</option>
                      </select>
                    </div>
                    <div style={{fontSize:10,color:"var(--text-dim)",marginBottom:12,fontFamily:"'Inter',sans-serif",fontStyle:"italic"}}>
                      {filtered.length} {t("sessionsLabel")}{filtered.length!==1?t("sessionsPluralSuffix"):""} · {t("historyAutoClears")}
                    </div>
                    {filtered.length===0&&(
                      <div className="dash-subcard" style={{textAlign:"center",padding:32,color:"var(--text-dim)",fontFamily:"'Inter',sans-serif"}}>
                        {t("noSessionsMatch")}
                      </div>
                    )}
                    {filtered.map((entry,ei)=>{
                      const daysAgo=Math.round((Date.now()-entry.timestamp)/86400000);
                      const hoursAgo=Math.round((Date.now()-entry.timestamp)/3600000);
                      const timeAgo=hoursAgo<24?hoursAgo+t("hoursAgo"):daysAgo+t("daysAgo");
                      const EVENT_COLOR_MAP={
                        "World Boss":"#27ae60","Inter-Server Battle":"#e74c3c",
                        "Clan Sanctuary":"#3498db","Clan Annihilation":"#e67e22",
                        "Loot Distribution":"#c8922a",
                        "Canyon of the World Tree Depth":"#27ae60","Canyon of Nidavellir 1f":"#16a085",
                        "Crossroad of Ragnarok":"#2ecc71","Folkvang 5f":"#1abc9c",
                      };
                      const evColor=EVENT_COLOR_MAP[entry.eventLabel]||"#c8922a";
                      return(
                        <div key={entry.id} className="dash-subcard" style={{marginBottom:14,position:"relative",overflow:"hidden"}}>
                          <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${evColor}88,transparent)`}} />
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
                            <div style={{display:"flex",alignItems:"center",gap:10}}>
                              <div style={{width:8,height:8,borderRadius:"50%",background:evColor,boxShadow:`0 0 6px ${evColor}`,flexShrink:0}} />
                              <div style={{fontFamily:"'Inter',sans-serif",fontWeight:800,fontSize:14,color:"var(--gold-light)"}}>{eventLabelDisplay(entry.eventLabel||"Loot Distribution",t)}</div>
                              <span style={{fontSize:10,color:"rgba(200,146,42,0.6)",fontFamily:"'Inter',sans-serif"}}>{entry.date}</span>
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:10}}>
                              <span style={{fontSize:10,color:"var(--text-dim)",letterSpacing:1}}>{entry.results.length} {t("participantsLabel")}</span>
                              <span style={{fontSize:9,background:"rgba(200,146,42,0.1)",border:"1px solid rgba(200,146,42,0.2)",borderRadius:10,padding:"2px 8px",color:"rgba(200,146,42,0.7)",fontWeight:700}}>{timeAgo}</span>
                            </div>
                          </div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                            {entry.results.filter(r=>r.items.length>0).map((r,ri)=>{
                              const grp=r.items.reduce((a,n)=>{a[n]=(a[n]||0)+1;return a;},{});
                              return(
                                <div key={ri} style={{background:"rgba(10,8,6,0.6)",border:"1px solid var(--border-dim)",borderRadius:6,padding:"8px 12px",minWidth:140,maxWidth:220}}>
                                  <div style={{fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:12,color:"var(--gold-light)",marginBottom:4,display:"flex",justifyContent:"space-between",alignItems:"center",gap:6}}>
                                    <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.memberName}</span>
                                    <span style={{fontSize:9,color:"rgba(200,146,42,0.55)",fontWeight:700,flexShrink:0}}>{r.items.length}{t("pieceCount")}</span>
                                  </div>
                                  {Object.entries(grp).map(([name,qty],j)=>(
                                    <div key={j} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:6,fontSize:11,color:"var(--text-dim)",padding:"1px 0"}}>
                                      <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</span>
                                      <span style={{fontFamily:"'Inter',sans-serif",fontWeight:900,fontSize:11,color:qty>1?"var(--gold-light)":"rgba(180,150,100,0.4)",flexShrink:0}}>×{qty}</span>
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                            {entry.results.filter(r=>r.items.length===0).length>0&&(
                              <div style={{alignSelf:"center",fontSize:10,color:"var(--text-dim)",fontStyle:"italic",fontFamily:"'Inter',sans-serif"}}>
                                {t("noLootLabel")} {entry.results.filter(r=>r.items.length===0).map(r=>r.memberName).join(", ")}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </>
                );
              })()}
              {lrHistory.length===0&&(
                <div className="dash-subcard" style={{textAlign:"center",padding:48,color:"var(--text-dim)",fontFamily:"'Inter',sans-serif"}}>
                  <div style={{fontSize:36,marginBottom:10}}>📜</div>
                  <div>{t("noRouletteHistory")}</div>
                  <div style={{fontSize:11,marginTop:6}}>{t("historyAutoClearsTidy")}</div>
                </div>
              )}
            </div>
          )}

          {/* ── Manage Tab (Elder/Master only) ── */}
          {lrTab==="manage"&&isAdmin&&(
            <div className="grid-2" style={{alignItems:"start"}}>
              {/* Left: event info + member selection */}
              <div>
                {/* ── Event & Date Panel ── */}
                <div className="dash-panel" style={{
                  marginBottom:16,position:"relative",overflow:"hidden",
                  background:"linear-gradient(135deg,#161110 0%,#1c1410 60%,#161110 100%)",
                  border:"1px solid rgba(200,146,42,0.2)",borderRadius:6,padding:20,
                }}>
                  <CornerBrackets size={11} thickness={1.5} inset={7} opacity={0.35}/>
                  <SectionTitle><span style={{display:"inline-flex",alignItems:"center",gap:6}}><SwordsIcon size={13}/>{t("sessionInfo")}</span></SectionTitle>

                  {/* Auto-import from attendance log */}
                  {attendanceLogs.length>0&&(
                    <div style={{marginBottom:14}}>
                      <label style={{fontSize:10,color:"var(--gold-dim)",letterSpacing:2,textTransform:"uppercase",fontWeight:700,fontFamily:"'Inter',sans-serif",display:"block",marginBottom:6}}>{t("importFromAttendance")}</label>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <select className="select" style={{flex:1,fontSize:12}}
                          value={lrSelectedLog}
                          onChange={e=>{
                            const logId=parseInt(e.target.value);
                            setLrSelectedLog(e.target.value);
                            if(!logId){return;}
                            const log=attendanceLogs.find(l=>l.id===logId);
                            if(!log)return;
                            // Auto-fill event label and date
                            setLrEventLabel(log.event);
                            setLrEventDate(log.date);
                            // Auto-select members who attended (not afk)
                            const attendedNames=new Set((log.attendees||[]).filter(a=>a.qualifier!=="afk").map(a=>a.name));
                            const newPresent={};
                            members.forEach(m=>{if(attendedNames.has(m.name))newPresent[m.id]=true;});
                            setLrPresent(newPresent);
                            addToast(`${t("importedFrom")} ${Object.keys(newPresent).length} ${t("attendeesFrom")} ${log.event}.`,"gold",t("autoImported"));
                          }}>
                          <option value="">{t("selectAttendanceLogPlaceholder")}</option>
                          {attendanceLogs.slice(0,20).map(l=>(
                            <option key={l.id} value={l.id}>{l.event} · {l.date} ({l.members} {t("membersLabel2")})</option>
                          ))}
                        </select>
                      </div>
                      <div style={{fontSize:10,color:"var(--text-dim)",marginTop:5,fontFamily:"'Inter',sans-serif",fontStyle:"italic"}}>{t("selectingLogHint")}</div>
                    </div>
                  )}

                  <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                    <div style={{flex:"1 1 160px"}}>
                      <label style={{fontSize:10,color:"var(--gold-dim)",letterSpacing:2,textTransform:"uppercase",fontWeight:700,fontFamily:"'Inter',sans-serif",display:"block",marginBottom:5}}>{t("eventNameLabel")}</label>
                      <input className="input" placeholder={t("eventNamePlaceholder")} value={lrEventLabel} onChange={e=>setLrEventLabel(e.target.value)} style={{width:"100%"}} />
                    </div>
                    <div style={{flex:"0 1 140px"}}>
                      <label style={{fontSize:10,color:"var(--gold-dim)",letterSpacing:2,textTransform:"uppercase",fontWeight:700,fontFamily:"'Inter',sans-serif",display:"block",marginBottom:5}}>{t("dateLabel")}</label>
                      <input className="input" type="date" value={lrEventDate} onChange={e=>setLrEventDate(e.target.value)} style={{width:"100%"}} />
                    </div>
                  </div>

                  {/* Quick event preset buttons */}
                  <div style={{marginTop:10,display:"flex",flexWrap:"wrap",gap:6}}>
                    {EVENTS.map(ev=>(
                      <button key={ev.id} className="btn btn-ghost btn-sm"
                        style={{fontSize:10,padding:"3px 10px",borderColor:`${ev.color}44`,color:ev.color,
                          background:lrEventLabel===ev.name?`${ev.color}18`:"transparent"}}
                        onClick={()=>setLrEventLabel(ev.name)}>
                        {ev.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Participant Selection ── */}
                <div className="dash-panel" style={{
                  position:"relative",overflow:"hidden",
                  background:"linear-gradient(135deg,#161110 0%,#1c1410 60%,#161110 100%)",
                  border:"1px solid rgba(200,146,42,0.2)",borderRadius:6,padding:20,
                }}>
                  <CornerBrackets size={11} thickness={1.5} inset={7} opacity={0.35}/>
                  <SectionTitle>{t("selectParticipants")}</SectionTitle>
                  <div style={{display:"flex",gap:6,marginBottom:8,alignItems:"center",flexWrap:"wrap"}}>
                    <input className="input" placeholder={t("searchWarrior")} value={lrMemberSearch||""} onChange={e=>setLrMemberSearch(e.target.value)} style={{flex:1,minWidth:0}} />
                  </div>
                  <div style={{display:"flex",gap:6,marginBottom:10}}>
                    <button className="btn btn-outline btn-sm" onClick={()=>setLrPresent(Object.fromEntries(members.map(m=>[m.id,true])))}>{t("selectAll")}</button>
                    <button className="btn btn-ghost btn-sm" onClick={()=>setLrPresent({})}>{t("unselectAll")}</button>
                    <span style={{marginLeft:"auto",fontFamily:"'Inter',sans-serif",fontSize:11,color:"var(--gold)",fontWeight:700}}>{lrPresentList.length} {t("selectedCount")}</span>
                  </div>
                  <div style={{maxHeight:280,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
                    {members.filter(m=>m.name.toLowerCase().includes((lrMemberSearch||"").toLowerCase())).map(m=>(
                      <div key={m.id} onClick={()=>setLrPresent(p=>({...p,[m.id]:!p[m.id]}))}
                        style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:4,cursor:"pointer",
                          background:lrPresent[m.id]?"rgba(200,146,42,0.1)":"transparent",
                          border:`1px solid ${lrPresent[m.id]?"var(--border-bright)":"transparent"}`,transition:"all 0.15s"}}>
                        <div style={{width:16,height:16,borderRadius:2,border:`2px solid ${lrPresent[m.id]?"var(--gold)":"var(--border)"}`,
                          background:lrPresent[m.id]?"var(--gold)":"transparent",
                          display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s"}}>
                          {lrPresent[m.id]&&<span style={{color:"#000",fontSize:9,fontWeight:900}}>✓</span>}
                        </div>
                        <ClassIcon cls={m.cls} size={28}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:12,color:"var(--text-bright)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{m.name}</div>
                          <div style={{fontSize:9,color:"var(--text-dim)"}}>{m.cls}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* Right: loot list + spin */}
              <div>
                <div className="dash-panel" style={{
                  marginBottom:16,position:"relative",overflow:"hidden",
                  background:"linear-gradient(135deg,#161110 0%,#1c1410 60%,#161110 100%)",
                  border:"1px solid rgba(200,146,42,0.2)",borderRadius:6,padding:20,
                }}>
                  <CornerBrackets size={11} thickness={1.5} inset={7} opacity={0.35}/>
                  <SectionTitle>{t("lootItemsTitle")}</SectionTitle>
                  <div style={{display:"flex",gap:8,marginBottom:12}}>
                    <input className="input" placeholder={t("itemNamePlaceholder")} value={lrNewItem} onChange={e=>setLrNewItem(e.target.value)} onKeyDown={e=>e.key==="Enter"&&lrAddItem()} style={{flex:1}}/>
                    <input className="input" type="number" min={1} value={lrNewQty} onChange={e=>setLrNewQty(e.target.value)} style={{width:64}}/>
                    <button className="btn btn-gold btn-sm" onClick={lrAddItem}>{t("addBtn")}</button>
                  </div>
                  {lrItems.length===0&&<div style={{color:"var(--text-dim)",fontSize:12,fontFamily:"'Inter',sans-serif",textAlign:"center",padding:"16px 0"}}>{t("noItemsAdded")}</div>}
                  {lrItems.map(item=>(
                    <div key={item.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px solid var(--border-dim)"}}>
                      <div style={{flex:1,fontFamily:"'Inter',sans-serif",fontSize:12,color:"var(--text)"}}>{item.name}</div>
                      <input className="input" type="number" min={1} value={item.qty} onChange={e=>lrUpdateQty(item.id,parseInt(e.target.value)||1)} style={{width:52,padding:"3px 6px",fontSize:11}}/>
                      <button className="btn btn-ghost btn-sm" onClick={()=>lrRemoveItem(item.id)}>✕</button>
                    </div>
                  ))}
                  {lrItems.length>0&&<div style={{marginTop:8,fontSize:11,color:"var(--text-dim)",fontFamily:"'Inter',sans-serif"}}>{lrTotalQty} {t("totalItemsLabel")} · {lrPresentList.length} {t("membersLabel2")}</div>}
                </div>
                <div className="dash-panel" style={{
                  position:"relative",overflow:"hidden",
                  background:"linear-gradient(135deg,#1c1210 0%,rgba(168,50,40,0.1) 60%,#1c1210 100%)",
                  border:"1px solid rgba(168,50,40,0.35)",borderRadius:6,padding:20,
                }}>
                  <CornerBrackets size={11} thickness={1.5} inset={7} opacity={0.35}/>
                  <button className="btn btn-red" style={{width:"100%",fontSize:15,padding:"14px 0",letterSpacing:2,justifyContent:"center",display:"flex",alignItems:"center",gap:8}} onClick={()=>{lrDistribute();}} disabled={lrSpinning}>
                    {lrSpinning?t("rolling"):<span style={{display:"inline-flex",alignItems:"center",gap:7}}><SwordsIcon size={13}/>{t("rollTheLoot")}</span>}
                  </button>
                  {lrDist&&<button className="btn btn-ghost btn-sm" style={{width:"100%",marginTop:8}} onClick={lrReset}>{t("resetBtn")}</button>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

// ─── LEADERBOARD ──────────────────────────────────────────────────────────────
const LB_PAGE = 10;

function LBList({ data, valueKey, label, format, color, currentUser, showMultiplier, rankOffset=0, onViewProfile }) {
  const { t } = useLang();
  const [page, setPage] = React.useState(0);
  const max=data[0]?.[valueKey]||1;
  const totalPages = Math.ceil(data.length/LB_PAGE);
  const visible = data.slice(page*LB_PAGE, (page+1)*LB_PAGE);
  const myRank = data.findIndex(m=>m.name===currentUser?.name);
  const myEntry = data[myRank];
  const onCurrentPage = myRank>=page*LB_PAGE && myRank<(page+1)*LB_PAGE;

    return (
      <div className="dash-panel" style={{
        minWidth:0,position:"relative",overflow:"hidden",
        background:"linear-gradient(135deg,#161110 0%,#1c1410 60%,#161110 100%)",
        border:"1px solid rgba(200,146,42,0.2)",borderRadius:6,padding:20,
      }}>
        <CornerBrackets size={11} thickness={1.5} inset={7} opacity={0.35}/>
        <SectionTitle>{label}</SectionTitle>

        {/* Personal rank banner */}
        {myEntry && (
          <div style={{
            background:"rgba(201,151,42,0.07)",border:"1px solid rgba(201,151,42,0.22)",
            borderRadius:4,padding:"8px 12px",marginBottom:14,
            display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",rowGap:6
          }}>
            <span style={{fontSize:10,color:"rgba(200,146,42,0.7)",fontFamily:"'Inter',sans-serif",fontWeight:700,letterSpacing:2,textTransform:"uppercase",flexShrink:0}}>{t("yourRank")}</span>
            <span style={{fontFamily:"'Spectral',serif",fontWeight:900,fontSize:18,color:"var(--gold-light)",flexShrink:0}}>#{myRank+1+rankOffset}</span>
            <div style={{flex:"1 1 0%",minWidth:0,fontSize:11,color:"var(--text-dim)",fontFamily:"'Inter',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {format?format(myEntry[valueKey]):myEntry[valueKey]}
              {myRank>0&&<span style={{color:"rgba(200,146,42,0.5)",fontSize:10}}>
                {" "}{valueKey==="coins"?`${fmt(data[myRank-1][valueKey]-myEntry[valueKey])} ${t("behindLabel")} #${myRank+rankOffset}`:
                 valueKey==="power"?`${fmt(data[myRank-1][valueKey]-myEntry[valueKey])} ${t("bpBehind")} #${myRank+rankOffset}`:
                 `${data[myRank-1][valueKey]-myEntry[valueKey]} ${t("attBehind")} #${myRank+rankOffset}`}
              </span>}
              {myRank===0&&rankOffset===0&&<span style={{color:"var(--gold)",fontSize:10}}> <CrownIcon size={11}/> {t("leadingLabel")}</span>}
            </div>
            {showMultiplier && (
              <span style={{flexShrink:0,fontSize:11,fontWeight:800,color:"var(--gold-light)",background:"rgba(201,151,42,0.15)",border:"1px solid rgba(201,151,42,0.35)",borderRadius:3,padding:"3px 8px",fontFamily:"'Inter',sans-serif",whiteSpace:"nowrap"}}>
                ×{getRankMultiplier(data, myEntry.id).toFixed(2)}
              </span>
            )}
          </div>
        )}

        {/* Ranked list */}
        {visible.map((m,i)=>{
          const globalRank = page*LB_PAGE+i+rankOffset;
          const isMe = m.name===currentUser?.name;
          return (
            <div key={m.id} className="lb-row" style={{background:isMe?"rgba(201,151,42,0.06)":"transparent",borderRadius:isMe?3:0,padding:isMe?"6px 8px":"10px 0"}}>
              <div className="lb-rank" style={{color:globalRank===0?"#f2d98a":globalRank===1?"#a8b8c8":globalRank===2?"#c87533":"var(--text-dim)"}}>{rankIcon(globalRank)}</div>
              <div style={{flexShrink:0}}><ClassIcon cls={m.cls} size={28}/></div>
              <div style={{flex:1,minWidth:0}}>
                <div className="lb-name" onClick={onViewProfile?()=>onViewProfile(m.id):undefined}
                  style={{color:isMe?"var(--gold-light)":"var(--text-bright)",textAlign:"left",cursor:onViewProfile?"pointer":"default"}}
                  onMouseEnter={onViewProfile?e=>e.currentTarget.style.textDecoration="underline":undefined}
                  onMouseLeave={onViewProfile?e=>e.currentTarget.style.textDecoration="none":undefined}>
                  {m.name}{isMe&&<span style={{fontSize:9,color:"var(--gold)",marginLeft:5,fontWeight:700}}>{t("youSuffix")}</span>}
                </div>
                <div style={{fontSize:9,color:"var(--text-dim)",fontWeight:600,letterSpacing:1,textTransform:"uppercase",textAlign:"left"}}>{m.role||m.cls}</div>
                <div className="lb-bar-bg">
                  <div className="lb-bar" style={{width:`${(m[valueKey]/max)*100}%`,background:color||"linear-gradient(90deg,var(--gold-dim),var(--gold-light))"}}/>
                </div>
              </div>
              {showMultiplier && (
                <span title={t("multiplierLabel")} style={{flexShrink:0,fontSize:10,fontWeight:800,color:"var(--gold)",fontFamily:"'Inter',sans-serif",marginRight:4}}>
                  ×{getRankMultiplier(data, m.id).toFixed(2)}
                </span>
              )}
              <div className="lb-val" style={{color:globalRank===0?"var(--gold-light)":globalRank===1?"#a8b8c8":"var(--text)"}}>{format?format(m[valueKey]):m[valueKey]}</div>
            </div>
          );
        })}

        {/* Pagination */}
        {totalPages>1&&(
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:12,paddingTop:10,borderTop:"1px solid var(--border-dim)",flexWrap:"wrap",gap:8}}>
            <span style={{fontSize:10,color:"var(--text-dim)",fontFamily:"'Inter',sans-serif"}}>
              {page*LB_PAGE+1}–{Math.min((page+1)*LB_PAGE,data.length)} {t("ofPagination")} {data.length}
            </span>
            <div style={{display:"flex",gap:6}}>
              <button className="btn btn-outline btn-sm" disabled={page===0} onClick={()=>setPage(p=>p-1)} style={{opacity:page===0?0.4:1,fontSize:10,padding:"3px 10px"}}>{t("prevPage")}</button>
              <button className="btn btn-outline btn-sm" disabled={page>=totalPages-1} onClick={()=>setPage(p=>p+1)} style={{opacity:page>=totalPages-1?0.4:1,fontSize:10,padding:"3px 10px"}}>{t("nextPage")}</button>
            </div>
          </div>
        )}
      </div>
    );
}

// Top-3 "Most Powerful" podium — reuses the real ProfileCard (same
// rarity/portrait/frame/awakening composition as the Player Info page),
// arranged gold/silver/bronze, over the same angel/trophy video already
// used on the login screen.
function LeaderboardPodium({ topThree, honorableMentions, onViewProfile }) {
  // Render order left-to-right is #2, #1, #3 (classic podium arrangement)
  // even though the data order is #1, #2, #3.
  const ordered = [topThree[1], topThree[0], topThree[2]];
  const rankOf = m => topThree.findIndex(x => x?.id === m?.id) + 1;

  return (
    <div className="podium-banner">
      <div className="podium-row">
        {ordered.map(m => {
          if (!m) return null;
          const rank = rankOf(m);
          return (
            <div key={m.id} className={`podium-slot podium-rank-${rank}`}>
              <div className="podium-metal-ring">
                <div className="podium-card-frame">
                  <ProfileCard member={m} onClick={onViewProfile ? ()=>onViewProfile(m.id) : undefined} prestigeRank={rank} />
                </div>
              </div>
              <div className="podium-name">{m.cls}</div>
              <div className="podium-power">{fmt(m.power)} Power</div>
            </div>
          );
        })}
      </div>

      {/* Honorable mentions — ranks 4-10. Deliberately smaller and quieter
          than the podium (silver metallic ring only, no crown, no
          oversized glow), so the top 3 stay the clear visual focus while
          still giving every one of them a real card instead of just
          plain text. Wraps to multiple rows on narrow screens. */}
      {honorableMentions && honorableMentions.length > 0 && (
        <div className="podium-honorable-row">
          {honorableMentions.map((m, i) => {
            if (!m) return null;
            const rank = i + 4;
            return (
              <div key={m.id} className="podium-honorable-slot">
                <div className="podium-honorable-ring">
                  <div className="podium-honorable-frame">
                    <ProfileCard member={m} onClick={onViewProfile ? ()=>onViewProfile(m.id) : undefined} prestigeRank={rank} />
                  </div>
                </div>
                <div className="podium-honorable-name">{m.cls}</div>
                <div className="podium-honorable-power">{fmt(m.power)} Power</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Leaderboard({ ctx }) {
  const { members, currentUser, isGuest, setGlobalViewingProfile } = ctx;
  const { t } = useLang();
  const byCoins=[...members].sort((a,b)=>b.coins-a.coins);
  const byPower=[...members].sort((a,b)=>b.power-a.power);
  const byAttend=[...members].sort((a,b)=>b.attendance-a.attendance);
  const powerTopThree = byPower.slice(0,3);
  const powerFourToTen = byPower.slice(3,10);
  const powerRest = byPower.slice(10);
  // Guests only get the Most Powerful ranking — Richest Warriors (coins)
  // and Most Active (attendance) are hidden. Also close the profile-click
  // side door on the podium and the Most Powerful list itself: clicking
  // through to PlayerInfo reveals a member's full Points History (coins,
  // tx_log) even from a list that only shows power, so guests never get
  // onViewProfile at all, not even on the list they can see.
  const onViewProfile = isGuest ? undefined : setGlobalViewingProfile;

  return (
    <div>
      <div className="leaderboard-headline-row">
        <div className="leaderboard-headline-flourish leaderboard-headline-flourish--left" />
        <div className="leaderboard-headline-text">
          {possessive(CLAN_NAME)} {t("mightiestWarriors")}
        </div>
        <div className="leaderboard-headline-flourish leaderboard-headline-flourish--right" />
      </div>

      {powerTopThree.length > 0 && <LeaderboardPodium topThree={powerTopThree} honorableMentions={powerFourToTen} onViewProfile={onViewProfile} />}

      <div className="lb-grid">
        <LBList data={powerRest} valueKey="power" label={<span style={{display:"inline-flex",alignItems:"center",gap:7}}><LBIcon src={POWER_ICON} size={22} />{t("mostPowerful")}</span>} format={v=>fmt(v)} color="linear-gradient(90deg,#071824,#2e86c1)" currentUser={currentUser} showMultiplier rankOffset={10} onViewProfile={onViewProfile} />
        {!isGuest && <LBList data={byCoins} valueKey="coins" label={<span style={{display:"inline-flex",alignItems:"center",gap:7}}><LBIcon src={RICHEST_ICON} size={22} />{t("richestWarriors")}</span>} format={v=>`${fmt(v)}`} currentUser={currentUser} onViewProfile={onViewProfile} />}
        {!isGuest && <LBList data={byAttend} valueKey="attendance" label={<span style={{display:"inline-flex",alignItems:"center",gap:7}}><LBIcon src={MOSTACTIVE_ICON} size={22} />{t("mostActive")}</span>} format={v=>`${v} ${t("attSuffix")}`} color="linear-gradient(90deg,#071a0f,#27ae60)" currentUser={currentUser} onViewProfile={onViewProfile} />}
      </div>
    </div>
  );
}

// ─── EXPORT ───────────────────────────────────────────────────────────────────
function Export({ ctx }) {
  const { members, auctions, attendanceLogs, addToast } = ctx;
  const { t } = useLang();
  function downloadCSV(rows, filename, headers) {
    const csv=[headers.join(","),...rows.map(r=>headers.map(h=>JSON.stringify(r[h]||"")).join(","))].join("\n");
    const blob=new Blob([csv],{type:"text/csv"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download=filename;a.click();
    addToast(`${filename} ${t("fileDownloaded")}`,"green",t("exportLabel"));
  }
  // Per-member totals: how much each player has earned from attendance overall,
  // plus their current coin balance alongside it so it's easy to cross-check.
  function downloadAttendanceCoinsCSV() {
    const headers = ["Member","Class","TotalAttendanceCoins","CurrentCoinBalance"];
    const lines = [headers.join(",")];
    const csvRow = (vals) => vals.map(v => JSON.stringify(v===undefined||v===null?"":v)).join(",");
    let grandTotal = 0;
    [...members].sort((a,b)=>{
      const totalA=(a.attendLog||[]).reduce((s,e)=>s+(e.coins||0),0);
      const totalB=(b.attendLog||[]).reduce((s,e)=>s+(e.coins||0),0);
      return totalB-totalA;
    }).forEach(m=>{
      const total = (m.attendLog||[]).reduce((s,e)=>s+(e.coins||0),0);
      grandTotal += total;
      lines.push(csvRow([m.name,m.cls,total,m.coins]));
    });
    lines.push(csvRow(["","TOTAL (all members)",grandTotal,""]));
    const csv = lines.join("\n");
    const blob = new Blob([csv],{type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download="attendance_coins_per_member.csv"; a.click();
    addToast(`attendance_coins_per_member.csv ${t("fileDownloaded")}`,"green",t("exportLabel"));
  }
  const exports=[
    {title:t("exportTitle_coinRankings"),icon:<StatIcon src={COINS_ICON} size={32}/>,desc:t("exportDesc_coinRankings"),action:()=>downloadCSV([...members].sort((a,b)=>b.coins-a.coins).map((m,i)=>({Rank:i+1,Name:m.name,Class:m.cls,Coins:m.coins,Power:m.power})),"coin_rankings.csv",["Rank","Name","Class","Coins","Power"])},
    {title:t("exportTitle_attendanceCoins"),icon:<StatIcon src={COINS_ICON} size={32}/>,desc:t("exportDesc_attendanceCoins"),action:downloadAttendanceCoinsCSV},
    {title:t("exportTitle_attendanceLogs"),icon:<StatIcon src={ATTENDANCE_ICON} size={32}/>,desc:t("exportDesc_attendanceLogs"),action:()=>downloadCSV(attendanceLogs.map(l=>({Date:l.date,Event:l.event,Members:l.members,RecordedBy:l.recordedBy})),"attendance_logs.csv",["Date","Event","Members","RecordedBy"])},
    {title:t("exportTitle_auctionHistory"),icon:<StatIcon src={AUCTION_ICON} size={32}/>,desc:t("exportDesc_auctionHistory"),action:()=>downloadCSV(auctions.map(a=>({Name:a.name,Winner:a.topBidder||"None",FinalBid:a.currentBid,Status:a.status,TotalBids:(a.bids||[]).length,Rarity:a.rarity})),"auction_history.csv",["Name","Winner","FinalBid","Status","TotalBids","Rarity"])},
    {title:t("exportTitle_powerLeaderboard"),icon:"⚡",desc:t("exportDesc_powerLeaderboard"),action:()=>downloadCSV([...members].sort((a,b)=>b.power-a.power).map((m,i)=>({Rank:i+1,Name:m.name,Class:m.cls,Power:m.power,Attendance:m.attendance})),"power_leaderboard.csv",["Rank","Name","Class","Power","Attendance"])},
    {title:t("exportTitle_fullReport"),icon:<StatIcon src={WARRIORS_ICON} size={32}/>,desc:t("exportDesc_fullReport"),action:()=>downloadCSV(members.map(m=>({Name:m.name,Class:m.cls,Role:m.role,Coins:m.coins,Power:m.power,Attendance:m.attendance,AuctionWins:m.auctionWins,JoinDate:m.joinDate,Discord:m.discord||""})),"full_members.csv",["Name","Class","Role","Coins","Power","Attendance","AuctionWins","JoinDate","Discord"])},
  ];
  return (
    <div>
      <div className="card card-gold" style={{marginBottom:24}}>
        <div style={{fontFamily:"'Inter',sans-serif",fontWeight:800,fontSize:16,color:"var(--gold-light)",marginBottom:6}}>{t("dataExportCenter")}</div>
        <div style={{color:"var(--text-dim)",fontSize:13}}>{t("dataExportDesc")}</div>
      </div>
      <div className="grid-2">
        {exports.map((ex,i)=>(
          <div key={i} className="card" style={{display:"flex",gap:16,alignItems:"flex-start"}}>
            <div style={{fontSize:34,filter:"drop-shadow(0 0 6px rgba(201,151,42,0.3))"}}>{ex.icon}</div>
            <div style={{flex:1}}>
              <div style={{fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:14,color:"var(--text-bright)",marginBottom:4}}>{ex.title}</div>
              <div style={{fontSize:12,color:"var(--text-dim)",marginBottom:12}}>{ex.desc}</div>
              <button className="btn btn-gold btn-sm" onClick={ex.action}>{t("downloadCsvBtn")}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Renders the layered character card: rarity glow background, class
// portrait, the name banner, the ornate frame on top, and the awakening
// badge in the corner — composited as real stacked HTML/CSS layers rather
// than a flattened image, so it stays crisp at any size and the name text
// remains real, selectable text rather than baked into a picture.
function ProfileCard({ member, onClick, prestigeRank }) {
  const rarity = member.profileRarity || "uncommon";
  const rarityBg = PROFILE_RARITY_BG[rarity] || PROFILE_RARITY_BG.uncommon;
  // Mythic rarity swaps in the special-tier class art if it's been uploaded
  // for this class yet (see PROFILE_CLASS_PORTRAIT_MYTHIC above) — falls
  // back to the normal portrait otherwise, so a class without mythic art
  // yet (currently Volva) still shows something instead of a blank gap.
  const classPortrait = (rarity === "mythic" && PROFILE_CLASS_PORTRAIT_MYTHIC[member.cls])
    || PROFILE_CLASS_PORTRAIT[member.cls];
  const awakeningLevel = member.awakeningLevel || 0;
  const RIBBON_COLORS = { 1: "#c77dff", 2: "#f2cc60", 3: "#fe7e73" };
  const ribbonColor = prestigeRank ? (RIBBON_COLORS[prestigeRank] || "#dcdee1") : null;

  // Skeleton loading state — these images come from Supabase Storage on
  // every render (rarity background, class portrait, frame), so on a
  // slower connection there's a real gap before anything shows. Track
  // the base rarity image specifically (it's always present, unlike the
  // class portrait) and show a shimmering placeholder, shaped like the
  // real card, until at least that much has loaded — better than a
  // blank box or a layout jump once images pop in late.
  const [loaded, setLoaded] = useState(false);

  return (
    <motion.div
      layout
      layoutId={`profile-card-${member.id}`}
      transition={{duration:0.35, ease:[0.16,1,0.3,1]}}
      onClick={onClick}
      style={{
        position:"relative",width:"100%",aspectRatio:"1142/1875",borderRadius:"14px 14px 0 0",overflow:"hidden",containerType:"inline-size",
        cursor:onClick?"pointer":"default",
        background:!loaded?"linear-gradient(110deg, #1a1410 30%, #2a2118 50%, #1a1410 70%)":undefined,
        backgroundSize:!loaded?"200% 100%":undefined,
        animation:!loaded?"profileCardShimmer 1.6s ease-in-out infinite":undefined,
      }}
    >
      <img
        src={rarityBg} alt=""
        onLoad={()=>setLoaded(true)}
        style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:loaded?1:0,transition:"opacity 0.3s"}}
      />
      {classPortrait && (
        <img src={classPortrait} alt={member.cls} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:loaded?1:0,transition:"opacity 0.3s"}} />
      )}
      {/* Name banner sits beneath the frame so the frame's own border draws on top of it,
          matching the reference card where the frame overlaps the band's edges. */}
      <div style={{
        position:"absolute",left:"6%",right:"6%",top:"68%",
        aspectRatio:"414/90",
        backgroundImage:`url(${PROFILE_NAME_CONTAINER_URL})`,backgroundSize:"100% 100%",
        display:"flex",alignItems:"center",justifyContent:"center",
        opacity:loaded?1:0,transition:"opacity 0.3s",
      }}>
        <span style={{
          fontFamily:"'Spectral',serif",fontWeight:700,
          fontSize:"clamp(14px, 3.6cqw, 28px)",color:"var(--text-bright)",
          textShadow:"0 2px 4px rgba(0,0,0,0.6)",
        }}>{member.name}</span>
      </div>
      <img src={PROFILE_FRAME_URL} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",pointerEvents:"none",opacity:loaded?1:0,transition:"opacity 0.3s"}} />
      {ribbonColor && (
        <div style={{
          position:"absolute",top:"6%",left:0,zIndex:4,
          background:ribbonColor,color:"#1a1206",
          fontSize:"clamp(8px,2.6cqw,13px)",fontWeight:800,letterSpacing:0.5,
          padding:"4px 10px 4px 8px",borderRadius:"0 3px 3px 0",
          boxShadow:"-2px 2px 8px rgba(0,0,0,0.4)",
        }}>
          RANK {prestigeRank}
        </div>
      )}
      {awakeningLevel > 0 && (
        <div style={{
          position:"absolute",width:"18.8%",aspectRatio:"1/1",
          right:"15.7%",top:"5.6%",transform:"translate(50%,-50%)",
          backgroundImage:`url(${PROFILE_AWAKENING_BADGE_URL})`,backgroundSize:"100% 100%",
          display:"flex",alignItems:"center",justifyContent:"center",
        }}>
          <span style={{
            fontFamily:"'Spectral',serif",fontWeight:800,
            fontSize:"clamp(10px, 7cqw, 22px)",color:"#fff",
            textShadow:"0 2px 3px rgba(0,0,0,0.85), 0 0 4px rgba(0,0,0,0.6)",
          }}>{awakeningLevel}</span>
        </div>
      )}
    </motion.div>
  );
}

// ─── RANK 1 PROFILE VIDEO BACKDROP ────────────────────────────────────────────
// Plays a class-linked intro clip once, then switches to a looping clip.
// LAYOUT: the square (1:1) video is sized to the FULL height of the card
// (not a small centered slice of it) — the background image is scaled to
// that same height and stretched/cropped to fill the card's full width via
// object-fit:cover, so it extends the video's scene outward on both sides
// rather than the video shrinking down into a thin strip of background.
// Browsers block autoplay-with-sound, but these clips have no audio track
// (muted video), so autoplay works immediately with no unlock-on-click
// step needed — unlike the background music elsewhere in the app.
// Fallback height for the video's own "stage" inside the backdrop, used
// only until PlayerInfo has measured the Overview tab's real rendered
// height (see overviewHeight there) — matches rank1-hero-wrapper's
// minHeight, the size this was originally tuned to look right at.
const RANK1_HERO_HEIGHT = 640;
// How tall the fade seam is where the video stage blends into the solid
// black fill below it.
const RANK1_FADE_HEIGHT = 160;
function RankOneVideoBackdrop({ assets, stageHeight = RANK1_HERO_HEIGHT }) {
  const videoRef = useRef(null);
  const { phase, onEnded } = useIntroThenLoopVideo(videoRef, assets);

  // This outer div is sized to the ENTIRE outer .card (top:0/bottom:0),
  // which includes the sidebar+stats AND the events/points-history
  // section further down. It USED to stretch the video itself to that
  // same full height (video height:100% of this div) so the video kept
  // "bleeding through" no matter how tall that section grew — but that
  // meant paging through a member's Points History (or just switching
  // tabs) visibly resized/rescaled the video itself. Instead, the video
  // now plays inside a FIXED-height stage (stageHeight — the Overview
  // tab's own real rendered height, measured by PlayerInfo, since that's
  // the size that already looked right and shouldn't move), and anything
  // taller than that (i.e. only when Points History needs more room) is
  // solid black with a soft fade seam instead of the video stretching.
  return (
    <div style={{
      position:"absolute", top:0, left:0, right:0, bottom:0,
      overflow:"hidden", borderRadius:8,
      pointerEvents:"none", zIndex:0,
      background:"var(--bg-void)",
    }}>
      <div style={{
        position:"absolute", top:0, left:0, right:0, height:stageHeight,
        display:"flex", justifyContent:"center", alignItems:"flex-start",
        overflow:"hidden",
      }}>
        <img src={assets.bg} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}} />
        <video
          ref={videoRef}
          autoPlay muted playsInline
          loop={phase === "loop"}
          onEnded={onEnded}
          style={{
            position:"relative",
            top: assets.shiftY || 0,
            height:"100%", width:"auto", aspectRatio:"1/1",
            objectFit:"cover",
            // Per-class zoom/reframe — each class's source video was shot
            // with its own framing, so the character doesn't necessarily
            // fill a 1:1 crop the same way Archer's does. scale zooms in
            // (character reads larger). transformOrigin controls which edge
            // the zoom expands FROM — default "center top" means the zoom
            // grows downward from the top edge, keeping the head in frame
            // (the overflow that used to clip it happened because scale()
            // expands from the center by default, pushing the top out of
            // the overflow:hidden container by just as much as the bottom).
            // shiftY is a plain top offset (unaffected by scale/transform-
            // origin math) for closing/opening a gap between the video's
            // own top edge and the container's — negative pulls it up.
            // All default to no-op values so Archer (already correct) is
            // untouched.
            transform: `scale(${assets.scale || 1})`,
            transformOrigin: assets.focus || "center top",
          }}
        />
      </div>
      {/* Solid black fill for whatever extra height the card grows to
          below the fixed video stage (e.g. a long Points History page),
          instead of the video scaling to cover it. */}
      <div style={{position:"absolute", top:stageHeight, left:0, right:0, bottom:0, background:"var(--bg-void)"}} />
      {/* Fade seam blending the bottom of the video stage into that black
          fill, so the cutoff reads as intentional instead of an abrupt edge. */}
      <div style={{
        position:"absolute", top:stageHeight-RANK1_FADE_HEIGHT, left:0, right:0, height:RANK1_FADE_HEIGHT,
        background:"linear-gradient(to bottom, transparent 0%, var(--bg-void) 100%)",
      }} />
      {/* Vignette anchored to the CONTAINER's own edges (not the video's
          rendered box) — fades in from each side of the whole backdrop
          toward transparent in the middle. */}
      <div style={{
        position:"absolute", inset:0, zIndex:1,
        background:"linear-gradient(90deg, rgba(0,0,0,0.9) 0%, transparent 48%, transparent 52%, rgba(0,0,0,0.9) 100%)",
      }} />
    </div>
  );
}

// Same fixed-stage/black-fill/fade treatment as RankOneVideoBackdrop,
// applied to the static class-photo background used for top-10-by-Power
// members who don't have video assets yet — it was previously just a
// plain CSS `background` on the outer .card (backgroundSize:cover), which
// meant the same visual problem as the video: switching to Points History
// (or any content-height change) re-cropped/re-zoomed the image instead of
// leaving it alone. stageHeight is the same Overview-measured height
// PlayerInfo passes to the video backdrop, so both stay in sync.
function TopTenPowerBackdrop({ src, stageHeight = RANK1_HERO_HEIGHT }) {
  return (
    <div style={{
      position:"absolute", top:0, left:0, right:0, bottom:0,
      overflow:"hidden", borderRadius:8,
      pointerEvents:"none", zIndex:0,
      background:"var(--bg-void)",
    }}>
      <div style={{position:"absolute", top:0, left:0, right:0, height:stageHeight, overflow:"hidden"}}>
        <img src={src} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",objectPosition:"center"}} />
      </div>
      {/* Solid black fill + fade seam below the fixed stage — identical
          mechanism to RankOneVideoBackdrop, so a long Points History page
          doesn't stretch/re-crop the class photo either. */}
      <div style={{position:"absolute", top:stageHeight, left:0, right:0, bottom:0, background:"var(--bg-void)"}} />
      <div style={{
        position:"absolute", top:stageHeight-RANK1_FADE_HEIGHT, left:0, right:0, height:RANK1_FADE_HEIGHT,
        background:"linear-gradient(to bottom, transparent 0%, var(--bg-void) 100%)",
      }} />
      {/* Same darkening gradient the old composited `background` shorthand
          used, now a separate overlay spanning the whole card so it reads
          identically regardless of the stage/black-fill split. */}
      <div style={{
        position:"absolute", inset:0,
        background:"linear-gradient(180deg, rgba(10,8,6,0.5) 0%, rgba(10,8,6,0.8) 60%, rgba(10,8,6,0.95) 100%)",
      }} />
    </div>
  );
}

// Shared intro-then-loop playback logic, used by both the desktop
// backdrop and the mobile video band — factored out so the two don't
// duplicate the same effect/state wiring.
function useIntroThenLoopVideo(videoRef, assets) {
  const [phase, setPhase] = useState("intro");
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.src = phase === "intro" ? assets.intro : assets.loop;
    el.load();
    el.play().catch(() => {});
  }, [phase, assets, videoRef]);
  return { phase, onEnded: () => { if (phase === "intro") setPhase("loop"); } };
}

// Mobile-specific video band — a plain, full-width video filling its box
// (object-fit:cover, no separate background-image layering like the
// desktop version needs, since there's no "open gap beside the sidebar"
// composition to fill on a stacked mobile layout). Same intro-then-loop
// behavior, just laid out for a narrow vertical screen instead.
function RankOneMobileVideo({ assets }) {
  const videoRef = useRef(null);
  const { phase, onEnded } = useIntroThenLoopVideo(videoRef, assets);
  return (
    <video
      ref={videoRef}
      autoPlay muted playsInline
      loop={phase === "loop"}
      onEnded={onEnded}
      style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}
    />
  );
}

// "Notable roster" banner — used on the Player Info page for ranks 1-10
// across Power, Richest, and Active. Originally built just for Power's
// ranks 4-10 (steel-toned, distinct from that metric's own gold/purple/
// coral top-3 pill); extracted into its own component when the same
// treatment was extended to cover Richest and Active's entire top 10
// too, so the three call sites can't silently drift out of sync with
// each other. `tier` is whichever PRESTIGE_TIERS/RICHEST_TIERS/
// ACTIVE_TIERS (or their shared quieter fallback) entry already resolved
// for that rank — it already varies correctly per rank 1-10 on its own,
// so this component doesn't need its own rank-based color branching.
function RankTierBanner({ tier, rank, member, valueLabel, valueText }) {
  return (
    <div style={{
      position:"relative",overflow:"hidden",borderRadius:8,padding:"18px 22px",margin:"4px 0 16px",
      display:"flex",alignItems:"center",gap:18,
      background:`linear-gradient(90deg, rgba(10,8,6,0.35) 0%, rgba(10,8,6,0.88) 60%, rgba(10,8,6,0.96) 100%), url(${PROFILE_CLASS_BG[member.cls]})`,
      backgroundSize:"cover",backgroundPosition:"center",
      border:`1px solid ${tier.color}48`,
      boxShadow:`0 0 22px ${tier.glow}`,
    }}>
      <CornerBrackets size={14} thickness={1.5} inset={7} opacity={0.4}/>
      <div style={{
        width:56,height:56,borderRadius:"50%",flexShrink:0,
        background:`radial-gradient(circle, ${tier.color}40, rgba(20,18,16,0.9) 70%)`,
        border:`1px solid ${tier.color}66`,boxShadow:`0 0 14px ${tier.glow}`,
        display:"flex",alignItems:"center",justifyContent:"center",
      }}>
        <ClassIcon cls={member.cls} size={32} noShadow/>
      </div>
      <div style={{position:"relative",zIndex:1,flex:1,minWidth:0}}>
        <div style={{fontSize:9.5,letterSpacing:2.5,textTransform:"uppercase",color:`${tier.color}cc`,fontWeight:700,marginBottom:4}}>
          {CLAN_SEASON_LABEL} &middot; {tier.label || tier.title}
        </div>
        <div style={{fontFamily:"'Spectral',serif",fontSize:18,fontWeight:800,color:"var(--text-bright)",textShadow:`0 0 16px ${tier.glow}`,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
          {member.name}
        </div>
        <div style={{fontSize:11.5,color:"#a8a4a0",marginTop:3}}>{member.cls} &middot; {valueText}</div>
      </div>
      <div style={{flexShrink:0,textAlign:"center",paddingLeft:16,borderLeft:`1px solid ${tier.color}33`}}>
        <div style={{fontFamily:"'Spectral',serif",fontSize:24,fontWeight:800,color:"var(--text-bright)",lineHeight:1}}>#{rank}</div>
        <div style={{fontSize:8.5,letterSpacing:1.5,textTransform:"uppercase",color:"#8a8682",marginTop:3}}>{valueLabel}</div>
      </div>
    </div>
  );
}

// Richest tier (ranks 1-10) — a genuinely different silhouette from
// RankTierBanner, not a recolor of it: a hexagonal coin-seal medallion
// instead of a circle, and a warm ledger/sparkle backdrop (dot-grid +
// amber gradient) instead of the character-photo backdrop Power uses —
// this tier is about the hoard, not the warrior, so it doesn't reuse
// PROFILE_CLASS_BG at all.
function TreasuryBanner({ tier, rank, member, valueLabel, valueText }) {
  return (
    <div style={{
      position:"relative",overflow:"hidden",borderRadius:8,padding:"18px 22px",margin:"4px 0 16px",
      display:"flex",alignItems:"center",gap:20,
      background:`radial-gradient(circle at 8px 8px, ${tier.color}1f 1px, transparent 1.4px) 0 0/16px 16px, linear-gradient(115deg, #2b2007 0%, #3d2f10 45%, #2b2007 100%)`,
      border:`1px solid ${tier.accent}66`,
      boxShadow:`0 0 20px ${tier.glow}, inset 0 0 30px rgba(0,0,0,0.4)`,
    }}>
      <div style={{
        width:58,height:58,flexShrink:0,position:"relative",
        clipPath:"polygon(50% 0%,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%)",
        background:`linear-gradient(135deg,${tier.color},${tier.accent} 40%,#7a5f2e 100%)`,
        boxShadow:`0 0 16px ${tier.glow}`,
        display:"flex",alignItems:"center",justifyContent:"center",
      }}>
        <div style={{
          position:"absolute",inset:4,
          clipPath:"polygon(50% 0%,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%)",
          background:"linear-gradient(135deg,#4a3814,#2b2007)",
        }}/>
        <span style={{position:"relative",zIndex:1}}><StatIcon src={COINS_ICON} size={26}/></span>
      </div>
      <div style={{position:"relative",zIndex:1,flex:1,minWidth:0}}>
        <div style={{fontSize:9.5,letterSpacing:2.5,textTransform:"uppercase",color:tier.color,fontWeight:700,marginBottom:4}}>
          {CLAN_SEASON_LABEL} &middot; {tier.title}
        </div>
        <div style={{fontFamily:"'Spectral',serif",fontSize:18,fontWeight:800,color:tier.color,textShadow:`0 0 14px ${tier.glow}`,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
          {member.name}
        </div>
        <div style={{fontSize:11.5,color:tier.accent,marginTop:3,fontVariantNumeric:"tabular-nums"}}>{member.cls} &middot; {valueText}</div>
      </div>
      <div style={{flexShrink:0,textAlign:"center",paddingLeft:16,borderLeft:`1px solid ${tier.accent}55`}}>
        <div style={{fontFamily:"'Spectral',serif",fontSize:24,fontWeight:800,color:tier.color,lineHeight:1}}>#{rank}</div>
        <div style={{fontSize:8.5,letterSpacing:1.5,textTransform:"uppercase",color:tier.accent,marginTop:3}}>{valueLabel}</div>
      </div>
    </div>
  );
}

// Active tier (ranks 1-10) — shield medallion (angular, not circular),
// ember-green backdrop, plus a pulse row that's real data (this member's
// actual last 7 GMT+8 calendar days from attendLog via
// getLast7DaysPulseGmt8) rather than a decorative streak icon.
function BattleStreakBanner({ tier, rank, member, valueLabel, valueText }) {
  const pulse = getLast7DaysPulseGmt8(member.attendLog);
  return (
    <div style={{
      position:"relative",overflow:"hidden",borderRadius:8,padding:"16px 22px",margin:"4px 0 16px",
      background:`linear-gradient(135deg, #04140c 0%, #0a2417 55%, #04140c 100%)`,
      border:`1px solid ${tier.color}66`,
      boxShadow:`0 0 20px ${tier.glow}`,
    }}>
      <div style={{display:"flex",alignItems:"center",gap:18,marginBottom:12}}>
        <div style={{
          width:52,height:58,flexShrink:0,
          clipPath:"polygon(50% 0%,100% 18%,100% 60%,50% 100%,0% 60%,0% 18%)",
          background:`linear-gradient(160deg,${tier.color},${tier.accent} 55%,#0d2418 100%)`,
          boxShadow:`0 0 16px ${tier.glow}`,
          display:"flex",alignItems:"center",justifyContent:"center",
        }}>
          <ShieldIcon size={22} style={{color:"#0d2418"}}/>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:9.5,letterSpacing:2.5,textTransform:"uppercase",color:tier.color,fontWeight:700,marginBottom:4}}>
            {CLAN_SEASON_LABEL} &middot; {tier.title}
          </div>
          <div style={{fontFamily:"'Spectral',serif",fontSize:18,fontWeight:800,color:tier.color,textShadow:`0 0 14px ${tier.glow}`,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {member.name}
          </div>
          <div style={{fontSize:11.5,color:tier.accent,marginTop:3}}>{member.cls} &middot; {valueText}</div>
        </div>
        <div style={{flexShrink:0,textAlign:"center",paddingLeft:16,borderLeft:`1px solid ${tier.color}4d`}}>
          <div style={{fontFamily:"'Spectral',serif",fontSize:24,fontWeight:800,color:tier.color,lineHeight:1}}>#{rank}</div>
          <div style={{fontSize:8.5,letterSpacing:1.5,textTransform:"uppercase",color:tier.accent,marginTop:3}}>{valueLabel}</div>
        </div>
      </div>
      <div style={{display:"flex",gap:5,alignItems:"center",paddingTop:12,borderTop:`1px solid ${tier.color}26`}}>
        <span style={{fontSize:8.5,letterSpacing:1.5,textTransform:"uppercase",color:tier.accent,marginRight:8,flexShrink:0}}>Last 7 Days</span>
        {pulse.map((active,i) => (
          <div key={i} style={{
            width:16,height:16,borderRadius:3,flexShrink:0,
            background:active ? `linear-gradient(135deg,${tier.color},${tier.accent})` : "rgba(255,255,255,0.05)",
            border:active ? "none" : `1px solid ${tier.color}26`,
            boxShadow:active ? `0 0 6px ${tier.glow}` : "none",
          }}/>
        ))}
      </div>
    </div>
  );
}

// ─── POINTS HISTORY PANEL (PlayerInfo) ──────────────────────────────────────
// Same data/merge logic as the self-view "My Points History" tab in
// Attendance (buildPointsHistoryEntries), but scoped to whichever member's
// profile is being viewed rather than always currentUser — every member can
// see every other member's points history this way, same as the clan-wide
// Global Points Log already surfaces manual adjustments/bonuses for everyone.
// Fixed small page size (rather than the self-view's "last 40" cap) so this
// panel's height never grows with a member's log length — on the
// video-hero profile layout, an unbounded/tall table here was pushing on
// the shared row and resizing the video backdrop next to it.
const POINTS_HISTORY_PAGE_SIZE = 8;
function PointsHistoryPanel({ member, t }) {
  const [filter, setFilter] = useState("All");
  const [page, setPage] = useState(0);
  useEffect(() => { setFilter("All"); setPage(0); }, [member.id]);
  const rawEntries = buildPointsHistoryEntries(member, t);
  const PREFERRED_ORDER = ["Attendance","Major Events Bonus","ISB Veteran Bonus","Sindri Veteran Bonus","Iron Streak Bonus","Bonus Points","Elder Request","Admin Manual Add","Bid Placed","Outbid Refund","Auction Win","Weekly Decay","Balance Correction"];
  const presentTypes = PREFERRED_ORDER.filter(type=>rawEntries.some(e=>e.type===type));
  rawEntries.forEach(e=>{ if(!presentTypes.includes(e.type)) presentTypes.push(e.type); });
  const filteredEntries = filter==="All" ? rawEntries : rawEntries.filter(e=>e.type===filter);
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / POINTS_HISTORY_PAGE_SIZE));
  const safePage = Math.min(page, totalPages-1);
  const pagedEntries = filteredEntries.slice(safePage*POINTS_HISTORY_PAGE_SIZE, (safePage+1)*POINTS_HISTORY_PAGE_SIZE);
  return (
    <div style={{
      background:"rgba(10,8,6,0.82)",
      border:"1px solid var(--border)",
      borderRadius:4,padding:"18px 20px",
    }}>
      <div style={{fontSize:10,color:"var(--text-dim)",letterSpacing:1.5,textTransform:"uppercase",fontWeight:700,marginBottom:4}}>{t("adminPointsHistoryTitle")}</div>
      <div style={{fontSize:10.5,color:"var(--text-dim)",marginBottom:14}}>{t("adminPointsHistoryDesc")}</div>
      {presentTypes.length>0 && (
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
          {["All",...presentTypes].map(filterType=>(
            <button key={filterType} className={`btn btn-sm ${filter===filterType?"btn-gold":"btn-outline"}`} onClick={()=>{setFilter(filterType);setPage(0);}}>{filterType}</button>
          ))}
        </div>
      )}
      {rawEntries.length===0 ? (
        <div style={{fontSize:12,color:"var(--text-dim)"}}>{t("noPointsHistory")}</div>
      ) : filteredEntries.length===0 ? (
        <div style={{fontSize:12,color:"var(--text-dim)"}}>{t("noEntriesFilter")}</div>
      ) : (
        <>
          <div className="table-wrap attendance-table-view">
            <table className="table-stack">
              <thead><tr><th>{t("colDateTime")}</th><th>{t("colType")}</th><th>{t("colDetails")}</th><th>{t("colCoins")}</th><th>{t("colBalance")}</th></tr></thead>
              <tbody>
                {pagedEntries.map((e,i)=>(
                  <tr key={i}>
                    <td data-label="Date & Time" style={{fontWeight:500,whiteSpace:"nowrap"}}>{formatLogDateTime(e)}</td>
                    <td data-label="Type"><span className={`badge ${pointsHistoryBadgeClass(e)}`}>{typeLabel(e.type,t)}</span></td>
                    <td data-label="Details" style={{fontFamily:"'Inter',sans-serif",fontWeight:600}}>{e.details}</td>
                    <td data-label="Coins" style={{fontFamily:"'Inter',sans-serif",fontWeight:800,color:e.coins>=0?"var(--gold-light)":"#e07070"}}><span style={{display:"inline-flex",alignItems:"center",gap:4}}><StatIcon src={COINS_ICON} size={18}/>{e.coins>0?`+${e.coins}`:e.coins}</span></td>
                    <td data-label="Balance" style={{fontFamily:"'Inter',sans-serif",fontWeight:700,color:"var(--text-mid)"}}><span style={{display:"inline-flex",alignItems:"center",gap:4}}><StatIcon src={COINS_ICON} size={16}/>{fmt(e.balanceAfter)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="attendance-card-view">
            {pagedEntries.map((e,i)=>(
              <div key={`card-${i}`} className="dash-subcard" style={{marginBottom:8,padding:"12px 14px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8,marginBottom:6}}>
                  <span className={`badge ${pointsHistoryBadgeClass(e)}`}>{typeLabel(e.type,t)}</span>
                  <span style={{fontSize:10,color:"var(--text-dim)",whiteSpace:"nowrap"}}>{formatLogDateTime(e)}</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                  <span style={{fontFamily:"'Inter',sans-serif",fontWeight:600,fontSize:12,color:"var(--text-bright)",minWidth:0,overflow:"hidden",textOverflow:"ellipsis"}}>{e.details}</span>
                  <span style={{fontFamily:"'Inter',sans-serif",fontWeight:800,fontSize:13,color:e.coins>=0?"var(--gold-light)":"#e07070",flexShrink:0,display:"inline-flex",alignItems:"center",gap:4}}><StatIcon src={COINS_ICON} size={16}/>{e.coins>0?`+${e.coins}`:e.coins}</span>
                </div>
                <div style={{display:"flex",justifyContent:"flex-end",marginTop:4}}>
                  <span style={{fontSize:10,color:"var(--text-dim)"}}>{t("colBalance")}: <span style={{color:"var(--text-mid)",fontWeight:700}}>{fmt(e.balanceAfter)}</span></span>
                </div>
              </div>
            ))}
          </div>
          {totalPages>1 && (
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 4px 0",gap:8}}>
              <span style={{fontSize:10,color:"var(--text-dim)",fontFamily:"'Inter',sans-serif"}}>
                {safePage*POINTS_HISTORY_PAGE_SIZE+1}&ndash;{Math.min((safePage+1)*POINTS_HISTORY_PAGE_SIZE,filteredEntries.length)} {t("ofPagination")} {filteredEntries.length}
              </span>
              <div style={{display:"flex",gap:6}}>
                <button className="btn btn-outline btn-sm" disabled={safePage===0} onClick={()=>setPage(p=>p-1)} style={{opacity:safePage===0?0.4:1,fontSize:10,padding:"3px 10px"}}>{t("prevPage")}</button>
                <button className="btn btn-outline btn-sm" disabled={safePage>=totalPages-1} onClick={()=>setPage(p=>p+1)} style={{opacity:safePage>=totalPages-1?0.4:1,fontSize:10,padding:"3px 10px"}}>{t("nextPage")}</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── PLAYER INFO PAGE ───────────────────────────────────────────────────────────
function PlayerInfo({ member, members, onBack }) {
  const { t } = useLang();
  // Second tab for Points History — kept as a separate tab (instead of
  // appending the panel straight onto the page) so a member with a long
  // log doesn't turn this page into an endless scroll. Any viewer can
  // switch to it for any member, same as Global Points Log already being
  // visible clan-wide.
  const [profileTab, setProfileTab] = useState("overview");
  // The video backdrop must stay pinned at whatever height the Overview
  // tab naturally renders at (that's the size that was already "perfect"),
  // rather than resizing whenever Points History's own content is a
  // different height. Measured directly off the real DOM instead of a
  // guessed constant, since a hardcoded number doesn't necessarily match
  // this member's actual Overview content height. Only updated while
  // Overview is showing; switching to Points History leaves it at its
  // last-measured value so the video never moves because of that tab.
  const heroCardRef = useRef(null);
  const [overviewHeight, setOverviewHeight] = useState(RANK1_HERO_HEIGHT);
  useLayoutEffect(() => {
    if (profileTab !== "overview") return;
    const el = heroCardRef.current;
    if (!el) return;
    setOverviewHeight(el.getBoundingClientRect().height);
  }, [profileTab, member.id]);
  const now = Date.now();
  const [monthStart] = getMonthBoundaryGmt8(now, 0);
  const eventMaxThisMonth = getEventMaxForMonth(...getMonthBoundaryGmt8(now, 0));

  const activityStatus = getActivityStatus(member.attendLog, now);
  const lastActivityTs = getLastActivityTs(member.attendLog);
  const daysSinceActivity = lastActivityTs ? Math.floor((now - lastActivityTs) / (24*60*60*1000)) : null;

  // Rankings across all three leaderboards, computed the same way the
  // actual Leaderboard page does (plain descending sort, no tiebreaker),
  // so the rank shown here always matches what that page would show.
  const totalMembers = members.length;
  const byPower = [...members].sort((a,b)=>b.power-a.power);
  const byCoins = [...members].sort((a,b)=>b.coins-a.coins);
  const byAttend = [...members].sort((a,b)=>b.attendance-a.attendance);
  const powerRank = byPower.findIndex(m=>m.id===member.id)+1;
  const coinsRank = byCoins.findIndex(m=>m.id===member.id)+1;
  const attendRank = byAttend.findIndex(m=>m.id===member.id)+1;
  // Top 10 by Power get their class's scene image as the background of
  // the profile card itself (not the whole page) — used below where that
  // card is rendered.
  const isTop10Power = powerRank >= 1 && powerRank <= 10 && !!PROFILE_CLASS_BG[member.cls];
  // The clan's top 3 by Power get the video backdrop (variable name kept
  // as "rank1VideoAssets" even though it now covers ranks 1-3, since it's
  // referenced throughout this component and renaming everywhere risked
  // introducing a mistake for no functional benefit) — only if their
  // class has video assets uploaded (currently just Archer; add
  // additional classes to PROFILE_RANK1_VIDEO as their assets come in —
  // backgrounds are already uploaded for all 6, but intro/looping videos
  // aren't yet). Every other rank/class renders this page exactly as
  // before. Rank 3 used to be excluded here entirely (only 1/2 checked),
  // which is why #3 never got this treatment even for Archer.
  const rank1VideoAssets = (powerRank === 1 || powerRank === 2 || powerRank === 3) ? PROFILE_RANK1_VIDEO[member.cls] : null;
  // Resolved per-rank (not just per-class) so two same-class players at
  // rank 1 and rank 2 get their own distinct text instead of identical
  // copy just because they share a class/video.
  const rank1Tagline = CLASS_TAGLINES[member.cls]?.[powerRank];
  const rank1FlavorLine = CLASS_FLAVOR_LINES[member.cls]?.[powerRank];
  // (rankings array moved below, after the prestige tier objects it now references)

  // Prestige tier — matches the podium's gold/silver/bronze treatment,
  // based specifically on Power rank (not Richest or Active), so the
  // Player Info page's special treatment always lines up with whoever
  // is actually standing on the Leaderboard podium.
  // Gradient stops use the SAME dark-dominant proportions measured from
  // the actual rarity background images (~70% dark, 20% mid, 10% bright
  // across the full image) as the podium's metallic ring, so the aura
  // reads as a moody radiant glow rather than a wash of bright color.
  const PRESTIGE_TIERS = {
    1: { name: "mythical", color: "#c77dff", glow: "rgba(199,125,255,0.4)", gradient: ["#d65cf0", "#6d2d7b", "#211022"], label: "The Clan's Strongest" },
    2: { name: "gold",     color: "#f2cc60", glow: "rgba(242,204,96,0.3)",  gradient: ["#f3e79d", "#725f38", "#2b2215"], label: "The Clan's Champion" },
    3: { name: "epic",     color: "#fe7e73", glow: "rgba(254,126,115,0.3)", gradient: ["#fca699", "#99463f", "#311714"], label: "The Clan's Vanguard" },
  };
  // Ranks 4-10 get the same silver tone as the podium's honorable
  // mentions ring, so clicking through from there to a Player Info page
  // shows a consistent (if quieter) version of the same treatment,
  // instead of no prestige styling at all.
  const silverTier = { name: "silver", color: "#dcdee1", glow: "rgba(220,222,225,0.25)", gradient: ["#dcdee1", "#6e7073", "#1c1c1c"], label: "Among the Mightiest in the Clan" };
  const prestige = PRESTIGE_TIERS[powerRank] || (powerRank >= 4 && powerRank <= 10 ? silverTier : null);
  // Per-rank tagline colors for the video-hero caption (used below). This
  // used to be a plain rank===2-vs-everything-else binary, which was fine
  // when only ranks 1-2 ever reached this code path — now that rank 3 also
  // gets the video treatment, it needs its own distinct color instead of
  // silently falling into whichever branch used to catch "not rank 2".
  // Rank 1 deliberately stays flat gold rather than its purple prestige
  // color — that was an already-approved, already-shipped choice (see the
  // comment further below where this is used), not something to revisit
  // here. Rank 2's exact values are also unchanged. Rank 3 is the only
  // genuinely new entry, given its own coral identity matching its
  // PRESTIGE_TIERS color instead of inheriting rank 1's look.
  const rank1CaptionColors = {
    1: { eyebrow: "rgba(200,146,42,0.7)",   title: "#f2cc60", glow: "0 0 20px rgba(242,204,96,0.35)" },
    2: { eyebrow: "rgba(255,200,80,0.85)",  title: "#ffd454", glow: "0 0 24px rgba(255,200,80,0.55), 0 0 8px rgba(255,220,140,0.4)" },
    3: { eyebrow: "rgba(254,126,115,0.8)",  title: "#fe9a8f", glow: "0 0 24px rgba(254,126,115,0.5), 0 0 8px rgba(252,166,153,0.4)" },
  }[powerRank] || { eyebrow: "rgba(200,146,42,0.7)", title: "#f2cc60", glow: "0 0 20px rgba(242,204,96,0.35)" };

  // Richest and Most Active prestige tiers — same rank cutoffs as Power
  // (1-3 each get a unique look, 4-10 share one quieter tier), but with
  // their own color families and plaque titles, since they're celebrating
  // a different kind of achievement, not a weaker version of Power's.
  const RICHEST_TIERS = {
    1: { title: "The Clan's Treasurer", color: "#f3e79d", accent: "#cba968", glow: "rgba(243,231,157,0.35)" },
    2: { title: "The Clan's Big Saver", color: "#e8d488", accent: "#b89850", glow: "rgba(232,212,136,0.3)" },
    3: { title: "The Clan's Coin Hoarder", color: "#d4bc78", accent: "#a8854a", glow: "rgba(212,188,120,0.28)" },
  };
  const richestSilver = { title: "Among the Wealthiest in the Clan", color: "#dcdee1", accent: "#9a9da0", glow: "rgba(220,222,225,0.2)" };
  const richestTier = RICHEST_TIERS[coinsRank] || (coinsRank >= 4 && coinsRank <= 10 ? richestSilver : null);

  const ACTIVE_TIERS = {
    1: { title: "The Clan's Grinder", color: "#7fe8ab", accent: "#3a8f5c", glow: "rgba(127,232,171,0.35)" },
    2: { title: "The Clan's Night Owl", color: "#6fd99c", accent: "#357f53", glow: "rgba(111,217,156,0.3)" },
    3: { title: "The Clan's Regular", color: "#5fc98d", accent: "#2f704a", glow: "rgba(95,201,141,0.28)" },
  };
  const activeSilver = { title: "Among the Most Active in the Clan", color: "#dcdee1", accent: "#9a9da0", glow: "rgba(220,222,225,0.2)" };
  const activeTier = ACTIVE_TIERS[attendRank] || (attendRank >= 4 && attendRank <= 10 ? activeSilver : null);

  // Sidebar rank badges (Power/Richest/Active) pick up their tier's color
  // ONLY for ranks 1-10 — matching the same cutoff used for the top
  // banners and the podium/honorable-mentions row, so this is consistent
  // with every other prestige surface rather than a fourth, looser rule.
  // Outside the top 10, the badge falls back to the original plain gold
  // look (color: null signals that to the renderer below).
  const rankings = [
    { label: "Power",  rank: powerRank,  color: prestige?.color || null },
    { label: "Richest", rank: coinsRank, color: richestTier?.color || null },
    { label: "Active", rank: attendRank, color: activeTier?.color || null },
  ];
  // Dark/mid tones dominate most of the radius (matching the real images'
  // proportions), with the bright highlight confined to a small core
  // instead of bleeding outward as a bright wash.
  const prestigeGlowCss = prestige
    ? `radial-gradient(circle, ${prestige.gradient[0]}40 0%, ${prestige.gradient[1]}35 25%, ${prestige.gradient[2]}25 60%, transparent 80%)`
    : null;

  const eventStats = [
    { id:"ISB", label:"Server Battle", icon:ShieldIcon, desc:"Server Battle participation this month." },
    { id:"STI", label:"Sindris",       icon:ColumnIcon, desc:"Sindris participation this month." },
    { id:"CS",  label:"Sanctuary",     icon:CrownIcon,  desc:"Sanctuary participation this month." },
    { id:"CA",  label:"Annihilation",  icon:SwordsIcon, desc:"Annihilation participation this month." },
  ].map(s => ({
    ...s,
    attended: countEventAttendance(member.attendLog, s.id, monthStart),
    max: eventMaxThisMonth[s.id] || 0,
  }));

  // Most recent attendance check-ins, newest first, for the activity log
  // beneath the event progress bars.
  const recentActivity = [...(member.attendLog || [])]
    .sort((a,b) => (b.ts||0) - (a.ts||0))
    .slice(0, 6);

  const powerGains = getWeeklyPowerGains(member.powerLog, now);
  const eventActivity = getWeeklyEventActivity(member.attendLog, now);
  const periodLabels = ["3 wks ago", "2 wks ago", "Last week", "This week"];

  const maxGain = Math.max(1, ...powerGains.filter(g => g !== null).map(g => Math.abs(g)));
  const maxActivity = Math.max(1, ...eventActivity);

  const statusConfig = {
    battle_ready: { label: "Battle-Ready", color: "#58d68d", bg: "rgba(88,214,141,0.12)" },
    present:      { label: "Present",      color: "var(--gold-bright)", bg: "rgba(242,204,96,0.1)" },
    absent:       { label: "Absent",       color: "var(--text-dim)", bg: "rgba(110,88,64,0.1)" },
  }[activityStatus];

  const profileTabBar = (
    <div style={{display:"flex",gap:6,marginBottom:12}}>
      <button className={`btn btn-sm ${profileTab==="overview"?"btn-gold":"btn-outline"}`} onClick={()=>setProfileTab("overview")}>Overview</button>
      <button className={`btn btn-sm ${profileTab==="pointsHistory"?"btn-gold":"btn-outline"}`} onClick={()=>setProfileTab("pointsHistory")}>{t("adminPointsHistoryTitle")}</button>
    </div>
  );

  return (
    <div style={{position:"relative",paddingTop:prestige?16:0}}>
      {prestige && (
        <div style={{
          position:"absolute",top:0,left:0,right:0,height:4,borderRadius:2,
          background:`linear-gradient(90deg, transparent, ${prestige.color}, transparent)`,
          boxShadow:`0 0 16px ${prestige.glow}`,
        }} />
      )}
      {/* When there's no video backdrop, the rank pills sit above the card
          as before. With the video backdrop, they move inside the card
          (rendered further below, layered on top of the video) so they
          read as part of the same scene instead of floating over plain
          page background above it — matching the reference layout. */}
      {/* Ranks 4-10 by Power get the "notable roster" banner instead of
          the plain pill below — a steel-toned strip using that class's
          real uploaded background still (PROFILE_CLASS_BG, all 6 classes
          already have one), corner brackets matching the app's established
          ornament language, and a rank badge. Deliberately not gold/purple/
          coral (those stay exclusive to ranks 1-3) and deliberately not the
          video hero (static image, no autoplay, no card reflow) — a real
          middle tier, not a smaller copy of either neighbor.
          Power's ranks 1-3 used to fall back to a plain pill here (no
          corner brackets, no backdrop) whenever video assets weren't
          available for that class — meaning 1-3 looked LESS decorated
          than 4-10 whenever a class's video hadn't been uploaded yet,
          backwards from what rank should imply. Now ranks 1-3 use the
          exact same RankTierBanner as 4-10 (just with their own
          mythical/gold/epic color from PRESTIGE_TIERS instead of silver),
          matching how Richest/Active already treat their entire top 10
          uniformly.
          These banners are ALWAYS rendered here — outside the video-hero
          card entirely, in plain page flow — regardless of whether this
          member also has rank1VideoAssets. They used to ALSO be
          duplicated a second time inside the video wrapper below (see
          rank1-hero-wrapper), sized to stack vertically inside a fixed
          760px-tall box; a member who was top-10 in more than one of
          Power/Richest/Active could end up with 2-3 tall banner cards
          stacked inside a box that didn't grow to fit them, breaking the
          layout. Rendering them exactly once, here, sidesteps that
          entirely — nothing below needs to reserve space for a variable
          number of banners anymore. */}
      {prestige && (
        <RankTierBanner tier={prestige} rank={powerRank} member={member} valueLabel="Power" valueText={`${fmt(member.power)} Power`} />
      )}
      {richestTier && (
        <TreasuryBanner tier={richestTier} rank={coinsRank} member={member} valueLabel="Coins" valueText={`${fmt(member.coins)} Coins`} />
      )}
      {activeTier && (
        <BattleStreakBanner tier={activeTier} rank={attendRank} member={member} valueLabel="Events" valueText={`${member.attendance} Events`} />
      )}
      <button className="btn btn-outline btn-sm" style={{marginBottom:16}} onClick={onBack}>Back</button>

      <div ref={heroCardRef} className="card" style={{
        padding:24, marginBottom:20, position:"relative", overflow:"hidden",
        background: rank1VideoAssets ? "rgba(10,8,6,0.35)" : undefined,
        backgroundSize:"cover", backgroundPosition:"center",
      }}>
        {/* Mounted at the OUTER card level (not scoped to just the hero
            area) so the backdrop genuinely sits behind the entire card,
            including the events/recent-activity row further down — this
            is the look that was actually wanted; an earlier attempt
            scoped it to just the hero portion to stop it "bleeding
            through" the events cards, but that bleed-through was the
            intended effect, not a bug, so the cards below now need a
            properly opaque background instead (handled where they're
            defined) rather than the backdrop being held back.
            Hidden below 700px via .rank1-desktop-backdrop — the
            horizontal "open gap beside the sidebar" composition this
            relies on doesn't exist once player-info-layout stacks to a
            single column, so forcing it there just clips/distorts the
            video uselessly. A separate .rank1-mobile-video band (below)
            handles narrow screens instead. */}
        {rank1VideoAssets && (
          <div className="rank1-desktop-backdrop">
            <RankOneVideoBackdrop assets={rank1VideoAssets} stageHeight={overviewHeight} />
          </div>
        )}
        {/* Same fixed-stage treatment for ranks 4-10 (or 1-3 without video
            assets yet), who get the static class photo instead of a video —
            used to be a plain CSS background on this card (backgroundSize:
            cover), which re-cropped/zoomed the photo any time the card's
            height changed (e.g. switching to Points History). */}
        {isTop10Power && !rank1VideoAssets && (
          <TopTenPowerBackdrop src={PROFILE_CLASS_BG[member.cls]} stageHeight={overviewHeight} />
        )}
        {/* Mobile-only: a plain, full-width video band sitting above the
            normal stacked layout, instead of trying to force the
            desktop's "video behind a horizontal gap" composition into a
            vertical phone screen. Plays the same intro-then-loop video,
            just laid out for a narrow viewport. */}
        {rank1VideoAssets && (
          <div className="rank1-mobile-video" style={{position:"relative",width:"100%",aspectRatio:"4/5",borderRadius:8,overflow:"hidden",marginBottom:16,background:"var(--bg-void)"}}>
            <RankOneMobileVideo assets={rank1VideoAssets} />
          </div>
        )}
        {/* Simpler mobile counterpart to .rank1-video-caption (which is
            positioned for the wide desktop layout and hidden below
            700px) — same text, same per-rank gold treatment, just
            centered under the mobile video band instead of floating
            beside the sidebar. */}
        {rank1VideoAssets && rank1Tagline && (
          <div className="rank1-mobile-caption" style={{textAlign:"center",marginBottom:20}}>
            {/* Same removal as the desktop caption — this eyebrow duplicated
                what the RankTierBanner (rendered further below on mobile
                too) already shows in its own eyebrow. */}
            <div style={{
              fontFamily:"'Spectral',serif",fontSize:22,fontWeight:800,lineHeight:1.15,marginBottom:rank1FlavorLine?10:0,
              color:rank1CaptionColors.title,
              textShadow:rank1CaptionColors.glow,
            }}>
              {rank1Tagline}
            </div>
            {rank1FlavorLine && (
              <div style={{fontSize:12,color:"#c9bda8",lineHeight:1.6,fontStyle:"italic",maxWidth:320,margin:"0 auto"}}>
                {rank1FlavorLine}
              </div>
            )}
          </div>
        )}
        <div className="rank1-hero-wrapper" style={{position:"relative", minHeight: rank1VideoAssets ? RANK1_HERO_HEIGHT : undefined}}>
        {rank1VideoAssets && rank1Tagline && (
          <div className="rank1-video-caption" style={{
            // Back to the original absolute positioning — the banners
            // that used to sit inside this same wrapper (which is what
            // required switching this to normal flow for a while) have
            // been moved out entirely, so this is once again the only
            // thing inside .rank1-hero-wrapper alongside the video, same
            // as before any of that banner work happened.
            position:"absolute", zIndex:1, left:"calc(220px + 24px + 24px - 15px)", right:24, top:"9%",
            maxWidth:280,
          }}>
            {/* Rank 1's tagline stays gold regardless of its purple
                prestige color (#c77dff) — that's the look already
                approved and shipped, not something to change here. Rank
                2 gets a richer, more saturated gold than the original
                flat #f2cc60, leaning into "make it more gold-themed" for
                that rank specifically without touching rank 1's look.
                Rank 3 (new) gets its own coral identity matching its
                PRESTIGE_TIERS color — see rank1CaptionColors above. */}
            {/* The "Season N · [tier label]" eyebrow that used to sit here
                is gone — it's exactly the same text the RankTierBanner
                above now already shows in its own eyebrow, and having
                both visible at once (which never happened when this was
                the lone pill row) was pure duplication. */}
            <div style={{
              fontFamily:"'Spectral',serif",fontSize:28,fontWeight:800,lineHeight:1.15,
              color:rank1CaptionColors.title,
              textShadow:rank1CaptionColors.glow,
            }}>
              {rank1Tagline}
            </div>
            {/* Sits directly below the tagline via normal margin flow —
                previously this was a second, independently-positioned
                absolute block guessed at top:58%, which landed much
                further down the card than intended (the title and this
                line are meant to read as one continuous block, not two
                separate floating pieces). */}
            {rank1FlavorLine && (
              <div style={{fontSize:13,color:"#c9bda8",lineHeight:1.6,fontStyle:"italic",marginTop:14}}>
                {rank1FlavorLine}
              </div>
            )}
          </div>
        )}
        <div className="player-info-layout" style={{position:"relative",zIndex:1,justifyContent: rank1VideoAssets ? "space-between" : undefined}}>
          <div className="player-info-sidebar" style={{...(rank1VideoAssets ? {order:1} : {}), position:"relative"}}>
            {/* ROOT CAUSE FIX: the previous approach used a radial-gradient
                background on a padded/negative-margined box — that box
                still has a hard rectangular edge, and CSS radial-gradient
                falloff doesn't reliably reach true zero before a
                non-circular box's corners/edges, so a faint but visible
                seam remained no matter how the padding was tuned. A
                blurred, oversized glow element behind the content has no
                edge geometry to clip against — blur() produces a
                genuinely gradual fade with nothing for the eye to catch
                on. Only applied in the video case, where the outer card's
                overflow:hidden (needed for the video) was clipping the
                old approach most visibly; the non-video case keeps the
                original radial-gradient treatment since it isn't sitting
                inside an overflow:hidden ancestor. */}
            {prestige && rank1VideoAssets && (
              <div style={{
                position:"absolute", top:"-15%", left:"-25%", right:"-25%", bottom:"-15%",
                background:`radial-gradient(circle, ${prestige.gradient[0]}55 0%, ${prestige.gradient[2]}30 50%, transparent 75%)`,
                filter:"blur(40px)",
                zIndex:0, pointerEvents:"none",
              }} />
            )}
            <div style={{
              position:"relative", zIndex:1,
              borderRadius:24,
              padding: prestige ? (rank1VideoAssets ? 0 : 24) : 0,
              margin: prestige ? (rank1VideoAssets ? 0 : -24) : 0,
              background: rank1VideoAssets ? "none" : (prestigeGlowCss || "none"),
            }}>
              <ProfileCard member={member} prestigeRank={powerRank <= 3 ? powerRank : null} />
              <div style={{
                background:"var(--bg-card)",
                border:prestige?`1px solid ${prestige.gradient[1]}`:"1px solid var(--border)",
                borderTop:"none",borderRadius:"0 0 8px 8px",padding:"20px 16px",textAlign:"center",
              }}>
                <div style={{fontFamily:"'Spectral',serif",fontSize:13,color:"var(--text-mid)",letterSpacing:1,marginBottom:14}}>{member.cls}</div>

                <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:7,marginBottom:16}}>
                  <PowerIcon size={18} />
                  <span style={{
                  fontFamily:"'Spectral',serif",fontWeight:800,fontSize:26,
                  color:"var(--gold-bright)",
                  textShadow:prestige?`0 0 16px ${prestige.glow}`:"0 0 12px rgba(242,204,96,0.35)",
                }}>{fmt(member.power)}</span>
              </div>

              <div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:14,flexWrap:"wrap"}}>
                {rankings.map(r => (
                  <div key={r.label} style={{
                    display:"flex",flexDirection:"column",alignItems:"center",gap:2,
                    padding:"6px 9px",borderRadius:3,
                    background:r.color ? `${r.color}1a` : "linear-gradient(135deg, rgba(242,204,96,0.1), rgba(124,84,15,0.06))",
                    border:r.color ? `1px solid ${r.color}66` : "1px solid rgba(201,151,42,0.3)",
                  }}>
                    <span style={{fontFamily:"'Spectral',serif",fontWeight:800,fontSize:14,color:r.color || "var(--gold-bright)"}}>#{r.rank}</span>
                    <span style={{fontSize:8,color:"var(--text-dim)",letterSpacing:0.5,textTransform:"uppercase",fontWeight:700}}>{r.label}</span>
                  </div>
                ))}
              </div>

              <div style={{fontSize:11,color:"var(--text-dim)",borderTop:"1px solid var(--border)",paddingTop:12,display:"flex",alignItems:"center",justifyContent:"center",gap:8,flexWrap:"wrap"}}>
                <span style={{display:"inline-flex",alignItems:"center",gap:4}}>
                  <StatIcon src={COINS_ICON} size={13} />
                  <span style={{fontFamily:"'Spectral',serif",fontWeight:700,color:"var(--text-mid)"}}>{fmt(member.coins)}</span>
                </span>
                <span style={{color:"var(--border)"}}>&middot;</span>
                <span>
                  <span style={{color:statusConfig.color,fontWeight:700}}>{statusConfig.label}</span>
                  {daysSinceActivity !== null && ` \u00b7 ${daysSinceActivity === 0 ? "active today" : `seen ${daysSinceActivity}d ago`}`}
                </span>
              </div>
            </div>
          </div>
          </div>

          {!rank1VideoAssets && (
            <div className="player-info-main">
              {profileTabBar}
              {profileTab==="pointsHistory" ? (
                <PointsHistoryPanel member={member} t={t} />
              ) : (
                <>
                  <div style={{
                    background: prestige?`${prestige.gradient[2]}30`:"rgba(255,255,255,0.02)",
                    border:prestige?`1px solid ${prestige.gradient[1]}50`:"1px solid var(--border)",
                    borderRadius:4,padding:"18px 20px",
                  }}>
                    <div style={{fontSize:10,color:"var(--text-dim)",letterSpacing:1.5,textTransform:"uppercase",fontWeight:700,marginBottom:16}}>This Month's Events</div>
                    <div style={{display:"flex",flexDirection:"column",gap:14}}>
                      {eventStats.map(s => (
                        <div key={s.id} style={{display:"flex",alignItems:"center",gap:12}}>
                          <div style={{color:"var(--gold)",flexShrink:0,width:16}}><s.icon size={15} /></div>
                          <div style={{width:72,fontSize:10,color:"var(--text-dim)",flexShrink:0,lineHeight:1.2}}>{s.label}</div>
                          <div style={{flex:1,height:8,background:"var(--border)",borderRadius:4,overflow:"hidden",minWidth:30}}>
                            <div style={{
                              width:`${Math.min(100,(s.attended/Math.max(1,s.max))*100)}%`,height:"100%",
                              background:"linear-gradient(90deg, var(--gold-dim), var(--gold-bright))",
                            }}/>
                          </div>
                          <div style={{width:40,fontSize:11,fontWeight:800,color:"var(--text-bright)",textAlign:"right",flexShrink:0}}>{s.attended}/{s.max}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{
                    background: prestige?`${prestige.gradient[2]}30`:"rgba(255,255,255,0.02)",
                    border:prestige?`1px solid ${prestige.gradient[1]}50`:"1px solid var(--border)",
                    borderRadius:4,padding:"18px 20px",marginTop:16,
                  }}>
                    <div style={{fontSize:10,color:"var(--text-dim)",letterSpacing:1.5,textTransform:"uppercase",fontWeight:700,marginBottom:14}}>Recent Activity</div>
                    {recentActivity.length === 0 ? (
                      <div style={{fontSize:12,color:"var(--text-dim)"}}>No attendance recorded yet.</div>
                    ) : (
                      <div style={{display:"flex",flexDirection:"column",gap:10}}>
                        {recentActivity.map((entry, i) => (
                          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:10,paddingBottom:8,borderBottom:i<recentActivity.length-1?"1px solid var(--border)":"none"}}>
                            <div>
                              <div style={{fontSize:12,color:"var(--text-bright)",fontWeight:600}}>{entry.event}</div>
                              <div style={{fontSize:10,color:"var(--text-dim)"}}>{entry.date}</div>
                            </div>
                            {entry.qualifier === "afk" ? (
                              <span style={{fontSize:10,color:"var(--text-dim)",flexShrink:0,fontStyle:"italic"}}>AFK</span>
                            ) : (
                              <span style={{fontSize:12,fontWeight:700,color:"var(--gold-bright)",flexShrink:0}}>+{fmt(entry.coins||0)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="player-info-main" style={{display:"flex",flexDirection:"column",gap:16, ...(rank1VideoAssets ? {flex:"0 1 380px",order:2} : {})}}>
            <div className="card" style={{padding:20,border:prestige?`1px solid ${prestige.gradient[1]}50`:undefined,background: rank1VideoAssets ? "rgba(10,8,6,0.82)" : (prestige?`${prestige.gradient[2]}30`:undefined)}}>
              <div style={{fontSize:10,color:"var(--text-dim)",letterSpacing:1.5,textTransform:"uppercase",fontWeight:700}}>Last 4 Weeks</div>
              <div style={{fontFamily:"'Spectral',serif",fontWeight:800,fontSize:17,color:"var(--text-bright)",marginBottom:6}}>Power Surge</div>
              <div style={{fontSize:11,color:"var(--text-dim)",marginBottom:18}}>Weekly bars show recorded Power gains across the last four weeks.</div>
              <div style={{display:"flex",alignItems:"flex-end",gap:10,height:140}}>
                {powerGains.map((gain, i) => (
                  <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",height:"100%",justifyContent:"flex-end"}}>
                    {gain !== null ? (
                      <>
                        <div style={{fontSize:10,fontWeight:700,color:"var(--gold-bright)",marginBottom:4}}>{gain>=0?"+":""}{fmt(gain)}</div>
                        <div style={{
                          width:"100%",
                          height:`${Math.max(6,(Math.abs(gain)/maxGain)*100)}px`,
                          background:gain>=0
                            ? "linear-gradient(180deg, var(--gold-bright), var(--gold-dim))"
                            : "linear-gradient(180deg, #e07070, #7a1a1a)",
                          borderRadius:3,
                        }}/>
                      </>
                    ) : (
                      <div style={{width:"100%",height:6,background:"var(--border-dim)",borderRadius:3}}/>
                    )}
                    <div style={{fontSize:9,color:"var(--text-dim)",marginTop:6,textAlign:"center"}}>{periodLabels[i]}</div>
                  </div>
                ))}
              </div>
              {powerGains.every(g => g === null) && (
                <div style={{fontSize:11,color:"var(--text-dim)",marginTop:14,textAlign:"center"}}>
                  No Power history recorded yet. This chart fills in automatically as Power gets updated over the coming weeks.
                </div>
              )}
            </div>

            <div className="card" style={{padding:20,border:prestige?`1px solid ${prestige.gradient[1]}50`:undefined,background: rank1VideoAssets ? "rgba(10,8,6,0.82)" : (prestige?`${prestige.gradient[2]}30`:undefined)}}>
              <div style={{fontSize:10,color:"var(--text-dim)",letterSpacing:1.5,textTransform:"uppercase",fontWeight:700}}>Last 4 Weeks</div>
              <div style={{fontFamily:"'Spectral',serif",fontWeight:800,fontSize:17,color:"var(--text-bright)",marginBottom:6}}>Event Activity</div>
              <div style={{fontSize:11,color:"var(--text-dim)",marginBottom:18}}>Bars show how many events this member attended each week.</div>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {eventActivity.map((count, i) => (
                  <div key={i} style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:64,fontSize:10,color:"var(--text-dim)",flexShrink:0}}>{periodLabels[i]}</div>
                    <div style={{flex:1,background:"var(--border-dim)",borderRadius:4,height:22,position:"relative",overflow:"hidden"}}>
                      <div style={{
                        height:"100%",width:`${Math.max(4,(count/maxActivity)*100)}%`,
                        background:"linear-gradient(90deg, var(--gold-dim), var(--gold-bright))",
                        display:"flex",alignItems:"center",justifyContent:"flex-end",paddingRight:8,
                      }}>
                        {count > 0 && <span style={{fontSize:10,fontWeight:800,color:"var(--bg-void)"}}>{count}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        </div>
        {/* Events/Recent-Activity row lives OUTSIDE the hero-wrapper above
            (which is where the video backdrop is mounted, position:relative
            scoping the backdrop's inset:0 sizing to just that wrapper) — it
            used to be a third sibling inside player-info-layout itself,
            which meant the backdrop (sized to its relative ancestor) ended
            up stretching down to cover this row's height too, faintly
            showing through behind these cards since their background is
            only 0.82 opacity, not fully solid. As an independent block
            below the wrapper entirely, there's no shared ancestor for the
            backdrop to bleed into. */}
        {rank1VideoAssets ? (
          <div style={{position:"relative",zIndex:1,marginTop:16}}>
            {profileTabBar}
            {profileTab==="pointsHistory" ? (
              <PointsHistoryPanel member={member} t={t} />
            ) : (
              <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                <div style={{
                  flex:"1 1 300px",
                  background:"rgba(10,8,6,0.82)",
                  border:prestige?`1px solid ${prestige.gradient[1]}50`:"1px solid var(--border)",
                  borderRadius:4,padding:"18px 20px",
                }}>
                  <div style={{fontSize:10,color:"var(--text-dim)",letterSpacing:1.5,textTransform:"uppercase",fontWeight:700,marginBottom:16}}>This Month's Events</div>
                  <div style={{display:"flex",flexDirection:"column",gap:14}}>
                    {eventStats.map(s => (
                      <div key={s.id} style={{display:"flex",alignItems:"center",gap:12}}>
                        <div style={{color:"var(--gold)",flexShrink:0,width:16}}><s.icon size={15} /></div>
                        <div style={{width:72,fontSize:10,color:"var(--text-dim)",flexShrink:0,lineHeight:1.2}}>{s.label}</div>
                        <div style={{flex:1,height:8,background:"var(--border)",borderRadius:4,overflow:"hidden",minWidth:30}}>
                          <div style={{
                            width:`${Math.min(100,(s.attended/Math.max(1,s.max))*100)}%`,height:"100%",
                            background:"linear-gradient(90deg, var(--gold-dim), var(--gold-bright))",
                          }}/>
                        </div>
                        <div style={{width:40,fontSize:11,fontWeight:800,color:"var(--text-bright)",textAlign:"right",flexShrink:0}}>{s.attended}/{s.max}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{
                  flex:"1 1 300px",
                  background:"rgba(10,8,6,0.82)",
                  border:prestige?`1px solid ${prestige.gradient[1]}50`:"1px solid var(--border)",
                  borderRadius:4,padding:"18px 20px",
                }}>
                  <div style={{fontSize:10,color:"var(--text-dim)",letterSpacing:1.5,textTransform:"uppercase",fontWeight:700,marginBottom:14}}>Recent Activity</div>
                  {recentActivity.length === 0 ? (
                    <div style={{fontSize:12,color:"var(--text-dim)"}}>No attendance recorded yet.</div>
                  ) : (
                    <div style={{display:"flex",flexDirection:"column",gap:10}}>
                      {recentActivity.map((entry, i) => (
                        <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:10,paddingBottom:8,borderBottom:i<recentActivity.length-1?"1px solid var(--border)":"none"}}>
                          <div>
                            <div style={{fontSize:12,color:"var(--text-bright)",fontWeight:600}}>{entry.event}</div>
                            <div style={{fontSize:10,color:"var(--text-dim)"}}>{entry.date}</div>
                          </div>
                          {entry.qualifier === "afk" ? (
                            <span style={{fontSize:10,color:"var(--text-dim)",flexShrink:0,fontStyle:"italic"}}>AFK</span>
                          ) : (
                            <span style={{fontSize:12,fontWeight:700,color:"var(--gold-bright)",flexShrink:0}}>+{fmt(entry.coins||0)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

    </div>
  );
}

// ─── EVENT COIN VALUES (editable) ─────────────────────────────────────────────
// EVENTS is a shared module-level array (read by the Attendance event picker,
// the real payout math in performAttendancePayout, and the Dashboard event
// widget) — editing a row here mutates that array's objects in place and
// bumps eventsVersion so already-mounted components re-render with the new
// number. Saved to a small dedicated `event_coin_values` table so the change
// is real and synced for every Master/Elder, not just this browser tab.
function EventCoinValuesTable({ isMaster, addToast, eventsVersion, setEventsVersion, t }) {
  const [editingId, setEditingId] = useState(null);
  const [draftValue, setDraftValue] = useState("");
  const [savingId, setSavingId] = useState(null);

  function startEdit(ev) {
    setEditingId(ev.id);
    setDraftValue(String(ev.coins));
  }
  function cancelEdit() {
    setEditingId(null);
    setDraftValue("");
  }
  async function saveEdit(ev) {
    const val = parseInt(draftValue, 10);
    if (!Number.isFinite(val) || val < 0) {
      addToast(t("enterValidAmount"), "red", t("errorLabel"));
      return;
    }
    setSavingId(ev.id);
    const ok = await dbUpsertReliable("event_coin_values", { id: ev.id, coins: val });
    setSavingId(null);
    if (ok) {
      ev.coins = val; // mutate the shared EVENTS entry in place
      setEventsVersion(v => v + 1);
      setEditingId(null);
      addToast(`${ev.name} now pays ${val} coins.`, "gold", "Updated");
    } else {
      addToast(
        <span style={{display:"inline-flex",alignItems:"center",gap:6}}><WarningIcon size={13}/>Couldn't save — please try again.</span>,
        "red", "Save Failed"
      );
    }
  }

  return (
    <div className="table-wrap"><table className="table-stack">
      <thead><tr><th>{t("colEventName")}</th><th>{t("colId")}</th><th>{t("colCoins")}</th>{isMaster && <th></th>}</tr></thead>
      <tbody>{EVENTS.map(ev=>{
        const isEditing = editingId === ev.id;
        return (
          <tr key={`${ev.id}-${eventsVersion}`}>
            <td data-label="Event" style={{fontFamily:"'Inter',sans-serif",fontWeight:600}}>{ev.name}</td>
            <td data-label="ID"><span className="badge badge-silver">{ev.id}</span></td>
            <td data-label="Coins" style={{color:"var(--gold)",fontFamily:"'Inter',sans-serif",fontWeight:800}}>
              {isEditing ? (
                <input
                  type="number" min="0" value={draftValue}
                  onChange={e=>setDraftValue(e.target.value)}
                  onKeyDown={e=>{ if(e.key==="Enter") saveEdit(ev); if(e.key==="Escape") cancelEdit(); }}
                  autoFocus
                  style={{width:80,background:"rgba(10,8,6,0.85)",border:"1px solid var(--gold)",color:"var(--gold-light)",borderRadius:4,padding:"4px 8px",fontFamily:"'Inter',sans-serif",fontWeight:700}}
                />
              ) : ev.coins}
            </td>
            {isMaster && (
              <td data-label="">
                {isEditing ? (
                  <div style={{display:"flex",gap:6}}>
                    <button className="btn btn-gold btn-sm" disabled={savingId===ev.id} onClick={()=>saveEdit(ev)}>{savingId===ev.id ? "…" : t("saveBtn")}</button>
                    <button className="btn btn-outline btn-sm" onClick={cancelEdit}>{t("cancelBtn")}</button>
                  </div>
                ) : (
                  <button className="btn btn-outline btn-sm" onClick={()=>startEdit(ev)}>{t("editBtn")}</button>
                )}
              </td>
            )}
          </tr>
        );
      })}</tbody>
    </table></div>
  );
}

// ─── DECAY RATE (editable) ────────────────────────────────────────────────────
// Saved to app_state under key "decay_rate" — the SAME table/row pattern
// already used for last_decay_ts, which both this app and the server-side
// cron job (api/check-weekly-decay.js) read. Editing the rate here updates
// BOTH the manual "Trigger Weekly Decay" button in this app AND the
// automatic Tuesday-7am cron job, since check-weekly-decay.js reads this
// same app_state row rather than a hardcoded value.
function DecayRateEditor({ decayRate, setDecayRate, addToast, t }) {
  const [editing, setEditing] = useState(false);
  const [draftPct, setDraftPct] = useState(String(Math.round(decayRate*1000)/10));
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setDraftPct(String(Math.round(decayRate*1000)/10));
    setEditing(true);
  }
  async function save() {
    const pct = parseFloat(draftPct);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      addToast(t("enterValidAmount"), "red", t("errorLabel"));
      return;
    }
    const rate = pct / 100;
    setSaving(true);
    const ok = await dbUpsertReliable("app_state", { key: "decay_rate", value: String(rate), updated_at: Date.now() });
    setSaving(false);
    if (ok) {
      setDecayRate(rate);
      setEditing(false);
      addToast(`Weekly decay rate set to ${pct}%. This applies to both the manual trigger and the automatic Tuesday cron job.`, "gold", "Updated");
    } else {
      addToast(
        <span style={{display:"inline-flex",alignItems:"center",gap:6}}><WarningIcon size={13}/>Couldn't save — please try again.</span>,
        "red", "Save Failed"
      );
    }
  }

  const currentPct = Math.round(decayRate*1000)/10;
  return (
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
      <span style={{fontSize:13,color:"var(--text)"}}>{t("decayRateLabel")}</span>
      {editing ? (
        <>
          <input
            type="number" min="0" max="100" step="0.1" value={draftPct}
            onChange={e=>setDraftPct(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter") save(); if(e.key==="Escape") setEditing(false); }}
            autoFocus
            style={{width:70,background:"rgba(10,8,6,0.85)",border:"1px solid var(--gold)",color:"var(--gold-light)",borderRadius:4,padding:"4px 8px",fontFamily:"'Inter',sans-serif",fontWeight:700}}
          />
          <span style={{fontSize:13,color:"var(--text-dim)"}}>%</span>
          <button className="btn btn-gold btn-sm" disabled={saving} onClick={save}>{saving ? "…" : t("saveBtn")}</button>
          <button className="btn btn-outline btn-sm" onClick={()=>setEditing(false)}>{t("cancelBtn")}</button>
        </>
      ) : (
        <>
          <strong style={{color:"var(--gold)",fontSize:14}}>{currentPct}%</strong>
          <button className="btn btn-outline btn-sm" onClick={startEdit}>{t("editBtn")}</button>
        </>
      )}
    </div>
  );
}

// ─── BONUS CONFIG (editable) ──────────────────────────────────────────────────
// Saved to app_state under key "bonus_config" as one JSON object — same
// table/row pattern as decay_rate above, just one row holding all 5 values
// instead of a single scalar. performAttendancePayout (awarding) and
// Attendance's computeBonuses (progress display) both read the SAME
// bonusConfig from ctx, so they can never drift out of sync with each
// other again the way the ISB "0/10" bug did when the threshold was
// hardcoded separately in two places.
function BonusConfigEditor({ bonusConfig, setBonusConfig, addToast, t }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(bonusConfig);

  function startEdit() {
    setDraft(bonusConfig);
    setEditing(true);
  }

  async function save() {
    const fields = ["majorEventsBonusAmount","isbVeteranBonusAmount","isbVeteranThreshold","sindriVeteranBonusAmount","sindriVeteranWeeksThreshold","ironStreakBonusAmount","ironStreakWeeksThreshold"];
    const parsed = {};
    for (const f of fields) {
      const n = parseInt(draft[f], 10);
      if (!Number.isFinite(n) || n < 0) {
        addToast(t("enterValidAmount"), "red", t("errorLabel"));
        return;
      }
      parsed[f] = n;
    }
    setSaving(true);
    const ok = await dbUpsertReliable("app_state", { key: "bonus_config", value: JSON.stringify(parsed), updated_at: Date.now() });
    setSaving(false);
    if (ok) {
      setBonusConfig(parsed);
      setEditing(false);
      addToast(t("bonusSettingsSaved"), "gold", t("updatedTitle"));
    } else {
      addToast(
        <span style={{display:"inline-flex",alignItems:"center",gap:6}}><WarningIcon size={13}/>Couldn't save — please try again.</span>,
        "red", "Save Failed"
      );
    }
  }

  const ROWS = [
    { key:"majorEventsBonusAmount", label:t("majorEventsBonusLabel"), suffix:t("coinsText") },
    { key:"sindriVeteranBonusAmount", label:t("sindriVeteranBonusLabel"), suffix:t("coinsText") },
    { key:"sindriVeteranWeeksThreshold", label:t("sindriVeteranThresholdLabel"), suffix:t("weeksLabel") },
    { key:"isbVeteranBonusAmount", label:t("isbVeteranBonusLabel"), suffix:t("coinsText") },
    { key:"isbVeteranThreshold", label:t("isbVeteranThresholdLabel"), suffix:t("isbProgress") },
    { key:"ironStreakBonusAmount", label:t("ironStreakBonusLabel"), suffix:t("coinsText") },
    { key:"ironStreakWeeksThreshold", label:t("ironStreakThresholdLabel"), suffix:t("weeksLabel") },
  ];

  if (!editing) {
    return (
      <div>
        <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:12}}>
          {ROWS.map(r => (
            <div key={r.key} style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"var(--text)"}}>
              <span style={{color:"var(--text-dim)"}}>{r.label}</span>
              <strong style={{color:"var(--gold)"}}>{bonusConfig[r.key]} {r.suffix}</strong>
            </div>
          ))}
        </div>
        <button className="btn btn-outline btn-sm" onClick={startEdit}>{t("editBtn")}</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
        {ROWS.map(r => (
          <div key={r.key} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,fontSize:13}}>
            <span style={{color:"var(--text-dim)"}}>{r.label}</span>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <input
                type="number" min="0" step="1" value={draft[r.key]}
                onChange={e=>setDraft(d=>({...d,[r.key]:e.target.value}))}
                onKeyDown={e=>{ if(e.key==="Enter") save(); if(e.key==="Escape") setEditing(false); }}
                style={{width:70,background:"rgba(10,8,6,0.85)",border:"1px solid var(--gold)",color:"var(--gold-light)",borderRadius:4,padding:"4px 8px",fontFamily:"'Inter',sans-serif",fontWeight:700}}
              />
              <span style={{fontSize:12,color:"var(--text-dim)"}}>{r.suffix}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:8}}>
        <button className="btn btn-gold btn-sm" disabled={saving} onClick={save}>{saving ? "…" : t("saveBtn")}</button>
        <button className="btn btn-outline btn-sm" onClick={()=>setEditing(false)}>{t("cancelBtn")}</button>
      </div>
    </div>
  );
}

function LoginAnnouncementEditor({ loginAnnouncements, setLoginAnnouncements, addToast, t }) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const list = loginAnnouncements || [];

  async function persist(next) {
    const ok = await dbUpsertReliable("app_state", { key: "login_announcements", value: JSON.stringify(next), updated_at: Date.now() });
    return ok;
  }
  async function post() {
    const text = draft.trim();
    if (!text) return;
    setSaving(true);
    // A fresh id per post is what lets each member's "dismissed" flag
    // (stored client-side, keyed by id) apply only to THIS specific
    // announcement — dismissing one never affects any other, past or
    // future.
    const next = [...list, { id: Date.now(), text, postedAt: Date.now() }];
    const ok = await persist(next);
    setSaving(false);
    if (ok) {
      setLoginAnnouncements(next);
      setDraft("");
      addToast("Announcement posted — everyone will see it at their next login.", "gold", "Updated");
      notifyDiscord({ content: `📢 **${CLAN_NAME} Announcement**\n${text}\n\n${window.location.origin}` }, "general");
    } else {
      addToast(
        <span style={{display:"inline-flex",alignItems:"center",gap:6}}><WarningIcon size={13}/>Couldn't save — please try again.</span>,
        "red", "Save Failed"
      );
    }
  }
  async function remove(id) {
    const next = list.filter(a => a.id !== id);
    const ok = await persist(next);
    if (ok) {
      setLoginAnnouncements(next);
      addToast("Announcement removed.", "gold", "Updated");
    }
  }

  return (
    <div style={{marginBottom:16}}>
      <div style={{fontSize:13,color:"var(--text)",marginBottom:8}}>{t("loginAnnouncementLabel")}</div>
      {list.length === 0 ? (
        <div style={{fontSize:13,color:"var(--text-dim)",fontStyle:"italic",marginBottom:12}}>{t("noAnnouncementSet")}</div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:12}}>
          {list.map(ann => (
            <div key={ann.id} style={{display:"flex",alignItems:"center",gap:10,background:"rgba(201,151,42,0.06)",border:"1px solid rgba(201,151,42,0.2)",borderRadius:4,padding:"8px 12px"}}>
              <span style={{fontSize:13,color:"var(--text)",flex:1}}>{ann.text}</span>
              <button className="btn btn-red btn-sm" onClick={()=>remove(ann.id)}>{t("clearBtn")}</button>
            </div>
          ))}
        </div>
      )}
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        <textarea
          value={draft} onChange={e=>setDraft(e.target.value)}
          placeholder={t("loginAnnouncementPlaceholder")}
          rows={2} maxLength={300}
          style={{background:"rgba(10,8,6,0.85)",border:"1px solid var(--gold)",color:"var(--text)",borderRadius:4,padding:"8px 10px",fontFamily:"'Inter',sans-serif",resize:"vertical"}}
        />
        <button className="btn btn-gold btn-sm" disabled={saving || !draft.trim()} onClick={post} style={{alignSelf:"flex-start"}}>{saving ? "…" : t("postAnnouncementBtn")}</button>
      </div>
    </div>
  );
}

function Settings({ ctx }) {
  const { currentUser, members, setMembers, setMembersRaw, addToast, eventsVersion, setEventsVersion, decayRate, setDecayRate, bonusConfig, setBonusConfig, loginAnnouncements, setLoginAnnouncements, decayAnnouncements, setDecayAnnouncements } = ctx;
  const { t } = useLang();
  const isMaster = currentUser.role==="Master";
  // ── Auto-decay: every Wednesday at 7:00 AM, fixed to GMT+8 ───────────────
  // Pinned to a fixed timezone rather than each visitor's device clock, so
  // "Wednesday 7am" means the same real moment for everyone, regardless of
  // where they're browsing from. We do this by shifting the current UTC time
  // forward by 8 hours, running the day-of-week/hour math as if that shifted
  // value were UTC (so JS's own Date methods, which always use UTC for
  // get/setUTC*, do the work for us), then shifting the result back to a
  // real UTC timestamp for comparison against Date.now().
  const GMT8_OFFSET_MS = 8 * 60 * 60 * 1000;
  // One-time exception: decay also runs on Wednesday, June 24 2026 7am GMT+8,
  // instead of that week's normal Tuesday. This was a one-off request to push
  // that single week's decay back a day; every other week uses the regular
  // Tuesday schedule. Safe to delete this constant (and the logic in
  // getMostRecentScheduledDecay that references it) once that date has
  // passed, since it can never be the most recent scheduled moment again.
  const JUNE_24_2026_WED_7AM_GMT8 = Date.UTC(2026, 5, 24, 7, 0, 0, 0) - GMT8_OFFSET_MS;
  function getLastTuesday7am() {
    const nowMs = Date.now();
    const shifted = new Date(nowMs + GMT8_OFFSET_MS);
    const day = shifted.getUTCDay(); // 0=Sun,1=Mon,2=Tue,3=Wed,... in the shifted (GMT+8) frame
    const diffToTuesday = (day >= 2) ? day - 2 : day + 5;
    const tuesdayShifted = new Date(shifted);
    tuesdayShifted.setUTCDate(shifted.getUTCDate() - diffToTuesday);
    tuesdayShifted.setUTCHours(7, 0, 0, 0);
    // If today is Tuesday but before 7am (in GMT+8), go back 7 days
    if (tuesdayShifted.getTime() > shifted.getTime()) {
      tuesdayShifted.setUTCDate(tuesdayShifted.getUTCDate() - 7);
    }
    // Shift back from the GMT+8 frame to a real UTC timestamp
    return tuesdayShifted.getTime() - GMT8_OFFSET_MS;
  }
  // Single source of truth for "when was the most recent moment decay was
  // supposed to run" — used by both the automatic check below and the
  // manual Trigger Weekly Decay button, so they never disagree with each
  // other about which week's decay has or hasn't happened yet.
  function getMostRecentScheduledDecay() {
    const lastTuesday7am = getLastTuesday7am();
    // This week (the one containing the June 24 exception) should fire ONLY
    // on Wednesday, not on its normal Tuesday too — so if the most recent
    // Tuesday falls within 24 hours of the exception date (i.e. it's the
    // Tuesday immediately before that Wednesday), we ignore it and use the
    // exception instead. Every other week is unaffected.
    const oneDayMs = 24 * 60 * 60 * 1000;
    const tuesdayIsTheOneBeingReplaced =
      Math.abs(JUNE_24_2026_WED_7AM_GMT8 - lastTuesday7am - oneDayMs) < oneDayMs;
    const effectiveTuesday = tuesdayIsTheOneBeingReplaced ? -Infinity : lastTuesday7am;
    return Math.max(
      effectiveTuesday,
      JUNE_24_2026_WED_7AM_GMT8 <= Date.now() ? JUNE_24_2026_WED_7AM_GMT8 : -Infinity
    );
  }
  // NOTE: the old client-side auto-decay check (which read/wrote a
  // "last_decay" timestamp in localStorage) was removed from here. It only
  // ever ran when the Master specifically had this Settings page open on
  // one particular browser/device — localStorage doesn't sync across
  // devices or sessions, so decay could silently never trigger if that
  // exact condition never lined up with the scheduled time. Weekly decay
  // is now handled server-side by api/check-weekly-decay.js, triggered by
  // an external cron service, independent of anyone having the app open.
  // The manual "Trigger Weekly Decay" button below still works as a
  // manual override for either case.

  // ── Auto-reset: attendance counts reset on the 1st of every month, ───────
  // midnight GMT+8 — fixed to this timezone for everyone, same reasoning as
  // the coin decay schedule above (a calendar boundary should mean the same
  // real moment for every member, not each device's own local midnight).
  function getLastMonthStart() {
    const nowMs = Date.now();
    const shifted = new Date(nowMs + GMT8_OFFSET_MS);
    const monthStartShifted = new Date(Date.UTC(
      shifted.getUTCFullYear(), shifted.getUTCMonth(), 1, 0, 0, 0, 0
    ));
    return monthStartShifted.getTime() - GMT8_OFFSET_MS;
  }
  // ROOT CAUSE of Balance Correction entries (and any other concurrent
  // per-member change) silently vanishing: this reset EVERY member's
  // attendance count via setMembers, which writes each member's ENTIRE row
  // from whatever this specific browser has cached — including tx_log. Any
  // admin whose tab had been open since before a correction/adjustment
  // landed on someone else's row would silently overwrite it back to their
  // own stale snapshot the next time this fired, for the WHOLE clan at
  // once, not just one person. Now a targeted bulk write touching only
  // {id, attendance} per member, never the rest of the row.
  useEffect(() => {
    const lastMonthStart = getLastMonthStart();
    let lastReset = 0;
    try { lastReset = parseInt(localStorage.getItem("last_attendance_reset") || "0"); } catch {}
    if (lastReset < lastMonthStart) {
      dbUpsertReliable("members", members.map(m => ({ id: m.id, attendance: 0 })));
      setMembersRaw(ms=>ms.map(m=>({...m,attendance:0})));
      try { localStorage.setItem("last_attendance_reset", lastMonthStart.toString()); } catch {}
      addToast(t("autoAttendanceResetApplied"),"blue",t("resetTitle"));
    }
  }, []);

  // ROOT CAUSE of members' balances looking wildly wrong against their own
  // My Points History: this used to attach the clan-wide combined decay
  // total to whichever member happened to be first in the local members
  // array, which has nothing to do with that member's personal balance but
  // lived in their history anyway -- the exact same bug already found and
  // fixed in the server-side cron (api/check-weekly-decay.js, see its own
  // comment). This also bundled every member's coins+decayLog into one
  // racy setMembers call, the same lost-update pattern already fixed for
  // bidding and admin coin adjustments elsewhere in this file. Now mirrors
  // the cron's already-correct design: one targeted, checked write per
  // member (coins + decay_log only — never touches tx_log), and the
  // clan-wide total goes to app_state.decay_announcements instead of any
  // one person's personal log.
  async function triggerDecay() {
    const decayDate = new Date().toLocaleDateString();
    const decayTs = Date.now();
    const ratePct = Math.round(decayRate * 1000) / 10; // e.g. 0.05 -> 5, 0.075 -> 7.5
    const results = await Promise.all(members.map(async m => {
      // Members can carry a negative balance (see reset_coins_allow_negative.sql) —
      // debt should only shrink when they actually earn points back, never
      // erode on its own here, matching the cron job's own guard.
      const d = m.coins > 0 ? Math.floor(m.coins*decayRate) : 0;
      const newDecayLog = [...(m.decayLog||[]), {amount:-d,date:decayDate,ts:decayTs}];
      const newCoins = m.coins - d;
      const ok = await dbUpsertReliable("members", { id: m.id, coins: newCoins, decay_log: JSON.stringify(newDecayLog) });
      return { id: m.id, name: m.name, d, newCoins, newDecayLog, ok };
    }));
    const succeeded = results.filter(r=>r.ok);
    const failed = results.filter(r=>!r.ok);
    const totalDecayed = succeeded.reduce((s,r)=>s+r.d, 0);
    if (succeeded.length > 0) {
      setMembersRaw(ms=>ms.map(m=>{
        const r = succeeded.find(x=>x.id===m.id);
        return r ? {...m, coins:r.newCoins, decayLog:r.newDecayLog} : m;
      }));
      const announcement = { date: decayDate, ts: decayTs, ratePct, memberCount: succeeded.length, totalDecayed };
      const newAnnouncements = [...(decayAnnouncements||[]), announcement].slice(-30);
      await dbUpsertReliable("app_state", { key: "decay_announcements", value: JSON.stringify(newAnnouncements), updated_at: Date.now() });
      setDecayAnnouncements(newAnnouncements);
    }
    if (failed.length === 0) {
      addToast(`${t("decayTriggeredTostPrefix")} ${ratePct}% ${t("decayTriggeredTostSuffix")}`,"red",t("decayTriggeredTitle"));
      // Record this in the SHARED server-side state (not just localStorage),
      // so the cron-driven check (api/check-weekly-decay.js) correctly sees
      // that this week's decay has already happened and doesn't run it
      // again — regardless of which device/browser this button was clicked
      // from. Only advance this once EVERY member is confirmed decayed,
      // same guard the cron job itself uses, so a partial failure here
      // gets picked up and retried by the next scheduled cron tick instead
      // of being silently skipped forever.
      dbUpsert("app_state", { key: "last_decay_ts", value: String(getMostRecentScheduledDecay()), updated_at: Date.now() });
    } else {
      addToast(
        <span style={{display:"inline-flex",alignItems:"center",gap:6}}><WarningIcon size={13}/>Decay applied to {succeeded.length}/{results.length} members — {failed.map(f=>f.name).join(", ")} failed and will be retried automatically.</span>,
        "red", "Decay Partially Failed"
      );
    }
  }
  // Same targeted-write fix as the auto-reset effect above — see its comment.
  function resetAttendance() {
    dbUpsertReliable("members", members.map(m => ({ id: m.id, attendance: 0 })));
    setMembersRaw(ms=>ms.map(m=>({...m,attendance:0})));
    try { localStorage.setItem("last_attendance_reset", getLastMonthStart().toString()); } catch {}
    addToast(t("attendanceResetToast"),"blue",t("resetTitle"));
  }
  if(!isMaster) return (
    <div className="card" style={{textAlign:"center",padding:48,color:"var(--text-dim)"}}>
      <div style={{marginBottom:14,display:"flex",justifyContent:"center"}}><LockIcon size={44} style={{filter:"drop-shadow(0 0 8px rgba(122,26,26,0.5))"}}/></div>
      <div style={{fontFamily:"'Spectral',serif",fontWeight:800,fontSize:20,color:"var(--text)"}}>{t("masterOnly")}</div>
      <div style={{marginTop:8,fontSize:13}}>{t("settingsRequireMaster")}</div>
    </div>
  );
  return (
    <div>
      <div className="grid-2">
        <div className="card card-red">
          <div style={{fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:15,color:"#e07070",marginBottom:8}}>{t("coinDecayTitle")}</div>
          <div style={{fontSize:13,color:"var(--text-dim)",marginBottom:12,lineHeight:1.7}}>{t("coinDecayDescPrefix")} {Math.round(decayRate*1000)/10}% {t("coinDecayDescSuffix")}</div>
          <DecayRateEditor decayRate={decayRate} setDecayRate={setDecayRate} addToast={addToast} t={t} />
          <div style={{fontSize:13,color:"var(--text)",marginBottom:16}}>{t("avgCoinsLabel")} <strong style={{color:"var(--gold)"}}>{fmt(Math.floor(members.reduce((s,m)=>s+m.coins,0)/members.length))}</strong></div>
          <button className="btn btn-red" onClick={triggerDecay}>{t("triggerWeeklyDecay")}</button>
        </div>
        <div className="card card-blue">
          <div style={{fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:15,color:"#60aadd",marginBottom:8}}>{t("attendanceResetTitle")}</div>
          <div style={{fontSize:13,color:"var(--text-dim)",marginBottom:12,lineHeight:1.7}}>{t("attendanceResetDesc")}</div>
          <div style={{fontSize:13,color:"var(--text)",marginBottom:16}}>{t("totalRecordsLabel")} <strong style={{color:"#60aadd"}}>{members.reduce((s,m)=>s+m.attendance,0)}</strong></div>
          <button className="btn btn-blue" onClick={resetAttendance}>{t("resetWeeklyAttendance")}</button>
        </div>
      </div>
      <div className="card" style={{marginTop:20}}>
        <div style={{fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:15,color:"var(--gold-light)",marginBottom:8}}>{t("loginAnnouncementTitle")}</div>
        <div style={{fontSize:13,color:"var(--text-dim)",marginBottom:12,lineHeight:1.7}}>{t("loginAnnouncementDesc")}</div>
        <LoginAnnouncementEditor loginAnnouncements={loginAnnouncements} setLoginAnnouncements={setLoginAnnouncements} addToast={addToast} t={t} />
      </div>
      <div className="card" style={{marginTop:20}}>
        <SectionTitle>{t("eventCoinValues")}</SectionTitle>
        <EventCoinValuesTable isMaster={isMaster} addToast={addToast} eventsVersion={eventsVersion} setEventsVersion={setEventsVersion} t={t} />
      </div>
      <div className="card" style={{marginTop:20}}>
        <SectionTitle>{t("bonusSettingsTitle")}</SectionTitle>
        <div style={{fontSize:13,color:"var(--text-dim)",marginBottom:12,lineHeight:1.7}}>{t("bonusSettingsDesc")}</div>
        <BonusConfigEditor bonusConfig={bonusConfig} setBonusConfig={setBonusConfig} addToast={addToast} t={t} />
      </div>
      <div className="card" style={{marginTop:20}}>
        <SectionTitle><span style={{display:"inline-flex",alignItems:"center",gap:6}}><GearIcon size={13}/>{t("elderManagement")}</span></SectionTitle>
        <div className="table-wrap"><table className="table-stack">
          <thead><tr><th>{t("colMemberName")}</th><th>{t("colClass")}</th><th>{t("colPower")}</th><th>{t("colDiscordName")}</th><th>{t("colRole")}</th><th>{t("colActionName")}</th></tr></thead>
          <tbody>{members.filter(m=>m.id!==currentUser.id).map(m=>(
            <tr key={m.id}>
              <td data-label="Member" style={{fontFamily:"'Inter',sans-serif",fontWeight:700}}>{m.name}</td>
              <td data-label="Class" style={{fontWeight:500,fontSize:12}}>{m.cls}</td>
              <td data-label="Power" style={{fontFamily:"'Inter',sans-serif",fontWeight:700,color:"#a8b8c8"}}><span style={{display:"inline-flex",alignItems:"center",gap:5}}><PowerIcon size={14} />{fmt(m.power)}</span></td>
              <td data-label="Discord">{m.discord?<span className="discord-tag">🎮 {m.discord}</span>:<span style={{color:"var(--text-dim)",fontSize:12}}>—</span>}</td>
              <td data-label="Role"><span className={`badge ${m.role==="Master"?"badge-gold":m.role==="Elder"?"badge-red":"badge-silver"}`}>{m.role}</span></td>
              <td data-label="Action"><div style={{display:"flex",gap:6}}>
                {m.role!=="Elder"&&m.role!=="Leader"&&<button className="btn btn-outline btn-sm" onClick={()=>{setMembers(ms=>ms.map(x=>x.id===m.id?{...x,role:"Elder"}:x));addToast(`${m.name} ${t("promotedToElderToast")}`,"gold",t("promotedTitle"));}}>{t("makeElder")}</button>}
                {m.role==="Elder"&&<button className="btn btn-ghost btn-sm" onClick={()=>{setMembers(ms=>ms.map(x=>x.id===m.id?{...x,role:"Member"}:x));addToast(`${m.name} ${t("demotedToast")}`,"red",t("demotedTitle"));}}>{t("demote")}</button>}
              </div></td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>
    </div>
  );
}

// ─── ADD MEMBER MODAL ─────────────────────────────────────────────────────────
function AddMemberModal({ ctx }) {
  const { setModal, setMembers, addToast } = ctx;
  const { t } = useLang();
  const [form, setForm] = useState({name:"",username:"",password:"member123",cls:"Berserker",power:10000,role:"Member"});
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  async function submit() {
    if (submittingRef.current) return;
    if(!form.name||!form.username){addToast(t("nameUsernameRequired"),"red",t("errorLabel"));return;}
    submittingRef.current = true;
    setSubmitting(true);
    const newM={id:Date.now(),name:form.name,username:form.username,cls:form.cls,power:parseInt(form.power)||10000,role:form.role,coins:0,attendance:0,auctionWins:0,joinDate:new Date().toLocaleDateString(),decayLog:[],txLog:[],attendLog:[],powerLog:[],discord:""};
    setMembers(ms=>[...ms,newM]);
    // Set the initial password via the dedicated RPC (see
    // setMemberPasswordAtomic's own comment) — the row above was created
    // WITHOUT a password at all, so without this the new member couldn't
    // log in until someone manually set one.
    const ok = await setMemberPasswordAtomic(newM.id, form.password);
    submittingRef.current = false;
    setSubmitting(false);
    if (!ok) {
      addToast(`${form.name} ${t("addedToClan")}, but the initial password couldn't be saved — set it manually.`, "red", t("errorLabel"));
      setModal(null);
      return;
    }
    addToast(`${form.name} ${t("addedToClan")}`,"gold",t("memberAddedTitle"));
    setModal(null);
  }
  return (
    <div className="modal-overlay" onClick={()=>setModal(null)}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header"><div className="modal-title"><span style={{display:"inline-flex",alignItems:"center",gap:6}}><StatIcon src={WARRIORS_ICON} size={32}/>{t("addMemberTitle")}</span></div><button className="btn btn-ghost" onClick={()=>setModal(null)}>✕</button></div>
        <div className="modal-body">
          <div className="form-group"><label className="form-label">{t("characterName")}</label><input className="input" placeholder={t("inGameNamePlaceholder")} value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} /></div>
          <div className="form-group"><label className="form-label">{t("usernameLoginLabel")}</label><input className="input" placeholder={t("loginUsernamePlaceholder")} value={form.username} onChange={e=>setForm(p=>({...p,username:e.target.value}))} /></div>
          <div className="form-group"><label className="form-label">{t("passwordLabel2")}</label><input className="input" placeholder={t("initialPasswordPlaceholder")} value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))} /></div>
          <div className="form-group"><label className="form-label">{t("classLabel")}</label><select className="select" value={form.cls} onChange={e=>setForm(p=>({...p,cls:e.target.value}))}>{CLASSES.map(c=><option key={c}>{c}</option>)}</select></div>
          <div className="form-group"><label className="form-label">{t("powerLevelLabel")}</label><input className="input" type="number" value={form.power} onChange={e=>setForm(p=>({...p,power:e.target.value}))} /></div>
          <div className="form-group"><label className="form-label">{t("roleLabel")}</label><select className="select" value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))}><option>Member</option><option>Elder</option></select></div>
        </div>
        <div className="modal-footer"><button className="btn btn-outline" onClick={()=>setModal(null)} disabled={submitting}>{t("cancel")}</button><button className="btn btn-gold" onClick={submit} disabled={submitting}>{submitting ? "…" : t("addMemberTitle")}</button></div>
      </div>
    </div>
  );
}

// ─── ADJUST COINS MODAL ───────────────────────────────────────────────────────
function AdjustCoinsModal({ ctx }) {
  const { modal, setModal, setMembersRaw, addToast, currentUser, submitCoinRequest } = ctx;
  const { t } = useLang();
  const member = modal.data;
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // The Master branch below is fully synchronous (no await) and ends by
  // closing the modal — but React doesn't actually remove the button from
  // the DOM until the next render, which lands a beat after this function
  // returns. A fast double-click fires submit() twice before that removal,
  // and `submitting` (plain React state) updates too slowly to block the
  // second call either — it hasn't re-rendered into the DOM's `disabled`
  // attribute yet. A plain ref is checked/set synchronously, so it blocks
  // a same-tick second call regardless of render timing. This is what was
  // producing duplicate "Admin Manual Add" entries in a member's history
  // from a single intended click.
  const submittingRef = useRef(false);
  const isMaster = currentUser.role==="Master";
  const isElder = currentUser.role==="Elder";
  // ROOT CAUSE FIX: this used to call submitCoinRequest then immediately
  // setModal(null) — closing the dialog before the actual network request
  // had even started resolving. submitCoinRequest's success/failure toast
  // fires later, completely disconnected from a modal that already
  // closed, looking exactly like "it worked." If the write was actually
  // slow (not failed) and the Elder saw a failure toast seconds later,
  // they had every reason to assume nothing was sent and try again — but
  // the original attempt may have already landed, creating two real,
  // separate requests in coin_requests for the same intended action.
  // Now the modal stays open and the buttons disable themselves until
  // the real result comes back, so there's no ambiguous window where the
  // Elder doesn't know whether to retry.
  async function submit(type) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    const val=parseInt(amount)||0;
    if (val<=0) { addToast(t("enterValidAmount"), "red", t("errorLabel")); submittingRef.current = false; return; }
    if (isElder && !isMaster) {
      setSubmitting(true);
      const ok = await submitCoinRequest(member.id, val, type, reason);
      setSubmitting(false);
      submittingRef.current = false;
      if (ok) setModal(null); // only close on confirmed success — a failure leaves the modal open with the amount/reason intact, so retrying doesn't mean re-typing anything, and there's no doubt about whether the click "did something"
      return;
    }
    const change=type==="add"?val:-val;
    const logType=reason.toLowerCase().includes("bonus")?"Bonus Points":"Admin Manual Add";
    const txEntry = {change,reason:reason||"—",date:new Date().toLocaleDateString(),logType,addedBy:currentUser.name,ts:Date.now()};
    // ROOT CAUSE of a real incident (GinisangOtin's coins silently
    // drifting -705 from her own Points History): this used to compute
    // the new balance from THIS browser's locally-cached member.coins and
    // overwrite the whole row via setMembers, in one indivisible database
    // write bundled with the rest of that row's fields — the exact same
    // lost-update race already found and fixed for bidding (see
    // adjustMemberCoinsAndLogAtomic above). If this browser's snapshot
    // was stale, or another write to the same member landed around the
    // same time, the log entry could get written while the real coins
    // change it describes silently didn't.
    setSubmitting(true);
    const newBalance = await adjustMemberCoinsAndLogAtomic(member.name, change, txEntry);
    setSubmitting(false);
    submittingRef.current = false;
    if (newBalance === null) {
      addToast(
        <span style={{display:"inline-flex",alignItems:"center",gap:6}}><WarningIcon size={13}/>Couldn't save — please try again.</span>,
        "red", "Save Failed"
      );
      return;
    }
    setMembersRaw(ms=>ms.map(m=>m.id===member.id?{...m,coins:newBalance,txLog:[...(m.txLog||[]),txEntry]}:m));
    addToast(`${type==="add"?t("addedCoinsToast"):t("removedCoinsToast")} ${fmt(val)} ${type==="add"?t("coinsToLabel"):t("coinsFromLabel")} ${member.name}.`,type==="add"?"gold":"red",t("coinsAdjustedTitle"));
    setModal(null);
  }
  return (
    <div className="modal-overlay" onClick={()=>setModal(null)}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header"><div className="modal-title"><span style={{display:"inline-flex",alignItems:"center",gap:6}}><StatIcon src={COINS_ICON} size={32}/>{t("adjustCoinsTitle")} {member.name}</span></div><button className="btn btn-ghost" onClick={()=>setModal(null)}>✕</button></div>
        <div className="modal-body">
          {isElder && !isMaster && (
            <div style={{background:"rgba(201,151,42,0.1)",border:"1px solid rgba(201,151,42,0.35)",borderRadius:6,padding:"10px 14px",marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:16}}>⏳</span>
              <span style={{fontSize:12,color:"#c8922a",fontFamily:"'Inter',sans-serif",fontWeight:600}}>{t("elderApprovalNotice")}</span>
            </div>
          )}
          <div style={{textAlign:"center",marginBottom:20,fontFamily:"'Spectral',serif",fontWeight:800,fontSize:24,color:"var(--gold-light)"}}>{t("currentLabel")} <span style={{display:"inline-flex",alignItems:"center",gap:4}}><StatIcon src={COINS_ICON} size={28}/>{fmt(member.coins)}</span></div>
          <div className="form-group"><label className="form-label">{t("amountLabel")}</label><input className="input" type="number" min={0} value={amount} onChange={e=>setAmount(e.target.value)} disabled={submitting} /></div>
          <div className="form-group"><label className="form-label">{t("reasonOptional")}</label><input className="input" placeholder={t("reasonPlaceholder")} value={reason} onChange={e=>setReason(e.target.value)} disabled={submitting} /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={()=>setModal(null)} disabled={submitting}>{t("cancel")}</button>
          <button className="btn btn-red" onClick={()=>submit("remove")} disabled={submitting}>{submitting ? "…" : (isElder&&!isMaster?t("requestRemove"):t("removeAmount"))}</button>
          <button className="btn btn-gold" onClick={()=>submit("add")} disabled={submitting}>{submitting ? "…" : (isElder&&!isMaster?t("requestAdd"):t("addAmount"))}</button>
        </div>
      </div>
    </div>
  );
}


// ─── PENDING COIN REQUESTS MODAL ─────────────────────────────────────────────
function PendingRequestsModal({ ctx }) {
  const { setModal, pendingCoinRequests, approveCoinRequest, rejectCoinRequest } = ctx;
  const { t } = useLang();
  return (
    <div className="modal-overlay" onClick={()=>setModal(null)}>
      <div className="modal" style={{maxWidth:520}} onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title"><span style={{display:"inline-flex",alignItems:"center",gap:6}}>{t("pendingCoinRequestsTitle")}</span></div>
          <button className="btn btn-ghost" onClick={()=>setModal(null)}>✕</button>
        </div>
        <div className="modal-body" style={{maxHeight:400,overflowY:"auto"}}>
          {pendingCoinRequests.length===0 && (
            <div style={{textAlign:"center",padding:"32px 0",color:"var(--text-dim)",fontFamily:"'Inter',sans-serif",fontSize:14}}>{t("noPendingRequests")}</div>
          )}
          {pendingCoinRequests.map(req => (
            <div key={req.id} style={{background:"rgba(20,16,12,0.8)",border:"1px solid rgba(201,151,42,0.25)",borderRadius:6,padding:"14px 16px",marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                <span style={{fontFamily:"'Inter',sans-serif",fontWeight:800,fontSize:14,color:"var(--gold-light)"}}>{req.memberName}</span>
                <span style={{fontFamily:"'Inter',sans-serif",fontWeight:900,fontSize:16,color:req.type==="add"?"#6dbf76":"#e07070"}}>{req.type==="add"?"+":"-"}{fmt(req.amount)} {t("coinsSuffix")}</span>
              </div>
              <div style={{fontSize:11,color:"var(--text-dim)",marginBottom:4}}>{t("reasonLabel2")} <span style={{color:"var(--text)"}}>{req.reason}</span></div>
              <div style={{fontSize:11,color:"var(--text-dim)",marginBottom:10}}>{t("requestedByLabel")} <span style={{color:"#c8922a"}}>{req.requestedBy}</span> · {req.requestedAt}</div>
              <div style={{display:"flex",gap:8}}>
                <button className="btn btn-gold btn-sm" style={{flex:1}} onClick={()=>approveCoinRequest(req.id)}>{t("approveBtn")}</button>
                <button className="btn btn-red btn-sm" style={{flex:1}} onClick={()=>rejectCoinRequest(req.id)}>{t("rejectBtn")}</button>
              </div>
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={()=>setModal(null)}>{t("closeBtn")}</button>
        </div>
      </div>
    </div>
  );
}

// ─── CHANGE PASSWORD MODAL ────────────────────────────────────────────────────
function ChangePasswordModal({ ctx }) {
  const { modal, setModal, addToast } = ctx;
  const { t } = useLang();
  const target = modal.data;
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [conf, setConf] = useState("");
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  async function submit() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setErr("");
    // This modal is always self-service (target === currentUser — see its
    // only two call sites), so checking "does cur match MY password" is
    // the same as verifying cur against target/currentUser's own login.
    // Done server-side via verify_login now, same reason as LoginScreen:
    // target.password no longer exists client-side at all.
    const matchedId = await verifyLogin(target.username, cur);
    if (matchedId !== String(target.id)) {
      submittingRef.current = false;
      setSubmitting(false);
      setErr(t("currentPasswordIncorrect"));
      return;
    }
    if (!pw) { submittingRef.current = false; setSubmitting(false); setErr(t("newPasswordEmpty")); return; }
    if (pw !== conf) { submittingRef.current = false; setSubmitting(false); setErr(t("passwordsNoMatch")); return; }
    // Actually persists the new password — see setMemberPasswordAtomic's
    // own comment for why this can no longer go through setMembers (which
    // no longer writes password at all).
    const ok = await setMemberPasswordAtomic(target.id, pw);
    submittingRef.current = false;
    setSubmitting(false);
    if (!ok) {
      setErr(t("passwordChangeFailed"));
      return;
    }
    addToast(t("passwordChangedSuccess"), "gold", t("passwordUpdatedTitle"));
    setModal(null);
  }

  return (
    <div className="modal-overlay" onClick={()=>setModal(null)}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{t("changePasswordTitle")}</div>
          <button className="btn btn-ghost" onClick={()=>setModal(null)}>✕</button>
        </div>
        <div className="modal-body">
          {err && <div className="login-error" style={{marginBottom:14}}>{err}</div>}
          <div className="form-group">
            <label className="form-label">{t("currentPasswordLabel")}</label>
            <input className="input" type="password" placeholder={t("currentPasswordPlaceholder")} value={cur} onChange={e=>setCur(e.target.value)} disabled={submitting} />
          </div>
          <div className="form-group">
            <label className="form-label">{t("newPasswordLabel")}</label>
            <input className="input" type="password" placeholder={t("newPasswordPlaceholder")} value={pw} onChange={e=>setPw(e.target.value)} disabled={submitting} />
          </div>
          <div className="form-group">
            <label className="form-label">{t("confirmNewPasswordLabel")}</label>
            <input className="input" type="password" placeholder={t("repeatPasswordPlaceholder")} value={conf} onChange={e=>setConf(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} disabled={submitting} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={()=>setModal(null)} disabled={submitting}>{t("cancel")}</button>
          <button className="btn btn-gold" onClick={submit} disabled={submitting}>{submitting ? "…" : t("savePasswordBtn")}</button>
        </div>
      </div>
    </div>
  );
}

// ─── RENAME MEMBER MODAL (Master only) ───────────────────────────────────────
function RenameMemberModal({ ctx }) {
  const { modal, setModal, setMembers, addToast } = ctx;
  const { t } = useLang();
  const target = modal.data;
  const [name, setName] = useState(target.name);
  const [err, setErr] = useState("");

  function submit() {
    setErr("");
    const n = name.trim();
    if (!n) { setErr(t("nameEmptyError")); return; }
    setMembers(ms => ms.map(m => m.id === target.id ? {...m, name: n} : m));
    addToast(`${target.name} ${t("renamedToast")} ${n}.`, "gold", t("memberRenamedTitle"));
    setModal(null);
  }

  return (
    <div className="modal-overlay" onClick={()=>setModal(null)}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title"><span style={{display:"inline-flex",alignItems:"center",gap:6}}><ClassIcon cls={target.cls} size={28}/>{t("renameMemberTitle")}</span></div>
          <button className="btn btn-ghost" onClick={()=>setModal(null)}>✕</button>
        </div>
        <div className="modal-body">
          {err && <div className="login-error" style={{marginBottom:14}}>{err}</div>}
          <div style={{marginBottom:14,fontSize:12,color:"var(--text-dim)",fontFamily:"'Inter',sans-serif"}}>
            {t("currentNameLabel")} <span style={{color:"var(--gold-light)",fontWeight:700}}>{target.name}</span>
          </div>
          <div className="form-group">
            <label className="form-label">{t("newNameLabel")}</label>
            <input className="input" placeholder={t("newNamePlaceholder")} value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} autoFocus />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={()=>setModal(null)}>{t("cancel")}</button>
          <button className="btn btn-gold" onClick={submit}>{t("saveNameBtn")}</button>
        </div>
      </div>
    </div>
  );
}

// ─── DELETE ATTENDANCE MODAL (Master only) ───────────────────────────────────
// Reverses an attendance record entirely: deducts the base attendance payout
// from every attendee AND any bonus (Major Events / ISB Veteran / Sindri
// Veteran) that was triggered by that specific submission, then removes the
// log entry. Matching is done on the shared `ts` stamped onto the attendLog
// entry, the attendance-log entry, and any System-awarded bonus txLog entries
// created in that same submission — so only effects from THIS event are
// undone, never any other attendance the member recorded before or since.
function DeleteAttendanceModal({ ctx }) {
  const { modal, setModal, members, setMembersRaw, setAttendanceLogs, addToast } = ctx;
  const { t } = useLang();
  const log = modal.data;
  const ts = log.ts;
  // The log's own `attendees` list (names recorded at submit time) is the
  // ground truth for who was in THIS specific submission. Restricting to
  // those names first prevents cross-matching with a different submission
  // of the same event on the same day (e.g. two separate Sindri's runs both
  // logged on 6/14) before falling back to event+date+ts disambiguation.
  const attendeeNames = new Set((log.attendees||[]).map(a => a.name));
  const hasAttendeeList = attendeeNames.size > 0;
  // Match loosely on event+date rather than strict ts equality: `ts` can end
  // up as different types (string from a DB round-trip vs number from a
  // fresh local write) depending on when an entry was created, and a strict
  // `===` then fails to find a real, present entry — which is what caused
  // this modal to show "0 members / 0 coins" for a record that genuinely had
  // both. event+date are always plain strings and don't have that problem.
  // When a member has more than one entry for the same event+date, ts (loosely
  // compared) disambiguates between them.
  function findMatch(log_, ts_, e) {
    if (e.event !== log_.event || e.date !== log_.date) return false;
    return true;
  }
  function pickMatch(entries) {
    if (entries.length <= 1) return entries[0] || null;
    // Multiple same-day same-event entries for this member — narrow down by
    // ts if possible (loose comparison handles string/number mismatches).
    const tsMatch = entries.find(e => e.ts != null && ts != null && String(e.ts) === String(ts));
    return tsMatch || entries[0];
  }
  const matches = members.filter(m => !hasAttendeeList || attendeeNames.has(m.name)).map(m => {
    const candidates = (m.attendLog||[]).filter(e => findMatch(log, ts, e));
    return { m, entry: pickMatch(candidates) };
  }).filter(x => x.entry);
  const affected = matches.map(x => x.m);
  const totalRefund = matches.reduce((sum, {m, entry}) => {
    const base = entry?.coins || 0;
    const entryTs = entry?.ts;
    const bonus = (m.txLog||[]).filter(entry2 => entry2.addedBy === "System" && entryTs != null && String(entry2.ts) === String(entryTs)).reduce((s,entry2)=>s+(entry2.change||0),0);
    return sum + base + bonus;
  }, 0);

  async function confirmDelete() {
    // ROOT CAUSE of the same coin/history drift bug recurring: this used to
    // build every affected member's full new row from local state and write
    // them all at once via setMembers — the same lost-update race already
    // fixed for bidding, admin coin adjustments, and attendance recording,
    // just never applied to attendance *deletion*. Now one atomic RPC call
    // per affected member instead.
    const reverts = matches.map(({ m, entry }) => {
      const refund = entry.coins || 0;
      const entryTs = entry.ts;
      const bonusRefund = (m.txLog||[]).filter(e2 => e2.addedBy === "System" && entryTs != null && String(e2.ts) === String(entryTs)).reduce((s,e2)=>s+(e2.change||0),0);
      return {
        id: m.id, name: m.name,
        refund: refund + bonusRefund,
        attendanceDelta: entry.qualifier!=="afk" ? 1 : 0,
        entry, entryTs,
      };
    });
    const results = await Promise.all(reverts.map(async r => {
      const newCoins = await revertAttendanceAndLogAtomic(r.name, r.refund, r.attendanceDelta, r.entry, r.entryTs);
      return { ...r, newCoins };
    }));
    const succeeded = results.filter(r => r.newCoins !== null);
    const failed = results.filter(r => r.newCoins === null);
    if (succeeded.length > 0) {
      setMembersRaw(ms => ms.map(m => {
        const r = succeeded.find(x => x.id === m.id);
        if (!r) return m;
        return {
          ...m,
          coins: r.newCoins,
          attendance: Math.max(0, m.attendance - r.attendanceDelta),
          attendLog: (m.attendLog||[]).filter(e => e !== r.entry),
          txLog: (m.txLog||[]).filter(e2 => !(e2.addedBy === "System" && r.entryTs != null && String(e2.ts) === String(r.entryTs))),
        };
      }));
    }
    if (failed.length === 0) {
      setAttendanceLogs(p => p.filter(l => l.id !== log.id));
      addToast(`"${log.event}" ${t("attendanceDeletedToast")} ${fmt(totalRefund)} ${t("deductedFromToast")} ${affected.length} ${t("memberSuffix2")}`, "red", t("attendanceDeletedTitle"));
      setModal(null);
    } else {
      addToast(
        <span style={{display:"inline-flex",alignItems:"center",gap:6}}><WarningIcon size={13}/>Reverted {succeeded.length}/{results.length} members — {failed.map(f=>f.name).join(", ")} failed, please try again.</span>,
        "red", "Removal Failed"
      );
    }
  }

  return (
    <div className="modal-overlay" onClick={()=>setModal(null)}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{t("removeAttendanceTitle")}</div>
          <button className="btn btn-ghost" onClick={()=>setModal(null)}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{marginBottom:14,fontFamily:"'Inter',sans-serif",fontSize:13,color:"var(--text)"}}>
            {t("permanentlyDeleteWarning")} <span style={{color:"var(--gold-light)",fontWeight:700}}>{log.event}</span> ({formatLogDateTime(log)}) {t("fromHistoryWarning")}
          </div>
          <div style={{background:"rgba(122,26,26,0.12)",border:"1px solid rgba(224,112,112,0.3)",borderRadius:4,padding:"12px 14px",marginBottom:6}}>
            <div style={{fontSize:11,color:"var(--text-dim)",marginBottom:6,textTransform:"uppercase",letterSpacing:1.5,fontWeight:700}}>{t("thisWillAffect")}</div>
            <div style={{fontFamily:"'Inter',sans-serif",fontSize:13,fontWeight:700,color:"#e07070"}}>{affected.length} {t("memberSuffix")} · −{fmt(totalRefund)} {t("coinsTotalSuffix")}</div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={()=>setModal(null)}>{t("cancel")}</button>
          <button className="btn btn-red" onClick={confirmDelete}>{t("removeDeductBtn")}</button>
        </div>
      </div>
    </div>
  );
}

// ─── ADD MISSING ATTENDANCE RECORD (Master only) ─────────────────────────────
// For when attendance was already recorded — coins already paid out to
// members — but the shared History row itself failed to save (e.g. a network
// hiccup during the upsert). Creates ONLY a History row backfilled with the
// event/date/attendees the Master specifies. Deliberately does NOT touch
// members, coins, attendLog, or txLog in any way, so it can never cause a
// double-payout — it just fixes the record to match what already happened.
function AddMissingAttendanceModal({ ctx }) {
  const { setModal, members, setMembersRaw, addToast, setAttendanceLogs, currentUser, bonusConfig } = ctx;
  const { t } = useLang();
  const [eventName, setEventName] = useState(EVENTS[0]?.name || "");
  const [whenLocal, setWhenLocal] = useState(() => {
    // Default to now, formatted for <input type="datetime-local">
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0,16);
  });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState({});
  const [qualifierMap, setQualifierMap] = useState({});
  const [payoutMode, setPayoutMode] = useState("none"); // "none" | "distribute"
  const [err, setErr] = useState("");

  const filtered = members.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));
  const selectedCount = Object.values(selected).filter(Boolean).length;
  const ev = EVENTS.find(e => e.name === eventName);

  function toggle(id) {
    setSelected(p => ({...p, [id]: !p[id]}));
    if (!qualifierMap[id]) setQualifierMap(p => ({...p, [id]: "full"}));
  }

  async function submit() {
    setErr("");
    if (!eventName || !ev) { setErr(t("pickEventError")); return; }
    if (!whenLocal) { setErr(t("pickDateTimeError")); return; }
    if (selectedCount === 0) { setErr(t("selectAtLeastOneAttendee")); return; }
    const ts = new Date(whenLocal).getTime();
    if (isNaN(ts)) { setErr(t("invalidDateTime")); return; }
    const date = new Date(ts).toLocaleDateString();
    const present = members.filter(m => selected[m.id]).map(m => m.id);

    if (payoutMode === "distribute") {
      // Reuses the exact same payout/bonus math as a live attendance
      // submission — coins, rank multiplier, and Major Events/ISB
      // Veteran/Sindri Veteran bonuses all apply normally, computed
      // relative to THIS entry's own date/week, not today's.
      const presentNames = present.map(id => {
        const m = members.find(x=>x.id===id);
        const q = qualifierMap[id]||"full";
        const mult=q==="full"?1:q==="late"?0.5:0;
        const rankMult=getRankMultiplier(members,id);
        const earned=Math.floor(ev.coins*mult*rankMult);
        return {name:m?.name, qualifier:q, earned};
      });
      const { payouts, bonusToasts } = performAttendancePayout(members, { ev, date, ts, present, qualifierMap }, bonusConfig);
      await applyAttendancePayout(payouts, setMembersRaw, addToast);
      setTimeout(()=>{
        bonusToasts.forEach(bonus=>addToast(<span style={{display:"inline-flex",alignItems:"center",gap:6}}><TrophyIcon size={14}/>{bonus.name} {t("earnedBonusText")} +{bonus.coins} {t("coinsText")} — {bonus.bonus} {t("bonusText")}</span>,"gold",t("bonusAwarded")));
      }, 200);
      const logEntry = { id: Date.now(), event: eventName, date, ts, members: present.length, recordedBy: currentUser.name, attendees: presentNames };
      setAttendanceLogs(p => [logEntry, ...p]);
      addToast(`${t("attendanceRecorded")} "${eventName}" ${t("backfilledDistributed")} ${present.length} ${t("memberSuffix3")}`, "gold", t("recordAddedTitle"));
    } else {
      // Record-only: no coins, no attendLog/txLog changes — for when the
      // payout already happened and only the History row is missing.
      const attendees = present.map(id => {
        const m = members.find(x=>x.id===id);
        return { name: m?.name, qualifier: qualifierMap[id]||"full", earned: 0 };
      });
      const logEntry = { id: Date.now(), event: eventName, date, ts, members: attendees.length, recordedBy: currentUser.name, attendees };
      setAttendanceLogs(p => [logEntry, ...p]);
      addToast(`"${eventName}" ${t("backfilledHistoryOnly")}`, "blue", t("recordAddedTitle"));
    }
    setModal(null);
  }

  return (
    <div className="modal-overlay" onClick={()=>setModal(null)}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{t("addMissingRecordTitle")}</div>
          <button className="btn btn-ghost" onClick={()=>setModal(null)}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{marginBottom:14,fontFamily:"'Inter',sans-serif",fontSize:12,color:"var(--text-dim)"}}>
            {t("backfillDesc")}
          </div>
          {err && <div className="login-error" style={{marginBottom:12}}>{err}</div>}
          <div className="form-group">
            <label className="form-label">{t("coinsFieldLabel")}</label>
            <div style={{display:"flex",gap:8}}>
              <button type="button" className={`btn btn-sm ${payoutMode==="none"?"btn-gold":"btn-outline"}`} style={{flex:1}} onClick={()=>setPayoutMode("none")}>{t("coinsUntouched")}</button>
              <button type="button" className={`btn btn-sm ${payoutMode==="distribute"?"btn-gold":"btn-outline"}`} style={{flex:1}} onClick={()=>setPayoutMode("distribute")}>{t("distributeCoins")}</button>
            </div>
            <div style={{marginTop:8,fontSize:11,color:"var(--text-dim)",fontFamily:"'Inter',sans-serif"}}>
              {payoutMode==="distribute"
                ? <>{t("distributeCoinsHint")}</>
                : <>{t("recordOnlyHintPrefix")} <strong style={{color:"var(--gold-light)"}}>{t("recordOnlyHintBold")}</strong> {t("recordOnlyHintSuffix")}</>}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{t("eventFieldLabel")}</label>
            <select className="select" value={eventName} onChange={e=>setEventName(e.target.value)}>
              {EVENTS.map(ev => <option key={ev.id} value={ev.name}>{ev.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t("dateTimeFieldLabel")}</label>
            <input className="input" type="datetime-local" value={whenLocal} onChange={e=>setWhenLocal(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">{t("whoAttendedLabel")} ({selectedCount} {t("selectedSuffix")})</label>
            <input className="input" placeholder={t("searchWarrior")} value={search} onChange={e=>setSearch(e.target.value)} style={{marginBottom:8}} />
            <div style={{maxHeight:220,overflowY:"auto",border:"1px solid var(--border-dim)",borderRadius:4}}>
              {filtered.map(m => (
                <div key={m.id} onClick={()=>toggle(m.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",cursor:"pointer",background:selected[m.id]?"rgba(201,151,42,0.1)":"transparent",borderBottom:"1px solid var(--border-dim)"}}>
                  <input type="checkbox" checked={!!selected[m.id]} onChange={()=>toggle(m.id)} onClick={e=>e.stopPropagation()} />
                  <ClassIcon cls={m.cls} size={22} />
                  <span style={{flex:1,fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:13}}>{m.name}</span>
                  {selected[m.id] && (
                    <select className="select" style={{width:"auto",padding:"3px 8px",fontSize:11}} value={qualifierMap[m.id]||"full"} onClick={e=>e.stopPropagation()} onChange={e=>{e.stopPropagation();setQualifierMap(p=>({...p,[m.id]:e.target.value}));}}>
                      <option value="full">{t("full")}</option><option value="late">{t("late")}</option><option value="afk">{t("afk")}</option>
                    </select>
                  )}
                </div>
              ))}
              {filtered.length===0 && <div style={{padding:14,textAlign:"center",color:"var(--text-dim)",fontSize:12}}>{t("noMembersFound")}</div>}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={()=>setModal(null)}>{t("cancel")}</button>
          <button className="btn btn-gold" onClick={submit}>{payoutMode==="distribute" ? t("addRecordPayBtn") : t("addRecordBtn")}</button>
        </div>
      </div>
    </div>
  );
}
