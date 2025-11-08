/**
 * FOOTVOLLEY LIVESTREAM SERVER
 * 
 * This is the main server file that handles:
 * 1. Web server for referee control interface and overlay
 * 2. Real-time communication between referee controls and live overlay
 * 3. Google Sheets integration for tournament rankings
 * 4. Automatic browser opening for ease of use
 * 
 * The server creates two main web pages:
 * - /control.html - Simple interface for referee to control scores, names, etc.
 * - /overlay.html - Transparent overlay that shows on the livestream
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { google } = require('googleapis');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const open = require('open'); // This will automatically open web browser
const multer = require('multer');
const XLSX = require('xlsx');
require('dotenv').config();

const RANKING_UPLOAD_DIR = path.join(__dirname, 'uploads', 'ranking');
const RANKING_WORKBOOK_PATH = path.join(RANKING_UPLOAD_DIR, 'ranking-latest.xlsx');
const RANKING_META_PATH = path.join(RANKING_UPLOAD_DIR, 'ranking-meta.json');
const RANKINGS_REFRESH_INTERVAL = Number(process.env.RANKINGS_REFRESH_INTERVAL_MS || 60_000);
const RANKING_UPLOAD_MAX_SIZE = Number(process.env.RANKING_UPLOAD_MAX_BYTES || 15 * 1024 * 1024);

const rankingStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        try {
            ensureRankingUploadDir();
            cb(null, RANKING_UPLOAD_DIR);
        } catch (error) {
            cb(error, RANKING_UPLOAD_DIR);
        }
    },
    filename: (req, file, cb) => {
        cb(null, path.basename(RANKING_WORKBOOK_PATH));
    }
});

const acceptedMimeTypes = new Set([
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.ms-excel.sheet.macroenabled.12',
    'application/vnd.ms-excel.sheet.binary.macroenabled.12',
    'application/octet-stream'
]);

const rankingUpload = multer({
    storage: rankingStorage,
    limits: {
        fileSize: RANKING_UPLOAD_MAX_SIZE
    },
    fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const allowedExtensions = ['.xlsx', '.xlsm', '.xlsb', '.xls'];
    const isAllowedExtension = allowedExtensions.includes(extension);
    const mimetype = (file.mimetype || '').toLowerCase();
    const isAllowedMime = acceptedMimeTypes.has(mimetype);

        if (!isAllowedExtension || !isAllowedMime) {
            return cb(new Error('Only Excel workbooks (.xlsx, .xlsm) are supported'));
        }

        cb(null, true);
    }
});

const SPORT_TYPES = {
    FOOTVOLLEY: 'footvolley',
    FUTSAL: 'futsal'
};

const defaultOverlaySettingsBySport = {
    [SPORT_TYPES.FOOTVOLLEY]: {
        textScale: 100,
        divisionOptions: ['Male A', 'Male B', 'Female A', 'Female C', 'Mixed Duos'],
        hostLogoScale: 100,
        sponsorLogoScale: 100,
        matchInfoScale: 100,
        colorPalette: {
            primaryPink: { c: 0, m: 58, y: 38, k: 0 },
            primaryOrange: { c: 0, m: 46, y: 76, k: 0 },
            primaryYellow: { c: 0, m: 15, y: 76, k: 0 },
            primaryGreen: { c: 48, m: 0, y: 39, k: 19 },
            primaryBlue: { c: 69, m: 39, y: 0, k: 0 },
            primaryPurple: { c: 39, m: 52, y: 0, k: 0 }
        }
    },
    [SPORT_TYPES.FUTSAL]: {
        textScale: 100,
        divisionOptions: ['Open League'],
        hostLogoScale: 100,
        sponsorLogoScale: 100,
        matchInfoScale: 100,
        colorPalette: {
            primaryPink: { c: 67, m: 52, y: 0, k: 46 }, // Deep blue primary hue
            primaryOrange: { c: 67, m: 52, y: 0, k: 46 },
            primaryYellow: { c: 0, m: 16, y: 75, k: 9 }, // Gold accent
            primaryGreen: { c: 0, m: 0, y: 0, k: 0 },
            primaryBlue: { c: 67, m: 52, y: 0, k: 46 },
            primaryPurple: { c: 0, m: 0, y: 0, k: 0 }
        }
    }
};

const FUTSAL_DEFAULT_TIMER_MS = 15 * 60 * 1000;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const toNumeric = (value, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
};

function cloneOverlaySettingsForSport(sport = SPORT_TYPES.FOOTVOLLEY) {
    const source = defaultOverlaySettingsBySport[sport] || defaultOverlaySettingsBySport[SPORT_TYPES.FOOTVOLLEY];
    return JSON.parse(JSON.stringify(source));
}

function getPlayerSlotsForSport(sport = SPORT_TYPES.FOOTVOLLEY) {
    return sport === SPORT_TYPES.FUTSAL ? 3 : 2;
}

function normalizePlayers(players, sport = SPORT_TYPES.FOOTVOLLEY) {
    const required = getPlayerSlotsForSport(sport);
    const sanitized = Array.isArray(players) ? players.slice(0, required) : [];
    while (sanitized.length < required) {
        sanitized.push('');
    }
    return sanitized;
}

function createDefaultTimerState() {
    const minutes = Math.floor(FUTSAL_DEFAULT_TIMER_MS / 60000);
    return {
        running: false,
        durationMs: FUTSAL_DEFAULT_TIMER_MS,
        remainingMs: FUTSAL_DEFAULT_TIMER_MS,
        lastUpdatedAt: null,
        minutes,
        seconds: 0
    };
}

function syncTimerDisplayFields(timer) {
    if (!timer) {
        return;
    }

    const remaining = Math.max(0, Number(timer.remainingMs) || 0);
    const totalSeconds = Math.floor(remaining / 1000);
    timer.minutes = Math.floor(totalSeconds / 60);
    timer.seconds = totalSeconds % 60;
}

const rankingCache = {
    workbook: null,
    sourceMtime: null,
    division: new Map()
};

let timerInterval = null;

function ensureTimerState() {
    if (!gameState.timer) {
        gameState.timer = createDefaultTimerState();
    }
    syncTimerDisplayFields(gameState.timer);
    return gameState.timer;
}

function clearTimerInterval() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function getTimerPayload() {
    const timer = ensureTimerState();
    return {
        running: Boolean(timer.running),
        durationMs: Number(timer.durationMs) || FUTSAL_DEFAULT_TIMER_MS,
        remainingMs: Math.max(0, Number(timer.remainingMs) || 0),
        minutes: Number(timer.minutes) || 0,
        seconds: Number(timer.seconds) || 0
    };
}

function broadcastTimerUpdate() {
    io.emit('timerUpdate', getTimerPayload());
}

function resetFutsalTimer() {
    const timer = ensureTimerState();
    clearTimerInterval();
    timer.running = false;
    timer.durationMs = FUTSAL_DEFAULT_TIMER_MS;
    timer.remainingMs = FUTSAL_DEFAULT_TIMER_MS;
    timer.lastUpdatedAt = null;
    syncTimerDisplayFields(timer);
    broadcastTimerUpdate();
}

function pauseTimer() {
    const timer = ensureTimerState();
    if (!timer.running) {
        return;
    }
    const now = Date.now();
    if (timer.lastUpdatedAt) {
        const elapsed = Math.max(0, now - timer.lastUpdatedAt);
        timer.remainingMs = Math.max(0, timer.remainingMs - elapsed);
    }
    clearTimerInterval();
    timer.running = false;
    timer.lastUpdatedAt = null;
    syncTimerDisplayFields(timer);
    broadcastTimerUpdate();
}

function tickFutsalTimer() {
    const timer = ensureTimerState();
    if (!timer.running) {
        clearTimerInterval();
        return;
    }

    const now = Date.now();
    const elapsed = timer.lastUpdatedAt ? Math.max(0, now - timer.lastUpdatedAt) : 0;
    timer.lastUpdatedAt = now;
    timer.remainingMs = Math.max(0, timer.remainingMs - elapsed);
    syncTimerDisplayFields(timer);

    if (timer.remainingMs <= 0) {
        timer.running = false;
        clearTimerInterval();
    }

    broadcastTimerUpdate();
}

function startFutsalTimer() {
    const timer = ensureTimerState();
    if (gameState.sport !== SPORT_TYPES.FUTSAL) {
        return;
    }

    if (timer.remainingMs <= 0) {
        timer.remainingMs = timer.durationMs;
    }

    if (timer.running) {
        return;
    }

    timer.running = true;
    timer.lastUpdatedAt = Date.now();
    syncTimerDisplayFields(timer);
    broadcastTimerUpdate();

    clearTimerInterval();
    timerInterval = setInterval(tickFutsalTimer, 1000);
}

function setTimerManually(minutes, seconds) {
    const timer = ensureTimerState();
    const minutesNumeric = clamp(Number(minutes) || 0, 0, 59);
    const secondsNumeric = clamp(Number(seconds) || 0, 0, 59);
    const totalMs = Math.max(0, (minutesNumeric * 60 + secondsNumeric) * 1000);

    clearTimerInterval();
    if (totalMs > 0) {
        timer.durationMs = totalMs;
    }
    timer.remainingMs = totalMs;
    timer.running = false;
    timer.lastUpdatedAt = null;
    syncTimerDisplayFields(timer);
    broadcastTimerUpdate();
}

function ensureRankingUploadDir() {
    if (!fs.existsSync(RANKING_UPLOAD_DIR)) {
        fs.mkdirSync(RANKING_UPLOAD_DIR, { recursive: true });
    }
}

function loadRankingMetaFromDisk() {
    try {
        ensureRankingUploadDir();

        if (!fs.existsSync(RANKING_WORKBOOK_PATH)) {
            return { path: null, originalName: null, uploadedAt: null, size: 0 };
        }

        let storedMeta = {};
        if (fs.existsSync(RANKING_META_PATH)) {
            storedMeta = JSON.parse(fs.readFileSync(RANKING_META_PATH, 'utf8'));
        }

        const stats = fs.statSync(RANKING_WORKBOOK_PATH);
        return {
            path: RANKING_WORKBOOK_PATH,
            originalName: storedMeta.originalName || 'ranking-latest.xlsx',
            uploadedAt: storedMeta.uploadedAt || stats.mtime.toISOString(),
            size: stats.size
        };
    } catch (error) {
        console.error('⚠️  Unable to load ranking metadata:', error.message);
        return { path: null, originalName: null, uploadedAt: null, size: 0 };
    }
}

function saveRankingMeta(meta) {
    try {
        ensureRankingUploadDir();
        fs.writeFileSync(RANKING_META_PATH, JSON.stringify(meta, null, 2), 'utf8');
    } catch (error) {
        console.error('⚠️  Unable to save ranking metadata:', error.message);
    }
}

let rankingSource = loadRankingMetaFromDisk();

function getRankingSourcePath() {
    if (rankingSource?.path && fs.existsSync(rankingSource.path)) {
        return rankingSource.path;
    }
    return null;
}

function updateRankingSource(meta) {
    rankingSource = {
        path: meta.path || null,
        originalName: meta.originalName || null,
        uploadedAt: meta.uploadedAt || null,
        size: meta.size || 0
    };
    saveRankingMeta(rankingSource);
}

function resetRankingCache() {
    rankingCache.workbook = null;
    rankingCache.sourceMtime = null;
    rankingCache.division.clear();
}

function loadRankingWorkbook(forceRefresh = false) {
    const workbookPath = getRankingSourcePath();
    if (!workbookPath) {
        throw new Error('No ranking workbook uploaded yet');
    }

    const stats = fs.statSync(workbookPath);
    const shouldReload =
        forceRefresh ||
        !rankingCache.workbook ||
        rankingCache.sourceMtime === null ||
        rankingCache.sourceMtime !== stats.mtimeMs;

    if (shouldReload) {
        console.log('📚 Loading ranking workbook from disk...');
        const workbook = XLSX.readFile(workbookPath, {
            cellDates: true,
            cellNF: false,
            cellText: false
        });

        rankingCache.workbook = workbook;
        rankingCache.sourceMtime = stats.mtimeMs;
        rankingCache.division.clear();
    }

    return rankingCache.workbook;
}

const DIVISION_SHEET_MAP = {
    'Male A': 'Male A-3',
    'Male B': 'Male B-3',
    'Male C': 'Male C-3',
    'Male D': 'Male D-3',
    'Female A': 'Female A-3',
    'Female B': 'Female B-3',
    'Female C': 'Female C-3',
    'Mixed Duos': 'MDS-1',
    'Unlikely Duos': 'UD-1',
    'Foottable': 'Foottable #1'
};

const stageOrder = ['Quarterfinals', 'Semifinals', 'Final', 'Third Place'];

function sheetToRowArrays(sheet) {
    if (!sheet) {
        return [];
    }

    const rows = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: null,
        blankrows: false,
        raw: true
    });

    return Array.isArray(rows) ? rows : [];
}

function isValueEmpty(value) {
    if (value === null || value === undefined) {
        return true;
    }
    if (typeof value === 'number') {
        return Number.isNaN(value);
    }
    if (typeof value === 'string') {
        return value.trim() === '';
    }
    return false;
}

function sanitizeNumber(value) {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    const cleaned = String(value).replace(/[^0-9.-]/g, '');
    if (!cleaned) {
        return null;
    }

    const numeric = Number(cleaned);
    return Number.isFinite(numeric) ? numeric : null;
}

function sanitizeTeamName(value) {
    if (value === null || value === undefined) {
        return '';
    }
    return String(value).replace(/\s+/g, ' ').trim();
}

function parseRankValue(value, fallback) {
    const numeric = sanitizeNumber(value);
    if (numeric !== null) {
        return numeric;
    }

    if (typeof value === 'string') {
        const match = value.match(/(\d+)/);
        if (match) {
            const parsed = Number(match[1]);
            if (Number.isFinite(parsed)) {
                return parsed;
            }
        }
    }

    return fallback ?? null;
}

function findGroupHeaderRow(rows) {
    for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        if (!row) {
            continue;
        }

        const trimmed = row.map((cell) => (typeof cell === 'string' ? cell.trim() : cell));
        const normalized = trimmed.map((cell) => (typeof cell === 'string' ? cell.toLowerCase() : ''));

        const hasGroup = normalized.some((value) => value && value.includes('group'));
        const hasTeam = normalized.some((value) => value && (/athlete/.test(value) || value.includes('team') || value.includes('dupla')));
        const hasWins = normalized.some((value) => value && value.startsWith('win'));
        const hasSaldo = normalized.some((value) => value && (value.includes('saldo') || value.includes('balance') || value.includes('+/-')));

        if (hasGroup && hasTeam && (hasWins || hasSaldo)) {
            return { index, headers: trimmed };
        }
    }

    return { index: -1, headers: [] };
}

function extractGroupRanking(sheet) {
    const rows = sheetToRowArrays(sheet);
    if (!rows.length) {
        return [];
    }

    const { index: headerIndex, headers } = findGroupHeaderRow(rows);
    if (headerIndex === -1) {
        return [];
    }

    const normalizedHeaders = headers.map((header) => (header ? header.toString().trim().toLowerCase() : ''));

    const columnIndexes = {
        team: normalizedHeaders.findIndex((value) => value && (/athlete/.test(value) || value.includes('team') || value.includes('dupla'))),
        wins: normalizedHeaders.findIndex((value) => value === 'win' || value === 'wins'),
        losses: normalizedHeaders.findIndex((value) => value.startsWith('lose') || value === 'losses'),
        saldo: normalizedHeaders.findIndex((value) => value.includes('saldo') || value.includes('balance') || value.includes('dif')),
        pointsFor: normalizedHeaders.findIndex((value) => value === 'pm' || value.includes('points for') || value === 'pf'),
        pointsAgainst: normalizedHeaders.findIndex((value) => value === 'pa' || value.includes('against') || value.includes('conceded')),
        rank: normalizedHeaders.findIndex((value) => value === 'rank' || value === 'ranking'),
        overallRank: normalizedHeaders.findIndex((value) => value.includes('overall') && value.includes('rank'))
    };

    const entries = [];
    for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];
        if (!row) {
            continue;
        }

        const nonEmptyCells = row.filter((cell) => !isValueEmpty(cell));
        if (!nonEmptyCells.length) {
            if (entries.length) {
                break;
            }
            continue;
        }

        const combined = row.map((cell) => (typeof cell === 'string' ? cell.trim() : cell)).join(' ').toLowerCase();
        if (combined.includes('reference') || combined.includes('group phase')) {
            break;
        }

        const teamRaw = columnIndexes.team !== -1 ? row[columnIndexes.team] : null;
        const teamName = sanitizeTeamName(teamRaw);
        if (!teamName) {
            continue;
        }

        const winsValue = columnIndexes.wins !== -1 ? sanitizeNumber(row[columnIndexes.wins]) : null;
        const lossesValue = columnIndexes.losses !== -1 ? sanitizeNumber(row[columnIndexes.losses]) : null;
        const saldoValue = columnIndexes.saldo !== -1 ? sanitizeNumber(row[columnIndexes.saldo]) : null;
        const pointsForValue = columnIndexes.pointsFor !== -1 ? sanitizeNumber(row[columnIndexes.pointsFor]) : null;
        const pointsAgainstValue = columnIndexes.pointsAgainst !== -1 ? sanitizeNumber(row[columnIndexes.pointsAgainst]) : null;

        const rankCandidate = columnIndexes.rank !== -1 ? row[columnIndexes.rank] : null;
        const overallCandidate = columnIndexes.overallRank !== -1 ? row[columnIndexes.overallRank] : null;
        const rankValue = parseRankValue(rankCandidate ?? overallCandidate, entries.length + 1);

        const entry = {
            rank: rankValue,
            team: teamName,
            wins: winsValue,
            losses: lossesValue,
            saldo: saldoValue,
            pointsFor: pointsForValue,
            pointsAgainst: pointsAgainstValue
        };

        if (entry.pointsAgainst === null && entry.pointsFor !== null && entry.saldo !== null) {
            entry.pointsAgainst = entry.pointsFor - entry.saldo;
        }

        entries.push(entry);
    }

    return entries;
}

function extractEliminationBracket(sheet) {
    void sheet;
    return [];
}

function getRankingMetaForClient() {
    if (!rankingSource?.path || !fs.existsSync(rankingSource.path)) {
        return {
            hasFile: false,
            originalName: null,
            uploadedAt: null,
            size: 0
        };
    }

    return {
        hasFile: true,
        originalName: rankingSource.originalName || 'ranking-latest.xlsx',
        uploadedAt: rankingSource.uploadedAt || null,
        size: rankingSource.size || 0
    };
}

async function getDivisionRanking(division, forceRefresh = false) {
    const divisionKey = typeof division === 'string' ? division.trim() : '';
    if (!divisionKey) {
        throw new Error('Division is required for ranking data');
    }

    const cacheKey = divisionKey.toLowerCase();
    const cached = rankingCache.division.get(cacheKey);
    if (cached && !forceRefresh && (Date.now() - cached.timestamp < RANKINGS_REFRESH_INTERVAL)) {
        return cached.data;
    }

    const workbook = loadRankingWorkbook(forceRefresh);
    const sheetName = DIVISION_SHEET_MAP[divisionKey] || divisionKey;
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
        throw new Error(`Worksheet "${sheetName}" not found in uploaded rankings file`);
    }

    const group = extractGroupRanking(sheet);
    const elimination = extractEliminationBracket(sheet);

    const data = {
        division: divisionKey,
        sheet: sheetName,
        updatedAt: new Date().toISOString(),
        group,
        elimination,
        source: getRankingMetaForClient()
    };

    rankingCache.division.set(cacheKey, { data, timestamp: Date.now() });
    return data;
}

// Create our web server
const app = express();
const server = http.createServer(app);

// Socket.IO enables real-time communication between referee controls and overlay
const io = socketIo(server, {
    cors: {
        origin: "*", // Allow connections from any source
        methods: ["GET", "POST"]
    }
});

// Middleware - these help our server handle different types of requests
app.use(cors()); // Allow cross-origin requests
app.use(express.json()); // Parse JSON data in requests
app.use(express.static('public')); // Serve files from 'public' folder

/**
 * GAME STATE OBJECT
 * This stores all the current information about the match
 * When referee changes something, this gets updated and sent to overlay
 */
