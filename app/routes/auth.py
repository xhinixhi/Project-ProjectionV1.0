from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_user, logout_user, current_user, login_required
from app.models.user import User

bp = Blueprint('auth', __name__, url_prefix='/auth')

@bp.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        if current_user.id == 1:
            return redirect(url_for('control.index'))
        elif current_user.id == 3:
            return redirect(url_for('powerpoint.remote'))
        else:
            return redirect(url_for('editor.index'))
            
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        user = User.query.filter_by(username=username).first()
        if user is None or not user.check_password(password):
            flash('Invalid username or password')
            return redirect(url_for('auth.login'))
            
        login_user(user)
        
        destination = request.form.get('destination', 'auto')
        
        if destination == 'control':
            return redirect(url_for('control.index'))
        elif destination == 'editor':
            return redirect(url_for('editor.index'))
        elif destination == 'remote':
            return redirect(url_for('powerpoint.remote'))
        
        # Fallback to auto-detect
        if user.id == 1:
            return redirect(url_for('control.index'))
        elif user.id == 3:
            return redirect(url_for('powerpoint.remote'))
        else:
            return redirect(url_for('editor.index'))
            
    return render_template('login.html')

@bp.route('/logout')
def logout():
    logout_user()
    return redirect(url_for('auth.login'))

@bp.route('/change_credentials', methods=['GET', 'POST'])
@login_required
def change_credentials():
    from app import db
    is_admin = (current_user.id == 1)
    usher = User.query.get(2) if is_admin else None
    remote = User.query.get(3) if is_admin else None
    
    if request.method == 'POST':
        new_username = request.form.get('username')
        new_password = request.form.get('password')
        form_type = request.form.get('form_type')
        
        if form_type == 'credentials':
            # 1. Update current_user (the one logged in)
            if new_username and new_username != current_user.username:
                existing_user = User.query.filter_by(username=new_username).first()
                if existing_user and existing_user.id != current_user.id:
                    flash('Username already taken.')
                    return redirect(url_for('auth.change_credentials'))
                current_user.username = new_username
                
            if new_password:
                current_user.set_password(new_password)
                
            # 2. Update usher (only if admin is logged in)
            if is_admin and usher:
                usher_username = request.form.get('usher_username')
                usher_password = request.form.get('usher_password')
                
                if usher_username and usher_username != usher.username:
                    existing_usher = User.query.filter_by(username=usher_username).first()
                    if existing_usher and existing_usher.id != usher.id:
                        flash('Usher username already taken.')
                        return redirect(url_for('auth.change_credentials'))
                    usher.username = usher_username
                    
                if usher_password:
                    usher.set_password(usher_password)
                    
            # 3. Update remote (only if admin is logged in)
            if is_admin and remote:
                remote_username = request.form.get('remote_username')
                remote_password = request.form.get('remote_password')
                
                if remote_username and remote_username != remote.username:
                    existing_remote = User.query.filter_by(username=remote_username).first()
                    if existing_remote and existing_remote.id != remote.id:
                        flash('Remote username already taken.')
                        return redirect(url_for('auth.change_credentials'))
                    remote.username = remote_username
                    
                if remote_password:
                    remote.set_password(remote_password)
            
        elif form_type == 'shortcuts' and is_admin:
            # 4. Update Keyboard Mappings
            from app.models.setting import Setting
            mapping_data = request.form.get('keyboard_mappings')
            if mapping_data:
                setting = Setting.query.get('keyboard_mappings')
                if not setting:
                    setting = Setting(key='keyboard_mappings')
                    db.session.add(setting)
                setting.value = mapping_data
                
        elif form_type == 'general' and is_admin:
            from app.models.setting import Setting
            import os
            from werkzeug.utils import secure_filename
            from flask import current_app

            app_logo = request.form.get('app_logo')
            if app_logo:
                setting = Setting.query.get('app-logo')
                if not setting:
                    setting = Setting(key='app-logo')
                    db.session.add(setting)
                setting.value = app_logo
            
            logo_file = request.files.get('app_logo_image')
            if logo_file and logo_file.filename:
                filename = secure_filename(logo_file.filename)
                upload_dir = os.path.join(current_app.root_path, 'static', 'uploads', 'logo')
                if not os.path.exists(upload_dir):
                    os.makedirs(upload_dir)
                
                # Optionally add a timestamp to prevent cache issues
                import time
                filename = f"{int(time.time())}_{filename}"
                logo_file.save(os.path.join(upload_dir, filename))
                
                setting = Setting.query.get('app-logo-image')
                if not setting:
                    setting = Setting(key='app-logo-image')
                    db.session.add(setting)
                setting.value = filename

        db.session.commit()
        flash(f'{"Credentials" if form_type == "credentials" else "Settings"} updated successfully.')
        return redirect(url_for('auth.change_credentials'))
        
    # GET
    from app.models.setting import Setting
    mappings = Setting.query.get('keyboard_mappings')
    keyboard_mappings = mappings.value if mappings else "{}"
    
    return render_template('change_credentials.html', 
                          usher=usher, 
                          remote=remote, 
                          is_admin=is_admin,
                          keyboard_mappings=keyboard_mappings)
