const STORAGE_KEY = 'nbaPredictions';

export function initPredictions() {
    if (!localStorage.getItem(STORAGE_KEY)) {
        resetPredictions();
    }
}

export function resetPredictions() {
    const initialData = {
        version: 1,
        predictions: [],
        lastUpdated: new Date().toISOString(),
        metadata: {
            description: "NBA Game Predictions",
            algorithmVersion: "1.2"
        }
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
}

export function savePrediction(prediction) {
    const data = loadPredictions();
    const existingIndex = data.predictions.findIndex(p => p.gameId === prediction.gameId);
    
    if (existingIndex >= 0) {
        data.predictions[existingIndex] = prediction;
    } else {
        data.predictions.push(prediction);
    }
    
    data.lastUpdated = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadPredictions() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : resetPredictions();
    } catch (e) {
        console.error("Error loading predictions:", e);
        return resetPredictions();
    }
}

export function predictGame(db, visitorTeam, homeTeam, gameId) {
    try {
        // First verify the game hasn't been played yet
        const rowid = gameId.split('-')[1];
        const gameStatus = db.exec(`
            SELECT Home_PTS FROM Schedule WHERE rowid = ${rowid}
        `)[0];
        
        if (gameStatus.values[0][0] !== null) {
            throw new Error('Cannot predict already completed game');
        }

        const visitorStats = getTeamMetrics(db, visitorTeam);
        const homeStats = getTeamMetrics(db, homeTeam);
        
        const homeAdvantage = 3.5;
        const visitorPts = Math.round(
            (visitorStats.offensiveRating * 0.6 + homeStats.defensiveRating * 0.4)
        );
        const homePts = Math.round(
            (homeStats.offensiveRating * 0.6 + visitorStats.defensiveRating * 0.4) + homeAdvantage
        );
        
        const ratingDiff = (homeStats.teamRating - visitorStats.teamRating);
        const confidence = Math.min(95, Math.max(50, 65 + ratingDiff));
        
        return {
            gameId,
            visitorTeam,
            homeTeam,
            visitorPts,
            homePts,
            confidence: Math.round(confidence),
            predictedOn: new Date().toISOString(),
            gameDate: new Date().toISOString() // Store when prediction was made
        };
    } catch (error) {
        console.error("Prediction failed:", error);
        throw error;
    }
}

function getTeamMetrics(db, team) {
    const result = db.exec(`
        SELECT 
            AVG(CASE WHEN Visitor = '${team}' THEN Visitor_PTS ELSE Home_PTS END) as offensiveRating,
            AVG(CASE WHEN Visitor = '${team}' THEN Home_PTS ELSE Visitor_PTS END) as defensiveRating,
            COUNT(*) as gamesPlayed,
            SUM(CASE WHEN (Visitor = '${team}' AND Visitor_PTS > Home_PTS) OR 
                      (Home = '${team}' AND Home_PTS > Visitor_PTS) THEN 1 ELSE 0 END) as wins
        FROM Schedule
        WHERE (Visitor = '${team}' OR Home = '${team}')
        AND Home_PTS IS NOT NULL
        ORDER BY Date DESC
        LIMIT 10
    `);
    
    const stats = result[0].values[0];
    const winPct = stats[3] / stats[2];
    
    return {
        offensiveRating: stats[0] || 105,
        defensiveRating: stats[1] || 105,
        teamRating: (stats[0] - stats[1]) * winPct,
        games: stats[2] || 1
    };
}