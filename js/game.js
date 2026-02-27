// --- Authentication & User Setup ---
let currentUser = null;
let saveKey = 'tileFarmSave_guest'; 

// 1. DYNAMIC STATE
let state = {
    money: 0,
    inventory: { wheat: 2 },
    unlockedCrops: { wheat: true }, 
    lots: [null, null, null, null],
    lotPrice: 15,
    scytheUnlocked: false,
    planterUnlocked: false,
    muted: false
};

let crops = {}; 
let messageTimeout;

// 2. UPDATED AUDIO PATHS
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
        
        // Handle offline progress
        if (parsedState.lots) {
            parsedState.lots.forEach(lot => {
                if (lot !== null && lot.timeLeft !== undefined) {
                    lot.finishTime = Date.now() + (lot.timeLeft * 1000);
                    delete lot.timeLeft;
                }
            });
        }
        
        // Load state
        state = { ...state, ...parsedState }; 
        if (parsedState.inventory) state.inventory = { ...state.inventory, ...parsedState.inventory };
        if (parsedState.unlockedCrops) state.unlockedCrops = { ...state.unlockedCrops, ...parsedState.unlockedCrops };

        // 3. MIGRATION FOR OLD SAVE FILES
        if (parsedState.hopsUnlocked) state.unlockedCrops.hops = true;
        if (parsedState.pumpkinsUnlocked) state.unlockedCrops.pumpkins = true;
        if (parsedState.watermelonsUnlocked) state.unlockedCrops.watermelons = true;

        // Ensure all crops exist in inventory
        Object.keys(crops).forEach(cropId => {
            if (state.inventory[cropId] === undefined) state.inventory[cropId] = 0;
            if (state.unlockedCrops[cropId] === undefined) state.unlockedCrops[cropId] = (cropId === 'wheat');
            
            // Smarter Rescue
            const growing = state.lots.filter(lot => lot && lot.type === cropId).length;
            if (state.unlockedCrops[cropId] && state.inventory[cropId] <= 0 && growing === 0) {
                state.inventory[cropId] = 1;
                console.log(`Save fixed: Restored 1 ${crops[cropId].name} seed!`);
            }
        });
    }
}

// --- Dynamic UI Generation ---
function generateUI() {
    const statsContainer = document.getElementById('stats-container');
    const sellContainer = document.getElementById('sell-buttons-container');
    const seedSelector = document.getElementById('seed-selector-container');
    const unlockContainer = document.getElementById('unlock-buttons-container');

    statsContainer.innerHTML = `<div>💵 Money: $<span id="money">0</span></div>`;
    sellContainer.innerHTML = '';
    seedSelector.innerHTML = '';
    unlockContainer.innerHTML = '';

    Object.keys(crops).forEach((cropId, index) => {
        const crop = crops[cropId];

        // Stats
        statsContainer.innerHTML += `<div>${crop.icon} ${crop.name}: <span id="${cropId}Count">0</span></div>`;

        // Sell Buttons
        sellContainer.innerHTML += `
            <div style="margin-top: ${index > 0 ? '10px' : '0'};" id="${cropId}SellDiv">
                <button id="sell${cropId}Btn" onclick="sell('${cropId}', 1)">Sell 1 ${crop.name} ($${crop.sellPrice})</button>
                <button id="sellAll${cropId}Btn" onclick="sellAll('${cropId}')" style="background-color: #e67e22;">Sell All ${crop.name}</button>
            </div>
        `;

        // Radios
        seedSelector.innerHTML += `
            <label id="${cropId}RadioLabel" style="display:none; margin-right: 10px;">
                <input type="radio" name="seed" value="${cropId}"> ${crop.name}
            </label>
        `;

        // Unlock Buttons
        if (crop.unlockPrice > 0) {
            unlockContainer.innerHTML += `
                <button id="buy${cropId}Btn" onclick="unlockCrop('${cropId}')" style="background-color: ${crop.growingColor}; margin-right: 5px; margin-top: 5px;">
                    Unlock ${crop.name} ($${crop.unlockPrice})
                </button>
            `;
        }
    });

    // Default to wheat
    const wheatRadio = document.querySelector('input[value="wheat"]');
    if (wheatRadio) wheatRadio.checked = true;
}

// --- Initialization ---
async function init() {
    if (!checkAuth()) return; 

    try {
        // UPDATED PATH
        const response = await fetch('data/crops.json'); 
        crops = await response.json();
        
        generateUI(); // Build HTML dynamically
        loadGame();
        updateMuteButton();
        updateUI();
        renderFarm();
        startGameLoop();
    } catch (error) {
        console.error("Failed to load crops data:", error);
        showMessage("Error loading game data!");
    }
}

function showMessage(msg) {
    const msgBox = document.getElementById('message-box');
    if (!msgBox) return; 
    msgBox.innerText = msg;
    msgBox.style.opacity = 1;
    
    clearTimeout(messageTimeout);
    messageTimeout = setTimeout(() => {
        msgBox.style.opacity = 0;
    }, 3000);
}

