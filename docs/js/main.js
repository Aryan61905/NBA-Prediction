import { initPredictions, predictGame, savePrediction, loadPredictions } from './predictions.js';
import { renderAccuracyChart } from './chart.js';

let db;
let currentPage = 1;
const gamesPerPage = 10;

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
        renderAccuracyChart();
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
        
        if (visitorPts !== null) {
            saveActualResult({
                gameId: `game-${rowid}`,
                date,
                visitor,
                home,
                visitorPts,
                homePts
            });
        }
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
    const upcoming = db.exec(`
        SELECT rowid, Date, Visitor, Home 
        FROM Schedule 
        WHERE Home_PTS IS NULL 
        ORDER BY Date ASC 
        LIMIT 1
    `)[0];
    
    if (upcoming && upcoming.values.length) {
        const [rowid, date, visitor, home] = upcoming.values[0];
        const gameId = `game-${rowid}`;
        const predictions = loadPredictions();
        
        let prediction = predictions.predictions.find(p => p.gameId === gameId);
        if (!prediction) {
            prediction = predictGame(db, visitor, home, gameId);
            savePrediction(prediction);
        }
        
        renderPredictionCard(prediction);
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