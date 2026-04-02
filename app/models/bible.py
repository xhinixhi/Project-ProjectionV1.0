from datetime import datetime
from app import db

class Bible(db.Model):
    __tablename__ = 'bibles'
    id = db.Column(db.Integer, primary_key=True)
    verse = db.Column(db.String(255), nullable=True)
    translation = db.Column(db.String(50), nullable=True)
    content = db.Column(db.Text, nullable=True)
    url = db.Column(db.String(1000), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<Bible {self.verse}>'
