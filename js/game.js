// --- Authentication & User Setup ---
let currentUser = null;
let saveKey = 'tileFarmSave_guest'; 

// DYNAMIC STATE
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
    machines: []
};

let crops = {}; 
let artisanData = {};
let machinesData = {};
let messageTimeout;

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

// --- Save & Load System ---
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
        if (parsedState.inventory) state.inventory = { ...state.inventory, ...parsedState.inventory };
        if (parsedState.unlockedCrops) state.unlockedCrops = { ...state.unlockedCrops, ...parsedState.unlockedCrops };
        if (parsedState.stats) state.stats = { ...state.stats, ...parsedState.stats };
        
        if (parsedState.shedUnlocked !== undefined) state.shedUnlocked = parsedState.shedUnlocked;
        if (parsedState.machines) state.machines = parsedState.machines;

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

// --- Initialization ---
async function init() {
    if (!checkAuth()) return; 

    try {
        const resCrops = await fetch('data/crops.json'); 
        const resArtisan = await fetch('data/artisan.json');
        const resMachines = await fetch('data/machines.json');
        
        crops = await resCrops.json();
        artisanData = await resArtisan.json();
        machinesData = await resMachines.json();
        
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
        startGameLoop();
    } catch (error) {
        console.error("Failed to load data:", error);
        showMessage("Error loading game data!");
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

// --- Tab Switching ---
function switchTab(tab) {
    const farmView = document.getElementById('farm-view');
    const shedView = document.getElementById('shed-view');
    const tabFarmBtn = document.getElementById('tab-farm');
    const tabShedBtn = document.getElementById('tab-shed');

    if (tab === 'farm') {
        farmView.style.display = 'block';
        shedView.style.display = 'none';
        tabFarmBtn.style.backgroundColor = '#f39c12'; 
        tabShedBtn.style.backgroundColor = '#7f8c8d'; 
        updateUI();
        renderFarm();
    } else if (tab === 'shed') {
        farmView.style.display = 'none';
        shedView.style.display = 'block';
        tabFarmBtn.style.backgroundColor = '#7f8c8d'; 
        tabShedBtn.style.backgroundColor = '#8e44ad'; 
        updateShedUI();
        renderShedFloor();
    }
}

// --- HTML Generator (Builds BOTH Farm and Shed UI dynamically) ---
function generateUI() {
    // 1. FARM ELEMENTS
    const statsContainer = document.getElementById('stats-container');
    const sellContainer = document.getElementById('sell-buttons-container');
    const seedSelector = document.getElementById('seed-selector-container');
    const unlockContainer = document.getElementById('unlock-buttons-container');

    // 2. SHED ELEMENTS
    const shedStatsContainer = document.getElementById('shed-stats-container');
    const shedSellContainer = document.getElementById('shed-sell-buttons-container');
    const shedStoreContainer = document.getElementById('shed-store-container');

    sellContainer.className = 'sell-grid';
    shedSellContainer.className = 'sell-grid';
    seedSelector.className = 'flex-wrap-container';
    unlockContainer.className = 'flex-wrap-container';

    // Reset inner HTML
    statsContainer.innerHTML = `<div>💵 Money: $<span id="money" style="color: #2ecc71; font-weight: bold;">0</span></div>`;
    shedStatsContainer.innerHTML = `<div>💵 Money: $<span id="shed-money" style="color: #2ecc71; font-weight: bold;">0</span></div>`;
    sellContainer.innerHTML = '';
    shedSellContainer.innerHTML = '';
    seedSelector.innerHTML = '';
    unlockContainer.innerHTML = '';
    shedStoreContainer.innerHTML = '';

    // Populate Farm and Raw Material Stats
    Object.keys(crops).forEach((cropId) => {
        const crop = crops[cropId];
        
        // Farm Stats & Selling
        statsContainer.innerHTML += `<div>${crop.icon} ${crop.name}: <span id="${cropId}Count">0</span></div>`;
        sellContainer.innerHTML += `
            <div class="sell-item" id="${cropId}SellDiv">
                <div style="text-align: center; font-weight: bold; margin-bottom: 5px;">${crop.icon} ${crop.name}</div>
                <button id="sell${cropId}Btn" onclick="sell('${cropId}', 1)">Sell 1 ($${crop.sellPrice})</button>
                <button id="sellAll${cropId}Btn" onclick="sellAll('${cropId}')" style="background-color: #e67e22;">Sell All</button>
            </div>
        `;
        
        // Farm Store & Radios
        seedSelector.innerHTML += `
            <label id="${cropId}RadioLabel" style="display:none; cursor: pointer;">
                <input type="radio" name="seed" value="${cropId}"> ${crop.icon} ${crop.name}
            </label>
        `;
        if (crop.unlockPrice > 0) {
            unlockContainer.innerHTML += `
                <button id="buy${cropId}Btn" onclick="unlockCrop('${cropId}')" style="background-color: ${crop.growingColor}; color: #2c3e50;">
                    🔓 Unlock ${crop.name} ($${crop.unlockPrice})
                </button>
            `;
        }

        // Add raw crops to Shed Stats so you know what you can load
        shedStatsContainer.innerHTML += `<div>${crop.icon} ${crop.name}: <span id="shed-${cropId}Count">0</span></div>`;
    });

    // Populate Shed Artisan Stats & Selling
    Object.keys(artisanData).forEach(id => {
        const item = artisanData[id];
        shedStatsContainer.innerHTML += `<div>${item.icon} ${item.name}: <span id="shed-${id}Count">0</span></div>`;
        
        shedSellContainer.innerHTML += `
            <div class="sell-item" id="${id}SellDiv">
                <div style="text-align: center; font-weight: bold; margin-bottom: 5px;">${item.icon} ${item.name}</div>
                <button id="sell${id}Btn" onclick="sellArtisan('${id}')">Sell 1 ($${item.sellPrice})</button>
                <button id="sellAll${id}Btn" onclick="sellAllArtisan('${id}')" style="background-color: #e67e22;">Sell All</button>
            </div>
        `;
    });

    // Populate Shed Store
    Object.keys(machinesData).forEach(id => {
        const m = machinesData[id];
        shedStoreContainer.innerHTML += `
            <button onclick="buyMachine('${id}')" style="background-color: #9b59b6; color: white;">
                Buy ${m.icon} ${m.name} ($${m.cost})
            </button>
        `;
    });

    // Default farm radio
    const wheatRadio = document.querySelector('input[value="wheat"]');
    if (wheatRadio) wheatRadio.checked = true;
}

// --- State Updaters ---
function updateUI() {
    const moneyDisplay = document.getElementById('money');
    if(moneyDisplay) moneyDisplay.innerText = state.money;
    
    const buyLotBtn = document.querySelector('button[onclick="buyLot()"]');
    if (buyLotBtn) buyLotBtn.innerText = `Buy Empty Lot ($${state.lotPrice})`;

    Object.keys(crops).forEach(cropId => {
        const countSpan = document.getElementById(`${cropId}Count`);
        if (countSpan) countSpan.innerText = state.inventory[cropId] || 0;

        const radioLabel = document.getElementById(`${cropId}RadioLabel`);
        const unlockBtn = document.getElementById(`buy${cropId}Btn`);
        
        if (state.unlockedCrops[cropId]) {
            if (radioLabel) radioLabel.style.display = 'inline';
            if (unlockBtn) unlockBtn.style.display = 'none';
        } else {
            if (radioLabel) radioLabel.style.display = 'none';
            if (unlockBtn) unlockBtn.style.display = 'inline-block';
        }

        const isLow = (state.inventory[cropId] <= 1);
        const sellBtn = document.getElementById(`sell${cropId}Btn`);
        const sellAllBtn = document.getElementById(`sellAll${cropId}Btn`);
        
        if (state.unlockedCrops[cropId]) {
            if (sellBtn) sellBtn.disabled = isLow;
            if (sellAllBtn) sellAllBtn.disabled = isLow;
        } else {
            if (sellBtn) sellBtn.disabled = true;
            if (sellAllBtn) sellAllBtn.disabled = true;
        }
    });

    if (state.scytheUnlocked) {
        document.getElementById('buyScytheBtn').style.display = 'none';
        document.getElementById('harvestAllBtn').style.display = 'inline-block';
    } else {
        document.getElementById('buyScytheBtn').style.display = 'inline-block';
        document.getElementById('harvestAllBtn').style.display = 'none';
    }

    if (state.planterUnlocked) {
        document.getElementById('buyPlanterBtn').style.display = 'none';
        document.getElementById('plantAllBtn').style.display = 'inline-block';
    } else {
        document.getElementById('buyPlanterBtn').style.display = 'inline-block';
        document.getElementById('plantAllBtn').style.display = 'none';
    }
}

function updateShedUI() {
    if (!state.shedUnlocked) return;
    document.getElementById('shed-locked').style.display = 'none';
    document.getElementById('shed-unlocked').style.display = 'block';

    const shedMoney = document.getElementById('shed-money');
    if (shedMoney) shedMoney.innerText = state.money;

    // Update raw crop counts in the Shed stats grid
    Object.keys(crops).forEach(cropId => {
        const countSpan = document.getElementById(`shed-${cropId}Count`);
        if (countSpan) countSpan.innerText = state.inventory[cropId] || 0;
    });

    // Update Artisan counts and sell buttons
    Object.keys(artisanData).forEach(id => {
        const countSpan = document.getElementById(`shed-${id}Count`);
        if (countSpan) countSpan.innerText = state.inventory[id] || 0;

        const isLow = (state.inventory[id] <= 0); // No "leave 1 seed" rule for artisan goods
        const sellBtn = document.getElementById(`sell${id}Btn`);
        const sellAllBtn = document.getElementById(`sellAll${id}Btn`);
        
        if (sellBtn) sellBtn.disabled = isLow;
        if (sellAllBtn) sellAllBtn.disabled = isLow;
    });
}

// --- Renders ---
function renderFarm() {
    if(document.getElementById('farm-view').style.display === 'none') return;
    const farmDiv = document.getElementById('farm');
    
    if (farmDiv.children.length !== state.lots.length) {
        farmDiv.innerHTML = ''; 
        state.lots.forEach((lot, index) => {
            const tile = document.createElement('div');
            tile.id = `lot-${index}`;
            tile.onclick = () => handleLotClick(index);
            farmDiv.appendChild(tile);
        });
    }

    const now = Date.now();

    state.lots.forEach((lot, index) => {
        const tile = document.getElementById(`lot-${index}`);
        if (!tile) return;
        
        if (lot === null) {
            tile.className = 'lot empty';
            tile.innerHTML = 'Empty<br><span style="font-size:0.8em">(Click to Plant)</span>';
            tile.style.background = ''; 
            tile.style.borderColor = '';
        } else {
            const totalGrowTime = crops[lot.type].growTime * 1000;
            const timeRemaining = lot.finishTime - now;
            const timeElapsed = totalGrowTime - timeRemaining;
            
            let percentage = (timeElapsed / totalGrowTime) * 100;
            if (percentage > 100) percentage = 100;
            if (percentage < 0) percentage = 0;

            const secondsLeft = Math.ceil(timeRemaining / 1000);
            
            if (secondsLeft > 0) {
                tile.className = 'lot';
                const readyCol = crops[lot.type].readyColor;
                const growCol = crops[lot.type].growingColor;
                tile.style.background = `linear-gradient(to top, ${readyCol} ${percentage}%, ${growCol} ${percentage}%)`;
                tile.style.borderColor = 'rgba(0,0,0,0.2)';
                tile.innerHTML = `
                    <div>${crops[lot.type].name}</div>
                    <div style="font-size: 0.9em; margin-top: 5px;">⏳ ${secondsLeft}s</div>
                `;
            } else {
                tile.className = 'lot';
                tile.style.background = crops[lot.type].readyColor;
                tile.style.borderColor = 'white';
                tile.innerHTML = `
                    <div style="font-size: 1.2em;">${crops[lot.type].name}</div>
                    <div style="font-weight: bold; margin-top: 5px;">✔️ Ready!</div>
                `;
            }
        }
    });
}

function renderShedFloor() {
    if(document.getElementById('shed-view').style.display === 'none') return;
    const floor = document.getElementById('shed-floor');
    if(!floor) return;
    
    floor.innerHTML = '';
    const now = Date.now();

    if (state.machines.length === 0) {
        floor.innerHTML = '<p style="color: #bdc3c7;">Your shed is empty! Buy a machine from the store above.</p>';
        return;
    }

    state.machines.forEach((machine, index) => {
        const mData = machinesData[machine.type];
        const card = document.createElement('div');
        card.className = 'machine-card'; 
        
        if (!machine.isProcessing && !machine.isReady) {
            card.innerHTML = `
                <div style="font-size: 2rem;">${mData.icon}</div>
                <div style="font-weight: bold;">${mData.name}</div>
                <div style="font-size: 0.8rem; margin-top: 5px; color: #bdc3c7;">Needs ${mData.inputAmount} ${crops[mData.input].name}</div>
            `;
            card.onclick = () => loadMachine(index);
            
        } else if (machine.isProcessing && !machine.isReady) {
            const totalProcessTime = mData.processTime * 1000;
            const timeRemaining = machine.finishTime - now;
            const timeElapsed = totalProcessTime - timeRemaining;
            
            let percentage = (timeElapsed / totalProcessTime) * 100;
            if (percentage > 100) percentage = 100;
            if (percentage < 0) percentage = 0;
            
            const secondsLeft = Math.ceil(timeRemaining / 1000);
            
            card.style.background = `linear-gradient(to top, rgba(243, 156, 18, 0.5) ${percentage}%, #34495e ${percentage}%)`;
            card.style.borderColor = '#f39c12';
            
            card.innerHTML = `
                <div style="font-size: 2rem;">⚙️</div>
                <div style="font-weight: bold;">Processing...</div>
                <div style="font-size: 0.9rem; margin-top: 5px;">⏳ ${secondsLeft}s</div>
            `;
            
        } else if (machine.isReady) {
            card.style.background = '#27ae60';
            card.style.borderColor = '#2ecc71';
            card.innerHTML = `
                <div style="font-size: 2rem;">${artisanData[mData.output].icon}</div>
                <div style="font-weight: bold;">Ready!</div>
                <div style="font-size: 0.8rem; margin-top: 5px;">Click to Collect</div>
            `;
            card.onclick = () => collectMachine(index);
        }
        
        floor.appendChild(card);
    });
}

// --- Farm Actions ---
function handleLotClick(index) {
    const lot = state.lots[index];
    const now = Date.now();
    if (lot === null) plantCrop(index);
    else if (lot !== null && lot.finishTime <= now) harvestCrop(index);
}

function getSelectedSeed() {
    const checked = document.querySelector('input[name="seed"]:checked');
    return checked ? checked.value : 'wheat'; 
}

function plantCrop(lotIndex) {
    const seed = getSelectedSeed();
    if (state.inventory[seed] >= 1) {
        state.inventory[seed] -= 1;
        state.lots[lotIndex] = { type: seed, finishTime: Date.now() + (crops[seed].growTime * 1000), isReady: false };
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
    state.inventory[cropType] += crops[cropType].yield;
    state.stats.totalHarvested += crops[cropType].yield;
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
    state.lots.forEach((lot, index) => {
        if (lot !== null && lot.finishTime <= now) {
            state.inventory[lot.type] += crops[lot.type].yield;
            state.stats.totalHarvested += crops[lot.type].yield;
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
    for (let i = 0; i < state.lots.length; i++) {
        if (state.lots[i] === null && state.inventory[seed] >= 1) {
            state.inventory[seed] -= 1;
            state.lots[i] = { type: seed, finishTime: Date.now() + (crops[seed].growTime * 1000), isReady: false };
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
    if (state.money >= mData.cost) {
        state.money -= mData.cost;
        state.stats.totalSpent += mData.cost;
        
        state.machines.push({
            type: machineId,
            isProcessing: false,
            isReady: false,
            finishTime: 0
        });
        
        saveGame();
        updateUI();
        updateShedUI();
        renderShedFloor();
    } else {
        showMessage(`Not enough money! You need $${mData.cost}.`);
    }
}

window.loadMachine = function(index) {
    const machine = state.machines[index];
    const mData = machinesData[machine.type];
    const requiredInput = mData.input;
    const requiredAmount = mData.inputAmount;

    if (state.inventory[requiredInput] >= requiredAmount) {
        state.inventory[requiredInput] -= requiredAmount;
        machine.isProcessing = true;
        machine.finishTime = Date.now() + (mData.processTime * 1000);
        
        saveGame();
        updateUI(); 
        updateShedUI(); 
        renderShedFloor();
    } else {
        showMessage(`You need ${requiredAmount} ${crops[requiredInput].name} to start this machine!`);
    }
}

window.collectMachine = function(index) {
    const machine = state.machines[index];
    const mData = machinesData[machine.type];
    const outputItem = mData.output;
    const outputAmount = mData.outputAmount;

    state.inventory[outputItem] += outputAmount;
    
    machine.isProcessing = false;
    machine.isReady = false;
    machine.finishTime = 0;

    playSound('harvest');
    saveGame();
    updateUI();
    updateShedUI();
    renderShedFloor();
}

window.loadAllMachines = function() {
    let loadedAnything = false;
    state.machines.forEach((machine) => {
        if (!machine.isProcessing && !machine.isReady) {
            const mData = machinesData[machine.type];
            if (state.inventory[mData.input] >= mData.inputAmount) {
                state.inventory[mData.input] -= mData.inputAmount;
                machine.isProcessing = true;
                machine.finishTime = Date.now() + (mData.processTime * 1000);
                loadedAnything = true;
            }
        }
    });

    if (loadedAnything) {
        playSound('plant');
        showMessage("Started all possible machines!");
        saveGame();
        updateUI();
        updateShedUI();
        renderShedFloor();
    } else {
        showMessage("Not enough raw materials to start any machines!");
    }
}

window.collectAllMachines = function() {
    let collectedAnything = false;
    state.machines.forEach((machine) => {
        if (machine.isReady) {
            const mData = machinesData[machine.type];
            state.inventory[mData.output] += mData.outputAmount;
            machine.isProcessing = false;
            machine.isReady = false;
            machine.finishTime = 0;
            collectedAnything = true;
        }
    });

    if (collectedAnything) {
        playSound('harvest');
        showMessage("Collected all artisan goods!");
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

// --- Mailbox Receiver ---
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

function updateMuteButton() {
    const btn = document.getElementById('muteBtn');
    if (!btn) return;
    if (state.muted) {
        btn.innerText = "🔇 Unmute";
        btn.style.backgroundColor = "#95a5a6"; 
    } else {
        btn.innerText = "🔊 Mute";
        btn.style.backgroundColor = "#3498db"; 
    }
}

// --- Master Game Loop ---
function startGameLoop() {
    setInterval(() => {
        let needsFarmRender = false;
        let needsShedRender = false;
        const now = Date.now();
        
        // Tick Farm
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

        // Tick Shed
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