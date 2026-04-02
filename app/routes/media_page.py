from flask import Blueprint, render_template, redirect, url_for
from flask_login import login_required, current_user

bp = Blueprint('media_page', __name__, url_prefix='/media')

@bp.route('/')
@login_required
def index():
    # Only allow admin
    if current_user.id != 1:
        return redirect(url_for('control.index'))
    return render_template('media.html')
