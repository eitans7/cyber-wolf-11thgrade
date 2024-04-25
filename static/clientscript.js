var socket;
var user;
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
        chatInputDisplay()
    }
    if(protocolVersionedData[3] == "fail, already exists"){
        alert("שם המשתמש כבר קיים, אנא הכנס שם חדש");
    }
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

function chatInputDisplay(){
    document.getElementById('chat_input_id').style.display = 'block'; // Change display from 'none' to 'block' to show it
}

