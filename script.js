// --- DOM Elements ---
const homeScreen = document.getElementById('home-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const gameOverScreen = document.getElementById('gameOverScreen');
const errorMessage = document.getElementById('error-message'); // Ensure this element exists if used for error messages

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
const finalScoresList = document.getElementById('finalScoresList'); // Corrected ID from 'final-scores'
const winnerInfo = document.getElementById('winnerInfo'); // Corrected ID from 'winner'
const playAgainButton = document.getElementById('playAgainButton');
const returnToHomeButton = document.getElementById('returnToHomeButton');


// --- Game State Variables ---
const BACKEND_URL = 'https://quiz-backend-bs3b.onrender.com'; // Make sure this matches your backend URL
let currentUserId = localStorage.getItem('userId');
let currentUsername = localStorage.getItem('username');
let currentRoomId = null;
let roomState = null; // Stores the current state of the room from the backend
let pollingInterval = null;
let timerInterval = null;
let countdownTime = 0;

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
    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
        setTimeout(() => {
            errorMessage.classList.add('hidden');
        }, 5000); // Hide after 5 seconds
    } else {
        alert("Error: " + message); // Fallback if no error message element
    }
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


// --- API Call Helper ---
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
        showScreen(homeScreen); // Stay on home after saving username
        showErrorMessage('Username saved successfully!');
    } catch (error) {
        // Error message already handled by apiCall
    }
});


// --- Room Management ---

createRoomBtn.addEventListener('click', async () => {
    if (!currentUserId) {
        showErrorMessage('Please set your username first.');
        return;
    }
    const difficulty = difficultySelect.value;
    try {
        const room = await apiCall('/api/rooms/create', 'POST', { difficulty });
        currentRoomId = room.roomId;
        startRoomPolling(currentRoomId);
        showScreen(lobbyScreen);
        updateLobbyUI(room);
    } catch (error) {
        // Error message already handled by apiCall
    }
});

joinRoomBtn.addEventListener('click', async () => {
    if (!currentUserId) {
        showErrorMessage('Please set your username first.');
        return;
    }
    const roomId = roomIdInput.value.trim().toUpperCase();
    if (!roomId) {
        showErrorMessage('Please enter a Room ID.');
        return;
    }
    try {
        const room = await apiCall(`/api/rooms/join/${roomId}`, 'POST');
        currentRoomId = room.roomId;
        startRoomPolling(currentRoomId);
        showScreen(lobbyScreen);
        updateLobbyUI(room);
    } catch (error) {
        // Error message already handled by apiCall
    }
});

leaveLobbyBtn.addEventListener('click', async () => {
    if (!currentRoomId) return;
    try {
        const result = await apiCall(`/api/rooms/${currentRoomId}/leave`, 'POST');
        clearInterval(pollingInterval);
        clearInterval(timerInterval); // Clear timer if it was running
        currentRoomId = null;
        roomState = null;
        showScreen(homeScreen);
        if (result.message === 'Room deleted.') {
            showErrorMessage('Lobby left. Room deleted.');
        } else {
            showErrorMessage('Left lobby successfully.');
        }
    } catch (error) {
        // Error message already handled by apiCall
    }
});

leaveGameButton.addEventListener('click', async () => {
    if (!currentRoomId) return;
    try {
        const result = await apiCall(`/api/rooms/${currentRoomId}/leave`, 'POST');
        clearInterval(pollingInterval);
        clearInterval(timerInterval); // Clear timer
        currentRoomId = null;
        roomState = null;
        showScreen(homeScreen);
        if (result.message === 'Room deleted.') {
            showErrorMessage('Game left. Room deleted.');
        } else {
            showErrorMessage('Left game successfully.');
        }
    } catch (error) {
        // Error message already handled by apiCall
    }
});


// --- Realtime Updates (Polling) ---
function startRoomPolling(roomId) {
    clearInterval(pollingInterval); // Clear any existing interval
    pollingInterval = setInterval(async () => {
        try {
            const room = await apiCall(`/api/rooms/${roomId}`);
            updateUI(room);
        } catch (error) {
            console.error("Polling error:", error);
            // If room not found (e.g., deleted by host), redirect to home
            if (error.message.includes('Room not found')) {
                clearInterval(pollingInterval);
                clearInterval(timerInterval);
                currentRoomId = null;
                roomState = null;
                showScreen(homeScreen);
                showErrorMessage('The room no longer exists or you were removed.');
            }
        }
    }, 1000); // Poll every 1 second
}

