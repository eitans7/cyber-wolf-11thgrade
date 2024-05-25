var socket;
var user;
var amIWolf = false;

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
        //sort to functions by data
        if (protocolVersionedData[0] == "registration"){
            registrationHandle(protocolVersionedData)
        }
        if (protocolVersionedData[0] == "set wolf"){
            if (protocolVersionedData[3] == 'you are the wolf'){
                amIWolf = true;
                wolfTitleDisplay(user + ", אתה הוא הזאב");
            }
        }
        if (protocolVersionedData[0] == "start game"){
            if (protocolVersionedData[3] == "the game begins"){
                updateUiState("מצב: יום")
                if (amIWolf == false){
                    humanTitleDisplay(user + ", אתה בן אדם");
                }
                chatInputDisplay();
                startTimer(timerDuration, timerEventName);
//            const users = ['User1', 'User2', 'User3'];
//            displayUsers(users);
            }
        }
        if (protocolVersionedData[0] == "Day"){
            handleReceivingMessages(protocolVersionedData[1], protocolVersionedData[3])
        }
        if (protocolVersionedData[0] == "Night"){
            if (!amIWolf){
                updateUiState("מצב: לילה")
            }
            if (amIWolf){
                updateUiState("מצב: לילה, זמן להרוג")
                if (protocolVersionedData[3] != "It is Night"){
                    wolf_kill_time(protocolVersionedData[3])
                }
            }
        }
    });
});

function registerUser() {
    const usernameElement = document.getElementById("input_username_id");
    const username = usernameElement.value.trim();
    if (username) {
        // Ensure that `socket` is defined before trying to use it
        if (socket) {
            message = writeByProtocol("registration request", username)
            socket.emit('client_event', {data: message});
            usernameElement.value = '';
        } else {
            console.error('Socket is not defined.');
        }
    }
}

function registrationHandle(protocolVersionedData){
    if(protocolVersionedData[3] == "success"){
        user = protocolVersionedData[1]
        welcomeMessageDisplay(user + ", ברוך הבא למשחק");
    }
    if(protocolVersionedData[3] == "fail, already exists"){
        alert("שם המשתמש כבר קיים, אנא הכנס שם חדש");
    }
}

function sendMessage(){
    const messageInput = document.getElementById("input_message_id");
    const message = messageInput.value.trim();
    if (message) {
        protocolVersionedMessage = writeByProtocol("send message", message)
        socket.emit('client_event', {'data': protocolVersionedMessage});
        messageInput.value = '';
    }
}

function handleReceivingMessages(username, message){
    displayMessage(username, message)
}

function displayMessage(username, message){
    if (document.getElementById('chat_box_id').textContent.trim() == "כאן יופיעו הודעות"){
        document.getElementById('chat_box_id').textContent = '';
    }
    const messageElement = document.createElement("p");
    messageElement.textContent = `${username}: ${message}`;
    document.getElementById("chat_box_id").appendChild(messageElement);
}

// Define the timer function
function startTimer(duration, eventName) {
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

function timeIsOver(){
    chatInputDisplay();
    message = writeByProtocol('Change State', "Day Is Over")
    socket.emit('client_event', {data: message});
}

function restartTimer() {
    startTimer(timerDuration, timerEventName);
}

let selectedUser = null; // Variable to keep track of the currently selected user

// Function to create a user element
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

// Function to handle user selection
function handleUserSelection(userElement, username) {
    if (selectedUserElement) {
        // Unselect the previously selected user
        selectedUserElement.classList.remove('selected');
        selectedUserElement.style.backgroundColor = ''; // Remove background color
    }

    // Select the new user
    userElement.classList.add('selected');
    userElement.style.backgroundColor = 'lightblue'; // Change background color to light blue

    // Update the reference to the currently selected user
    selectedUserElement = userElement;
    selectedUser = username; // Update the selected user

    document.getElementById('confirm_button_id').style.display = 'block'; // Show the confirm button
}

// Function to parse the users string into an array of user objects
function parseUsersString(usersStr) {
    return usersStr.split(', ').map(entry => {
        const [username, isAlive] = entry.split(':');
        return { username, isAlive: isAlive === 'True' };
    });
}

// Main function to display users
function displayUsers(usersStr) {
    const votesDiv = document.getElementById('votes_content_id');
    votesDiv.innerHTML = ''; // Clear existing content

    selectedUser = null; // Reset the selected user
    selectedUserElement = null; // Variable to keep track of the currently selected user

    const usersArray = parseUsersString(usersStr);

    usersArray.forEach(userObj => {
        // Skip the current user
        if (userObj.username === user) {
            return;
        }

        const userElement = createUserElement(userObj);
        votesDiv.appendChild(userElement);
    });
}


function confirmSelection() {
    if (selectedUser) {
        // Disable further selection
        const userItems = document.querySelectorAll('.user-item');
        userItems.forEach(item => {
            item.style.pointerEvents = 'none'; // Disable click events
        });

        // Hide the confirm button
        document.getElementById('confirm_button_id').style.display = 'none';

        // Return the selected user
        console.log('Selected user:', selectedUser);
        // You can add any additional logic here, like sending the selected user to the server
        return selectedUser;
    } else {
        console.error('No user selected');
        return null;
    }
}

function updateUiState(state){
    document.getElementById('state_id').textContent = state;
}

function wolf_kill_time(users){
    displayUsers(users)
}

function writeByProtocol(state, content) {
    const delimiter = '#$#';
    return state + delimiter + user + delimiter + content.length + delimiter + content;
}

function readByProtocol(data) {
    const delimiter = '#$#';
    message = data.message
    if (typeof message !== 'string') {
        console.error('Invalid input: inputString must be a string', message);
        return []; // Return an empty array if the input isn't a string
    }
    data = message.split(delimiter);
    if (data[2] == String(data[3].length)){
        return data;
    } else {
        return ["error in data delivery"];
    }
}

function welcomeMessageDisplay(content) {
    var welcomeMessage = document.getElementById('welcome_message_id');
    var userTitle = document.getElementById('user_title_id')
    welcomeMessage.style.display = 'block'; // Change display from 'none' to 'block' to show it
    userTitle.style.display = 'none'
    welcomeMessage.textContent = content;
}

function wolfTitleDisplay(content) {
    var wolfTitle = document.getElementById('wolf_title_id');
    var welcomeMessage = document.getElementById('welcome_message_id')
    wolfTitle.style.display = 'block'; // Change display from 'none' to 'block' to show it
    welcomeMessage.style.display = 'none'
    wolfTitle.textContent = content;
}

function humanTitleDisplay(content) {
    var humanTitle = document.getElementById('human_title_id');
    var welcomeMessage = document.getElementById('welcome_message_id')
    humanTitle.style.display = 'block'; // Change display from 'none' to 'block' to show it
    welcomeMessage.style.display = 'none'
    humanTitle.textContent = content;
}

function chatInputDisplay(){
    const chatInput = document.getElementById('chat_input_id');
    if (chatInput.style.display === 'block') {
        chatInput.style.display = 'none'; // Change display from 'block' to 'none' to hide it
    } else {
        chatInput.style.display = 'block'; // Change display from 'none' to 'block' to show it
    }
}

