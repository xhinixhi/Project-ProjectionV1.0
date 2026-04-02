from flask import Blueprint, request, jsonify, render_template, redirect, url_for
from app.models.announcement import Announcement
from app import db
from flask_login import login_required

bp = Blueprint('announcements', __name__, url_prefix='/announcements')

@bp.route('/')
@login_required
def index():
    return render_template('announcement_manager.html')

@bp.route('/data')
@login_required
def get_announcements():
    announcements = Announcement.query.order_by(Announcement.position).all()
    return jsonify([{
        'id': a.id,
        'title': a.title,
        'header': a.header,
        'content': a.content,
        'is_active': a.is_active,
        'media_url': a.media_url,
        'media_type': a.media_type,
        'style_json': a.style_json,
        'position': a.position
    } for a in announcements])

@bp.route('/<int:id>/update_style', methods=['POST'])
@login_required
def update_style(id):
    a = Announcement.query.get_or_404(id)
    data = request.json
    a.style_json = data.get('style')
    db.session.commit()
    return jsonify({'status': 'success'})

@bp.route('/<int:id>/update_media', methods=['POST'])
@login_required
def update_media(id):
    a = Announcement.query.get_or_404(id)
    data = request.json
    a.media_url = data.get('url')
    a.media_type = data.get('type')
    db.session.commit()
    return jsonify({'status': 'success'})

@bp.route('/add', methods=['GET', 'POST'])
@bp.route('/edit/<int:id>', methods=['GET', 'POST'])
@login_required
def add_announcement(id=None):
    a = None
    if id:
        a = Announcement.query.get_or_404(id)

    if request.method == 'POST':
        title = request.form.get('title')
        header = request.form.get('header')
        content = request.form.get('content')
        
        if a:
            a.title = title
            a.header = header
            a.content = content
        else:
            max_pos = db.session.query(db.func.max(Announcement.position)).scalar() or 0
            new_a = Announcement(
                title=title,
                header=header,
                content=content,
                position=max_pos + 1
            )
            db.session.add(new_a)
        
        db.session.commit()
        next_page = request.args.get('next')
        if next_page:
            return redirect(url_for(next_page))
        return redirect(url_for('announcements.index'))
    
    return render_template('announcement_form.html', a=a)

@bp.route('/delete/<int:id>', methods=['POST'])
@login_required
def delete_announcement(id):
    a = Announcement.query.get_or_404(id)
    db.session.delete(a)
    db.session.commit()
    return jsonify({'status': 'success'})

@bp.route('/reorder', methods=['POST'])
@login_required
def reorder_announcements():
    data = request.json # List of {id: id, position: new_pos}
    for item_data in data:
        a = Announcement.query.get(item_data['id'])
        if a:
            a.position = item_data['position']
    db.session.commit()
    return jsonify({'status': 'success'})
