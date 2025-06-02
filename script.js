// --- DOM Elements ---
const homeScreen = document.getElementById('home-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const resultsScreen = document.getElementById('results-screen');
const errorMessage = document.getElementById('error-message');

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

// Game Screen Elements
const questionCounter = document.getElementById('question-counter');
const timerDisplay = document.getElementById('timer');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const scoreboard = document.getElementById('scoreboard');

// Results Screen Elements
const finalScoresList = document.getElementById('final-scores');
const winnerMessage = document.getElementById('winner-message');
const playAgainBtn = document.getElementById('play-again-btn');

// --- Game State (Client-Side) ---
let currentUserId = null;
let currentUsername = localStorage.getItem('username') || ''; // Load from local storage
let currentRoomId = null;
let roomState = null; // Will store the full room data from the server
let timerInterval = null;
let selectedOptionForCurrentQuestion = null; // To highlight user's chosen answer

// --- Server API Base URL ---
// IMPORTANT: Replace with your Render.com backend URL after deployment
const API_BASE_URL = 'https://quiz-backend-bs3b.onrender.com'; // Change to your Render.com URL in production

// --- Utility Functions ---
function showScreen(screenElement) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    screenElement.classList.add('active');
}

function displayError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 5000); // Hide after 5 seconds
}

async function apiCall(endpoint, method = 'GET', data = null) {
    try {
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': currentUserId, // Send user ID with every request
                'X-Username': currentUsername // Send username too
            }
        };
        if (data) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Something went wrong');
        }
        return result;
    } catch (error) {
        console.error('API Call Error:', error);
        displayError(error.message);
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
        // We'll update the username if the user changes it later
        if (response.username) {
            currentUsername = response.username; // Server might return a normalized username
            usernameInput.value = currentUsername;
            localStorage.setItem('username', currentUsername);
        }
    } catch (error) {
        displayError('Failed to initialize user. Please refresh.');
        // Potentially disable buttons if authentication fails
    }
}

// --- Event Handlers ---

saveUsernameBtn.addEventListener('click', async () => {
    const newUsername = usernameInput.value.trim();
    if (newUsername && newUsername !== currentUsername) {
        try {
            await apiCall('/api/user/update-username', 'POST', { newUsername: newUsername });
            currentUsername = newUsername;
            localStorage.setItem('username', currentUsername);
            displayError('Username updated!'); // Using error message for success
            errorMessage.style.backgroundColor = '#48bb78'; // Green for success
            setTimeout(() => errorMessage.style.backgroundColor = '#e53e3e', 2000); // Reset color
        } catch (error) {
            // Error displayed by apiCall
        }
    }
});


createRoomBtn.addEventListener('click', async () => {
    if (!currentUsername) {
        displayError("Please set a username first.");
        return;
    }
    const difficulty = difficultySelect.value;
    try {
        const room = await apiCall('/api/rooms/create', 'POST', { difficulty: difficulty });
        currentRoomId = room.roomId;
        joinRoomUpdates(room);
        showScreen(lobbyScreen);
    } catch (error) {
        // Error displayed by apiCall
    }
});

joinRoomBtn.addEventListener('click', async () => {
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
        joinRoomUpdates(room);
        showScreen(lobbyScreen);
    } catch (error) {
        // Error displayed by apiCall
    }
});

startGameBtn.addEventListener('click', async () => {
    try {
        await apiCall(`/api/rooms/${currentRoomId}/start`, 'POST');
        // Game state will be updated by polling (see below)
    } catch (error) {
        // Error displayed by apiCall
    }
});

optionsContainer.addEventListener('click', async (event) => {
    const target = event.target;
    if (target.classList.contains('option-button') && !target.disabled) {
        const selectedAnswer = target.dataset.option;
        selectedOptionForCurrentQuestion = selectedAnswer; // Store for UI feedback
        // Disable all options immediately to prevent multiple answers
        Array.from(optionsContainer.children).forEach(btn => btn.disabled = true);

        try {
            await apiCall(`/api/rooms/${currentRoomId}/answer`, 'POST', {
                questionIndex: roomState.currentQuestionIndex,
                answer: selectedAnswer
            });
            // Server will handle scoring and game state update
        } catch (error) {
            // Re-enable if API call fails
            Array.from(optionsContainer.children).forEach(btn => btn.disabled = false);
            selectedOptionForCurrentQuestion = null;
        }
    }
});

playAgainBtn.addEventListener('click', () => {
    currentRoomId = null;
    roomState = null;
    clearInterval(timerInterval);
    selectedOptionForCurrentQuestion = null;
    usernameInput.value = currentUsername; // Reset username input
    roomIdInput.value = ''; // Clear room ID input
    showScreen(homeScreen);
});


