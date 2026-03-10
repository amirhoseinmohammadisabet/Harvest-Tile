// ==========================================
// ui.js - User Interface & Rendering
// ==========================================

// --- Helper: Centralize Global Money ---
function updateGlobalMoney() {
    const globalMoney = document.getElementById('player-money'); // CHANGED THIS LINE
    if (globalMoney) globalMoney.innerText = state.money;
}

// --- Main Tabs ---
function switchTab(tab) {
    const views = ['farm-view', 'shed-view', 'barn-view', 'dukun-view', 'inventory-view'];
    const btns = ['tab-farm', 'tab-shed', 'tab-barn', 'tab-dukun', 'tab-inventory'];

    views.forEach(v => { const el = document.getElementById(v); if(el) el.style.display = 'none'; });
    btns.forEach(b => { const el = document.getElementById(b); if(el) el.style.backgroundColor = '#7f8c8d'; });

    const activeView = document.getElementById(`${tab}-view`);
    const activeBtn = document.getElementById(`tab-${tab}`);
    
    if (activeView) activeView.style.display = 'block';

    if (tab === 'farm') {
        if(activeBtn) activeBtn.style.backgroundColor = '#f39c12';
        updateUI();
        renderFarm();
    } else if (tab === 'shed') {
        if(activeBtn) activeBtn.style.backgroundColor = '#8e44ad';
        updateShedUI();
        renderShedFloor();
    } else if (tab === 'barn') {
        if(activeBtn) activeBtn.style.backgroundColor = '#e67e22';
        updateBarnUI();
        renderBarnFloor();
    } else if (tab === 'dukun') {
        if(activeBtn) activeBtn.style.backgroundColor = '#2ecc71';
        updateDukunUI(); 
    } else if (tab === 'inventory') {
        if(activeBtn) activeBtn.style.backgroundColor = '#2980b9';
        renderInventory();
    }
}

// --- Sub-Tabs ---
window.switchShedTab = function(type) {
    state.activeShedTab = type;
    updateShedTabs();
    const floor = document.getElementById('shed-floor');
    if (floor) floor.innerHTML = ''; 
    renderShedFloor();
};

window.switchBarnTab = function(type) {
    state.activeBarnTab = type;
    updateBarnTabs();
    const floor = document.getElementById('barn-floor');
    if (floor) floor.innerHTML = ''; 
    renderBarnFloor();
};

window.switchDukunTab = function(type) {
    const localView = document.getElementById('dukun-local-view');
    const globalView = document.getElementById('dukun-global-view');
    const localBtn = document.getElementById('dukun-tab-local');
    const globalBtn = document.getElementById('dukun-tab-global');

    if (type === 'local') {
        if(localView) localView.style.display = 'block';
        if(globalView) globalView.style.display = 'none';
        if(localBtn) localBtn.style.backgroundColor = '#e67e22';
        if(globalBtn) globalBtn.style.backgroundColor = '#7f8c8d';
    } else {
        if(localView) localView.style.display = 'none';
        if(globalView) globalView.style.display = 'block';
        if(localBtn) localBtn.style.backgroundColor = '#7f8c8d';
        if(globalBtn) globalBtn.style.backgroundColor = '#2ecc71';
    }
    updateDukunUI();
};

// --- Tab Updaters ---
function updateShedTabs() {
    const tabsContainer = document.getElementById('shed-tabs');
    if (!tabsContainer) return;

    tabsContainer.innerHTML = '';
    Object.keys(machinesData).forEach(type => {
        const mData = machinesData[type];
        const isActive = state.activeShedTab === type;
        const bgColor = isActive ? '#8e44ad' : '#7f8c8d'; 
        tabsContainer.innerHTML += `
            <button onclick="switchShedTab('${type}')" style="background-color: ${bgColor}; font-size: 1rem; padding: 8px 20px; border-radius: 6px;">
                ${mData.icon} ${mData.name}s
            </button>
        `;
    });
    updateArtisanSelector(); 
}

