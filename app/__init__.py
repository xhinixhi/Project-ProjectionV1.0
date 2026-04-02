from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_socketio import SocketIO
from config import Config

from flask_login import LoginManager

db = SQLAlchemy()
migrate = Migrate()
socketio = SocketIO()
login = LoginManager()
login.login_view = 'auth.login'

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    migrate.init_app(app, db)
    socketio.init_app(app, cors_allowed_origins="*")

    from app.routes import songs, services, control, output, birthdays, announcements, auth, live, live2, videos, bible, powerpoint, editor, media_page
    app.register_blueprint(songs.bp)
    app.register_blueprint(services.bp)
    app.register_blueprint(control.bp)
    app.register_blueprint(output.bp)
    app.register_blueprint(birthdays.bp)
    app.register_blueprint(announcements.bp)
    app.register_blueprint(auth.bp)
    app.register_blueprint(live.bp)
    app.register_blueprint(live2.bp)
    app.register_blueprint(videos.bp)
    app.register_blueprint(bible.bp)
    app.register_blueprint(powerpoint.bp)
    app.register_blueprint(editor.bp)
    app.register_blueprint(media_page.bp)
    
    login.init_app(app)

    @login.user_loader
    def load_user(id):
        from app.models.user import User
        return User.query.get(int(id))

    from app.sockets import events
    from app.models import song, service, birthday, announcement, setting, user, live, live2, bible, presentation

    with app.app_context():
        db.create_all()
        # Auto-seed an admin if database is completely empty
        if not user.User.query.get(1):
            admin = user.User(id=1, username='admin')
            admin.set_password('password')
            db.session.add(admin)
            print("Default admin created: 'admin' / 'password'")
            
        # Auto-seed an usher
        if not user.User.query.get(2):
            usher = user.User(id=2, username='usher')
            usher.set_password('usher')
            db.session.add(usher)
            print("Default usher created: 'usher' / 'usher'")
            
        # Auto-seed a remote account
        if not user.User.query.get(3):
            remote = user.User(id=3, username='remote')
            remote.set_password('remote')
            db.session.add(remote)
            print("Default remote created: 'remote' / 'remote'")
            
        db.session.commit()

    @app.before_request
    def restrict_usher():
        from flask_login import current_user
        from flask import request, redirect, url_for
        # Assume ID 1 is Admin, any other ID is an Usher/Editor
        if current_user.is_authenticated and current_user.id != 1:
            # Special case: allow the remote user to access powerpoint specifically.
            if current_user.id == 3:
                allowed_blueprints = ['powerpoint', 'auth', 'static']
                if request.blueprint not in allowed_blueprints and request.path != '/':
                    return redirect(url_for('powerpoint.remote'))
            else:
                allowed_blueprints = ['editor', 'songs', 'birthdays', 'announcements', 'live', 'live2', 'auth', 'powerpoint', 'media_page']
                # Allow static files
                if request.endpoint and request.endpoint.startswith('static'):
                    return
                if request.blueprint not in allowed_blueprints and request.path != '/':
                    # Specifically protect control blueprint
                    if request.blueprint == 'control':
                        return redirect(url_for('editor.index'))

    @app.context_processor
    def inject_settings():
        from app.models.setting import Setting
        settings = Setting.query.all()
        return dict(settings_map={s.key: s.value for s in settings})

    return app
