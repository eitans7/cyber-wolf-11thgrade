var socket;
var user;
document.addEventListener('DOMContentLoaded', (event) => {
    socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port);

    socket.on('connect', function() {
        console.log('Connected to server');
        // Emit an event to the server upon connection
        message = write_by_protocol("connect", "Connected Successfully")
        socket.emit('client_event', {data: message});
    });

    socket.on('disconnect', function() {
        console.log('Disconnected from server');
        // Here you can notify the user that the connection has been lost, etc.
    });

    socket.on('server_event', function(data) {
        console.log('Received from server:', data);
    });
});

function registerUser() {
    const usernameElement = document.getElementById("input_username_id");
    const username = usernameElement.value.trim();
    if (username) {
        // Ensure that `socket` is defined before trying to use it
        if (socket) {
            message = write_by_protocol("registration", username)
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
