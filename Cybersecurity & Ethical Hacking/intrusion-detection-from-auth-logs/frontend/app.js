async function loadAlerts() {
    // 1. Fetch alerts from the API
    const res = await fetch("http://127.0.0.1:5000/api/alerts");
    const alerts = await res.json();

    const table = document.querySelector("#alertsTable tbody");
    table.innerHTML = "";

    // 2. Map the data structure: timestamp, ip, and the 'rule' or 'details' field
    alerts.forEach(alert => {
        const row = `
            <tr>
                <td>${alert.timestamp}</td>
                <td>${alert.ip}</td>
                <td>${alert.rule || alert.details || "Detected Alert"}</td>
            </tr>
        `;
        table.innerHTML += row;
    });
}

async function loadLogs() {
    // 1. Fetch ALL parsed logs from the API
    const res = await fetch("http://127.0.0.1:5000/api/logs");
    const logs = await res.json();

    const table = document.querySelector("#logsTable tbody");
    table.innerHTML = "";

    // 2. Map all logs: timestamp and ip
    logs.forEach(log => {
        const row = `
            <tr>
                <td>${log.timestamp}</td>
                <td>${log.ip}</td>
            </tr>
        `;
        table.innerHTML += row;
    });
}

// Execute functions on page load
loadAlerts();
loadLogs();