/**
 * Matatu Card Game - JavaScript Implementation
 *
 * Changelog v4:
 * - Fixed Joker counter rule: Any Joker can now counter another Joker penalty.
 * - Retained previous fixes (Joker suit req, Ref 7, A♠ block, etc.)
 */

// --- Game State ---
const gameState = {
    deck: [], discardPile: [], playerHand: [], aiHand: [],
    currentPlayer: 'player', referenceSuit: null, currentSuit: null, currentValue: null,
    requiredColor: null, // Set after Joker is played
    pendingPenalty: { type: null, amount: 0, suit: null, color: null },
    gameStatus: 'notStarted', // 'notStarted', 'inProgress', 'playerWin', 'aiWin', 'draw', 'error', 'counting'
    lastCardPlayed: null, lastCardIndex: null, playerHasDrawn: false, aiPlayedAgainCount: 0,
    playAnyCardNext: false, // Flag after A-spades block
    suitSymbols: { 'Hearts': '♥', 'Diamonds': '♦', 'Clubs': '♣', 'Spades': '♠' },
    recentCards: [],
};

// --- DOM Elements Cache ---
const domElements = {};

function cacheDOMElements() {
    const ids = [
        'start-screen', 'game-screen', 'start-button', 'show-rules-button',
        'rules-modal', 'close-rules', 'in-game-rules', 'player-hand', 'ai-hand',
        'discard-pile', 'deck', 'deck-count', 'ai-card-count', 'player-card-count',
        'skip-turn', 'new-game', 'game-status', 'player-turn', 'computer-turn',
        'reference-suit', 'temporary-suit', 'ace-modal', 'penalty-display',
        'pending-penalty', 'count-display', 'gameOver-modal', 'gameOver-title',
        'winner-message', 'new-game-modal', 'recent-cards-display'
    ];
    ids.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            domElements[id.replace(/-([a-z])/g, g => g[1].toUpperCase())] = element;
        } else {
            console.warn(`Element with ID #${id} not found.`);
        }
    });
    domElements.suitOptions = document.querySelectorAll('.suit-option');
    if (!domElements.startButton) console.error("Start button #start-button not found.");
    if (!domElements.gameScreen) console.error("Game screen #game-screen not found.");
}

// --- Constants ---
const cardValues = { '2': 20, '3': 30, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 13, 'Q': 12, 'K': 14, 'A': 11 };
const penaltyValues = { '2': 2, '3': 3, 'joker': 5 };

// --- Initialization ---
function initGame() {
    cacheDOMElements();
    setupEventListeners();
    if (domElements.startScreen) domElements.startScreen.style.display = 'flex';
    if (domElements.gameScreen) domElements.gameScreen.classList.remove('visible');
    if (domElements.gameOverModal) domElements.gameOverModal.classList.remove('visible');
    if (domElements.rulesModal) domElements.rulesModal.classList.remove('visible');
    if (domElements.aceModal) domElements.aceModal.classList.remove('visible');
}

function setupEventListeners() {
    const addSafeListener = (element, event, handler, logName) => {
        if (element) { element.addEventListener(event, handler); }
        else { console.error(`Cannot add listener: ${logName} element not found.`); }
    };
    addSafeListener(domElements.startButton, 'click', handleStartButtonClick, 'Start button');
    addSafeListener(domElements.showRulesButton, 'click', showRules, 'Show Rules button');
    addSafeListener(domElements.closeRules, 'click', hideRules, 'Close Rules button');
    addSafeListener(domElements.inGameRules, 'click', showRules, 'In-Game Rules button');
    addSafeListener(domElements.skipTurn, 'click', handleSkipTurnClick, 'Skip Turn button');
    addSafeListener(domElements.newGame, 'click', handleNewGameClick, 'New Game button');
    addSafeListener(domElements.newGameModal, 'click', handleNewGameClick, 'Modal New Game button');
    addSafeListener(domElements.deck, 'click', handleDeckClick, 'Deck');

    if (domElements.suitOptions && domElements.suitOptions.length > 0) {
        domElements.suitOptions.forEach(option => option.addEventListener('click', (e) => handleSuitOptionClick(e.target.getAttribute('data-suit'))));
    } else { console.warn("Suit option elements not found."); }

    window.addEventListener('click', (event) => {
        if (domElements.rulesModal && event.target === domElements.rulesModal) hideRules();
        if (domElements.aceModal && event.target === domElements.aceModal) hideAceSuitSelection();
        if (domElements.gameOverModal && event.target === domElements.gameOverModal) domElements.gameOverModal.classList.remove('visible');
    });
}

// --- Game Flow Control ---
function handleStartButtonClick() {
    console.log("Start button clicked - Calling startGame()..."); try { startGame(); } catch (error) { console.error("Error during startGame():", error); updateGameStatus("Error starting game. Check console.", true); }
}
function handleSkipTurnClick() {
    console.log("Skip turn / Allow AI to play button clicked"); if (gameState.currentPlayer === 'player' && gameState.playerHasDrawn) { updateGameStatus('You chose not to play. AI\'s turn.'); gameState.playerHasDrawn = false; if(domElements.skipTurn) domElements.skipTurn.style.display = 'none'; switchTurn(); } else { console.warn("Skip turn button clicked inappropriately."); }
}
function handleNewGameClick() {
    console.log("New game button clicked"); if (domElements.gameOverModal) domElements.gameOverModal.classList.remove('visible'); startGame();
}
function showRules() {
    console.log("Showing rules"); if (domElements.rulesModal) domElements.rulesModal.classList.add('visible');
}
function hideRules() {
    console.log("Hiding rules"); if (domElements.rulesModal) domElements.rulesModal.classList.remove('visible');
}

