# server.py
from flask import Flask, render_template
from flask_socketio import SocketIO, emit
import random
import logging
import os

LOG_FORMAT = '%(levelname)s | %(asctime)s | %(message)s'
LOG_LEVEL = logging.DEBUG
LOG_DIR = 'log'
LOG_FILE = LOG_DIR + '/server.log'


class User:
    def __init__(self, user_id, is_alive=True):
        self.user_id = user_id
        self.user_type = "human"  # Could be 'human', 'wolf'.
        self.is_alive = is_alive  # Active/Inactive status

    def set_user_type(self, user_type):
        self.user_type = user_type

    def set_alive(self, is_alive):
        self.is_alive = is_alive  # Update the user's active status

    def get_user_id(self):
        return self.user_id

    def __str__(self):
        # Returns a string representation of the user
        return f"User ID: {self.user_id}, Type: {self.user_type}, Alive: {self.is_alive}"


class Game:
    def __init__(self):
        self.users_list = []
        self.user_count = 0
        self.state = "registration"
        self.wolf = None

    def add_user(self, new_username):
        if self.state == "registration":
            if not any(user.user_id == new_username for user in self.users_list):
                current_user = User(new_username)
                self.users_list.append(current_user)
                self.user_count += 1
                return True
            else:
                return False

    def set_state(self, state):
        self.state = state

    def get_state(self):
        return self.state

    def set_wolf(self):
        rand_index = random.randrange(len(self.users_list))
        self.wolf = self.users_list[rand_index]

    def __str__(self):
        # Creating a string that describes the game state
        return (f"Game State: {self.state}, "
                f"User Count: {self.user_count}, "
                f"Users: {[user.user_id for user in self.users_list]}, "  # Assumes User objects has a user_id attribute
                f"Wolf: {self.wolf.user_id if self.wolf else 'No wolf assigned'}")


game = Game()
app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app)


@app.route('/')
def index():
    return render_template('client.html')  # Assumes an 'index.html' in the templates folder


@socketio.on('connect')
def handle_connect():
    print('Client connected')
    message = write_by_protocol("undefined user", 'Welcome, user!')
    logging.debug(f"Sending To Client: {message}")
    emit('server_event', {'message': message})


@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')


@socketio.on('client_event')
def handle_client_event(data):
    message = data['data']
    protocol_versioned_data = read_by_protocol(message)
    logging.debug(f"Received From Client: {protocol_versioned_data}")
    # sort to functions by data
    if game.get_state() == "registration" and protocol_versioned_data[0] == "registration":
        handle_registrations(protocol_versioned_data)


def handle_registrations(data_in_list):
    flag = game.add_user(data_in_list[3])
    logging.debug(f"Did user manage to connect: {flag}")
    logging.debug(f"Game current overall state: {game}")
    if flag:
        message = write_by_protocol(data_in_list[3], f'{data_in_list[3]}, registered successfully')
        emit('server_event', {'message': message})
    else:
        message = write_by_protocol(data_in_list[3], f'{data_in_list[3]}, registration failed, please try again')
        emit('server_event', {'message': message})


def read_by_protocol(data):
    recieved_list = data.split('#$#')
    if recieved_list[2] == str(len(recieved_list[3])):
        return recieved_list
    else:
        return ["error in data delivery"]


def write_by_protocol(user_id, message):
    delimiter = '#$#'
    return game.get_state() + delimiter + user_id + delimiter + str(len(message)) + delimiter + message


if __name__ == '__main__':
    if not os.path.isdir(LOG_DIR):
        os.makedirs(LOG_DIR)
    logging.basicConfig(format=LOG_FORMAT, filename=LOG_FILE, level=LOG_LEVEL)
    socketio.run(app, debug=True, host='0.0.0.0', port=8000, log_output=True, use_reloader=True,
                 allow_unsafe_werkzeug=True)
