import os
from flask import Blueprint, render_template, request, jsonify, current_app, url_for, redirect
from flask_login import login_required
from werkzeug.utils import secure_filename
from app.models.presentation import Presentation
from app import db, socketio

bp = Blueprint('powerpoint', __name__, url_prefix='/powerpoint')

ALLOWED_EXTENSIONS = {'pdf'}

def ensure_upload_dir():
    upload_dir = os.path.join(current_app.static_folder, 'uploads', 'presentations')
    if not os.path.exists(upload_dir):
        os.makedirs(upload_dir, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@bp.route('/')
@login_required
def index():
    ensure_upload_dir()
    presentations = Presentation.query.order_by(Presentation.upload_date.desc()).all()
    return render_template('presentation_manager.html', presentations=presentations)

from flask_login import login_required, current_user, login_user

@bp.route('/remote')
def remote():
    if not current_user.is_authenticated:
        return redirect(url_for('powerpoint.remote_login'))
    # Dedicated mobile remote view
    return render_template('remote_control.html')

@bp.route('/remote_login', methods=['GET', 'POST'])
def remote_login():
    return redirect(url_for('auth.login'))

@bp.route('/remote_logout')
def remote_logout():
    from flask_login import logout_user
    logout_user()
    return redirect(url_for('auth.login'))

@bp.route('/upload', methods=['POST'])
@login_required
def upload():
    ensure_upload_dir()
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        # Ensure unique filename
        base, extension = os.path.splitext(filename)
        counter = 1
        while os.path.exists(os.path.join(current_app.static_folder, 'uploads/presentations', filename)):
            filename = f"{base}_{counter}{extension}"
            counter += 1
            
        file.save(os.path.join(current_app.static_folder, 'uploads/presentations', filename))
        
        pres = Presentation(name=request.form.get('name', base), filename=filename)
        db.session.add(pres)
        db.session.commit()
        return jsonify({'status': 'success', 'presentation': pres.to_dict()})
    
    return jsonify({'error': 'Invalid file type. Only PDF allowed.'}), 400

@bp.route('/api/update_title/<int:id>', methods=['POST'])
@login_required
def update_title(id):
    pres = Presentation.query.get_or_404(id)
    data = request.json
    new_name = data.get('name')
    if not new_name:
        return jsonify({'error': 'Name is required'}), 400
    pres.name = new_name
    db.session.commit()
    return jsonify({'status': 'success', 'name': pres.name})

@bp.route('/api/delete/<int:id>', methods=['POST'])
@login_required
def delete(id):
    pres = Presentation.query.get_or_404(id)
    file_path = os.path.join(current_app.static_folder, 'uploads/presentations', pres.filename)
    if os.path.exists(file_path):
        os.remove(file_path)
    db.session.delete(pres)
    db.session.commit()
    return jsonify({'status': 'success'})

@bp.route('/api/project', methods=['POST'])
@login_required
def project():
    data = request.json
    print(f"DEBUG: Projecting {data}")
    filename = data.get('filename')
    page_num = data.get('page_num', 1)
    
    if not filename:
        return jsonify({'error': 'No file to project'}), 400
        
    # Emit event to output page
    socketio.emit('apply_presentation', {
        'url': url_for('static', filename=f'uploads/presentations/{filename}'),
        'page_num': page_num
    })
    return jsonify({'status': 'success'})
