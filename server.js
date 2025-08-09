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
require('dotenv').config();

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
let gameState = {
    // Team information
    team1: { 
        name: 'Team 1', 
        score: 0,
        setsWon: 0,
        // Player names for more detailed display
        players: ['Player 1A', 'Player 1B']
    },
    team2: { 
        name: 'Team 2', 
        score: 0,
        setsWon: 0,
        players: ['Player 2A', 'Player 2B']
    },
    
    // Match information
    currentSet: 1,
    maxSets: 3, // Best of 3 sets typical for footvolley
    setScores: {
        team1: [0, 0, 0], // Scores for each set
        team2: [0, 0, 0]
    },
    
    // Tournament information
    tournament: {
        name: 'San Diego Footvolley Open 2025',
        division: 'Open Division', // Open Division, Womens Division, Beginners Division
        round: 'Quarter Finals',
        matchNumber: 1,
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
    }
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
            gameState.team1.players = data.players || ['Player 1A', 'Player 1B'];
        } else if (data.team === 2) {
            gameState.team2.players = data.players || ['Player 2A', 'Player 2B'];
        }
        
        io.emit('gameStateUpdate', gameState);
    });
    
    /**
     * TOURNAMENT INFO UPDATES
     * Handle tournament info updates from control panel
     */
    socket.on('updateTournamentInfo', (data) => {
        console.log('🏆 Tournament info update:', data);
        
        // Update the game state with tournament info
        gameState.tournament = {
            division: data.division,
            location: data.location,
            round: data.round,
            matchNumber: data.matchNumber
        };
        
        // Broadcast tournament info update to all overlays
        io.emit('tournamentInfoUpdate', data);
    });
    
    /**
     * SETS MODE TOGGLE
     * Handle enabling/disabling sets mode
     */
    socket.on('updateSetsMode', (data) => {
        console.log('📊 Sets mode update:', data.enabled);
        
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
     * RANKINGS DISPLAY
     * Show tournament rankings table temporarily
     */
    socket.on('toggleRankings', () => {
        console.log('🏆 Toggling rankings display');
        gameState.showRankings = !gameState.showRankings;
        io.emit('gameStateUpdate', gameState);
        
        // Auto-hide rankings after 10 seconds if showing
        if (gameState.showRankings) {
            setTimeout(() => {
                gameState.showRankings = false;
                io.emit('gameStateUpdate', gameState);
            }, 10000);
        }
    });
    
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
     * TOURNAMENT INFO UPDATES
     */
    socket.on('updateTournamentInfo', (data) => {
        console.log('🏆 Tournament info update:', data);
        
        if (data.division) {
            gameState.tournament.division = data.division;
        }
        if (data.round) {
            gameState.tournament.round = data.round;
        }
        if (data.matchNumber) {
            gameState.tournament.matchNumber = data.matchNumber;
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
        gameState.setScores = {
            team1: [0, 0, 0],
            team2: [0, 0, 0]
        };
        gameState.replayQueue = [];
        gameState.showReplay = false;
        gameState.showRankings = false;
        
        io.emit('gameStateUpdate', gameState);
    });
    
    socket.on('togglePlayerNames', () => {
        console.log('👥 Toggling player names display');
        gameState.showPlayerNames = !gameState.showPlayerNames;
        io.emit('gameStateUpdate', gameState);
    });
    
    /**
     * SIMPLIFIED REPLAY SYSTEM EVENTS
     */
    socket.on('triggerReplay', () => {
        console.log('🎬 Simple replay triggered');
        // Broadcast to all overlays to start replay sequence
        io.emit('trigger-replay');
    });
    
    socket.on('skipReplay', () => {
        console.log('⏭️ Skip replay triggered');
        // Broadcast to all overlays to skip replay
        io.emit('skip-replay');
    });
    
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
