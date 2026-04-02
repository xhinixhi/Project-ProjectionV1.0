from flask import Blueprint, request, jsonify, render_template, redirect, url_for
from app.models.live import Live, LiveSection
from app import db
from flask_login import login_required

bp = Blueprint('live', __name__, url_prefix='/live')

@bp.route('/')
@login_required
def index():
    return render_template('live_manager.html')

@bp.route('/data')
@login_required
def data():
    lives = Live.query.all()
    return jsonify([{
        'id': l.id,
        'title': l.title,
        'author': l.author,
        'key': l.key
    } for l in lives])

@bp.route('/add', methods=['GET', 'POST'])
@bp.route('/edit/<int:live_id>', methods=['GET', 'POST'])
@login_required
def add_live(live_id=None):
    live = None
    if live_id:
        live = Live.query.get_or_404(live_id)

    if request.method == 'POST':
        title = request.form.get('title')
        author = request.form.get('author')
        key = request.form.get('key')
        
        if live:
            live.title = title
            live.author = author
            live.key = key
            # Delete old sections for a clean overwrite
            LiveSection.query.filter_by(live_id=live.id).delete()
            new_live = live
        else:
            new_live = Live(title=title, author=author, key=key)
            db.session.add(new_live)
            db.session.flush()

        # Standardized tag parsing: [I], [PC1], [V2], etc.
        raw_content = request.form.get('content')
        if raw_content:
            import re
            # Split by valid tag patterns to handle brackets in content (e.g. JS arrays)
            tag_regex = r'(\[[A-Z]+\d*(?:\.\d+)?\])'
            parts = re.split(tag_regex, raw_content)
            
            # parts will alternate between content and tags
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
                    # Extract alpha part and optional number
                    match = re.match(r"([A-Z]+)(\d*)", current_tag)
                    if match:
                        alpha, num_str = match.groups()
                        num = int(num_str) if num_str else 0
                        
                        type_map = {
                            'I': 'intro', 'V': 'verse', 'PC': 'pre-chorus',
                            'C': 'chorus', 'R': 'refrain', 'B': 'bridge',
                            'T': 'tag', 'O': 'outro'
                        }
                        sec_type = type_map.get(alpha, 'verse')
                        
                        new_sec = LiveSection(
                            live_id=new_live.id,
                            section_type=sec_type,
                            section_number=num,
                            content=part.strip(),
                            display_order=order
                        )
                        db.session.add(new_sec)
                        order += 1
        
        db.session.commit()
        next_page = request.args.get('next')
        if next_page:
            return redirect(url_for(next_page))
        return redirect(url_for('live.index'))
    
    # Pre-populate content for editing
    raw_content = ""
    if live:
        for sec in sorted(live.sections, key=lambda x: x.display_order):
            raw_content += f"[{sec.tag}]\n{sec.content}\n\n"
            
    return render_template('add_live.html', live=live, raw_content=raw_content.strip())

@bp.route('/delete/<int:live_id>', methods=['POST'])
@login_required
def delete_live(live_id):
    live = Live.query.get_or_404(live_id)
    db.session.delete(live)
    db.session.commit()
    return jsonify({'status': 'success'})

@bp.route('/search')
def search():
    query = request.args.get('q', '')
    lives = Live.query.filter(
        (Live.title.ilike(f'%{query}%')) | 
        (Live.author.ilike(f'%{query}%'))
    ).all()
    return jsonify([{
        'id': l.id,
        'title': l.title,
        'author': l.author,
        'key': l.key,
        'media_url': l.media_url,
        'media_type': l.media_type,
        'style_json': l.style_json
    } for l in lives])

@bp.route('/<int:live_id>/update_media', methods=['POST'])
@login_required
def update_media(live_id):
    live = Live.query.get_or_404(live_id)
    data = request.json
    live.media_url = data.get('url')
    live.media_type = data.get('type')
    db.session.commit()
    return jsonify({'status': 'success'})

@bp.route('/<int:live_id>/update_style', methods=['POST'])
@login_required
def update_style(live_id):
    live = Live.query.get_or_404(live_id)
    data = request.json
    live.style_json = data.get('style')
    db.session.commit()
    return jsonify({'status': 'success'})

@bp.route('/<int:live_id>')
def get_live(live_id):
    live = Live.query.get_or_404(live_id)
    return jsonify({
        'id': live.id,
        'title': live.title,
        'author': live.author,
        'key': live.key,
        'media_url': live.media_url,
        'media_type': live.media_type,
        'style_json': live.style_json,
        'sections': [{
            'id': sec.id,
            'tag': sec.tag,
            'content': sec.content,
            'type': sec.section_type,
            'number': sec.section_number
        } for sec in sorted(live.sections, key=lambda x: x.display_order)]
    })
