from datetime import datetime
from app import db

class Service(db.Model):
    __tablename__ = 'services'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    service_type = db.Column(db.String(50), default='song', server_default='song')
    service_date = db.Column(db.Date, nullable=False)
    is_active = db.Column(db.Boolean, default=False)
    
    items = db.relationship('ServiceItem', backref='service', lazy=True, cascade="all, delete-orphan")

    def __repr__(self):
        return f'<Service {self.name} ({self.service_type})>'

class ServiceItem(db.Model):
    __tablename__ = 'service_items'
    id = db.Column(db.Integer, primary_key=True)
    service_id = db.Column(db.Integer, db.ForeignKey('services.id'), nullable=False)
    item_type = db.Column(db.String(50), nullable=False) # song, custom, bible
    item_id = db.Column(db.Integer) # points to song_id if item_type is song
    position = db.Column(db.Integer, nullable=False)

    def __repr__(self):
        return f'<ServiceItem {self.item_type} at position {self.position}>'