function startGame() {
    console.log("--- Starting New Game ---");
    Object.assign(gameState, { deck: [], discardPile: [], playerHand: [], aiHand: [], currentPlayer: 'player', referenceSuit: null, currentSuit: null, currentValue: null, requiredColor: null, pendingPenalty: { type: null, amount: 0, suit: null, color: null }, gameStatus: 'inProgress', lastCardPlayed: null, lastCardIndex: null, playerHasDrawn: false, aiPlayedAgainCount: 0, playAnyCardNext: false, recentCards: [] });
    // UI Reset
    if (domElements.playerHand) domElements.playerHand.innerHTML = '';
    if (domElements.aiHand) domElements.aiHand.innerHTML = '';
    if (domElements.discardPile) { domElements.discardPile.innerHTML = ''; domElements.discardPile.classList.remove('has-card'); }
    if (domElements.skipTurn) domElements.skipTurn.style.display = 'none';
    if (domElements.penaltyDisplay) domElements.penaltyDisplay.classList.remove('visible');
    if (domElements.temporarySuit) domElements.temporarySuit.style.display = 'none';
    if (domElements.recentCardsDisplay) domElements.recentCardsDisplay.innerHTML = '<span class="recent-cards-label">Recent:</span>';
    hideAceSuitSelection();
    if (domElements.gameOverModal) domElements.gameOverModal.classList.remove('visible');

    createDeck(); shuffleDeck(); selectReferenceSuit(); dealCards();

    if (!setupInitialDiscard()) { console.error("Failed to set up initial discard pile."); updateGameStatus("Error: Could not find valid starting card. Try again.", true); gameState.gameStatus = 'error'; return; }

    gameState.currentPlayer = Math.random() < 0.5 ? 'player' : 'ai';
    console.log(` Starting player: ${gameState.currentPlayer}`);

    if (domElements.startScreen) domElements.startScreen.style.display = 'none';
    if (domElements.gameScreen) { domElements.gameScreen.style.display = 'block'; setTimeout(() => domElements.gameScreen.classList.add('visible'), 50); }

    updateTurnIndicator(); updateCardCounts(); updateDeckCount(); updatePenaltyDisplay(); renderRecentCards();

    if (gameState.currentPlayer === 'ai') { updateGameStatus("AI starts the game."); setTimeout(aiTurn, 1200); }
    else { updateGameStatus("Your turn to start."); highlightPlayableCards(); }
    console.log("--- Game Started Successfully ---");
}

// --- Card Handling & Deck Management ---
function createDeck() {
    const suits = ['Hearts', 'Diamonds', 'Clubs', 'Spades']; const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']; gameState.deck = []; for (const suit of suits) { for (const value of values) { const color = (suit === 'Hearts' || suit === 'Diamonds') ? 'red' : 'black'; let numericValue = cardValues[value] || 0; if (value === 'A' && suit === 'Spades') numericValue = 60; gameState.deck.push({ suit, value, color, isJoker: false, jokerColor: null, numericValue }); } } gameState.deck.push({ suit: null, value: 'Joker', color: 'red', isJoker: true, jokerColor: 'red', numericValue: 50 }); gameState.deck.push({ suit: null, value: 'Joker', color: 'black', isJoker: true, jokerColor: 'black', numericValue: 50 });
}
function shuffleDeck() {
    let deck = gameState.deck; for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[deck[i], deck[j]] = [deck[j], deck[i]]; }
}
function selectReferenceSuit() {
    const suits = ['Hearts', 'Diamonds', 'Clubs', 'Spades']; gameState.referenceSuit = suits[Math.floor(Math.random() * suits.length)]; console.log(` Reference suit: ${gameState.referenceSuit}`); if(domElements.referenceSuit) { const el = domElements.referenceSuit; el.textContent = `${gameState.suitSymbols[gameState.referenceSuit]} ${gameState.referenceSuit}`; el.className = 'reference-suit'; // Use base class
    if (gameState.referenceSuit === 'Clubs' || gameState.referenceSuit === 'Spades') el.classList.add('black-suit-bold'); }
}
function dealCards() {
    for (let i = 0; i < 7; i++) { if (gameState.deck.length > 0) gameState.playerHand.push(gameState.deck.pop()); if (gameState.deck.length > 0) gameState.aiHand.push(gameState.deck.pop()); } renderPlayerHand(); renderAIHand();
}
function setupInitialDiscard() {
    let attempts = 0; const maxAttempts = gameState.deck.length + 5;
    while (attempts < maxAttempts) {
        if (gameState.deck.length === 0) { if (gameState.discardPile.length > 0) { console.warn(" Deck empty, trying reshuffle..."); const top = gameState.discardPile.pop(); if (reshuffleDiscardPile()) { gameState.discardPile.push(top); } else { gameState.discardPile.push(top); return false; } } else { return false; } }
        let card = gameState.deck.pop();
        const isSpecial = ['2', '3', '8', 'J', 'A'].includes(card.value) || card.isJoker || (card.value === '7' && card.suit === gameState.referenceSuit);
        if (!isSpecial) { gameState.discardPile.push(card); gameState.currentSuit = card.suit; gameState.currentValue = card.value; gameState.requiredColor = null; console.log(` -> Initial discard: ${card.value} of ${card.suit}`); updateDiscardPile(); return true; }
        else { gameState.deck.unshift(card); shuffleDeck(); }
        attempts++;
    }
    console.error(` Failed discard setup after ${attempts} attempts.`); return false;
}
function drawCard(player) {
    if (gameState.deck.length === 0) { if (!reshuffleDiscardPile()) { updateGameStatus("No cards left to draw!", true); return null; } } if (gameState.deck.length === 0) { updateGameStatus("No cards left to draw!", true); return null; } const card = gameState.deck.pop(); if (player === 'player') { gameState.playerHand.push(card); renderPlayerHand(); } else { gameState.aiHand.push(card); renderAIHand(); } updateDeckCount(); updateCardCounts(); console.log(` ${player} drew: ${card.value} ${card.suit || card.jokerColor}`); return card;
}
function reshuffleDiscardPile() {
    console.log(" Reshuffling discard pile..."); if (gameState.discardPile.length <= 1) { console.log(" Not enough cards."); return false; } const topCard = gameState.discardPile.pop(); gameState.deck = gameState.discardPile; gameState.discardPile = [topCard]; shuffleDeck(); updateDeckCount(); console.log(` Reshuffled ${gameState.deck.length} cards.`); return true;
}

