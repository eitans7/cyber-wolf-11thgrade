var socket;
var user;
var amIWolf = false;
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
                if (amIWolf == false){
                    humanTitleDisplay(user + ", אתה בן אדם");
                }
                chatInputDisplay();
            }
        }
        if (protocolVersionedData[0] == "day"){
            handleReceivingMessages(protocolVersionedData[1], protocolVersionedData[3])
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
    document.getElementById('chat_input_id').style.display = 'block'; // Change display from 'none' to 'block' to show it
}

