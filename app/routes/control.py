from flask import Blueprint, render_template
from flask_login import login_required

bp = Blueprint('control', __name__)

@bp.route('/')
def root():
    from flask_login import current_user
    from flask import redirect, url_for
    if current_user.is_authenticated:
        if current_user.id == 1:
            return redirect(url_for('control.index'))
        elif current_user.id == 3:
            return redirect(url_for('powerpoint.remote'))
        else:
            return redirect(url_for('editor.index'))
    return redirect(url_for('auth.login'))

@bp.route('/control')
@login_required
def index():
    return render_template('control.html')

@bp.route('/api/settings', methods=['GET', 'POST'])
@login_required
def global_settings():
    from app.models.setting import Setting
    from app import db
    from flask import request, jsonify
    
    if request.method == 'POST':
        data = request.json
        for key, value in data.items():
            setting = Setting.query.get(key)
            if not setting:
                setting = Setting(key=key)
                db.session.add(setting)
            setting.value = str(value)
            
            # If overwrite flag is set, clear individual styles for matching models
            if data.get('overwrite_pins'):
                from app.models.song import Song
                from app.models.live import Live
                from app.models.live2 import Live2
                from app.models.announcement import Announcement
                
                if key == 'lyrics':
                    Song.query.update({Song.style_json: None})
                elif key == 'live-lyrics':
                    Live.query.update({Live.style_json: None})
                elif key == 'live2-lyrics':
                    Live2.query.update({Live2.style_json: None})
                elif key.startswith('announcement-'):
                    Announcement.query.update({Announcement.style_json: None})
        
        db.session.commit()
        return jsonify({'status': 'success'})
    
    # GET
    settings = Setting.query.all()
    return jsonify({s.key: s.value for s in settings})
