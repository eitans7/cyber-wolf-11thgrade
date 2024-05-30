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
            }
        }
        if (protocolVersionedData[0] == "Day" || protocolVersionedData[1] == "הודעת מערכת"){
            if (protocolVersionedData[3] == "It is Day"){
                chatInputDisplay();
                updateUiState("מצב: יום")
                restartTimer()
            }
            else if (protocolVersionedData[3].includes("כל הכבוד")){
                humansWon()
                IsGameRunning = false;
                return;
            }
            else if (protocolVersionedData[3].includes("wolf had won")){
                wolfWon()
                IsGameRunning = false;
                return;
            }
            else{
                handleReceivingMessages(protocolVersionedData[1], protocolVersionedData[3])
            }
        }
        if (protocolVersionedData[0] == "Night"){
            if (!amIWolf){
                updateUiState("מצב: לילה")
                if (protocolVersionedData[3] == "you have been killed"){
                    console.log("killed by wolf set alive to false")
                    alive = false;
                    humanTitleDisplay(user + ", הזאב הרג אותך");
                }
            }
            if (amIWolf){
                updateUiState("מצב: לילה, זמן להרוג")
                if (protocolVersionedData[3] != "It is Night"){
                    wolf_kill_time(protocolVersionedData[3])
                }
            }
        }
        if (protocolVersionedData[0] == "Vote"){
            if (protocolVersionedData[3] == "Vote Time"){
                updateUiState("מצב: הצבעה")
                handleReceivingMessages("הודעת מערכת", "הצביעו למי שאתם חושבים שהוא הזאב.")
            }
            else if(alive && protocolVersionedData[1] != "הודעת מערכת" &&  protocolVersionedData[3] != "you have been eliminated" ){
                vote_time(protocolVersionedData[3])
            }
            if ( protocolVersionedData[3] == "you have been eliminated"){
                humanTitleDisplay(user + ", הודחת בהצבעת הקבוצה");
                console.log("killed by group. set alive to false")
                alive = false;
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
    if (message.includes("וניצח")){
        IsGameRunning = false;
        document.getElementById('votes_content_id').textContent = "המשחק נגמר, בכדי לאתחל אותו יש להפעיל מחדש את השרת.";
    }
    displayMessage(username, message)
}

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


// Define the timer function
function startTimer(duration, eventName) {
    if (IsGameRunning == false){
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

function timeIsOver(){
    if (alive){
        chatInputDisplay();
        message = writeByProtocol('Change State', "Day Is Over")
        socket.emit('client_event', {data: message});
    }
}

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
        // Disable the user element if not alive
        userElement.style.pointerEvents = 'none'; // Disable click events
        userElement.style.backgroundColor = 'darkgray'; // Set background color to dark gray
    }

    return userElement;
}




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



function displayUsers(usersStr) {
    if (IsGameRunning == false){
        return;
    }
    let votesDiv = document.getElementById('votes_content_id');

    votesDiv.textContent = ''; // Clear existing content

    selectedUser = null; // Reset the selected user
    selectedUserElement = null; // Reset the selected user element

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
        if (document.getElementById('state_id').textContent == 'מצב: לילה, זמן להרוג'){
            // send to server the selected user by the wolf
            message = writeByProtocol("Kill By Wolf", selectedUser);
            socket.emit('client_event', {data: message});
            document.getElementById('votes_content_id').textContent = 'הצבעות';
        }
        else{
            // send to server the selected user by the voter
            message = writeByProtocol("Voted To", selectedUser);
            socket.emit('client_event', {data: message});
            document.getElementById('votes_content_id').textContent = 'הצבעות';
        }
        //return selectedUser;
    } else {
        console.error('No user selected');
        //return null;
    }
}

function updateUiState(state){
    document.getElementById('state_id').textContent = state;
}

function wolf_kill_time(users){
     displayUsers(users)
}

function vote_time(users){
    if (IsGameRunning == false){
        return;
    }
     displayUsers(users)
}

function humansWon(){
     handleReceivingMessages("הודעת מערכת", "בני האדם ניצחו")
}

function wolfWon(){
     handleReceivingMessages("הודעת מערכת", "הזאב ניצח")
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
    if (IsGameRunning == false){
        return;
    }
    const chatInput = document.getElementById('chat_input_id');
    if (chatInput.style.display === 'block') {
        chatInput.style.display = 'none'; // Change display from 'block' to 'none' to hide it
    }
    else if (chatInput.style.display === 'none' && alive){
        chatInput.style.display = 'block'; // Change display from 'none' to 'block' to show it
    }
}
