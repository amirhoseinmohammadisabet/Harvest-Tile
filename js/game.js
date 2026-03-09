// ==========================================
// game.js - Core Logic & Game Loop
// ==========================================

function checkAuth() {
    const storedUser = localStorage.getItem('farmCurrentUser');
    if (!storedUser) {
        window.location.href = 'index.html';
        return false;
    }
    currentUser = JSON.parse(storedUser);
    saveKey = `tileFarmSave_${currentUser.email}`; 
    
    document.getElementById('user-name').innerText = currentUser.name;
    document.getElementById('user-email').innerText = currentUser.email;
    document.getElementById('user-pic').src = currentUser.picture;
    return true;
}

function signOut() {
    localStorage.removeItem('farmCurrentUser');
    window.location.href = 'index.html';
}

async function init() {
    if (!checkAuth()) return; 

    try {
        const resCrops = await fetch('data/crops.json'); 
        const resArtisan = await fetch('data/artisan.json');
        const resMachines = await fetch('data/machines.json');
        const resWeather = await fetch('data/weather.json');
        
        crops = await resCrops.json();
        artisanData = await resArtisan.json();
        machinesData = await resMachines.json();
        weatherData = await resWeather.json();
        
        Object.keys(artisanData).forEach(id => {
            if (state.inventory[id] === undefined) state.inventory[id] = 0;
        });

        generateUI(); 
        loadGame();
        updateMuteButton();
        updateUI();
        updateShedUI();
        renderFarm();
        renderShedFloor();
        updateWeatherUI();
        startGameLoop();
    } catch (error) {
        console.error("Failed to load data:", error);
        showMessage("Error loading game data!");
    }
}

// --- Inputs ---
function getSelectedSeed() {
    const checked = document.querySelector('input[name="seed"]:checked');
    return checked ? checked.value : 'wheat'; 
}

function getSelectedArtisan() {
    const checked = document.querySelector('input[name="artisan-recipe"]:checked');
    return checked ? checked.value : 'beer';
}

// --- Farm Actions ---
function handleLotClick(index) {
    const lot = state.lots[index];
    const now = Date.now();
    if (lot === null) plantCrop(index);
    else if (lot !== null && lot.finishTime <= now) harvestCrop(index);
}

function plantCrop(lotIndex) {
    const seed = getSelectedSeed();
    if (state.inventory[seed] >= 1) {
        state.inventory[seed] -= 1;

        const weatherObj = weatherData.types[state.currentWeather];
        const modifiedGrowTime = crops[seed].growTime / weatherObj.growSpeed;

        state.lots[lotIndex] = { type: seed, finishTime: Date.now() + (modifiedGrowTime * 1000), isReady: false };
        playSound('plant');
        updateUI();
        updateShedUI();
        renderFarm();
    } else {
        showMessage(`You don't have enough ${crops[seed].name} seeds!`);
    }
}

function harvestCrop(lotIndex) {
    const cropType = state.lots[lotIndex].type;
    const weatherObj = weatherData.types[state.currentWeather];
    const totalYield = crops[cropType].yield + weatherObj.yieldBonus;

    state.inventory[cropType] += totalYield;
    state.stats.totalHarvested += totalYield;
    state.lots[lotIndex] = null;
    playSound('harvest');
    updateUI();
    updateShedUI();
    renderFarm();
}

function harvestAll() {
    if (!state.scytheUnlocked) return;
    const now = Date.now();
    let harvestedAnything = false;
    const weatherObj = weatherData.types[state.currentWeather];

    state.lots.forEach((lot, index) => {
        if (lot !== null && lot.finishTime <= now) {
            const totalYield = crops[lot.type].yield + weatherObj.yieldBonus;
            state.inventory[lot.type] += totalYield;
            state.stats.totalHarvested += totalYield;
            state.lots[index] = null; 
            harvestedAnything = true;
        }
    });
    if (harvestedAnything) {
        playSound('harvest');
        showMessage("Harvested all ready crops!");
        updateUI();
        updateShedUI();
        renderFarm();
    }
}

function plantAll() {
    if (!state.planterUnlocked) return;
    const seed = getSelectedSeed();
    let plantedAnything = false;
    const weatherObj = weatherData.types[state.currentWeather];
    const modifiedGrowTime = crops[seed].growTime / weatherObj.growSpeed;

    for (let i = 0; i < state.lots.length; i++) {
        if (state.lots[i] === null && state.inventory[seed] >= 1) {
            state.inventory[seed] -= 1;
            state.lots[i] = { type: seed, finishTime: Date.now() + (modifiedGrowTime * 1000), isReady: false };
            plantedAnything = true;
        }
    }
    if (plantedAnything) {
        playSound('plant');
        showMessage(`Planted as much ${crops[seed].name} as possible!`);
        updateUI();
        updateShedUI();
        renderFarm();
    }
}

