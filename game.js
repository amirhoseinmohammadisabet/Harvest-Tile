let state = {
    money: 0,
    inventory: { wheat: 2, hops: 0 },
    lots: [null, null, null, null],
    hopsUnlocked: false,
    lotPrice: 15
};

let crops = {}; // Will be filled by crops.json

// --- Initialization ---
async function init() {
    try {
        const response = await fetch('crops.json');
        crops = await response.json();
        
        updateUI();
        renderFarm();
        startGameLoop();
    } catch (error) {
        console.error("Failed to load crops data:", error);
        document.getElementById('farm').innerText = "Error loading game data.";
    }
}

// --- Core Functions ---
function updateUI() {
    document.getElementById('money').innerText = state.money;
    document.getElementById('wheatCount').innerText = state.inventory.wheat;
    document.getElementById('hopsCount').innerText = state.inventory.hops;
    
    if (state.hopsUnlocked) {
        document.getElementById('buyHopsBtn').style.display = 'none';
        document.getElementById('hopsRadioLabel').style.display = 'inline';
        document.getElementById('sellHopsBtn').disabled = false;
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

    state.lots.forEach((lot, index) => {
        const tile = document.getElementById(`lot-${index}`);
        
        if (lot === null) {
            tile.className = 'lot empty';
            tile.innerText = 'Empty\n(Click to Plant)';
            tile.style.backgroundColor = ''; // Reset inline style
            tile.style.borderColor = '';
        } else if (lot.timeLeft > 0) {
            tile.className = 'lot';
            tile.innerText = `${crops[lot.type].name}\n⏳ ${lot.timeLeft}s`;
            tile.style.backgroundColor = crops[lot.type].growingColor; // From JSON
            tile.style.borderColor = 'rgba(0,0,0,0.2)';
        } else {
            tile.className = 'lot';
            tile.innerText = `${crops[lot.type].name}\n✔️ Harvest`;
            tile.style.backgroundColor = crops[lot.type].readyColor; // From JSON
            tile.style.borderColor = 'white';
        }
    });
}

// --- In-Game Messages ---
let messageTimeout;
function showMessage(msg) {
    const msgBox = document.getElementById('message-box');
    msgBox.innerText = msg;
    msgBox.style.opacity = 1; // Make it visible
    
    // Clear any existing timer, then hide the message after 3 seconds
    clearTimeout(messageTimeout);
    messageTimeout = setTimeout(() => {
        msgBox.style.opacity = 0;
    }, 3000);
}

// --- Actions ---
function handleLotClick(index) {
    const lot = state.lots[index];
    if (lot === null) plantCrop(index);
    else if (lot !== null && lot.timeLeft <= 0) harvestCrop(index);
}

function getSelectedSeed() {
    return document.querySelector('input[name="seed"]:checked').value;
}

function plantCrop(lotIndex) {
    const seed = getSelectedSeed();
    if (state.inventory[seed] >= 1) {
        state.inventory[seed] -= 1;
        state.lots[lotIndex] = { type: seed, timeLeft: crops[seed].growTime };
        updateUI();
        renderFarm();
    } else {
        // Replaced alert with our new text warning
        showMessage(`You don't have enough ${crops[seed].name} seeds to plant!`);
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

// Updated sell function to always keep at least 1 seed
function sell(cropType, amount = 1) {
    // Check if selling this amount would drop their inventory below 1
    if (state.inventory[cropType] - amount >= 1) {
        state.inventory[cropType] -= amount;
        state.money += (crops[cropType].sellPrice * amount);
        updateUI();
    } else if (state.inventory[cropType] >= amount) {
        // They have the crop, but selling it would leave them with 0
        showMessage(`You must keep at least 1 ${crops[cropType].name} seed to plant!`);
    } else {
        // They don't have enough to sell at all
        showMessage(`You don't have enough ${crops[cropType].name} to sell!`);
    }
}

// Updated Sell All function to sell everything EXCEPT 1 seed
function sellAll(cropType) {
    // Calculate how many we can sell while leaving exactly 1 behind
    const amountToSell = state.inventory[cropType] - 1;
    
    if (amountToSell > 0) {
        state.inventory[cropType] -= amountToSell;
        state.money += (crops[cropType].sellPrice * amountToSell);
        updateUI();
    } else {
        showMessage(`You must keep at least 1 ${crops[cropType].name} seed to plant!`);
    }
}

function buyLot() {
    if (state.money >= state.lotPrice) {
        state.money -= state.lotPrice;
        state.lots.push(null);
        state.lotPrice = Math.floor(state.lotPrice * 1.2);
        
        // Update the button text to show the new price
        const btn = document.querySelector('button[onclick="buyLot()"]');
        if (btn) btn.innerText = `Buy Empty Lot ($${state.lotPrice})`;
        
        updateUI();
        renderFarm();
    } else {
        // Added the warning when you can't afford a lot
        showMessage("Not enough money to buy an empty lot!");
    }
}

function unlockHops() {
    if (state.money >= 30) {
        state.money -= 30;
        state.hopsUnlocked = true;
        state.inventory.hops += 1; 
        
        // Make sure the sell all button also unlocks
        document.getElementById('sellAllHopsBtn').disabled = false;
        
        showMessage("Hops unlocked! You received 1 starter Hop seed.");
        updateUI();
    } else {
        showMessage("Not enough money to unlock Hops!");
    }
}

// --- Game Loop ---
function startGameLoop() {
    setInterval(() => {
        let needsRender = false;
        state.lots.forEach(lot => {
            if (lot !== null && lot.timeLeft > 0) {
                lot.timeLeft -= 1;
                needsRender = true;
            }
        });
        if (needsRender) renderFarm();
    }, 1000);
}

// Start everything up!
init();