// --- Recent Cards ---
function addToRecentCards(card) {
    gameState.recentCards.unshift({ value: card.value, suit: card.suit, color: card.color, isJoker: card.isJoker, jokerColor: card.jokerColor });
    if (gameState.recentCards.length > 5) gameState.recentCards.pop();
    renderRecentCards();
}
function renderRecentCards() {
    if (!domElements.recentCardsDisplay) return;
    const display = domElements.recentCardsDisplay;
    display.innerHTML = '<span class="recent-cards-label">Recent:</span>';
    gameState.recentCards.slice().reverse().forEach(card => {
        const cardEl = document.createElement('span');
        cardEl.className = 'recent-card-small';
        const suitSymbol = card.suit ? gameState.suitSymbols[card.suit] : '';
        const colorClass = card.isJoker ? card.jokerColor : (card.color || '');
        let valueDisplay = card.value === 'Joker' ? 'JK' : (card.value || '');
        if (valueDisplay === '10') valueDisplay = 'T';
        else if (valueDisplay.length > 1 && valueDisplay !== 'JK') valueDisplay = valueDisplay.slice(0,1);

        cardEl.classList.add(colorClass);
        if (card.suit) cardEl.classList.add(card.suit.toLowerCase());

        cardEl.innerHTML = `<span class="value">${valueDisplay}</span>${card.suit ? `<span class="suit">${suitSymbol}</span>` : ''}`;
        display.appendChild(cardEl);
    });
}

// --- Player Actions ---
function handlePlayerCardClick(index) {
    if (gameState.currentPlayer !== 'player' || gameState.gameStatus !== 'inProgress') return; const card = gameState.playerHand[index]; console.log(`Player clicked card [${index}]: ${card.value} of ${card.suit || card.jokerColor}`);

    if (isCardPlayable(card, 'player')) {
        gameState.lastCardPlayed = card;
        gameState.lastCardIndex = index;
        const isAceNeedingSelection = card.value === 'A' && !(card.suit === 'Spades' && gameState.pendingPenalty.type);
        if (isAceNeedingSelection) {
            console.log(" Ace needs suit selection.");
            showAceSuitSelection();
        } else {
            playCard(index);
        }
    } else {
        // Check if it was a blocked Ref 7 attempt before showing generic message
        if (!(card.value === '7' && card.suit === gameState.referenceSuit && calculateCardSum(gameState.playerHand.filter((c, i) => i !== index)) >= 30)) {
           updateGameStatus("This card is not playable.");
        }
        console.log(" Card not playable.");
        addShakeAnimation(domElements.playerHand?.children[index]);
    }
}
function handleDeckClick() {
    if (gameState.currentPlayer !== 'player' || gameState.gameStatus !== 'inProgress') return; console.log("Player clicked deck."); if (gameState.pendingPenalty.type) { updateGameStatus(`Drawing ${gameState.pendingPenalty.amount} penalty cards.`); console.log(` Player accepts penalty: ${gameState.pendingPenalty.amount}`); const amount = gameState.pendingPenalty.amount; clearPenalty(); for (let i = 0; i < amount; i++) { if (!drawCard('player')) break; } switchTurn(); return; } if (gameState.playerHasDrawn) { updateGameStatus("Already drawn. Play or allow AI."); return; } const drawn = drawCard('player'); if (drawn) { gameState.playerHasDrawn = true; const canPlay = gameState.playerHand.some(card => isCardPlayable(card, 'player'));
    if (canPlay) { updateGameStatus("Drew. Play or allow AI."); if(domElements.skipTurn) domElements.skipTurn.style.display = 'block'; highlightPlayableCards(); } else { updateGameStatus("Drew. No playable cards. AI's turn."); if(domElements.skipTurn) domElements.skipTurn.style.display = 'none'; setTimeout(switchTurn, 1000); } } else { updateGameStatus("No cards to draw."); const canPlay = gameState.playerHand.some(card => isCardPlayable(card, 'player'));
    if (!canPlay) { updateGameStatus("No cards & no play. AI's turn."); setTimeout(switchTurn, 1000); } else { updateGameStatus("No cards, but can play."); highlightPlayableCards(); } }
}
function handleSuitOptionClick(suit) {
    console.log(`Player selected suit: ${suit}`); hideAceSuitSelection(); if (gameState.lastCardPlayed && gameState.lastCardIndex !== null) {
    playCard(gameState.lastCardIndex, suit);
    } else { console.error("Suit selected but no card stored."); } gameState.lastCardPlayed = null; gameState.lastCardIndex = null;
}

// --- Core Game Logic ---

/**
 * Checks if a card is playable according to game rules.
 * @param {object} card The card object to check.
 * @param {string} playerContext 'player' or 'ai'. Used for A♠ block check.
 * @returns {boolean} True if the card is playable, false otherwise.
 */
function isCardPlayable(card, playerContext) {
    const topCard = gameState.discardPile.length > 0 ? gameState.discardPile[gameState.discardPile.length - 1] : null;
    const penalty = gameState.pendingPenalty;

    // 0. Check for A♠ block state (Play Any Card)
    if (gameState.playAnyCardNext && gameState.currentPlayer === playerContext) {
        console.log(`A♠ Block Active: Allowing any card play for ${playerContext}`);
        return true;
    }

    // 1. Check Penalty Counters
    if (penalty.type) {
        if (card.value === 'A' && card.suit === 'Spades') return true; // A♠ always counters

        if (penalty.type === 'joker') {
            // Counter Joker with: ANY Joker OR same color 2/3
            return (card.isJoker) || // *** CHANGED: Any Joker counters a Joker ***
                   ((card.value === '2' || card.value === '3') && card.color === penalty.color);
        }
        if (penalty.type === '2' || penalty.type === '3') {
            // Counter 2/3 with: Same value/suit 2/3 OR same color Joker
            return (card.value === '2' && penalty.type === '2') ||
                   (card.value === '3' && penalty.type === '3') ||
                   (card.value === '3' && penalty.type === '2' && card.suit === penalty.suit) ||
                   (card.value === '2' && penalty.type === '3' && card.suit === penalty.suit) ||
                   (card.isJoker && card.jokerColor === penalty.color);
        }
        return false; // Cannot counter otherwise
    }

    // 2. Check Joker Color Requirement (after Joker follow-up)
    if (gameState.requiredColor) {
        const cardColor = card.isJoker ? card.jokerColor : card.color;
        // Must match required color OR be an Ace
        if (cardColor === gameState.requiredColor) return true;
        if (card.value === 'A') return true;
        return false;
    }

    // 3. Normal Play (no penalty, no required color, not A♠ block state)
    if (!topCard) return true; // Can play anything if discard is empty

    // 3a. Check Ace Suit Requirement (if active from previous non-Spades Ace)
    const aceSuitRequirementActive = gameState.currentSuit && !gameState.requiredColor && topCard?.value === 'A' && topCard?.suit !== 'Spades';
    if (aceSuitRequirementActive) {
        if (card.suit === gameState.currentSuit) return true; // Match required suit
        if (card.value === 'A' && card.suit === 'Spades') return true; // A♠ is playable
        if (card.isJoker) return true; // Any Joker is playable
        console.log(`Ace requirement active (Suit: ${gameState.currentSuit}). Card ${card.value} ${card.suit || card.jokerColor} is not valid.`);
        return false;
    }

    // 3b. Joker Play Rules (if not under Ace requirement)
    if (card.isJoker) {
        if (topCard.isJoker) {
            return card.jokerColor === topCard.jokerColor; // Match Joker color
        } else {
            return card.jokerColor === topCard.color; // Match suit color
        }
    }

    // 3c. Ace Play Rules (if not under Ace requirement)
    if (card.value === 'A') {
        return true; // Any Ace playable if no specific req active
    }

    // 3d. Standard Match (if not under Ace req, not Joker, not Ace)
    return card.suit === gameState.currentSuit || card.value === gameState.currentValue;
}


