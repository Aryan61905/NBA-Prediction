import { initPredictions, predictGame, savePrediction, loadPredictions } from './predictions.js';


let db;
let currentPage = 1;
const gamesPerPage = 10;
let currentPlayerPage = 1;
const playersPerPage = 25;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const SQL = await initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
        });
        
        // Try multiple possible paths
        const dbPaths = [
            'assets/c_nba_2025.db.gz',
            '/NBA-Prediction/assets/c_nba_2025.db.gz',
            './assets/c_nba_2025.db.gz'
        ];
        
        let response;
        for (const path of dbPaths) {
            try {
                response = await fetch(path);
                if (response.ok) break;
            } catch (e) {
                console.log(`Failed to load from ${path}`);
            }
        }
        
        if (!response || !response.ok) {
            throw new Error(`Database not found at any path. Tried: ${dbPaths.join(', ')}`);
        }
        
        const buffer = await response.arrayBuffer();
        db = new SQL.Database(pako.inflate(new Uint8Array(buffer)));
        
        initPredictions();
        renderSchedule();
        renderUpcomingPrediction();
        
        // Set the schedule tab as active by default
        openTab('schedule');
        
    } catch (error) {
        console.error("Initialization error:", error);
        document.getElementById('schedule-table').innerHTML = `
            <pre style="color:#f00;">
ERROR LOADING DATA
=================
${error.message}

Troubleshooting:
1. Verify nba_2025.db.gz exists in /docs/assets/
2. Check file size < 100MB
3. Wait 5 mins after pushing changes
            </pre>
        `;
    }
});

function renderSchedule() {
    const totalGames = db.exec("SELECT COUNT(*) FROM Schedule")[0].values[0][0];
    const totalPages = Math.ceil(totalGames / gamesPerPage);
    
    const offset = (currentPage - 1) * gamesPerPage;
    const games = db.exec(`
        SELECT rowid, Date, Visitor, Visitor_PTS, Home, Home_PTS, BoxScore 
        FROM Schedule 
        ORDER BY Date DESC 
        LIMIT ${gamesPerPage} OFFSET ${offset}
    `)[0];
    
    renderGamesTable(games);
    renderPagination(totalPages);
}

function renderGamesTable(data) {
    const container = document.getElementById('schedule-table');
    container.innerHTML = '';
    
    // ASCII Table Header
    const header = document.createElement('pre');
    header.innerHTML = `
.================================================================.
| DATE       | MATCHUP                  | SCORE     | STATUS     |
|------------|--------------------------|-----------|------------|`;
    container.appendChild(header);
    
    // Table Rows
    data.values.forEach(game => {
        const [rowid, date, visitor, visitorPts, home, homePts, boxscore] = game;
        const gameDate = new Date(date).toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
        const matchup = `${visitor} @ ${home}`.substring(0, 22);
        const score = visitorPts !== null ? `${visitorPts}-${homePts}` : 'TBD';
        const status = visitorPts !== null ? 'COMPLETED' : 'UPCOMING';
        
        const row = document.createElement('pre');
        row.innerHTML = `| ${gameDate.padEnd(10)} | ${matchup.padEnd(24)} | ${score.padStart(9)} | ${status.padEnd(10)} |`;
        container.appendChild(row);
    });
    
    // Table Footer
    const footer = document.createElement('pre');
    footer.innerHTML = `'================================================================'`;
    container.appendChild(footer);
}

