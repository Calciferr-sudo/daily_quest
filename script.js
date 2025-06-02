// --- DOM Elements ---
const homeScreen = document.getElementById('home-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const gameOverScreen = document.getElementById('gameOverScreen');
// Added an error message element, ensure this exists in your HTML or errors will use alert
const errorMessageDisplay = document.createElement('div');
errorMessageDisplay.id = 'error-message';
errorMessageDisplay.classList.add('hidden');
document.body.prepend(errorMessageDisplay);


// Home Screen Elements
const usernameInput = document.getElementById('username-input');
const saveUsernameBtn = document.getElementById('save-username-btn');
const difficultySelect = document.getElementById('difficulty-select');
const createRoomBtn = document.getElementById('create-room-btn');
const roomIdInput = document.getElementById('room-id-input');
const joinRoomBtn = document.getElementById('join-room-btn');

// Lobby Screen Elements
const lobbyRoomId = document.getElementById('lobby-room-id');
const playerList = document.getElementById('player-list');
const lobbyStatus = document.getElementById('lobby-status');
const startGameBtn = document.getElementById('start-game-btn');
const leaveLobbyBtn = document.getElementById('leave-lobby-btn');

// Game Screen Elements
const questionCounter = document.getElementById('question-counter');
const timerDisplay = document.getElementById('timer');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container'); // This was for multiple choice, now used for textarea
const answerInput = document.getElementById('answer-input'); // New for text area
const answerCountDisplay = document.getElementById('answer-count-display'); // New for text area count
const submitAnswerBtn = document.getElementById('submit-answer-btn');
const nextQuestionBtn = document.getElementById('next-question-btn');
const scoreboard = document.getElementById('scoreboard');
const player1NameGame = document.getElementById('player1NameGame');
const player1ScoreGame = document.getElementById('player1ScoreGame');
const player1AnswerStatus = document.getElementById('player1AnswerStatus');
const player2NameGame = document.getElementById('player2NameGame');
const player2ScoreGame = document.getElementById('player2ScoreGame');
const player2AnswerStatus = document.getElementById('player2AnswerStatus');
const leaveGameButton = document.getElementById('leaveGameButton');

// Game Over Screen Elements
const finalScoresList = document.getElementById('finalScoresList');
const winnerInfo = document.getElementById('winnerInfo');
const playAgainButton = document.getElementById('playAgainButton');
const returnToHomeButton = document.getElementById('returnToHomeButton');


// --- Game State Variables ---
const BACKEND_URL = 'https://quiz-backend-bs3b.onrender.com'; // Make sure this matches your backend URL
let currentUserId = localStorage.getItem('userId');
let currentUsername = localStorage.getItem('username');
let currentRoomId = null;
let roomState = null; // Stores the current state of the room from the backend
let timerInterval = null;
let countdownTime = 0;

// --- Socket.IO Connection ---
const socket = io(BACKEND_URL); // Connect to your backend's Socket.IO server

socket.on('connect', () => {
    console.log('Connected to Socket.IO server:', socket.id);
    if (currentUserId) {
        // Register user with socket ID on the server after connection
        socket.emit('registerUserSocket', currentUserId);
    }
});

socket.on('disconnect', () => {
    console.log('Disconnected from Socket.IO server.');
    // Handle disconnections (e.g., show a message, try to reconnect)
    showErrorMessage('Disconnected from server. Please refresh or check connection.');
    clearInterval(timerInterval);
});

socket.on('connect_error', (error) => {
    console.error('Socket.IO connection error:', error);
    showErrorMessage('Could not connect to game server. Is the backend running?');
});

socket.on('roomUpdate', (updatedRoomState) => {
    console.log('Room update received:', updatedRoomState);
    roomState = updatedRoomState; // Update global room state
    updateUI(roomState); // Update UI based on the new state
});

socket.on('roomDeleted', (data) => {
    console.log('Room deleted:', data.roomId);
    if (currentRoomId === data.roomId) {
        showErrorMessage(data.message || 'The room you were in has been deleted.');
        clearInterval(timerInterval);
        currentRoomId = null;
        roomState = null;
        showScreen(homeScreen);
    }
});

// --- Utility Functions ---
function showScreen(screen) {
    homeScreen.classList.add('hidden');
    lobbyScreen.classList.add('hidden');
    gameScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    screen.classList.remove('hidden');
}

function showErrorMessage(message) {
    console.error("Error:", message);
    errorMessageDisplay.textContent = message;
    errorMessageDisplay.classList.remove('hidden');
    setTimeout(() => {
        errorMessageDisplay.classList.add('hidden');
    }, 5000); // Hide after 5 seconds
}

// Function to safely parse user input for 8 answers
function parseAnswers(text) {
    // Split by newlines, commas, or spaces, then filter out empty strings and trim
    const answers = text.split(/[\n, ]+/)
                      .map(s => s.trim())
                      .filter(s => s.length > 0);
    // Ensure we only take up to 8 answers
    return answers.slice(0, 8);
}


// --- API Call Helper (for initial user setup, not game state updates) ---
async function apiCall(endpoint, method = 'GET', data = null) {
    const headers = {
        'Content-Type': 'application/json',
        'x-user-id': currentUserId, // Always send user ID
        'x-username': currentUsername // Always send username
    };

    const config = {
        method: method,
        headers: headers,
    };

    if (data) {
        config.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(`${BACKEND_URL}${endpoint}`, config);
        const result = await response.json();

        if (!response.ok) {
            showErrorMessage(result.message || `API Error: ${response.status}`);
            throw new Error(result.message || `API Error: ${response.status}`);
        }
        return result;
    } catch (error) {
        console.error("API call failed:", error);
        showErrorMessage(`Network or API Error: ${error.message}`);
        throw error;
    }
}

// --- User & Auth ---

async function initializeUser() {
    if (!currentUserId) {
        // No user ID in localStorage, prompt for username
        showScreen(homeScreen);
        usernameInput.value = ''; // Clear previous input
    } else {
        // User ID exists, try to authenticate with backend to get current username
        try {
            const result = await apiCall('/api/auth/anonymous', 'POST');
            currentUsername = result.username;
            localStorage.setItem('username', currentUsername);
            usernameInput.value = currentUsername; // Prefill username input
            socket.emit('registerUserSocket', currentUserId); // Register socket for existing user
            showScreen(homeScreen); // Go to home screen after initialization
        } catch (error) {
            console.error("Failed to re-authenticate user:", error);
            // If re-authentication fails, clear local storage and force new login
            currentUserId = null;
            currentUsername = null;
            localStorage.removeItem('userId');
            localStorage.removeItem('username');
            showScreen(homeScreen);
        }
    }
}

saveUsernameBtn.addEventListener('click', async () => {
    const newUsername = usernameInput.value.trim();
    if (newUsername.length < 3) {
        showErrorMessage('Username must be at least 3 characters long.');
        return;
    }

    try {
        let result;
        if (!currentUserId) {
            // First time login
            result = await apiCall('/api/auth/anonymous', 'POST', { username: newUsername });
        } else {
            // Update existing username
            result = await apiCall('/api/user/update-username', 'POST', { newUsername: newUsername });
        }
        currentUserId = result.userId;
        currentUsername = result.username;
        localStorage.setItem('userId', currentUserId);
        localStorage.setItem('username', currentUsername);
        socket.emit('registerUserSocket', currentUserId); // Register socket with new/updated user ID
        showScreen(homeScreen); // Stay on home after saving username
        showErrorMessage('Username saved successfully!');
    } catch (error) {
        // Error message already handled by apiCall
    }
});


// --- Room Management (Using HTTP for initial actions, then Socket.IO for updates) ---

createRoomBtn.addEventListener('click', async () => {
    if (!currentUserId) {
        showErrorMessage('Please set your username first.');
        return;
    }
    if (!socket.connected) {
        showErrorMessage('Not connected to server. Please wait or refresh.');
        return;
    }
    const difficulty = difficultySelect.value;
    try {
        // Send initial HTTP request to create room
        const roomResult = await apiCall('/api/rooms/create', 'POST', { difficulty });
        currentRoomId = roomResult.roomId;
        // Room state will be received via socket.io `roomUpdate`
        showScreen(lobbyScreen);
        showErrorMessage(`Room ${currentRoomId} created!`);
    } catch (error) {
        // Error message already handled by apiCall
    }
});

joinRoomBtn.addEventListener('click', async () => {
    if (!currentUserId) {
        showErrorMessage('Please set your username first.');
        return;
    }
    if (!socket.connected) {
        showErrorMessage('Not connected to server. Please wait or refresh.');
        return;
    }
    const roomId = roomIdInput.value.trim().toUpperCase();
    if (!roomId) {
        showErrorMessage('Please enter a Room ID.');
        return;
    }
    try {
        // Send initial HTTP request to join room
        const roomResult = await apiCall(`/api/rooms/join/${roomId}`, 'POST');
        currentRoomId = roomResult.roomId;
        // Room state will be received via socket.io `roomUpdate`
        showScreen(lobbyScreen);
        showErrorMessage(`Joined room ${currentRoomId}!`);
    } catch (error) {
        // Error message already handled by apiCall
    }
});

leaveLobbyBtn.addEventListener('click', () => {
    if (!currentRoomId) return;
    if (!socket.connected) {
        showErrorMessage('Not connected to server. Please wait or refresh.');
        return;
    }
    socket.emit('leaveRoom', { roomId: currentRoomId, userId: currentUserId });
    clearInterval(timerInterval);
    currentRoomId = null;
    roomState = null;
    showScreen(homeScreen);
    showErrorMessage('Left lobby.');
});

leaveGameButton.addEventListener('click', () => {
    if (!currentRoomId) return;
    if (!socket.connected) {
        showErrorMessage('Not connected to server. Please wait or refresh.');
        return;
    }
    socket.emit('leaveRoom', { roomId: currentRoomId, userId: currentUserId });
    clearInterval(timerInterval);
    currentRoomId = null;
    roomState = null;
    showScreen(homeScreen);
    showErrorMessage('Left game.');
});


// --- UI Update Logic (driven by Socket.IO 'roomUpdate' event) ---
function updateUI(room) {
    if (room.status === 'waiting' && homeScreen.classList.contains('hidden')) {
        updateLobbyUI(room);
        showScreen(lobbyScreen);
    } else if (room.status === 'playing' && gameScreen.classList.contains('hidden')) {
        showScreen(gameScreen);
        startGameUI(room); // Initialize game screen UI
    } else if (room.status === 'finished' && gameOverScreen.classList.contains('hidden')) {
        showScreen(gameOverScreen);
        updateResultsScreen(room);
        clearInterval(timerInterval); // Stop timer
    }

    // Always update common elements based on current screen
    if (room.status === 'playing') {
        updateGameUI(room);
    }
}

function updateLobbyUI(room) {
    lobbyRoomId.textContent = room.roomId;
    playerList.innerHTML = ''; // Clear existing players
    room.players.forEach(player => {
        const li = document.createElement('li');
        li.textContent = `${player.username} ${player.id === currentUserId ? '(You)' : ''}`;
        playerList.appendChild(li);
    });

    if (room.hostId === currentUserId) {
        lobbyStatus.textContent = `You are the host. Waiting for 2 players...`;
        startGameBtn.classList.toggle('hidden', room.players.length < 2);
    } else {
        lobbyStatus.textContent = `Waiting for host to start the game.`;
        startGameBtn.classList.add('hidden');
    }
}

// --- Game Logic ---
startGameBtn.addEventListener('click', () => {
    if (!currentRoomId || !roomState || roomState.hostId !== currentUserId) {
        showErrorMessage('You are not the host or not in a room.');
        return;
    }
    if (roomState.players.length < 2) {
        showErrorMessage('Need 2 players to start the game.');
        return;
    }
    if (!socket.connected) {
        showErrorMessage('Not connected to server. Please wait or refresh.');
        return;
    }
    socket.emit('startGame', { roomId: currentRoomId, userId: currentUserId });
});

function startGameUI(room) {
    clearInterval(timerInterval); // Ensure no old timer is running
    answerInput.value = ''; // Clear previous answers
    answerInput.disabled = false;
    submitAnswerBtn.disabled = false;
    nextQuestionBtn.classList.add('hidden'); // Only host can see this after round ends
    answerInput.addEventListener('input', updateAnswerCount); // Add event listener for live count
    updateAnswerCount(); // Initial count
    updateGameUI(room); // Update initial game state UI
    // If roundStartTime is updated by server, restart timer
    if (room.roundStartTime) {
        startRoundTimer(room.roundStartTime);
    }
}

function updateGameUI(room) {
    questionCounter.textContent = `${room.currentRound}/${room.maxRounds}`;
    questionText.textContent = room.currentQuestion ? room.currentQuestion.question : 'Loading question...';

    // Update scoreboard
    // Find players and update dynamically
    const playersInOrder = room.players.sort((a,b) => {
        if (a.id === currentUserId) return -1; // Current user first
        if (b.id === currentUserId) return 1;
        return 0; // Maintain existing order for others
    });

    const p1 = playersInOrder[0];
    const p2 = playersInOrder[1];

    if (p1) {
        player1NameGame.textContent = `${p1.username} ${p1.id === currentUserId ? '(You)' : ''}`;
        player1ScoreGame.textContent = p1.score;
        player1AnswerStatus.textContent = p1.hasAnsweredCurrentRound ? 'Answered' : 'Thinking...';
        player1AnswerStatus.className = p1.hasAnsweredCurrentRound ? 'player-status text-green-400' : 'player-status text-yellow-400';
    } else { // Hide if less than 1 player
        player1NameGame.textContent = '';
        player1ScoreGame.textContent = '0';
        player1AnswerStatus.textContent = '';
    }
    
    if (p2) {
        player2NameGame.textContent = `${p2.username} ${p2.id === currentUserId ? '(Opponent)' : ''}`;
        player2ScoreGame.textContent = p2.score;
        player2AnswerStatus.textContent = p2.hasAnsweredCurrentRound ? 'Answered' : 'Thinking...';
        player2AnswerStatus.className = p2.hasAnsweredCurrentRound ? 'player-status text-green-400' : 'player-status text-yellow-400';
    } else { // Hide if less than 2 players
        player2NameGame.textContent = '';
        player2ScoreGame.textContent = '0';
        player2AnswerStatus.textContent = '';
    }

    // Host specific UI for next question button
    const allPlayersAnswered = room.players.every(p => p.hasAnsweredCurrentRound);
    const roundEnded = (Date.now() - room.roundStartTime) >= 15000; // Check if 15 seconds passed based on server time

    if (room.hostId === currentUserId && (allPlayersAnswered || roundEnded)) {
        nextQuestionBtn.classList.remove('hidden');
    } else {
        nextQuestionBtn.classList.add('hidden');
    }

    // Disable input/submit if current user has answered or round time is up
    const currentUserHasAnswered = room.players.find(p => p.id === currentUserId)?.hasAnsweredCurrentRound;
    if (currentUserHasAnswered || roundEnded) {
        answerInput.disabled = true;
        submitAnswerBtn.disabled = true;
    } else {
        answerInput.disabled = false;
        submitAnswerBtn.disabled = false;
    }

    // Restart timer if round has advanced
    if (room.status === 'playing' && room.roundStartTime && (Date.now() - room.roundStartTime) < 15000) {
        startRoundTimer(room.roundStartTime);
    } else if (room.status === 'playing' && (Date.now() - room.roundStartTime) >= 15000) {
        // If time has run out, ensure timer shows 0
        clearInterval(timerInterval);
        timerDisplay.textContent = '0';
    }
}

function startRoundTimer(startTime) {
    clearInterval(timerInterval);
    const roundDuration = 15; // seconds

    timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = roundDuration - elapsed;
        countdownTime = Math.max(0, remaining); // Ensure it doesn't go negative
        timerDisplay.textContent = countdownTime;

        if (countdownTime <= 0) {
            clearInterval(timerInterval);
            timerDisplay.textContent = '0';
            answerInput.disabled = true;
            submitAnswerBtn.disabled = true;
        }
    }, 1000);
}

