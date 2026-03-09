// ==========================================
// data.js - Global State & Storage
// ==========================================

let currentUser = null;
let saveKey = 'tileFarmSave_guest'; 
let messageTimeout;

// Global Data Dictionaries
let crops = {}; 
let artisanData = {};
let machinesData = {};
let weatherData = {};

// Master Game State
let state = {
    money: 0,
    inventory: { wheat: 2 },
    unlockedCrops: { wheat: true }, 
    lots: [null, null, null, null],
    lotPrice: 15,
    scytheUnlocked: false,
    planterUnlocked: false,
    muted: false,
    stats: { totalHarvested: 0, totalEarned: 0, totalSpent: 0 },
    shedUnlocked: false,
    machines: [],
    machinePrices: { keg: 5000, juicer: 15000, grill: 8000 },
    activeShedTab: 'keg',
    day: 1,
    year: 1,
    currentWeather: 'sunny',
    lastDayTick: Date.now()
};

// --- Utilities ---
const sounds = {
    plant: new Audio('assets/audio/plant.mp3'),
    harvest: new Audio('assets/audio/harvest.mp3'),
    money: new Audio('assets/audio/money.mp3')
};

function playSound(name) {
    if (state.muted) return; 
    if (sounds[name]) {
        sounds[name].currentTime = 0;
        sounds[name].play().catch(e => console.log("Audio play failed:", e));
    }
}

function showMessage(msg) {
    const msgBox = document.getElementById('message-box');
    if (!msgBox) return; 
    msgBox.innerText = msg;
    msgBox.style.opacity = 1;
    clearTimeout(messageTimeout);
    messageTimeout = setTimeout(() => msgBox.style.opacity = 0, 3000);
}

function formatTime(totalSeconds) {
    if (totalSeconds <= 0) return "0s";
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

// --- Save & Load System ---
function saveGame() {
    localStorage.setItem(saveKey, JSON.stringify(state));
}

function loadGame() {
    const savedState = localStorage.getItem(saveKey);
    if (savedState) {
        const parsedState = JSON.parse(savedState);
        if (parsedState.activeShedTab) state.activeShedTab = parsedState.activeShedTab;
        if (parsedState.lots) {
            parsedState.lots.forEach(lot => {
                if (lot !== null && lot.timeLeft !== undefined) {
                    lot.finishTime = Date.now() + (lot.timeLeft * 1000);
                    delete lot.timeLeft;
                }
            });
        }
        
        state = { ...state, ...parsedState }; 
        if (parsedState.inventory) state.inventory = { ...state.inventory, ...parsedState.inventory };
        if (parsedState.unlockedCrops) state.unlockedCrops = { ...state.unlockedCrops, ...parsedState.unlockedCrops };
        if (parsedState.stats) state.stats = { ...state.stats, ...parsedState.stats };
        if (parsedState.shedUnlocked !== undefined) state.shedUnlocked = parsedState.shedUnlocked;
        
        if (parsedState.machines) {
            state.machines = parsedState.machines.map(m => {
                if (m.recipe === undefined) {
                    m.recipe = null;
                    if (m.isProcessing || m.isReady) {
                        m.recipe = (m.type === 'keg') ? 'beer' : 'strawberry_juice';
                    }
                }
                return m;
            });
        }

        if (parsedState.machinePrices) {
            state.machinePrices = parsedState.machinePrices;
            if (state.machinePrices.grill === undefined) state.machinePrices.grill = 8000;
        }
        if (!state.machinePrices) state.machinePrices = { keg: 5000, juicer: 15000, grill: 8000 };

        if (parsedState.day !== undefined) state.day = parsedState.day;
        if (parsedState.year !== undefined) state.year = parsedState.year;
        if (parsedState.currentWeather !== undefined) state.currentWeather = parsedState.currentWeather;
        if (parsedState.lastDayTick !== undefined) state.lastDayTick = parsedState.lastDayTick;

        Object.keys(crops).forEach(cropId => {
            if (state.inventory[cropId] === undefined) state.inventory[cropId] = 0;
            if (state.unlockedCrops[cropId] === undefined) state.unlockedCrops[cropId] = (cropId === 'wheat');
            
            const growing = state.lots.filter(lot => lot && lot.type === cropId).length;
            if (state.unlockedCrops[cropId] && state.inventory[cropId] <= 0 && growing === 0) {
                state.inventory[cropId] = 1;
            }
        });
    }
}