function renderPagination(totalPages) {
    const container = document.querySelector('.pagination-controls');
    container.innerHTML = `
        <div class="pagination-slider">
            <button class="slider-arrow prev" onclick="changePage(${Math.max(1, currentPage-1)})">
                ← PREV
            </button>
            <div class="slider-pages"></div>
            <button class="slider-arrow next" onclick="changePage(${Math.min(totalPages, currentPage+1)})">
                NEXT →
            </button>
        </div>
    `;

    const pagesContainer = container.querySelector('.slider-pages');
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages/2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `slider-page ${i === currentPage ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.onclick = () => changePage(i);
        pagesContainer.appendChild(pageBtn);
    }
}

function renderUpcomingPrediction() {
    try {
        // Get the next upcoming game that hasn't been played yet
        const upcoming = db.exec(`
            SELECT rowid, Date, Visitor, Home 
            FROM Schedule 
            WHERE Home_PTS IS NULL 
            ORDER BY Date ASC 
            LIMIT 1
        `)[0];
        
        if (!upcoming || !upcoming.values.length) {
            document.getElementById('prediction-card').innerHTML = `
                <pre style="color:#ff0;">
NO UPCOMING GAMES
================
All scheduled games have been completed.
Check back later for new games!
                </pre>
            `;
            return;
        }

        const [rowid, date, visitor, home] = upcoming.values[0];
        const gameId = `game-${rowid}`;
        const predictions = loadPredictions();
        
        // Only predict if we don't already have a prediction
        let prediction = predictions.predictions.find(p => p.gameId === gameId);
        if (!prediction) {
            prediction = predictGame(db, visitor, home, gameId);
            savePrediction(prediction);
        }
        
        renderPredictionCard(prediction);
    } catch (error) {
        console.error("Error rendering upcoming prediction:", error);
        document.getElementById('prediction-card').innerHTML = `
            <pre style="color:#f00;">
PREDICTION ERROR
===============
${error.message}

Try refreshing the page.
            </pre>
        `;
    }
}

function renderPredictionCard(prediction) {
    const winner = prediction.visitorPts > prediction.homePts ? 
                  prediction.visitorTeam : prediction.homeTeam;
    
    const cardHTML = `
<pre style="color:#0f0;">
.--------------------------------.
|        NEXT GAME PREDICTION    |
|--------------------------------|
| ${prediction.visitorTeam.padEnd(15)} vs ${prediction.homeTeam.padEnd(15)} |
|                                |
|        ${prediction.visitorPts.toString().padStart(3)} - ${prediction.homePts.toString().padEnd(3)}        |
|                                |
| CONFIDENCE: [${'='.repeat(prediction.confidence/5)}${' '.repeat(20-prediction.confidence/5)}] ${prediction.confidence}% |
|                                |
| PREDICTED: ${new Date(prediction.predictedOn).toLocaleDateString()} |
'--------------------------------'
</pre>`;
    
    document.getElementById('prediction-card').innerHTML = cardHTML;
}

function saveActualResult(result) {
    const data = loadPredictions();
    const existingIndex = data.actualResults.findIndex(r => r.gameId === result.gameId);
    
    if (existingIndex >= 0) {
        data.actualResults[existingIndex] = result;
    } else {
        data.actualResults.push(result);
    }
    
    data.lastUpdated = new Date().toISOString();
    localStorage.setItem('nbaPredictions', JSON.stringify(data));
}

// Make functions available globally
window.changePage = (page) => {
    currentPage = page;
    renderSchedule();
    window.scrollTo({
        top: document.getElementById('schedule-table').offsetTop - 20,
        behavior: 'smooth'
    });
};

window.openTab = (tabName) => {
    // Hide all tab content
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
    });
    
    // Remove active class from all buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    
    // Show the selected tab and mark button as active
    document.getElementById(tabName).style.display = 'block';
    document.querySelector(`.tab-button[onclick="openTab('${tabName}')"]`).classList.add('active');
    
    // Load data if needed
    if (tabName === 'players') {
        if (!window.playersLoaded) {
            window.playersLoaded = true;
        }
        currentPlayerPage = 1;
        renderPlayersTable();
    }
    if (tabName === 'teams' && !window.teamsLoaded) {
        renderTeamsTable();
        window.teamsLoaded = true;
    }
};

function renderPlayersTable() {
    try {
        // Get total players count (excluding those with MP <= 10)
        const countResult = db.exec("SELECT COUNT(*) FROM Player WHERE MP > 10");
        const totalPlayers = countResult[0]?.values[0]?.[0] || 0;
        
        if (totalPlayers === 0) {
            document.getElementById('players-table').innerHTML = `
                <pre style="color:#ff0;">
NO PLAYER DATA AVAILABLE
========================
No players found with minimum playing time (MP > 10)
                </pre>
            `;
            document.querySelector('.players-pagination').innerHTML = '';
            return;
        }

        const totalPages = 40;
        const offset = (currentPlayerPage - 1) * playersPerPage;
        
        // Get paginated player data
        const playersResult = db.exec(`
            SELECT 
                Player, 
                Tm, 
                ROUND(PTS, 1) as PTS, 
                ROUND(TRB, 1) as TRB, 
                ROUND(AST, 1) as AST, 
                ROUND(FG_percent, 1) as FG_percent, 
                ROUND(ThreeP_percent, 1) as ThreeP_percent, 
                ROUND(MP, 1) as MP
            FROM Player 
            ORDER BY PTS DESC 
            LIMIT ${playersPerPage} OFFSET ${offset}
        `);
        
        const players = playersResult[0];
        const container = document.getElementById('players-table');
        container.innerHTML = '';
        
        // ASCII Table Header with improved formatting
        const header = document.createElement('pre');
        header.innerHTML = `
.========================================================================================.
| #  | PLAYER               | TEAM | PTS  | REB  | AST  | FG%  | 3P%  | MP    |        |
|----|----------------------|------|------|------|------|------|------|-------|--------|`;
        container.appendChild(header);
        
        // Table Rows with ranking and null checks
        players.values.forEach((player, index) => {
            const rank = offset + index + 1;
            const [name, team, pts, reb, ast, fg, three, mp] = player.map(value => 
                value === null ? (typeof value === 'string' ? '' : 0) : value
            );
            
            const row = document.createElement('pre');
            row.innerHTML = 
                `| ${String(rank).padStart(2)} | ${String(name || 'N/A').padEnd(20)} | ` +
                `${String(team || 'N/A').padEnd(4)} | ${String(pts || 0).padStart(4)} | ` +
                `${String(reb || 0).padStart(4)} | ${String(ast || 0).padStart(4)} | ` +
                `${String(fg || 0).padStart(4)} | ${String(three || 0).padStart(4)} | ` +
                `${String(mp || 0).padStart(5)} |`;
            container.appendChild(row);
        });
        
        // Table Footer with page info
        const footer = document.createElement('pre');
        footer.innerHTML = `'========================================================================================'`;
        container.appendChild(footer);
        
        // Page info display
        const pageInfo = document.createElement('div');
        pageInfo.className = 'page-info';
        
        container.appendChild(pageInfo);
        
        renderPlayerPagination(totalPages);
    } catch (error) {
        console.error("Error rendering players:", error);
        document.getElementById('players-table').innerHTML = `
            <pre style="color:#f00;">
ERROR LOADING PLAYER DATA
========================
${error.message}

Troubleshooting:
1. Verify database connection
2. Check player data exists
3. Try refreshing the page
            </pre>
        `;
        document.querySelector('.players-pagination').innerHTML = '';
    }
}

// Add this new function for player pagination
function renderPlayerPagination(totalPages) {
    const container = document.querySelector('.players-pagination');
    if (!container) return;
    
    container.innerHTML = `
        <div class="pagination-slider">
            
            <button class="slider-arrow prev" onclick="changePlayerPage(${currentPlayerPage - 1})" 
                ${currentPlayerPage === 1 ? 'disabled' : ''}>
                ← Prev
            </button>
            
            <div class="page-display">
                Page ${currentPlayerPage} of ${totalPages}
            </div>
            
            <button class="slider-arrow next" onclick="changePlayerPage(${currentPlayerPage + 1})" 
                ${currentPlayerPage === totalPages ? 'disabled' : ''}>
                Next →
            </button>
            
        </div>
        
        <div class="page-jump">
            <span>Go to:</span>
            <input type="number" min="1" max="${totalPages}" value="${currentPlayerPage}" 
                onchange="changePlayerPage(this.value)">
        </div>
    `;
}

// Add this global function
window.changePlayerPage = (page) => {
    currentPlayerPage = page;
    renderPlayersTable();
    window.scrollTo({
        top: document.getElementById('players-table').offsetTop - 20,
        behavior: 'smooth'
    });
};

function renderTeamsTable() {
    const teams = db.exec(`
        SELECT 
            Tm,
            ROUND(AVG(PTS), 1) as PPG,
            ROUND(AVG(ORB + DRB), 1) as RPG,
            ROUND(AVG(AST), 1) as APG,
            ROUND(AVG(FG_percent), 1) as FG_PCT,
            COUNT(*) as Players
        FROM Player
        GROUP BY Tm
        ORDER BY PPG DESC
    `)[0];
    
    const container = document.getElementById('teams-table');
    container.innerHTML = '';
    
    // ASCII Table Header
    const header = document.createElement('pre');
    header.innerHTML = `
.=============================================.
| TEAM | PPG  | RPG  | APG  | FG%   | PLAYERS |
|------|------|------|------|-------|---------|`;
    container.appendChild(header);
    
    // Table Rows
    teams.values.forEach(team => {
        const [name, ppg, rpg, apg, fg, players] = team;
        const row = document.createElement('pre');
        row.innerHTML = `| ${name.padEnd(4)} | ${ppg.toString().padStart(4)} | ${rpg.toString().padStart(4)} | ${apg.toString().padStart(4)} | ${fg.toString().padStart(5)} | ${players.toString().padStart(7)} |`;
        container.appendChild(row);
    });
    
    // Table Footer
    const footer = document.createElement('pre');
    footer.innerHTML = `'========================================================'`;
    container.appendChild(footer);
}

function getActualResult(gameId) {
    try {
        if (!gameId || typeof gameId !== 'string') {
            console.error('Invalid gameId:', gameId);
            return null;
        }

        const parts = gameId.split('-');
        if (parts.length < 2) {
            console.error('Malformed gameId:', gameId);
            return null;
        }

        const rowid = parts[1];
        if (!rowid || isNaN(rowid)) {
            console.error('Invalid rowid from gameId:', gameId);
            return null;
        }

        const result = db.exec(`
            SELECT Visitor_PTS, Home_PTS 
            FROM Schedule 
            WHERE rowid = ${rowid}
        `)[0];
        
        if (result && result.values.length && result.values[0][0] !== null) {
            return `${result.values[0][0]}-${result.values[0][1]}`;
        }
        return null;
    } catch (error) {
        console.error('Error getting actual result:', error);
        return null;
    }
}

// Add these helper functions
function getTableNames() {
    try {
        const tables = db.exec(`
            SELECT name FROM sqlite_master 
            WHERE type='table' 
            AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        `);
        return tables[0].values.map(row => row[0]);
    } catch (e) {
        return [];
    }
}

function getColumnNames(table) {
    try {
        const info = db.exec(`PRAGMA table_info(${table})`);
        return info[0].values.map(row => row[1]);
    } catch (e) {
        return [];
    }
}

function parseCommand(command) {
    const result = {
        table: null,
        columns: [],
        filter: null,
        error: null
    };

    // Basic format validation
    if (!command.startsWith('-t')) {
        result.error = "Command must start with -t <Table>";
        return result;
    }

    // Parse table
    const tableMatch = command.match(/-t\s+(\w+)/);
    if (!tableMatch) {
        result.error = "Missing table name after -t";
        return result;
    }
    result.table = tableMatch[1];

    // Parse columns
    const columnsMatch = command.match(/-c\s+([^-]+)/);
    if (columnsMatch) {
        result.columns = columnsMatch[1].trim().split(/\s+/).filter(Boolean);
    } else {
        result.error = "Missing columns after -c";
        return result;
    }

    // Parse filter (optional)
    const filterMatch = command.match(/-f\s+([^-]+)/);
    if (filterMatch) {
        result.filter = filterMatch[1].trim();
    }

    return result;
}

function buildSQLQuery(parsed) {
    // Validate table exists
    const tables = getTableNames();
    if (!tables.includes(parsed.table)) {
        throw new Error(`Invalid table. Available tables:\n${tables.join('\n')}`);
    }

    // Validate columns exist
    const columns = getColumnNames(parsed.table);
    const invalidColumns = parsed.columns.filter(col => !columns.includes(col));
    if (invalidColumns.length > 0) {
        throw new Error(`Invalid columns for table ${parsed.table}. Available columns:\n${columns.join('\n')}`);
    }

    // Build SELECT part
    let sql = `SELECT ${parsed.columns.join(', ')} FROM ${parsed.table}`;

    // Add WHERE clause if filter exists
    if (parsed.filter) {
        // Replace logical operators with SQL equivalents
        let whereClause = parsed.filter
            .replace(/\|/g, ' OR ')
            .replace(/&/g, ' AND ');

        sql += ` WHERE ${whereClause}`;
    }

    return sql;
}

// Add this to your global functions
window.executeCommand = function() {
    const commandInput = document.getElementById('command-input');
    const resultDiv = document.getElementById('command-result');
    resultDiv.innerHTML = '';
    resultDiv.className = '';

    try {
        const command = commandInput.value.trim();
        if (!command) return;

        // Parse the command
        const parsed = parseCommand(command);
        if (parsed.error) {
            throw new Error(parsed.error);
        }

        // Build and execute SQL
        const sql = buildSQLQuery(parsed);
        const results = db.exec(sql);

        if (!results.length) {
            resultDiv.innerHTML = '<pre>No results found</pre>';
            return;
        }

        // Display results in ASCII table
        const columns = results[0].columns;
        const values = results[0].values;

        // Build ASCII table
        let tableHTML = '<pre>';
        
        // Header
        tableHTML += '.' + '='.repeat(columns.length * 12) + '.\n';
        tableHTML += '| ' + columns.map(col => String(col).padEnd(10)).join(' | ') + ' |\n';
        tableHTML += '|' + columns.map(() => '-----------').join('|') + '|\n';
        
        // Rows
        values.forEach(row => {
            tableHTML += '| ' + row.map(val => String(val).padEnd(10)).join(' | ') + ' |\n';
        });
        
        // Footer
        tableHTML += "'" + '='.repeat(columns.length * 12) + "'";
        tableHTML += '</pre>';

        resultDiv.innerHTML = tableHTML;
        
    } catch (error) {
        resultDiv.className = 'error';
        resultDiv.innerHTML = `<pre>ERROR: ${error.message}</pre>`;
    }
};

// Add event listener for Enter key
document.getElementById('command-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        executeCommand();
    }
});