// Live update answer count for textarea
function updateAnswerCount() {
    const answers = parseAnswers(answerInput.value);
    answerCountDisplay.textContent = `${answers.length}/8 items entered`;
}

submitAnswerBtn.addEventListener('click', () => {
    if (!currentRoomId || !roomState) {
        showErrorMessage('Not in a game room.');
        return;
    }
    if (!socket.connected) {
        showErrorMessage('Not connected to server. Please wait or refresh.');
        return;
    }
    const answers = parseAnswers(answerInput.value);
    if (answers.length === 0) {
        showErrorMessage('Please enter at least one answer.');
        return;
    }
    // Emit submitAnswer event to backend
    socket.emit('submitAnswer', {
        roomId: currentRoomId,
        userId: currentUserId,
        round: roomState.currentRound,
        answers: answers
    });
    // UI will be updated by 'roomUpdate' event from server
    answerInput.disabled = true;
    submitAnswerBtn.disabled = true;
    showErrorMessage('Answers submitted, waiting for opponent/round end.');
});

nextQuestionBtn.addEventListener('click', () => {
    if (!currentRoomId || !roomState || roomState.hostId !== currentUserId) {
        showErrorMessage('You are not the host or not in a room.');
        return;
    }
    if (!socket.connected) {
        showErrorMessage('Not connected to server. Please wait or refresh.');
        return;
    }
    socket.emit('nextRound', { roomId: currentRoomId, userId: currentUserId });
    // UI will be updated by 'roomUpdate' event from server
});


