from app import db

class Birthday(db.Model):
    __tablename__ = 'birthdays'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    birth_month = db.Column(db.Integer, nullable=False) # 1-12
    birth_day = db.Column(db.Integer, nullable=False)   # 1-31
    birth_year = db.Column(db.Integer, nullable=True)    # 4-digit year
    is_present = db.Column(db.Boolean, default=True)

    def __repr__(self):
        return f'<Birthday {self.name} {self.birth_month}/{self.birth_day}>'
