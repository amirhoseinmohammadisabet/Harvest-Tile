function loadStats() {
    // 1. Check who is logged in
    const storedUser = localStorage.getItem('farmCurrentUser');
    if (!storedUser) {
        window.location.href = 'index.html'; // Kick to login if not signed in
        return;
    }
    
    // 2. Find their specific save file
    const currentUser = JSON.parse(storedUser);
    const saveKey = `tileFarmSave_${currentUser.email}`;
    const savedState = localStorage.getItem(saveKey);
    
    // 3. Load the stats onto the screen
    if (savedState) {
        const parsedState = JSON.parse(savedState);
        if (parsedState.stats) {
            document.getElementById('stat-harvested').innerText = parsedState.stats.totalHarvested || 0;
            document.getElementById('stat-earned').innerText = `$${parsedState.stats.totalEarned || 0}`;
            document.getElementById('stat-spent').innerText = `$${parsedState.stats.totalSpent || 0}`;
        }
    }
}

// Run immediately when the page loads
loadStats();