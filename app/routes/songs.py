from flask import Blueprint, request, jsonify, render_template, redirect, url_for
from app.models.song import Song, SongSection
from app import db
from flask_login import login_required

bp = Blueprint('songs', __name__, url_prefix='/songs')

@bp.route('/')
@login_required
def index():
    songs = Song.query.all()
    return jsonify([{
        'id': s.id,
        'title': s.title,
        'author': s.author,
        'key': s.key
    } for s in songs])

@bp.route('/add', methods=['GET', 'POST'])
@bp.route('/edit/<int:song_id>', methods=['GET', 'POST'])
@login_required
def add_song(song_id=None):
    song = None
    if song_id:
        song = Song.query.get_or_404(song_id)

    if request.method == 'POST':
        title = request.form.get('title')
        author = request.form.get('author')
        key = request.form.get('key')
        
        if song:
            song.title = title
            song.author = author
            song.key = key
            # Delete old sections for a clean overwrite
            SongSection.query.filter_by(song_id=song.id).delete()
            new_song = song
        else:
            new_song = Song(title=title, author=author, key=key)
            db.session.add(new_song)
            db.session.flush()

        # Standardized tag parsing: [I], [PC1], [V2], etc.
        raw_content = request.form.get('content')
        if raw_content:
            import re
            # Split by valid tag patterns to handle brackets in content (e.g. JS arrays)
            # Pattern matches [Alpha][Digits].[Digits]
            tag_regex = r'(\[[A-Z]+\d*(?:\.\d+)?\])'
            parts = re.split(tag_regex, raw_content)
            
            # parts will alternate between content and tags: ['', '[V1]', 'content', '[V2]', ...]
            current_tag = None
            order = 0
            
            for part in parts:
                if not part: continue
                
                # Check if this part is a tag
                tag_match = re.match(r'\[([A-Z]+\d*(?:\.\d+)?)\]', part)
                if tag_match:
                    current_tag = tag_match.group(1).upper()
                    continue
                
                # If we have a tag and this is content
                if current_tag:
                    # Extract alpha part, major and optional minor
                    match = re.match(r"([A-Z]+)(\d*)(?:\.(\d+))?", current_tag)
                    if match:
                        alpha, major_str, minor_str = match.groups()
                        major = int(major_str) if major_str else 0
                        minor = int(minor_str) if minor_str else 0
                        
                        type_map = {
                            'I': 'intro', 'V': 'verse', 'PC': 'pre-chorus',
                            'CH': 'chorus', 'C': 'chorus', 'R': 'refrain', 'B': 'bridge',
                            'T': 'tag', 'O': 'outro'
                        }
                        sec_type = type_map.get(alpha, 'verse')
                        
                        new_sec = SongSection(
                            song_id=new_song.id,
                            section_type=sec_type,
                            section_number=major,
                            minor_number=minor,
                            content=part.strip(),
                            display_order=order
                        )
                        db.session.add(new_sec)
                        order += 1
                    # Note: We don't clear current_tag because multi-block content 
                    # without intervening tags shouldn't happen with re.split, 
                    # but logic is sound.
        
        db.session.commit()
        next_page = request.args.get('next')
        if next_page:
            return redirect(url_for(next_page))
        return redirect(url_for('control.index'))
    
    # Pre-populate content for editing
    raw_content = ""
    if song:
        for sec in sorted(song.sections, key=lambda x: x.display_order):
            raw_content += f"[{sec.tag}]\n{sec.content}\n\n"
            
    return render_template('add_song.html', song=song, raw_content=raw_content.strip())

@bp.route('/delete/<int:song_id>', methods=['POST'])
@login_required
def delete_song(song_id):
    song = Song.query.get_or_404(song_id)
    db.session.delete(song)
    db.session.commit()
    return jsonify({'status': 'success'})

@bp.route('/search')
@login_required
def search():
    query = request.args.get('q', '')
    songs = Song.query.filter(
        (Song.title.ilike(f'%{query}%')) | 
        (Song.author.ilike(f'%{query}%'))
    ).all()
    return jsonify([{
        'id': s.id,
        'title': s.title,
        'author': s.author,
        'key': s.key,
        'media_url': s.media_url,
        'media_type': s.media_type,
        'style_json': s.style_json
    } for s in songs])

@bp.route('/<int:song_id>/update_media', methods=['POST'])
@login_required
def update_media(song_id):
    song = Song.query.get_or_404(song_id)
    data = request.json
    song.media_url = data.get('url')
    song.media_type = data.get('type')
    db.session.commit()
    return jsonify({'status': 'success'})

@bp.route('/<int:song_id>/update_style', methods=['POST'])
@login_required
def update_style(song_id):
    song = Song.query.get_or_404(song_id)
    data = request.json
    song.style_json = data.get('style')
    db.session.commit()
    return jsonify({'status': 'success'})

@bp.route('/<int:song_id>')
@login_required
def get_song(song_id):
    song = Song.query.get_or_404(song_id)
    return jsonify({
        'id': song.id,
        'title': song.title,
        'author': song.author,
        'key': song.key,
        'media_url': song.media_url,
        'media_type': song.media_type,
        'style_json': song.style_json,
        'sections': [{
            'id': sec.id,
            'tag': sec.tag,
            'content': sec.content,
            'type': sec.section_type,
            'number': sec.section_number
        } for sec in sorted(song.sections, key=lambda x: x.display_order)]
    })
