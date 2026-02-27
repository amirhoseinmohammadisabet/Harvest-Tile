// --- Authentication & User Setup ---
let currentUser = null;
let saveKey = 'tileFarmSave_guest'; 

let state = {
    money: 0,
    inventory: { wheat: 2, hops: 0 },
    lots: [null, null, null, null],
    hopsUnlocked: false,
    lotPrice: 15,
    scytheUnlocked: false,
    planterUnlocked: false,
    pumpkinsUnlocked: false,
    watermelonsUnlocked: false,
    muted: false
};

let crops = {}; 
let messageTimeout;

// --- Sound System ---
const sounds = {
    plant: new Audio('plant.mp3'),
    harvest: new Audio('harvest.mp3'),
    money: new Audio('money.mp3')
};

function playSound(name) {
    // If muted, stop here and do nothing
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
        
        // 1. Load the main state
        state = { ...state, ...parsedState }; 
        
        // 2. CRITICAL FIX: "Deep Merge" the inventory
        // This ensures if the save file has 'wheat' but no 'pumpkins', 
        // we keep the 'pumpkins: 0' from the default state instead of losing it.
        if (parsedState.inventory) {
            state.inventory = { ...state.inventory, ...parsedState.inventory };
        }
        
        // 3. Initialize Pumpkins if still missing
        if (state.inventory.pumpkins === undefined) {
            state.inventory.pumpkins = 0;
        }

        // 4. SMARTER RESCUE: Only give a seed if they have 0 AND aren't growing any
        const growingPumpkins = state.lots.filter(lot => lot && lot.type === 'pumpkins').length;
        
        if (state.pumpkinsUnlocked && state.inventory.pumpkins <= 0 && growingPumpkins === 0) {
            state.inventory.pumpkins = 1;
            showMessage("Emergency: 1 Pumpkin seed provided (You had none left!)");
        }
        // Initialize Watermelons if missing
        if (state.inventory.watermelons === undefined) {
            state.inventory.watermelons = 0;
        }

        // Rescue Logic for Watermelons
        const growingWatermelons = state.lots.filter(lot => lot && lot.type === 'watermelons').length;
        if (state.watermelonsUnlocked && state.inventory.watermelons <= 0 && growingWatermelons === 0) {
            state.inventory.watermelons = 1;
            console.log("Save fixed: Restored 1 Watermelon seed!");
        }
    }
}

