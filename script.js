// --- DOM Elements ---
const homeScreen = document.getElementById('homeScreen'); // Corrected ID based on HTML
const lobbyScreen = document.getElementById('lobbyScreen'); // Corrected ID based on HTML
const gameScreen = document.getElementById('gameScreen'); // Corrected ID based on HTML
const gameOverScreen = document.getElementById('gameOverScreen'); // Corrected ID based on HTML
const errorMessage = document.getElementById('errorMessage'); // Corrected ID based on HTML

// Home Screen Elements
const usernameInput = document.getElementById('usernameInput'); // Corrected ID based on HTML
const saveUsernameBtn = document.getElementById('saveUsernameBtn'); // Corrected ID based on HTML
const difficultySelect = document.getElementById('difficultySelect'); // Corrected ID based on HTML
const createRoomButton = document.getElementById('createRoomButton'); // Corrected ID based on HTML
const roomIdInput = document.getElementById('roomIdInput'); // Corrected ID based on HTML
const joinRoomButton = document.getElementById('joinRoomButton'); // Corrected ID based on HTML

// Lobby Screen Elements
const currentRoomIdDisplay = document.getElementById('currentRoomIdDisplay'); // Corrected ID based on HTML
const playerListLobby = document.getElementById('playerListLobby'); // Corrected ID based on HTML
const startGameButton = document.getElementById('startGameButton'); // Corrected ID based on HTML
const leaveLobbyButton = document.getElementById('leaveLobbyButton'); // Corrected ID based on HTML

// Game Screen Elements
const roundInfoDisplay = document.getElementById('roundInfoDisplay'); // Corrected ID based on HTML
const timerDisplay = document.getElementById('timerDisplay'); // Corrected ID based on HTML
const questionDisplay = document.getElementById('questionDisplay'); // Corrected ID based on HTML
const answerInput = document.getElementById('answerInput'); // Corrected ID based on HTML
const submitAnswerButton = document.getElementById('submitAnswerButton'); // Corrected ID based on HTML
const player1NameGame = document.getElementById('player1NameGame'); // Corrected ID based on HTML
const player1ScoreGame = document.getElementById('player1ScoreGame'); // Corrected ID based on HTML
const player1AnswerStatus = document.getElementById('player1AnswerStatus'); // Corrected ID based on HTML
const player2NameGame = document.getElementById('player2NameGame'); // Corrected ID based on HTML
const player2ScoreGame = document.getElementById('player2ScoreGame'); // Corrected ID based on HTML
const player2AnswerStatus = document.getElementById('player2AnswerStatus'); // Corrected ID based on HTML
const waitingForQuestionSpinner = document.getElementById('waitingForQuestionSpinner'); // Corrected ID based on HTML
const answerCountDisplay = document.getElementById('answerCountDisplay'); // Corrected ID based on HTML
const leaveGameButton = document.getElementById('leaveGameButton'); // Corrected ID based on HTML

// Game Over Screen Elements
const winnerInfo = document.getElementById('winnerInfo'); // Corrected ID based on HTML
const finalScoresList = document.getElementById('finalScoresList'); // Corrected ID based on HTML
const playAgainButton = document.getElementById('playAgainButton'); // Corrected ID based on HTML
const backToHomeButton = document.getElementById('backToHomeButton'); // Corrected ID based on HTML

// Message Overlay Elements
const messageOverlay = document.getElementById('messageOverlay'); // Corrected ID based on HTML
const messageText = document.getElementById('messageText'); // Corrected ID based on HTML
const closeMessageButton = document.getElementById('closeMessageButton'); // Corrected ID based on HTML


// --- Game State (Client-Side) ---
let currentUserId = null;
let currentUsername = localStorage.getItem('username') || ''; // Load from local storage
let currentRoomId = null;
let roomState = null; // Will store the full room data from the server
let timerInterval = null;
let currentRoundTimer = null; // To hold the actual countdown interval
const ROUND_DURATION = 60; // seconds

