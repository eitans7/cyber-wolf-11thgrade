var socket;
var user;
var amIWolf = false;
var alive = true;
IsGameRunning = true;

const timerDuration = 5000; // Timer duration in milliseconds (5000ms = 5 seconds)
const timerEventName = 'timerCompleted';

document.addEventListener('DOMContentLoaded', (event) => {
    socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port);

    socket.on('connect', function() {
        console.log('Connected to server');
        // Emit an event to the server upon connection
    });

    socket.on('disconnect', function() {
        console.log('Disconnected from server');
        // Here you can notify the user that the connection has been lost, etc.
    });

    socket.on('server_event', function(data) {
        console.log("Full data received:", data);  // Log the entire data object
        let protocolVersionedData = readByProtocol(data); // Define and initialize here
        console.log('Received from server (protocol versioned):', protocolVersionedData);
        console.log('message from server:', protocolVersionedData[3])
        // Sort to functions by data
        if (protocolVersionedData[0] == "registration") {
            registrationHandle(protocolVersionedData)
        }
        if (protocolVersionedData[0] == "set wolf") {
            if (protocolVersionedData[3] == 'you are the wolf') {
                amIWolf = true;
                wolfTitleDisplay(user + ", אתה הוא הזאב");
            }
        }
        if (protocolVersionedData[0] == "start game") {
            if (protocolVersionedData[3] == "the game begins") {
                updateUiState("מצב: יום")
                if (!amIWolf) {
                    humanTitleDisplay(user + ", אתה בן אדם");
                }
                chatInputDisplay();
                startTimer(timerDuration, timerEventName);
            }
        }
        if (protocolVersionedData[0] == "Day" || protocolVersionedData[1] == "הודעת מערכת") {
            if (protocolVersionedData[3] == "It is Day") {
                chatInputDisplay();
                updateUiState("מצב: יום")
                restartTimer()
            } else if (protocolVersionedData[3].includes("כל הכבוד")) {
                humansWon()
                IsGameRunning = false;
                return;
            } else if (protocolVersionedData[3].includes("wolf had won")) {
                wolfWon()
                IsGameRunning = false;
                return;
            } else {
                handleReceivingMessages(protocolVersionedData[1], protocolVersionedData[3])
            }
        }
        if (protocolVersionedData[0] == "Night") {
            if (!amIWolf) {
                updateUiState("מצב: לילה")
                if (protocolVersionedData[3] == "you have been killed") {
                    console.log("killed by wolf set alive to false")
                    alive = false;
                    humanTitleDisplay(user + ", הזאב הרג אותך");
                }
            }
            if (amIWolf) {
                updateUiState("מצב: לילה, זמן להרוג")
                if (protocolVersionedData[3] != "It is Night") {
                    wolf_kill_time(protocolVersionedData[3])
                }
            }
        }
        if (protocolVersionedData[0] == "Vote") {
            if (protocolVersionedData[3] == "Vote Time") {
                updateUiState("מצב: הצבעה")
                handleReceivingMessages("הודעת מערכת", "הצביעו למי שאתם חושבים שהוא הזאב.")
            } else if (alive && protocolVersionedData[1] != "הודעת מערכת" && protocolVersionedData[3] != "you have been eliminated") {
                vote_time(protocolVersionedData[3])
            }
            if (protocolVersionedData[3] == "you have been eliminated") {
                humanTitleDisplay(user + ", הודחת בהצבעת הקבוצה");
                console.log("killed by group. set alive to false")
                alive = false;
            }
        }
    });
});

/**
 * Registers a new user to the game.
 */
function registerUser() {
    const usernameElement = document.getElementById("input_username_id");
    const username = usernameElement.value.trim();
    if (username) {
        if (socket) {
            message = writeByProtocol("registration request", username)
            socket.emit('client_event', {data: message});
            usernameElement.value = '';
        } else {
            console.error('Socket is not defined.');
        }
    }
}

/**
 * Handles user registration response from the server.
 * @param {Array} protocolVersionedData - The data received from the server.
 */
function registrationHandle(protocolVersionedData) {
    if (protocolVersionedData[3] == "success") {
        user = protocolVersionedData[1]
        welcomeMessageDisplay(user + ", ברוך הבא למשחק");
    }
    if (protocolVersionedData[3] == "fail, already exists") {
        alert("שם המשתמש כבר קיים, אנא הכנס שם חדש");
    }
}

/**
 * Sends a chat message to the server.
 */
function sendMessage() {
    const messageInput = document.getElementById("input_message_id");
    const message = messageInput.value.trim();
    if (message) {
        protocolVersionedMessage = writeByProtocol("send message", message)
        socket.emit('client_event', {'data': protocolVersionedMessage});
        messageInput.value = '';
    }
}

