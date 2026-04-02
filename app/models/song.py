from datetime import datetime
from app import db

class Song(db.Model):
    __tablename__ = 'songs'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    author = db.Column(db.String(255))
    key = db.Column(db.String(10))
    media_url = db.Column(db.String(1000), nullable=True)
    media_type = db.Column(db.String(50), nullable=True) # video or image
    style_json = db.Column(db.Text, nullable=True) # Individual styling
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    sections = db.relationship('SongSection', backref='song', lazy=True, cascade="all, delete-orphan")

    def __repr__(self):
        return f'<Song {self.title}>'

class SongSection(db.Model):
    __tablename__ = 'song_sections'
    id = db.Column(db.Integer, primary_key=True)
    song_id = db.Column(db.Integer, db.ForeignKey('songs.id'), nullable=False)
    section_type = db.Column(db.String(50), nullable=False) # verse, chorus, bridge, tag, intro, outro
    section_number = db.Column(db.Integer, default=1) # Major number
    minor_number = db.Column(db.Integer, default=0) # Minor number for sections split into multiple slides
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
        
        # New format: [TypeMajor] or [TypeMajor.Minor]
        major = self.section_number or 0
        minor = self.minor_number or 0
        
        res = f"{base}{major}" if major > 0 else base
        if minor > 0:
            res += f".{minor}"
        return res

    def __repr__(self):
        return f'<SongSection {self.tag} for Song {self.song_id}>'