// --- Server API Base URL ---
// IMPORTANT: Replace with your Render.com backend URL after deployment
const API_BASE_URL = 'https://quiz-backend-bs3b.onrender.com'; // Change to your Render.com URL in production

// --- Utility Functions ---
function showScreen(screenElement) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden'); // Use hidden class from Tailwind
    });
    screenElement.classList.remove('hidden'); // Show the active screen
    // Scroll to top when changing screens for better UX on mobile
    window.scrollTo(0, 0);
}

function showMessage(message, duration = 3000) {
    messageText.textContent = message;
    messageOverlay.classList.remove('hidden');
    if (duration) {
        setTimeout(() => {
            messageOverlay.classList.add('hidden');
        }, duration);
    }
}
closeMessageButton.addEventListener('click', () => messageOverlay.classList.add('hidden'));


function displayError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden'); // Show the error message
    errorMessage.classList.remove('bg-green-500'); // Remove potential success styling
    errorMessage.classList.add('bg-red-500'); // Ensure it's red for errors
    setTimeout(() => {
        errorMessage.classList.add('hidden'); // Hide after 5 seconds
    }, 5000);
}

function displaySuccess(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden'); // Show the message
    errorMessage.classList.remove('bg-red-500'); // Remove potential error styling
    errorMessage.classList.add('bg-green-500'); // Make it green for success
    setTimeout(() => {
        errorMessage.classList.add('hidden'); // Hide after 5 seconds
    }, 5000);
}


async function apiCall(endpoint, method = 'GET', data = null) {
    try {
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                // Always send user ID and username if available
                ...(currentUserId && { 'X-User-ID': currentUserId }),
                ...(currentUsername && { 'X-Username': currentUsername })
            }
        };
        if (data) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        const result = await response.json();

        if (!response.ok) {
            // Check if result.message exists, otherwise use a generic error
            const errorMessage = result.message || `API request failed with status ${response.status}: ${JSON.stringify(result)}`;
            console.error('API Call Error:', errorMessage, result);
            displayError(errorMessage);
            throw new Error(errorMessage); 
        }
        return result;
    } catch (error) {
        console.error('API Call Error:', error);
        // displayError(error.message); // Already called by displayError above, avoid double
        throw error; // Re-throw to be caught by specific handlers
    }
}

// --- Initial Setup ---
async function initializeUser() {
    if (!currentUsername) {
        currentUsername = `Player_${Math.random().toString(36).substring(2, 8)}`;
        localStorage.setItem('username', currentUsername);
    }
    usernameInput.value = currentUsername;

    // Register/authenticate user with backend to get a unique ID
    try {
        const response = await apiCall('/api/auth/anonymous', 'POST', { username: currentUsername });
        currentUserId = response.userId;
        console.log('Authenticated with user ID:', currentUserId);
        
        if (response.username) {
            currentUsername = response.username; // Server might return a normalized username
            usernameInput.value = currentUsername;
            localStorage.setItem('username', currentUsername);
        }
    } catch (error) {
        displayError('Failed to initialize user. Please refresh the page and try again.');
        // Disable buttons if authentication fails to prevent further issues
        createRoomButton.disabled = true;
        joinRoomButton.disabled = true;
        saveUsernameBtn.disabled = true;
    }
}

// --- Event Handlers ---

saveUsernameBtn.addEventListener('click', async () => {
    const newUsername = usernameInput.value.trim();
    if (newUsername && newUsername !== currentUsername) {
        try {
            // Send user ID to backend to update their username
            await apiCall('/api/user/update-username', 'POST', { newUsername: newUsername });
            currentUsername = newUsername;
            localStorage.setItem('username', currentUsername);
            displaySuccess('Username updated!'); 
        } catch (error) {
            // Error displayed by apiCall
        }
    } else {
        displayError("Please enter a new username.");
    }
});