// --- Initialization ---
async function init() {
    if (!checkAuth()) return; 

    try {
        const response = await fetch('crops.json');
        crops = await response.json();
        
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

// --- Core Functions ---
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
    // 1. Update Stats Display
    document.getElementById('money').innerText = state.money;
    document.getElementById('wheatCount').innerText = state.inventory.wheat;
    document.getElementById('hopsCount').innerText = state.inventory.hops;
    // Check if pumpkin element exists (safety check)
    if(document.getElementById('pumpkinsCount')) {
         document.getElementById('pumpkinsCount').innerText = state.inventory.pumpkins || 0;
    }
    if(document.getElementById('watermelonsCount')) {
         document.getElementById('watermelonsCount').innerText = state.inventory.watermelons || 0;
    }

    // 2. Update Lot Price Button
    const buyLotBtn = document.querySelector('button[onclick="buyLot()"]');
    if (buyLotBtn) buyLotBtn.innerText = `Buy Empty Lot ($${state.lotPrice})`;

    // --- WHEAT SAFETY LOCK ---
    // If we have 1 or 0 wheat, disable the buttons
    const wheatLow = (state.inventory.wheat <= 1); 
    const wheatBtn = document.getElementById('sellWheatBtn');
    const wheatAllBtn = document.getElementById('sellAllWheatBtn');
    
    if (wheatBtn) wheatBtn.disabled = wheatLow;
    if (wheatAllBtn) wheatAllBtn.disabled = wheatLow;

    // --- HOPS SAFETY LOCK ---
    if (state.hopsUnlocked) {
        document.getElementById('buyHopsBtn').style.display = 'none';
        document.getElementById('hopsRadioLabel').style.display = 'inline';
        
        // Disable if 1 or 0 hops
        const hopsLow = (state.inventory.hops <= 1);
        document.getElementById('sellHopsBtn').disabled = hopsLow;
        const sellAllHopsBtn = document.getElementById('sellAllHopsBtn');
        if (sellAllHopsBtn) sellAllHopsBtn.disabled = hopsLow;
    } else {
        document.getElementById('buyHopsBtn').style.display = 'inline-block';
        document.getElementById('hopsRadioLabel').style.display = 'none';
        
        document.getElementById('sellHopsBtn').disabled = true;
        const sellAllHopsBtn = document.getElementById('sellAllHopsBtn');
        if (sellAllHopsBtn) sellAllHopsBtn.disabled = true;
    }

    // --- PUMPKINS SAFETY LOCK ---
    if (state.pumpkinsUnlocked) {
        const buyPumpkinsBtn = document.getElementById('buyPumpkinsBtn');
        if (buyPumpkinsBtn) buyPumpkinsBtn.style.display = 'none';
        
        const pumpkinsRadio = document.getElementById('pumpkinsRadioLabel');
        if (pumpkinsRadio) pumpkinsRadio.style.display = 'inline';
        
        // Disable if 1 or 0 pumpkins
        const pumpkinsLow = (state.inventory.pumpkins <= 1);
        const sellPumpkinsBtn = document.getElementById('sellPumpkinsBtn');
        if (sellPumpkinsBtn) sellPumpkinsBtn.disabled = pumpkinsLow;
        
        const sellAllPumpkinsBtn = document.getElementById('sellAllPumpkinsBtn');
        if (sellAllPumpkinsBtn) sellAllPumpkinsBtn.disabled = pumpkinsLow;
    } else {
        const buyPumpkinsBtn = document.getElementById('buyPumpkinsBtn');
        if (buyPumpkinsBtn) buyPumpkinsBtn.style.display = 'inline-block';
        
        const pumpkinsRadio = document.getElementById('pumpkinsRadioLabel');
        if (pumpkinsRadio) pumpkinsRadio.style.display = 'none';
        
        // Always disabled if not unlocked
        const sellPumpkinsBtn = document.getElementById('sellPumpkinsBtn');
        if (sellPumpkinsBtn) sellPumpkinsBtn.disabled = true;
        
        const sellAllPumpkinsBtn = document.getElementById('sellAllPumpkinsBtn');
        if (sellAllPumpkinsBtn) sellAllPumpkinsBtn.disabled = true;
    }

    // --- WATERMELONS SAFETY LOCK ---
    if (state.watermelonsUnlocked) {
        const buyWatermelonsBtn = document.getElementById('buyWatermelonsBtn');
        if (buyWatermelonsBtn) buyWatermelonsBtn.style.display = 'none';
        
        const watermelonsRadio = document.getElementById('watermelonsRadioLabel');
        if (watermelonsRadio) watermelonsRadio.style.display = 'inline';
        
        const watermelonsLow = (state.inventory.watermelons <= 1);
        const sellWatermelonsBtn = document.getElementById('sellWatermelonsBtn');
        if (sellWatermelonsBtn) sellWatermelonsBtn.disabled = watermelonsLow;
        
        const sellAllWatermelonsBtn = document.getElementById('sellAllWatermelonsBtn');
        if (sellAllWatermelonsBtn) sellAllWatermelonsBtn.disabled = watermelonsLow;
    } else {
        const buyWatermelonsBtn = document.getElementById('buyWatermelonsBtn');
        if (buyWatermelonsBtn) buyWatermelonsBtn.style.display = 'inline-block';
        
        const watermelonsRadio = document.getElementById('watermelonsRadioLabel');
        if (watermelonsRadio) watermelonsRadio.style.display = 'none';
        
        const sellWatermelonsBtn = document.getElementById('sellWatermelonsBtn');
        if (sellWatermelonsBtn) sellWatermelonsBtn.disabled = true;
        
        const sellAllWatermelonsBtn = document.getElementById('sellAllWatermelonsBtn');
        if (sellAllWatermelonsBtn) sellAllWatermelonsBtn.disabled = true;
    }

    // --- TOOL LOGIC (Scythe & Planter) ---
    if (state.scytheUnlocked) {
        const buyScytheBtn = document.getElementById('buyScytheBtn');
        if (buyScytheBtn) buyScytheBtn.style.display = 'none';
        
        const harvestAllBtn = document.getElementById('harvestAllBtn');
        if (harvestAllBtn) harvestAllBtn.style.display = 'inline-block';
    } else {
        const buyScytheBtn = document.getElementById('buyScytheBtn');
        if (buyScytheBtn) buyScytheBtn.style.display = 'inline-block';
        
        const harvestAllBtn = document.getElementById('harvestAllBtn');
        if (harvestAllBtn) harvestAllBtn.style.display = 'none';
    }

    if (state.planterUnlocked) {
        const buyPlanterBtn = document.getElementById('buyPlanterBtn');
        if (buyPlanterBtn) buyPlanterBtn.style.display = 'none';
        
        const plantAllBtn = document.getElementById('plantAllBtn');
        if (plantAllBtn) plantAllBtn.style.display = 'inline-block';
    } else {
        const buyPlanterBtn = document.getElementById('buyPlanterBtn');
        if (buyPlanterBtn) buyPlanterBtn.style.display = 'inline-block';
        
        const plantAllBtn = document.getElementById('plantAllBtn');
        if (plantAllBtn) plantAllBtn.style.display = 'none';
    }
}

function renderFarm() {
    const farmDiv = document.getElementById('farm');
    
    // Create tiles if they don't exist yet
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
            tile.style.background = ''; // Reset background
            tile.style.borderColor = '';
        } else {
            // Calculate growth progress
            const totalGrowTime = crops[lot.type].growTime * 1000;
            const timeRemaining = lot.finishTime - now;
            const timeElapsed = totalGrowTime - timeRemaining;
            
            // Calculate percentage (0 to 100)
            let percentage = (timeElapsed / totalGrowTime) * 100;
            if (percentage > 100) percentage = 100;
            if (percentage < 0) percentage = 0;

            const secondsLeft = Math.ceil(timeRemaining / 1000);
            
            if (secondsLeft > 0) {
                tile.className = 'lot';
                
                // NEW: Dynamic background fill using CSS linear-gradient
                const readyCol = crops[lot.type].readyColor;
                const growCol = crops[lot.type].growingColor;
                tile.style.background = `linear-gradient(to top, ${readyCol} ${percentage}%, ${growCol} ${percentage}%)`;
                
                tile.style.borderColor = 'rgba(0,0,0,0.2)';
                
                // Render just the Name and Timer (no extra progress bar needed)
                tile.innerHTML = `
                    <div>${crops[lot.type].name}</div>
                    <div style="font-size: 0.9em; margin-top: 5px;">⏳ ${secondsLeft}s</div>
                `;
            } else {
                tile.className = 'lot';
                // When 100% ready, make it solid readyColor
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

// --- Actions ---
function handleLotClick(index) {
    const lot = state.lots[index];
    const now = Date.now();
    
    if (lot === null) {
        plantCrop(index);
    } else if (lot !== null && lot.finishTime <= now) {
        harvestCrop(index);
    }
}

function getSelectedSeed() {
    const checked = document.querySelector('input[name="seed"]:checked');
    return checked ? checked.value : 'wheat'; 
}

function plantCrop(lotIndex) {
    const seed = getSelectedSeed();
    if (state.inventory[seed] >= 1) {
        state.inventory[seed] -= 1;
        const finishTime = Date.now() + (crops[seed].growTime * 1000);
        
        state.lots[lotIndex] = { type: seed, finishTime: finishTime, isReady: false };
        playSound('plant');
        updateUI();
        renderFarm();
    } else {
        showMessage(`You don't have enough ${crops[seed].name} seeds!`);
    }
}

function harvestCrop(lotIndex) {
    const cropType = state.lots[lotIndex].type;
    const amount = crops[cropType].yield;
    state.inventory[cropType] += amount;
    state.lots[lotIndex] = null;
    playSound('harvest');
    updateUI();
    renderFarm();
}

// Fixed Sell Logic
function sell(cropType, amount = 1) {
    // Check if performing this sale leaves at least 1 seed
    if (state.inventory[cropType] - amount >= 1) { 
        state.inventory[cropType] -= amount;
        state.money += (crops[cropType].sellPrice * amount);
        playSound('money');
        updateUI();
    } else {
        showMessage(`You must keep at least 1 ${crops[cropType].name} seed to keep planting!`);
    }
}

function sellAll(cropType) {
    if (state.inventory[cropType] > 1) {
        const amountToSell = state.inventory[cropType] - 1;
        state.inventory[cropType] -= amountToSell;
        state.money += (crops[cropType].sellPrice * amountToSell);
        playSound('money');
        updateUI();
    } else {
        showMessage(`You only have 1 ${crops[cropType].name} seed left!`);
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
        showMessage("Not enough money to buy an empty lot!");
    }
}

function unlockHops() {
    if (state.money >= 30) {
        state.money -= 30;
        state.hopsUnlocked = true;
        state.inventory.hops += 1; 
        showMessage("Hops unlocked! You received 1 starter seed.");
        updateUI();
    } else {
        showMessage("Not enough money to unlock Hops!");
    }
}

function unlockPumpkins() {
    const unlockPrice = 2500;
    
    // Check if they have the money AND haven't bought it yet
    if (state.money >= unlockPrice && !state.pumpkinsUnlocked) {
        state.money -= unlockPrice;
        state.pumpkinsUnlocked = true;
        
        // FIX: If loading an old save, create the pumpkins inventory slot
        if (state.inventory.pumpkins === undefined || isNaN(state.inventory.pumpkins)) {
            state.inventory.pumpkins = 0;
        }
        
        state.inventory.pumpkins += 1; 
        showMessage("Pumpkins unlocked! You received 1 starter seed.");
        updateUI();
        
    } else if (state.pumpkinsUnlocked) {
        showMessage("You already unlocked Pumpkins!");
    } else {
        showMessage(`Not enough money! You need $${unlockPrice} to unlock Pumpkins.`);
    }
}

function unlockWatermelons() {
    const unlockPrice = 10000;
    
    if (state.money >= unlockPrice && !state.watermelonsUnlocked) {
        state.money -= unlockPrice;
        state.watermelonsUnlocked = true;
        
        if (state.inventory.watermelons === undefined || isNaN(state.inventory.watermelons)) {
            state.inventory.watermelons = 0;
        }
        
        state.inventory.watermelons += 1; 
        playSound('money');
        showMessage("Watermelons unlocked! You received 1 starter seed.");
        updateUI();
        
    } else if (state.watermelonsUnlocked) {
        showMessage("You already unlocked Watermelons!");
    } else {
        showMessage(`Not enough money! You need $${unlockPrice}.`);
    }
}

// --- New Scythe Actions ---
function buyScythe() {
    const scythePrice = 500;
    if (state.money >= scythePrice && !state.scytheUnlocked) {
        state.money -= scythePrice;
        state.scytheUnlocked = true;
        showMessage("Scythe unlocked! You can now harvest all ready crops at once.");
        updateUI();
    } else if (state.scytheUnlocked) {
        showMessage("You already own the Scythe!");
    } else {
        showMessage(`Not enough money! You need $${scythePrice} to buy the Scythe.`);
    }
}

function harvestAll() {
    if (!state.scytheUnlocked) return;
    
    const now = Date.now();
    let harvestedAnything = false;

    // Loop through all lots and harvest the ready ones
    state.lots.forEach((lot, index) => {
        if (lot !== null && lot.finishTime <= now) {
            const cropType = lot.type;
            const amount = crops[cropType].yield;
            state.inventory[cropType] += amount;
            state.lots[index] = null; // Clear the lot
            harvestedAnything = true;
        }
    });

    if (harvestedAnything) {
        playSound('harvest');
        showMessage("Harvested all ready crops!");
        updateUI();
        renderFarm();
    } else {
        showMessage("No crops are ready to harvest right now.");
    }
}

// --- New Planter Actions ---
function buyPlanter() {
    const planterPrice = 1000;
    if (state.money >= planterPrice && !state.planterUnlocked) {
        state.money -= planterPrice;
        state.planterUnlocked = true;
        showMessage("Planting Machine unlocked! You can now plant multiple empty lots at once.");
        updateUI();
    } else if (state.planterUnlocked) {
        showMessage("You already own the Planting Machine!");
    } else {
        showMessage(`Not enough money! You need $${planterPrice} to buy the Planting Machine.`);
    }
}

function plantAll() {
    if (!state.planterUnlocked) return;

    const seed = getSelectedSeed();
    let plantedAnything = false;

    // Loop through all lots and plant if empty AND if we have enough seeds
    for (let i = 0; i < state.lots.length; i++) {
        if (state.lots[i] === null && state.inventory[seed] >= 1) {
            state.inventory[seed] -= 1;
            const finishTime = Date.now() + (crops[seed].growTime * 1000);
            
            state.lots[i] = { type: seed, finishTime: finishTime, isReady: false };
            plantedAnything = true;
        }
    }

    if (plantedAnything) {
        playSound('plant');
        showMessage(`Planted as much ${crops[seed].name} as possible!`);
        updateUI();
        renderFarm();
    } else if (state.inventory[seed] < 1) {
        showMessage(`You don't have any ${crops[seed].name} seeds!`);
    } else {
        showMessage("No empty lots available to plant.");
    }
}

function toggleMute() {
    state.muted = !state.muted; // Flip true/false
    updateMuteButton();
    saveGame(); // Save preference immediately
}

function updateMuteButton() {
    const btn = document.getElementById('muteBtn');
    if (!btn) return;

    if (state.muted) {
        btn.innerText = "🔇 Unmute";
        btn.style.backgroundColor = "#95a5a6"; // Grey when muted
    } else {
        btn.innerText = "🔊 Mute";
        btn.style.backgroundColor = "#3498db"; // Blue when on
    }
}

// --- Game Loop ---
function startGameLoop() {
    setInterval(() => {
        let needsRender = false;
        const now = Date.now();
        
        state.lots.forEach(lot => {
            if (lot !== null) {
                const secondsLeft = Math.ceil((lot.finishTime - now) / 1000);
                
                if (secondsLeft > 0) {
                    needsRender = true;
                } else if (!lot.isReady) {
                    lot.isReady = true; 
                    needsRender = true; 
                }
            }
        });
        
        saveGame();
        if (needsRender) renderFarm();
    }, 1000);
}

// Start everything up
init();