const overlaySettingsBySport = {
    [SPORT_TYPES.FOOTVOLLEY]: cloneOverlaySettingsForSport(SPORT_TYPES.FOOTVOLLEY),
    [SPORT_TYPES.FUTSAL]: cloneOverlaySettingsForSport(SPORT_TYPES.FUTSAL)
};

let gameState = {
    sport: SPORT_TYPES.FOOTVOLLEY,
    displayOptions: {
        showSponsors: false,
        showMatchDetails: false,
        showHostedBy: false
    },
    // Team information
    team1: { 
        name: 'Team 1', 
        score: 0,
        setsWon: 0,
        // Player names for more detailed display
        players: normalizePlayers(['Player 1A', 'Player 1B'], SPORT_TYPES.FOOTVOLLEY)
    },
    team2: { 
        name: 'Team 2', 
        score: 0,
        setsWon: 0,
        players: normalizePlayers(['Player 2A', 'Player 2B'], SPORT_TYPES.FOOTVOLLEY)
    },
    
    // Match information
    currentSet: 1,
    maxSets: 3, // Best of 3 sets typical for footvolley
    setScores: {
        team1: [0, 0, 0], // Scores for each set
        team2: [0, 0, 0]
    },
    setsEnabled: false,
    
    // Tournament information
    tournament: {
        name: 'San Diego Footvolley Open 2025',
        division: 'Male A',
        round: 'Quarter Finals',
        location: 'Mission Bay, San Diego - CA'
    },
    
    // Display controls
    showReplay: false,
    showRankings: false,
    showPlayerNames: false, // Toggle between team names and player names
    
    // Replay queue system for referee
    replayQueue: [],
    
    // Timer (optional, for timed sets)
    timer: {
        minutes: 0,
        seconds: 0,
        running: false
    },

    // Overlay look-and-feel configuration
    overlaySettingsBySport,
    overlaySettings: overlaySettingsBySport[SPORT_TYPES.FOOTVOLLEY],

    // Ranking overlay defaults
    rankingSettings: {
        division: 'Male A',
        phase: 'group'
    },

    // Timer defaults (primarily for futsal)
    timer: createDefaultTimerState()
};