function updateBarnTabs() {
    const tabsContainer = document.getElementById('barn-tabs');
    if (!tabsContainer) return;
    tabsContainer.innerHTML = '';
    Object.keys(animalData).forEach(type => {
        const aData = animalData[type];
        const isActive = state.activeBarnTab === type;
        const bgColor = isActive ? '#e67e22' : '#7f8c8d'; 
        tabsContainer.innerHTML += `
            <button onclick="switchBarnTab('${type}')" style="background-color: ${bgColor}; font-size: 1rem; padding: 8px 20px; border-radius: 6px;">
                ${aData.icon} ${aData.name}s
            </button>
        `;
    });
}

function updateArtisanSelector() {
    const artisanSelector = document.getElementById('artisan-selector-container');
    if (!artisanSelector || !state.activeShedTab) return;

    artisanSelector.innerHTML = '';
    let firstRecipeId = null;

    Object.keys(artisanData).forEach(id => {
        const item = artisanData[id];
        if (item.machine === state.activeShedTab) {
            if (!firstRecipeId) firstRecipeId = id; 
            artisanSelector.innerHTML += `
                <label style="cursor: pointer; padding: 5px 10px; border-radius: 4px; display: inline-block;">
                    <input type="radio" name="artisan-recipe" value="${id}" onchange="updateRecipeInfo()">
                    ${item.icon} ${item.name}
                </label>
            `;
        }
    });

    if (firstRecipeId) {
        const firstRadio = document.querySelector(`input[name="artisan-recipe"][value="${firstRecipeId}"]`);
        if (firstRadio) firstRadio.checked = true;
    }
    updateRecipeInfo();
}

// Generates the core DOM elements once
function generateUI() {
    const seedSelector = document.getElementById('seed-selector-container');
    const unlockContainer = document.getElementById('unlock-buttons-container');
    
    const dukunCrops = document.getElementById('dukun-crops-container');
    const dukunArtisan = document.getElementById('dukun-artisan-container');
    const dukunAnimal = document.getElementById('dukun-animal-container');

    if(seedSelector) seedSelector.className = 'flex-wrap-container';
    if(unlockContainer) unlockContainer.className = 'flex-wrap-container';

    if(seedSelector) seedSelector.innerHTML = '';
    if(unlockContainer) unlockContainer.innerHTML = '';
    if(dukunCrops) dukunCrops.innerHTML = '';
    if(dukunArtisan) dukunArtisan.innerHTML = '';
    if(dukunAnimal) dukunAnimal.innerHTML = '';

    // Crops
    Object.keys(crops).forEach((cropId) => {
        const crop = crops[cropId];
        if(dukunCrops) {
            dukunCrops.innerHTML += `
                <div class="sell-item" id="${cropId}SellDiv">
                    <div style="text-align: center; font-weight: bold; margin-bottom: 5px;">${crop.icon} ${crop.name}</div>
                    <div style="text-align: center; color: #f1c40f; font-weight: bold; margin-bottom: 5px;">Qty: <span id="dukun-qty-${cropId}">0</span></div>
                    <button id="sell${cropId}Btn" onclick="sell('${cropId}', 1)">Sell 1 ($${crop.sellPrice})</button>
                    <button id="sellAll${cropId}Btn" onclick="sellAll('${cropId}')" style="background-color: #e67e22;">Sell All</button>
                </div>
            `;
        }
        if(seedSelector) {
            seedSelector.innerHTML += `
                <label id="${cropId}RadioLabel" style="display:none; cursor: pointer;">
                    <input type="radio" name="seed" value="${cropId}"> ${crop.icon} ${crop.name}
                </label>
            `;
        }
        if (crop.unlockPrice > 0 && unlockContainer) {
            unlockContainer.innerHTML += `
                <button id="buy${cropId}Btn" onclick="unlockCrop('${cropId}')" style="background-color: ${crop.growingColor}; color: #2c3e50;">
                    🔓 Unlock ${crop.name} ($${crop.unlockPrice})
                </button>
            `;
        }
    });

    // Artisan & Animals
    Object.keys(artisanData).forEach(id => {
        const item = artisanData[id];
        const htmlBlock = `
            <div class="sell-item" id="${id}SellDiv">
                <div style="text-align: center; font-weight: bold; margin-bottom: 5px;">${item.icon} ${item.name}</div>
                <div style="text-align: center; color: #f1c40f; font-weight: bold; margin-bottom: 5px;">Qty: <span id="dukun-qty-${id}">0</span></div>
                <button id="sell${id}Btn" onclick="sellArtisan('${id}')">Sell 1 ($${item.sellPrice})</button>
                <button id="sellAll${id}Btn" onclick="sellAllArtisan('${id}')" style="background-color: #e67e22;">Sell All</button>
            </div>
        `;
        if (item.machine === 'animal' || item.id === 'animal_feed' || item.id === 'pulp') {
            if(dukunAnimal) dukunAnimal.innerHTML += htmlBlock;
        } else {
            if(dukunArtisan) dukunArtisan.innerHTML += htmlBlock;
        }
    });

    const wheatRadio = document.querySelector('input[value="wheat"]');
    if (wheatRadio) wheatRadio.checked = true;
}

