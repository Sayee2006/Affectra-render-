// --- Chart.js setup ---
const ctx = document.getElementById("stressChart").getContext("2d");
let stressChart = new Chart(ctx, {
    type: "line",
    data: {
        labels: [], // timestamps
        datasets: [{
            label: "Stress %",
            data: [],
            borderColor: "rgba(255, 99, 132, 1)",
            backgroundColor: "rgba(255, 99, 132, 0.2)",
            tension: 0.3,
            fill: true,
            pointRadius: 2
        }]
    },
    options: {
        responsive: true,
        scales: {
            x: { title: { display: true, text: "Time" } },
            y: { title: { display: true, text: "Stress %" }, min: 0, max: 100 }
        }
    }
});


// --- Update chart ---
let timestamp = new Date().toLocaleTimeString();
stressChart.data.labels.push(timestamp);
stressChart.data.datasets[0].data.push(stressPercent);

// Keep only last 50 points
if (stressChart.data.labels.length > 50) {
    stressChart.data.labels.shift();
    stressChart.data.datasets[0].data.shift();
}
stressChart.update();
