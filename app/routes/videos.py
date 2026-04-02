import os
from flask import Blueprint, jsonify, current_app, request
from flask_login import login_required
from werkzeug.utils import secure_filename

bp = Blueprint('videos', __name__, url_prefix='/api/videos')

@bp.route('/')
@login_required
def list_media():
    media_root = os.path.join(current_app.static_folder, 'media')
    
    # Ensure root exists
    if not os.path.exists(media_root):
        os.makedirs(media_root)
    
    media_items = []
    video_exts = ('.mp4', '.mov', '.avi', '.mkv')
    image_exts = ('.jpg', '.jpeg', '.png', '.webp', '.gif')
    
    for root, dirs, files in os.walk(media_root):
        # Category is the immediate subdirectory name or 'general' if in root
        rel = os.path.relpath(root, media_root)
        if rel == '.':
            category = 'general'
        else:
            # Get the first part of the relative path as the category
            category = rel.split(os.sep)[0]
            
        for filename in files:
            if filename.startswith('.'): continue
            ext = os.path.splitext(filename)[1].lower()
            media_type = None
            if ext in video_exts:
                media_type = 'video'
            elif ext in image_exts:
                media_type = 'image'
            elif ext == '.url' or ext == '.html':
                media_type = 'browser'
            
            if media_type:
                rel_path = os.path.relpath(os.path.join(root, filename), current_app.static_folder)
                url_path = rel_path.replace(os.sep, '/')
                
                item = {
                    'name': filename.replace('.url', '') if media_type == 'browser' else filename,
                    'url': f'/static/{url_path}',
                    'type': media_type,
                    'category': category.lower(),
                    'file_path': f'/static/{url_path}'
                }
                
                if media_type == 'browser' and ext == '.url':
                    try:
                        with open(os.path.join(root, filename), 'r') as f:
                            content = f.read().strip()
                            if content.startswith('{'):
                                import json
                                try:
                                    browser_data = json.loads(content)
                                    item['url'] = browser_data.get('url', '')
                                    item['custom_css'] = browser_data.get('css', '')
                                    item['width'] = browser_data.get('width', '100%')
                                    item['height'] = browser_data.get('height', '100%')
                                    item['interact'] = browser_data.get('interact', False)
                                except:
                                    item['url'] = content
                            else:
                                item['url'] = content
                    except Exception:
                        continue
                        
                media_items.append(item)
    return jsonify(media_items)

@bp.route('/folders')
@login_required
def list_folders():
    media_root = os.path.join(current_app.static_folder, 'media')
    folders = [d for d in os.listdir(media_root) if os.path.isdir(os.path.join(media_root, d))]
    return jsonify(['general'] + sorted(folders))

@bp.route('/create-folder', methods=['POST'])
@login_required
def create_folder():
    data = request.json
    folder_name = secure_filename(data.get('name'))
    if not folder_name:
        return jsonify({'error': 'Invalid folder name'}), 400
    
    media_root = os.path.join(current_app.static_folder, 'media')
    target_path = os.path.join(media_root, folder_name)
    
    if os.path.exists(target_path):
        return jsonify({'error': 'Folder already exists'}), 400
    
    os.makedirs(target_path)
    return jsonify({'status': 'success'})

@bp.route('/add-browser-source', methods=['POST'])
@login_required
def add_browser_source():
    data = request.json
    name = secure_filename(data.get('name', 'Browser Source'))
    url = data.get('url', '').strip()
    category = secure_filename(data.get('category', 'general'))
    
    if not url:
        return jsonify({'error': 'URL is required'}), 400
        
    media_root = os.path.join(current_app.static_folder, 'media')
    if category != 'general':
        upload_path = os.path.join(media_root, category)
    else:
        upload_path = media_root
        
    if not os.path.exists(upload_path):
        os.makedirs(upload_path)
        
    filename = f"{name}.url"
    counter = 1
    while os.path.exists(os.path.join(upload_path, filename)):
        filename = f"{name}_{counter}.url"
        counter += 1
        
    with open(os.path.join(upload_path, filename), 'w') as f:
        f.write(url)
        
    return jsonify({'status': 'success'})

@bp.route('/upload', methods=['POST'])
@login_required
def upload_media():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    category = request.form.get('category', 'general')
    
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    filename = secure_filename(file.filename)
    media_root = os.path.join(current_app.static_folder, 'media')
    
    if category == 'general':
        upload_path = media_root
    else:
        upload_path = os.path.join(media_root, secure_filename(category))
    
    if not os.path.exists(upload_path):
        os.makedirs(upload_path)
        
    file.save(os.path.join(upload_path, filename))
    return jsonify({'status': 'success'})

@bp.route('/delete', methods=['POST'])
@login_required
def delete_media():
    data = request.json
    url = data.get('url') # This is actually file_path if passed correctly
    if not url or not url.startswith('/static/'):
        return jsonify({'error': 'Invalid file path'}), 400
    
    # Extract relative path from URL
    rel_path = url.replace('/static/', '').replace('/', os.sep)
    abs_path = os.path.join(current_app.static_folder, rel_path)
    
    # Security: Ensure the path is within static/media
    media_root = os.path.join(current_app.static_folder, 'media')
    if not os.path.commonpath([abs_path, media_root]) == media_root:
        return jsonify({'error': 'Access denied'}), 403
    
    if os.path.exists(abs_path) and os.path.isfile(abs_path):
        os.remove(abs_path)
        return jsonify({'status': 'success'})
    return jsonify({'error': 'File not found'}), 404

@bp.route('/delete-folder', methods=['POST'])
@login_required
def delete_folder():
    data = request.json
    folder_name = secure_filename(data.get('name'))
    if not folder_name or folder_name.lower() == 'general':
        return jsonify({'error': 'Invalid folder'}), 400
    
    media_root = os.path.join(current_app.static_folder, 'media')
    target_path = os.path.join(media_root, folder_name)
    
    if not os.path.exists(target_path) or not os.path.islink(target_path) and not os.path.isdir(target_path):
        return jsonify({'error': 'Folder not found'}), 404
    
    # Security check inside media root
    if not os.path.commonpath([target_path, media_root]) == media_root:
         return jsonify({'error': 'Access denied'}), 403

    import shutil
    shutil.rmtree(target_path)
    return jsonify({'status': 'success'})

import urllib.request
from flask import Response

@bp.route('/proxy')
@login_required
def proxy():
    url = request.args.get('url')
    css = request.args.get('css', '')
    if not url:
        return "URL is required", 400
    
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            content = response.read()
            status = response.getcode()
            
            # Inject Custom CSS if it's an HTML response
            content_type = response.getheader('Content-Type', '').lower()
            if 'text/html' in content_type and css:
                style_tag = f'<style>{css}</style>'.encode('utf-8')
                if b'</head>' in content:
                    content = content.replace(b'</head>', style_tag + b'</head>')
                elif b'<body>' in content:
                    content = content.replace(b'<body>', b'<body>' + style_tag)
                else:
                    content = style_tag + content

            # Strip iframe-blocking headers
            excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection', 'x-frame-options', 'content-security-policy', 'frame-options']
            headers = []
            for name, value in response.getheaders():
                if name.lower() not in excluded_headers:
                    headers.append((name, value))
            
            headers.append(('Access-Control-Allow-Origin', '*'))
            return Response(content, status, headers)
    except Exception as e:
        return str(e), 500