// --- Game State Polling (Simplified Real-time) ---
// In a real production app, WebSockets (Socket.IO) would be used for true real-time updates.
// For this simple example, we'll poll the server every second.
setInterval(async () => {
    if (currentRoomId && currentUserId) {
        try {
            const room = await apiCall(`/api/rooms/${currentRoomId}`);
            if (room) {
                updateUI(room);
            }
        } catch (error) {
            // Error handling for polling, maybe room was deleted?
            console.warn("Polling failed, room might be gone:", error.message);
            if (currentRoomId) { // Only reset if we were in a room
                currentRoomId = null;
                roomState = null;
                clearInterval(timerInterval);
                showScreen(homeScreen);
                displayError("Disconnected from room.");
            }
        }
    }
}, 1000); // Poll every 1 second

// --- UI Update Functions ---
function updateUI(room) {
    roomState = room; // Update global room state

    switch (room.status) {
        case 'waiting':
            showScreen(lobbyScreen);
            updateLobbyScreen(room);
            break;
        case 'playing':
            showScreen(gameScreen);
            updateGameScreen(room);
            break;
        case 'finished':
            showScreen(resultsScreen);
            updateResultsScreen(room);
            break;
        default:
            showScreen(homeScreen);
            break;
    }
}

function joinRoomUpdates(room) {
    lobbyRoomId.textContent = room.roomId;
    updateLobbyScreen(room);
}

function updateLobbyScreen(room) {
    playerList.innerHTML = room.users.map(u => `<li>${u.username} ${u.id === currentUserId ? '(You)' : ''} ${u.id === room.hostId ? '(Host)' : ''}</li>`).join('');

    const isHost = room.hostId === currentUserId;
    const playersReady = room.users.length === 2;

    startGameBtn.classList.toggle('hidden', !(isHost && playersReady));
    lobbyStatus.textContent = playersReady ? (isHost ? 'Ready to start!' : 'Waiting for host to start...') : 'Waiting for 2nd player...';
}

function updateGameScreen(room) {
    const currentQuestion = room.questions[room.currentQuestionIndex];
    if (!currentQuestion) {
        questionText.textContent = "No questions yet...";
        optionsContainer.innerHTML = '';
        return;
    }

    questionCounter.textContent = `Question ${room.currentQuestionIndex + 1} / ${room.questions.length}`;
    questionText.textContent = currentQuestion.question;

    optionsContainer.innerHTML = ''; // Clear previous options

    // Determine if the current user has already answered this question
    const hasAnswered = room.answersReceived && room.answersReceived[currentUserId] !== undefined;
    selectedOptionForCurrentQuestion = hasAnswered ? room.answersReceived[currentUserId] : null;

    currentQuestion.options.forEach(option => {
        const button = document.createElement('button');
        button.classList.add('option-button');
        button.dataset.option = option;
        button.textContent = option;

        // Visual feedback based on state
        if (hasAnswered) {
            // Show correct answer
            if (option === currentQuestion.correct_answer) {
                button.classList.add('correct');
            }
            // Show my incorrect answer
            else if (selectedOptionForCurrentQuestion === option) {
                button.classList.add('incorrect');
            }
            button.disabled = true; // Disable if already answered
        } else {
             // If not yet answered, but I've clicked something
            if (selectedOptionForCurrentQuestion === option) {
                button.classList.add('selected');
            }
            button.disabled = false; // Enable if not answered
        }

        optionsContainer.appendChild(button);
    });

    // Update Timer
    const timeLeft = Math.max(0, Math.floor((room.timerEndTime - Date.now()) / 1000));
    timerDisplay.textContent = `Time: ${timeLeft}s`;
    if (timeLeft <= 5) {
        timerDisplay.style.color = '#fc8181'; // Red for last 5 seconds
    } else {
        timerDisplay.style.color = '#f6e05e'; // Yellow otherwise
    }


    // Update Scoreboard
    scoreboard.innerHTML = '';
    room.users.forEach(user => {
        const userScore = room.scores[user.id] || 0;
        const scoreDiv = document.createElement('div');
        scoreDiv.innerHTML = `
            <h3>${user.username} ${user.id === currentUserId ? '(You)' : ''}</h3>
            <p>${userScore}</p>
        `;
        scoreboard.appendChild(scoreDiv);
    });
}

function updateResultsScreen(room) {
    finalScoresList.innerHTML = '';
    const players = Object.keys(room.scores).map(id => ({
        id: id,
        username: room.users.find(u => u.id === id)?.username || `Unknown User (${id.substring(0, 4)})`,
        score: room.scores[id]
    })).sort((a, b) => b.score - a.score); // Sort by score descending

    players.forEach(player => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${player.username}:</span> ${player.score} points`;
        finalScoresList.appendChild(li);
    });

    let winner = null;
    if (players.length > 0) {
        winner = players[0];
        if (players.length > 1 && players[1].score === winner.score) {
            winner = null; // It's a tie
        }
    }

    if (winner) {
        winnerMessage.textContent = winner.id === currentUserId ? "You Win!" : `${winner.username} Wins!`;
        winnerMessage.style.color = '#48bb78'; // Green
    } else {
        winnerMessage.textContent = "It's a Tie!";
        winnerMessage.style.color = '#667eea'; // Indigo
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initializeUser);