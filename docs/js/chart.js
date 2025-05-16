import { loadPredictions } from './predictions.js';

export function renderAccuracyChart() {
    try {
        const { actualResults, predictions } = loadPredictions();
        const ctx = document.getElementById('accuracy-chart');
        if (!ctx) return;
        
        const chartData = prepareChartData(actualResults, predictions);
        if (chartData.labels.length === 0) {
            ctx.innerHTML = '<p class="text-muted">No prediction accuracy data yet</p>';
            return;
        }
        
        new Chart(ctx.getContext('2d'), getChartConfig(chartData));
    } catch (error) {
        console.error("Chart rendering error:", error);
    }
}

function prepareChartData(actualResults, predictions) {
    const data = actualResults
        .map(result => {
            const prediction = predictions.find(p => p.gameId === result.gameId);
            if (!prediction) return null;
            
            const predictedDiff = prediction.homePts - prediction.visitorPts;
            const actualDiff = result.homePts - result.visitorPts;
            const error = Math.abs(predictedDiff - actualDiff);
            
            return {
                date: result.date,
                predictedDiff,
                actualDiff,
                error,
                accuracy: Math.max(0, 100 - error * 2) // Scale error to 0-100%
            };
        })
        .filter(Boolean);
    
    return {
        labels: data.map(d => new Date(d.date).toLocaleDateString()),
        predicted: data.map(d => d.predictedDiff),
        actual: data.map(d => d.actualDiff),
        accuracy: data.map(d => d.accuracy)
    };
}

function getChartConfig({ labels, predicted, actual, accuracy }) {
    return {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Predicted Margin',
                    data: predicted,
                    borderColor: 'rgba(54, 162, 235, 1)',
                    backgroundColor: 'rgba(54, 162, 235, 0.1)',
                    tension: 0.3,
                    yAxisID: 'y'
                },
                {
                    label: 'Actual Margin',
                    data: actual,
                    borderColor: 'rgba(255, 99, 132, 1)',
                    backgroundColor: 'rgba(255, 99, 132, 0.1)',
                    tension: 0.3,
                    yAxisID: 'y'
                },
                {
                    label: 'Accuracy %',
                    data: accuracy,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.1)',
                    tension: 0.3,
                    yAxisID: 'y1',
                    hidden: true // Optional: hide by default
                }
            ]
        },
        options: {
            responsive: true,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                tooltip: {
                    callbacks: {
                        afterBody: context => {
                            const index = context[0].dataIndex;
                            return `Accuracy: ${accuracy[index].toFixed(1)}%`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: true, text: 'Point Difference' }
                },
                y1: {
                    type: 'linear',
                    display: false,
                    position: 'right',
                    min: 0,
                    max: 100,
                    grid: { drawOnChartArea: false }
                }
            }
        }
    };
}