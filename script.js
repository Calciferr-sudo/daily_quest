// --- DOM Elements ---
const homeScreen = document.getElementById('home-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const gameOverScreen = document.getElementById('gameOverScreen');
const errorMessageDisplay = document.getElementById('error-message');
const notificationMessageDisplay = document.getElementById('notification-message');

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
const optionsContainer = document.getElementById('options-container');
const leaveGameButton = document.getElementById('leaveGameButton');

// Game Over Screen Elements
const finalScoresList = document.getElementById('finalScoresList'); // Corrected ID usage
const winnerInfo = document.getElementById('winnerInfo');
const playAgainButton = document.getElementById('playAgainButton');
const returnToHomeButton = document.getElementById('returnToHomeButton');


// --- Game State Variables ---
let currentUserId = localStorage.getItem('userId');
let currentUsername = localStorage.getItem('username');
let currentRoomId = null;
let roomState = null; // Stores the latest room state from the backend
let socket = null; // Socket.IO client instance
let timerInterval = null; // For the game timer
let selectedAnswer = null; // To track the user's selected answer

// --- Configuration ---
const backendUrl = 'https://quiz-backend-4u7t.onrender.com'; // Your Render backend URL


// --- Screen Management ---
function showScreen(screen) {
    homeScreen.classList.add('hidden');
    lobbyScreen.classList.add('hidden');
    gameScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    screen.classList.remove('hidden');
}

// Function to display error messages
function showErrorMessage(message) {
    if (errorMessageDisplay) {
        errorMessageDisplay.textContent = message;
        errorMessageDisplay.classList.remove('hidden');
        // Hide notification message if an error comes up
        if (notificationMessageDisplay && !notificationMessageDisplay.classList.contains('hidden')) {
            notificationMessageDisplay.classList.add('hidden');
        }
        setTimeout(() => {
            errorMessageDisplay.classList.add('hidden');
        }, 5000);
    }
}

// Function to display general notifications (not errors)
function showNotification(message) {
    if (notificationMessageDisplay) {
        notificationMessageDisplay.textContent = message;
        notificationMessageDisplay.classList.remove('hidden');
        // Hide error message if a notification comes up
        if (errorMessageDisplay && !errorMessageDisplay.classList.contains('hidden')) {
            errorMessageDisplay.classList.add('hidden');
        }
        setTimeout(() => {
            notificationMessageDisplay.classList.add('hidden');
        }, 5000);
    }
}


// --- API Helper ---
async function apiCall(url, method = 'GET', body = null) {
    try {
        const headers = {
            'Content-Type': 'application/json',
            'X-User-Id': currentUserId, // Include user ID in headers
            'X-Username': currentUsername // Include username in headers
        };
        const response = await fetch(backendUrl + url, {
            method: method,
            headers: headers,
            body: body ? JSON.stringify(body) : null
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('API Error:', errorData);

            if (response.status === 400) {
                showNotification(errorData.message || 'Action failed.');
                return Promise.reject(new Error(errorData.message || 'Bad Request'));
            } else {
                throw new Error(errorData.message || 'API call failed');
            }
        }

        return await response.json();
    } catch (error) {
        console.error('Network or API call failed:', error);
        showErrorMessage("Network or API Error: " + error.message);
        throw error;
    }
}

// --- Socket.IO Setup ---
function setupSocket(roomId) {
    if (socket) {
        socket.disconnect(); // Disconnect existing socket if any
    }
    // Connect to your backend's Socket.IO server
    socket = io(backendUrl, {
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        transports: ['polling', 'websocket']
    });

    socket.on('connect', () => {
        console.log('Socket.IO connected:', socket.id);
        socket.emit('joinRoomSocket', { roomId, userId: currentUserId });
    });

    socket.on('connect_error', (error) => {
        console.error('Socket.IO connection error:', error.message);
        showErrorMessage('Socket connection error: ' + error.message);
    });

    socket.on('disconnect', (reason) => {
        console.log('Socket.IO disconnected:', reason);
        if (reason === 'io server disconnect') {
            showErrorMessage('Disconnected from server. Room may have been deleted.');
            resetGameAndGoHome();
        } else {
            showErrorMessage('Lost connection to game server. Attempting to reconnect...');
        }
    });

    socket.on('roomState', (room) => {
        console.log('Received roomState update:', room);
        roomState = room;

        // Update UI based on room status
        if (roomState.status === 'waiting') {
            showScreen(lobbyScreen);
            updateLobbyScreen(roomState);
        } else if (roomState.status === 'playing') {
            showScreen(gameScreen);
            updateGameScreen(roomState);
            startClientTimer(roomState.roundStartTime);
        } else if (roomState.status === 'finished') {
            showScreen(gameOverScreen);
            updateResultsScreen(roomState);
            clearInterval(timerInterval);
        }
    });

    socket.on('roomDeleted', (data) => {
        console.warn('Room deleted:', data.message);
        showErrorMessage(data.message || 'The room you were in has been deleted.');
        resetGameAndGoHome();
    });

    socket.on('error', (data) => {
        console.error('Socket error event:', data);
        showErrorMessage(data.message || 'An unexpected socket error occurred.');
    });
}

// --- Game UI Updates ---

function updateLobbyScreen(room) {
    lobbyRoomId.textContent = room.roomId;
    playerList.innerHTML = '';
    room.players.forEach(player => {
        const li = document.createElement('li');
        li.textContent = `${player.username} ${player.id === room.hostId ? '(Host)' : ''} ${player.id === currentUserId ? '(You)' : ''}`;
        playerList.appendChild(li);
    });

    if (room.hostId === currentUserId) {
        startGameBtn.classList.remove('hidden');
        lobbyStatus.textContent = `You are the host. Waiting for players... (${room.players.length}/2)`;
        if (room.players.length >= 2) {
            startGameBtn.disabled = false;
        } else {
            startGameBtn.disabled = true;
        }
    } else {
        startGameBtn.classList.add('hidden');
        lobbyStatus.textContent = `Waiting for host to start game... (${room.players.length}/2)`;
    }
}

function updateGameScreen(room) {
    console.log('Updating game screen with room:', room);
    if (!room.questions || room.questions.length === 0) {
        console.error("No questions found in room state!");
        questionText.textContent = "Error: No questions loaded. Please ask the host to restart the game.";
        optionsContainer.innerHTML = '';
        return;
    }

    const currentQuestion = room.questions[room.currentQuestionIndex];
    console.log('Current Question to display:', currentQuestion);

    if (currentQuestion) {
        questionCounter.textContent = `Question ${room.currentQuestionIndex + 1} of ${room.maxRounds}`;
        questionText.textContent = currentQuestion.question;

        optionsContainer.innerHTML = '';
        selectedAnswer = null; // Reset selected answer for new question

        currentQuestion.answers.forEach(answer => {
            const button = document.createElement('button');
            button.textContent = answer;
            button.classList.add('btn', 'options-grid-item', 'option-button', 'w-full');
            button.addEventListener('click', () => selectAnswer(answer));
            optionsContainer.appendChild(button);
        });

        const player = room.players.find(p => p.id === currentUserId);
        if (player && player.hasAnsweredCurrentRound) {
            disableAnswerOptions();
            highlightSelectedAnswer(room.answersReceived[currentUserId]);
        } else {
            enableAnswerOptions();
        }
    } else {
        console.error("currentQuestion is undefined in updateGameScreen!", room.currentQuestionIndex, room.questions);
        questionText.textContent = "Error: Question data is missing.";
        optionsContainer.innerHTML = '';
    }

    updateScoreboard(room);
}

function updateScoreboard(room) {
    const player1NameGame = document.getElementById('player1NameGame');
    const player1ScoreGame = document.getElementById('player1ScoreGame');
    const player1AnswerStatus = document.getElementById('player1AnswerStatus');
    const player2NameGame = document.getElementById('player2NameGame');
    const player2ScoreGame = document.getElementById('player2ScoreGame');
    const player2AnswerStatus = document.getElementById('player2AnswerStatus');

    const player1 = room.players[0];
    const player2 = room.players[1];

    if (player1) {
        player1NameGame.textContent = player1.username + (player1.id === currentUserId ? ' (You)' : '');
        player1ScoreGame.textContent = player1.score;
        player1AnswerStatus.textContent = player1.hasAnsweredCurrentRound ? 'Answered' : 'Thinking...';
        player1AnswerStatus.style.color = player1.hasAnsweredCurrentRound ? '#48bb78' : '#a0aec0';
    } else {
        player1NameGame.textContent = 'Player 1';
        player1ScoreGame.textContent = '0';
        player1AnswerStatus.textContent = 'Waiting...';
    }

    if (player2) {
        player2NameGame.textContent = player2.username + (player2.id === currentUserId ? ' (You)' : '');
        player2ScoreGame.textContent = player2.score;
        player2AnswerStatus.textContent = player2.hasAnsweredCurrentRound ? 'Answered' : 'Thinking...';
        player2AnswerStatus.style.color = player2.hasAnsweredCurrentRound ? '#48bb78' : '#a0aec0';
    } else {
        player2NameGame.textContent = 'Player 2';
        player2ScoreGame.textContent = '0';
        player2AnswerStatus.textContent = 'Waiting...';
    }
}


function updateResultsScreen(room) {
    finalScoresList.innerHTML = '';
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


// --- Game Logic ---

function selectAnswer(answer) {
    selectedAnswer = answer;
    Array.from(optionsContainer.children).forEach(button => {
        button.classList.remove('selected');
        button.disabled = true;
        if (button.textContent === answer) {
            button.classList.add('selected');
        }
    });
    submitAnswer(answer);
}

function disableAnswerOptions() {
    Array.from(optionsContainer.children).forEach(button => {
        button.disabled = true;
    });
}

function enableAnswerOptions() {
    Array.from(optionsContainer.children).forEach(button => {
        button.disabled = false;
        button.classList.remove('selected', 'correct', 'incorrect');
    });
}

function highlightSelectedAnswer(answer) {
    Array.from(optionsContainer.children).forEach(button => {
        if (button.textContent === answer) {
            button.classList.add('selected');
        }
    });
}


async function submitAnswer(answer) {
    if (!currentRoomId || !currentUserId || !answer) {
        console.error("Cannot submit answer: Missing room ID, user ID, or answer.");
        showErrorMessage("Could not submit answer. Please try again.");
        return;
    }
    try {
        const response = await apiCall(`/api/rooms/${currentRoomId}/answer`, 'POST', { answer });
        console.log('Answer submission response:', response);
    } catch (error) {
        console.error("Error submitting answer:", error.message);
    }
}

function startClientTimer(endTime) {
    clearInterval(timerInterval);
    const countdownElement = timerDisplay;

    const updateTimer = () => {
        const now = Date.now();
        const timeLeft = Math.max(0, Math.floor((endTime - now) / 1000));

        countdownElement.textContent = `Time Left: ${timeLeft}s`;

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            countdownElement.textContent = 'Time Up!';
            disableAnswerOptions();
        }
    };

    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
}

function resetGameAndGoHome() {
    clearInterval(timerInterval);
    currentRoomId = null;
    roomState = null;
    if (socket) {
        socket.disconnect();
        socket = null; // Clear the socket instance
    }
    initializeUser(); // Go back to home screen
}


// --- Event Listeners ---

// Home Screen Actions
saveUsernameBtn.addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    if (username.length >= 3) {
        try {
            const data = await apiCall('/api/auth/anonymous', 'POST', { username });
            currentUserId = data.userId;
            currentUsername = data.username;
            localStorage.setItem('userId', currentUserId);
            localStorage.setItem('username', currentUsername);
            showNotification(`Username saved: ${currentUsername}!`);
            // No screen change here, user remains on home screen to choose next action
        } catch (error) {
            console.error('Authentication error:', error.message);
        }
    } else {
        showErrorMessage("Username must be at least 3 characters long.");
    }
});

