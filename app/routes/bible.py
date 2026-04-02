from flask import Blueprint, request, jsonify, render_template, current_app
from app.models.bible import Bible
from app import db, socketio
from flask_login import login_required
import os
import sqlite3
import re

bp = Blueprint('bible', __name__, url_prefix='/bible')

BIBLE_BOOKS = [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
    "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
    "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra",
    "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
    "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations",
    "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
    "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk",
    "Zephaniah", "Haggai", "Zechariah", "Malachi",
    "Matthew", "Mark", "Luke", "John", "Acts", "Romans",
    "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians",
    "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy",
    "Titus", "Philemon", "Hebrews", "James", "1 Peter",
    "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"
]

def get_bible_conn(translation='kjv'):
    bible_dir = os.path.join(current_app.root_path, 'bibles')
    if not os.path.exists(bible_dir):
        return None
        
    exts = ['.sqlite', '.db', '.sqlite3']
    # Try exact match first
    for ext in exts:
        path = os.path.join(bible_dir, f"{translation}{ext}")
        if os.path.exists(path):
            return sqlite3.connect(path)
            
    # Try case-insensitive matching if exact match fails
    lower_trans = translation.lower()
    try:
        for f in os.listdir(bible_dir):
            base, ext = os.path.splitext(f)
            if base.lower() == lower_trans and ext.lower() in exts:
                return sqlite3.connect(os.path.join(bible_dir, f))
    except OSError:
        pass
        
    return None

def get_bible_schema(conn):
    """Dynamically discover table and column names for the bible database."""
    if not conn:
        return None, None
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cursor.fetchall()]
    
    if 'verses' in tables:
        tbl = 'verses'
    else:
        # Check for any table ending in _verses
        verses_tables = [t for t in tables if t.lower().endswith('_verses')]
        tbl = verses_tables[0] if verses_tables else 'verses'
        
    # Check column names
    try:
        cursor.execute(f"PRAGMA table_info({tbl})")
        cols = [row[1].lower() for row in cursor.fetchall()]
        book_col = 'book_id' if 'book_id' in cols else 'book'
    except:
        book_col = 'book'
    
    return tbl, book_col

@bp.route('/')
@login_required
def index():
    from app.models.setting import Setting
    import json
    settings_items = Setting.query.filter(Setting.key.like('bible-%')).all()
    settings = {s.key: json.loads(s.value) for s in settings_items if s.value.startswith('{')}
    return render_template('bible_manager.html', settings=settings, bible_books=BIBLE_BOOKS)

@bp.route('/publish', methods=['POST'])
def publish():
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    # Instead of saving, we emit directly to use the verse on the output
    verse_text = data.get('verse', '')
    translation = data.get('translation', '')
    content = data.get('content', '')
    
    socketio.emit('request_bible_navigation', {
        'verse': f"{verse_text} {translation.upper()}" if translation else verse_text,
        'content': content
    })

    return jsonify({'success': True}), 200

@bp.route('/data')
@login_required
def get_data():
    bibles = Bible.query.order_by(Bible.created_at.desc()).all()
    return jsonify([{
        'id': b.id,
        'verse': b.verse,
        'translation': b.translation,
        'content': b.content,
        'url': b.url,
        'created_at': b.created_at.isoformat()
    } for b in bibles])

@bp.route('/delete/<int:bible_id>', methods=['POST'])
@login_required
def delete_bible(bible_id):
    bible = Bible.query.get_or_404(bible_id)
    db.session.delete(bible)
    db.session.commit()
    return jsonify({'status': 'success'})

