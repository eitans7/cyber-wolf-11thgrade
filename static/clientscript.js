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
        let protocol_versioned_data = read_by_protocol(data); // Define and initialize here
        console.log('Received from server (protocol versioned):', protocol_versioned_data);
        console.log('message from server:', protocol_versioned_data[3])
        //sort to functions by data
        if (protocol_versioned_data[0] == "registration"){
            if(protocol_versioned_data[3] == "success"){
                welcome_message_display(protocol_versioned_data[1] + ", ברוך הבא למשחק");
            }
            if(protocol_versioned_data[3] == "fail, already exists"){
                alert("שם המשתמש כבר קיים, אנא הכנס שם חדש");
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
            message = write_by_protocol("registration request", username)
            socket.emit('client_event', {data: message});
            usernameElement.value = '';
        } else {
            console.error('Socket is not defined.');
        }
    }
}

function write_by_protocol(state, content) {
    const delimiter = '#$#';
    return state + delimiter + user + delimiter + content.length + delimiter + content;
}

function read_by_protocol(data) {
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

function welcome_message_display(content) {
    var welcomeMessage = document.getElementById('welcome_message_id');
    var userTitle = document.getElementById('user_title_id')
    welcomeMessage.style.display = 'block'; // Change display from 'none' to 'block' to show it
    userTitle.style.display = 'none'
    welcomeMessage.textContent = content;
}