/**
 * GOOGLE SHEETS INTEGRATION
 * This connects to Google Sheets to read tournament rankings
 * The referee doesn't need to know how this works - it just updates automatically
 */
const sheets = google.sheets('v4');
let auth = null; // Will store our authentication

// Initialize connection to Google Sheets
async function initializeGoogleSheets() {
    try {
        // Check if credentials file exists
        if (process.env.GOOGLE_CREDENTIALS_PATH && process.env.GOOGLE_SHEET_ID) {
            auth = new google.auth.GoogleAuth({
                keyFile: process.env.GOOGLE_CREDENTIALS_PATH,
                scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
            });
            console.log('✅ Google Sheets API connected successfully');
        } else {
            console.log('⚠️  Google Sheets not configured (optional feature)');
        }
    } catch (error) {
        console.log('⚠️  Google Sheets setup error:', error.message);
        console.log('   Rankings will not be available, but everything else works fine');
    }
}

/**
 * SOCKET.IO CONNECTION HANDLING
 * This manages real-time communication between referee interface and overlay
 * Think of it like a walkie-talkie between the control panel and the display
 */
io.on('connection', (socket) => {
    console.log('🔗 New client connected:', socket.id);
    
    // Send current game state to newly connected client
    socket.emit('gameStateUpdate', gameState);
    socket.emit('overlaySettingsUpdate', gameState.overlaySettings);
    socket.emit('rankingSourceUpdate', getRankingMetaForClient());
    socket.emit('displayOptionsUpdate', gameState.displayOptions);
    socket.emit('timerUpdate', getTimerPayload());
    
    /**
     * SCORE UPDATES
     * When referee clicks +1 or -1 on score, this handles it
     */
    socket.on('updateScore', (data) => {
        console.log(`📊 Score update: Team ${data.team} score = ${data.score}`);
        
        if (data.team === 1) {
            gameState.team1.score = Math.max(0, data.score); // Never go below 0
        } else if (data.team === 2) {
            gameState.team2.score = Math.max(0, data.score);
        }
        
        // Send updated state to all connected clients (overlay, control panels)
        io.emit('gameStateUpdate', gameState);
    });
    
    /**
     * TEAM NAME UPDATES
     * When referee types in team names
     */
    socket.on('updateTeamName', (data) => {
        console.log(`🏷️  Team name update: Team ${data.team} = ${data.name}`);
        
        if (data.team === 1) {
            gameState.team1.name = data.name || 'Team 1';
        } else if (data.team === 2) {
            gameState.team2.name = data.name || 'Team 2';
        }
        
        io.emit('gameStateUpdate', gameState);
    });
    
    /**
     * PLAYER NAME UPDATES
     * For when we want to show individual player names instead of team names
     */
    socket.on('updatePlayerNames', (data) => {
        console.log(`👥 Player names update: Team ${data.team}`);
        
        if (data.team === 1) {
            gameState.team1.players = normalizePlayers(data.players, gameState.sport);
        } else if (data.team === 2) {
            gameState.team2.players = normalizePlayers(data.players, gameState.sport);
        }
        
        io.emit('gameStateUpdate', gameState);
    });
    
    /**
     * TOURNAMENT INFO UPDATES
     * Handle tournament info updates from control panel
     */
    socket.on('updateTournamentInfo', (data = {}) => {
        console.log('🏆 Tournament info update:', data);

        if (typeof data.division === 'string') {
            gameState.tournament.division = data.division;
        }
        if (typeof data.round === 'string') {
            gameState.tournament.round = data.round;
        }
        if (typeof data.location === 'string') {
            gameState.tournament.location = data.location;
        }

        io.emit('tournamentInfoUpdate', gameState.tournament);
        io.emit('gameStateUpdate', gameState);
    });
    
    /**
     * SETS MODE TOGGLE
     * Handle enabling/disabling sets mode
     */
    socket.on('updateSetsMode', (data) => {
        console.log('📊 Sets mode update:', data.enabled);
        
        if (gameState.sport === SPORT_TYPES.FUTSAL) {
            console.log('⚠️  Ignoring sets mode toggle in futsal mode');
            gameState.setsEnabled = false;
            io.emit('gameStateUpdate', gameState);
            return;
        }

        // Update the game state
        gameState.setsEnabled = data.enabled;
        
        // If disabling sets, reset sets-related data but maintain structure
        if (!data.enabled) {
            gameState.team1.setsWon = 0;
            gameState.team2.setsWon = 0;
            gameState.currentSet = 1;
            gameState.setScores = {
                team1: [0, 0, 0, 0, 0],
                team2: [0, 0, 0, 0, 0]
            };
        } else {
            // If enabling sets, ensure proper structure
            if (!gameState.setScores || !gameState.setScores.team1 || !gameState.setScores.team2) {
                gameState.setScores = {
                    team1: [0, 0, 0, 0, 0],
                    team2: [0, 0, 0, 0, 0]
                };
            }
        }
        
        // Broadcast sets mode update to all overlays
        io.emit('setsModeUpdate', data);
        io.emit('gameStateUpdate', gameState);
    });

    socket.on('updateOverlaySettings', (data = {}) => {
        if (typeof data !== 'object' || data === null) {
            return;
        }

        const currentSport = gameState.sport || SPORT_TYPES.FOOTVOLLEY;
        if (!gameState.overlaySettingsBySport[currentSport]) {
            gameState.overlaySettingsBySport[currentSport] = cloneOverlaySettingsForSport(currentSport);
        }

        gameState.overlaySettings = gameState.overlaySettingsBySport[currentSport];
        const settings = gameState.overlaySettings;
        let divisionChanged = false;

        if (data.textScale !== undefined) {
            const textScale = clamp(toNumeric(data.textScale, settings.textScale), 50, 200);
            settings.textScale = textScale;
        }

        if (data.hostLogoScale !== undefined) {
            const value = clamp(toNumeric(data.hostLogoScale, settings.hostLogoScale), 50, 200);
            settings.hostLogoScale = value;
        }

        if (data.sponsorLogoScale !== undefined) {
            const value = clamp(toNumeric(data.sponsorLogoScale, settings.sponsorLogoScale), 50, 200);
            settings.sponsorLogoScale = value;
        }

        if (data.matchInfoScale !== undefined) {
            const value = clamp(toNumeric(data.matchInfoScale, settings.matchInfoScale), 50, 200);
            settings.matchInfoScale = value;
        }

        if (Array.isArray(data.divisionOptions)) {
            const sanitized = data.divisionOptions
                .map((option) => (typeof option === 'string' ? option.trim() : ''))
                .filter(Boolean);
            
            if (sanitized.length) {
                settings.divisionOptions = sanitized;
                if (!sanitized.includes(gameState.tournament.division)) {
                    gameState.tournament.division = sanitized[0];
                    divisionChanged = true;
                }
            } else {
                const defaults = defaultOverlaySettingsBySport[currentSport]?.divisionOptions || [];
                settings.divisionOptions = [...defaults];
                if (defaults.length && !defaults.includes(gameState.tournament.division)) {
                    gameState.tournament.division = defaults[0];
                    divisionChanged = true;
                }
            }
        }

        if (data.colorPalette && typeof data.colorPalette === 'object') {
            Object.entries(data.colorPalette).forEach(([key, value]) => {
                if (!settings.colorPalette[key] || typeof value !== 'object' || value === null) {
                    return;
                }

                const target = settings.colorPalette[key];
                target.c = clamp(toNumeric(value.c, target.c), 0, 100);
                target.m = clamp(toNumeric(value.m, target.m), 0, 100);
                target.y = clamp(toNumeric(value.y, target.y), 0, 100);
                target.k = clamp(toNumeric(value.k, target.k), 0, 100);
            });
        }

        gameState.overlaySettingsBySport[currentSport] = settings;
        io.emit('overlaySettingsUpdate', settings);
        io.emit('gameStateUpdate', gameState);

        if (divisionChanged) {
            io.emit('tournamentInfoUpdate', gameState.tournament);
        }
    });

    socket.on('updateDisplayOptions', (payload = {}, ack) => {
        const callback = typeof ack === 'function' ? ack : () => {};
        const current = gameState.displayOptions || {
            showSponsors: false,
            showMatchDetails: false,
            showHostedBy: false
        };

        const updated = {
            showSponsors: payload.showSponsors !== undefined ? Boolean(payload.showSponsors) : Boolean(current.showSponsors),
            showMatchDetails: payload.showMatchDetails !== undefined ? Boolean(payload.showMatchDetails) : Boolean(current.showMatchDetails),
            showHostedBy: payload.showHostedBy !== undefined ? Boolean(payload.showHostedBy) : Boolean(current.showHostedBy)
        };

        const changed =
            updated.showSponsors !== Boolean(current.showSponsors) ||
            updated.showMatchDetails !== Boolean(current.showMatchDetails) ||
            updated.showHostedBy !== Boolean(current.showHostedBy);

        gameState.displayOptions = updated;

        if (changed) {
            io.emit('displayOptionsUpdate', gameState.displayOptions);
            io.emit('gameStateUpdate', gameState);
        }

        callback({ ok: true, displayOptions: gameState.displayOptions });
    });

    socket.on('updateSport', (payload = {}, ack) => {
        const callback = typeof ack === 'function' ? ack : () => {};
        const requested = typeof payload.sport === 'string' ? payload.sport.toLowerCase() : '';
        const validSports = new Set(Object.values(SPORT_TYPES));

        if (!validSports.has(requested)) {
            return callback({ ok: false, error: 'Unsupported sport selected.' });
        }

        if (requested === gameState.sport) {
            return callback({ ok: true, sport: gameState.sport, overlaySettings: gameState.overlaySettings });
        }

        console.log(`⚙️  Switching sport mode to ${requested}`);
        gameState.sport = requested;

        if (!gameState.overlaySettingsBySport[requested]) {
            gameState.overlaySettingsBySport[requested] = cloneOverlaySettingsForSport(requested);
        }

        gameState.overlaySettings = gameState.overlaySettingsBySport[requested];
        gameState.team1.players = normalizePlayers(gameState.team1.players, requested);
        gameState.team2.players = normalizePlayers(gameState.team2.players, requested);

        if (requested === SPORT_TYPES.FUTSAL) {
            gameState.setsEnabled = false;
            gameState.maxSets = 1;
            gameState.currentSet = 1;
            gameState.setScores = {
                team1: [0],
                team2: [0]
            };
            resetFutsalTimer();
        } else {
            gameState.maxSets = Math.max(gameState.maxSets || 3, 3);
            gameState.setsEnabled = false;
            gameState.currentSet = 1;
            gameState.setScores = {
                team1: [0, 0, 0, 0, 0],
                team2: [0, 0, 0, 0, 0]
            };
            pauseTimer();
            resetFutsalTimer();
        }

        const defaults = gameState.overlaySettings?.divisionOptions || [];
        if (defaults.length) {
            gameState.tournament.division = defaults[0];
        }

        io.emit('overlaySettingsUpdate', gameState.overlaySettings);
        io.emit('displayOptionsUpdate', gameState.displayOptions);
        io.emit('gameStateUpdate', gameState);
        broadcastTimerUpdate();

        callback({ ok: true, sport: gameState.sport, overlaySettings: gameState.overlaySettings });
    });

    socket.on('timerControl', (payload = {}, ack) => {
        const callback = typeof ack === 'function' ? ack : () => {};
        const action = typeof payload.action === 'string' ? payload.action.toLowerCase() : '';

        if (gameState.sport !== SPORT_TYPES.FUTSAL) {
            pauseTimer();
            return callback({ ok: false, error: 'Timer controls are only available in futsal mode.' });
        }

        try {
            switch (action) {
                case 'start':
                    startFutsalTimer();
                    break;
                case 'pause':
                    pauseTimer();
                    break;
                case 'reset':
                    resetFutsalTimer();
                    break;
                case 'set':
                    setTimerManually(payload.minutes, payload.seconds);
                    break;
                default:
                    return callback({ ok: false, error: 'Unsupported timer action.' });
            }
        } catch (error) {
            console.error('❌ Timer control error:', error.message);
            return callback({ ok: false, error: error.message || 'Timer action failed.' });
        }

        callback({ ok: true, timer: getTimerPayload() });
    });

    socket.on('updateRankingSettings', async (payload = {}, ack) => {
        const callback = typeof ack === 'function' ? ack : () => {};

        try {
            if (typeof payload !== 'object' || payload === null) {
                return callback({ ok: false, error: 'Invalid payload received.' });
            }

            const updates = { ...gameState.rankingSettings };

            if (typeof payload.division === 'string' && payload.division.trim()) {
                updates.division = payload.division.trim();
            }

            if (typeof payload.phase === 'string') {
                const normalizedPhase = payload.phase.trim().toLowerCase();
                if (['group', 'elimination', 'auto'].includes(normalizedPhase)) {
                    updates.phase = normalizedPhase;
                }
            }

            const forceRefresh = Boolean(payload.forceRefresh);
            if (forceRefresh) {
                resetRankingCache();
            }

            gameState.rankingSettings = updates;
            io.emit('rankingSettingsUpdate', gameState.rankingSettings);

            const meta = getRankingMetaForClient();
            socket.emit('rankingSourceUpdate', meta);

            if (!meta.hasFile) {
                return callback({
                    ok: false,
                    error: 'No ranking workbook uploaded yet. Please upload the latest spreadsheet.'
                });
            }

            try {
                await getDivisionRanking(gameState.rankingSettings.division, forceRefresh);
            } catch (rankingError) {
                console.warn('⚠️  Unable to preload ranking data:', rankingError.message);
                return callback({ ok: false, error: rankingError.message });
            }

            callback({ ok: true, settings: gameState.rankingSettings, meta });
        } catch (error) {
            console.error('❌ Error updating ranking settings:', error.message);
            callback({ ok: false, error: error.message || 'Failed to update ranking settings.' });
        }
    });
    
    /**
     * REPLAY CONTROLS
     * When referee wants to show "REPLAY" indicator on screen
     */
    socket.on('queueReplay', (data) => {
        console.log('🔄 Replay queued:', data.description);
        
        // Add replay to queue
        gameState.replayQueue.push({
            id: Date.now(),
            description: data.description || 'Replay',
            timestamp: new Date().toLocaleTimeString()
        });
        
        io.emit('gameStateUpdate', gameState);
    });
    
    socket.on('showReplay', (data) => {
        console.log('🔄 Showing replay');
        gameState.showReplay = true;
        io.emit('gameStateUpdate', gameState);
        
        // Auto-hide replay after 5 seconds
        setTimeout(() => {
            gameState.showReplay = false;
            io.emit('gameStateUpdate', gameState);
        }, 5000);
    });
    
    /**
     * RANKINGS DISPLAY - TEMPORARILY DISABLED
     */
    /*
    socket.on('toggleRankings', () => {
        console.log('🚫 Rankings display temporarily disabled');
        // DISABLED FOR TOURNAMENT
        // gameState.showRankings = !gameState.showRankings;
        // io.emit('gameStateUpdate', gameState);
    });
    */
    
    /**
     * SET MANAGEMENT
     * Handle set wins and progression
     */
    socket.on('winSet', (data) => {
        console.log(`🎯 Set ${gameState.currentSet} won by team ${data.team}`);
        
        // Initialize setScores if not exists or if arrays are not properly initialized
        if (!gameState.setScores || !gameState.setScores.team1 || !gameState.setScores.team2) {
            gameState.setScores = {
                team1: [0, 0, 0, 0, 0], // Support up to 5 sets
                team2: [0, 0, 0, 0, 0]
            };
        }
        
        // Ensure arrays are long enough
        const setIndex = gameState.currentSet - 1;
        while (gameState.setScores.team1.length <= setIndex) {
            gameState.setScores.team1.push(0);
            gameState.setScores.team2.push(0);
        }
        
        // Record set score
        gameState.setScores.team1[setIndex] = gameState.team1.score;
        gameState.setScores.team2[setIndex] = gameState.team2.score;
        
        // Update sets won
        if (data.team === 1) {
            gameState.team1.setsWon++;
        } else {
            gameState.team2.setsWon++;
        }
        
        // Reset scores for next set
        gameState.team1.score = 0;
        gameState.team2.score = 0;
        
        // Move to next set if not finished
        if (gameState.currentSet < gameState.maxSets) {
            gameState.currentSet++;
        }
        
        io.emit('gameStateUpdate', gameState);
    });
    
    /**
     * UTILITY FUNCTIONS
     */
    socket.on('resetMatch', () => {
        console.log('🔄 Match reset');
        
        // Reset everything to initial state
        gameState.team1.score = 0;
        gameState.team1.setsWon = 0;
        gameState.team2.score = 0;
        gameState.team2.setsWon = 0;
        gameState.currentSet = 1;
        if (gameState.sport === SPORT_TYPES.FUTSAL) {
            gameState.setScores = {
                team1: [0],
                team2: [0]
            };
            gameState.setsEnabled = false;
            resetFutsalTimer();
        } else {
            gameState.setScores = {
                team1: [0, 0, 0, 0, 0],
                team2: [0, 0, 0, 0, 0]
            };
            gameState.setsEnabled = false;
        }
        gameState.replayQueue = [];
        gameState.showReplay = false;
        gameState.showRankings = false;
        gameState.team1.players = normalizePlayers([], gameState.sport);
        gameState.team2.players = normalizePlayers([], gameState.sport);
        
        io.emit('gameStateUpdate', gameState);
        broadcastTimerUpdate();
    });
    
    socket.on('togglePlayerNames', () => {
        console.log('👥 Toggling player names display');
        gameState.showPlayerNames = !gameState.showPlayerNames;
        io.emit('gameStateUpdate', gameState);
    });
    
    /**
     * SIMPLIFIED REPLAY SYSTEM EVENTS - TEMPORARILY DISABLED
     */
    /*
    socket.on('triggerReplay', () => {
        console.log('🚫 Replay functionality temporarily disabled');
        // Broadcast to all overlays to start replay sequence
        // io.emit('trigger-replay');
    });
    
    socket.on('skipReplay', () => {
        console.log('🚫 Replay functionality temporarily disabled');
        // Broadcast to all overlays to skip replay
        // io.emit('skip-replay');
    });
    */
    
    socket.on('obs-change-scene', (sceneName) => {
        console.log('🎬 OBS Scene change requested:', sceneName);
        // Broadcast to all connected clients
        io.emit('obs-scene-change', sceneName);
    });
    
    // Handle client disconnection
    socket.on('disconnect', () => {
        console.log('❌ Client disconnected:', socket.id);
    });
});