createRoomBtn.addEventListener('click', async () => {
    if (!currentUserId) {
        showErrorMessage("Please save your username first.");
        return;
    }
    const difficulty = difficultySelect.value;
    try {
        const response = await apiCall('/api/rooms', 'POST', { difficulty });
        currentRoomId = response.roomId;
        setupSocket(currentRoomId);
        showNotification(`Room ${currentRoomId} created! Waiting for players...`);
    } catch (error) {
        console.error('Error creating room:', error.message);
    }
});

joinRoomBtn.addEventListener('click', async () => {
    if (!currentUserId) {
        showErrorMessage("Please save your username first.");
        return;
    }
    const enteredRoomId = roomIdInput.value.trim();
    if (enteredRoomId.length !== 6) {
        showErrorMessage("Room ID must be 6 characters long.");
        return;
    }
    try {
        const response = await apiCall('/api/rooms/join', 'POST', { roomId: enteredRoomId });
        currentRoomId = response.roomId;
        setupSocket(currentRoomId);
        showNotification(`Joined room ${currentRoomId}!`);
    } catch (error) {
        console.error('Error joining room:', error.message);
    }
});

// Lobby Screen Actions
startGameBtn.addEventListener('click', async () => {
    if (!currentRoomId) {
        showErrorMessage("You must be in a room to start the game.");
        return;
    }
    try {
        const response = await apiCall(`/api/rooms/${currentRoomId}/start`, 'POST');
        console.log("Game start request sent. Waiting for room state update.");
    } catch (error) {
        console.error("Error starting game:", error.message);
    }
});

