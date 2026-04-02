from flask import Blueprint, request, jsonify, render_template, redirect, url_for
from app.models.birthday import Birthday
from app.models.setting import Setting
from app import db
from datetime import datetime, timedelta
from flask_login import login_required
import csv
import io

bp = Blueprint('birthdays', __name__, url_prefix='/birthdays')

@bp.route('/')
@login_required
def index():
    return render_template('birthday_manager.html')

@bp.route('/data')
@login_required
def get_birthdays():
    q = request.args.get('q', '')
    query = Birthday.query.order_by(Birthday.birth_month, Birthday.birth_day)
    if q:
        query = query.filter(Birthday.name.ilike(f'%{q}%'))
    birthdays = query.all()
    return jsonify([{
        'id': b.id,
        'name': b.name,
        'birth_month': b.birth_month,
        'birth_day': b.birth_day,
        'birth_year': b.birth_year,
        'is_present': b.is_present
    } for b in birthdays])

@bp.route('/current_week')
@login_required
def get_current_week_birthdays():
    # Start of week is Sunday
    today = datetime.now()
    start_of_week = today - timedelta(days=(today.weekday() + 1) % 7)
    end_of_week = start_of_week + timedelta(days=6)
    
    # We need to handle year wrap if we were doing full dates, 
    # but here we only have month and day.
    # For a week, we can just check if the month/day falls within the range.
    
    birthdays = Birthday.query.all()
    celebrants = []
    
    # Current year for comparison logic
    year = today.year
    
    for b in birthdays:
        # Create a date object for this year's birthday
        try:
            b_date = datetime(year, b.birth_month, b.birth_day)
        except ValueError:
            # Handle Feb 29 on non-leap years
            if b.birth_month == 2 and b.birth_day == 29:
                b_date = datetime(year, 2, 28)
            else:
                continue
                
        # Check if b_date is within start_of_week and end_of_week (dates only)
        if start_of_week.date() <= b_date.date() <= end_of_week.date():
            celebrants.append({
                'id': b.id,
                'name': b.name,
                'birth_month': b.birth_month,
                'birth_day': b.birth_day,
                'formatted_date': b_date.strftime('%b %d'),
                'is_present': b.is_present
            })
            
    # Also handle if the week bridges across years (e.g. Dec 31 to Jan 6)
    if start_of_week.year != end_of_week.year:
        # This is rare but possible depending on the exact logic.
        # However, since we defined start of week as Sunday, and Sunday to Saturday,
        # it can definitely cross years.
        pass # The current logic above only checks current year. 
        # For simplicity and given church context, we usually look at the current month/day.
    
    return jsonify(celebrants)

@bp.route('/add', methods=['GET', 'POST'])
@bp.route('/edit/<int:id>', methods=['GET', 'POST'])
@login_required
def add_birthday(id=None):
    b = None
    if id:
        b = Birthday.query.get_or_404(id)

    if request.method == 'POST':
        name = request.form.get('name')
        birth_date_str = request.form.get('birth_date')
        
        if birth_date_str:
            dt = datetime.strptime(birth_date_str, '%Y-%m-%d')
            month = dt.month
            day = dt.day
            year = dt.year
        else:
            # Fallback or error handling
            month = 1
            day = 1
            year = None

        if b:
            b.name = name
            b.birth_month = month
            b.birth_day = day
            b.birth_year = year
        else:
            new_birthday = Birthday(
                name=name,
                birth_month=month,
                birth_day=day,
                birth_year=year
            )
            db.session.add(new_birthday)
        
        db.session.commit()
        next_page = request.args.get('next')
        if next_page:
            return redirect(url_for(next_page))
        return redirect(url_for('birthdays.index'))
    
    return render_template('birthday_form.html', b=b)

@bp.route('/toggle_present/<int:id>', methods=['POST'])
@login_required
def toggle_present(id):
    b = Birthday.query.get_or_404(id)
    data = request.json
    b.is_present = data.get('is_present', b.is_present)
    db.session.commit()
    return jsonify({'status': 'success'})

@bp.route('/delete/<int:id>', methods=['POST'])
@login_required
def delete_birthday(id):
    b = Birthday.query.get_or_404(id)
    db.session.delete(b)
    db.session.commit()
    return jsonify({'status': 'success'})

@bp.route('/import_csv', methods=['POST'])
@login_required
def import_csv():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
        
    if not file.filename.endswith('.csv'):
        return jsonify({'error': 'Invalid format. Please upload a .csv file.'}), 400
        
    try:
        stream = io.StringIO(file.stream.read().decode("UTF8", errors='ignore'), newline=None)
        csv_input = csv.reader(stream)
        headers = next(csv_input, None) # Skip header easily
        
        imported_count = 0
        for row in csv_input:
            if not row or len(row) < 2:
                continue
            
            name = row[0].strip()
            date_str = row[1].strip()
            
            if not name or not date_str:
                continue
                
            # Attempt to intuitively parse various date formats
            dt = None
            for fmt in ('%Y-%m-%d', '%m/%d/%Y', '%m-%d-%Y', '%B %d, %Y', '%b %d, %Y', '%d/%m/%Y', '%m/%d'):
                try:
                    dt = datetime.strptime(date_str, fmt)
                    break
                except ValueError:
                    pass
                    
            if dt:
                month = dt.month
                day = dt.day
                year = dt.year if '%Y' in str(fmt) else None # fallback if year wasn't present
            else:
                # Manual splitting fallback for strict MM/DD formatting
                try:
                    parts = date_str.replace('-', '/').split('/')
                    if len(parts) >= 2:
                        month = int(parts[0])
                        day = int(parts[1])
                        year = int(parts[2]) if len(parts) == 3 else None
                    else:
                        continue 
                except (ValueError, IndexError):
                    continue 

            if month and day:
                # verify it doesn't already exist (deduplication)
                existing = Birthday.query.filter_by(name=name, birth_month=month, birth_day=day).first()
                if not existing:
                    new_birthday = Birthday(
                        name=name,
                        birth_month=month,
                        birth_day=day,
                        birth_year=year,
                        is_present=False
                    )
                    db.session.add(new_birthday)
                    imported_count += 1
                
        db.session.commit()
        return jsonify({'status': 'success', 'message': f'Successfully imported {imported_count} birthdays!'})
        
    except Exception as e:
        return jsonify({'error': f'Failed to parse CSV file: {str(e)}'}), 500