@bp.route('/delete_all', methods=['POST'])
@login_required
def delete_all():
    try:
        Bible.query.delete()
        db.session.commit()
        return jsonify({'status': 'success'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/translations')
@login_required
def list_translations():
    bible_dir = os.path.join(current_app.root_path, 'bibles')
    if not os.path.exists(bible_dir):
        return jsonify([])
    
    # Handle .sqlite, .db and .sqlite3 files
    files = set()
    for f in os.listdir(bible_dir):
        if f.lower().endswith(('.sqlite', '.db', '.sqlite3')):
            name = os.path.splitext(f)[0]
            files.add(name)
            
    return jsonify(sorted(list(files)))

@bp.route('/search-offline')
@login_required
def search_offline():
    query = request.args.get('q', '').strip()
    translation = request.args.get('t', 'kjv').lower()
    parallel_t = request.args.get('p')  # Optional parallel translation
    
    if not query:
        return jsonify([])

    conn = get_bible_conn(translation)
    if not conn:
        return jsonify({'error': 'Bible translation not found'}), 404
    
    tbl, b_col = get_bible_schema(conn)
    
    p_conn = get_bible_conn(parallel_t.lower()) if parallel_t else None
    p_tbl, p_b_col = get_bible_schema(p_conn) if p_conn else (None, None)
    
    # Try to parse reference like "John 3:16", "John 3.16", "John 1 1", "John 1" or "John"
    results = []
    
    # 1. Full reference (Book Chapter:Verse or Book Chapter)
    ref_match = re.match(r'^(.+?)\s+(\d+)(?:[.\s/:,]+(\d+))?$', query)
    if ref_match:
        book_name, chapter, verse = ref_match.groups()
        book_id = None
        for idx, b in enumerate(BIBLE_BOOKS):
            if b.lower() == book_name.lower():
                book_id = idx + 1
                break
        
        if book_id:
            cursor = conn.cursor()
            if verse:
                # Specific verse
                cursor.execute(f"SELECT {b_col}, chapter, verse, text FROM {tbl} WHERE {b_col}=? AND chapter=? AND verse=?", (book_id, chapter, verse))
            else:
                # Entire chapter
                cursor.execute(f"SELECT {b_col}, chapter, verse, text FROM {tbl} WHERE {b_col}=? AND chapter=? ORDER BY verse ASC", (book_id, chapter))
            
            rows = cursor.fetchall()
            for row in rows:
                v = {
                    'book': BIBLE_BOOKS[row[0]-1],
                    'chapter': row[1],
                    'verse': row[2],
                    'text': row[3],
                    'ref': f"{BIBLE_BOOKS[row[0]-1]} {row[1]}:{row[2]}",
                    'translation': translation.upper()
                }
                if p_conn:
                    p_cursor = p_conn.cursor()
                    p_cursor.execute(f"SELECT text FROM {p_tbl} WHERE {p_b_col}=? AND chapter=? AND verse=?", (row[0], row[1], row[2]))
                    p_row = p_cursor.fetchone()
                    if p_row:
                        v['parallel_text'] = p_row[0]
                        v['parallel_translation'] = parallel_t.upper()
                results.append(v)
            
            if results:
                return jsonify(results)

    # 2. Book Only (e.g., "John" or "Genesis")
    book_id = None
    for idx, b in enumerate(BIBLE_BOOKS):
        if b.lower() == query.lower():
            book_id = idx + 1
            break
            
    if book_id:
        cursor = conn.cursor()
        # Get the first verse of every chapter in that book
        cursor.execute(f"SELECT {b_col}, chapter, verse, text FROM {tbl} WHERE {b_col}=? AND verse=1 ORDER BY chapter ASC", (book_id,))
        rows = cursor.fetchall()
        for r in rows:
            v = {
                'book': BIBLE_BOOKS[r[0]-1],
                'chapter': r[1],
                'verse': r[2],
                'text': r[3],
                'ref': f"{BIBLE_BOOKS[r[0]-1]} {r[1]}",
                'is_chapter_summary': True,
                'translation': translation.upper()
            }
            results.append(v)
        return jsonify(results)

    # Keywords fallback
    cursor = conn.cursor()
    cursor.execute(f"SELECT {b_col}, chapter, verse, text FROM {tbl} WHERE text LIKE ? LIMIT 50", (f'%{query}%',))
    rows = cursor.fetchall()
    for r in rows:
        v = {
            'book': BIBLE_BOOKS[r[0]-1],
            'chapter': r[1],
            'verse': r[2],
            'text': r[3],
            'ref': f"{BIBLE_BOOKS[r[0]-1]} {r[1]}:{r[2]}",
            'translation': translation.upper()
        }
        if p_conn:
            p_cursor = p_conn.cursor()
            p_cursor.execute(f"SELECT text FROM {p_tbl} WHERE {p_b_col}=? AND chapter=? AND verse=?", (r[0], r[1], r[2]))
            p_row = p_cursor.fetchone()
            if p_row:
                v['parallel_text'] = p_row[0]
                v['parallel_translation'] = parallel_t.upper()
        results.append(v)
        
    return jsonify(results)

@bp.route('/navigation')
@login_required
def navigate_verse():
    direction = request.args.get('dir', 'next')
    translation = request.args.get('t', 'kjv').lower()
    parallel_t = request.args.get('p') # Optional parallel translation
    book_name = request.args.get('b')
    chapter = request.args.get('c')
    verse = request.args.get('v')
    
    if not book_name or not chapter or not verse:
        return jsonify({'error': 'Missing reference'}), 400

    book_id = None
    for idx, b in enumerate(BIBLE_BOOKS):
        if b.lower() == book_name.lower():
            book_id = idx + 1
            break
            
    if not book_id:
        return jsonify({'error': 'Invalid book'}), 400
        
    conn = get_bible_conn(translation)
    if not conn:
        return jsonify({'error': 'Bible translation not found'}), 404

    tbl, b_col = get_bible_schema(conn)
    cursor = conn.cursor()
    cursor.execute(f"SELECT id FROM {tbl} WHERE {b_col}=? AND chapter=? AND verse=?", (book_id, int(chapter), int(verse)))
    row = cursor.fetchone()
    if not row:
        return jsonify({'error': 'Current verse not found in DB'}), 404
        
    current_id = row[0]
    new_id = current_id + 1 if direction == 'next' else current_id - 1
    
    cursor.execute(f"SELECT {b_col}, chapter, verse, text FROM {tbl} WHERE id=?", (new_id,))
    row = cursor.fetchone()
    if row:
        book_idx = row[0]-1
        result = {
            'book': BIBLE_BOOKS[book_idx],
            'chapter': row[1],
            'verse': row[2],
            'text': row[3],
            'ref': f"{BIBLE_BOOKS[book_idx]} {row[1]}:{row[2]}",
            'translation': translation.upper()
        }
        
        # Parallel fetch if requested
        if parallel_t:
            p_conn = get_bible_conn(parallel_t.lower())
            if p_conn:
                p_tbl, p_b_col = get_bible_schema(p_conn)
                p_cursor = p_conn.cursor()
                # Find matching verse by book/chapter/verse in the other database
                p_cursor.execute(f"SELECT text FROM {p_tbl} WHERE {p_b_col}=? AND chapter=? AND verse=?", (row[0], row[1], row[2]))
                p_row = p_cursor.fetchone()
                if p_row:
                    result['parallel_text'] = p_row[0]
                    result['parallel_translation'] = parallel_t.upper()
        
        return jsonify(result)
    else:
        return jsonify({'error': 'End of Bible reached'}), 404