leaveLobbyBtn.addEventListener('click', async () => {
    if (!currentRoomId) {
        showErrorMessage("No room to leave."); // More specific message
        return;
    }
    try {
        const response = await apiCall(`/api/rooms/${currentRoomId}/leave`, 'POST');
        console.log(response.message);
        showNotification('You have left the room.');
        resetGameAndGoHome();
    } catch (error) {
        console.error("Error leaving room:", error.message);
    }
});

// Game Screen Actions
leaveGameButton.addEventListener('click', async () => {
    if (!currentRoomId) {
        showErrorMessage("No game in progress to leave.");
        return;
    }
    try {
        const response = await apiCall(`/api/rooms/${currentRoomId}/leave`, 'POST');
        console.log(response.message);
        showNotification('You have left the game.');
        resetGameAndGoHome();
    }
    catch (error) {
        console.error("Error leaving game:", error.message);
    }
});

// Game Over Screen Actions
playAgainButton.addEventListener('click', () => {
    resetGameAndGoHome(); // Resets state and goes to home
});

returnToHomeButton.addEventListener('click', () => {
    resetGameAndGoHome(); // Resets state and goes to home
});


// --- Initialization ---
function initializeUser() {
    // Always show the home screen first
    showScreen(homeScreen);

    // If user data exists in localStorage, pre-fill username input
    if (currentUserId && currentUsername) {
        usernameInput.value = currentUsername;
        showNotification(`Welcome back, ${currentUsername}!`);
    } else {
        usernameInput.value = ''; // Clear username input for new users
    }
}

// Call initialize when script loads
initializeUser();