# server.py
from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit
import random
import logging
import os
from collections import Counter


LOG_FORMAT = '%(levelname)s | %(asctime)s | %(message)s'
LOG_LEVEL = logging.DEBUG
LOG_DIR = 'log'
LOG_FILE = LOG_DIR + '/server.log'


class User:
    def __init__(self, user_id, session_id, is_alive=True):
        self.user_id = user_id
        self.session_id = session_id  # Store the session ID when the user connects
        self.user_type = "human"  # Could be 'human', 'wolf'.
        self.is_alive = is_alive  # Active/Inactive status
        self.user_state = "registered"

    def set_user_type(self, user_type):
        self.user_type = user_type

    def kill(self):
        self.is_alive = False  # Update the user's active status

    def is_alive(self):
        return self.is_alive

    def get_user_id(self):
        return self.user_id

    def get_session_id(self):
        return self.session_id

    def get_user_state(self):
        return self.user_state

    def set_user_state(self, user_state):
        self.user_state = user_state

    def __str__(self):
        # Returns a string representation of the user
        return f"User ID: {self.user_id}, Type: {self.user_type}, Alive: {self.is_alive}"


class Game:
    MAX_USERS = 5

    def __init__(self):
        self.users_list = []
        self.user_count = 0
        self.state = "registration"
        self.wolf = None
        self.alive_user_count = 0
        self.votes = []

    def add_user(self, new_username, sid):
        if self.state == "registration":
            if not any(user.user_id == new_username for user in self.users_list):
                current_user = User(new_username, sid)
                self.users_list.append(current_user)
                self.user_count += 1
                self.alive_user_count += 1
                return True
        return False

    def set_state(self, state):
        self.state = state
        for user in self.users_list:
            user.set_user_state(state)

    def get_state(self):
        return self.state

    def set_wolf(self):
        rand_index = random.randrange(len(self.users_list))
        self.wolf = self.users_list[rand_index]

    def get_wolf(self):
        return self.wolf

    def get_user_count(self):
        return self.user_count

    def get_users_list(self):
        return [{"username": user.get_user_id(), "is_alive": user.is_alive} for user in self.users_list]

    def get_users_list_str(self):
        users_list = self.get_users_list()
        return ", ".join([f"{user['username']}:{user['is_alive']}" for user in users_list])

    def set_user_state(self, username, state):
        for user in self.users_list:
            if user.get_user_id() == username:
                user.set_user_state(state)
        counter = 0
        for user in self.users_list:
            if user.get_user_state() == state and user.is_alive:
                counter += 1
        if counter == game.alive_user_count:
            game.set_state(state)

    def kill_user(self, username):
        for user in self.users_list:
            if user.get_user_id() == username:
                user.kill()
                self.alive_user_count -= 1

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


@app.route('/docs')
def docs():
    return render_template('documentation.html')


@socketio.on('connect')
def handle_connect():
    session_id = request.sid  # the warnning is an issue in the IDE
    print('Client connected, session:', session_id)
    message = write_by_protocol("undefined user", 'Welcome, user!')
    logging.debug(f"Sending To Client: {message}")
    emit('server_event', {'message': message})


@socketio.on('disconnect')
def handle_disconnect():
    sid = request.sid  # Get the session ID of the disconnected client
    print(f'Client disconnected: {sid}')
    username = ''
    # Locate the user by session ID and mark them as dead
    for user in game.users_list:
        if user.get_session_id() == sid:
            username = user.get_user_id()
            game.kill_user(username)
            print(f'User {user.get_user_id()} has been killed due to disconnection.')
            break

    message = write_by_protocol("הודעת מערכת", f"המשתמש {username} פרש מהמשחק.")
    emit('server_event', {'message': message}, broadcast=True)