function playCard(index, selectedSuit = null) {
    const player = gameState.currentPlayer;
    const hand = player === 'player' ? gameState.playerHand : gameState.aiHand;

    if (index < 0 || index >= hand.length) { console.error(`Invalid card index ${index} for ${player}`); return; }
    const card = hand[index];

    // --- Pre-play checks ---
    // Check Ref 7 restriction
    if (card.value === '7' && card.suit === gameState.referenceSuit) {
        const sumOther = calculateCardSum(hand.filter((c, i) => i !== index));
        if (sumOther >= 30) {
            console.log(` Blocked ref 7 play for ${player} (Sum: ${sumOther}).`);
            if (player === 'player') {
                updateGameStatus("Cannot play Ref 7: Hand sum >= 30.", false); // Temporary message
                addShakeAnimation(domElements.playerHand?.children[index]);
            } else {
                console.error("AI attempted invalid Ref 7 play!");
            }
            return; // Stop this specific card play attempt
        }
    }

    // --- Play the card ---
    console.log(`${player} plays: ${card.value} of ${card.suit || card.jokerColor}${selectedSuit ? ` (selected ${selectedSuit})` : ''}`);
    hand.splice(index, 1);
    gameState.discardPile.push(card);
    gameState.currentValue = card.value;
    gameState.requiredColor = null;
    gameState.playAnyCardNext = false;
    hideTemporarySuit();

    let turnResult = handleCardEffect(card);

    // --- Set Suit/Color for Next Turn ---
    let needsSuitSelection = false;
    if (turnResult === 'blocked_penalty') {
        gameState.currentSuit = null;
        gameState.currentValue = null;
        gameState.requiredColor = null;
        gameState.playAnyCardNext = true;
        console.log("A♠ blocked, next player plays any card.");
    } else {
        if (card.value === 'A') {
            if (selectedSuit) {
                gameState.currentSuit = selectedSuit; showTemporarySuit(selectedSuit);
            } else if (player === 'ai') {
                const aiChosenSuit = aiSelectSuitForAce(); gameState.currentSuit = aiChosenSuit; showTemporarySuit(aiChosenSuit); console.log(`AI played Ace, chose ${aiChosenSuit}`);
            } else {
                gameState.currentSuit = null;
                needsSuitSelection = true;
            }
            gameState.currentValue = 'A';
        } else if (card.isJoker) {
            gameState.requiredColor = card.jokerColor;
            showTemporarySuit(card.jokerColor === 'red' ? 'Red' : 'Black');
            gameState.currentSuit = null;
            gameState.currentValue = 'Joker';
        } else {
            gameState.currentSuit = card.suit;
            gameState.currentValue = card.value;
        }
    }

    addToRecentCards(card);

    if (player === 'player') renderPlayerHand(); else renderAIHand();
    updateDiscardPile(); updateCardCounts(); updateDeckCount(); updatePenaltyDisplay();

    if (needsSuitSelection && player === 'player') {
         showAceSuitSelection();
         return;
    }

    if (hand.length === 0) {
        gameState.gameStatus = player === 'player' ? 'playerWin' : 'aiWin'; endGame(`played last card (${card.value} ${card.suit || card.jokerColor}).`); return;
    }

    if (player === 'player') gameState.playerHasDrawn = false; else gameState.aiPlayedAgainCount = 0;
    if(domElements.skipTurn) domElements.skipTurn.style.display = 'none';

    // --- Turn Switching Logic ---
    if (turnResult === 'play_again') {
        updateGameStatus(`${player === 'player' ? 'You play' : 'AI plays'} again!`); console.log(` ${player} plays again.`); if (player === 'ai') { gameState.aiPlayedAgainCount++; if (gameState.aiPlayedAgainCount < 5) { setTimeout(aiTurn, 1000); } else { console.warn("AI play again limit reached."); updateGameStatus("AI limit. Your turn.", true); switchTurn(); } } else { highlightPlayableCards(); }
    } else if (turnResult === 'pass_back') {
        gameState.currentPlayer = player === 'player' ? 'ai' : 'player'; updateTurnIndicator(); console.log(` Penalty passed back to ${gameState.currentPlayer}.`); updateGameStatus(`Penalty passed back to ${gameState.currentPlayer}!`); if (gameState.currentPlayer === 'ai') setTimeout(aiTurn, 1000); else highlightPlayableCards();
    } else if (turnResult === 'blocked_penalty') {
        const opponent = player === 'player' ? 'ai' : 'player';
        gameState.currentPlayer = opponent;
        updateTurnIndicator();
        console.log(` A♠ Blocked! ${opponent} plays next (any card).`);
        updateGameStatus(`${opponent === 'player' ? 'You play' : 'AI plays'} next (any card).`);
        if (opponent === 'ai') { setTimeout(aiTurn, 1000); }
        else { highlightPlayableCards(true); }
    } else { // turnResult === 'normal'
        if (card.isJoker && turnResult !== 'pass_back') { // Joker follow-up play needed
             updateGameStatus(`${player === 'player' ? 'You must' : 'AI must'} play again (match Joker color: ${gameState.requiredColor})!`);
             console.log(` ${player} plays again after Joker (Color: ${gameState.requiredColor}).`);
             if (player === 'ai') {
                 gameState.aiPlayedAgainCount++;
                 if (gameState.aiPlayedAgainCount < 5) { setTimeout(aiTurn, 1000); }
                 else { console.warn("AI play again limit reached after Joker."); updateGameStatus("AI limit. Your turn.", true); switchTurn(); }
             } else {
                 highlightPlayableCards(); // Highlight based on color requirement
             }
        } else { // Normal turn switch
             switchTurn();
        }
    }
}