createRoomButton.addEventListener('click', async () => { // Corrected ID
    if (!currentUsername) {
        displayError("Please set a username first.");
        return;
    }
    const difficulty = difficultySelect.value;
    try {
        const room = await apiCall('/api/rooms/create', 'POST', { difficulty: difficulty });
        currentRoomId = room.roomId;
        joinRoomUpdates(room); // Pass the initial room state
        showScreen(lobbyScreen);
    } catch (error) {
        // Error displayed by apiCall
    }
});

joinRoomButton.addEventListener('click', async () => { // Corrected ID
    if (!currentUsername) {
        displayError("Please set a username first.");
        return;
    }
    const id = roomIdInput.value.trim().toUpperCase();
    if (!id) {
        displayError("Please enter a Room ID.");
        return;
    }
    try {
        const room = await apiCall(`/api/rooms/join/${id}`, 'POST');
        currentRoomId = room.roomId;
        joinRoomUpdates(room); // Pass the initial room state
        showScreen(lobbyScreen);
    } catch (error) {
        // Error displayed by apiCall
    }
});

startGameButton.addEventListener('click', async () => { // Corrected ID
    if (!currentRoomId) {
        displayError("No active room to start the game.");
        return;
    }
    try {
        await apiCall(`/api/rooms/${currentRoomId}/start`, 'POST');
        // Game state will be updated by polling (see below)
    } catch (error) {
        // Error displayed by apiCall
    }
});

leaveLobbyButton.addEventListener('click', async () => { // Corrected ID
    if (!currentRoomId) {
        showScreen(homeScreen);
        return;
    }
    try {
        await apiCall(`/api/rooms/${currentRoomId}/leave`, 'POST');
        displaySuccess("Left the lobby.");
    } catch (error) {
        // Error displayed by apiCall
    } finally {
        // Always return home and clean up client state regardless of server response
        currentRoomId = null;
        roomState = null;
        if (timerInterval) clearInterval(timerInterval);
        if (currentRoundTimer) clearInterval(currentRoundTimer);
        showScreen(homeScreen);
        usernameInput.value = currentUsername; // Keep username
        roomIdInput.value = ''; // Clear room ID input
    }
});

submitAnswerButton.addEventListener('click', async () => { // Corrected ID
    if (!currentRoomId || !currentUserId || !roomState) {
        displayError("Game state not ready to submit answer.");
        return;
    }
    const answerText = answerInput.value.trim();
    const numAnswers = countAnswers(answerText);

    if (numAnswers < 8) {
        displayError("You need to list exactly 8 items.");
        return;
    }
    
    // Disable submission to prevent double-sends
    answerInput.disabled = true;
    submitAnswerButton.disabled = true;
    
    try {
        await apiCall(`/api/rooms/${currentRoomId}/answer`, 'POST', { 
            round: roomState.currentRound, // Pass current round
            answers: parseAnswers(answerText) // Pass parsed answers
        });
        displaySuccess("Answers submitted!");
        // Server will handle scoring and game state update
    } catch (error) {
        // Re-enable if API call fails
        answerInput.disabled = false;
        updateAnswerCount(); // Re-evaluate button state
        // Error already displayed by apiCall
    }
});

leaveGameButton.addEventListener('click', async () => { // Corrected ID
    if (!currentRoomId) {
        showScreen(homeScreen);
        return;
    }
    try {
        await apiCall(`/api/rooms/${currentRoomId}/leave`, 'POST');
        displaySuccess("Left the game.");
    } catch (error) {
        // Error displayed by apiCall
    } finally {
        // Always return home and clean up client state regardless of server response
        currentRoomId = null;
        roomState = null;
        if (timerInterval) clearInterval(timerInterval);
        if (currentRoundTimer) clearInterval(currentRoundTimer);
        showScreen(homeScreen);
        usernameInput.value = currentUsername; // Keep username
        roomIdInput.value = ''; // Clear room ID input
    }
});