/**
 * Handles receiving messages from the server and updates the UI.
 * @param {string} username - The username sending the message.
 * @param {string} message - The message content.
 */
function handleReceivingMessages(username, message) {
    if (message.includes("וניצח")) {
        IsGameRunning = false;
        document.getElementById('votes_content_id').textContent = "המשחק נגמר, בכדי לאתחל אותו יש להפעיל מחדש את השרת.";
    }
    displayMessage(username, message)
}

/**
 * Displays a chat message in the chat box.
 * @param {string} username - The username sending the message.
 * @param {string} message - The message content.
 */
function displayMessage(username, message) {
    if (document.getElementById('chat_box_id').textContent.trim() == "כאן יופיעו הודעות") {
        document.getElementById('chat_box_id').textContent = '';
    }
    const messageElement = document.createElement("p");
    if (username.includes("הודעת מערכת")) {
        messageElement.classList.add("system-message");
        messageElement.textContent = `${username}: ${message}`;
    } else {
        messageElement.textContent = `${username}: ${message}`;
    }
    document.getElementById("chat_box_id").appendChild(messageElement);
}

/**
 * Starts a countdown timer for the game.
 * @param {number} duration - The duration of the timer in milliseconds.
 * @param {string} eventName - The name of the event to dispatch when the timer completes.
 */
function startTimer(duration, eventName) {
    if (IsGameRunning == false) {
        return;
    }
    const endTime = Date.now() + duration;
    const event = new Event(eventName);

    const interval = setInterval(() => {
        const remainingTime = endTime - Date.now();
        if (remainingTime <= 0) {
            clearInterval(interval);
            document.dispatchEvent(event);
            document.getElementById('time_id').textContent = 'נגמר הזמן!';
            timeIsOver()
        } else {
            document.getElementById('time_id').textContent = `זמן שנותר: ${Math.ceil(remainingTime / 1000)} שניות`;
        }
    }, 1000);
}

/**
 * Handles the end of the timer and notifies the server.
 */
function timeIsOver() {
    if (alive) {
        chatInputDisplay();
        message = writeByProtocol('Change State', "Day Is Over")
        socket.emit('client_event', {data: message});
    }
}

/**
 * Restarts the countdown timer.
 */
function restartTimer() {
    startTimer(timerDuration, timerEventName);
}

let selectedUser = null; // Variable to keep track of the currently selected user
let selectedUserElement = null; // Variable to keep track of the currently selected user element

/**
 * Creates a user element based on the user object.
 * @param {Object} userObj - The user object containing username and isAlive status.
 * @returns {HTMLElement} The created user element.
 */
function createUserElement(userObj) {
    const userElement = document.createElement("p");
    userElement.textContent = userObj.username;
    userElement.classList.add('user-item');

    if (userObj.isAlive) {
        userElement.addEventListener('click', () => handleUserSelection(userElement, userObj.username));
    } else {
        userElement.style.pointerEvents = 'none'; // Disable click events
        userElement.style.backgroundColor = 'darkgray'; // Set background color to dark gray
    }

    return userElement;
}

/**
 * Handles the selection of a user during voting or wolf killing phase.
 * @param {HTMLElement} userElement - The HTML element representing the user.
 * @param {string} username - The username of the selected user.
 */
function handleUserSelection(userElement, username) {
    if (selectedUserElement) {
        selectedUserElement.classList.remove('selected');
        selectedUserElement.style.backgroundColor = ''; // Remove background color
    }

    userElement.classList.add('selected');
    userElement.style.backgroundColor = 'lightblue'; // Change background color to light blue

    selectedUserElement = userElement;
    selectedUser = username; // Update the selected user

    document.getElementById('confirm_button_id').style.display = 'block'; // Show the confirm button
}

/**
 * Parses the users string into an array of user objects.
 * @param {string} usersStr - The string containing user information.
 * @returns {Array} The array of user objects.
 */
function parseUsersString(usersStr) {
    return usersStr.split(', ').map(entry => {
        const [username, isAlive] = entry.split(':');
        return { username, isAlive: isAlive === 'True' };
    });
}

/**
 * Displays the list of users for voting or wolf killing.
 * @param {string} usersStr - The string containing user information.
 */
function displayUsers(usersStr) {
    if (IsGameRunning == false) {
        return;
    }
    let votesDiv = document.getElementById('votes_content_id');

    votesDiv.textContent = ''; // Clear existing content

    selectedUser = null; // Reset the selected user
    selectedUserElement = null; // Reset the selected user element

    const usersArray = parseUsersString(usersStr);

    usersArray.forEach(userObj => {
        if (userObj.username === user) {
            return;
        }

        const userElement = createUserElement(userObj);
        votesDiv.appendChild(userElement);
    });
}