function handleCardEffect(card) {
    let turnResult = 'normal';
    const isPenaltyCard = ['2', '3'].includes(card.value) || card.isJoker;
    const isCountering = gameState.pendingPenalty.type !== null;

    if (isPenaltyCard || (card.value === 'A' && card.suit === 'Spades' && isCountering)) {
        turnResult = applyOrUpdatePenalty(card);
    } else if (isCountering) {
        console.error("Error: Invalid play while facing penalty. Clearing penalty.");
        clearPenalty();
    }

    if (turnResult !== 'pass_back' && turnResult !== 'blocked_penalty') {
        if (card.value === '8' || card.value === 'J') {
            // Don't set play_again if a Joker was just played (Joker follow-up takes precedence)
            if (!gameState.requiredColor) {
               turnResult = 'play_again';
            }
        } else if (card.value === '7' && card.suit === gameState.referenceSuit) {
            handleReferenceSeven();
            // turnResult remains 'normal'
        }
    }
    return turnResult;
}


function applyOrUpdatePenalty(playedCard) {
    const currentPenalty = gameState.pendingPenalty;
    const cardValue = playedCard.value; const cardSuit = playedCard.suit;
    const cardColor = playedCard.color; const cardIsJoker = playedCard.isJoker;
    const cardJokerColor = playedCard.jokerColor;
    const newPenaltyType = cardIsJoker ? 'joker' : (['2', '3'].includes(cardValue) ? cardValue : null);
    const newPenaltyAmount = cardIsJoker ? 5 : (cardValue === '3' ? 3 : (cardValue === '2' ? 2 : 0));

    // Case 1: A♠ blocks existing penalty
    if (cardValue === 'A' && cardSuit === 'Spades' && currentPenalty.type) {
        console.log(" Ace of Spades blocks penalty.");
        updateGameStatus(`A♠ blocks the ${currentPenalty.amount} card penalty!`);
        clearPenalty();
        return 'blocked_penalty';
    }
    // Case 2: Applying new penalty (no current penalty active)
    if (!currentPenalty.type && newPenaltyType) {
         console.log(` Applying new penalty: ${newPenaltyAmount} cards.`); gameState.pendingPenalty = { type: newPenaltyType, amount: newPenaltyAmount, suit: cardSuit, color: cardIsJoker ? cardJokerColor : cardColor }; updatePenaltyDisplay(); return 'normal';
    }
    // Case 3: Countering existing penalty
    if (currentPenalty.type && newPenaltyType) {
         const currentPV = penaltyValues[currentPenalty.type];
         const playedPV = penaltyValues[newPenaltyType];

         if (playedPV >= currentPV) { // Stack/Pass Back
             console.log(` Countering ${currentPenalty.type} w/ ${newPenaltyType}. Stacks/Passes back.`);
             // Update penalty state with the NEW card's details
             gameState.pendingPenalty = { type: newPenaltyType, amount: newPenaltyAmount, suit: cardSuit, color: cardIsJoker ? cardJokerColor : cardColor };
             updatePenaltyDisplay();
             updateGameStatus(`Penalty increased to ${newPenaltyAmount}, passed back!`);
             return 'pass_back';
         } else { // Reduce
             const diff = currentPenalty.amount - newPenaltyAmount;
             console.log(` Countering ${currentPenalty.type} w/ ${newPenaltyType}. Player draws ${diff}.`);
             updateGameStatus(`${gameState.currentPlayer} countered, draws ${diff}. Penalty cleared.`);
             clearPenalty();
             for (let i = 0; i < diff; i++) { if (!drawCard(gameState.currentPlayer)) break; }
             return 'normal';
         }
    }
    // Case 4: Non-penalty card played, no active penalty OR invalid counter
    if (currentPenalty.type) {
        console.warn("Played non-counter card while facing penalty - clearing penalty.");
        clearPenalty();
    }
    return 'normal';
}