/**
 * API ENDPOINTS
 * These are web addresses that provide data to our interface
 */

// Get current game state (useful for debugging)
app.get('/api/gamestate', (req, res) => {
    res.json(gameState);
});

// Fetch rankings from Google Sheets
app.get('/api/rankings', async (req, res) => {
    try {
        if (!auth) {
            return res.json({ 
                error: 'Google Sheets not configured',
                message: 'Rankings feature requires Google Sheets setup'
            });
        }
        
        console.log('📊 Fetching rankings from Google Sheets...');
        
        const response = await sheets.spreadsheets.values.get({
            auth,
            spreadsheetId: process.env.GOOGLE_SHEET_ID,
            range: 'Rankings!A:D', // Adjust this range based on your sheet structure
        });
        
        const rankings = response.data.values || [];
        console.log(`📊 Retrieved ${rankings.length} ranking entries`);
        
        res.json({ data: rankings });
    } catch (error) {
        console.error('❌ Error fetching rankings:', error.message);
        res.status(500).json({ 
            error: error.message,
            message: 'Failed to fetch rankings from Google Sheets'
        });
    }
});

app.get('/api/ranking-meta', (req, res) => {
    const meta = getRankingMetaForClient();
    res.json(meta);
});

app.post('/api/ranking-upload', (req, res) => {
    rankingUpload.single('rankingWorkbook')(req, res, (error) => {
        if (error) {
            console.error('❌ Ranking upload failed:', error.message);
            const status = error.message.includes('supported') ? 400 : 500;
            return res.status(status).json({
                success: false,
                error: error.message || 'Upload failed'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file received. Please select an Excel workbook.'
            });
        }

        try {
            const uploadedAt = new Date().toISOString();
            updateRankingSource({
                path: req.file.path,
                originalName: req.file.originalname,
                uploadedAt,
                size: req.file.size
            });

            resetRankingCache();

            const meta = getRankingMetaForClient();
            io.emit('rankingSourceUpdate', meta);
            io.emit('rankingSettingsUpdate', gameState.rankingSettings);

            res.json({
                success: true,
                meta
            });
        } catch (uploadError) {
            console.error('❌ Error processing ranking upload:', uploadError.message);
            res.status(500).json({
                success: false,
                error: uploadError.message || 'Failed to process uploaded workbook'
            });
        }
    });
});

