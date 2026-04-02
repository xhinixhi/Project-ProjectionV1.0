from flask import Blueprint, request, jsonify
from app.models.service import Service, ServiceItem
from app.models.song import Song
from app.models.live import Live
from app.models.live2 import Live2
from app import db
from datetime import datetime

bp = Blueprint('services', __name__, url_prefix='/services')

@bp.route('/active')
def get_active_service():
    service_type = request.args.get('type', 'song')
    service = Service.query.filter_by(is_active=True, service_type=service_type).first()
    if not service:
        # Create a default service if none active
        names = {'song': 'Sunday Service', 'live': 'Live Lineup', 'live2': 'Live2 Lineup'}
        service_name = names.get(service_type, 'Service Lineup')
        service = Service(name=service_name, service_type=service_type, service_date=datetime.now().date(), is_active=True)
        db.session.add(service)
        db.session.commit()
    
    items = []
    for item in sorted(service.items, key=lambda x: x.position):
        title = "Custom Item"
        if item.item_type == 'song':
            song = Song.query.get(item.item_id)
            if song: title = song.title
        elif item.item_type == 'live':
            live = Live.query.get(item.item_id)
            if live: title = live.title
        elif item.item_type == 'live2':
            live2 = Live2.query.get(item.item_id)
            if live2: title = live2.title

        items.append({
            'id': item.id,
            'type': item.item_type,
            'item_id': item.item_id,
            'title': title,
            'position': item.position
        })
    
    return jsonify({
        'id': service.id,
        'name': service.name,
        'items': items
    })

@bp.route('/add_item', methods=['POST'])
def add_item():
    data = request.json
    service_id = data.get('service_id')
    item_type = data.get('item_type')
    item_id = data.get('item_id')
    
    # Get current max position
    max_pos = db.session.query(db.func.max(ServiceItem.position)).filter_by(service_id=service_id).scalar() or 0
    
    new_item = ServiceItem(
        service_id=service_id,
        item_type=item_type,
        item_id=item_id,
        position=max_pos + 1
    )
    db.session.add(new_item)
    db.session.commit()
    return jsonify({'status': 'success', 'item_id': new_item.id})

@bp.route('/reorder', methods=['POST'])
def reorder_items():
    data = request.json # List of {id: item_id, position: new_pos}
    for item_data in data:
        item = ServiceItem.query.get(item_data['id'])
        if item:
            item.position = item_data['position']
    db.session.commit()
    return jsonify({'status': 'success'})

@bp.route('/remove_item/<int:item_id>', methods=['POST'])
def remove_item(item_id):
    item = ServiceItem.query.get_or_404(item_id)
    db.session.delete(item)
    db.session.commit()
    return jsonify({'status': 'success'})