function clearPenalty() {
    gameState.pendingPenalty = { type: null, amount: 0, suit: null, color: null }; updatePenaltyDisplay();
}
function handleReferenceSeven() {
    console.log(" Ref 7! Counting..."); updateGameStatus("Ref 7! Counting...", true); gameState.gameStatus = 'counting'; setTimeout(checkElimination, 1500);
}
function checkElimination() {
    console.log(" Checking elimination..."); const pRes = evaluatePlayerHandForElimination(gameState.playerHand); const aiRes = evaluatePlayerHandForElimination(gameState.aiHand); console.log(` P Sum: ${pRes.sum}, Elim: ${pRes.eliminated}. R: ${pRes.reason}`); console.log(` AI Sum: ${aiRes.sum}, Elim: ${aiRes.eliminated}. R: ${aiRes.reason}`); showCountDisplay(pRes, aiRes); setTimeout(() => { let final = 'draw'; let r = `P:${pRes.sum},AI:${aiRes.sum}.`; if (pRes.eliminated && aiRes.eliminated) { final = pRes.sum <= aiRes.sum ? 'playerWin' : 'aiWin'; r += " Both elim."; } else if (pRes.eliminated) { final = 'aiWin'; r += " P elim."; } else if (aiRes.eliminated) { final = 'playerWin'; r += " AI elim."; } else { final = pRes.sum <= aiRes.sum ? 'playerWin' : 'aiWin'; r += " Neither elim."; if (pRes.sum === aiRes.sum) final = 'draw'; } gameState.gameStatus = final; endGame(`Count round. ${r}`); }, 3500);
}
function evaluatePlayerHandForElimination(hand) {
    let sum = 0; let hasAce = false; let hasJoker = false; let hasNormAce = false; let hasAceS = false; let hasTwo = false; let hasOnly3 = hand.length === 1 && hand[0].value === '3'; let sumOther = 0; hand.forEach(c => { let v = 0; if (c.isJoker) { hasJoker = true; v = 50; } else if (c.value === 'A') { hasAce = true; if (c.suit === 'Spades') { hasAceS = true; v = 60; } else { hasNormAce = true; v = 11; } } else { v = cardValues[c.value] || 0; } sum += v; if (c.value === '2') { hasTwo = true; } else { sumOther += v; } }); let elim = false; let reason = ""; if (hasJoker || hasAce) { elim = true; reason = hasJoker ? "Has Joker" : (hasAceS ? "Has A♠" : "Has Ace"); } else if (hasOnly3) { elim = false; reason = "Only 3"; } else if (hasTwo && sumOther <= 10) { elim = false; reason = `Has 2, other≤10 (${sumOther})`; } else if (sum > 30) { elim = true; reason = `Sum>30 (${sum})`; } else { reason = `Sum≤30 (${sum})`; } return { sum, eliminated: elim, reason };
}
function calculateCardSum(hand) {
    return hand.reduce((sum, card) => { let v = 0; if (card.isJoker) v = 50; else if (card.value === 'A') v = (card.suit === 'Spades') ? 60 : 11; else v = cardValues[card.value] || 0; return sum + v; }, 0);
}

function switchTurn() {
    if (gameState.gameStatus !== 'inProgress') return;
    if (gameState.currentPlayer === 'player') {
        gameState.playerHasDrawn = false;
        if(domElements.skipTurn) domElements.skipTurn.style.display = 'none';
    } else {
        gameState.aiPlayedAgainCount = 0;
    }
    gameState.playAnyCardNext = false; // Reset A♠ flag

    gameState.currentPlayer = gameState.currentPlayer === 'player' ? 'ai' : 'player';
    console.log(` Switching turn to ${gameState.currentPlayer}`);
    updateTurnIndicator();

    if (gameState.currentPlayer === 'ai') {
        setTimeout(aiTurn, 1000);
    } else {
        highlightPlayableCards();
        if (gameState.pendingPenalty.type) {
            updateGameStatus(`Your turn. Counter ${gameState.pendingPenalty.amount} or draw.`, true);
        } else {
            updateGameStatus("Your turn.");
        }
    }
}

// --- AI Logic ---
function aiTurn() {
    if (gameState.currentPlayer !== 'ai' || gameState.gameStatus !== 'inProgress') return;
    console.log(" AI's turn.");
    updateGameStatus("AI is thinking...");

    // 1. Handle Penalty
    if (gameState.pendingPenalty.type) {
         const counterIdx = findCounterCard();
         if (counterIdx !== -1) {
             const card = gameState.aiHand[counterIdx];
             console.log(` AI counters penalty w/ ${card.value} ${card.suit || card.jokerColor}`);
             updateGameStatus(`AI counters w/ ${card.value} ${card.suit || card.jokerColor}!`);
             setTimeout(() => playCard(counterIdx), 800);
         } else {
             console.log(` AI draws ${gameState.pendingPenalty.amount} penalty cards.`);
             updateGameStatus(`AI draws ${gameState.pendingPenalty.amount}.`);
             const amount = gameState.pendingPenalty.amount;
             clearPenalty();
             for (let i = 0; i < amount; i++) { if (!drawCard('ai')) break; }
             switchTurn();
         }
         return;
    }

    // 2. Normal Play
    const bestCardIndex = findBestCard('ai');
    if (bestCardIndex !== -1) {
        const card = gameState.aiHand[bestCardIndex];
        console.log(` AI plays: ${card.value} ${card.suit || card.jokerColor}`);
        updateGameStatus(`AI plays ${card.value} ${card.suit || card.jokerColor}.`);
        setTimeout(() => playCard(bestCardIndex), 800);
    } else {
        console.log(" AI has no playable cards, drawing...");
        updateGameStatus("AI draws card.");
        const drawn = drawCard('ai');
        if (drawn && isCardPlayable(drawn, 'ai')) {
            console.log(` AI drew playable: ${drawn.value} ${drawn.suit || drawn.jokerColor}.`);
            updateGameStatus(`AI drew & plays ${drawn.value} ${drawn.suit || drawn.jokerColor}.`);
            const idx = gameState.aiHand.length - 1;
            setTimeout(() => playCard(idx), 1200);
        } else {
            console.log(" AI drew unplayable / failed draw.");
            updateGameStatus("AI drew & ends turn.");
            switchTurn();
        }
    }
}
function findCounterCard() {
    const penalty = gameState.pendingPenalty;
    let possible = [];
    for (let i = 0; i < gameState.aiHand.length; i++) { if (isCardPlayable(gameState.aiHand[i], 'ai')) { possible.push({ card: gameState.aiHand[i], index: i }); } }
    if (possible.length === 0) return -1;
    const aceS = possible.find(p => p.card.value === 'A' && p.card.suit === 'Spades'); if (aceS) return aceS.index;
    // Prioritize playing a Joker counter if possible (now any Joker works)
    if (penalty.type === 'joker') {
        const jokerCounter = possible.find(p => p.card.isJoker);
        if (jokerCounter) return jokerCounter.index;
    }
    // Prioritize stacking/passing back other penalties
    const stack = possible.find(p => { const pVal = penaltyValues[p.card.value] || (p.card.isJoker ? penaltyValues.joker : 0); return pVal >= penaltyValues[penalty.type]; }); if (stack) return stack.index;
    // Otherwise, play any valid counter (will be a reducing one if stack wasn't found)
    return possible[0].index;
}