@socketio.on('client_event')
def handle_client_event(data):
    if game.get_state() == "GameOver":
        logging.debug("Game is over, stopping execution")
        return
    message = data['data']
    protocol_versioned_data = read_by_protocol(message)
    logging.debug(f"Received From Client: {protocol_versioned_data}")
    # sort to functions by data
    if game.get_state() == "GameOver":
        return
    if protocol_versioned_data[0] == "registration request" and game.get_state() == "registration":
        handle_registrations(protocol_versioned_data)
    if protocol_versioned_data[0] == "send message":
        handle_chat_messages(protocol_versioned_data)
    if protocol_versioned_data[0] == "Change State":
        if protocol_versioned_data[3] == "Day Is Over":
            if game.alive_user_count == game.MAX_USERS:
                day_is_over(protocol_versioned_data[1])
                if game.get_state() == "Night":
                    message = write_by_protocol("broadcast", "It is Night")
                    emit('server_event', {'message': message}, broadcast=True)
                    wolf_kill_time()
            else:
                vote_state(protocol_versioned_data[1])
                if game.get_state() == "Vote":
                    message = write_by_protocol("broadcast", "Vote Time")
                    emit('server_event', {'message': message}, broadcast=True)
                    vote_time()

    if protocol_versioned_data[0] == "Kill By Wolf":
        game.kill_user(protocol_versioned_data[3])
        killed_user = None
        for user in game.users_list:
            if user.get_user_id() == protocol_versioned_data[3]:
                killed_user = user
        if killed_user:
            content = write_by_protocol(killed_user.get_user_id(), "you have been killed")
            emit_to_user(killed_user, content)
        if game.alive_user_count == 2:
            message = write_by_protocol("הודעת מערכת",
                                        f"הזאב רצח בלילה את {protocol_versioned_data[3]} וניצח. הזאב היה: {game.get_wolf().get_user_id()}")
            emit('server_event', {'message': message}, broadcast=True)
            game.set_state("GameOver")
            return
        game.set_state("Day")
        emit('server_event', {'message': write_by_protocol("broadcast",
                                                           "It is Day")}, broadcast=True)

        logging.debug(f"User killed by wolf: {protocol_versioned_data[3]}")
        message = write_by_protocol("הודעת מערכת", f"הזאב רצח בלילה את {protocol_versioned_data[3]}")
        emit('server_event', {'message': message}, broadcast=True)
        # check if wolf won

    if protocol_versioned_data[0] == "Voted To":
        game.votes.append(protocol_versioned_data[3])
        if len(game.votes) == game.alive_user_count:
            counter = Counter(game.votes)
            selected_user, appears_count = counter.most_common(1)[0]
            if appears_count > game.alive_user_count/2:
                game.kill_user(selected_user)
                content = write_by_protocol(selected_user, "you have been eliminated")
                selected_user_obj = None
                for user in game.users_list:
                    if user.get_user_id() == selected_user:
                        selected_user_obj = user
                emit_to_user(selected_user_obj, content)
                # game.set_state("Day")
                if game.get_wolf() == selected_user_obj:
                    message = write_by_protocol("הודעת מערכת",
                                                f"כל הכבוד, הקבוצה ניצחה והדיחה את הזאב : {selected_user}")
                    emit('server_event', {'message': message}, broadcast=True)
                    game.set_state("GameOver")
                else:
                    message = write_by_protocol("הודעת מערכת",
                                                f"הקבוצה הדיחה בן אדם, המודח הוא : {selected_user}")
                    emit('server_event', {'message': message}, broadcast=True)
                    game.votes = []
                    game.set_state("Night")
                    if game.alive_user_count > 2:
                        message = write_by_protocol("broadcast", "It is Night")
                        emit('server_event', {'message': message}, broadcast=True)
                        wolf_kill_time()
                    if game.alive_user_count == 2:
                        message = write_by_protocol("הודעת מערכת",
                                                    f"הזאב ניצח. הזאב היה: {game.get_wolf().get_user_id()}")
                        emit('server_event', {'message': message}, broadcast=True)
                        game.set_state("GameOver")
                        return
            else:
                message = write_by_protocol("הודעת מערכת", f"הקבוצה לא הגיעה להסכמה על מועמד להדחה.")
                emit('server_event', {'message': message}, broadcast=True)
                game.votes = []
                game.set_state("Night")
                message = write_by_protocol("broadcast", "It is Night")
                emit('server_event', {'message': message}, broadcast=True)
                wolf_kill_time()


def handle_registrations(data_in_list):
    session_id = request.sid  # the warnning is an issue in the IDE
    flag = game.add_user(data_in_list[3], session_id)
    logging.debug(f"Did user manage to connect: {flag}")
    logging.debug(f"Game current overall state: {game}")
    if flag:
        message = write_by_protocol(data_in_list[3], 'success')
        emit('server_event', {'message': message})
        if game.get_user_count() == Game.MAX_USERS:
            start_game()
    else:
        message = write_by_protocol("undefined user", 'fail, already exists')
        emit('server_event', {'message': message})


def start_game():
    set_wolf_stage()
    game.set_state("start game")
    message = write_by_protocol("broadcast", "the game begins")
    emit('server_event', {'message': message}, broadcast=True)
    game.set_state("Day")


def day_is_over(username):
    game.set_user_state(username, "Night")


def vote_state(username):
    game.set_user_state(username, "Vote")


def emit_to_user(user, message):
    if user:
        emit('server_event', {'message': message}, to=user.get_session_id())
    else:
        print("User not found")


def set_wolf_stage():
    game.set_state("set wolf")
    game.set_wolf()
    wolf = game.get_wolf()
    message = write_by_protocol(wolf.get_user_id(), "you are the wolf")
    emit_to_user(wolf, message)


def wolf_kill_time():
    users_list = game.get_users_list_str()
    message = write_by_protocol(game.get_wolf().get_user_id(), users_list)
    emit_to_user(game.get_wolf(), message)


def vote_time():
    users_list = game.get_users_list_str()
    message = write_by_protocol("broadcast", users_list)
    emit('server_event', {'message': message}, broadcast=True)


def handle_chat_messages(protocol_versioned_data):
    message = protocol_versioned_data[3]
    username = protocol_versioned_data[1]
    protocol_versioned_message = write_by_protocol(username, message)
    emit('server_event', {'message': protocol_versioned_message}, broadcast=True)


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