playAgainButton.addEventListener('click', () => { // Corrected ID
    currentRoomId = null;
    roomState = null;
    if (timerInterval) clearInterval(timerInterval);
    if (currentRoundTimer) clearInterval(currentRoundTimer);
    usernameInput.value = currentUsername; // Reset username input
    roomIdInput.value = ''; // Clear room ID input
    showScreen(homeScreen);
});

backToHomeButton.addEventListener('click', () => { // Corrected ID
    currentRoomId = null;
    roomState = null;
    if (timerInterval) clearInterval(timerInterval);
    if (currentRoundTimer) clearInterval(currentRoundTimer);
    usernameInput.value = currentUsername; // Reset username input
    roomIdInput.value = ''; // Clear room ID input
    showScreen(homeScreen);
});


// --- Game State Polling (Simplified Real-time) ---
// In a real production app, WebSockets (Socket.IO) would be used for true real-time updates.
// For this simple example, we'll poll the server every second.
function joinRoomUpdates(initialRoomData) {
    roomState = initialRoomData; // Set initial state
    updateUI(roomState); // Update UI immediately

    // Clear any previous interval
    if (timerInterval) {
        clearInterval(timerInterval);
    }

    timerInterval = setInterval(async () => {
        if (currentRoomId && currentUserId) {
            try {
                const room = await apiCall(`/api/rooms/${currentRoomId}`);
                if (room) {
                    // Only update if the room data has changed significantly or if it's a specific game state update
                    // This simple check prevents unnecessary UI updates for identical data
                    if (JSON.stringify(room) !== JSON.stringify(roomState)) {
                        roomState = room; // Update local state
                        updateUI(roomState);
                    }
                }
            } catch (error) {
                // Error handling for polling, maybe room was deleted?
                console.warn("Polling failed, room might be gone:", error.message);
                if (currentRoomId) { // Only reset if we were in a room
                    // displayError(`Lost connection to room. Returning to home. (${error.message})`);
                    // This can be annoying if it's just a temporary network blip
                    // Instead, silently handle or only show message for critical errors
                    if (error.message.includes("Room not found") || error.message.includes("does not exist")) {
                        displayError("The room has been closed or no longer exists. Returning to home.");
                        currentRoomId = null;
                        roomState = null;
                        if (timerInterval) clearInterval(timerInterval);
                        if (currentRoundTimer) clearInterval(currentRoundTimer);
                        showScreen(homeScreen);
                        usernameInput.value = currentUsername;
                        roomIdInput.value = '';
                    }
                }
            }
        }
    }, 1000); // Poll every 1 second
}

function updateUI(room) {
    if (!room) {
        console.warn("Attempted to update UI with null room data.");
        return;
    }

    // Update screen based on room status
    switch (room.status) {
        case 'waiting':
            showScreen(lobbyScreen);
            currentRoomIdDisplay.textContent = `Room ID: ${room.roomId}`;
            updateLobbyUI(room);
            break;
        case 'playing':
            showScreen(gameScreen);
            updateGameUI(room);
            startRoundTimer(room); // Start/update timer based on room state
            break;
        case 'finished':
            showScreen(gameOverScreen);
            updateResultsScreen(room);
            if (timerInterval) clearInterval(timerInterval); // Stop polling for finished game
            if (currentRoundTimer) clearInterval(currentRoundTimer); // Clear round timer
            break;
        default:
            showScreen(homeScreen); // Fallback
            break;
    }
}

function updateLobbyUI(room) {
    playerListLobby.innerHTML = '';
    if (!room.players || Object.keys(room.players).length === 0) {
        playerListLobby.innerHTML += '<li class="p-3 text-teal-700 animate-pulse">Waiting for players...</li>';
        startGameButton.classList.add('hidden');
        startGameButton.disabled = true;
        return;
    }

    const playersArray = Object.values(room.players);
    playersArray.forEach(player => {
        const li = document.createElement('li');
        li.className = 'p-3 bg-white/20 rounded-lg shadow text-gray-800 text-lg';
        li.textContent = `${player.username} ${player.userId === currentUserId ? '(You!)' : ''} ${room.hostId === player.userId ? '👑 (Host)' : ''}`;
        playerListLobby.appendChild(li);
    });

    // Only host can start game
    if (room.hostId === currentUserId && playersArray.length >= 2) {
        startGameButton.classList.remove('hidden');
        startGameButton.disabled = false;
    } else {
        startGameButton.classList.add('hidden');
        startGameButton.disabled = true;
        if (playersArray.length < 2) {
            playerListLobby.innerHTML += '<li class="p-3 text-teal-700 animate-pulse">Waiting for at least 2 players to start...</li>';
        }
    }
}