function findBestCard(playerContext) {
    let playable = [];
    let allCards = gameState.aiHand.map((card, index) => ({ card, index }));

    playable = allCards.filter(item => isCardPlayable(item.card, playerContext));

    if (playable.length === 0) { return -1; }

    // AI Strategy Priorities:
    // 1. Win if possible
    if (gameState.aiHand.length === 1 && playable.length > 0) {
         console.log(" AI Strategy: Playing last card to win.");
         return playable[0].index;
    }

    // 2. Play Reference 7 if advantageous AND allowed
    const ref7Index = playable.findIndex(p => p.card.value === '7' && p.card.suit === gameState.referenceSuit);
    if (ref7Index !== -1) {
        const ref7PlayableItem = playable[ref7Index];
        const sumOther = calculateCardSum(gameState.aiHand.filter((c, i) => i !== ref7PlayableItem.index));
        if (sumOther < 30) {
             if (gameState.playerHand.length <= 3) {
                console.log(" AI Strategy: Playing valid reference 7 (sum < 30).");
                return ref7PlayableItem.index;
             }
        } else {
             console.log(" AI Strategy: Cannot play reference 7 due to sum restriction.");
             playable.splice(ref7Index, 1);
             if (playable.length === 0) return -1;
        }
    }
    // --- Continue checking other priorities ---

    // 3. Play Penalties (Joker > 3 > 2)
    const joker = playable.find(p => p.card.isJoker); if (joker) { console.log(" AI Strategy: Playing Joker."); return joker.index; }
    const three = playable.find(p => p.card.value === '3'); if (three) { console.log(" AI Strategy: Playing 3."); return three.index; }
    const two = playable.find(p => p.card.value === '2'); if (two) { console.log(" AI Strategy: Playing 2."); return two.index; }
    // 4. Play Skip/Reverse (8 or J)
    const skip = playable.find(p => p.card.value === '8' || p.card.value === 'J'); if (skip) { console.log(" AI Strategy: Playing Skip/Reverse."); return skip.index; }
    // 5. Play Ace (non-Spades preferred)
    const normAce = playable.find(p => p.card.value === 'A' && p.card.suit !== 'Spades'); if (normAce) { console.log(" AI Strategy: Playing normal Ace."); return normAce.index; }
    const aceS = playable.find(p => p.card.value === 'A' && p.card.suit === 'Spades'); if (aceS) { console.log(" AI Strategy: Playing Ace of Spades."); return aceS.index; }
    // 6. Play matching suit (if not in A♠ block state)
    if (!gameState.playAnyCardNext && gameState.currentSuit) {
        const suitM = playable.find(p => !p.card.isJoker && p.card.suit === gameState.currentSuit); if (suitM) { console.log(" AI Strategy: Playing suit match."); return suitM.index; }
    }
    // 7. Play matching value (if not in A♠ block state)
     if (!gameState.playAnyCardNext && gameState.currentValue) {
        const valueM = playable.find(p => !p.card.isJoker && p.card.value === gameState.currentValue); if (valueM) { console.log(" AI Strategy: Playing value match."); return valueM.index; }
     }
    // 8. Play Anything Else
    console.log(" AI Strategy: Playing first available card.");
    return playable[0].index;
}
function aiSelectSuitForAce() {
    const counts = { Hearts: 0, Diamonds: 0, Clubs: 0, Spades: 0 }; let maxC = 0; let bestS = null; gameState.aiHand.forEach(c => { if (!c.isJoker && c.value !== 'A' && c.suit) counts[c.suit]++; }); for (const s in counts) { if (counts[s] > maxC) { maxC = counts[s]; bestS = s; } } if (!bestS) { const suits = Object.keys(counts); bestS = suits[Math.floor(Math.random() * suits.length)]; } console.log(` AI selected suit for Ace: ${bestS}`); return bestS;
}

// --- UI Rendering & Updates ---
function renderPlayerHand() {
    if (!domElements.playerHand) return; domElements.playerHand.innerHTML = ''; const num = gameState.playerHand.length; const cont = domElements.playerHand; let cls = ''; if (num > 20) cls = 'scale-70'; else if (num > 15) cls = 'scale-80'; else if (num > 10) cls = 'scale-90'; else cls = 'scale-100'; cont.className = 'player-hand ' + cls;
    gameState.playerHand.forEach((card, index) => { const el = createCardElement(card); el.dataset.index = index; el.addEventListener('click', () => handlePlayerCardClick(index)); cont.appendChild(el); card.element = el; }); highlightPlayableCards(); updateCardCounts();
}
function renderAIHand() {
    if (!domElements.aiHand) return; domElements.aiHand.innerHTML = ''; const num = gameState.aiHand.length; const cont = domElements.aiHand; let cls = ''; if (num > 20) cls = 'scale-70'; else if (num > 15) cls = 'scale-80'; else if (num > 10) cls = 'scale-90'; else cls = 'scale-100'; cont.className = 'computer-hand ' + cls;
    for (let i = 0; i < num; i++) { const el = document.createElement('div'); el.className = 'card card-back'; cont.appendChild(el); } updateCardCounts();
}
function createCardElement(card) {
    const el = document.createElement('div'); el.className = 'card'; const suitSym = card.suit ? gameState.suitSymbols[card.suit] : ''; const colorCls = card.isJoker ? card.jokerColor : (card.color || ''); let valDisp = card.value === 'Joker' ? 'JK' : (card.value || ''); if (valDisp === '10') valDisp = 'T'; else if (valDisp.length > 1 && valDisp !== 'JK') valDisp = valDisp.slice(0,1); el.classList.add(colorCls); if (card.suit) el.classList.add(card.suit.toLowerCase()); if (card.isJoker) el.classList.add('joker'); el.innerHTML = `<div class="card-top"><span class="value">${valDisp}</span>${card.suit ? `<span class="suit-icon">${suitSym}</span>` : ''}</div><div class="card-center">${card.isJoker ? '🃏' : suitSym}</div><div class="card-bottom"><span class="value">${valDisp}</span>${card.suit ? `<span class="suit-icon">${suitSym}</span>` : ''}</div>`; return el;
}

