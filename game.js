// --- Authentication & User Setup ---
let currentUser = null;
let saveKey = 'tileFarmSave_guest'; 

let state = {
    money: 0,
    inventory: { wheat: 2, hops: 0 },
    lots: [null, null, null, null],
    hopsUnlocked: false,
    lotPrice: 15
};

let crops = {}; 
let messageTimeout;

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
    }
}

// --- Initialization ---
async function init() {
    if (!checkAuth()) return; 

    try {
        const response = await fetch('crops.json');
        crops = await response.json();
        
        loadGame();
        
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
    document.getElementById('money').innerText = state.money;
    document.getElementById('wheatCount').innerText = state.inventory.wheat;
    document.getElementById('hopsCount').innerText = state.inventory.hops;
    
    const buyLotBtn = document.querySelector('button[onclick="buyLot()"]');
    if (buyLotBtn) buyLotBtn.innerText = `Buy Empty Lot ($${state.lotPrice})`;
    
    if (state.hopsUnlocked) {
        document.getElementById('buyHopsBtn').style.display = 'none';
        document.getElementById('hopsRadioLabel').style.display = 'inline';
        
        document.getElementById('sellHopsBtn').disabled = false;
        const sellAllHopsBtn = document.getElementById('sellAllHopsBtn');
        if (sellAllHopsBtn) sellAllHopsBtn.disabled = false;
    } else {
        document.getElementById('buyHopsBtn').style.display = 'inline-block';
        document.getElementById('hopsRadioLabel').style.display = 'none';
        
        document.getElementById('sellHopsBtn').disabled = true;
        const sellAllHopsBtn = document.getElementById('sellAllHopsBtn');
        if (sellAllHopsBtn) sellAllHopsBtn.disabled = true;
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
            tile.innerText = 'Empty\n(Click to Plant)';
            tile.style.backgroundColor = ''; 
            tile.style.borderColor = '';
        } else {
            const secondsLeft = Math.ceil((lot.finishTime - now) / 1000);
            
            if (secondsLeft > 0) {
                tile.className = 'lot';
                tile.innerText = `${crops[lot.type].name}\n⏳ ${secondsLeft}s`;
                tile.style.backgroundColor = crops[lot.type].growingColor;
                tile.style.borderColor = 'rgba(0,0,0,0.2)';
            } else {
                tile.className = 'lot';
                tile.innerText = `${crops[lot.type].name}\n✔️ Harvest`;
                tile.style.backgroundColor = crops[lot.type].readyColor;
                tile.style.borderColor = 'white';
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
    updateUI();
    renderFarm();
}

function sell(cropType, amount = 1) {
    if (state.inventory[cropType] > amount) { 
        state.inventory[cropType] -= amount;
        state.money += (crops[cropType].sellPrice * amount);
        updateUI();
    } else if (state.inventory[cropType] === amount) {
        showMessage(`You must keep at least 1 ${crops[cropType].name} seed!`);
    } else {
        showMessage(`You don't have any ${crops[cropType].name} to sell!`);
    }
}

function sellAll(cropType) {
    if (state.inventory[cropType] > 1) {
        const amountToSell = state.inventory[cropType] - 1;
        state.inventory[cropType] -= amountToSell;
        state.money += (crops[cropType].sellPrice * amountToSell);
        updateUI();
    } else if (state.inventory[cropType] === 1) {
        showMessage(`You must keep at least 1 ${crops[cropType].name} seed!`);
    } else {
        showMessage(`You don't have any ${crops[cropType].name} to sell!`);
    }
}

function buyLot() {
    if (state.money >= state.lotPrice) {
        state.money -= state.lotPrice;
        state.lots.push(null);
        state.lotPrice = Math.floor(state.lotPrice * 1.2);
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