function sell(cropType, amount = 1) {
    if (state.inventory[cropType] - amount >= 1) { 
        state.inventory[cropType] -= amount;
        const earned = (crops[cropType].sellPrice * amount);
        state.money += earned;
        state.stats.totalEarned += earned;
        playSound('money');
        updateUI();
        updateShedUI();
    } else {
        showMessage(`You must keep at least 1 ${crops[cropType].name} seed!`);
    }
}

function sellAll(cropType) {
    if (state.inventory[cropType] > 1) {
        const amountToSell = state.inventory[cropType] - 1;
        state.inventory[cropType] -= amountToSell;
        const earned = (crops[cropType].sellPrice * amountToSell);
        state.money += earned;
        state.stats.totalEarned += earned;
        playSound('money');
        updateUI();
        updateShedUI();
    }
}

function buyLot() {
    if (state.money >= state.lotPrice) {
        state.money -= state.lotPrice;
        state.stats.totalSpent += state.lotPrice;
        state.lots.push(null);
        state.lotPrice = Math.floor(state.lotPrice * 1.2);
        playSound('money');
        updateUI();
        updateShedUI();
        renderFarm();
    } else {
        showMessage("Not enough money!");
    }
}

function unlockCrop(cropId) {
    const crop = crops[cropId];
    if (state.money >= crop.unlockPrice && !state.unlockedCrops[cropId]) {
        state.money -= crop.unlockPrice;
        state.stats.totalSpent += crop.unlockPrice;
        state.unlockedCrops[cropId] = true;
        state.inventory[cropId] += 1; 
        playSound('money');
        showMessage(`${crop.name} unlocked! Received 1 starter seed.`);
        updateUI();
        updateShedUI();
    } else if (state.unlockedCrops[cropId]) {
        showMessage(`You already unlocked ${crop.name}!`);
    } else {
        showMessage(`Not enough money! You need $${crop.unlockPrice}.`);
    }
}

function buyScythe() {
    if (state.money >= 500 && !state.scytheUnlocked) {
        state.money -= 500;
        state.stats.totalSpent += 500;
        state.scytheUnlocked = true;
        showMessage("Scythe unlocked!");
        updateUI();
    }
}

function buyPlanter() {
    if (state.money >= 1000 && !state.planterUnlocked) {
        state.money -= 1000;
        state.stats.totalSpent += 1000;
        state.planterUnlocked = true;
        showMessage("Planting Machine unlocked!");
        updateUI();
    }
}

// --- Shed Actions ---
window.unlockShed = function() {
    if (state.money >= 50000) {
        state.money -= 50000;
        state.stats.totalSpent += 50000;
        state.shedUnlocked = true;
        saveGame();
        updateUI();
        updateShedUI();
    } else {
        showMessage("Not enough money! You need $50,000.");
    }
}

window.buyMachine = function(machineId) {
    const mData = machinesData[machineId];
    const currentPrice = state.machinePrices[machineId];

    if (state.money >= currentPrice) {
        state.money -= currentPrice;
        state.stats.totalSpent += currentPrice;
        
        state.machines.push({
            type: machineId,
            isProcessing: false,
            isReady: false,
            finishTime: 0,
            recipe: null
        });

        state.machinePrices[machineId] = Math.floor(currentPrice * 1.2);
        
        state.machines.sort((a, b) => {
            if (a.type === 'keg' && b.type !== 'keg') return -1;
            if (a.type !== 'keg' && b.type === 'keg') return 1;
            return a.type.localeCompare(b.type);
        });
        
        state.activeShedTab = machineId;
        const floor = document.getElementById('shed-floor');
        if (floor) floor.innerHTML = ''; // Force rebuild

        saveGame();
        updateUI();
        updateShedUI();
        renderShedFloor();
    } else {
        showMessage(`Not enough money! You need $${currentPrice}.`);
    }
}

window.loadMachine = function(index) {
    const machine = state.machines[index];
    const recipeId = getSelectedArtisan();
    const recipe = artisanData[recipeId];

    if (machine.type !== recipe.machine) {
        showMessage(`You can't make ${recipe.name} in a ${machinesData[machine.type].name}!`);
        return;
    }

    if (state.inventory[recipe.input] >= recipe.inputAmount) {
        state.inventory[recipe.input] -= recipe.inputAmount;
        machine.recipe = recipeId;
        machine.isProcessing = true;
        machine.finishTime = Date.now() + (recipe.processTime * 1000);
        
        saveGame();
        updateUI(); 
        updateShedUI(); 
        renderShedFloor();
    } else {
        showMessage(`You need ${recipe.inputAmount} ${crops[recipe.input].name} to start this!`);
    }
}