/**
 * Confirms the selected user during voting or wolf killing phase.
 */
function confirmSelection() {
    if (selectedUser) {
        const userItems = document.querySelectorAll('.user-item');
        userItems.forEach(item => {
            item.style.pointerEvents = 'none'; // Disable click events
        });

        document.getElementById('confirm_button_id').style.display = 'none';

        if (document.getElementById('state_id').textContent == 'מצב: לילה, זמן להרוג') {
            message = writeByProtocol("Kill By Wolf", selectedUser);
            socket.emit('client_event', {data: message});
            document.getElementById('votes_content_id').textContent = 'הצבעות';
        } else {
            message = writeByProtocol("Voted To", selectedUser);
            socket.emit('client_event', {data: message});
            document.getElementById('votes_content_id').textContent = 'הצבעות';
        }
    } else {
        console.error('No user selected');
    }
}

/**
 * Updates the UI state with the current game phase.
 * @param {string} state - The current game state.
 */
function updateUiState(state) {
    document.getElementById('state_id').textContent = state;
}

/**
 * Handles the wolf's turn to select a user to kill.
 * @param {string} users - The string containing user information.
 */
function wolf_kill_time(users) {
    displayUsers(users)
}

/**
 * Handles the voting phase to select a user to eliminate.
 * @param {string} users - The string containing user information.
 */
function vote_time(users) {
    if (IsGameRunning == false) {
        return;
    }
    displayUsers(users)
}

/**
 * Displays a message indicating that humans have won.
 */
function humansWon() {
    handleReceivingMessages("הודעת מערכת", "בני האדם ניצחו")
}

/**
 * Displays a message indicating that the wolf has won.
 */
function wolfWon() {
    handleReceivingMessages("הודעת מערכת", "הזאב ניצח")
}

/**
 * Formats a message according to the protocol.
 * @param {string} state - The current game state.
 * @param {string} content - The message content.
 * @returns {string} The formatted message.
 */
function writeByProtocol(state, content) {
    const delimiter = '#$#';
    return state + delimiter + user + delimiter + content.length + delimiter + content;
}

/**
 * Parses a message according to the protocol.
 * @param {Object} data - The data received from the server.
 * @returns {Array} The parsed message.
 */
function readByProtocol(data) {
    const delimiter = '#$#';
    message = data.message
    if (typeof message !== 'string') {
        console.error('Invalid input: inputString must be a string', message);
        return []; // Return an empty array if the input isn't a string
    }
    data = message.split(delimiter);
    if (data[2] == String(data[3].length)) {
        return data;
    } else {
        return ["error in data delivery"];
    }
}

/**
 * Displays a welcome message to the user.
 * @param {string} content - The welcome message content.
 */
function welcomeMessageDisplay(content) {
    var welcomeMessage = document.getElementById('welcome_message_id');
    var userTitle = document.getElementById('user_title_id')
    welcomeMessage.style.display = 'block'; // Change display from 'none' to 'block' to show it
    userTitle.style.display = 'none'
    welcomeMessage.textContent = content;
}

/**
 * Displays a message indicating that the user is the wolf.
 * @param {string} content - The message content.
 */
function wolfTitleDisplay(content) {
    var wolfTitle = document.getElementById('wolf_title_id');
    var welcomeMessage = document.getElementById('welcome_message_id')
    wolfTitle.style.display = 'block'; // Change display from 'none' to 'block' to show it
    welcomeMessage.style.display = 'none'
    wolfTitle.textContent = content;
}

/**
 * Displays a message indicating that the user is a human.
 * @param {string} content - The message content.
 */
function humanTitleDisplay(content) {
    var humanTitle = document.getElementById('human_title_id');
    var welcomeMessage = document.getElementById('welcome_message_id')
    humanTitle.style.display = 'block'; // Change display from 'none' to 'block' to show it
    welcomeMessage.style.display = 'none'
    humanTitle.textContent = content;
}

/**
 * Toggles the display of the chat input based on the game state and user status.
 */
function chatInputDisplay() {
    if (IsGameRunning == false) {
        return;
    }
    const chatInput = document.getElementById('chat_input_id');
    if (chatInput.style.display === 'block') {
        chatInput.style.display = 'none'; // Change display from 'block' to 'none' to hide it
    } else if (chatInput.style.display === 'none' && alive) {
        chatInput.style.display = 'block'; // Change display from 'none' to 'block' to show it
    }
}