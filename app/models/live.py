from datetime import datetime
from app import db

class Live(db.Model):
    __tablename__ = 'lives'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    author = db.Column(db.String(255))
    key = db.Column(db.String(10))
    media_url = db.Column(db.String(1000), nullable=True)
    media_type = db.Column(db.String(50), nullable=True) # video or image
    style_json = db.Column(db.Text, nullable=True) # Individual styling
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    sections = db.relationship('LiveSection', backref='live', lazy=True, cascade="all, delete-orphan")

    def __repr__(self):
        return f'<Live {self.title}>'

class LiveSection(db.Model):
    __tablename__ = 'live_sections'
    id = db.Column(db.Integer, primary_key=True)
    live_id = db.Column(db.Integer, db.ForeignKey('lives.id'), nullable=False)
    section_type = db.Column(db.String(50), nullable=False) # verse, chorus, bridge, tag, intro, outro
    section_number = db.Column(db.Integer, default=1)
    content = db.Column(db.Text, nullable=False)
    display_order = db.Column(db.Integer, default=0)

    @property
    def tag(self):
        type_to_tag = {
            'intro': 'I', 'verse': 'V', 'pre-chorus': 'PC',
            'chorus': 'C', 'refrain': 'R', 'bridge': 'B',
            'tag': 'T', 'outro': 'O'
        }
        base = type_to_tag.get(self.section_type, self.section_type[0].upper())
        return f"{base}{self.section_number}" if self.section_number > 0 else base

    def __repr__(self):
        return f'<LiveSection {self.tag} for Live {self.live_id}>'