window.collectMachine = function(index) {
    const machine = state.machines[index];
    const recipe = artisanData[machine.recipe];

    state.inventory[recipe.id] += 1;
    
    machine.isProcessing = false;
    machine.isReady = false;
    machine.finishTime = 0;
    machine.recipe = null;

    playSound('harvest');
    saveGame();
    updateUI();
    updateShedUI();
    renderShedFloor();
}

window.loadAllMachines = function() {
    const recipeId = getSelectedArtisan();
    const recipe = artisanData[recipeId];
    let loadedAnything = false;

    state.machines.forEach((machine) => {
        if (!machine.isProcessing && !machine.isReady && machine.type === recipe.machine) {
            if (state.inventory[recipe.input] >= recipe.inputAmount) {
                state.inventory[recipe.input] -= recipe.inputAmount;
                machine.recipe = recipeId;
                machine.isProcessing = true;
                machine.finishTime = Date.now() + (recipe.processTime * 1000);
                loadedAnything = true;
            }
        }
    });

    if (loadedAnything) {
        playSound('plant');
        showMessage(`Started making ${recipe.name}!`);
        saveGame();
        updateUI();
        updateShedUI();
        renderShedFloor();
    } else {
        showMessage(`No empty ${machinesData[recipe.machine].name}s or not enough ${crops[recipe.input].name}!`);
    }
}

window.collectAllMachines = function() {
    let collectedAnything = false;
    state.machines.forEach((machine) => {
        if (machine.isReady) {
            const recipe = artisanData[machine.recipe];
            state.inventory[recipe.id] += 1;
            machine.isProcessing = false;
            machine.isReady = false;
            machine.finishTime = 0;
            machine.recipe = null;
            collectedAnything = true;
        }
    });

    if (collectedAnything) {
        playSound('harvest');
        showMessage("Collected all ready artisan goods!");
        saveGame();
        updateUI();
        updateShedUI();
        renderShedFloor();
    } else {
        showMessage("No machines are ready yet!");
    }
}

window.sellArtisan = function(itemId) {
    if (state.inventory[itemId] >= 1) {
        state.inventory[itemId] -= 1;
        const earned = artisanData[itemId].sellPrice;
        state.money += earned;
        if(state.stats) state.stats.totalEarned += earned;
        
        playSound('money');
        saveGame();
        updateUI(); 
        updateShedUI(); 
    } else {
        showMessage("You don't have any to sell!");
    }
}

window.sellAllArtisan = function(itemId) {
    if (state.inventory[itemId] >= 1) {
        const amountToSell = state.inventory[itemId]; 
        state.inventory[itemId] -= amountToSell;
        
        const earned = artisanData[itemId].sellPrice * amountToSell;
        state.money += earned;
        if(state.stats) state.stats.totalEarned += earned;
        
        playSound('money');
        saveGame();
        updateUI(); 
        updateShedUI(); 
    } else {
        showMessage("You don't have any to sell!");
    }
}

// --- Mailbox & Settings ---
window.receiveMailMoney = function(amount) {
    state.money += amount;
    if (state.stats) state.stats.totalEarned += amount;
    playSound('money');
    updateUI();
    updateShedUI();
    saveGame();
    showMessage(`Claimed $${amount} from the market!`);
};

function toggleMute() {
    state.muted = !state.muted; 
    updateMuteButton();
    saveGame(); 
}

// --- Master Game Loop ---
function startGameLoop() {
    setInterval(() => {
        const now = Date.now();
        
        if (now - state.lastDayTick >= 60000) {
            advanceDay();
        }

        let needsFarmRender = false;
        let needsShedRender = false;
        
        state.lots.forEach(lot => {
            if (lot !== null) {
                const secondsLeft = Math.ceil((lot.finishTime - now) / 1000);
                if (secondsLeft > 0) needsFarmRender = true;
                else if (!lot.isReady) {
                    lot.isReady = true; 
                    needsFarmRender = true; 
                }
            }
        });

        if (state.shedUnlocked && state.machines.length > 0) {
            state.machines.forEach(machine => {
                if (machine.isProcessing && !machine.isReady) {
                    if (now >= machine.finishTime) {
                        machine.isReady = true;
                        needsShedRender = true;
                    } else {
                        needsShedRender = true; 
                    }
                }
            });
        }
        
        saveGame();
        if (needsFarmRender) renderFarm();
        if (needsShedRender) renderShedFloor();
        
    }, 1000);
}

init();