// --- Game Over Screen Logic ---
function updateResultsScreen(room) {
    finalScoresList.innerHTML = '';
    // Sort players by score in descending order
    const sortedPlayers = room.players.sort((a, b) => b.score - a.score);

    sortedPlayers.forEach(player => {
        const li = document.createElement('li');
        li.classList.add('flex', 'justify-between', 'items-center', 'py-2', 'px-4', 'bg-slate-700', 'rounded-lg', 'mb-2');
        li.innerHTML = `
            <span class="text-xl font-medium">${player.username} ${player.id === currentUserId ? '(You)' : ''}:</span>
            <span class="text-2xl font-bold text-green-400">${player.score} points</span>
        `;
        finalScoresList.appendChild(li);
    });

    let winner = null;
    if (sortedPlayers.length > 0) {
        winner = sortedPlayers[0];
        if (sortedPlayers.length > 1 && sortedPlayers[1].score === winner.score) {
            winner = null; // It's a tie
        }
    }

    if (winner) {
        winnerInfo.textContent = winner.id === currentUserId ? "You Win!" : `${winner.username} Wins!`;
    } else {
        winnerInfo.textContent = "It's a Tie!";
    }
}

playAgainButton.addEventListener('click', () => {
    // Reset state for a new game
    currentRoomId = null;
    roomState = null;
    clearInterval(timerInterval);
    // Don't disconnect socket, just prepare for new game
    initializeUser(); // Go back to home screen
});

returnToHomeButton.addEventListener('click', () => {
    // Reset state and go home
    currentRoomId = null;
    roomState = null;
    clearInterval(timerInterval);
    // Don't disconnect socket, just prepare for new game
    initializeUser(); // Go back to home screen
});


// --- Initial Setup ---
document.addEventListener('DOMContentLoaded', initializeUser);