let currentUser = null;
let saveKey = 'tileFarmSave_guest'; 
let messageTimeout;

let crops = {}; 
let artisanData = {};
let machinesData = {};
let weatherData = {};
let animalData = {};

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
    machinePrices: {},
    activeShedTab: null,
    barnUnlocked: false,
    animals: [],
    animalPrices: {},
    activeBarnTab: null,
    day: 1,
    year: 1,
    currentWeather: 'sunny',
    lastDayTick: Date.now()
};

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

function saveGame() {
    localStorage.setItem(saveKey, JSON.stringify(state));
}

function loadGame() {
    const savedState = localStorage.getItem(saveKey);
    if (savedState) {
        const parsedState = JSON.parse(savedState);
        
        if (parsedState.lots) {
            parsedState.lots.forEach(lot => {
                if (lot !== null && lot.timeLeft !== undefined) {
                    lot.finishTime = Date.now() + (lot.timeLeft * 1000);
                    delete lot.timeLeft;
                }
            });
        }
        
        state = { ...state, ...parsedState }; 
        
        if (parsedState.inventory) {
            // BUG FIX: Scrub corrupted nulls or NaNs out of broken save files!
            Object.keys(parsedState.inventory).forEach(key => {
                if (parsedState.inventory[key] === null || isNaN(parsedState.inventory[key])) {
                    parsedState.inventory[key] = 0;
                }
            });
            state.inventory = { ...state.inventory, ...parsedState.inventory };
        }

        if (parsedState.unlockedCrops) state.unlockedCrops = { ...state.unlockedCrops, ...parsedState.unlockedCrops };
        if (parsedState.stats) state.stats = { ...state.stats, ...parsedState.stats };
        if (parsedState.shedUnlocked !== undefined) state.shedUnlocked = parsedState.shedUnlocked;
        if (parsedState.barnUnlocked !== undefined) state.barnUnlocked = parsedState.barnUnlocked;
        
        if (parsedState.machines) {
            state.machines = parsedState.machines.map(m => {
                if (m.recipe === undefined) {
                    m.recipe = Object.keys(artisanData).find(id => artisanData[id].machine === m.type) || null;
                }
                return m;
            });
        }
        if (parsedState.animals) state.animals = parsedState.animals;

        if (parsedState.machinePrices) state.machinePrices = parsedState.machinePrices;
        if (parsedState.animalPrices) state.animalPrices = parsedState.animalPrices;
        if (parsedState.activeShedTab) state.activeShedTab = parsedState.activeShedTab;
        if (parsedState.activeBarnTab) state.activeBarnTab = parsedState.activeBarnTab;
        if (parsedState.day !== undefined) state.day = parsedState.day;
        if (parsedState.year !== undefined) state.year = parsedState.year;
        if (parsedState.currentWeather !== undefined) state.currentWeather = parsedState.currentWeather;
        if (parsedState.lastDayTick !== undefined) state.lastDayTick = parsedState.lastDayTick;
    }

    Object.keys(machinesData).forEach(machineId => {
        if (state.machinePrices[machineId] === undefined) state.machinePrices[machineId] = machinesData[machineId].baseCost;
    });
    if (!state.activeShedTab && Object.keys(machinesData).length > 0) {
        state.activeShedTab = Object.keys(machinesData)[0];
    }

    Object.keys(animalData).forEach(id => {
        if (state.animalPrices[id] === undefined) state.animalPrices[id] = animalData[id].baseCost;
    });
    if (!state.activeBarnTab && Object.keys(animalData).length > 0) {
        state.activeBarnTab = Object.keys(animalData)[0];
    }

    // BUG FIX: Ensure all artisan/animal goods have at least a 0 so they don't break addition!
    Object.keys(artisanData).forEach(id => {
        if (state.inventory[id] === undefined) state.inventory[id] = 0;
    });

    Object.keys(crops).forEach(cropId => {
        if (state.inventory[cropId] === undefined) state.inventory[cropId] = 0;
        if (state.unlockedCrops[cropId] === undefined) state.unlockedCrops[cropId] = (cropId === 'wheat');
        
        const growing = state.lots.filter(lot => lot && lot.type === cropId).length;
        if (state.unlockedCrops[cropId] && state.inventory[cropId] <= 0 && growing === 0) {
            state.inventory[cropId] = 1;
        }
    });
}