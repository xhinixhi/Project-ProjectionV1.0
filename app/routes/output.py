from flask import Blueprint, render_template

bp = Blueprint('output', __name__)

@bp.route('/output')
def index():
    from app.models.setting import Setting
    import json
    settings_data = Setting.query.all()
    # Create the settings dictionary from JSON strings
    settings = {}
    for s in settings_data:
        try:
            if s.value.startswith('{'):
                settings[s.key] = json.loads(s.value)
        except: pass
    return render_template('output.html', settings=settings)