function updateUI(room) {
    roomState = room; // Update global room state

    if (room.status === 'waiting' && homeScreen.classList.contains('hidden')) {
        updateLobbyUI(room);
        showScreen(lobbyScreen);
    } else if (room.status === 'playing' && gameScreen.classList.contains('hidden')) {
        showScreen(gameScreen);
        startGameUI(room); // Initialize game screen UI
    } else if (room.status === 'finished' && gameOverScreen.classList.contains('hidden')) {
        showScreen(gameOverScreen);
        updateResultsScreen(room);
        clearInterval(pollingInterval); // Stop polling when game is finished
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
startGameBtn.addEventListener('click', async () => {
    if (!currentRoomId || !roomState || roomState.hostId !== currentUserId) {
        showErrorMessage('You are not the host or not in a room.');
        return;
    }
    if (roomState.players.length < 2) {
        showErrorMessage('Need 2 players to start the game.');
        return;
    }
    try {
        const result = await apiCall(`/api/rooms/${currentRoomId}/start`, 'POST');
        roomState = result.room; // Update local state with the started room
        showScreen(gameScreen);
        startGameUI(roomState);
    } catch (error) {
        // Error message already handled by apiCall
    }
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
    startRoundTimer(room.roundStartTime); // Start the timer for the current round
}

function updateGameUI(room) {
    questionCounter.textContent = `${room.currentRound}/${room.maxRounds}`;
    questionText.textContent = room.currentQuestion ? room.currentQuestion.question : 'Loading question...';

    // Update scoreboard
    const player1 = room.players[0];
    const player2 = room.players[1];

    if (player1) {
        player1NameGame.textContent = `${player1.username} ${player1.id === currentUserId ? '(You)' : ''}`;
        player1ScoreGame.textContent = player1.score;
        player1AnswerStatus.textContent = player1.hasAnsweredCurrentRound ? 'Answered' : 'Thinking...';
        player1AnswerStatus.className = player1.hasAnsweredCurrentRound ? 'player-status text-green-400' : 'player-status text-yellow-400';
    }
    if (player2) {
        player2NameGame.textContent = `${player2.username} ${player2.id === currentUserId ? '(You)' : ''}`;
        player2ScoreGame.textContent = player2.score;
        player2AnswerStatus.textContent = player2.hasAnsweredCurrentRound ? 'Answered' : 'Thinking...';
        player2AnswerStatus.className = player2.hasAnsweredCurrentRound ? 'player-status text-green-400' : 'player-status text-yellow-400';
    }

    // Host specific UI for next question button
    const allPlayersAnswered = room.players.every(p => p.hasAnsweredCurrentRound);
    const roundEnded = (Date.now() - room.roundStartTime) >= 15000; // Check if 15 seconds passed

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
}

function startRoundTimer(startTime) {
    clearInterval(timerInterval);
    const roundDuration = 15; // seconds
    countdownTime = roundDuration; // Reset countdown for new round

    timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = roundDuration - elapsed;
        countdownTime = Math.max(0, remaining); // Ensure it doesn't go negative
        timerDisplay.textContent = countdownTime;

        if (countdownTime <= 0) {
            clearInterval(timerInterval);
            timerDisplay.textContent = '0';
            // Optionally, automatically submit or disable input here if time runs out
            // For now, the backend will determine round end based on its timer or all answers received.
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

submitAnswerBtn.addEventListener('click', async () => {
    if (!currentRoomId || !roomState) {
        showErrorMessage('Not in a game room.');
        return;
    }
    const answers = parseAnswers(answerInput.value);
    if (answers.length === 0) {
        showErrorMessage('Please enter at least one answer.');
        return;
    }
    // Note: The backend expects an array of 8. We send what the user enters, up to 8.
    // Backend will handle scoring based on matches.
    try {
        const result = await apiCall(`/api/rooms/${currentRoomId}/answer`, 'POST', {
            round: roomState.currentRound, // Pass current round
            answers: answers // This sends an ARRAY
        });
        // Update local room state immediately with received score
        roomState = result.room;
        const player = roomState.players.find(p => p.id === currentUserId);
        if (player) {
            player.score = result.scoreEarned; // Update own score for current round
        }
        answerInput.disabled = true;
        submitAnswerBtn.disabled = true;
        updateGameUI(roomState); // Re-render UI based on updated room state
        showErrorMessage(`Submitted! You earned ${result.scoreEarned} points this round.`);

    } catch (error) {
        // Error handled by apiCall
    }
});

nextQuestionBtn.addEventListener('click', async () => {
    if (!currentRoomId || !roomState || roomState.hostId !== currentUserId) {
        showErrorMessage('You are not the host or not in a room.');
        return;
    }
    try {
        const result = await apiCall(`/api/rooms/${currentRoomId}/next-round`, 'POST');
        if (result.room.status === 'finished') {
            showScreen(gameOverScreen);
            updateResultsScreen(result.room);
            clearInterval(pollingInterval);
            clearInterval(timerInterval);
        } else {
            roomState = result.room; // Update local state
            startGameUI(roomState); // Re-initialize game UI for next round
        }
    } catch (error) {
        // Error handled by apiCall
    }
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
    clearInterval(pollingInterval);
    clearInterval(timerInterval);
    initializeUser(); // Go back to home screen
});

returnToHomeButton.addEventListener('click', () => {
    // Reset state and go home
    currentRoomId = null;
    roomState = null;
    clearInterval(pollingInterval);
    clearInterval(timerInterval);
    initializeUser(); // Go back to home screen
});


// --- Initial Setup ---
document.addEventListener('DOMContentLoaded', initializeUser);