function updateGameUI(room) {
    const players = room.players;
    // Ensure player order is consistent, or use default if not set by backend
    const playerIds = room.playerOrder || Object.keys(players).sort(); 

    // Update Player 1 display
    if (playerIds.length > 0 && players[playerIds[0]]) {
        const p1 = players[playerIds[0]];
        player1NameGame.textContent = p1.username + (p1.userId === currentUserId ? " (You)" : "");
        player1ScoreGame.textContent = p1.score || 0;
        player1AnswerStatus.textContent = p1.hasAnsweredCurrentRound ? "Answered!" : "Thinking...";
    } else {
        player1NameGame.textContent = "Player 1";
        player1ScoreGame.textContent = "0";
        player1AnswerStatus.textContent = "Thinking...";
    }

    // Update Player 2 display
    if (playerIds.length > 1 && players[playerIds[1]]) {
        const p2 = players[playerIds[1]];
        player2NameGame.textContent = p2.username + (p2.userId === currentUserId ? " (You)" : "");
        player2ScoreGame.textContent = p2.score || 0;
        player2AnswerStatus.textContent = p2.hasAnsweredCurrentRound ? "Answered!" : "Thinking...";
    } else {
        player2NameGame.textContent = "Waiting for Player 2...";
        player2ScoreGame.textContent = "0";
        player2AnswerStatus.textContent = "";
    }

    roundInfoDisplay.textContent = `Round ${room.currentRound} of ${room.maxRounds}`;

    if (room.currentQuestion) {
        questionDisplay.textContent = room.currentQuestion;
        waitingForQuestionSpinner.classList.add('hidden'); // Hide spinner when question is ready
        
        // Re-enable input/button if current user hasn't answered
        if (players[currentUserId] && !players[currentUserId].hasAnsweredCurrentRound) {
            answerInput.disabled = false;
            // The submit button's disabled state is managed by updateAnswerCount based on input
            updateAnswerCount(); // Call this to ensure button state is correct on UI update
        } else {
            answerInput.disabled = true;
            submitAnswerButton.disabled = true;
        }

    } else {
        questionDisplay.textContent = "Waiting for the next question...";
        waitingForQuestionSpinner.classList.remove('hidden'); // Show spinner while waiting
        answerInput.disabled = true;
        submitAnswerButton.disabled = true;
    }

    // Reset answer input if round just started or question changed
    if (room.status === 'playing' && !players[currentUserId].hasAnsweredCurrentRound && answerInput.value !== '') {
        // Clear input if the user hasn't answered the *current* round yet
        if (!room.lastRoundReceivedQuestion || room.lastRoundReceivedQuestion !== room.currentQuestion) {
             answerInput.value = '';
             updateAnswerCount(); // Reset count display
             room.lastRoundReceivedQuestion = room.currentQuestion; // Mark that we've processed this question
        }
    }
    // If the round is over, disable input regardless
    if (room.status === 'round_over' || room.status === 'game_over') {
        answerInput.disabled = true;
        submitAnswerButton.disabled = true;
    }
}


