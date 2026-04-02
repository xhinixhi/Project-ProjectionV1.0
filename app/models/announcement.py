from app import db

class Announcement(db.Model):
    __tablename__ = 'announcements'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    header = db.Column(db.String(255), nullable=True)
    content = db.Column(db.Text, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    media_url = db.Column(db.String(1000), nullable=True)
    media_type = db.Column(db.String(50), nullable=True) # video or image
    style_json = db.Column(db.Text, nullable=True) # Individual styling
    position = db.Column(db.Integer, default=0)

    def __repr__(self):
        return f'<Announcement {self.title}>'
