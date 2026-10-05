import logging
import uuid

from flask import Blueprint, jsonify, request

from security import current_identity, require_roles
from services import access_request_service, proxy_service

access_bp = Blueprint('access_requests', __name__)
logger = logging.getLogger(__name__)


def _request_id():
    return request.headers.get('X-Request-ID') or str(uuid.uuid4())


@access_bp.route('/api/access-requests', methods=['GET', 'POST'])
@require_roles('employee')
def employee_access_requests():
    identity = current_identity()
    try:
        if request.method == 'GET':
            return jsonify({'requests': access_request_service.list_mine(identity)})
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify({'error': 'A JSON object is required.'}), 400
        result = access_request_service.submit(identity, body.get('domain') or body.get('url'), body.get('reason'), _request_id())
        return jsonify({'success': True, **result}), 200 if result['duplicate'] else 201
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    except Exception:
        logger.exception('Access request could not be saved')
        return jsonify({'error': 'Your request was not received. Try again.'}), 503


@access_bp.route('/api/admin/access-requests', methods=['GET'])
@require_roles('soc', 'grc')
def staff_access_requests():
    try:
        return jsonify(access_request_service.list_for_staff(request.args.get('status') or None))
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    except Exception:
        logger.exception('Access requests could not be listed')
        return jsonify({'error': 'Access requests are not available. Try again.'}), 503


@access_bp.route('/api/admin/access-requests/<access_request_id>/decision', methods=['POST'])
@require_roles('soc')
def decide_access_request(access_request_id):
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify({'error': 'A JSON object is required.'}), 400
    try:
        updated = access_request_service.decide(current_identity(), access_request_id, body.get('decision'), body.get('note'), _request_id())
        return jsonify({'success': True, 'request': updated})
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    except LookupError as exc:
        return jsonify({'error': str(exc)}), 404
    except PermissionError as exc:
        return jsonify({'error': str(exc)}), 409
    except proxy_service.ProxyError as exc:
        return jsonify({'error': exc.message if hasattr(exc, 'message') else str(exc), 'code': getattr(exc, 'code', 'PROXY_ERROR')}), getattr(exc, 'status', 400)
    except Exception:
        logger.exception('Access request decision failed')
        return jsonify({'error': 'The decision was not saved. Try again.'}), 503