function startRoundTimer(room) {
    if (currentRoundTimer) clearInterval(currentRoundTimer); // Clear any existing timer

    if (room.status !== 'playing' || !room.roundStartTime) {
        timerDisplay.textContent = '00:00';
        return;
    }

    const startTime = new Date(room.roundStartTime._seconds * 1000 + room.roundStartTime._nanoseconds / 1000000);
    const endTime = new Date(startTime.getTime() + ROUND_DURATION * 1000);

    currentRoundTimer = setInterval(() => {
        const now = new Date();
        const timeLeft = endTime.getTime() - now.getTime();

        if (timeLeft <= 0) {
            clearInterval(currentRoundTimer);
            timerDisplay.textContent = 'Time Up!';
            // The backend should handle round ending, but client side can react
            if (!room.currentQuestion || room.currentRoundAnswersComplete || room.status === 'round_over') {
                // If question is null or answers are complete, means round logic is handled by backend.
                // Or if status is already round_over, no need to trigger.
            } else {
                // If the round isn't over yet and time is up, trigger a server check if host.
                // This is a fallback, the backend should ideally be authoritative.
                if (room.hostId === currentUserId) {
                    console.log("Client-side timer expired for host. Signaling backend.");
                    // You might have a specific API endpoint for this, or just let polling handle it.
                    // For now, assume polling will eventually update the state.
                }
            }
            answerInput.disabled = true;
            submitAnswerButton.disabled = true;
            return;
        }

        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

        timerDisplay.textContent = 
            `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }, 1000);
}


function countAnswers(text) {
    if (!text.trim()) return 0;
    // Use regular expression to split by comma or newline, filtering out empty strings
    return text.split(/[\n,]+/).map(s => s.trim()).filter(s => s !== '').length;
}

function parseAnswers(text) {
    if (!text.trim()) return [];
    // Split by comma or newline, trim each item, filter out empty strings, and convert to lowercase
    return text.split(/[\n,]+/).map(s => s.trim().toLowerCase()).filter(s => s !== '');
}


answerInput.addEventListener('input', updateAnswerCount);

function updateAnswerCount() {
    const count = countAnswers(answerInput.value);
    answerCountDisplay.textContent = `${count} / 8 answers`;

    if (count === 8) { // Only enable if exactly 8 answers
        answerCountDisplay.classList.remove('text-red-500');
        answerCountDisplay.classList.add('text-green-500');
        submitAnswerButton.disabled = answerInput.disabled; // Keep disabled if input itself is disabled
    } else {
        answerCountDisplay.classList.add('text-red-500');
        answerCountDisplay.classList.remove('text-green-500');
        submitAnswerButton.disabled = true;
    }
}

function updateResultsScreen(room) {
    winnerInfo.textContent = ''; // Clear previous winner info
    finalScoresList.innerHTML = ''; // Clear previous scores

    if (!room.players || Object.keys(room.players).length === 0) {
        winnerInfo.textContent = "No players in this game.";
        return;
    }

    const playersArray = Object.values(room.players).sort((a, b) => b.score - a.score); // Sort by score descending

    playersArray.forEach(player => {
        const li = document.createElement('li');
        li.className = 'flex justify-between items-center bg-gray-700 p-3 rounded-md mb-2';
        li.innerHTML = `
            <span class="font-bold text-teal-300">${player.username} ${player.userId === currentUserId ? '(You)' : ''}:</span> 
            <span class="text-xl font-semibold text-yellow-400">${player.score} points</span>
        `;
        finalScoresList.appendChild(li);
    });

    // Determine winner
    if (playersArray.length > 0) {
        const topScore = playersArray[0].score;
        const winners = playersArray.filter(p => p.score === topScore);

        if (winners.length === 1) {
            winnerInfo.textContent = winners[0].userId === currentUserId ? "You Win! 🎉" : `${winners[0].username} Wins! 🎉`;
        } else {
            winnerInfo.textContent = "It's a Tie! 🤝";
        }
    } else {
        winnerInfo.textContent = "No scores to display.";
    }
}


// --- Initialize on page load ---
document.addEventListener('DOMContentLoaded', () => {
    initializeUser(); // This will authenticate the user with your backend
    showScreen(homeScreen); // Start on the home screen
    usernameInput.value = currentUsername; // Set initial username from localStorage
});