function highlightPlayableCards(highlightAll = false) {
    if (!domElements.playerHand || gameState.currentPlayer !== 'player') {
         if (domElements.playerHand) Array.from(domElements.playerHand.children).forEach(c => c.classList.remove('playable'));
         return;
    }
    gameState.playerHand.forEach((card, index) => {
        const cardElement = domElements.playerHand.children[index];
        if (cardElement) {
            if (highlightAll || isCardPlayable(card, 'player')) {
                cardElement.classList.add('playable');
            } else {
                cardElement.classList.remove('playable');
            }
        }
    });
}

function updateDiscardPile() {
    if (!domElements.discardPile) return; domElements.discardPile.innerHTML = ''; if (gameState.discardPile.length > 0) { const top = gameState.discardPile[gameState.discardPile.length - 1]; domElements.discardPile.appendChild(createCardElement(top)); domElements.discardPile.classList.add('has-card'); } else { domElements.discardPile.classList.remove('has-card'); }
}
function updateTurnIndicator() {
    if (!domElements.playerTurn || !domElements.computerTurn) return; if (gameState.currentPlayer === 'player') { domElements.playerTurn.classList.add('active'); domElements.computerTurn.classList.remove('active'); } else { domElements.playerTurn.classList.remove('active'); domElements.computerTurn.classList.add('active'); }
}
function updateCardCounts() {
    if (domElements.playerCardCount) domElements.playerCardCount.textContent = gameState.playerHand.length; if (domElements.aiCardCount) domElements.aiCardCount.textContent = gameState.aiHand.length;
}
function updateDeckCount() {
    if (domElements.deckCount) domElements.deckCount.textContent = gameState.deck.length;
}
function updatePenaltyDisplay() {
    if (!domElements.penaltyDisplay || !domElements.pendingPenalty) return; if (gameState.pendingPenalty.type) { domElements.pendingPenalty.textContent = `Draw ${gameState.pendingPenalty.amount}!`; domElements.penaltyDisplay.classList.add('visible'); domElements.penaltyDisplay.className = `penalty-display visible penalty-${gameState.pendingPenalty.type}`; } else { domElements.penaltyDisplay.classList.remove('visible'); }
}

function showTemporarySuit(suitOrColor) {
    if (!domElements.temporarySuit) return;
    const isColor = suitOrColor === 'Red' || suitOrColor === 'Black';
    const symbol = isColor ? '' : gameState.suitSymbols[suitOrColor] || '';
    const text = isColor ? suitOrColor : `${symbol} ${suitOrColor}`;
    const el = domElements.temporarySuit;
    el.textContent = `Next: ${text}`;
    el.className = 'temporary-suit'; // Reset classes first
    el.classList.add(suitOrColor.toLowerCase());

    if (suitOrColor === 'Black' || suitOrColor === 'Clubs' || suitOrColor === 'Spades') {
        el.classList.add('black');
    } else {
         el.classList.add('red');
    }
    el.style.display = 'inline-block';
}

function hideTemporarySuit() {
    if (domElements.temporarySuit) domElements.temporarySuit.style.display = 'none';
}
function showAceSuitSelection() {
    console.log(" Showing Ace suit selection modal."); if (domElements.aceModal) domElements.aceModal.classList.add('visible');
}
function hideAceSuitSelection() {
    if (domElements.aceModal) domElements.aceModal.classList.remove('visible');
}
function showCountDisplay(pRes, aiRes) {
    if (!domElements.countDisplay) return; let msg = `<h3>Count Results</h3><p>P: ${pRes.sum}pts ${pRes.eliminated?'<span class="eliminated">(ELIM)</span>':''} (${pRes.reason})</p><p>AI: ${aiRes.sum}pts ${aiRes.eliminated?'<span class="eliminated">(ELIM)</span>':''} (${aiRes.reason})</p>`; domElements.countDisplay.innerHTML = msg; domElements.countDisplay.classList.add('visible'); setTimeout(() => { if(domElements.countDisplay) domElements.countDisplay.classList.remove('visible'); }, 3500);
}
function updateGameStatus(message, permanent = false) {
    if (!domElements.gameStatus) return;
    domElements.gameStatus.textContent = message; domElements.gameStatus.classList.add('visible'); if (domElements.gameStatus.timeoutId) clearTimeout(domElements.gameStatus.timeoutId); if (!permanent) { domElements.gameStatus.timeoutId = setTimeout(() => { if(domElements.gameStatus) domElements.gameStatus.classList.remove('visible'); }, 3000); }
}
function addShakeAnimation(element) {
    if (element) { element.classList.add('shake'); setTimeout(() => element.classList.remove('shake'), 500); }
}
function endGame(reason = "") {
    console.log(`Game ending. Status: ${gameState.gameStatus}. Reason: ${reason}`); let title = "Game Over"; let message = "";
    if (!['playerWin', 'aiWin', 'draw'].includes(gameState.gameStatus)) { console.warn("endGame status unclear:", gameState.gameStatus); if (gameState.playerHand.length === 0) gameState.gameStatus = 'playerWin'; else if (gameState.aiHand.length === 0) gameState.gameStatus = 'aiWin'; else if (gameState.playerHand.length < gameState.aiHand.length) gameState.gameStatus = 'playerWin'; else if (gameState.aiHand.length < gameState.playerHand.length) gameState.gameStatus = 'aiWin'; else gameState.gameStatus = 'draw'; reason += " (Status fallback)"; }
    switch (gameState.gameStatus) { case 'playerWin': title = "You Win!"; message = `Congratulations!<br>You won the game.`; break; case 'aiWin': title = "AI Wins!"; message = `The AI won the game.<br>Better luck next time!`; break; case 'draw': title = "It's a Draw!"; message = `The game ended in a draw.`; break; default: message = `Game ended unexpectedly.`; break; }
    if (reason) message += `<br><span class="reason">(${reason.trim()})</span>`;
    if(domElements.gameOverTitle) domElements.gameOverTitle.textContent = title;
    if(domElements.winnerMessage) domElements.winnerMessage.innerHTML = message;
    if(domElements.gameOverModal) domElements.gameOverModal.classList.add('visible');
    updateGameStatus(title, true);
}
// --- Global Event Listener ---
document.addEventListener('DOMContentLoaded', initGame);