window.updateRecipeInfo = function() {
    const recipeId = getSelectedArtisan();
    if (!recipeId) return;
    const recipe = artisanData[recipeId];
    const infoSpan = document.getElementById('selected-recipe-info');
    if (infoSpan) infoSpan.innerText = `(Needs ${recipe.inputAmount} ${crops[recipe.input] ? crops[recipe.input].name : artisanData[recipe.input].name})`;
}

// -----------------------------------------------------
// UPDATERS (Run frequently to keep UI fresh)
// -----------------------------------------------------

function updateUI() {
    updateGlobalMoney();

    const buyLotBtn = document.querySelector('button[onclick="buyLot()"]');
    if (buyLotBtn) buyLotBtn.innerText = `Buy Empty Lot ($${state.lotPrice})`;

    Object.keys(crops).forEach(cropId => {
        const radioLabel = document.getElementById(`${cropId}RadioLabel`);
        const unlockBtn = document.getElementById(`buy${cropId}Btn`);
        
        if (state.unlockedCrops[cropId]) {
            if (radioLabel) radioLabel.style.display = 'inline';
            if (unlockBtn) unlockBtn.style.display = 'none';
        } else {
            if (radioLabel) radioLabel.style.display = 'none';
            if (unlockBtn) unlockBtn.style.display = 'inline-block';
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

    const invView = document.getElementById('inventory-view');
    const dukunView = document.getElementById('dukun-view');
    if (invView && invView.style.display === 'block') renderInventory();
    if (dukunView && dukunView.style.display === 'block') updateDukunUI();
}

function updateShedUI() {
    updateGlobalMoney();
    if (!state.shedUnlocked) return;
    document.getElementById('shed-locked').style.display = 'none';
    document.getElementById('shed-unlocked').style.display = 'block';

    const storeDiv = document.getElementById('shed-store-container');
    if (storeDiv && storeDiv.children.length === 0) {
        storeDiv.innerHTML = '';
        Object.keys(machinesData).forEach(id => {
            const m = machinesData[id];
            const currentPrice = state.machinePrices[id];
            storeDiv.innerHTML += `
                <button onclick="buyMachine('${id}')" style="background-color: #9b59b6; color: white;">
                    Buy ${m.icon} ${m.name} ($${currentPrice})
                </button>
            `;
        });
    }
    updateShedTabs();
}

function updateBarnUI() {
    updateGlobalMoney();
    if (!state.barnUnlocked) return;
    document.getElementById('barn-locked').style.display = 'none';
    document.getElementById('barn-unlocked').style.display = 'block';

    const feedCount = document.getElementById('barn-feed-count');
    if (feedCount) feedCount.innerText = state.inventory['animal_feed'] || 0;

    const storeDiv = document.getElementById('barn-store-container');
    if (storeDiv && storeDiv.children.length === 0) {
        storeDiv.innerHTML = '';
        Object.keys(animalData).forEach(id => {
            const a = animalData[id];
            const currentPrice = state.animalPrices[id];
            storeDiv.innerHTML += `
                <button onclick="buyAnimal('${id}')" style="background-color: #d35400; color: white;">
                    Buy ${a.icon} ${a.name} ($${currentPrice})
                </button>
            `;
        });
    }
    updateBarnTabs();
}

function updateDukunUI() {
    updateGlobalMoney();

    // 1. Update the Local Sell Buttons
    Object.keys(crops).forEach(cropId => {
        const qtySpan = document.getElementById(`dukun-qty-${cropId}`);
        if (qtySpan) qtySpan.innerText = state.inventory[cropId] || 0;

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

    Object.keys(artisanData).forEach(id => {
        const qtySpan = document.getElementById(`dukun-qty-${id}`);
        if (qtySpan) qtySpan.innerText = state.inventory[id] || 0;

        const isLow = (state.inventory[id] <= 0); 
        const sellBtn = document.getElementById(`sell${id}Btn`);
        const sellAllBtn = document.getElementById(`sellAll${id}Btn`);
        if (sellBtn) sellBtn.disabled = isLow;
        if (sellAllBtn) sellAllBtn.disabled = isLow;
    });

    // 2. Populate the Global P2P Dropdown dynamically!
    const p2pSelect = document.getElementById('sell-crop-select');
    if (p2pSelect) {
        const currentSelection = p2pSelect.value; 
        p2pSelect.innerHTML = '';
        
        const allItems = { ...crops, ...artisanData };
        let hasItems = false;

        Object.keys(allItems).forEach(id => {
            // Only let them sell things they actually have!
            const amountOwned = state.inventory[id] || 0;
            // Prevent selling the very last seed for crops
            const minKeep = crops[id] ? 1 : 0; 

            if (amountOwned > minKeep) {
                hasItems = true;
                const availableToSell = amountOwned - minKeep;
                p2pSelect.innerHTML += `<option value="${id}">${allItems[id].icon} ${allItems[id].name} (Available: ${availableToSell})</option>`;
            }
        });

        if (!hasItems) {
            p2pSelect.innerHTML = `<option value="">Your inventory is empty!</option>`;
        } else if (currentSelection) {
            // Try to keep their selection if they just refreshed the UI
            p2pSelect.value = currentSelection;
        }
    }
}

// -----------------------------------------------------
// RENDERERS (Drawing Grids)
// -----------------------------------------------------

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
            const timeString = formatTime(secondsLeft);
            
            if (secondsLeft > 0) {
                tile.className = 'lot';
                const readyCol = crops[lot.type].readyColor;
                tile.style.background = `linear-gradient(to top, ${readyCol} ${percentage}%, #34495e ${percentage}%)`;
                tile.style.borderColor = readyCol;
                tile.innerHTML = `
                    <div style="font-size: 1.2rem; margin-bottom: 5px;">${crops[lot.type].icon}</div>
                    <div style="font-size: 0.9rem; font-weight: bold;">${crops[lot.type].name}</div>
                    <div style="font-size: 0.8em; margin-top: 5px; color: white;">⏳ ${timeString}</div>
                `;
            } else {
                tile.className = 'lot';
                tile.style.background = '#27ae60'; 
                tile.style.borderColor = '#2ecc71';
                tile.innerHTML = `
                    <div style="font-size: 1.5rem; margin-bottom: 5px;">${crops[lot.type].icon}</div>
                    <div style="font-weight: bold; font-size: 1rem;">${crops[lot.type].name}</div>
                    <div style="font-size: 0.9rem; font-weight: bold; margin-top: 2px;">✔️ Ready!</div>
                `;
            }
        }
    });
}

function renderShedFloor() {
    if(document.getElementById('shed-view').style.display === 'none') return;
    const floor = document.getElementById('shed-floor');
    if(!floor) return;

    if (state.machines.length === 0) {
        floor.innerHTML = '<p style="color: #bdc3c7;">Your shed is empty! Buy a machine from the store above.</p>';
        return;
    }

    const visibleMachines = state.machines.map((machine, index) => ({ machine, index })).filter(item => item.machine.type === state.activeShedTab);

    if (visibleMachines.length === 0) {
        floor.innerHTML = `<p style="color: #bdc3c7;">You don't have any ${machinesData[state.activeShedTab].name}s yet!</p>`;
        return;
    }

    if (floor.children.length !== visibleMachines.length || floor.children[0].tagName === 'P') {
        floor.innerHTML = '';
        visibleMachines.forEach((item) => {
            const card = document.createElement('div');
            card.id = `machine-${item.index}`; 
            floor.appendChild(card);
        });
    }

    const now = Date.now();
    visibleMachines.forEach((item) => {
        const machine = item.machine;
        const originalIndex = item.index;
        const card = document.getElementById(`machine-${originalIndex}`);
        if (!card) return;

        const mData = machinesData[machine.type];

        if (!machine.isProcessing && !machine.isReady) {
            card.className = 'lot machine-empty'; 
            card.style.background = '#34495e';
            card.style.borderColor = '#7f8c8d';
            card.innerHTML = `
                <div style="font-size: 2rem; margin-bottom: 5px;">${mData.icon}</div>
                <div style="font-weight: bold; font-size: 1rem;">${mData.name}</div>
                <div style="font-size: 0.8rem; margin-top: 5px; color: #bdc3c7;">Click to Load</div>
            `;
            card.onclick = () => loadMachine(originalIndex); 

        } else if (machine.isProcessing && !machine.isReady) {
            const recipe = artisanData[machine.recipe];
            const cropSource = crops[recipe.input] || artisanData[recipe.input];
            const totalProcessTime = recipe.processTime * 1000;
            const timeRemaining = machine.finishTime - now;
            const timeElapsed = totalProcessTime - timeRemaining;

            let percentage = (timeElapsed / totalProcessTime) * 100;
            if (percentage > 100) percentage = 100;
            if (percentage < 0) percentage = 0;

            const secondsLeft = Math.ceil(timeRemaining / 1000);
            const timeString = formatTime(secondsLeft);
            const rColor = cropSource.readyColor || '#e67e22';

            card.className = 'lot working-machine'; 
            card.style.background = `linear-gradient(to top, ${rColor} ${percentage}%, #34495e ${percentage}%)`;
            card.style.borderColor = rColor;
            card.innerHTML = `
                <div style="font-size: 1.5rem; margin-bottom: 5px;">${recipe.icon}</div>
                <div style="font-weight: bold; font-size: 0.9rem;">${recipe.name}</div>
                <div style="font-size: 0.8rem; margin-top: 5px; color: white;">⏳ ${timeString}</div>
            `;
            card.onclick = null; 

        } else if (machine.isReady) {
            const recipe = artisanData[machine.recipe];
            card.className = 'lot ready-machine'; 
            card.style.background = '#27ae60';
            card.style.borderColor = '#2ecc71';
            card.innerHTML = `
                <div style="font-size: 1.5rem; margin-bottom: 5px;">${recipe.icon}</div>
                <div style="font-weight: bold; font-size: 0.9rem;">${recipe.name}</div>
                <div style="font-size: 0.8rem; margin-top: 5px;">✔️ Ready!</div>
            `;
            card.onclick = () => collectMachine(originalIndex); 
        }
    });
}

function renderBarnFloor() {
    if(document.getElementById('barn-view').style.display === 'none') return;
    const floor = document.getElementById('barn-floor');
    if(!floor) return;

    if (state.animals.length === 0) {
        floor.innerHTML = '<p style="color: #bdc3c7;">Your barn is empty! Buy an animal from the market above.</p>';
        return;
    }

    const visibleAnimals = state.animals.map((animal, index) => ({ animal, index })).filter(item => item.animal.type === state.activeBarnTab);

    if (visibleAnimals.length === 0) {
        floor.innerHTML = `<p style="color: #bdc3c7;">You don't have any ${animalData[state.activeBarnTab].name}s yet!</p>`;
        return;
    }

    if (floor.children.length !== visibleAnimals.length || floor.children[0].tagName === 'P') {
        floor.innerHTML = '';
        visibleAnimals.forEach((item) => {
            const card = document.createElement('div');
            card.id = `animal-${item.index}`; 
            floor.appendChild(card);
        });
    }

    const now = Date.now();
    visibleAnimals.forEach((item) => {
        const animal = item.animal;
        const originalIndex = item.index;
        const card = document.getElementById(`animal-${originalIndex}`);
        if (!card) return;

        const aData = animalData[animal.type];

        if (!animal.isProcessing && !animal.isReady) {
            card.className = 'lot machine-empty'; 
            card.style.background = '#34495e';
            card.style.borderColor = '#7f8c8d';
            card.innerHTML = `
                <div style="font-size: 2rem; margin-bottom: 5px;">${aData.icon}</div>
                <div style="font-weight: bold; font-size: 1rem;">${aData.name}</div>
                <div style="font-size: 0.8rem; margin-top: 5px; color: #f39c12;">Feed: ${aData.feedAmount} 🌾</div>
            `;
            card.onclick = () => feedAnimal(originalIndex); 

        } else if (animal.isProcessing && !animal.isReady) {
            const totalProcessTime = aData.processTime * 1000;
            const timeRemaining = animal.finishTime - now;
            const timeElapsed = totalProcessTime - timeRemaining;

            let percentage = (timeElapsed / totalProcessTime) * 100;
            if (percentage > 100) percentage = 100;
            if (percentage < 0) percentage = 0;

            const secondsLeft = Math.ceil(timeRemaining / 1000);
            const timeString = formatTime(secondsLeft);

            card.className = 'lot working-machine'; 
            card.style.background = `linear-gradient(to top, #e67e22 ${percentage}%, #34495e ${percentage}%)`;
            card.style.borderColor = '#e67e22';
            card.innerHTML = `
                <div style="font-size: 1.5rem; margin-bottom: 5px;">${aData.icon}</div>
                <div style="font-weight: bold; font-size: 0.9rem;">Eating...</div>
                <div style="font-size: 0.8rem; margin-top: 5px; color: white;">⏳ ${timeString}</div>
            `;
            card.onclick = null; 

        } else if (animal.isReady) {
            const outputObj = artisanData[aData.output];
            card.className = 'lot ready-machine'; 
            card.style.background = '#27ae60';
            card.style.borderColor = '#2ecc71';
            card.innerHTML = `
                <div style="font-size: 1.5rem; margin-bottom: 5px;">${outputObj.icon}</div>
                <div style="font-weight: bold; font-size: 0.9rem;">${outputObj.name}</div>
                <div style="font-size: 0.8rem; margin-top: 5px;">✔️ Ready!</div>
            `;
            card.onclick = () => collectAnimal(originalIndex); 
        }
    });
}

function renderInventory() {
    const rawContainer = document.getElementById('inventory-raw');
    const artisanContainer = document.getElementById('inventory-artisan');
    if (!rawContainer || !artisanContainer) return;

    rawContainer.innerHTML = '';
    artisanContainer.innerHTML = '';

    Object.keys(crops).forEach(id => {
        const item = crops[id];
        const count = state.inventory[id] || 0;
        if (state.unlockedCrops[id] || count > 0) {
            rawContainer.innerHTML += `
                <div style="background: #34495e; padding: 15px; border-radius: 8px; text-align: center; border: 2px solid ${item.growingColor}; min-width: 110px;">
                    <div style="font-size: 2.5rem; margin-bottom: 5px;">${item.icon}</div>
                    <div style="font-weight: bold; font-size: 1rem;">${item.name}</div>
                    <div style="font-size: 1.3rem; color: #f1c40f; margin-top: 5px; font-weight: bold;">${count}</div>
                </div>
            `;
        }
    });

    Object.keys(artisanData).forEach(id => {
        const item = artisanData[id];
        const count = state.inventory[id] || 0;
        if (state.shedUnlocked || state.barnUnlocked || count > 0) {
            artisanContainer.innerHTML += `
                <div style="background: #34495e; padding: 15px; border-radius: 8px; text-align: center; border: 2px solid #9b59b6; min-width: 110px;">
                    <div style="font-size: 2.5rem; margin-bottom: 5px;">${item.icon}</div>
                    <div style="font-weight: bold; font-size: 1rem;">${item.name}</div>
                    <div style="font-size: 1.3rem; color: #f1c40f; margin-top: 5px; font-weight: bold;">${count}</div>
                </div>
            `;
        }
    });
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