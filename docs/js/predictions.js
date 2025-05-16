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
        actualResults: [],
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
    const visitorStats = getTeamMetrics(db, visitorTeam);
    const homeStats = getTeamMetrics(db, homeTeam);
    
    // Enhanced prediction algorithm
    const homeAdvantage = 3.5;
    const visitorPts = Math.round(
        (visitorStats.offensiveRating * 0.6 + homeStats.defensiveRating * 0.4)
    );
    const homePts = Math.round(
        (homeStats.offensiveRating * 0.6 + visitorStats.defensiveRating * 0.4) + homeAdvantage
    );
    
    // Confidence calculation (50-95%)
    const ratingDiff = (homeStats.teamRating - visitorStats.teamRating);
    const confidence = Math.min(95, Math.max(50, 65 + ratingDiff));
    
    return {
        gameId,
        visitorTeam,
        homeTeam,
        visitorPts,
        homePts,
        confidence: Math.round(confidence),
        predictedOn: new Date().toISOString()
    };
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