function updateUI() {
    document.getElementById('money').innerText = state.money;
    
    const buyLotBtn = document.querySelector('button[onclick="buyLot()"]');
    if (buyLotBtn) buyLotBtn.innerText = `Buy Empty Lot ($${state.lotPrice})`;

    // DYNAMIC LOOP FOR ALL CROPS
    Object.keys(crops).forEach(cropId => {
        // Stats
        const countSpan = document.getElementById(`${cropId}Count`);
        if (countSpan) countSpan.innerText = state.inventory[cropId] || 0;

        // Radios and Unlock Buttons
        const radioLabel = document.getElementById(`${cropId}RadioLabel`);
        const unlockBtn = document.getElementById(`buy${cropId}Btn`);
        
        if (state.unlockedCrops[cropId]) {
            if (radioLabel) radioLabel.style.display = 'inline';
            if (unlockBtn) unlockBtn.style.display = 'none';
        } else {
            if (radioLabel) radioLabel.style.display = 'none';
            if (unlockBtn) unlockBtn.style.display = 'inline-block';
        }

        // Sell Buttons Safety Lock
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

    // Tools Logic
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

function renderFarm() {
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
        renderFarm();
    } else {
        showMessage(`You don't have enough ${crops[seed].name} seeds!`);
    }
}

function harvestCrop(lotIndex) {
    const cropType = state.lots[lotIndex].type;
    state.inventory[cropType] += crops[cropType].yield;
    state.lots[lotIndex] = null;
    playSound('harvest');
    updateUI();
    renderFarm();
}

function sell(cropType, amount = 1) {
    if (state.inventory[cropType] - amount >= 1) { 
        state.inventory[cropType] -= amount;
        state.money += (crops[cropType].sellPrice * amount);
        playSound('money');
        updateUI();
    } else {
        showMessage(`You must keep at least 1 ${crops[cropType].name} seed!`);
    }
}

function sellAll(cropType) {
    if (state.inventory[cropType] > 1) {
        const amountToSell = state.inventory[cropType] - 1;
        state.inventory[cropType] -= amountToSell;
        state.money += (crops[cropType].sellPrice * amountToSell);
        playSound('money');
        updateUI();
    }
}

function buyLot() {
    if (state.money >= state.lotPrice) {
        state.money -= state.lotPrice;
        state.lots.push(null);
        state.lotPrice = Math.floor(state.lotPrice * 1.2);
        playSound('money');
        updateUI();
        renderFarm();
    } else {
        showMessage("Not enough money!");
    }
}

// 4. UNIFIED UNLOCK FUNCTION
function unlockCrop(cropId) {
    const crop = crops[cropId];
    if (state.money >= crop.unlockPrice && !state.unlockedCrops[cropId]) {
        state.money -= crop.unlockPrice;
        state.unlockedCrops[cropId] = true;
        state.inventory[cropId] += 1; 
        playSound('money');
        showMessage(`${crop.name} unlocked! Received 1 starter seed.`);
        updateUI();
    } else if (state.unlockedCrops[cropId]) {
        showMessage(`You already unlocked ${crop.name}!`);
    } else {
        showMessage(`Not enough money! You need $${crop.unlockPrice}.`);
    }
}

function buyScythe() {
    if (state.money >= 500 && !state.scytheUnlocked) {
        state.money -= 500;
        state.scytheUnlocked = true;
        showMessage("Scythe unlocked!");
        updateUI();
    }
}

function harvestAll() {
    if (!state.scytheUnlocked) return;
    const now = Date.now();
    let harvestedAnything = false;
    state.lots.forEach((lot, index) => {
        if (lot !== null && lot.finishTime <= now) {
            state.inventory[lot.type] += crops[lot.type].yield;
            state.lots[index] = null; 
            harvestedAnything = true;
        }
    });
    if (harvestedAnything) {
        playSound('harvest');
        showMessage("Harvested all ready crops!");
        updateUI();
        renderFarm();
    }
}

function buyPlanter() {
    if (state.money >= 1000 && !state.planterUnlocked) {
        state.money -= 1000;
        state.planterUnlocked = true;
        showMessage("Planting Machine unlocked!");
        updateUI();
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
        renderFarm();
    }
}

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

function startGameLoop() {
    setInterval(() => {
        let needsRender = false;
        const now = Date.now();
        state.lots.forEach(lot => {
            if (lot !== null) {
                const secondsLeft = Math.ceil((lot.finishTime - now) / 1000);
                if (secondsLeft > 0) needsRender = true;
                else if (!lot.isReady) {
                    lot.isReady = true; 
                    needsRender = true; 
                }
            }
        });
        saveGame();
        if (needsRender) renderFarm();
    }, 1000);
}

init();