import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";

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
    bonusRuleMajor: "Major Events — attend all 5 event types this week: ISB (×1), CA (×2), STI (×2), CS (×1), WB (×3):",
    bonusCoins300: "+300 Coins",
    bonusRuleSindri: "Sindri Veteran — attend 2× Sindri's Treasure Island per week for 5 weeks:",
    bonusCoins400: "+400 Coins",
    bonusOneTime: "(one-time)",
    bonusRuleISB: "ISB Veteran — participate in 10 Inter-Server Battles (lifetime):",
    bonusCoins500: "+500 Coins",
    decayWarning: "Unused coins decay 10% every Sunday. Stay active!",
    decayBadge: "-10% / week",
    majorEvents: "Major Events",
    earned: "✓ Earned",
    sindriVeteran: "Sindri Veteran",
    weeksLabel: "weeks",
    sindriProgress: "weeks with 2× Sindri's",
    isbVeteran: "ISB Veteran",
    isbProgress: "ISB events",
    myPointsHistoryTitle: "My Points History — Private",
    myPointsHistoryDesc: "Attendance, bonuses, admin coin adjustments, auction wins, and weekly decay. Only you can see this record.",
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
    // Stored transaction-type category labels (the underlying data stays in
    // English in storage — these are only used to translate them for display).
    type_Attendance: "Attendance",
    type_MajorEventsBonus: "Major Events Bonus",
    type_ISBVeteranBonus: "ISB Veteran Bonus",
    type_SindriVeteranBonus: "Sindri Veteran Bonus",
    type_BonusPoints: "Bonus Points",
    type_ElderRequest: "Elder Request",
    type_AdminManualAdd: "Admin Manual Add",
    type_AuctionWin: "Auction Win",
    type_WeeklyDecay: "Weekly Decay",
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
    coinDecayDesc: "Auto-triggers every Tuesday at 7:00 AM (GMT+8). Removes 5% of each member's coins. You can also trigger it manually below.",
    avgCoinsLabel: "Avg coins:",
    triggerWeeklyDecay: "Trigger Weekly Decay",
    attendanceResetTitle: "Attendance Reset",
    attendanceResetDesc: "Auto-resets on the 1st of every month at midnight (GMT+8). You can also trigger it manually below.",
    totalRecordsLabel: "Total records:",
    resetWeeklyAttendance: "Reset Weekly Attendance",
    eventCoinValues: "Event Coin Values",
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
    decayTriggeredToast: "Weekly coin decay applied: 5% removed.",
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
    bonusRuleMajor: "重大活动 — 本周参加全部5种活动类型：ISB(×1)、CA(×2)、STI(×2)、CS(×1)、WB(×3)：",
    bonusCoins300: "+300 金币",
    bonusRuleSindri: "辛德里老兵 — 每周参加2次辛德里的宝藏岛，连续5周：",
    bonusCoins400: "+400 金币",
    bonusOneTime: "（一次性）",
    bonusRuleISB: "ISB老兵 — 参加10次跨服战（终身累计）：",
    bonusCoins500: "+500 金币",
    decayWarning: "未使用的金币每周日衰减10%。请保持活跃！",
    decayBadge: "-10% / 周",
    majorEvents: "重大活动",
    earned: "✓ 已获得",
    sindriVeteran: "辛德里老兵",
    weeksLabel: "周",
    sindriProgress: "周（每周2次辛德里）",
    isbVeteran: "ISB老兵",
    isbProgress: "次跨服战",
    myPointsHistoryTitle: "我的积分历史 — 私密",
    myPointsHistoryDesc: "出勤、奖励、管理员金币调整、拍卖获胜以及每周衰减。仅您本人可见此记录。",
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
    type_Attendance: "出勤",
    type_MajorEventsBonus: "重大活动奖励",
    type_ISBVeteranBonus: "ISB老兵奖励",
    type_SindriVeteranBonus: "辛德里老兵奖励",
    type_BonusPoints: "奖励积分",
    type_ElderRequest: "长老申请",
    type_AdminManualAdd: "管理员手动添加",
    type_AuctionWin: "拍卖获胜",
    type_WeeklyDecay: "每周衰减",
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
    coinDecayDesc: "每周二早上7:00（GMT+8）自动触发。扣除每位成员5%的金币。您也可以在下方手动触发。",
    avgCoinsLabel: "平均金币：",
    triggerWeeklyDecay: "触发每周衰减",
    attendanceResetTitle: "出勤重置",
    attendanceResetDesc: "每月1日凌晨0点（GMT+8）自动重置。您也可以在下方手动触发。",
    totalRecordsLabel: "总记录数：",
    resetWeeklyAttendance: "重置每周出勤",
    eventCoinValues: "活动金币数值",
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
    decayTriggeredToast: "每周金币衰减已应用：扣除5%。",
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
        const res = await fetchWithTimeout(base, {
          method: "POST",
          headers: { ...headers, "Prefer": "resolution=merge-duplicates,return=representation" },
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
  try { const t = await supa.from(table); return await t.select(columns); } catch { return null; }
}
// auctions.image_data stores base64 image blobs that can be large enough
// to cause "select=*" to hit the statement timeout. List/poll queries
// fetch everything except image_data; fetch it separately per-item only
// when needed (e.g. opening an auction's detail/edit view).
const AUCTION_LIST_COLS = "id,name,description,rarity,status,ends_at,started_at,current_bid,min_bid,top_bidder,image_name,bids";
async function dbLoadAuctionImage(id) {
  try {
    const t = await supa.from("auctions");
    const rows = await t.select(`image_data,image_name&id=eq.${encodeURIComponent(id)}`);
    if (Array.isArray(rows) && rows[0]) return rows[0];
    return null;
  } catch { return null; }
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
async function adjustMemberCoinsAtomic(memberName, delta) {
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
    console.error(`adjustMemberCoinsAtomic(${memberName}, ${delta}) failed:`, e);
    return null;
  }
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
const PROFILE_FRAME_URL = `${PROFILE_ASSETS_BASE}/frame.webp`;
const PROFILE_NAME_CONTAINER_URL = `${PROFILE_ASSETS_BASE}/name_container.webp`;
const PROFILE_AWAKENING_BADGE_URL = `${PROFILE_ASSETS_BASE}/awakening.webp`;

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

const KARI_BG = "data:image/jpeg;base64,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AABSZCAgZG91YkBv4AAAAAAAAAAAAEdybiBkb3ViQG/gAAAAAAAAAAAAQmwgIGRvdWJAb+AAAAAAAAAAAABCcmRUVW50RiNSbHQAAAAAAAAAAAAAAABCbGQgVW50RiNSbHQAAAAAAAAAAAAAAABSc2x0VW50RiNQeGxAUgAAAAAAAAAAAAp2ZWN0b3JEYXRhYm9vbAEAAAAAUGdQc2VudW0AAAAAUGdQcwAAAABQZ1BDAAAAAExlZnRVbnRGI1JsdAAAAAAAAAAAAAAAAFRvcCBVbnRGI1JsdAAAAAAAAAAAAAAAAFNjbCBVbnRGI1ByY0BZAAAAAAAAAAAAEGNyb3BXaGVuUHJpbnRpbmdib29sAAAAAA5jcm9wUmVjdEJvdHRvbWxvbmcAAAAAAAAADGNyb3BSZWN0TGVmdGxvbmcAAAAAAAAADWNyb3BSZWN0UmlnaHRsb25nAAAAAAAAAAtjcm9wUmVjdFRvcGxvbmcAAAAAADhCSU0D7QAAAAAAEABIAAAAAQABAEgAAAABAAE4QklNBCYAAAAAAA4AAAAAAAAAAAAAP4AAADhCSU0EDQAAAAAABAAAAFo4QklNBBkAAAAAAAQAAAAeOEJJTQPzAAAAAAAJAAAAAAAAAAABADhCSU0nEAAAAAAACgABAAAAAAAAAAE4QklNA/UAAAAAAEgAL2ZmAAEAbGZmAAYAAAAAAAEAL2ZmAAEAoZmaAAYAAAAAAAEAMgAAAAEAWgAAAAYAAAAAAAEANQAAAAEALQAAAAYAAAAAAAE4QklNA/gAAAAAAHAAAP////////////////////////////8D6AAAAAD/////////////////////////////A+gAAAAA/////////////////////////////wPoAAAAAP////////////////////////////8D6AAAOEJJTQQAAAAAAAACAAM4QklNBAIAAAAAAAgAAAAAAAAAADhCSU0EMAAAAAAABAEBAQE4QklNBC0AAAAAAAoAAgAAAAMAAAAEOEJJTQQIAAAAAAAQAAAAAQAAAkAAAAJAAAAAADhCSU0ERAAAAAAAEAAAAAIAAAJAAAACQAAAAAA4QklNBEkAAAAAAAQAAAAAOEJJTQQeAAAAAAAEAAAAADhCSU0EGgAAAAADSQAAAAYAAAAAAAAAAAAAA+gA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IiB4bXA6TWV0YWRhdGFEYXRlPSIyMDI2LTA2LTE1VDAxOjI3OjExKzA4OjAwIiBkYzpmb3JtYXQ9ImltYWdlL2pwZWciIHBob3Rvc2hvcDpDb2xvck1vZGU9IjMiIHBob3Rvc2hvcDpJQ0NQcm9maWxlPSJzUkdCIElFQzYxOTY2LTIuMSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDoxODRjYjBiOC05ZWE4LTgwNGItYjVhNC04ZGU4NDMxM2VmYzkiIHhtcE1NOkRvY3VtZW50SUQ9ImFkb2JlOmRvY2lkOnBob3Rvc2hvcDpjYmJhMDE3OC0zNDQzLWE3NGItYmNlZi0xYmY1MDQzZjk4OGUiIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDpiZTFiMjg3ZC02YTUyLTAzNDctYjcwZC0zYmFjOTNlNjI1MTUiPiA8eG1wTU06SGlzdG9yeT4gPHJkZjpTZXE+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJjcmVhdGVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOmJlMWIyODdkLTZhNTItMDM0Ny1iNzBkLTNiYWM5M2U2MjUxNSIgc3RFdnQ6d2hlbj0iMjAyNi0wNi0xNVQwMTowMTowOCswODowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIDI3LjcgKFdpbmRvd3MpIi8+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJjb252ZXJ0ZWQiIHN0RXZ0OnBhcmFtZXRlcnM9ImZyb20gYXBwbGljYXRpb24vdm5kLmFkb2JlLnBob3Rvc2hvcCB0byBpbWFnZS9qcGVnIi8+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJzYXZlZCIgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDoxODRjYjBiOC05ZWE4LTgwNGItYjVhNC04ZGU4NDMxM2VmYzkiIHN0RXZ0OndoZW49IjIwMjYtMDYtMTVUMDE6Mjc6MTErMDg6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCAyNy43IChXaW5kb3dzKSIgc3RFdnQ6Y2hhbmdlZD0iLyIvPiA8L3JkZjpTZXE+IDwveG1wTU06SGlzdG9yeT4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPD94cGFja2V0IGVuZD0idyI/Pv/iDFhJQ0NfUFJPRklMRQABAQAADEhMaW5vAhAAAG1udHJSR0IgWFlaIAfOAAIACQAGADEAAGFjc3BNU0ZUAAAAAElFQyBzUkdCAAAAAAAAAAAAAAABAAD21gABAAAAANMtSFAgIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEWNwcnQAAAFQAAAAM2Rlc2MAAAGEAAAAbHd0cHQAAAHwAAAAFGJrcHQAAAIEAAAAFHJYWVoAAAIYAAAAFGdYWVoAAAIsAAAAFGJYWVoAAAJAAAAAFGRtbmQAAAJUAAAAcGRtZGQAAALEAAAAiHZ1ZWQAAANMAAAAhnZpZXcAAAPUAAAAJGx1bWkAAAP4AAAAFG1lYXMAAAQMAAAAJHRlY2gAAAQwAAAADHJUUkMAAAQ8AAAIDGdUUkMAAAQ8AAAIDGJUUkMAAAQ8AAAIDHRleHQAAAAAQ29weXJpZ2h0IChjKSAxOTk4IEhld2xldHQtUGFja2FyZCBDb21wYW55AABkZXNjAAAAAAAAABJzUkdCIElFQzYxOTY2LTIuMQAAAAAAAAAAAAAAEnNSR0IgSUVDNjE5NjYtMi4xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABYWVogAAAAAAAA81EAAQAAAAEWzFhZWiAAAAAAAAAAAAAAAAAAAAAAWFlaIAAAAAAAAG+iAAA49QAAA5BYWVogAAAAAAAAYpkA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";
const CLASSES = ["Berserker","Warlord","Archer","Skald","Volva","Rune Fighter"];
const CLASS_COLORS = {
  Berserker:"#e85d3a", Warlord:"#c0392b", Archer:"#27ae60",
  Skald:"#8e44ad", Volva:"#2980b9", "Rune Fighter":"#f39c12"
};
const CLASS_ICONS = {
  "Berserker": "data:image/webp;base64,UklGRhYYAABXRUJQVlA4WAoAAAAQAAAAXwAAXwAAQUxQSEQPAAAB/yckSPD/eGtEpO4TDhugDRti2IJl/P/B2X6I6P8EANT7lYTEHX169+6MRbFn5lbTTksVuZPKyh2pamYmRWr/VenKiZXekqSOTfJJbwwAD0/sX4fniADgDds21W2kbTvPqlqgJZYtMyaOHZp0h7qHmedmZmZmZmZm5mFmnmlmSGMcctCMkkVrVV0/pCSWc9PPiJgA/L+t8sNA/7eWHz8wkde7gSYMjIbsNpHDP/jWn5mJFLvn944fGQtJs7so9nvv+cWTowVPdU2V7vzZn33RyPRahrtJBPbDPydQA0GtKV3yxn/irydLQ4erRexmhide+gXpXAqlwVqA7gouNGNRMvFT0w9eau4e6CGotAcwvJLtksOzjhoKQ4fmnk52j9hLBd9D27UB1R2YhXRCEjx7NtlFOjm/mBKQMPGBsCuiM1FkCTD7sSWNG6W6CSoFkU7KpNJ+8/OEAGDh9SXVncFe3wDQqbPwJJFOKkr7AdwNmEx5TMXNZiLK+KlceWQy/dxgQwGQ6NvGTDecTAQOBL07DwzYSj1OOkR9Lz5WsNbZTrp45w/+Vrp5fjlRKtVbKJRrzWrhkAeQ4A+czPIGaGDUDZlgWglBBLfve9FUrrYtIMXvufPbx44X1Hrddghn/nLDIhsgcALddLC1DEzUDADwu79lJqOuY9Kp1HBOX0+F5QMHhIRXQyOSvsPHRnr6M166Z+QVtY2eOw8+uNjq4E9+kRXBBDQAOGd1BIhXJUFgYwu6k2X5m//8Ow9mFK+DxMERdK2UViJSOAk016s6KCQF4eioQkddnPC1hmxnRTmljKCdybIPQOBFPtukXmu+9gfe8pIinADUXmCUpiKCZfEVCIiAwQCAVgjBVuw6QRf3JhDjnBECYBsR1psKgCBKe0YTSfX85bge0KvWLaijUp8BATCpew6AKCEoAMQoAFcW407OlKcsANXIoA1CAKJWHgAFACSbNwatlbmMMCU4u9KCaqQPZQABkTq9bNoAUEAAFobEpeWkk+jylAYRNtGZAISLf/XPm6EQUJIpb+a0XbehUITV+dhLn3lOOQLidPDev9vUAsH1rdMUyFLFXQepGR+AHydG2iB0XPizX/346jhFIILa3UNeSBGBAHS57Oj9sxQKtPKXP/mLf7JGAcFOjgpgfbkhneA4WRIKXS0HaYOozb/+xffMLV5eg6YQfGKipgEShBBRZmYLBID6E3edPvv+n/rDpX6rhcI20YSgttrC9TA6JAAigOzAtX/4+fdcamw89I67LlsBYPOPGgAUitDiokooAC7e/bZ7rlUuf+Bn/vj7S06ho1CLALX1+HrIH9sPAAYApE3NatKuPf4P3/f2d69oUaLTqT5ABKIgWlaPK6GQD336lz84W3GgzhohhABAEEDVpW4gd+woQag6hABhNs4qAK6++NClUxdTAJVeDrWQgAXMRuWIApGqXaucazkA0EE+DUGbcwCE655/PWaP3QlAjFgCAOMrq0Q7ExOvWF8Ib2UpxfqWqLlHl030pZOkMFsLJmdGIgWAujilnQKABBAAW1pfD6nplxIAbQMA6F1dbKKdqYHpQSYDpNCc+uBf/sU9Rj1/f0Ud+2Y4Sj4jYz/51i8dChQARsMj6OA0CGDdUzegSy+BgAjWACEXr267NnrlN//T16abWV8omc1P/e0/Pl4oXWp5Pbd5AnAismOv+bq9B4oeCXhRyQCAUxoCFc8N4Eb9AxAA6ZYo0Y0rGxYAqFMTh7/tlY112wdC9TXmrmJ/71omN3oIlmImkquRJEj1BJoC0i9mBLAxBMLZeu5GHHpbFIivNshRbDSlTYU9KYTJ585USsYpF5W3UbrT3yjmphJRQDF15TOiRccIfIKAGXxjUWANAMr9RXMjIvIwASC7BRatFQBirecBC3/+h6eavQNQwtx8JTrm10u5XlgNjuL5P3tbC4TAg4hA975iGk48QHj1Ugk3rEuNEgGaKptXty0AFQ2/yIqsfizM6vrCVCAK2elsbS0xPUUfhFPPnmrWnnYxQCJuhKTEVy/QVyQllwv8G0PYKPpC6Oryk3NVB8DvP65g9eMLEVC/EE47iNrfm1yL/HJ/FoCS+y6jsfhsrQEIsFX0IPHGsxe2LUH2c5A3oW00SIKtCwuJbwiUDozAGVwTBdTnL79UATiyz7827grTTrRw875NoL6Snu4ViMhkSJXKmuqTICTVKyncrJg9dKR5/QtPzpR9qPEjcEZQDQgka3PjFMrgydK6HRgZgaNTs6diQFqDX/1mIeHvyTC97wu+6+u3FIjRotM3hTiTIcV872/+3V+cTMGcdM6s+tmWISDbl5sQgq/eX1vdc6gGgnLvFbQPf/t3IU6AoN/lv+mtf/idRUI44jvctDRXDQEMH3jJL78sTFQR0rzWH4ECIF45X9NCt+8V9vzRQ3Damfm76h3KX/cjamvdSLPM9Bd8Qag1iShp7MjaaggAFi865G1HcPp0ZbxXiwPgts7PQgCcSD/2shLaHzwtHfKv+O5g+0ovxIviqSOkQFS0WbM3B9uoDPgOiplXjMZbvaIaD/TcDmMFAOoLDzgCGBg+fSQGRSf3LLBDcPhbJzfuK2gVZ6u5QwqE9KhqjJ30yi8aAAVo2uIdReFz969YgGhPVh6cHxaF9MGx2zynHLbObkkHW2/0Vk43XkLlnTCbEAUenMlxR1SY8wkHWH/kCCgPza5XIWQbamdPv8op4W0HZgQi8sy5OjqSPioL8/tg7IFxAQGvkNHYcbFaEAYTY+DGqfntCnyiY2v+aWoo9BJU0Hj4Yus6foBqbQXQKO5JiUApEjst4uJFjSr2FAWzp6utLegwApUC7GOPD5tm89ylUyeUjdefaUQQESTOZrDB2prAuExClfaJrto/uSqf5WEN+8jFVizA4PEgFYaMJf2J0chtLqYf/2iQNFbDF7aQJK62uLq2ML4etK6twajm3fFs4IFdkXf/ym/ft/8FwsuPrtpkFfjy4818JkBcd0obLU1nXCwKzlE3m+I+/cErTx5MfDv/PMi1j//cr1MJunvl/W9VLy8J5s5sS9PG9vgRha5+432zlTAJZPM8aL3a+z+BbtOZvtcfdpRLq4kkKxs12/LZJtwJAdLZhVjFvtSXHbzbXzOqQ3aFXmbyNT/0BYZ0m02RZHF5w5GgANwRJYwDsZIYlWzERPhVP/PG4RS74Rf3fc0vfXFWIDqliMSurIsvdACJHfbEWpsEdHULuszrfuzNkxnVhXDfD/74pAghKIRQSbiyaSkgIdjpyNRaLg4oTiC09vBPf/Gw3wV/38syJEGgmFFImvPrDUcRQKhuRqAggHaCxHlQGgCo7PAPHva5cyo/KBBAgN6skdbGpYV1JdDYSQUBYeu1rKFVZKjQTsn2oIuumSUBECgWjEuefWDxgTNhWtWbTgUKpG1Jqxqkk+VqrbbtUsn65ePjRjlFkzIdhI/OJdKFRNcVBCCioi929rH19/7IYFrV6onKZALEsS70Rro2d26h2oqdlmYtUzZbKqeCghECYPzAbBPdzGw7QgDkhiMmze2tK3cZDWuRHbhtn3t6Y/rIsYhbD//Tc2tW0NHI5TBjgkEKAFH337VsuxFM/2JGCQnRC+dqgEgcJxZApuf2E/X02pV9P3KyvzTw4mG7mXRia2O2PwiieQIEez+4rNFNL/OjEQHAsXW24tCRgJc9fkdscWzY+rE4i/54oYWOYheeSatsvkmQYurPG3T5dZM1I4QwmFtLOglUrnTANfw4KC/auiKZw9PVTkgadaVzwykKRdUvW9UdSfqnAE0AqZWlVieYfOm2jdV+6CB56HIGBNjz0BY7wTmkyqO+gMpcWdLoUhwWBiQA4KhXmtJGrzh8Mq6EEL39Eft+52kQuXX4uhNg8pMggXB9sY5ui/L7hmEAqqKNXZsuTr3EbqcI4OGzg3c9uKQAgJl8oNiB0dBBCKFa8xXbNcCk9/Y4A8AM+SSAcPANsAEgqv5wTi/MPqsFpCCbdbFr80qH6gJQXV1rYRfSK+5JeSSlZ8yniMpOKWcUAFzYyCDenHcpAUSgLq01Aajc+AQsqOcXarIbwKA8AQUI42dWY7TWXWiJ9kcKBrDNVpkAgShVjwVSu/SUUyLBcCkgdqdKDQ/DAeDK5brXWM5qABC1dK4XgLhmMSUkwPJmxUqy/lyFhB7vDYjdajLjRasEQKU21NzOgBAQD/sBQAWbGiFIILW+GrvmlSUAGJ9ME7uWfmFPRBICeW2Q1QJA1NrTQwRUkPL0kBJCSG/TtTZXAEjpYNlgFzPoGYQADvjugSJIEpitpgCY3KvKzJVAgOhTyco6BKJnRiLuJqggnwPEgfuNIQAqd6qgAIQ93zGdqBGChKio9tYNRYWe4azC7lZesQhNqiooIITXLpfQNvqNe1davaEDQOaT73y7XaglYaSxy2nCPlWJsRinAJDA/Rm/LTX1XTMXqnqYIACT/vCX/Pmv//0lR+z6xupdj5aD4JhHkk547TMtTwNgbnvcPP9sXkkby7863T/Yk/Ow+2V76fR8I/9yUCgxMp9fLfcZUBBVeHzz9GM5KgJQ/3XEwy0qrUZdinu1QCmw9OSJrx/qD/10XN3GHa9I3qWUABA+/QWZWwUAo74MAaWY9VpfMz00OTMzVl1NZCyL5aUIAMjaTw7w1tG5iQYJgr0rpTfCIYgKhDgmZvJheEIA7p8OmlvH7xuHAxIX5k/X7Z68Ejgo0nrVJ/9jowwAIo+8KXPLMD2hANBywL+0vfqmJAlBwlHjs1feuTREASjVX5k0t4pfGhUhLfSoW09WcSwLEcBg9b61/qc3czlHwMlDX1DiraGz41k46pqUXz2a2OLe137J3jAFVJ55MBkwlVYlrxQADGQB3hJB/+1w2neNoDwYOdHp3j37JybSlQvNPZGCi+efmGebmgiduxV0fiqEKNlWBwd9tBs/nckm/mhGAUCydW4upJCSztcT2X2Mhg7AeRvrburOPtMBAFVT4bpxze3xHQDk69btPl04bEXZpYp60UwGO8zwUEEISrq3ldwC+eNIzLUB5MeKZqeAsJ8AgZGVZe46SOKZ+cbLJmcKBjstdsszIC2r7z6FXW/X7z6RPPSy/aPDEXY+qa5lKdi++w9/54ndx2j4gHeteIdLmy7A7z9Bm40fq3jcfaDvUbygRnSTmT2XEKWr24JblYjR3SD3K5oR8d+38r72Oafx3/oT85b/vTUTwf9tAVZQOCCsCAAAECMAnQEqYABgAD6ZPJZJJaMiITVarVCwEwloAL+oVg7UoG+NtcPfbi9LH9+3afO6abvvM8+m5i/eOcFkH6rMKPGDvt4ATucsr7G8td4WtAD87+jBoEetvYL/YDrgeiJ+wC/dVMs+Hi2smJb6Bbg5FInsTv9URfZzVTdEDOVujrt6YBrDvBn62gbLehMaxNVsBJ/8Q5vcXoIpXoZU0itdIpALe3upBKfyS2dyb0CTU9y4SXCJ40KTUPBZ6RDgqzdlMxFnnQd14AcHitfXtaK5xoRJSPyzjiksXLMKsTz2jEkjKgE15DLrxmd4v1vSlk+BhgYXTpDlfDpWFk0yhE0iVAhmSBxEJSmoKqQU+sUjInmBm9nq856VGFVa/c49daU7wAD+/vW8JPXb6kktYQIlUDf71VBx/yXyx+P6AEKD4tfeQy0+LWhmDu9xogzM7rscVAXUBoStjnBTJVuvjiGq+52Wb5OFO8diQIMOWJZ5W2DD8dmc9w9tmzJH6FGgptof1OLAy32Etua8kJWz4wG1tGS09BZDXo/2ackXc9NDc15KeJskN7xEBqAPLX6bXw0e8Y4AvsAhqBLnpaSnh+Aw+T7fLQQW6470av1C/8U7SDQe1RirzKRat+/SbIWMPbDWOLRj1y4F1ewRe3ISgZYlBFlaJe8BDqf/7uDyzuDuPNNrMTIAIgcsV4F2KwDv03wtYN+bO93+7VdVPzwyzgfWqcqoQIxH/bFzd9O28M92w9kUkpw7Fgv3Ha5tRC2BDhs/Bh1bfynxFyb4YZcrwt97qU2YfhDTkqc498eZljRYx4EgGVGUtaGXBTVPNXl78CPhG6AJYUVUJvepZjG8ficjpkJ3XSs8tU6nS5/bpTS38GfFQTOKy4khc8fwx4np1tHJp5TcSOKI+FmiznTyh2yZMyEls4ZQJ4K/rySK7KG5gHSQ4aXnEytdq/5Omi5SxOG6oujPEGuQc5Rnp4MkFOzeHeTT4mVtHqTz3bgAIJ3HU/KA+wVcywUbWKNlbclyS2oHj2N8ydUPjBR385ZVN+2zjp6k2fohMcs/HMsybu1iZHBADZf56dxHM2kLyroa9aDvtzYRFTLZCN62HANUXRsCFw2xCKEGkfEcdRr4USbIXAjP68nVELd7d5YuSd1LtvuqXPqUBW6QvkAu+vUlM0RyyvsFj5qnYYcVLQpuJiqugxE+343kq5NWB6H4xDZMiV347X1D7fjrgAxAEfs7O7L+/+B0haw99ebIyPgicnyxv+UrcIekmJwlt8UpLpC658yW5e//6Gkz7VPXEkbNEmjV56+hL19qr7wdeoLHFN7VoOlH7ITOBdqiI0rahY8mdv9P7pbdr+yAN1yoaoM2If+hlrHENns8ctxwLmUU6BGxOcbS/fjwImltI/FOUgMxvzp7YTtNlEFElMRESOmbNhgY2SMOort3WtH6Kk0Gf5F0Oko5EQ2Eclgt9GDuHiObC0WPFp3MB8XD4/dlAe5WxSHVWov+AdrBotaWr739cVh6iAWqn1/3FOAaSHxN9hfcbOOPNFVTL6ILjCY5rkuXmdfLLPsMF0Zps4hvu0PGGYlks4M/84r56+lQ+Q25Bkl89ghrK0Q7L/MwNvW00a7TJguYukqdzYpZnC62CiY9/EREQ0YmwvnAjrRhcDJVgWplWzzIKXtCpXhoHsA6wQ1NuJMYLs3RCTcTLmi/U3upCXVGu6RTGsFQ9cYOgvRjpiUt/IIAHe18/xgSXaEQ2ugpzOfPzWqNWdWAAh7cmb0bLMGCkov+g2gtt0XfWukzypFVfuzo/7KGHXfcJZfHo7GB+SeGmz/oAa441B2Hk9E2so7DB5nX8c2ryDurG0fmS3ln2B+GXgokn5Pw88uVlkKxANoH95l8OpU4YvqzYuayPUXZ9NaVxk2+8UK2EpIBJAe+qWZ1ARzOMgvnqOXF99inCE4VCEXbuqs/9wuJUT+6pmbc6pIvDX2HyfC9gXxNouq0+EYCKuazaEoxD0Tf/5W8OZU5Zm+hcMiYG83llvvz/iyr61Sgvz2g3Jdmv9e24+mKnmXhwFMKM9gC7d8XLE/KJzc5QgNnGVO+RwPVnFnXfmCJSa0jT/0DU4iamD36eG2jgdwgyt9dQFnse6K60O8Mq0rYwkxbfyeL5qC4DsD/omKIDOes0kRzydTKm0Q4PO7GoVXgFD3UbMIymxxjD+Wqq03WwAO6C2/WpeevO1LPd5e8EuhDv9hNuemk6aDX8UtA/YaCcmT2sJALTJEKJKom8rztaeN8aaqQIYFt49qchz++3oD9HWjGyiZK++UU0s72s3Rbl49EK3tlKQoYanJmheWS8BQVX4OXD1yjga4xUk8LTkNBPvnxP/wVDOch3UtdM21rv0hGu/6sLJLGTB3BXBf9COrO8YB6VKNmNotSRb7sX9btzvcwqJr6sYyAx+FK6DVAeGgPJo+RzuhUw4W+LGqjP3PAbXPIdqZptadnAuSa4vXID4sTynH2VS3MTkzuPY9mwVdRbnrGt1nRsbYgIdhYiGXk4ZSCIyIBPRq9WoNbDUfpQ3d13+7OHjOWxQ9n6AYYYHYNMednIFe5K29A5JzXXcUp+ITdyzEhsB50LYRvj+q/cD0itQVNCu3mT0foWhcBWvcsiqhBOWRtuncEJI/vS1Ds2tBv7BDNUpf+9n/28MtjCHATiRneIfrgSbC5chLTivcljs0se9zjyO7lkE394xbY2p9xzt9cG7q6329o72xESDerx3pFk9Tswun5qoQr7y4jqQOmSfGYAi/5IqF40KFpUhaCTALqUNdMt4PrnV9Gjq5bcyFi/EbCZnql9E+sRQPBJgVQ0N3YXcp3gHtJ5NW6p2xgciRzhKwGc5VVDp77dAABybHJLohLhD9XYH89YQyRJYVfORpfT/n/ksyaqveTAMAIKouoC2p0n11ZGhcC9rayIS3vuOzgf+h9tLODO1zm/720f0gAAAAA",
  "Warlord": "data:image/webp;base64,UklGRroRAABXRUJQVlA4WAoAAAAQAAAAXwAAXwAAQUxQSEELAAAB/yckSPD/eGtEpO4TCiNJhtaWb8tc/gEjh4j+T4A0+n2SSPXgs3vPx93+yDumXrttgIoE1EWk1XhH4ha2pd4BU5dE+rZfrXqLbfjCtm1tW2vbzuu+b0lmWw4aQk4ct50jZcbJzMw859LDzMzPIjMz44CHJnM7sIzhpokpiUl0XwsdJfnBtYiYAPw/MRFReIRSisJGCpYMjxwsJi0OmWGMlSSFBtPffSypwiUTY4eGLIQ2kn3dG6pXOUwUGzzqjUfCI5KFqZf3NHN4zOyewoUJMzyQ+WLiVM/1QyOS5RncKIjwMKUqSDobvYDDQbHcLs3NLEJMibIVoNlwNIWBrKE5AqqpUMVnogAadSfgEKiB2Slo0YyHCWIqW/WgV+tuCAx7Yg+08jvRMDHnxt1uhL3bbZ8flcpPHgATnO1IuNKV1GoqEE7d1Y/KHDiBQBK2HRUqxErGuXqGRafpikejUrPwFWlqsAgTIHZFn/23AaHR3oyIR0AiWihDMoCaCBlKueW/DIoAaolHAZHZoVgEgrCcQKgDMVBq/eHF0QGWyCp6aMyyEGfJEhSsZDhUHMTm9B897ma7GpNZSzwscGQEBBDTZjOLcPu6Qv/0O7dT5bgf3zEUlfRwpJlXBBZg2vDjIdNBcfArv3Qj9pq9mrN7cglFD4GUNWazBgHAHTLDpkeRL6r6f1wVWoJNwQ8B5mQBRCwAwo20CBnrWKcwFWtf/IzDxDC8gB+IOs6kBIMBLbdWRxByLaIdTEf1+jc2rYAYrW1PPYhYXTGYQQCzWG8nwgaKwhtJifaV88MBdIBa2xYPcmlDEYOIIVAVkdBBNqPRrOGufuWkowMtgvWpJN0ffeUOsQcmAtgNzNAxLenpQoTrX36DUiwUdV+VUffH/3JOrPcI0ALUJCN8/tV2shKnzvVXPBa4Dnl4a0Y8wD//Ha8KUNBNigs3R0X4cJOtWVt51Z2vU61AsVqCvj/9ud+53ZEQLI3uU0Mmwj+w0lGTowbaXTfScnzuRAUewK32TmuB5ojzT1fQj4mNVSpOReF5W8lIQya+4fl8fxDGMALhpNt/fl5RP5gb88iU4kIHPTPPjdavuBr3L+JjBku0Vv5imQX6UTSu+2oircCgYnr+T3/R5QewBsrQxF//clUR+rN9o4rSiAHWjhnhp79GuH9KTKYAunPWRt86aw0Ux6OAdr20nfPSdH/GSBlMeBpW/3i1OzozkxCAblnpifiUeX/x2WFotf1sQfSPX18JzEpWMQWOn1LDZ2y6FxnJ0RMBSzzrRtG/JHOT0r3SbAHxXd/3Zkk9/15mIl1iaOGez8cMIQhgDoIgbEyUi8gbtbqAyLzhuyp229N3EZGc/ujtKoC6rgybImoKzdvrzY4OGVhODFlds2aJbmfoHZ+2dTcAqXQ04vfEdLsFQuMdZ9RiIRlo0tb8P1YdIQlkmAiCcMAsTMvkSWGrzatn058y0m1HG4NzO3N47snPvkeCoEcHx4oAQMqa7q07RlRCJxR3HC8cRm6OkscIAJ7/u93Dtr/tWZWfG4as/daiZycFO79XHzk1aCkhGcMfTbXGtceiUik/fg0cCpV8LK6kJpAWX7qQFdG6I4sfm1/asF817TVa6qmbldbSvBVNDGRzmfzwzlGACN3lZzw/QChlMOV/5q96HLHHJ/QTKmF3e3A/YyXx2KdGkMC550dMalXbRmakkPJ8hoHehfnVc5ergwohdRd++Tt+tAtlH/h05VI3JeORjFpeF4nyadbU++KAJNOM2ZPjJgBof/nyVU/HWh4IIfW7z/RskxB0GuIV5dXViakDql5d78TGBqHFlUY6mrYL5fEeAGY2lh6v2WmFEEvD1Gy2Pc1u41p+V+JL9mjpWEWenQ+Kjlb6q2Pj4xMzQz6gQQwsPpNKC4SXZCwRlTvf8yf/IjS4vVI9PvTcE/ZYdvTIyD/XigAW/DOHK3GAfaHYE0KYOW9Vh0dE7eHCjvHP/VYm4wLwttZGBlf/8Subw6X03q6TrPa2+H2vSgBBIIQIQBbY33bTIjQUG927y9JP/r2btwCAGaa4dvnGzdrUvo7R+sdIqXxqB8CBIV0JQbJz65lbAyMWhcbMzh2B/9cbpYSgu0hl9fbNrVa7PlNZtq32oUENMEj4iKJ9p754q5XMxyVCS0b5BIJ2IzDx4kRx+HJty6X6xtSnjsYBMAhE2F6+emPLjQ6nJMKdsjQGJmrttqfvglMdyOzzLophlTg6C3AgBAGdhcvzm9ZQxpIIu2HuLLlG8Hd/98LGlseauXO5uSM2tmNq3PABZqF8ybefudKKDKUNQj9qzJSB3uq//MWK0yU36F37TGTyHR8aADSzEODWtUuLYiCl0Kfsrs2/7tiokp0nPsvOV3ssuWcdHAc0JAt01q7N140Ri9C/QXupuKuS5WZsYXD2sp8ZLBQABKQAbN5YgoikLUJfB10jmogo9qXfftmu8pgPaFLA5q2Ly6mPvTm39U8O/isUZnygMFWZ8AEtBLZXLi+0zPye1yXjy5ud/iNppYZLB3IGAC2Ed/tSNT7R9aU1uD4kWjHZb6Ri2fG5owdLAOCvXGzeaWYO/tChv7+uVbSArUaa7pKK/ID7gcx4JleeIABw1q9fbsggk80dmUbZqXa0iU7dBgCZKpbg9lyPQyYiiYFiOd8FgK2LL6zBzloCiMcsvHZ0daW6RNVW/C4j9/OP/8elbcDtOiI0JGPJocmyzWA4a9ev11JZkwBA6PlLR1/yynLtc796y5g17lKF7z739iF1e2XT2crFRTjISI7snokA8GoXrtZ4KCXw4la893h1dOLE3uzlrzUmZFQAIjF+Mn78VR/eH2tuv3M2RaEQxt5XAeDu2rmrIp2NSNxTpne86fKTf38levQls3P29srhYkJCRFJbGzfv7H33ydJPvnfUDAcPTwCB6J5bTEQJ9xsZPQxjSv7KU5vFg6WdJwt/882HhhSAntu7fWnjFQeT750NB/EXnjp5dNC38wtbAPG9RLJscSCLteupyFeb0zNlrv358TgA6O5Wo9bbzemiCgV6zfNnxfGX8Z4955a2PdzbGpoFC6xa+bny/E99PXG6xc4nbIAAaRlgEDk6HOBedfEmQXsdTSTlXQTESxGA6bq1YxDBytUFusbdqCAzFo1HU7nxReAzKyIkgA58FQGkSo+WyqwD9rrITIFJOufHZuN8dUI0epK8bkDxPcNWvCyB9SefMcMDIhVLATTy5m/5Pup1fX971Y8BTAuN8WGvl5/QbTWGRs0jdeLV8QBB8/zZK4FCiBnmgA2tjn3444jG/K3NqyPQgvB8dCg62D7ysoH5S0ncqXvc/ZvnRuLdHnMRhHAbkZSEIiDorNxaNT92EJrE5vV8st7c56dmJqqELQ+6u3HxctdQKikRdiKDu9VrX/2n9ZqbmDz2GmgzoJu9hLHyN6Mnp/xEkpCzLQTbrbYLIvQjdZ7/yW/65m+N25lobm4MYMmrgYHm/Je3K6/LaKCyNysBMKNfndV//9O//08CrNwuZsHcvpUX8LY25ud3vIwDjr2mnCD8lxgvFBEQWTkBBsAexg/CJxqOyf8aVHrcgwAypst4UXP0WFEwjHLivwSK5QuspStHKAhejBIzp4SndXJY6/8KkrsCJg5SMxbjnsreE5WBECOeI/vPsEehRYDiXITuRZE8W3A8I7IV6TuRHBDwFHFuQOE+KbVtS+2o9Hqc+s2055xawmQz44HvA5FtHRM+RVbMvlOZA9gcZqWq3QD3K3quLQ1LfiZAv0cP/bjdG96snV2zcP+xyidezUvn/0H0nTE4PpQwerebKfEAMlkq09rautd3JE1JwvdBeFBpGOR6Affd//8CAFZQOCBSBgAAUBsAnQEqYABgAD6pRpxKJiOioa8XibDAFQlAGi8Xp2E1dAf5wN3fzuemyby15OmaAfznta74fG370kuNrGDnir3o/EZM9cXqoFADxYM9v1j7A+6xs5ygV+cS7Ycv49M9LxRLJlB5jz/L3cKuW6ioKzdzvS7dzrQNu/G0EwemlQ17FrfQ5lq+imv062WxUUq6sMBxk0SBDqscdPmFHFOpC2XXl//vJwfueIW68Re0/P7R0d6iPwkONZh7g7K1MgV+rluKA5Rsvu7FLKdcuwITQEGABPKkXRF6I0HD7ZEywPcy3QAA/vz4lu+VZdHAp/izm6kXfvqDmj3fVAuV76OiBV8HkX5FnskPABuU9Pz0cIUd9+Gono43HqJHzdlrvwiP4sBfEtqjWvn/67L/KjZjLC97XCdAaKqB2wVdu/zE02+Kg5lmCvCf7tj9ULQGg1xZer9DEn2nY20fACWtykyZfdb74Suv6jIdSMyQ+gqmOO2D/PR1LqugbNP8u64qlwDX/NKQmz6hti3eHnBbPnQYW9J4A3ewqr2Z4jy/UB57CK0c86rHEG3tbKqCfV2EKeh6t3Dkn3tup5EFiwrEKBitMMkFJTzdiAwWBhfWYEKVak25fJBvi1eJZ1yAFZWqxBoQNrb/9eBLywcsKt/2VuKREfLevQ9z2dfBilu7VBUnbzHUu1oVd5Y+nrejppHHeRFjtHCLmXj8Lg+PnfgMm7VfrNCoWrHkTG4IWkmFCI35xvhBn5Qewuz9+sNx+ZHUjvurQSF+g0n6cCA55REWr/6K5HgkPIZqBDuB/nU0/kWJtPnR40vveMLeLr/QgbLr1ej6WFnjX3AuojM6/KkMTqAm/8fKxwkckt7PfvqMv3a8Ll4TBJmjUqZjKHOezHapZhyon6EnxwapWNns8ii7aHDCixlwUW4lsw57S4LVWFFnT3cpOIjnr1lfppj0CADMdAG1rTWtaH/ws2uXANbS3wkXnNK+bIMZ6X6s8nKA2WIWrbzBlnigQJmuhCqxU3wJxjqOqqINO5eC1MzxbCklCNvekKX5MmEGezGlGoJC7zry7D+JSa119d7caiwjiYaLDVf8i7vbNPywkaLTwMuWwkazJF0phwgQkbzsA0XVcf+jb6WWH1KyAs9OBKfjglHUaSvcb+qCyGxFnTJAQsMu3pHqBBMKZp0SzOfCf7eu43GgZjBxEdNfXcMdve7L9u3VtJP71SP1acUpEpU+qW5sby8SLckeg6QxnIu8Heg/KY7Q1QXC3vHg5dFqr5xGAtcHps80pI2me7M7c0+cPTNMe6w+fbHi3hf+cC2uBDO5UcH4fDR1W8BVRrEDAd0CY5aV4k7va//E+F9X+MGzaWYW7t3KAVO63r5DMGFBEnc7OaiMyVU3iYlr4Fs2Yif+lH6joZLLOlpFPnjBxpBnvkBYVKu7zEcx1enUGVdQcU2b8Kowg0knchxvitYHhXePrElKrSFy3/uv2J5kRQDxnXUhOvJElUjDMGIhDDwTs4zvIveiwg4Wh8WEHQIhPnty1LKH7J+cBCikXt3us4SEj7TwmIxk77S11ap1tjAIVcmjw7N8UPhp3ERRNA5Qqud7yOfrlx1a/RWgYTuQMPGMia9ilM38YZu0fgNFUevYYX4Zl8Y0MFI6CHdh9+hD5Bx6spB4RNmJ7z7rvQYpTKh7OonLTiA7Ah/XZXOhjWTsqE52Dw3Hkeh/8tSoAjwSTPgOYy8CbI1EX09t6SKzbzf6hQ7Fvh3Kw4PhFz1YpeFOSR0HVO3vYmpA0ZqhcBj7VRljPZohKt1Xv77x2iXUg6MASTBo4Mcr5kLBO2dGjYmfk07VTeGVOVq8RB6wSiZDdbUNDuko4IGsg3jVKPrbzI9GvvRXSsgnCJ8Vr6bzRXfyOzJtjTfd0ybN/CQPD7VI/v0e02si1vXjA81N90ffz0bVwPAWhzI9rnyYLGv04/oYHNvu39WjsPoaNtId0F6Nl+xRhfkWwT9jMcefVSAN6C5EnsACjZF2HMz6P5wquxJGz7QJitWJacLN+RFVuaF0HtDSc1gNxZmLacBB/dnyfC8wZRccwOYpBRLpqp/lRq23G4/alTDmVewtoCizkhH1P59/lg9xEvOSteq0Qs8rbpgsWt5HCBJ3uapXhme6GB7zqbUDzkOeVAAAAA==",
  "Archer": "data:image/webp;base64,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",
  "Skald": "data:image/webp;base64,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",
  "Volva": "data:image/webp;base64,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",
  "Rune Fighter": "data:image/webp;base64,UklGRuwUAABXRUJQVlA4WAoAAAAQAAAAXwAAXwAAQUxQSFQNAAAB90cmbdPWv/XtjojEgXwWcNi2kSONPd50N9N/wZs+NBDR/wmwv5Y78irTSGfJdhHBZc0xxthIYxcRHpvexSXQ3vATLhxAa40kV0GxRriAbDyqIhEPAWnKDWkCMhNQGBlHehcZQWoFktLrXmuSQeKEdACIM4vonZzA4RA3ZuoDyz7cjlU38IvR+qZcpKRV55kdZN6JBPzKzEgS7n4nuQPA3S28Ydu2PI39f+d53/fz5HmSkCAJWigt0CnUXZd1ubt+3N3d3d3dZbn7uM9sa7XjM+3QVaM0FCgaSMgj9/UiISUTts/nbURMAP6vS25udBKOs6mQt+O2793vq03E+L6v6lJdh//7B7ObSXL32wZS9ajWE/+49ANd2DzZ8U0vvL9H1SKZ2vfH5aUfym0m/T9rP3Y8RQBMJJOZHb8wa699U2YTUUN/auefmhcATtcrT2WLPzkoj40Hmwad1hMft3ZBa9L6O/78b7aXR0PnE9eoyU2B3pZX/P43bASvDC+UlsPf3RND8ImA2TWneaiNYS3T/S0Pr8xaC0hL79o8XFcDIoXE2Cs/6jaPzvXDWE1rkTz1lVghgJLe140aVBxjAaRHd4/9ydpS3DTO6F/ZUrrNqDjMfdtKGHplAGgvIV22RgBQdT/6dafEpkls/+jP2r1j/S3O4p7vKtjYCQBB1+OlpIUioGCCu6fhQjeL6v+ZY2M+B+/Yt/Wbv+lFa6BDAO75RYcA1Mqyq649GGayp8Oll4ribdi1hWioyEqsxw5Gk3BjPwBAJwYVgFKQm/1qOZ182U/nnHXYIMdPJlVdsEiogIGysjO5CMeaCMAKY5CA0MGDUy25ZOsaVQ16rqsbQe/424bb1XoKjPuXY6UDgMM5H9BgTDAZRACEQHFh35HVXc602CqV6jrS5zSk5QNX//B0TtdgMuchKMDTESKgqzMADc0asUY/gghAkn5weupWEAKASvW/8W9GG4LsG6/0dzlWANDb8rbt5Yl75hN+pCqA9koiKjIBUF5rNaAoFudmyvmT8p8jDqo5cKzrgc7GeMe/sjW2QZUkD/+UZfLiuZndkbMGxO0IoKD9GGVqDVEYv5bZvTsnj9sMa6iTVp5KSkPU4O8dE7smJAKM+BXb1xnde/GoSyuJ1wws07p0iPblWQorF27s22NF4hfSGgAIa6U4zcag9UPvZyi+qzi9nGECkUrOPz/imBhuvmUOJBXRu+PmLS5PukcTYq0q30oB0FYMYkytoNGJ3Z0VOK6m4xlSKg7GhrI0JYpkyoLajB9p87tzroUCRAwJxBUSvKSkQeL0bfH9BGlTN9YIL9Z2eHcavhGg17dVBK4/PXl8CBASyqa6V1xQ2QjQ8Yu5RkFlhhEuRCy237gKq11opq9DpQA69gZB2LlzX5czJygKQLzkp1470xqWtSJFbs5m0WhrtiaU2NLKocJ5EXGgkCtVQLB89hP/doXlwiPP3+p7134AFMLqic6Bgc7rF2MBIn3ecRomU09HSiV8tN96NNQkATc5A1IuPvVRHt67fLngvuKb+i1BgkK9nHCL+USvIxJZTC/FDdNRWFmOY848v/DAf19eocDKgHdz8crc4vS48VNWch/60SQAAUK1GpdXsgl0ylOLKoZGztMN8zuHDVyl7rox/40//8W/uUAr8PId6nIaUgFA/72/588Ws/1iGMYoe36K7Awm56AdYrDHbRTbRvcDJsH/nA+Kl+781z9/VmkCVucOGAKA8vbuSSwtZ3beXLQmZOwmoJHF0hIgQO9QslGqZV82kUY5+scIRuuEN3SGl4tLKwvYYlDTuElVDt2WCTkwImxZBaAMbASBkvRoVjfItI3CKuWnPpN1eeZMQHWn9mwinW1VrFWtPd8gd1xMxURiEJfhp0AA2NGxcTR+qysmOwgC4szekdLFP9o+s3rPYoKopmIVVSKVHRjtMaOrgZE4ZSwWZpnvgKINZHBPf3dnq6c2JL37zflstJADAAFOtMvEmXf77rUnl8uhTSg/pR2CJpHpGTuxZ082d2OZWoMkrk35wx0SBpFm/p3f+93vPT7sbYRu+dGJhXB1Ya8rAARHu2RhdrnnXfOPfOXstOjt+709IJzWgSOvPdpntYALkUerIbg533FQVcS4Gt5rDw/vHPqArzaALSc/fUYUFRQpVm1JIZp4vCLAzNnzF/Pv3s03Tij6h77tdHelYowHiC0sQqxa+tpS2yFtHIKggcG9R5PYSNP1qtR72qAgEHD8nwpWbc3FhFXoisaeeno/Lli6x37BQmtAKyA893gRCpeeW5r46LQBAUB46xPP5fWGQGfPyrs7AUpFLvzIR67E7D3pC21k9xydvrD/FY9dFyft/qIVwgojAWYLNycW+eKl1Yl/+dspCiDA+MfHFbHBLDzFtxPU3urn7jJg9uDbAAIIyuOp/IeLYbqz13N9CwKKCgLPjk/723Kkv+9OUASYvDOVwMavTU8PAaQunC0AcDJbGS2vrYU647c8+TW43W94//KlnNKoFpEI6sFHbuRcAB2PzkIIjM86aKAEiy4iS8zNBABASr53Ls5kgIufK+vU8DeLc8l3raIIbQw1/cfvNCGqk5NTqC64qhGI10JoibG6aqsAZ/An0rDR6tlPFx2kx3bExo73m1gAxDCXf+Udv6NQ010pAQJZ9NFIuqoI0QqrkdSgm9+WDAoLZ794TlG1jXQJvXueH+2HBWEf+vS8wfpxBQJG+JsbDdCZfN8EVGwBQW0m+k8pRvs4o0xm6xGJkZr84gtv3eV50eIDnyxp1KkNSFEHHy1pbpTu7DupxUIDvsNa0JnuwPpboJG74zX5ENYMFR7SXa3JaOrFKwZ1aj8NAOoEnYThxrBl7xlfRFEUUkm1Dg2nPp88fyHRfeidnTZWtP2nV790aTGIgrUIdWXbQJBKdZiSuzGq5Qd/KSG6JAS6Ws06kPDWY67o0eFeDQAElG/nZ4sVGJh6nNYMxEbzBZonf9nhhjB1ZE9GzIfnAeR6vfWgdZzsPf6OLbDEuqrNdXUqiYyqw2RcEVX4l9+QyvRFBxtrkkkd6n97AJDW7Smuo9uHTm099ZZOAcAaIlbcnpGhvaWcWY8mramir3z4Y1RRhRtUe/wLBWU51KbXSez8o49l+nVEqQ0RQATZlBe0cz2VyJuY43ddWkKDieLTjwAY7nHWMV0n96oYdVeBcWTTXh2mdSCmffi5EiiNAYLCYysaW4fTrMW02AgirBJAUC2ANkphXaY797tq9txMjJdgvDwDmzk54LEGdEKBRJVQUNMCyhKatejnh7pjzBUtXwJez568gK87021qiUUsENSsJRbQjJVBbTe/z1XW9uzMm8Y5+Z2dYlWc35GuJRYgahL10kJdNKrW6mRRRTo2M5fWpFEqnzsmwjU/zG3zdY0wgNIk6hYBGKnrHUkNgHrqKpSKDDAxuaYblBh8vRSuXMLBffFgzqlyvAoASH0QWB2h9KqRZFXiaiyYfVBvW8DkVdMgMzr/j6txwls7rZ1BTwGm/cCgpRAA6wEoEPVNZ9IadNtKGssfvnul7z8/+uG/tQ3Srf3DXR5NzzuXApw3StLlTh8KAAR1i0Bg48WpCpzUIMKJGzt9neoe3tFtGkRlFACYfHEqgAent5xHNaUuAcI4dmyEyVXt9uWLU4UlQwDaaDaoThUWC3PbAn+3VmGoRdGyigIQAAgAyd7VkvZGFm4srlm85CUuXpoY8s60xFYrAJCqmgLASizRXDGqVLYuPVQKBM0Yrdjk+delFWLRJAAIIAAsIGJDUEn0L489PxsKmjSCZL4Foo0QNaoF6xKA8LFzF5ctmlWQfMcfWrEgcdtCAAKrbvaWIzQvW978B64iAILCumJLKsKq60ccaRpqYyLXARWEgFAAAhAAEltYQAf/PBmQzaJbB/J2ZlIRAIWoFgCgAARgEXz8s07Ol2ZJDP70e/ypqzcJon6hCACC4Re/7PzQDxnbHCJq5EODx9MdhQXGVHXVFBEVPPRQ7m2v/8CWyGkKpne/8luAxI59o3kQwtsBEDx3of9gKhm3SJrNoM1r8j0eYmx9xV4PVAAEFNaxdiXc0g4L6Ut36GaAszjqmRBAeltnCkS9AoClufYUBBRrVKdpivDmlCexUkrgd7q47Xg1rSBijYRm2UVTMj02dzmmAAQS5rYACMVGdCQ8Nw1pBjCxfGOVWiAi0BsBoUTLvv3oU+0KTRqH1tNiQAACbgAQRU9/7pJoNC110gEsAAFUPSIkBJGDxz8+aRSameFcoEFSAYCISBUgogSYnwlXFJqaCOemQi7e96mHVxStRc14QdqMEJNPTgQOmlziysrUs7/5TT/zz88DFhBYRI/cWdx++nDxzotTyxGaX+LZz3zrH9x9MRpLWwEguPVHn17q2Pma2QcXA8FmSO1oojR1GRARCMK5hYWryTQWLTZT7fuIRSCC9r4WHREQbKpO72GJBAJI6lUpYvMVp5WlyFoJKddj2YQSg2N23qc4ge2+I8tNSCW4ej4JukuzcBQ25bB43UGmMrVQEWzOEttg8oGbpVCwabu5XQcGPGzmyjgK/98GVlA4IHIHAADwIACdASpgAGAAPqk8mUkmIyIhMPocOMAVCUAZ8KIxadvfzvlk414D+H8IfHF7uzjspdAiOae93mey/oF2ZWp8q0ed+wB/NP8F/0fZe/0fHv9XewN+tnplexT0SP1yclK94kv8CcybVJzrHPOWPWilkj/ZazXeBl/QQGwruN8lYVkrGdondyXCAZK2wRu7AVN9qJJqQejbATtj5It4UdLx9g8uV9dtshK5P2dDQV5bNXJv87saboOfP0GXucj/TYuqITcM2pJ5eKhw4zpzpJHCyYmAv4ea8u7uJMgsyIptymmGwvgmv8G1h5NAU9FZCqaJFwfC84XQvigyY883aNDbEXOZPLnK8PEtsGOKTzHcAAD+/TZs76DaR9nhvf1/GHZx3Q7SbEUgyeEon50MDdEROAJ5k2crgO+qdJiERGh0k/68RT3pDSLrQEOJTmRWr1CY2t3Rb8Ke0qsjdg3nJUMj6wPL/uYq3yEDCkRQgdLSn3vctkrh11zslzjPb57xT4gVnYHK6Zd12A3h6z6ppfvpAVjsd0Rl/VNQ0kPP6SYVC+4kTgFTdwEFxB4dTT2uxYOFLP7AVKCyP5AFOpKS6JnTM1hG4X3ikXWYGxSTCqJ939+JbOfu3OHlTdfH77Zvk4Ty7G42rlaGuZ3qtRrXmo5sv2s/7qvVMIi3UW/zOPZ2X+YT/d/H2PKXZVV4xWHR2+pGTJGRQTkFrJ/KG1Wq2GJ5ka/7u+K2kgBs4dIon8Gg/5Dshk6Q+hIlC/d8I5g1OjCJaeWMSOllOMQcXZaFHiZ0RP4SbZ2yHd/yc9ouGX13qi0EG2f7B277AXEHYIAOtOJ1pRMNV/B8OSOdsVcZ+A/0jlfBC/A2fGOic8EXtjGeKGs+9++UyVCmpKIZfesFs8hRUVf4ilMbX0Byl3PXEFTOOt+kdDqT0+49doM5RFFppw50KD3i6IwdNkBebX+oJAqWxCSRdmoq9s70uf1drAU7CEugTcwrvBRfcB0Z08FPQ5ddY0lY87o/WCSC8a/reYJCuLADV9IBRGR7vFf1qfIJjIfX6abVakV5HPL7KRhDsg+bYy0DXt6BeGlLlsUb/AQW+RuSls8BicldIeYSGOxg3TVelzAxQI2w7q1U9G8Q8TyjwIMoIyK6m5zvHfQ9l5ydu2sPTVhYWtHoM5axDhXLPaBjbKTK3d/I1cQ7gmPngnJB0msndYWdx7A6uKvjzjfYX6NMIt+qYteDKGwQp02jMQkT8KbogXnYkAJXloqtnVIZxsq/mQRk7mxjmwOt+KQIXYVOp5A7PKe7sTSwZ41WKovf2ulvMHoxULzRy9vhwJtwNNj6+TQtYU16Tl7wKjpExZ4kD2VJAdvvJ2mqcvRAnucxz2rEU34aOp0GhJjAw0i6S/SHxN1x8tVR89omm4mdB3KMzHy3HA9yk9tjBEl5p9hI3kYkwDGFKu7ONke9ibpSlxJZIGK6mg/Hu90+/RLOYEafGtEvvv/6xynewKd4l248fKjn5Q6D/VeXUJKrI6k6VMtbPkdFniozOHA38YKopEep0WVkFC5vUwVxSaJO4V9kaNVIyJlYS7+bO8Z8a+D3Q/D82JWtcvoWVxBW9f4LOiqOy8mFmrDzvixMhDOEFbUl3odgVb8G5Jn6vy+/WpALhXETVI2pBsY1onu/dkJRmfkyf5fb9DDImMv5j89lhJSr6grbwiNM7qgZazM6jiKeLqIJXGNr5YCDiRdI811/eXFWJTc0lGHy9QKHZdzwc4TWEqDtgehUPwCIocDztDFinDv0XIZJz5hxvibQIejZShsvDXrpI5JMH2oQbWnVKTidl+GTBP9QTC1JaIjFCkxTVPcVCEbjanauTb6tXkwRL9rd5Y7d88YA8yvhielVF5CH1506G8Cugrd4Es6JJauKL1yAkm91+XEToU2QWdOPBVGZi6MLWS53iMLtFzCy7KEFtgd/Xq+xqHd8oU5SY+tYL9IqqpHaUijqfIOscSk5hR+9jmZFOchaeVEkcJGoReivuFVBxjmlCdd+EpYOvr8dR0dHl4Guh1LVeuenWqB6SNkE4f8Whq9Gxal6G016Wo60tYngHM7j6zK3MDHzsCTtjYF6m/sHjP8fNfpd/4uP1I7VuilsU+E/XgrQ3cW90zqZi46vMBekTLJ+/aTOzd1eEAZy8QJjZFebTmC0/QhUGPPOq3PJuo8La1/DlMi++nMrWsuBBHlHXZGXDNTt7GBzyiBq9ZkbVrAqvqaL5S3A7QdjWCjXdaQ+XuK8a0qBNYDXeUcSi9dS1aIzxTQ8zEYPeKOsT57M0fnynR9Pm6X459V8raz9+mT7Ri7767fzEwkCvCv8CZme7NeDEH3Ifr0XDzxEB4qiJMXNEUtLpMAQvZffOjBAf8G9xi0H4mxoSlaOhMLwT+A8V4rTZ+FZRObdYWmemHdzg4a7bFSdnCA1r/KsspmXqe98l7HxHwWyCRSPE6xfjpKcu/ipkBYiEsIYXY8RDkLyEeUGV9dYnrYUfLI4p/wn6RSGE0kBwsqLtho6790s72/+BnXbe6nGAAAA",
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

const POWER_ICON = "data:image/webp;base64,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";

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

const EVENTS = [
  { id:"ISB", name:"Inter Server Battle", coins:100, color:"#e74c3c" },
  { id:"CA",  name:"Clan Annihilation",   coins:40,  color:"#e67e22" },
  { id:"CS",  name:"Clan Sanctuary",      coins:60,  color:"#3498db" },
  { id:"STI", name:"Sindris Treasure Island", coins:40, color:"#9b59b6" },
  { id:"WB",  name:"World Boss",          coins:10,  color:"#27ae60" },
];
// ─── EVENT IMAGES (compressed WebP thumbnails) ────────────────────────────────
const WORLDBOSS_IMG = "data:image/webp;base64,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";
const SERVERBATTLE_IMG = "data:image/webp;base64,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";
const SINDRIS_IMG = "data:image/webp;base64,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";
const CLANSANCTUARY_IMG = "data:image/webp;base64,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";
const CLAN_ANNIHILATION_IMG = "data:image/webp;base64,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";

const WEEKLY_SCHEDULE = [
  { day:"Sunday",    events:[{ name:"Clan Sanctuary",          time:"22:00",               img:CLANSANCTUARY_IMG,    coins:60,  id:"CS"  }]},
  { day:"Monday",    events:[{ name:"World Boss",              time:"Conqueror's Call",    img:WORLDBOSS_IMG,        coins:10,  id:"WB"  }]},
  { day:"Tuesday",   events:[{ name:"Inter-Server Battle",     time:"20:00",               img:SERVERBATTLE_IMG,     coins:100, id:"ISB" }]},
  { day:"Wednesday", events:[{ name:"World Boss",              time:"Conqueror's Call",    img:WORLDBOSS_IMG,        coins:10,  id:"WB"  }]},
  { day:"Thursday",  events:[{ name:"Clan Annihilation",       time:"13:00",               img:CLAN_ANNIHILATION_IMG,coins:40,  id:"CA"  },
                              { name:"Clan Annihilation",       time:"20:00",               img:CLAN_ANNIHILATION_IMG,coins:40,  id:"CA"  }]},
  { day:"Friday",    events:[{ name:"World Boss",              time:"Conqueror's Call",    img:WORLDBOSS_IMG,        coins:10,  id:"WB"  }]},
  { day:"Saturday",  events:[{ name:"Sindris Treasure Island", time:"13:00",               img:SINDRIS_IMG,          coins:40,  id:"STI" },
                              { name:"Sindris Treasure Island", time:"20:00",               img:SINDRIS_IMG,          coins:40,  id:"STI" }]},
];
const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

const EVENT_DESCRIPTIONS = {
  ISB: "Inter-Server Battle — clash against rival servers for massive rewards. Top performers earn bonus coins.",
  CA:  "Clan Annihilation — an all-out war between clans. Coordinate with your team to secure victory.",
  CS:  "Clan Sanctuary — defend your clan's territory and earn coins for every successful defence.",
  STI: "Sindris Treasure Island — race to collect treasures across the island before time runs out.",
  WB:  "World Boss — unite the clan to bring down a powerful boss and share the spoils of battle.",
};

const SEED_MEMBERS = [
  { id:1, name:"ThomasShelby", username:"thomasshelby", password:"master123", role:"Master", cls:"Archer", power:123205, coins:0, attendance:0, joinDate:"2024-01-01", auctionWins:0, decayLog:[], txLog:[], attendLog:[], discord:"" },
];
let _imageLibrary = [];
const MUSPEL_AXE_IMG = "data:image/png;base64,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";

const SEED_AUCTIONS = [];

function fmt(n) { return n?.toLocaleString() ?? "0"; }
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
  const d=Math.max(0,diff),h=Math.floor(d/3600000),m=Math.floor((d%3600000)/60000),s=Math.floor((d%60000)/1000);
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
  "Auction Win": "type_AuctionWin",
  "Weekly Decay": "type_WeeklyDecay",
};
function typeLabel(type, t) {
  const key = TYPE_LABEL_KEYS[type];
  return key ? t(key) : type;
}

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

/* Leaderboard page background — a fixed full-viewport video (the same
   angel/trophy footage used on the login screen and, previously, just
   the podium banner) sitting behind the ENTIRE page, not just one
   section. Fixed positioning means it stays put as the page scrolls
   through the podium and the long ranked lists below, instead of
   scrolling away and leaving blank space. Uses the same proven crop
   position as .login-video-bg so the angel stays correctly centered on
   both desktop and mobile, rather than re-deriving it.

   Height uses 100dvh (dynamic viewport height) instead of inset:0 +
   height:100% — on mobile, the browser's address bar shows and hides as
   the page scrolls, which changes the actual visible viewport size in
   real time. A plain height:100% recalculates against that changing
   layout viewport, which is exactly what caused the background to
   visibly "enlarge and shift" partway through scrolling. dvh tracks the
   real visible viewport smoothly instead of jumping. */
.leaderboard-page-video-bg{
  position:fixed;top:0;left:0;right:0;
  width:100%;height:100dvh;
  object-fit:cover;object-position:right center;
  z-index:-2;pointer-events:none;
}
.leaderboard-page-scrim{
  position:fixed;top:0;left:0;right:0;
  width:100%;height:100dvh;
  z-index:-1;pointer-events:none;
  background:linear-gradient(180deg,
    rgba(5,4,3,0.55) 0%,
    rgba(5,4,3,0.35) 20%,
    rgba(5,4,3,0.55) 55%,
    rgba(5,4,3,0.88) 85%,
    rgba(5,4,3,0.97) 100%
  );
}
@media(max-width:760px){
  .leaderboard-page-video-bg{object-position:78% center;}
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

/* ── NAV WRAPPER — centered island with top margin & large side margins ── */
.nav-wrapper{
  position:sticky;top:10px;z-index:100;
  display:flex;justify-content:center;
  padding:0 80px;
  pointer-events:none;
  overflow:visible;
}
.sidebar{
  pointer-events:all;
  width:100%;
  max-width:1400px;
  background:linear-gradient(90deg,rgba(14,11,9,0.99),rgba(11,8,6,0.99));
  border:1px solid var(--border-bright);
  border-radius:10px;
  display:flex;flex-direction:row;align-items:center;
  height:52px;
  padding:0 20px;
  flex-shrink:0;
  box-shadow:0 4px 32px rgba(0,0,0,0.7),0 0 0 1px rgba(201,151,42,0.08);
  position:relative;
  overflow:visible;
}
.sidebar::after{
  content:'';position:absolute;bottom:0;left:10%;right:10%;height:1px;
  background:linear-gradient(90deg,transparent,var(--gold-dim),transparent);
  pointer-events:none;
}
.sidebar-logo{
  padding:0 14px 0 2px;
  border-right:1px solid var(--border);
  margin-right:8px;
  display:flex;align-items:center;
  height:100%;flex-shrink:0;
}
.sidebar-logo-mark{
  width:24px;height:24px;object-fit:contain;display:block;
  filter:drop-shadow(0 0 5px rgba(201,151,42,0.4));
}
.logo-emblem{font-size:20px;filter:drop-shadow(0 0 8px rgba(200,146,42,0.8));}
.logo-title{font-family:'Spectral',serif;font-size:14px;font-weight:800;color:var(--gold-light);letter-spacing:1.5px;text-align:left;line-height:1;}
.logo-sub{font-size:7px;color:var(--text-dim);letter-spacing:2px;text-transform:uppercase;font-weight:600;margin-top:2px;text-align:left;line-height:1;}

.nav-section{display:flex;flex-direction:row;align-items:center;gap:0;padding:0 2px;}
.nav-label{display:none;}
.nav-item{
  display:flex;align-items:center;gap:7px;
  padding:0 13px;cursor:pointer;
  color:var(--text-dim);font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;
  transition:all 0.25s;border-radius:5px;
  font-family:'Inter',sans-serif;
  position:relative;height:38px;white-space:nowrap;margin:0 1px;
}
.nav-item::before{
  content:'';position:absolute;bottom:0;left:10%;right:10%;height:1px;
  background:linear-gradient(90deg,transparent,var(--gold),transparent);
  opacity:0;transition:opacity 0.25s;
}
.nav-item:hover{color:var(--gold-light);background:rgba(200,146,42,0.08);}
.nav-item:hover::before{opacity:0.5;}
.nav-item.active{
  color:var(--gold-bright);
  background:linear-gradient(180deg,rgba(200,146,42,0.18) 0%,rgba(200,146,42,0.06) 100%);
  box-shadow:inset 0 0 0 1px rgba(201,151,42,0.3), 0 0 12px rgba(200,146,42,0.12);
}
.nav-item.active::before{opacity:1;}
.nav-item.active::after{
  content:'';position:absolute;top:0;left:10%;right:10%;height:1px;
  background:linear-gradient(90deg,transparent,rgba(200,146,42,0.6),transparent);
}
.nav-icon{display:flex;align-items:center;justify-content:center;opacity:0.7;flex-shrink:0;}
.nav-item.active .nav-icon{opacity:1;filter:drop-shadow(0 0 4px rgba(200,146,42,0.7));}
.nav-section-divider{width:1px;height:22px;background:linear-gradient(180deg,transparent,rgba(200,146,42,0.2),transparent);margin:0 4px;flex-shrink:0;}
/* ── NAV DROPDOWN ── */
.nav-group{position:relative;display:flex;align-items:center;}
.nav-group:hover .nav-dropdown,.nav-group.dd-open .nav-dropdown{opacity:1;pointer-events:all;transform:translateX(-50%) translateY(0);}
.nav-dropdown{
  position:absolute;top:100%;left:50%;transform:translateX(-50%) translateY(-6px);
  background:transparent;
  padding-top:10px;
  opacity:0;pointer-events:none;
  transition:opacity 0.18s, transform 0.18s;
  z-index:9999;
}
.nav-dropdown-inner{
  background:linear-gradient(160deg,rgba(16,12,10,0.99),rgba(12,9,7,0.99));
  border:1px solid var(--border-bright);border-radius:8px;
  min-width:170px;padding:6px 0;
  box-shadow:0 12px 40px rgba(0,0,0,0.9),0 0 0 1px rgba(201,151,42,0.06);
}
.nav-dropdown-inner::before{
  content:'';position:absolute;top:-6px;left:50%;transform:translateX(-50%);
  border:6px solid transparent;border-bottom-color:var(--border-bright);
  border-top:none;
}
.nav-dropdown-inner{position:relative;}
.nav-dd-item{
  display:flex;align-items:center;gap:8px;
  padding:8px 16px;cursor:pointer;
  color:var(--text-mid);font-size:10px;font-weight:700;letter-spacing:1px;
  text-transform:uppercase;font-family:'Inter',sans-serif;
  transition:all 0.15s;white-space:nowrap;
}
.nav-dd-item:hover{color:var(--gold-light);background:rgba(200,146,42,0.08);}
.nav-dd-item.active{color:var(--gold-bright);}
.nav-dd-sep{height:1px;background:linear-gradient(90deg,transparent,var(--border),transparent);margin:4px 10px;}
.nav-dd-label{
  font-size:8px;font-weight:700;letter-spacing:2.5px;color:var(--text-dim);
  padding:6px 16px 2px;text-transform:uppercase;font-family:'Inter',sans-serif;
}
/* ── PROFILE CHIP (replaces old separate avatar + "Menu" button) ── */
.user-menu{position:relative;margin-left:auto;padding-left:10px;flex-shrink:0;}
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
  position:absolute;top:100%;right:0;
  background:transparent;
  padding-top:10px;
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
.hamburger{display:none;flex-direction:column;justify-content:center;gap:5px;cursor:pointer;
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
.main{flex:1;display:flex;flex-direction:column;margin-top:10px;}
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
  .nav-wrapper{padding:0 40px;}
  .topbar{padding:13px 40px;}
  .content{padding:28px 40px;}
}
@media(max-width:900px){
  .nav-wrapper{padding:0 20px;}
  .topbar{padding:12px 20px;}
  .content{padding:20px 20px;}
  
}
@media(max-width:700px){
  .nav-wrapper{padding:0 12px;top:8px;}
  .sidebar{padding:0 14px;height:48px;}
  .nav-section,.user-menu{display:none;}
  .hamburger{display:flex;}
  .main{margin-top:8px;}
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
  /* Members table — keep as real table on mobile, no stacking */
  .members-table{width:100%;display:table!important;}
  .members-table thead{display:table-header-group!important;}
  .members-table tbody tr{display:table-row!important;background:transparent!important;border:none!important;border-radius:0!important;margin-bottom:0!important;padding:0!important;}
  .members-table td{display:table-cell!important;padding:8px 8px!important;font-size:11px!important;gap:0!important;justify-content:unset!important;}
  .members-table td::before{display:none!important;}
  .members-table th{padding:8px 8px!important;font-size:8px!important;}
  .members-table-wrap{overflow-x:auto!important;-webkit-overflow-scrolling:touch;}
}
.members-table-wrap{overflow-x:auto;}
.attendance-card-view{display:none;}
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
.podium-rank-1 .podium-card-frame{width:252px;border:3px solid #c77dff;box-shadow:0 0 32px rgba(199,125,255,0.5);}
.podium-rank-2 .podium-card-frame{width:192px;border:2px solid #f2cc60;box-shadow:0 0 16px rgba(242,204,96,0.35);}
.podium-rank-3 .podium-card-frame{width:180px;border:2px solid #d4d4d4;box-shadow:0 0 14px rgba(192,192,192,0.3);}
.podium-rank-num{font-family:'Spectral',serif;font-weight:800;margin-top:10px;}
.podium-rank-1 .podium-rank-num{font-size:34px;color:#c77dff;text-shadow:0 0 14px rgba(199,125,255,0.6);}
.podium-rank-2 .podium-rank-num{font-size:24px;color:#f2cc60;text-shadow:0 0 10px rgba(242,204,96,0.45);}
.podium-rank-3 .podium-rank-num{font-size:21px;color:#d4d4d4;text-shadow:0 0 10px rgba(192,192,192,0.4);}
.podium-crown{position:absolute;top:-20px;left:50%;transform:translateX(-50%);z-index:3;color:#c77dff;filter:drop-shadow(0 0 6px rgba(199,125,255,0.6));}
.podium-name{font-family:'Spectral',serif;font-weight:700;color:var(--text-bright);margin-top:6px;text-align:center;}
.podium-rank-1 .podium-name{font-size:17px;}
.podium-rank-2 .podium-name,.podium-rank-3 .podium-name{font-size:13px;}
.podium-power{font-size:12px;color:var(--gold-bright);margin-top:2px;}
@media(max-width:600px){
  .podium-rank-1 .podium-card-frame{width:130px;}
  .podium-rank-2 .podium-card-frame{width:98px;}
  .podium-rank-3 .podium-card-frame{width:92px;}
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

/* ── AUCTION CARD ── */
.auction-card{min-width:0;word-break:break-word;
  background:var(--bg-card);border:1px solid var(--border);
  border-radius:4px;overflow:hidden;transition:all 0.25s;
}
.auction-card:hover{box-shadow:0 6px 30px rgba(0,0,0,0.5);transform:translateY(-2px);}
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
@keyframes fadeInUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}

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
@media(max-width:720px){
  .nav-item{padding:0 9px;font-size:10px;}
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
  const addImage = useCallback((name, dataUrl) => {
    const entry = { id: Date.now() + Math.random(), name, dataUrl };
    _imageLibrary = [..._imageLibrary, entry];
    setLibrary([..._imageLibrary]);
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
    dbLoadAuctionImage(cacheKey).then(row => {
      if (cancelled) return;
      if (row?.image_data) {
        _auctionImageCache.set(cacheKey, row.image_data);
        setDataUrl(row.image_data);
      }
    });
    return () => { cancelled = true; };
  }, [cacheKey, auction?.image?.name, dataUrl]);

  if (dataUrl) return <img src={dataUrl} alt={alt} style={style} />;
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
function LoginScreen({ members, onLogin }) {
  const { t } = useLang();
  const [form, setForm] = useState({ username:"", password:"" });
  const [error, setError] = useState("");

  function doLogin() {
    setError("");
    const m = members.find(m => m.username === form.username && m.password === form.password);
    if (!m) { setError(t("invalidLogin")); return; }
    onLogin(m);
  }

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

        <div className="login-card login-card--left">
          {error && <div className="login-error">{error}</div>}
          <div className="form-group">
            <label className="form-label">{t("username")}</label>
            <input className="input" placeholder={t("enterUsername")} value={form.username} onChange={e=>setForm(p=>({...p,username:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&doLogin()} autoComplete="username" />
          </div>
          <div className="form-group">
            <label className="form-label">{t("password")}</label>
            <input className="input" type="password" placeholder={t("enterPassword")} value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&doLogin()} autoComplete="current-password" />
          </div>
          <button className="btn btn-gold" style={{width:"100%",justifyContent:"center",padding:"12px 20px"}} onClick={doLogin}>{t("enter")}</button>
        </div>
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
  const isAdmin = currentUser.role==="Elder"||currentUser.role==="Master";

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
function AppInner() {
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

  // Swap the body background image depending on which page is active —
  // same mechanism as the rest of the app's single full-bleed background,
  // just pointed at a different photo on the Auctions page. Doing it this
  // way (instead of a nested div) guarantees it always covers the full
  // viewport width with zero seams, since it's the same element/rule that
  // already paints Clan HQ's background everywhere else.
  useEffect(() => {
    document.body.classList.toggle("bg-auctions", page === "auctions");
  }, [page]);

  const [members, setMembersRaw] = useState(SEED_MEMBERS);
  const [auctions, setAuctionsRaw] = useState(SEED_AUCTIONS);
  const [attendanceLogs, setAttendanceLogsRaw] = useState([]);
  const [loggedIn, setLoggedIn] = useState(false);
  const [showEntrance, setShowEntrance] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
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

  // ── Load all data from Supabase on mount ──────────────────────────────────
  useEffect(() => {
    async function loadAll() {
    try {
      const [mRows, aRows, lRows, cRows, rRows] = await Promise.all([
        dbLoad("members"),
        dbLoad("auctions", AUCTION_LIST_COLS + ",image_data"),
        dbLoad("attendance_logs"),
        dbLoad("coin_requests"),
        dbLoad("loot_results"),
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
        })));
      } else if (Array.isArray(mRows) && mRows.length === 0) {
        // Table genuinely empty (confirmed by a successful query) — safe to seed.
        // Guard against many concurrent users all seeding at once: only
        // one tab seeds (localStorage flag), others just proceed with
        // SEED_MEMBERS in memory and pick it up on next poll/refresh.
        const seedFlag = "cf_seed_in_progress";
        if (!localStorage.getItem(seedFlag)) {
          localStorage.setItem(seedFlag, "1");
          await Promise.all(SEED_MEMBERS.map(m => dbUpsert("members", {
            id: String(m.id), name: m.name, username: m.username, password: m.password,
            role: m.role, cls: m.cls, power: m.power, coins: m.coins,
            attendance: m.attendance, join_date: m.joinDate, auction_wins: m.auctionWins,
            decay_log: "[]", tx_log: "[]", attend_log: "[]", discord: m.discord || "",
          })));
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
        // Seed the image cache from initial load so the poll never loses image URLs
        aRows.forEach(r => { if (r.image_data) _auctionImageCache.set(String(r.id), r.image_data); });
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
          image:       r.image_name ? { dataUrl: r.image_data || _auctionImageCache.get(String(r.id)) || null, name: r.image_name } : null,
        })));
      } else if (aRows === null) {
        // Auctions fetch failed/errored (e.g. statement timeout from large
        // image_data blobs). Don't block the whole app over this — just
        // log it and show an empty auction house. The 3s poll will retry.
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
          });
          setLoggedIn(true);
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
          id: String(m.id), name: m.name, username: m.username, password: m.password,
          role: m.role, cls: m.cls, power: m.power,
          attendance: m.attendance, join_date: m.joinDate || m.join_date,
          auction_wins: m.auctionWins,
          decay_log: JSON.stringify(m.decayLog || []),
          tx_log: JSON.stringify(m.txLog || []),
          attend_log: JSON.stringify(m.attendLog || []),
          power_log: JSON.stringify(m.powerLog || []),
          profile_rarity: m.profileRarity || "uncommon",
          awakening_level: m.awakeningLevel || 0,
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
  const deletedAttendanceIds = useRef(new Set());

  function setAuctions(updater) {
    setAuctionsRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const safe = next.filter(a => !deletedAuctionIds.current.has(a.id));
      const prevById = new Map(prev.map(a => [String(a.id), a]));
      safe.forEach(a => {
        const imageData = a.image?.dataUrl || _auctionImageCache.get(String(a.id)) || undefined;
        const prevAuction = prevById.get(String(a.id));
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
          bids:        JSON.stringify(a.bids ?? []),
        };
        if (endsAtChanged) row.ending_soon_notified = false;
        // Only write image_data if we actually have it — never overwrite DB with null
        if (imageData) row.image_data = imageData;
        dbUpsert("auctions", row);
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
  // Track whether THIS client is the "closer" — only Masters/Elders write ended status
  // to DB. Everyone else just waits for the poll to pick up the DB change.
  // This prevents a race where 50 clients all simultaneously write status="ended".
  const isCloserRole = currentUser && (currentUser.role === "Master" || currentUser.role === "Elder");
  // Poll members + attendance_logs every 5s so balances and history stay in sync
  useJitteredInterval(async () => {
      const [mRows, lRows] = await Promise.all([dbLoad("members"), dbLoad("attendance_logs")]);
      if (Array.isArray(lRows) && lRows.length > 0) {
        const fromDb = lRows.map(r => ({
          ...r,
          recordedBy: r.recorded_by || r.recordedBy || "",
          members:    Number(r.members) || 0,
          ts:         Number(r.ts) || (Number(r.id) > 1e11 ? Number(r.id) : null) || null,
          attendees:  (() => { try { return typeof r.attendees === "string" ? JSON.parse(r.attendees) : (r.attendees || []); } catch { return []; } })(),
        }));
        // Merge by id-union instead of overwriting wholesale: a log just
        // submitted locally may not have round-tripped to the DB yet when
        // this poll's read started, so a row present only locally (and not
        // explicitly deleted) is kept rather than dropped. Deleted ids are
        // tracked in deletedAttendanceIds so a stale DB read can't resurrect
        // a row the Master intentionally removed.
        setAttendanceLogsRaw(prev => {
          // Compare by stringified id for the same reason as setAttendanceLogs
          // above: a row just submitted locally has a numeric Date.now() id,
          // but once it round-trips through Supabase it comes back as a
          // string. Comparing raw ids here would never recognize them as the
          // same entry, duplicating the row instead of reconciling it.
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
          // Same fix as the initial load: keep id numeric so it matches
          // local state's ids (m.id === dbM.id below would otherwise
          // never match, since Supabase's text column always returns a
          // string).
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
        }));
        // Merge: keep local state for fields not in DB, update coins/auctionWins from DB
        return incoming.map(dbM => {
          const local = prev.find(m => m.id === dbM.id);
          // For logs: prefer whichever copy has MORE entries — handles the race where
          // a DB write hasn't settled yet when the next poll fires. "Longer wins" means
          // a freshly-written local log is never overwritten by a stale empty DB response.
          return local ? {
            ...local,
            coins:       dbM.coins,
            auctionWins: dbM.auctionWins,
            power:       dbM.power,
            attendance:  dbM.attendance,
            profileRarity: dbM.profileRarity,
            awakeningLevel: dbM.awakeningLevel,
            attendLog:   dbM.attendLog.length >= local.attendLog.length ? dbM.attendLog : local.attendLog,
            decayLog:    dbM.decayLog.length  >= local.decayLog.length  ? dbM.decayLog  : local.decayLog,
            txLog:       dbM.txLog.length     >= local.txLog.length     ? dbM.txLog     : local.txLog,
            powerLog:    dbM.powerLog.length  >= (local.powerLog||[]).length ? dbM.powerLog : (local.powerLog||[]),
          } : dbM;
        });
      });
  }, 5000, 1500, []);

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
          // If the DB just flipped this auction to "ended" and our local state
          // still had it as "active", fire the win notification here so clients
          // that didn't trigger the end themselves still see the toast.
          if (next.status === "ended" && prevA && prevA.status === "active" && !endedAuctionIds.current.has(next.id)) {
            endedAuctionIds.current.add(next.id);
            if (next.topBidder) {
              addToast(`${next.topBidder} won ${next.name} for ${fmt(next.currentBid)} coins!`, "gold", "Auction Ended");
              setMembers(ms => ms.map(m => {
                if (m.name!==next.topBidder) return m;
                // endedAuctionIds is per-browser-session only (a plain in-memory
                // ref), so it can't prevent the SAME win from being logged again
                // by a different tab, a different member's browser, or even
                // this same browser after a page reload — all of which start
                // with an empty endedAuctionIds set and rediscover this auction
                // as "newly ended" the first time they poll it. Checking the
                // member's own txLog for an entry already tagged with this
                // auction's id is what actually prevents duplicate entries,
                // since txLog is the persisted, shared source of truth.
                const alreadyLogged = (m.txLog||[]).some(e => e.auctionId === next.id);
                if (alreadyLogged) return m;
                return {...m,auctionWins:m.auctionWins+1,
                  txLog:[...(m.txLog||[]),{change:-next.currentBid,reason:`Won auction: ${next.name}`,date:new Date().toLocaleDateString(),ts:Date.now(),logType:"Auction Win",addedBy:"System",auctionId:next.id}]};
              }));
            }
          }
          return next;
        }).filter(a => !deletedAuctionIds.current.has(a.id));
        return updated;
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
        setLootResults(prev => {
          // ROOT CAUSE FIX: this used to be a hard overwrite (`return parsed`).
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
    // 2. DB writes (the actual close) only happen from the logged-in Master or
    //    Elder user. Everyone else just updates LOCAL display state — they let
    //    the 3s poll pick up the DB-written "ended" status.
    // 3. endedAuctionIds ref prevents any double-fires even across re-renders.
    const GRACE_MS = 10000; // 10s buffer — wide enough for most clock skew
    const canWriteClose = currentUser && (currentUser.role === "Master" || currentUser.role === "Elder");

    setAuctionsRaw(prev => prev
      .filter(a => !deletedAuctionIds.current.has(a.id))
      .map(a => {
        if (a.status==="active" && Date.now() > a.endsAt + GRACE_MS && !endedAuctionIds.current.has(a.id)) {
          endedAuctionIds.current.add(a.id);
          if (a.topBidder) {
            addToast(`${a.topBidder} won ${a.name} for ${fmt(a.currentBid)} coins!`, "gold", "Auction Ended");
            setMembers(ms => ms.map(m => {
              if (m.name!==a.topBidder) return m;
              // Same dedupe reasoning as the other "Won auction" log site above —
              // endedAuctionIds alone can't prevent a different browser/session
              // from re-logging the same win, so check txLog itself.
              const alreadyLogged = (m.txLog||[]).some(e => e.auctionId === a.id);
              if (alreadyLogged) return m;
              return {...m,auctionWins:m.auctionWins+1,
                txLog:[...(m.txLog||[]),{change:-a.currentBid,reason:`Won auction: ${a.name}`,date:new Date().toLocaleDateString(),ts:Date.now(),logType:"Auction Win",addedBy:"System",auctionId:a.id}]};
            }));
          }
          // Only Master/Elder writes to DB — prevents 50 clients racing each other
          if (canWriteClose) {
            const endImageData = a.image?.dataUrl || _auctionImageCache.get(String(a.id)) || undefined;
            const endRow = {
              id:          String(a.id),
              name:        a.name ?? "",
              description: a.description ?? a.desc ?? "",
              status:      "ended",
              ends_at:     a.endsAt ?? 0,
              started_at:  a.startedAt ?? Date.now(),
              current_bid: a.currentBid ?? 0,
              top_bidder:  a.topBidder ?? null,
              min_bid:     a.minBid ?? a.startBid ?? 0,
              image_name:  a.image?.name ?? null,
              bids:        JSON.stringify(a.bids ?? []),
            };
            if (endImageData) endRow.image_data = endImageData;
            dbUpsert("auctions", endRow);
          }
          // All clients flip local display to ended (UI update)
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
    setCurrentUser(m);
    setLoggedIn(true);
    setShowEntrance(true);
    localStorage.setItem("cf_user_id", m.id);
  }
  function handleLogout() {
    setLoggedIn(false);
    setCurrentUser(null);
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
  function submitCoinRequest(memberId, amount, type, reason) {
    const m = members.find(x=>x.id===memberId);
    if (!m) return;
    const req = { id: Date.now()+Math.random(), memberId, member_id: memberId, memberName: m.name, member_name: m.name, amount: parseInt(amount)||0, type, reason: reason||"_", requestedBy: currentUser.name, requested_by: currentUser.name, requestedAt: new Date().toLocaleString(), requested_at: new Date().toISOString() };
    setPendingCoinRequests(prev=>[...prev, req]);
    dbUpsert("coin_requests", { id: req.id, member_id: req.memberId, member_name: req.memberName, amount: req.amount, type: req.type, reason: req.reason, requested_by: req.requestedBy, requested_at: req.requested_at });
    addToast("Coin request sent for approval.", "gold", "Pending Approval");
  }
  function approveCoinRequest(reqId) {
    const req = pendingCoinRequests.find(r=>r.id===reqId);
    if (!req) return;
    const change = req.type==="add" ? req.amount : -req.amount;
    setMembers(ms=>ms.map(m=>m.id===req.memberId?{...m,coins:Math.max(0,m.coins+change),txLog:[...(m.txLog||[]),{change,reason:req.reason,date:new Date().toLocaleDateString(),logType:"Elder Request",addedBy:req.requestedBy,ts:Date.now()}]}:m));
    setPendingCoinRequests(prev=>prev.filter(r=>r.id!==reqId));
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
  const [openDropdown, setOpenDropdown] = useState(null);
  const [openUserMenu, setOpenUserMenu] = useState(false);
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


  const ctx = { members, setMembers, auctions, setAuctions, attendanceLogs, setAttendanceLogs,
    currentUser, setCurrentUser, addToast, fireCoinBurst, fireBalancePopup, modal, setModal, tick, imageLibrary, addImage, linkDiscord, adjustPower, removeAuction, pendingCoinRequests, setPendingCoinRequests, submitCoinRequest, approveCoinRequest, rejectCoinRequest, lootResults, setLootResults, latestLootId, setLatestLootId, bidFeed, globalViewingProfile, setGlobalViewingProfile };

  const PAGE_TITLES = {dashboard:t("pageTitle_dashboard"),attendance:t("pageTitle_attendance"),members:t("pageTitle_members"),auctions:t("pageTitle_auctions"),leaderboard:t("pageTitle_leaderboard"),export:t("pageTitle_export"),settings:t("pageTitle_settings")};

  // ── Connection error screen (DB unreachable — do NOT show empty/seed state) ─
  if (dbError) return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg-dark)",flexDirection:"column",gap:16,padding:24,textAlign:"center"}}>
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
  if (!dbReady) return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg-dark)",flexDirection:"column",gap:16}}>
        <div style={{animation:"spin 1.2s linear infinite",display:"flex"}}><SwordsIcon size={38} style={{color:"var(--gold-light)"}}/></div>
        <div style={{fontFamily:"'Spectral',serif",fontWeight:800,fontSize:18,color:"var(--gold-light)",letterSpacing:2}}>Loading ClanForge…</div>
        <div style={{fontSize:12,color:"var(--text-dim)"}}>Connecting to database</div>
      </div>
    </>
  );

  if (!loggedIn) return (
    <>
      <style>{GLOBAL_CSS}</style>
      <LoginScreen members={members} onLogin={handleLogin} />
      <Toast toasts={toasts} remove={removeToast} />
    </>
  );

  const _isLeader = currentUser.role==="Leader";
  const _isElder  = currentUser.role==="Elder";
  const _isMaster = currentUser.role==="Master";
  const _reportPages = [];
  if (_isLeader || _isElder || _isMaster) _reportPages.push({id:"export",label:t("pageTitle_export")});
  if (_isLeader || _isMaster) _reportPages.push({id:"settings",label:t("pageTitle_settings")});
  const isAdmin = currentUser.role==="Elder"||currentUser.role==="Master";
  const NAV = [
    { section:t("navSection_main"), items:[
        {id:"dashboard",icon:<StatIcon src={WARRIORS_ICON} size={16}/>,label:t("pageTitle_dashboard"),sub:[t("sub_clanStats"),t("sub_worldBoss"),t("sub_liveAuctions"),t("sub_weeklyTop")]},
        {id:"leaderboard",icon:<LBIcon src={LEADERBOARD_ICON} size={14}/>,label:t("leaderboards"),sub:[t("sub_topPower"),t("sub_richest"),t("sub_topAttendance"),t("sub_auctionWinners")]},
      ]},
    { section:t("navSection_management"), items:[
        {id:"members",icon:<StatIcon src={WARRIORS_ICON} size={16}/>,label:t("members"),sub:[t("sub_memberRoster"),t("sub_profiles"),t("sub_coinPowerAdjust")]},
        {id:"attendance",icon:<StatIcon src={ATTENDANCE_ICON} size={16}/>,label:t("attendance"),sub:[t("sub_recordAttendance"),t("sub_history"),t("sub_eventTracker")]},
        {id:"auctions",icon:<StatIcon src={AUCTION_ICON} size={16}/>,label:t("auctions"),sub:[t("sub_liveAuctions"),t("sub_history"),t("sub_lootRoulette"),...(isAdmin?[t("sub_createAuction")]:[])]},
      ]},
    ...(_reportPages.length>0?[{ section:t("navSection_reports"), items:[{id:"reports",icon:"📊",label:t("reports"),subPages:_reportPages}]}]:[]),
  ];

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div className="app-shell">
        <div className="nav-wrapper">
        <nav className="sidebar">
          <div className="sidebar-logo">
            <img src="/images/ymir-logo-gold.png" alt="" className="sidebar-logo-mark" />
          </div>
          {NAV.map((section, si) => (
            <div key={section.section} style={{display:"flex",flexDirection:"row",alignItems:"center"}}>
              {si > 0 && <div className="nav-section-divider"/>}
              <div className="nav-section">
              {section.items.map(item => (
                <div key={item.id} className={`nav-group${openDropdown===item.id?" dd-open":""}`}
                  onMouseLeave={()=>setOpenDropdown(null)}>
                  <div className={`nav-item${(item.subPages?item.subPages.some(sp=>sp.id===page):page===item.id)?" active":""}`}
                    onClick={()=>{
                      if(item.subPages){ setOpenDropdown(openDropdown===item.id?null:item.id); }
                      else { setPage(item.id); setOpenDropdown(openDropdown===item.id?null:item.id); }
                    }}>
                    {item.icon && <span className="nav-icon">{item.icon}</span>}
                    {item.label}
                    {((item.sub&&item.sub.length>0)||(item.subPages&&item.subPages.length>0))&&<span style={{fontSize:7,marginLeft:2,opacity:0.5}}>▾</span>}
                  </div>
                  {item.sub&&item.sub.length>0&&(
                    <div className="nav-dropdown">
                      <div className="nav-dropdown-inner">
                        <div className="nav-dd-label">{item.label}</div>
                        <div className="nav-dd-sep"/>
                        {item.sub.map(s=>(
                          <div key={s} className={`nav-dd-item${page===item.id?" active":""}`} onClick={()=>{ setPage(item.id); setOpenDropdown(null); }}>{s}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  {item.subPages&&item.subPages.length>0&&(
                    <div className="nav-dropdown">
                      <div className="nav-dropdown-inner">
                        <div className="nav-dd-label">{item.label}</div>
                        <div className="nav-dd-sep"/>
                        {item.subPages.map(sp=>(
                          <div key={sp.id} className={`nav-dd-item${page===sp.id?" active":""}`} onClick={()=>{ setPage(sp.id); setOpenDropdown(null); }}>{sp.label}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              </div>
            </div>
          ))}
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
                <div className="user-dd-item" style={{fontSize:10,color:"var(--gold)",pointerEvents:"none"}}>
                  <StatIcon src={COINS_ICON} size={22}/>{fmt(currentUser.coins)} {t("coinsLabel")}
                </div>
                <div className="nav-dd-sep"/>
                <div className="user-dd-item" onClick={()=>{setModal({type:"changePassword",data:currentUser});setOpenUserMenu(false);setOpenDropdown(null);}}>
                  {t("changePassword")}
                </div>
                <div className="user-dd-item" onClick={togglePushNotifications} style={pushBusy?{opacity:0.6,pointerEvents:"none"}:undefined}>
                  {pushEnabled ? "🔔 Notifications: On" : "🔕 Enable Notifications"}
                </div>
                <div className="user-dd-item danger" onClick={handleLogout}>{t("logOut")}</div>
              </div>
            </div>
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
            <div className="drawer-nav">
              {NAV.map(section => (
                <div key={section.section}>
                  <div className="drawer-section-label">{section.section}</div>
                  {section.items.map(item => (
                    item.subPages ? item.subPages.map(sp=>(
                      <div key={sp.id} className={`drawer-nav-item${page===sp.id?" active":""}`}
                        onClick={()=>{setPage(sp.id);setDrawerOpen(false);}}>
                        {item.icon && <span style={{display:"flex",alignItems:"center",opacity:0.8}}>{item.icon}</span>}{sp.label}
                      </div>
                    )) : (
                      <div key={item.id} className={`drawer-nav-item${page===item.id?" active":""}`}
                        onClick={()=>{setPage(item.id);setDrawerOpen(false);}}>
                        {item.icon && <span style={{display:"flex",alignItems:"center",opacity:0.8}}>{item.icon}</span>}{item.label}
                      </div>
                    )
                  ))}
                </div>
              ))}
            </div>
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
          </div>
        </div>

        <main className="main">
          <div className="topbar">
            <div>
              <div className="page-title">{PAGE_TITLES[page]||page}</div>
              <div className="page-sub">{currentUser.name} · {currentUser.role}</div>
            </div>
            <div className="topbar-actions">
              <LangSwitcher />
              {(currentUser.role==="Master"||currentUser.role==="Elder") && (
                <button className="btn btn-gold btn-sm" onClick={()=>setModal({type:"addMember"})}>{t("addMember")}</button>
              )}
              {currentUser.role==="Master" && pendingCoinRequests.length>0 && (
                <button className="btn btn-red btn-sm" style={{position:"relative"}} onClick={()=>setModal({type:"pendingRequests"})}>
                  ⏳ {t("approvals")}
                  <span style={{position:"absolute",top:-6,right:-6,background:"#e85d3a",color:"#fff",borderRadius:"50%",width:16,height:16,fontSize:9,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center"}}>{pendingCoinRequests.length}</span>
                </button>
              )}
            </div>
          </div>
          <div className="content">
            {globalViewingProfile ? (
              <PlayerInfo
                member={members.find(m => m.id === globalViewingProfile) || globalViewingProfile}
                members={members}
                onBack={() => setGlobalViewingProfile(null)}
              />
            ) : (
              <>
                {page==="leaderboard" && (
                  <>
                    <video className="leaderboard-page-video-bg" autoPlay loop muted playsInline poster="/video/login-bg-poster.jpg">
                      <source src="/video/login-bg.webm" type="video/webm" />
                    </video>
                    <div className="leaderboard-page-scrim" />
                  </>
                )}
                {page==="dashboard"   && <Dashboard ctx={ctx} setPage={setPage} />}
                {page==="members"     && <Members ctx={ctx} />}
                {page==="attendance"  && <Attendance ctx={ctx} />}
                {page==="auctions"    && <Auctions ctx={ctx} />}
                {page==="leaderboard" && <Leaderboard ctx={ctx} />}
                {page==="export"      && <Export ctx={ctx} />}
                {page==="settings"    && <Settings ctx={ctx} />}
              </>
            )}
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
  return (
    <LangProvider>
      <AppInner />
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
  const EVENT_COLOR = { ISB:"#e74c3c", CA:"#e67e22", CS:"#3498db", STI:"#9b59b6", WB:"#27ae60" };
  const EVENT_GLOW  = { ISB:"rgba(231,76,60,0.45)", CA:"rgba(230,126,22,0.45)", CS:"rgba(52,152,219,0.45)", STI:"rgba(155,89,182,0.45)", WB:"rgba(39,174,96,0.45)" };

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
    <div style={{
      background:"linear-gradient(135deg,rgba(10,8,6,0.65) 0%,rgba(18,14,11,0.9) 100%)",
      border:"1px solid rgba(200,146,42,0.2)", borderRadius:8,
      padding:"22px 24px", marginBottom:24, position:"relative", overflow:"hidden",
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

function UpdateNotes() {
  const [expanded, setExpanded] = React.useState(null);
  const [showAll, setShowAll] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(() => {
    try { return localStorage.getItem("update_notes_dismissed") === "true"; } catch { return false; }
  });

  if (dismissed) return null;

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

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ ctx, setPage }) {
  const { members, auctions, currentUser } = ctx;
  const { t } = useLang();
  const [wtMode, setWtMode] = useState("attendance");
  const activeAuctions = auctions.filter(a=>a.status==="active");
  const recentWinners = auctions.filter(a=>a.status==="ended"&&a.topBidder).slice(0,3);

  const ROLE_COLOR = { Master:"#c8922a", Elder:"#e07070", Member:"#7098c8" };
  const roleColor = ROLE_COLOR[currentUser.role] || "#9c8c7c";

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
            </div>


          </div>
        </div>
      </div>

      {/* Update Notes */}
      <UpdateNotes />

      {/* World Boss Schedule */}
      <WorldBossSchedule />

      {/* ── Live Auctions + Mini Leaderboard ── */}
      <div style={{display:"flex",flexWrap:"wrap",gap:16,marginBottom:16}}>
        {/* Live Auctions Preview */}
        <div className="card" style={{flex:"1 1 280px",minWidth:0}}>
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

        {/* Mini Leaderboard Switcher */}
        <div className="card" style={{flex:"1 1 280px",minWidth:0}}>
          {(()=>{
            const WT_MODES=[{id:"attendance",label:t("topAttendance")},{id:"power",label:t("topPower")},{id:"coins",label:t("richest")}];
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
                    {wtMode!=="coins"&&<div style={{fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:11,color:"var(--gold-light)",display:"inline-flex",alignItems:"center",gap:3}}><StatIcon src={COINS_ICON} size={20}/>{fmt(m.coins)}</div>}
                  </div>
                </div>
              ))}
            </>);
          })()}
        </div>
      </div>

      {/* ── Recent Winners + Event Points ── */}
      <div style={{display:"flex",flexWrap:"wrap",gap:16}}>
        <div className="card card-gold" style={{flex:"1 1 280px",minWidth:0}}>
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
        <div className="card card-blue" style={{flex:"1 1 280px",minWidth:0}}>
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
  );
}

// ─── MEMBERS ──────────────────────────────────────────────────────────────────
function Members({ ctx }) {
  const { members, setMembers, currentUser, addToast, setModal } = ctx;
  const { t } = useLang();
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("All");
  const [sortBy, setSortBy] = useState("coins");
  const [selectedMember, setSelectedMember] = useState(null);
  const [viewingProfile, setViewingProfile] = useState(null);
  const isAdmin = currentUser.role==="Elder"||currentUser.role==="Master";

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
      <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        <input className="input" style={{maxWidth:240}} placeholder={t("searchWarrior")} value={search} onChange={e=>setSearch(e.target.value)} />
        <select className="select" style={{maxWidth:160}} value={classFilter} onChange={e=>setClassFilter(e.target.value)}>
          <option value="All">{t("allClasses")}</option>{CLASSES.map(c=><option key={c}>{c}</option>)}
        </select>
        <select className="select" style={{maxWidth:160}} value={sortBy} onChange={e=>setSortBy(e.target.value)}>
          <option value="coins">{t("sortCoins")}</option><option value="power">{t("sortPower")}</option>
          <option value="attendance">{t("sortAttendance")}</option><option value="name">{t("sortName")}</option>
        </select>
        {isAdmin && <button className="btn btn-gold" style={{marginLeft:isAdmin?"auto":0}} onClick={()=>setModal({type:"addMember"})}>{t("addMember")}</button>}
      </div>

      <div className="members-layout">
        <div style={{flex:1,minWidth:0}}>
          <div className="card" style={{padding:0,overflow:"hidden"}}>
            <div className="table-wrap members-table-wrap">
              <table className="table-stack members-table">
                <thead><tr><th>{t("colRank")}</th><th>{t("colCharacter")}</th><th>{t("colPower")}</th><th>{t("colCoins")}</th><th>{t("colAttend")}</th><th>{t("colWins")}</th><th>{t("colRole")}</th>{isAdmin&&<th>{t("colActions")}</th>}</tr></thead>
                <tbody>
                  {filtered.map((m,i) => (
                    <>
                    <tr key={m.id} style={{cursor:"pointer",background:selectedMember?.id===m.id?"rgba(201,151,42,0.05)":""}} onClick={()=>setSelectedMember(m)}>
                      <td data-label="#" style={{color:"var(--text-dim)",fontWeight:700,fontSize:11}}>{rankIcon(i)}</td>
                      <td data-label="Character">
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <ClassIcon cls={m.cls} size={40} />
                          <div>
                            <div style={{fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:13,color:"var(--text-bright)",textAlign:"left"}}>{m.name}</div>
                            <div style={{fontSize:10,color:"var(--text-dim)",fontWeight:500}}>{t("joinedOn")} {m.joinDate}</div>
                          </div>
                        </div>
                      </td>
                      <td data-label="Power" style={{fontFamily:"'Inter',sans-serif",fontWeight:700,color:"#a8b8c8"}}><span style={{display:"inline-flex",alignItems:"center",gap:5}}><PowerIcon size={14} />{fmt(m.power)}</span></td>
                      <td data-label="Coins" style={{fontFamily:"'Inter',sans-serif",fontWeight:800,color:"var(--gold-light)"}}><span style={{display:"inline-flex",alignItems:"center",gap:4}}><StatIcon src={COINS_ICON} size={28}/>{fmt(m.coins)}</span></td>
                      <td data-label="Attend." style={{color:"#60aadd",fontWeight:700}}>{m.attendance}</td>
                      <td data-label="Wins" style={{color:"var(--gold)",fontWeight:700}}>{m.auctionWins}×</td>
                      <td data-label="Role"><span className={`badge ${m.role==="Master"?"badge-gold":m.role==="Elder"?"badge-red":"badge-silver"}`}>{m.role}</span></td>
                      {isAdmin && <td data-label="Action"><button className="btn btn-ghost btn-sm" onClick={e=>{e.stopPropagation();removeMember(m.id);}}>{t("remove")}</button></td>}
                    </tr>
                    </>
                  ))}
                </tbody>
              </table>
            </div>
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
            {[[t("statCoins"),fmt(selectedMember.coins)],[t("statAttendance"),selectedMember.attendance],[t("statWins"),selectedMember.auctionWins],[t("statJoined"),selectedMember.joinDate]].map(([k,v]) => (
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
// params: { ev: EVENTS entry, date: locale date string, ts: ms timestamp,
//           present: [memberId], qualifierMap: {memberId: "full"|"late"|"afk"} }
// Returns { updatedMembers, bonusToasts, presentNames } — caller is
// responsible for calling setMembers(updatedMembers) and showing toasts.
function performAttendancePayout(members, { ev, date, ts, present, qualifierMap }) {
  const weekStart = getWeekStartFor(date);
  const EVENT_REQUIRED = { CA: 2, STI: 2, WB: 3 };
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
  const updatedMembers = members.map(m=>{
    if(!present.includes(m.id)) return m;
    const q=qualifierMap[m.id]||"full";
    const mult=q==="full"?1:q==="late"?0.5:0;
    const rankMult=getRankMultiplier(members,m.id);
    const earned=Math.floor(ev.coins*mult*rankMult);
    const newAttendLog=[...(m.attendLog||[]),{event:ev.name,coins:earned,date,qualifier:q,ts}];
    let bonusCoins = 0;
    const newTxLog = [...(m.txLog||[])];
    // ── Major Events bonus (+300) ──
    const prevAttended = getAttendedIds(m.attendLog||[]);
    const newAttended  = getAttendedIds(newAttendLog);
    if(newAttended.size>=totalEvents && prevAttended.size<totalEvents && !alreadyReceivedThisWeek(m.txLog,"Major Events Bonus")) {
      bonusCoins += 300;
      newTxLog.push({change:300,reason:"Attended all major events this week",date,logType:"Major Events Bonus",addedBy:"System",ts});
      bonusToasts.push({name:m.name,bonus:"Major Events",coins:300});
    }
    // ── ISB Veteran bonus (+500) ──
    const isbCountNew = newAttendLog.filter(e=>e.event==="Inter-Server Battle"&&e.qualifier!=="afk").length;
    const isbCountOld = (m.attendLog||[]).filter(e=>e.event==="Inter-Server Battle"&&e.qualifier!=="afk").length;
    if(isbCountNew>=10 && isbCountOld<10 && !alreadyReceivedThisWeek(m.txLog,"ISB Veteran Bonus")) {
      bonusCoins += 500;
      newTxLog.push({change:500,reason:"Reached 10 ISB events (ISB Veteran)",date,logType:"ISB Veteran Bonus",addedBy:"System",ts});
      bonusToasts.push({name:m.name,bonus:"ISB Veteran",coins:500});
    }
    // ── Sindri Veteran bonus (+400) — 2 STI/week for 5 weeks ──
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
    if(stiWeeksNew>=5 && stiWeeksOld<5 && !(m.txLog||[]).some(tx=>tx.logType==="Sindri Veteran Bonus")) {
      bonusCoins += 400;
      newTxLog.push({change:400,reason:"Attended 2 Sindri's per week for 5 weeks",date,logType:"Sindri Veteran Bonus",addedBy:"System",ts});
      bonusToasts.push({name:m.name,bonus:"Sindri Veteran",coins:400});
    }
    return{...m,coins:m.coins+earned+bonusCoins,attendance:m.attendance+(q!=="afk"?1:0),
      attendLog:newAttendLog,txLog:newTxLog};
  });
  return { updatedMembers, bonusToasts, presentNames };
}

// ─── ATTENDANCE ───────────────────────────────────────────────────────────────
function Attendance({ ctx }) {
  const { t } = useLang();
  const [memberSearch, setMemberSearch] = useState("");
  const { members, setMembers, addToast, currentUser, attendanceLogs, setAttendanceLogs, setModal } = ctx;
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedMembers, setSelectedMembers] = useState({});
  const [qualifier, setQualifier] = useState({});
  const [tab, setTab] = useState("record");
  const [bonusSearch, setBonusSearch] = useState("");
  const [historyFilter, setHistoryFilter] = useState("All");
  const isAdmin = currentUser.role==="Elder"||currentUser.role==="Master";
  const isMaster = currentUser.role==="Master";
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

  function toggleMember(id) {
    setSelectedMembers(p=>({...p,[id]:!p[id]}));
    if(!qualifier[id]) setQualifier(p=>({...p,[id]:"full"}));
  }

  function submitAttendance() {
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
    setMembers(ms => {
      const { updatedMembers, bonusToasts } = performAttendancePayout(ms, { ev, date: today, ts: nowTs, present, qualifierMap });
      // Show bonus toasts after state update
      setTimeout(()=>{
        bonusToasts.forEach(bonus=>addToast(<span style={{display:"inline-flex",alignItems:"center",gap:6}}><TrophyIcon size={14}/>{bonus.name} {t("earnedBonusText")} +{bonus.coins} {t("coinsText")} — {bonus.bonus} {t("bonusText")}</span>,"gold",t("bonusAwarded")));
      }, 200);
      return updatedMembers;
    });
    const logEntry = {id:Date.now(),event:ev.name,date:today,ts:nowTs,members:present.length,recordedBy:currentUser.name,attendees:presentNames};
    setAttendanceLogs(p=>[logEntry,...p]);
    addToast(`${t("attendanceRecorded")} ${present.length} ${t("membersUpdated")}`,"blue",t("attendanceSaved"));
    setSelectedMembers({});setQualifier({});setSelectedEvent(null);
    setLogPage(0);
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
    // CA requires 2x, STI requires 2x, WB requires 3x; all others require 1x.
    const EVENT_REQUIRED = { CA: 2, STI: 2, WB: 3 };
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
    const sindriVet = stiQualWeeks>=5;
    // ISB Veteran: all-time ISB count
    const isbCount = log.filter(e=>e.event==="Inter-Server Battle"&&e.qualifier!=="afk").length;
    const isbVet = isbCount>=10;
    return {attendedAll,sindriVet,stiQualWeeks,isbVet,isbCount,recentEvents,totalEvents,attendedNames:attendedIds};
  }

  const pagedLogs = attendanceLogs.slice(logPage*PAGE_SIZE, (logPage+1)*PAGE_SIZE);
  const totalPages = Math.ceil(attendanceLogs.length/PAGE_SIZE);

  return (
    <div>
      <div className="tabs">
        <div className={`tab${tab==="record"?" active":""}`} onClick={()=>setTab("record")}>{t("tabRecordAttendance")}</div>
        <div className={`tab${tab==="logs"?" active":""}`} onClick={()=>setTab("logs")}>{t("tabHistory")}</div>
        <div className={`tab${tab==="bonuses"?" active":""}`} onClick={()=>setTab("bonuses")}>{t("tabBonuses")}</div>
        <div className={`tab${tab==="mylog"?" active":""}`} onClick={()=>setTab("mylog")}>{t("tabMyLog")}</div>
        <div className={`tab${tab==="globallog"?" active":""}`} onClick={()=>setTab("globallog")}>{t("tabGlobalLog")}</div>
      </div>

      {tab==="record" && (
        <div>
          {!isAdmin && <div className="card" style={{color:"var(--text-dim)",textAlign:"center",padding:32,fontFamily:"'Inter',sans-serif"}}>{t("elderOnlyAttendance")}</div>}
          {isAdmin && (
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
          )}
        </div>
      )}

      {tab==="logs" && (
        <>
        {isAdmin && (
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
            <button className="btn btn-outline btn-sm" onClick={()=>setModal({type:"addMissingAttendance"})}>{t("addMissingRecord")}</button>
          </div>
        )}
        <div className="card attendance-table-view" style={{padding:0}}>
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
          {attendanceLogs.length===0 && <div className="card" style={{textAlign:"center",color:"var(--text-dim)",padding:32}}>{t("noAttendanceYet")}</div>}
          {pagedLogs.map(l=>(
            <div key={`card-${l.id}`} className="card" style={{marginBottom:10,padding:"14px 16px"}}>
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
        <div>
          <div style={{marginBottom:16}}>
            <input className="input" placeholder={t("searchWarrior")} value={bonusSearch} onChange={e=>setBonusSearch(e.target.value)} style={{maxWidth:300}} />
          </div>
          <div className="grid-3" style={{marginBottom:24}}>
            {members.filter(m=>m.name.toLowerCase().includes(bonusSearch.toLowerCase())).map(m=>{
              const b = computeBonuses(m);
              return (
                <div key={m.id} className="card" style={{padding:18}}>
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
                      {b.attendedAll?<span className="badge badge-gold">+300</span>:<span style={{fontSize:9,color:"var(--text-dim)",fontFamily:"'Inter',sans-serif"}}>{b.attendedNames.size}/{b.totalEvents}</span>}
                    </div>
                    <div style={{height:4,background:"rgba(255,255,255,0.07)",borderRadius:2}}>
                      <div style={{height:4,borderRadius:2,background:"linear-gradient(90deg,var(--gold-dim),var(--gold-light))",width:`${Math.min(100,(b.attendedNames.size/b.totalEvents)*100)}%`,transition:"width 0.4s"}} />
                    </div>
                    <div style={{fontSize:9,color:"var(--text-dim)",marginTop:3,fontFamily:"'Inter',sans-serif"}}>ISB · CA×2 · STI×2 · CS · WB×3</div>
                  </div>
                  {/* Sindri Veteran */}
                  <div style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                      <span style={{fontFamily:"'Inter',sans-serif",fontSize:11,fontWeight:700,color:b.sindriVet?"var(--gold-light)":"var(--text-dim)"}}>{t("sindriVeteran")}</span>
                      {b.sindriVet?<span className="badge badge-gold">{t("earned")}</span>:<span style={{fontSize:9,color:"var(--text-dim)",fontFamily:"'Inter',sans-serif"}}>{b.stiQualWeeks}/5 {t("weeksLabel")}</span>}
                    </div>
                    <div style={{height:4,background:"rgba(255,255,255,0.07)",borderRadius:2}}>
                      <div style={{height:4,borderRadius:2,background:"linear-gradient(90deg,#6c1e6c,#9b59b6)",width:`${Math.min(100,(b.stiQualWeeks/5)*100)}%`,transition:"width 0.4s"}} />
                    </div>
                    <div style={{fontSize:9,color:"var(--text-dim)",marginTop:3,fontFamily:"'Inter',sans-serif"}}>{b.stiQualWeeks}/5 {t("sindriProgress")}</div>
                  </div>
                  {/* ISB Veteran */}
                  <div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                      <span style={{fontFamily:"'Inter',sans-serif",fontSize:11,fontWeight:700,color:b.isbVet?"var(--gold-light)":"var(--text-dim)"}}>{t("isbVeteran")}</span>
                      {b.isbVet && <span className="badge badge-gold">+500</span>}
                    </div>
                    <div style={{height:4,background:"rgba(255,255,255,0.07)",borderRadius:2}}>
                      <div style={{height:4,borderRadius:2,background:"linear-gradient(90deg,#6c1e6c,#8e44ad)",width:`${Math.min(100,(b.isbCount/10)*100)}%`,transition:"width 0.4s"}} />
                    </div>
                    <div style={{fontSize:9,color:"var(--text-dim)",marginTop:3,fontFamily:"'Inter',sans-serif"}}>{b.isbCount}/10 {t("isbProgress")}</div>
                  </div>
                </div>
              );
            })}
            {members.filter(m=>m.name.toLowerCase().includes(bonusSearch.toLowerCase())).length===0&&(
              <div style={{gridColumn:"1/-1",textAlign:"center",padding:32,color:"var(--text-dim)",fontFamily:"'Inter',sans-serif"}}>{t("noWarriorMatch")}</div>
            )}
          </div>
          <div className="card card-gold" style={{marginBottom:16}}>
            <div style={{fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:14,color:"var(--gold-light)",marginBottom:6}}>{t("bonusRules")}</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <div style={{fontSize:12,color:"var(--text-dim)"}}>{t("bonusRuleMajor")} <strong style={{color:"var(--gold)"}}>{t("bonusCoins300")}</strong></div>
              <div style={{fontSize:12,color:"var(--text-dim)"}}>{t("bonusRuleSindri")} <strong style={{color:"var(--gold)"}}>{t("bonusCoins400")}</strong> {t("bonusOneTime")}</div>
              <div style={{fontSize:12,color:"var(--text-dim)"}}>{t("bonusRuleISB")} <strong style={{color:"var(--gold)"}}>{t("bonusCoins500")}</strong> {t("bonusOneTime")}</div>
            </div>
          </div>
          <div className="card card-red">
            <div style={{fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:14,color:"#e07070",marginBottom:6}}>{t("weeklyCoinDecay")}</div>
            <div style={{fontSize:12,color:"var(--text-dim)",lineHeight:1.7}}>{t("decayWarning")}</div>
            <span className="badge badge-red" style={{marginTop:8,display:"inline-block"}}>{t("decayBadge")}</span>
          </div>
        </div>
      )}

      {tab==="mylog" && (
        <div className="card" style={{padding:0}}>
          <div style={{padding:"16px 20px",borderBottom:"1px solid var(--border)"}}>
            <div style={{fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:15,color:"var(--gold-light)"}}>{t("myPointsHistoryTitle")}</div>
            <div style={{fontSize:11,color:"var(--text-dim)",marginTop:3}}>{t("myPointsHistoryDesc")}</div>
          </div>
          {(()=>{
            // Attendance entries
            const attendEntries = (currentUser.attendLog||[]).map(l=>({
              date:l.date, ts:l.ts, type:"Attendance",
              details:`${l.event}${l.qualifier&&l.qualifier!=="full"?` — ${l.qualifier}`:""}`,
              coins:l.coins,
            }));
            // This member's own weekly decay deductions (kept separate from
            // the single combined "All Members" announcement in the Global
            // Points Log, so each person sees their own actual amount here)
            const decayEntries = (currentUser.decayLog||[]).map(d=>({
              date:d.date, ts:d.ts, type:"Weekly Decay",
              details:"5% weekly coin decay",
              coins:d.amount,
            }));
            // Bonuses, admin manual adds/removes, Elder requests, auction wins —
            // everything in txLog except the combined "All Members" decay
            // announcement, which isn't this member's personal figure.
            const adjustmentEntries = (currentUser.txLog||[]).filter(entry=>entry.logType!=="Weekly Decay").map(entry=>({
              date:entry.date, ts:entry.ts, type:entry.logType||"Admin Manual Add",
              details:entry.reason||"—",
              coins:entry.change,
            }));
            const rawEntries = [...attendEntries, ...decayEntries, ...adjustmentEntries]
              .sort((a,b)=>logSortKey(b)-logSortKey(a));
            // Build the filter options from whichever types actually appear,
            // preferring a sensible fixed order with anything unexpected tacked on.
            const PREFERRED_ORDER = ["Attendance","Major Events Bonus","ISB Veteran Bonus","Sindri Veteran Bonus","Bonus Points","Elder Request","Admin Manual Add","Auction Win","Weekly Decay"];
            const presentTypes = PREFERRED_ORDER.filter(type=>rawEntries.some(e=>e.type===type));
            rawEntries.forEach(e=>{ if(!presentTypes.includes(e.type)) presentTypes.push(e.type); });
            const filteredEntries = (historyFilter==="All" ? rawEntries : rawEntries.filter(e=>e.type===historyFilter)).slice(0,40);
            const badgeClass = (e) => e.type==="Attendance"?"badge-blue":e.type==="Weekly Decay"?"badge-red":e.type==="Auction Win"?"badge-silver":e.coins>=0?"badge-gold":"badge-red";
            return (
              <>
                {presentTypes.length>0 && (
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",padding:"12px 20px",borderBottom:"1px solid var(--border)"}}>
                    {["All",...presentTypes].map(filterType=>(
                      <button key={filterType} className={`btn btn-sm ${historyFilter===filterType?"btn-gold":"btn-outline"}`} onClick={()=>setHistoryFilter(filterType)}>{filterType}</button>
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
                      <thead><tr><th>{t("colDateTime")}</th><th>{t("colType")}</th><th>{t("colDetails")}</th><th>{t("colCoins")}</th></tr></thead>
                      <tbody>
                        {filteredEntries.map((e,i)=>(
                          <tr key={i}>
                            <td data-label="Date & Time" style={{fontWeight:500,whiteSpace:"nowrap"}}>{formatLogDateTime(e)}</td>
                            <td data-label="Type"><span className={`badge ${badgeClass(e)}`}>{typeLabel(e.type,t)}</span></td>
                            <td data-label="Details" style={{fontFamily:"'Inter',sans-serif",fontWeight:600}}>{e.details}</td>
                            <td data-label="Coins" style={{fontFamily:"'Inter',sans-serif",fontWeight:800,color:e.coins>=0?"var(--gold-light)":"#e07070"}}><span style={{display:"inline-flex",alignItems:"center",gap:4}}><StatIcon src={COINS_ICON} size={22}/>{e.coins>0?`+${e.coins}`:e.coins}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="attendance-card-view" style={{padding:"4px 16px 16px"}}>
                    {filteredEntries.map((e,i)=>(
                      <div key={`card-${i}`} className="card" style={{marginBottom:8,padding:"12px 14px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8,marginBottom:6}}>
                          <span className={`badge ${badgeClass(e)}`}>{typeLabel(e.type,t)}</span>
                          <span style={{fontSize:10,color:"var(--text-dim)",whiteSpace:"nowrap"}}>{formatLogDateTime(e)}</span>
                        </div>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                          <span style={{fontFamily:"'Inter',sans-serif",fontWeight:600,fontSize:12,color:"var(--text-bright)",minWidth:0,overflow:"hidden",textOverflow:"ellipsis"}}>{e.details}</span>
                          <span style={{fontFamily:"'Inter',sans-serif",fontWeight:800,fontSize:13,color:e.coins>=0?"var(--gold-light)":"#e07070",flexShrink:0,display:"inline-flex",alignItems:"center",gap:4}}><StatIcon src={COINS_ICON} size={18}/>{e.coins>0?`+${e.coins}`:e.coins}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  </>
                )}
              </>
            );
          })()}
        </div>
      )}

      {tab==="globallog" && (
        <div className="card" style={{padding:0}}>
          <div style={{padding:"16px 20px",borderBottom:"1px solid var(--border)"}}>
            <div style={{fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:15,color:"var(--gold-light)"}}>{t("globalPointsTitle")}</div>
            <div style={{fontSize:11,color:"var(--text-dim)",marginTop:3}}>{t("globalPointsDesc")}</div>
          </div>
          {(()=>{
            // Show admin manual adds and all bonus entries
            const BONUS_TYPES = new Set(["Major Events Bonus","ISB Veteran Bonus","Sindri Veteran Bonus","Bonus Points","Elder Request","Weekly Decay"]);
            const allEntries = members.flatMap(m=>
              (m.txLog||[])
                .filter(entry=>entry.logType==="Admin Manual Add" || BONUS_TYPES.has(entry.logType) || (!entry.logType && entry.addedBy && entry.addedBy!=="System"))
                .map(entry=>({date:entry.date,ts:entry.ts,member:entry.logType==="Weekly Decay"?t("allMembersLabel"):m.name,type:entry.logType||"Admin Manual Add",amount:entry.change,addedBy:entry.addedBy||"—",reason:entry.reason||"—",cls:m.cls}))
            ).sort((a,b)=>logSortKey(b)-logSortKey(a)).slice(0,100);
            if (allEntries.length===0) return (
              <div style={{textAlign:"center",color:"var(--text-dim)",padding:32}}>{t("noGlobalAdjustments")}</div>
            );
            return (
              <>
              <div className="table-wrap attendance-table-view">
                <table className="table-stack">
                  <thead><tr><th>{t("colDateTime")}</th><th>{t("colMember")}</th><th>{t("colType")}</th><th>{t("colAmount")}</th><th>{t("colAddedBy")}</th><th>{t("colReason")}</th></tr></thead>
                  <tbody>
                    {allEntries.map((entry,i)=>(
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
                {allEntries.map((entry,i)=>(
                  <div key={`card-${i}`} className="card" style={{marginBottom:8,padding:"12px 14px"}}>
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
function Auctions({ ctx }) {
  const { auctions, setAuctions, members, setMembers, currentUser, addToast, fireCoinBurst, fireBalancePopup, tick, imageLibrary, addImage, removeAuction, attendanceLogs, lootResults, setLootResults, latestLootId, setLatestLootId, bidFeed } = ctx;
  const { t } = useLang();
  const [tab, setTab] = useState("active");
  const [bidAmounts, setBidAmounts] = useState({});
  const [bidSubmitting, setBidSubmitting] = useState({});
  const [newAuction, setNewAuction] = useState({name:"",image:null,rarity:"epic",desc:"",startBid:100,endsAtInput:timestampToGmt8String(Date.now()+30*60000)});
  const [sortBy, setSortBy] = useState("default");
  const [viewMode, setViewMode] = useState("grid");
  const isAdmin = currentUser.role==="Elder"||currentUser.role==="Master";
  const isMaster = currentUser.role==="Master";


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

  async function placeBid(auctionId, clickEvent) {
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
    if(amount<a.currentBid+5){addToast(`${t("minBidError")} ${fmt(a.currentBid+5)} ${t("minBidErrorSuffix")}`,"red",t("invalidBid"));return;}
    if(!me||me.coins<amount){addToast(t("insufficientCoins"),"red",t("noFunds"));return;}
    if(a.topBidder===currentUser.name){addToast(t("alreadyHighestBid"),"gold",t("alreadyWinning"));return;}

    // Re-check against the live DB value to catch another user's bid that
    // landed between polls (race condition under concurrent bidding).
    setBidSubmitting(prev=>({...prev,[auctionId]:true}));
    const fresh = await dbLoad("auctions", `id,current_bid,top_bidder,status&id=eq.${encodeURIComponent(auctionId)}`);
    setBidSubmitting(prev=>({...prev,[auctionId]:false}));
    const freshRow = Array.isArray(fresh) && fresh[0] ? fresh[0] : null;
    if (freshRow) {
      const freshBid = Number(freshRow.current_bid) || 0;
      if (freshRow.status !== "active") {
        addToast(t("auctionEnded"),"red",t("auctionEndedTitle"));
        return;
      }
      if (freshBid >= amount) {
        addToast(`${t("outbidMessage")} (${fmt(freshBid)}). ${t("pleaseRetry")}`,"red",t("outbidTitle"));
        return;
      }
      if (freshRow.top_bidder===currentUser.name) {
        addToast(t("alreadyHighestBid"),"gold",t("alreadyWinning"));
        return;
      }
    }
    // If freshRow is null (DB unreachable), fall through and proceed with
    // local-state check only — better to allow the bid than block users
    // entirely during a transient connection issue.

    // The authoritative refund amount is exactly what the previous top bidder paid,
    // which equals the auction's current_bid from the fresh DB row.
    const prevBidder = freshRow?.top_bidder ?? a.topBidder;
    const prevRefund = prevBidder ? (freshRow ? (Number(freshRow.current_bid) || 0) : (a.currentBid || 0)) : 0;

    // Apply both coin changes as ATOMIC database operations (see
    // adjustMemberCoinsAtomic above for why this matters) — this is the
    // actual source of truth. Local state below is just an optimistic
    // preview for instant UI feedback; the next poll cycle reconciles it
    // with whatever the database actually ended up with regardless.
    adjustMemberCoinsAtomic(currentUser.name, -amount);
    if (prevBidder && prevRefund > 0) {
      adjustMemberCoinsAtomic(prevBidder, prevRefund);
    }

    setMembers(ms=>ms.map(m=>{
      if(m.name===currentUser.name) return {...m,coins:m.coins-amount};
      if(prevBidder&&m.name===prevBidder&&prevRefund>0){
        return {...m,coins:m.coins+prevRefund};
      }
      return m;
    }), true);
    // SNIPE PROTECTION: if a bid lands in the last 60s, extend the auction by
    // 60s so no one can snipe in the final moment. This also helps with the
    // race where a bid is placed while another client's clock is closing it.
    const SNIPE_WINDOW_MS = 60000;
    const SNIPE_EXTEND_MS = 120000;
    const now2 = Date.now();
    const timeRemaining = a.endsAt - now2;
    const newEndsAt = timeRemaining < SNIPE_WINDOW_MS ? now2 + SNIPE_EXTEND_MS : a.endsAt;
    const endsAtChanged = newEndsAt !== a.endsAt;

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
    setNewAuction({name:"",image:null,rarity:"epic",desc:"",startBid:100,endsAtInput:timestampToGmt8String(Date.now()+30*60000)});
  }

  const RARITY_OPTS=[
    {value:"epic",label:t("rarityEpic"),color:"#ff8080",bg:"rgba(122,26,26,0.25)",border:"rgba(192,57,43,0.55)"},
    {value:"rare",label:t("rarityRare"),color:"#60aadd",bg:"rgba(26,90,138,0.2)",border:"rgba(46,134,193,0.5)"},
    {value:"kari",label:t("rarityKari"),color:"#a0d8ff",bg:"rgba(0,80,160,0.35)",border:"rgba(100,200,255,0.6)"},
    {value:"uncommon",label:t("rarityUncommon"),color:"#7ddc7d",bg:"rgba(46,138,46,0.2)",border:"rgba(80,180,80,0.55)"},
    {value:"material",label:t("rarityMaterial"),color:"#b8b8b8",bg:"rgba(120,120,120,0.25)",border:"rgba(160,160,160,0.55)"},
  ];

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

  return (
    <div>
      <div className="tabs">
        <div className={`tab${tab==="active"?" active":""}`} onClick={()=>setTab("active")}>{t("tabLiveAuctions")} ({active.length})</div>
        <div className={`tab${tab==="ended"?" active":""}`} onClick={()=>setTab("ended")}>{t("tabAuctionHistory")}</div>
        <div className={`tab${tab==="roulette"?" active":""}`} onClick={()=>setTab("roulette")}>{t("tabLootRoulette")}</div>
        {isAdmin&&<div className={`tab${tab==="create"?" active":""}`} onClick={()=>setTab("create")}>{t("tabCreateAuction")}</div>}
      </div>

      <BidMarquee feed={bidFeed} auctions={auctions} />

      {(tab==="active"||tab==="ended") && (
        <div style={{display:"flex",alignItems:"center",gap:10,margin:"14px 0 4px",flexWrap:"wrap",justifyContent:"flex-end"}}>
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

      {tab==="active" && (
        <div className={viewMode==="grid"?"grid-3":""} style={viewMode==="compact"?{display:"flex",flexDirection:"column",gap:6}:{}}>
          {active.length===0&&<div style={{color:"var(--text-dim)",gridColumn:"1/-1",textAlign:"center",padding:48,fontFamily:"'Inter',sans-serif"}}>{t("noActiveAuctionsNow")}</div>}
          {active.map(a=>{
            const isWinning=a.topBidder===currentUser.name;
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
                  <input className="input" type="number" min={minBid} placeholder={`${t("minBidPlaceholder")} ${fmt(minBid)}`}
                    value={bidAmounts[a.id]||""} onChange={e=>setBidAmounts(p=>({...p,[a.id]:e.target.value}))}
                    style={{flex:1,minWidth:0,fontSize:12,padding:"5px 8px"}} />
                  <button className="btn btn-gold btn-sm" onClick={(e)=>placeBid(a.id,e)} disabled={!!bidSubmitting[a.id]} style={{flexShrink:0,padding:"5px 14px"}}>
                    {bidSubmitting[a.id]?"…":t("bidButton")}
                  </button>

                  {isMaster&&<button className="btn btn-red btn-sm" onClick={()=>removeAuction(a.id)} title={t("removeTitle")} style={{flexShrink:0,padding:"5px 10px"}}>✕</button>}
                </div>
              </div>
            );
            return (
              <div key={a.id} className={`auction-card rarity-${a.rarity||"epic"}`}>
                <div className={`auction-img rarity-${a.rarity||"epic"}`} style={a.rarity==="kari"?{backgroundImage:`url(${KARI_BG})`}:{}}>
                  {a.image?<AuctionImage auction={a} alt={a.name} style={{width:"80%",height:"80%",objectFit:"contain",position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",filter:"drop-shadow(0 4px 16px rgba(0,0,0,0.7))"}} fallback={<StatIcon src={AUCTION_ICON} size={56}/>}/>:<StatIcon src={AUCTION_ICON} size={56}/>}
                  <div className="auction-timer pulse">{timeLeft(a.endsAt)}</div>
                  {(()=>{const r=rc2;return(<div style={{position:"absolute",top:8,left:8,zIndex:10,background:r.bg,fontFamily:"'Inter',sans-serif",fontSize:10,fontWeight:700,padding:"3px 8px",border:`1px solid ${r.border}`,letterSpacing:1,color:r.color}}>{rarityLabel(a.rarity||"epic",t)}</div>);})()}
                  {isWinning&&<div style={{position:"absolute",bottom:8,right:8,background:"rgba(39,174,96,0.85)",color:"#fff",fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:9,padding:"3px 8px",letterSpacing:1.5,textTransform:"uppercase"}}>{t("winningBadge")}</div>}
                </div>
                <div className="auction-body">
                  <div className="auction-name">{a.name}</div>
                  <div className="auction-desc">{a.desc}</div>
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
                  <div style={{marginTop:12,display:"flex",gap:8}}>
                    <input className="input" type="number" min={minBid} placeholder={`${t("minBidPlaceholder")} ${fmt(minBid)}`} value={bidAmounts[a.id]||""} onChange={e=>setBidAmounts(p=>({...p,[a.id]:e.target.value}))} style={{flex:1}} />
                    <button className="btn btn-gold" onClick={(e)=>placeBid(a.id,e)} disabled={!!bidSubmitting[a.id]}>{bidSubmitting[a.id]?"…":t("bidButton")}</button>
                  </div>

                  {isMaster&&<button className="btn btn-red btn-sm" style={{width:"100%",marginTop:6}} onClick={()=>removeAuction(a.id)}>{t("removeAuctionBtn")}</button>}
                  {((a.bids||[]).length>0 || a.topBidder)&&(
                    <div style={{marginTop:10,fontSize:11,color:"var(--text-dim)",borderTop:"1px solid var(--border-dim)",paddingTop:8}}>
                      {(a.bids||[]).length>0
                        ? [...(a.bids||[])].reverse().slice(0,2).map((b,i)=>(
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
              </div>
            );
          })}
        </div>
      )}

      {tab==="ended" && (
        <>
        <div className="card attendance-table-view" style={{padding:0}}>
          <div className="table-wrap">
            <table className="table-stack">
              <thead><tr><th>{t("colDateTime")}</th><th>{t("colItem")}</th><th>{t("colRarity")}</th><th>{t("colWinner")}</th><th>{t("colFinalBid")}</th></tr></thead>
              <tbody>
                {ended.length===0 && <tr><td colSpan={5} style={{textAlign:"center",color:"var(--text-dim)",padding:32}}>{t("noEndedAuctions")}</td></tr>}
                {ended.map(a=>(
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
        </div>

        {/* Mobile card view */}
        <div className="attendance-card-view">
          {ended.length===0 && <div className="card" style={{textAlign:"center",color:"var(--text-dim)",padding:32}}>{t("noEndedAuctions")}</div>}
          {ended.map(a=>(
            <div key={`card-${a.id}`} className="card" style={{marginBottom:10,padding:"14px 16px"}}>
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
        </div>
        </>
      )}

      {tab==="roulette"&&(
        <div>
          {/* ── Header ── */}
          <div className="card card-red" style={{marginBottom:20,padding:"18px 22px"}}>
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
                      <div className="card" style={{textAlign:"center",padding:32,color:"var(--text-dim)",fontFamily:"'Inter',sans-serif"}}>
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
                      };
                      const evColor=EVENT_COLOR_MAP[entry.eventLabel]||"#c8922a";
                      return(
                        <div key={entry.id} className="card" style={{marginBottom:14,position:"relative",overflow:"hidden"}}>
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
                <div className="card" style={{textAlign:"center",padding:48,color:"var(--text-dim)",fontFamily:"'Inter',sans-serif"}}>
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
                <div className="card" style={{marginBottom:16,position:"relative",overflow:"hidden"}}>
                  <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,rgba(200,146,42,0.6),transparent)"}} />
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
                <div className="card">
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
                <div className="card" style={{marginBottom:16}}>
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
                <div className="card card-red">
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

      {tab==="create"&&isAdmin&&(
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
          <button className="btn btn-gold" onClick={createAuction} style={{width:"100%",justifyContent:"center"}}><span style={{display:"inline-flex",alignItems:"center",gap:6}}><StatIcon src={AUCTION_ICON} size={28}/>{t("startAuction")}</span></button>
        </div>
      )}
    </div>
  );
}

// ─── LEADERBOARD ──────────────────────────────────────────────────────────────
const LB_PAGE = 10;

function LBList({ data, valueKey, label, format, color, currentUser, showMultiplier, rankOffset=0 }) {
  const { t } = useLang();
  const [page, setPage] = React.useState(0);
  const max=data[0]?.[valueKey]||1;
  const totalPages = Math.ceil(data.length/LB_PAGE);
  const visible = data.slice(page*LB_PAGE, (page+1)*LB_PAGE);
  const myRank = data.findIndex(m=>m.name===currentUser.name);
  const myEntry = data[myRank];
  const onCurrentPage = myRank>=page*LB_PAGE && myRank<(page+1)*LB_PAGE;

    return (
      <div className="card" style={{minWidth:0,overflow:"hidden"}}>
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
          const isMe = m.name===currentUser.name;
          return (
            <div key={m.id} className="lb-row" style={{background:isMe?"rgba(201,151,42,0.06)":"transparent",borderRadius:isMe?3:0,padding:isMe?"6px 8px":"10px 0"}}>
              <div className="lb-rank" style={{color:globalRank===0?"#f2d98a":globalRank===1?"#a8b8c8":globalRank===2?"#c87533":"var(--text-dim)"}}>{rankIcon(globalRank)}</div>
              <div style={{flexShrink:0}}><ClassIcon cls={m.cls} size={28}/></div>
              <div style={{flex:1,minWidth:0}}>
                <div className="lb-name" style={{color:isMe?"var(--gold-light)":"var(--text-bright)",textAlign:"left"}}>{m.name}{isMe&&<span style={{fontSize:9,color:"var(--gold)",marginLeft:5,fontWeight:700}}>{t("youSuffix")}</span>}</div>
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
function LeaderboardPodium({ topThree, onViewProfile }) {
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
              <div className="podium-card-frame">
                {rank === 1 && <div className="podium-crown"><CrownIcon size={34} /></div>}
                <ProfileCard member={m} onClick={()=>onViewProfile(m.id)} />
              </div>
              <div className="podium-rank-num">#{rank}</div>
              <div className="podium-name">{m.name}</div>
              <div className="podium-power">{fmt(m.power)} Power</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Leaderboard({ ctx }) {
  const { members, currentUser, setGlobalViewingProfile } = ctx;
  const { t } = useLang();
  const byCoins=[...members].sort((a,b)=>b.coins-a.coins);
  const byPower=[...members].sort((a,b)=>b.power-a.power);
  const byAttend=[...members].sort((a,b)=>b.attendance-a.attendance);
  const powerTopThree = byPower.slice(0,3);
  const powerRest = byPower.slice(3);

  return (
    <div>
      <div className="leaderboard-headline-row">
        <div className="leaderboard-headline-flourish leaderboard-headline-flourish--left" />
        <div className="leaderboard-headline-text">
          {possessive(CLAN_NAME)} {t("mightiestWarriors")}
        </div>
        <div className="leaderboard-headline-flourish leaderboard-headline-flourish--right" />
      </div>

      {powerTopThree.length > 0 && <LeaderboardPodium topThree={powerTopThree} onViewProfile={setGlobalViewingProfile} />}

      <div className="lb-grid">
        <LBList data={powerRest} valueKey="power" label={<span style={{display:"inline-flex",alignItems:"center",gap:7}}><LBIcon src={POWER_ICON} size={22} />{t("mostPowerful")}</span>} format={v=>fmt(v)} color="linear-gradient(90deg,#071824,#2e86c1)" currentUser={currentUser} showMultiplier rankOffset={3} />
        <LBList data={byCoins} valueKey="coins" label={<span style={{display:"inline-flex",alignItems:"center",gap:7}}><LBIcon src={RICHEST_ICON} size={22} />{t("richestWarriors")}</span>} format={v=>`${fmt(v)}`} currentUser={currentUser} />
        <LBList data={byAttend} valueKey="attendance" label={<span style={{display:"inline-flex",alignItems:"center",gap:7}}><LBIcon src={MOSTACTIVE_ICON} size={22} />{t("mostActive")}</span>} format={v=>`${v} ${t("attSuffix")}`} color="linear-gradient(90deg,#071a0f,#27ae60)" currentUser={currentUser} />
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
  const classPortrait = PROFILE_CLASS_PORTRAIT[member.cls];
  const awakeningLevel = member.awakeningLevel || 0;
  const RIBBON_COLORS = { 1: "#c77dff", 2: "#f2cc60", 3: "#d4d4d4" };
  const ribbonColor = RIBBON_COLORS[prestigeRank];

  return (
    <div
      onClick={onClick}
      style={{
        position:"relative",width:"100%",aspectRatio:"1142/1875",borderRadius:14,overflow:"hidden",containerType:"inline-size",
        cursor:onClick?"pointer":"default",
      }}
    >
      <img src={rarityBg} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}} />
      {classPortrait && (
        <img src={classPortrait} alt={member.cls} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}} />
      )}
      {/* Name banner sits beneath the frame so the frame's own border draws on top of it,
          matching the reference card where the frame overlaps the band's edges. */}
      <div style={{
        position:"absolute",left:"6%",right:"6%",top:"68%",
        aspectRatio:"414/90",
        backgroundImage:`url(${PROFILE_NAME_CONTAINER_URL})`,backgroundSize:"100% 100%",
        display:"flex",alignItems:"center",justifyContent:"center",
      }}>
        <span style={{
          fontFamily:"'Spectral',serif",fontWeight:700,
          fontSize:"clamp(14px, 3.6cqw, 28px)",color:"var(--text-bright)",
          textShadow:"0 2px 4px rgba(0,0,0,0.6)",
        }}>{member.name}</span>
      </div>
      <img src={PROFILE_FRAME_URL} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",pointerEvents:"none"}} />
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
    </div>
  );
}

// ─── PLAYER INFO PAGE ───────────────────────────────────────────────────────────
function PlayerInfo({ member, members, onBack }) {
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
  const rankings = [
    { label: "Power",  rank: powerRank },
    { label: "Richest", rank: byCoins.findIndex(m=>m.id===member.id)+1 },
    { label: "Active", rank: byAttend.findIndex(m=>m.id===member.id)+1 },
  ];

  // Prestige tier — matches the podium's gold/silver/bronze treatment,
  // based specifically on Power rank (not Richest or Active), so the
  // Player Info page's special treatment always lines up with whoever
  // is actually standing on the Leaderboard podium.
  const PRESTIGE_TIERS = {
    1: { name: "mythical", color: "#c77dff", glow: "rgba(199,125,255,0.5)", label: "Most Powerful in the Clan" },
    2: { name: "gold",     color: "#f2cc60", glow: "rgba(242,204,96,0.4)", label: "2nd Most Powerful in the Clan" },
    3: { name: "silver",   color: "#d4d4d4", glow: "rgba(192,192,192,0.4)", label: "3rd Most Powerful in the Clan" },
  };
  const prestige = PRESTIGE_TIERS[powerRank] || null;

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

  return (
    <div style={{position:"relative",paddingTop:prestige?16:0}}>
      {prestige && (
        <div style={{
          position:"absolute",top:0,left:0,right:0,height:4,borderRadius:2,
          background:`linear-gradient(90deg, transparent, ${prestige.color}, transparent)`,
          boxShadow:`0 0 16px ${prestige.glow}`,
        }} />
      )}
      {prestige && (
        <div style={{textAlign:"center",margin:"4px 0 16px"}}>
          <span style={{
            display:"inline-flex",alignItems:"center",gap:8,
            background:`${prestige.color}1a`,border:`1px solid ${prestige.color}66`,
            borderRadius:20,padding:"6px 16px",
          }}>
            <CrownIcon size={14} style={{color:prestige.color}} />
            <span style={{fontSize:11,fontWeight:800,color:prestige.color,letterSpacing:1}}>
              RANK {powerRank} &middot; {prestige.label.toUpperCase()}
            </span>
          </span>
        </div>
      )}
      <button className="btn btn-outline btn-sm" style={{marginBottom:16}} onClick={onBack}>Back to Members</button>

      <div className="card" style={{padding:24,marginBottom:20}}>
        <div className="player-info-layout">
          <div className="player-info-sidebar">
            <div style={{
              borderRadius:14,
              boxShadow:prestige?`0 0 28px ${prestige.glow}, 0 4px 20px ${prestige.glow}`:"none",
            }}>
              <ProfileCard member={member} prestigeRank={powerRank <= 3 ? powerRank : null} />
            </div>
            <div style={{
              background:"var(--bg-card)",
              border:prestige?`1px solid ${prestige.color}`:"1px solid var(--border)",
              borderTop:"none",borderRadius:"0 0 8px 8px",padding:"20px 16px",textAlign:"center",
              boxShadow:prestige?`0 4px 20px ${prestige.glow}`:"none",
            }}>
              <div style={{fontFamily:"'Spectral',serif",fontSize:13,color:"var(--text-mid)",letterSpacing:1,marginBottom:14}}>{member.cls}</div>

              <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:7,marginBottom:16}}>
                <PowerIcon size={18} />
                <span style={{
                  fontFamily:"'Spectral',serif",fontWeight:800,fontSize:26,
                  color:prestige?prestige.color:"var(--gold-bright)",
                  textShadow:prestige?`0 0 16px ${prestige.glow}`:"0 0 12px rgba(242,204,96,0.35)",
                }}>{fmt(member.power)}</span>
              </div>

              <div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:14,flexWrap:"wrap"}}>
                {rankings.map(r => (
                  <div key={r.label} style={{
                    display:"flex",flexDirection:"column",alignItems:"center",gap:2,
                    padding:"6px 9px",borderRadius:3,
                    background:"linear-gradient(135deg, rgba(242,204,96,0.1), rgba(124,84,15,0.06))",
                    border:"1px solid rgba(201,151,42,0.3)",
                  }}>
                    <span style={{fontFamily:"'Spectral',serif",fontWeight:800,fontSize:14,color:"var(--gold-bright)"}}>#{r.rank}</span>
                    <span style={{fontSize:8,color:"var(--text-dim)",letterSpacing:0.5,textTransform:"uppercase",fontWeight:700}}>{r.label}</span>
                  </div>
                ))}
              </div>

              <div style={{fontSize:11,color:"var(--text-dim)",borderTop:"1px solid var(--border)",paddingTop:12}}>
                <span style={{color:statusConfig.color,fontWeight:700}}>{statusConfig.label}</span>
                {daysSinceActivity !== null && ` \u00b7 ${daysSinceActivity === 0 ? "active today" : `seen ${daysSinceActivity}d ago`}`}
              </div>
            </div>
          </div>

          <div className="player-info-main">
            <div style={{
              background:prestige?`${prestige.color}0a`:"rgba(255,255,255,0.02)",
              border:prestige?`1px solid ${prestige.color}40`:"1px solid var(--border)",
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
              background:prestige?`${prestige.color}0a`:"rgba(255,255,255,0.02)",
              border:prestige?`1px solid ${prestige.color}40`:"1px solid var(--border)",
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
          </div>

          <div className="player-info-main" style={{display:"flex",flexDirection:"column",gap:16}}>
            <div className="card" style={{padding:20,border:prestige?`1px solid ${prestige.color}40`:undefined,background:prestige?`${prestige.color}0a`:undefined}}>
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

            <div className="card" style={{padding:20,border:prestige?`1px solid ${prestige.color}40`:undefined,background:prestige?`${prestige.color}0a`:undefined}}>
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

    </div>
  );
}


function Settings({ ctx }) {
  const { currentUser, members, setMembers, addToast } = ctx;
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
  useEffect(() => {
    const lastMonthStart = getLastMonthStart();
    let lastReset = 0;
    try { lastReset = parseInt(localStorage.getItem("last_attendance_reset") || "0"); } catch {}
    if (lastReset < lastMonthStart) {
      setMembers(ms=>ms.map(m=>({...m,attendance:0})));
      try { localStorage.setItem("last_attendance_reset", lastMonthStart.toString()); } catch {}
      addToast(t("autoAttendanceResetApplied"),"blue",t("resetTitle"));
    }
  }, []);

  function triggerDecay() {
    const decayDate = new Date().toLocaleDateString();
    const decayTs = Date.now();
    setMembers(ms=>{
      let totalDecayed = 0;
      const updated = ms.map(m=>{
        const d=Math.floor(m.coins*0.05);
        totalDecayed += d;
        return{...m,coins:m.coins-d,decayLog:[...(m.decayLog||[]),{amount:-d,date:decayDate,ts:decayTs}]};
      });
      if (updated.length>0) {
        updated[0] = {...updated[0], txLog:[...(updated[0].txLog||[]),
          {change:-totalDecayed,reason:`5% weekly coin decay applied to all ${updated.length} members`,date:decayDate,logType:"Weekly Decay",addedBy:currentUser.name,ts:decayTs}]};
      }
      return updated;
    });
    addToast(t("decayTriggeredToast"),"red",t("decayTriggeredTitle"));
    // Record this in the SHARED server-side state (not just localStorage),
    // so the cron-driven check (api/check-weekly-decay.js) correctly sees
    // that this week's decay has already happened and doesn't run it
    // again — regardless of which device/browser this button was clicked
    // from.
    dbUpsert("app_state", { key: "last_decay_ts", value: String(getMostRecentScheduledDecay()), updated_at: Date.now() });
  }
  function resetAttendance() {
    setMembers(ms=>ms.map(m=>({...m,attendance:0})));
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
          <div style={{fontSize:13,color:"var(--text-dim)",marginBottom:12,lineHeight:1.7}}>{t("coinDecayDesc")}</div>
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
        <SectionTitle>{t("eventCoinValues")}</SectionTitle>
        <div className="table-wrap"><table className="table-stack">
          <thead><tr><th>{t("colEventName")}</th><th>{t("colId")}</th><th>{t("colCoins")}</th></tr></thead>
          <tbody>{EVENTS.map(ev=>(
            <tr key={ev.id}>
              <td data-label="Event" style={{fontFamily:"'Inter',sans-serif",fontWeight:600}}>{ev.name}</td>
              <td data-label="ID"><span className="badge badge-silver">{ev.id}</span></td>
              <td data-label="Coins" style={{color:"var(--gold)",fontFamily:"'Inter',sans-serif",fontWeight:800}}>{ev.coins}</td>
            </tr>
          ))}</tbody>
        </table></div>
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
  function submit() {
    if(!form.name||!form.username){addToast(t("nameUsernameRequired"),"red",t("errorLabel"));return;}
    const newM={id:Date.now(),name:form.name,username:form.username,password:form.password,cls:form.cls,power:parseInt(form.power)||10000,role:form.role,coins:0,attendance:0,auctionWins:0,joinDate:new Date().toLocaleDateString(),decayLog:[],txLog:[],attendLog:[],powerLog:[],discord:""};
    setMembers(ms=>[...ms,newM]);
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
        <div className="modal-footer"><button className="btn btn-outline" onClick={()=>setModal(null)}>{t("cancel")}</button><button className="btn btn-gold" onClick={submit}>{t("addMemberTitle")}</button></div>
      </div>
    </div>
  );
}

// ─── ADJUST COINS MODAL ───────────────────────────────────────────────────────
function AdjustCoinsModal({ ctx }) {
  const { modal, setModal, setMembers, addToast, currentUser, submitCoinRequest } = ctx;
  const { t } = useLang();
  const member = modal.data;
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");
  const isMaster = currentUser.role==="Master";
  const isElder = currentUser.role==="Elder";
  function submit(type) {
    const val=parseInt(amount)||0;
    if (val<=0) { addToast(t("enterValidAmount"), "red", t("errorLabel")); return; }
    if (isElder && !isMaster) {
      submitCoinRequest(member.id, val, type, reason);
      setModal(null);
      return;
    }
    const change=type==="add"?val:-val;
    const logType=reason.toLowerCase().includes("bonus")?"Bonus Points":"Admin Manual Add";
    setMembers(ms=>ms.map(m=>m.id===member.id?{...m,coins:Math.max(0,m.coins+change),txLog:[...(m.txLog||[]),{change,reason:reason||"—",date:new Date().toLocaleDateString(),logType,addedBy:currentUser.name,ts:Date.now()}]}:m));
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
          <div className="form-group"><label className="form-label">{t("amountLabel")}</label><input className="input" type="number" min={0} value={amount} onChange={e=>setAmount(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">{t("reasonOptional")}</label><input className="input" placeholder={t("reasonPlaceholder")} value={reason} onChange={e=>setReason(e.target.value)} /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={()=>setModal(null)}>{t("cancel")}</button>
          <button className="btn btn-red" onClick={()=>submit("remove")}>{isElder&&!isMaster?t("requestRemove"):t("removeAmount")}</button>
          <button className="btn btn-gold" onClick={()=>submit("add")}>{isElder&&!isMaster?t("requestAdd"):t("addAmount")}</button>
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
  const { modal, setModal, setMembers, setCurrentUser, addToast, currentUser } = ctx;
  const { t } = useLang();
  const target = modal.data;
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [conf, setConf] = useState("");
  const [err, setErr] = useState("");

  function submit() {
    setErr("");
    if (cur !== target.password) { setErr(t("currentPasswordIncorrect")); return; }
    if (!pw) { setErr(t("newPasswordEmpty")); return; }
    if (pw !== conf) { setErr(t("passwordsNoMatch")); return; }
    setMembers(ms => ms.map(m => m.id === target.id ? {...m, password: pw} : m));
    if (currentUser.id === target.id) setCurrentUser(u => ({...u, password: pw}));
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
            <input className="input" type="password" placeholder={t("currentPasswordPlaceholder")} value={cur} onChange={e=>setCur(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">{t("newPasswordLabel")}</label>
            <input className="input" type="password" placeholder={t("newPasswordPlaceholder")} value={pw} onChange={e=>setPw(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">{t("confirmNewPasswordLabel")}</label>
            <input className="input" type="password" placeholder={t("repeatPasswordPlaceholder")} value={conf} onChange={e=>setConf(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={()=>setModal(null)}>{t("cancel")}</button>
          <button className="btn btn-gold" onClick={submit}>{t("savePasswordBtn")}</button>
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
  const { modal, setModal, members, setMembers, setAttendanceLogs, addToast } = ctx;
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

  function confirmDelete() {
    setMembers(ms => ms.map(m => {
      if (hasAttendeeList && !attendeeNames.has(m.name)) return m;
      const candidates = (m.attendLog||[]).filter(e => findMatch(log, ts, e));
      const matchingAttend = pickMatch(candidates);
      if (!matchingAttend) return m;
      const refund = matchingAttend.coins || 0;
      const entryTs = matchingAttend.ts;
      const bonusRefund = (m.txLog||[]).filter(entry => entry.addedBy === "System" && entryTs != null && String(entry.ts) === String(entryTs)).reduce((s,entry)=>s+(entry.change||0),0);
      return {
        ...m,
        coins: Math.max(0, m.coins - refund - bonusRefund),
        attendance: Math.max(0, m.attendance - (matchingAttend.qualifier!=="afk" ? 1 : 0)),
        attendLog: (m.attendLog||[]).filter(e => e !== matchingAttend),
        txLog: (m.txLog||[]).filter(entry => !(entry.addedBy === "System" && entryTs != null && String(entry.ts) === String(entryTs))),
      };
    }));
    setAttendanceLogs(p => p.filter(l => l.id !== log.id));
    addToast(`"${log.event}" ${t("attendanceDeletedToast")} ${fmt(totalRefund)} ${t("deductedFromToast")} ${affected.length} ${t("memberSuffix2")}`, "red", t("attendanceDeletedTitle"));
    setModal(null);
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
  const { setModal, members, setMembers, addToast, setAttendanceLogs, currentUser } = ctx;
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

  function submit() {
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
      setMembers(ms => {
        const { updatedMembers, bonusToasts } = performAttendancePayout(ms, { ev, date, ts, present, qualifierMap });
        setTimeout(()=>{
          bonusToasts.forEach(bonus=>addToast(<span style={{display:"inline-flex",alignItems:"center",gap:6}}><TrophyIcon size={14}/>{bonus.name} {t("earnedBonusText")} +{bonus.coins} {t("coinsText")} — {bonus.bonus} {t("bonusText")}</span>,"gold",t("bonusAwarded")));
        }, 200);
        return updatedMembers;
      });
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