app.get('/api/ranking-data', async (req, res) => {
    try {
        const token = typeof req.query.division === 'string' ? req.query.division.trim() : '';
        const division = token || gameState.rankingSettings?.division || 'Male A';
        const forceParam = typeof req.query.force === 'string' ? req.query.force.toLowerCase() : '';
        const forceRefresh = ['1', 'true', 'yes'].includes(forceParam);

        const data = await getDivisionRanking(division, forceRefresh);
        res.json(data);
    } catch (error) {
        console.error('❌ Error loading ranking data:', error.message);

        if (error.message?.includes('No ranking workbook uploaded')) {
            return res.status(404).json({
                error: 'No ranking workbook uploaded yet. Please upload the latest spreadsheet first.'
            });
        }

        if (error.message?.includes('not found')) {
            return res.status(404).json({
                error: error.message
            });
        }

        res.status(500).json({
            error: 'Failed to load ranking data',
            details: error.message
        });
    }
});

// Get list of sponsor logos for rotation
// API endpoint to get sponsor logos
app.get('/api/sponsors', (req, res) => {
    try {
        const sponsorsDir = path.join(__dirname, 'public/sponsors');
        const sponsors = fs.readdirSync(sponsorsDir)
            .filter(file => file.endsWith('.png') || file.endsWith('.jpeg') || file.endsWith('.jpg'))
            .map(file => `/sponsors/${file}`);
        
        console.log('📢 Sponsors found:', sponsors);
        res.json({ sponsors });
    } catch (error) {
        console.error('❌ Error reading sponsors directory:', error);
        res.status(500).json({ 
            error: 'Could not load sponsors',
            sponsors: [
                '/sponsors/PLEX_sponsor.png',
                '/sponsors/23web_sponsor.png',
                '/sponsors/acai_carioca_sponsor.png'
            ]
        });
    }
});

