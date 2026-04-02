from flask import Blueprint, render_template, request, jsonify, redirect, url_for
from flask_login import login_required, current_user, login_user, logout_user
from app.models.song import Song
from app.models.birthday import Birthday
from app.models.announcement import Announcement
from app.models.live import Live
from app.models.live2 import Live2

bp = Blueprint('editor', __name__, url_prefix='/editor')

@bp.route('/login', methods=['GET', 'POST'])
def login():
    return redirect(url_for('auth.login'))

@bp.route('/logout')
def logout():
    logout_user()
    return redirect(url_for('auth.login'))

@bp.route('/')
@login_required
def index():
    return render_template('editor/index.html')

@bp.route('/songs')
@login_required
def songs():
    songs = Song.query.all()
    return render_template('editor/songs.html', songs=songs)

@bp.route('/birthdays')
@login_required
def birthdays():
    birthdays = Birthday.query.order_by(Birthday.birth_month, Birthday.birth_day).all()
    return render_template('editor/birthdays.html', birthdays=birthdays)

@bp.route('/announcements')
@login_required
def announcements():
    announcements = Announcement.query.order_by(Announcement.position).all()
    return render_template('editor/announcements.html', announcements=announcements)

@bp.route('/live')
@login_required
def live():
    lives = Live.query.all()
    return render_template('editor/live.html', lives=lives)

@bp.route('/live2')
@login_required
def live2():
    lives = Live2.query.all()
    return render_template('editor/live2.html', lives=lives)
