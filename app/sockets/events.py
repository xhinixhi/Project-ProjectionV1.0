from app import socketio
from flask_socketio import emit

@socketio.on('connect')
def handle_connect():
    print('Client connected')

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

@socketio.on('select_section')
def handle_select_section(data):
    # data expected: { 'content': '...', 'tag': '...', 'song_title': '...' }
    emit('update_slide', data, broadcast=True)

@socketio.on('select_birthday')
def handle_select_birthday(data):
    # data expected: { 'header': '...', 'celebrants': [{...}] }
    emit('update_birthday_slide', data, broadcast=True)

@socketio.on('select_announcement')
def handle_select_announcement(data):
    # data expected: { 'title': '...', 'content': '...' }
    emit('update_announcement_slide', data, broadcast=True)

@socketio.on('style_update')
def handle_style_update(data):
    # data expected: { 'fontFamily': '...', 'fontSize': '...', 'color': '...', 'textShadow': '...', 'textTransform': '...' }
    emit('apply_style', data, broadcast=True)

@socketio.on('video_update')
def handle_video_update(data):
    # data expected: { 'url': '...', 'size': '...' }
    emit('apply_video', data, broadcast=True)

@socketio.on('select_bible')
def handle_select_bible(data):
    # data expected: { 'verse': '...', 'translation': '...', 'content': '...' }
    emit('update_bible_slide', data, broadcast=True)

@socketio.on('clear_output')
def handle_clear_output():
    emit('clear_output', broadcast=True)

@socketio.on('powerpoint_remote_cmd')
def handle_powerpoint_remote_cmd(data):
    emit('powerpoint_remote_cmd_relay', data, broadcast=True)

@socketio.on('powerpoint_state_update')
def handle_powerpoint_state_update(data):
    emit('powerpoint_state_update_relay', data, broadcast=True)

@socketio.on('request_powerpoint_state')
def handle_request_powerpoint_state():
    emit('request_powerpoint_state_relay', broadcast=True)

@socketio.on('powerpoint_pointer_data')
def handle_powerpoint_pointer_data(data):
    # data: { 'active': bool, 'x': float, 'y': float }
    emit('powerpoint_pointer_relay', data, broadcast=True)

@socketio.on('powerpoint_pointer_color_update')
def handle_pointer_color_update(data):
    # data: { 'color': str }
    emit('powerpoint_pointer_color_relay', data, broadcast=True)

@socketio.on('powerpoint_pointer_size_update')
def handle_pointer_size_update(data):
    # data: { 'size': int }
    emit('powerpoint_pointer_size_relay', data, broadcast=True)