// Serve the main control interface
app.get('/', (req, res) => {
    res.redirect('/control.html');
});

/**
 * SERVER STARTUP
 */
const PORT = process.env.PORT || 3000;

server.listen(PORT, async () => {
    console.log('\n🏐 FOOTVOLLEY LIVESTREAM SYSTEM STARTING...\n');
    console.log(`🖥️  Server running on: http://localhost:${PORT}`);
    console.log(`🎮 Referee Control Panel: http://localhost:${PORT}/control.html`);
    console.log(`📺 Overlay for OBS: http://localhost:${PORT}/overlay.html`);
    console.log('\n📋 SETUP CHECKLIST:');
    console.log('   1. ✅ Server started');
    
    // Initialize Google Sheets
    await initializeGoogleSheets();
    
    console.log('   2. 🔗 Open OBS Studio');
    console.log('   3. 📷 Start GoPro Webcam Utility');
    console.log('   4. 🎯 Add Browser Source in OBS with overlay URL');
    console.log('\n🚀 System ready! Opening control panel...\n');
    
    // Automatically open the control panel in default browser
    try {
        await open(`http://localhost:${PORT}/control.html`);
        console.log('✅ Control panel opened in browser');
    } catch (error) {
        console.log('⚠️  Could not auto-open browser. Please manually open the control panel.');
    }
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down Footvolley Livestream System...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
