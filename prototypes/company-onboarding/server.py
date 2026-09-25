"""Local, single-workspace inventory planning demo. Not a production API."""
import argparse
import base64
import binascii
from contextlib import contextmanager
import hashlib
import hmac
import json
import math
import re
import mimetypes
import secrets
import sqlite3
import tempfile
from datetime import date, datetime, timezone
from http.cookies import SimpleCookie, CookieError
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent
MAX_BODY = 1024 * 1024
MAX_FILE = 5 * 1024 * 1024
MAX_EVIDENCE_TOTAL = 50 * 1024 * 1024
MAX_UPLOAD_BODY = 7 * 1024 * 1024
COOKIE = 'neuvetra_local_session'
EMPTY_PLAN = {'schemaVersion': 1, 'catalogVersion': 'uninitialized', 'items': {}, 'custom': [], 'screening': {}}


def encoded(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode('utf-8')


def timestamp():
    return datetime.now(timezone.utc).isoformat()


def validate(value):
    """Bound untrusted JSON, preserving incomplete answers and explicit nulls."""
    count = 0

    def walk(node, depth=0):
        nonlocal count
        count += 1
        if count > 30000 or depth > 12:
            raise ValueError('Workspace is too complex.')
        if node is None or type(node) is bool:
            return
        if type(node) in (float, int):
            if not math.isfinite(node) or abs(node) > 9007199254740991:
                raise ValueError('Number is outside the supported range.')
            return
        if type(node) is str:
            if len(node) > 10000 or any(0xD800 <= ord(c) <= 0xDFFF for c in node):
                raise ValueError('Text is too long or contains invalid characters.')
            return
        if type(node) is list:
            if len(node) > 2000:
                raise ValueError('Too many entries.')
            for item in node:
                walk(item, depth + 1)
            return
        if type(node) is dict:
            if len(node) > 2000:
                raise ValueError('Too many fields.')
            for key, item in node.items():
                if len(key) > 200 or key in ('__proto__', 'constructor', 'prototype'):
                    raise ValueError('Unsupported field name.')
                walk(key, depth + 1)
                walk(item, depth + 1)
            return
        raise ValueError('Unsupported value type.')

    walk(value)
    if type(value) is not dict or set(value) != {'expectedRevision', 'onboarding', 'plan'}:
        raise ValueError('Expected revision, onboarding and plan are required.')
    if type(value['expectedRevision']) is not int or value['expectedRevision'] < 0:
        raise ValueError('Expected revision must be a nonnegative integer.')
    onboarding, plan = value['onboarding'], value['plan']
    if onboarding is not None:
        if type(onboarding) is not dict:
            raise ValueError('Onboarding must be an object or null.')
        for name in ('locations', 'entities'):
            if name in onboarding and (type(onboarding[name]) is not list or len(onboarding[name]) > 100 or any(type(row) is not dict for row in onboarding[name])):
                raise ValueError('Locations and entities must contain at most 100 records each.')
        if 'sources' in onboarding and (type(onboarding['sources']) is not list or len(onboarding['sources']) != 5 or any(type(row) is not dict for row in onboarding['sources'])):
            raise ValueError('Onboarding sources must contain exactly five records.')
        for name in ('company', 'period', 'boundary', 'review'):
            if name in onboarding and type(onboarding[name]) is not dict:
                raise ValueError('Onboarding sections must be objects.')
        for name in ('sources', 'changes'):
            if name in onboarding and (type(onboarding[name]) is not list or len(onboarding[name]) != 5 or any(type(row) is not dict for row in onboarding[name])):
                raise ValueError('Onboarding source and change sections require five records.')
        for name in ('company', 'period', 'boundary'):
            string_fields(onboarding.get(name, {}), ONBOARDING_TEXT)
        for name in ('entities', 'locations', 'sources', 'changes'):
            for row in onboarding.get(name, []):
                string_fields(row, ONBOARDING_TEXT)
        review = onboarding.get('review', {})
        string_fields(review, ('role',))
        for name in ('complete', 'needed'):
            if name in review and type(review[name]) is not bool:
                raise ValueError('Review acknowledgments must be boolean.')
    if type(plan) is not dict or type(plan.get('schemaVersion')) is not int or plan['schemaVersion'] != 1:
        raise ValueError('Unsupported plan schema version.')
    if type(plan.get('catalogVersion')) is not str or not plan['catalogVersion'].strip() or len(plan['catalogVersion']) > 120:
        raise ValueError('A catalog version is required.')
    for key, kind in (('items', dict), ('custom', list), ('screening', dict)):
        if type(plan.get(key)) is not kind:
            raise ValueError('Plan items, custom sources and screening have invalid shapes.')
    for item in plan['items'].values():
        validate_item(item)
    for item in plan['custom']:
        validate_item(item)
        for key in ('id', 'title', 'scope'):
            if type(item.get(key)) is not str or not item[key].strip():
                raise ValueError('Custom activities require an ID, title and scope.')
        if item['scope'] not in ('1', '2', '3', 'unknown'):
            raise ValueError('Unsupported custom activity scope.')
    for item in plan['screening'].values():
        if type(item) is not dict:
            raise ValueError('Screening entries must be objects.')
        string_fields(item, ('answer', 'reason', 'notes'))
        string_list(item, 'locationIds')
        if 'answer' in item and item['answer'] not in ('', 'Yes', 'No', 'Not sure'):
            raise ValueError('Unsupported screening answer.')


ONBOARDING_TEXT = (
    'id', 'legal', 'trading', 'country', 'region', 'industry', 'other', 'additional', 'naics', 'role',
    'start', 'end', 'first', 'base', 'hasParent', 'parent', 'approach', 'operations', 'name',
    'relationship', 'owner', 'share', 'included', 'reason', 'purpose', 'entity', 'otherEntity',
    'occupancy', 'control', 'operator', 'locality', 'startMode', 'endMode', 'opened', 'from',
    'to', 'answer', 'date', 'details', 'names', 'location', 'notes'
)


def string_fields(obj, fields):
    for field in fields:
        if field in obj and type(obj[field]) is not str:
            raise ValueError('Text fields must contain strings.')


def string_list(obj, field):
    if field in obj and (type(obj[field]) is not list or any(type(value) is not str for value in obj[field])):
        raise ValueError('ID lists must contain strings.')


def validate_item(item):
    if type(item) is not dict:
        raise ValueError('Plan items must be objects.')
    string_fields(item, ('id', 'status', 'inputFingerprint', 'subtypeId', 'notes', 'equipment', 'title', 'scope', 'familyId', 'description'))
    string_list(item, 'locationIds')
    string_list(item, 'evidenceIds')
    if 'needsReview' in item and type(item['needsReview']) is not bool:
        raise ValueError('Review status must be boolean.')
    if 'status' in item and item['status'] not in ('not-started', 'in-progress', 'complete'):
        raise ValueError('Unsupported collection status.')
    if 'checks' in item and (type(item['checks']) is not dict or any(type(answer) is not bool for answer in item['checks'].values())):
        raise ValueError('Checklist answers must be boolean.')
    for field in ('records', 'evidence'):
        if field in item and (type(item[field]) is not list or any(type(row) is not dict for row in item[field])):
            raise ValueError('Records and evidence must be lists of objects.')
    for record in item.get('records', []):
        string_fields(record, ('id', 'recordType', 'unit', 'quality', 'periodStart', 'periodEnd', 'reference', 'notes'))
        string_list(record, 'evidenceIds')
        quantity = record.get('quantity')
        if quantity is not None and (type(quantity) is not str or (quantity != '' and not re.fullmatch(r'[0-9]+(?:\.[0-9]+)?', quantity.strip()))):
            raise ValueError('Quantity must be a nonnegative decimal string or unknown.')
        if quantity not in (None, '') and any(not record.get(key, '').strip() for key in ('recordType', 'unit')):
            raise ValueError('Entered quantities require a record type and unit.')
        if 'quality' in record and record['quality'] not in ('actual', 'estimated', 'unknown'):
            raise ValueError('Unsupported record quality.')
        for key in ('periodStart', 'periodEnd'):
            if record.get(key):
                if not re.fullmatch(r'[0-9]{4}-[0-9]{2}-[0-9]{2}', record[key]):
                    raise ValueError('Record dates must use YYYY-MM-DD.')
                date.fromisoformat(record[key])
        if record.get('periodStart') and record.get('periodEnd') and record['periodStart'] > record['periodEnd']:
            raise ValueError('Record period ends before it starts.')
    for metadata in item.get('evidence', []):
        for key in ('id', 'name', 'mime', 'sha256'):
            if type(metadata.get(key)) is not str or not metadata[key]:
                raise ValueError('Evidence metadata is incomplete.')
        if not re.fullmatch(r'ev_[0-9a-f]{32}', metadata['id']) or not re.fullmatch(r'[0-9a-f]{64}', metadata['sha256']):
            raise ValueError('Evidence ID or digest is invalid.')
        if type(metadata.get('size')) is not int or not 0 < metadata['size'] <= MAX_FILE:
            raise ValueError('Evidence size is invalid.')
        string_fields(metadata, ('createdAt',))


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate field names are not supported.')
        result[key] = value
    return result


class Store:
    def __init__(self, path):
        self.path = Path(path).resolve()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            version = db.execute('PRAGMA user_version').fetchone()[0]
            if version not in (0, 1):
                raise ValueError('Unsupported local database schema version.')
            db.executescript('''
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS workspace (
                    id TEXT PRIMARY KEY CHECK(id='local-workspace'),
                    revision INTEGER NOT NULL CHECK(revision >= 0),
                    onboarding_json TEXT NOT NULL,
                    plan_json TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS workspace_revision (
                    workspace_id TEXT NOT NULL REFERENCES workspace(id),
                    revision INTEGER NOT NULL CHECK(revision >= 0),
                    onboarding_json TEXT NOT NULL,
                    plan_json TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    content_sha256 TEXT NOT NULL,
                    PRIMARY KEY(workspace_id, revision)
                );
                CREATE TRIGGER IF NOT EXISTS revision_no_update BEFORE UPDATE ON workspace_revision
                    BEGIN SELECT RAISE(ABORT, 'Revision history is append-only'); END;
                CREATE TRIGGER IF NOT EXISTS revision_no_delete BEFORE DELETE ON workspace_revision
                    BEGIN SELECT RAISE(ABORT, 'Revision history is append-only'); END;
                CREATE TABLE IF NOT EXISTS evidence (
                    id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL REFERENCES workspace(id),
                    name TEXT NOT NULL,
                    mime TEXT NOT NULL,
                    size INTEGER NOT NULL CHECK(size > 0 AND size <= 5242880),
                    sha256 TEXT NOT NULL,
                    content BLOB NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE TRIGGER IF NOT EXISTS evidence_no_update BEFORE UPDATE ON evidence
                    BEGIN SELECT RAISE(ABORT, 'Evidence is immutable'); END;
                CREATE TRIGGER IF NOT EXISTS evidence_no_delete BEFORE DELETE ON evidence
                    BEGIN SELECT RAISE(ABORT, 'Evidence is immutable'); END;
                PRAGMA user_version=1;
            ''')
            db.execute('BEGIN IMMEDIATE')
            if db.execute('SELECT 1 FROM workspace').fetchone() is None:
                now = timestamp()
                plan = encoded(EMPTY_PLAN).decode('utf-8')
                db.execute('INSERT INTO workspace VALUES (?,0,?,?,?)', ('local-workspace', 'null', plan, now))
                self.append(db, 0, 'null', plan, now)

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=5)
        db.row_factory = sqlite3.Row
        db.execute('PRAGMA foreign_keys=ON')
        db.execute('PRAGMA synchronous=FULL')
        try:
            with db:
                yield db
        finally:
            db.close()

    @staticmethod
    def append(db, revision, onboarding, plan, now):
        digest = hashlib.sha256(encoded({'onboarding': json.loads(onboarding), 'plan': json.loads(plan)})).hexdigest()
        db.execute('INSERT INTO workspace_revision VALUES (?,?,?,?,?,?)', ('local-workspace', revision, onboarding, plan, now, digest))

    @staticmethod
    def decode(row):
        return {'id': row['id'], 'revision': row['revision'], 'onboarding': json.loads(row['onboarding_json']), 'plan': json.loads(row['plan_json']), 'updatedAt': row['updated_at']}

    def read(self):
        with self.connect() as db:
            return self.decode(db.execute('SELECT * FROM workspace WHERE id=?', ('local-workspace',)).fetchone())

    def write(self, value):
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('SELECT * FROM workspace WHERE id=?', ('local-workspace',)).fetchone()
            if row['revision'] != value['expectedRevision']:
                return None
            for evidence_id in evidence_references(value['plan']):
                if db.execute('SELECT 1 FROM evidence WHERE id=? AND workspace_id=?', (evidence_id, 'local-workspace')).fetchone() is None:
                    raise UnknownEvidence()
            for metadata in evidence_metadata(value['plan']):
                saved = db.execute('SELECT name,mime,size,sha256,created_at FROM evidence WHERE id=? AND workspace_id=?', (metadata['id'], 'local-workspace')).fetchone()
                if saved is None or any(metadata.get(key) != saved[key] for key in ('name', 'mime', 'size', 'sha256')) or ('createdAt' in metadata and metadata['createdAt'] != saved['created_at']):
                    raise UnknownEvidence()
            revision = row['revision'] + 1
            onboarding, plan = encoded(value['onboarding']).decode('utf-8'), encoded(value['plan']).decode('utf-8')
            now = timestamp()
            self.append(db, revision, onboarding, plan, now)
            db.execute('UPDATE workspace SET revision=?, onboarding_json=?, plan_json=?, updated_at=? WHERE id=?', (revision, onboarding, plan, now, 'local-workspace'))
            result = self.decode(db.execute('SELECT * FROM workspace WHERE id=?', ('local-workspace',)).fetchone())
        return result


    def add_evidence(self, name, mime, content):
        evidence_id = 'ev_' + secrets.token_hex(16)
        digest, now = hashlib.sha256(content).hexdigest(), timestamp()
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            total = db.execute('SELECT COALESCE(SUM(size),0) FROM evidence').fetchone()[0]
            if total + len(content) > MAX_EVIDENCE_TOTAL:
                raise EvidenceFull()
            db.execute('INSERT INTO evidence VALUES (?,?,?,?,?,?,?,?)', (evidence_id, 'local-workspace', name, mime, len(content), digest, content, now))
        return {'id': evidence_id, 'name': name, 'mime': mime, 'size': len(content), 'sha256': digest, 'createdAt': now}

    def read_evidence(self, evidence_id):
        with self.connect() as db:
            row = db.execute('SELECT * FROM evidence WHERE id=? AND workspace_id=?', (evidence_id, 'local-workspace')).fetchone()
            if row is None:
                return None
            return {'id': row['id'], 'name': row['name'], 'mime': row['mime'], 'size': row['size'], 'sha256': row['sha256'], 'createdAt': row['created_at'], 'contentBase64': base64.b64encode(row['content']).decode('ascii')}


class UnknownEvidence(ValueError):
    pass


class EvidenceFull(ValueError):
    pass


def evidence_references(node):
    if type(node) is dict:
        for key, value in node.items():
            if key == 'evidenceIds':
                if type(value) is not list or len(value) > 100 or any(type(item) is not str or not item.startswith('ev_') or len(item) != 35 for item in value):
                    raise UnknownEvidence()
                yield from value
            else:
                yield from evidence_references(value)
    elif type(node) is list:
        for value in node:
            yield from evidence_references(value)


def evidence_metadata(plan):
    for item in list(plan['items'].values()) + plan['custom']:
        yield from item.get('evidence', [])


def validate_evidence(value):
    if type(value) is not dict or set(value) != {'name', 'mime', 'contentBase64'}:
        raise ValueError()
    name, mime, body = value['name'], value['mime'], value['contentBase64']
    if type(name) is not str or not name.strip() or len(name) > 200 or any(ord(c) < 32 or c in '/\\<>:' or 0xD800 <= ord(c) <= 0xDFFF for c in name):
        raise ValueError()
    suffixes = {'application/pdf': ('.pdf',), 'image/png': ('.png',), 'image/jpeg': ('.jpg', '.jpeg'), 'text/csv': ('.csv',), 'text/plain': ('.txt',)}
    if type(mime) is not str or mime not in suffixes or not name.lower().endswith(suffixes[mime]) or type(body) is not str:
        raise ValueError()
    content = base64.b64decode(body, validate=True)
    if not content or len(content) > MAX_FILE:
        raise ValueError()
    signatures = {'application/pdf': b'%PDF-', 'image/png': b'\x89PNG\r\n\x1a\n', 'image/jpeg': b'\xff\xd8\xff'}
    if mime in signatures and not content.startswith(signatures[mime]):
        raise ValueError()
    if mime.startswith('text/'):
        plain = content.decode('utf-8-sig')
        if any(ord(c) < 32 and c not in '\t\r\n' for c in plain):
            raise ValueError()
    return name, mime, content


class Server(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, port, db_path):
        self.store = Store(db_path)
        self.session = secrets.token_urlsafe(32)
        super().__init__(('127.0.0.1', port), Handler)
        self.cookie_name = COOKIE + '_' + str(self.server_port)
        self.authority = '127.0.0.1:' + str(self.server_port)
        self.origin = 'http://' + self.authority


class Handler(BaseHTTPRequestHandler):
    server_version = 'NeuvetraLocal/1'
    sys_version = ''

    def setup(self):
        super().setup()
        self.connection.settimeout(10)

    def log_message(self, *args):
        # No request contents, paths, cookies or workspace details in logs.
        pass

    def respond(self, status, payload, content_type='application/json; charset=utf-8', session=False, head=False):
        body = encoded(payload) if not isinstance(payload, bytes) else payload
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Cross-Origin-Resource-Policy', 'same-origin')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
        if session:
            self.send_header('Set-Cookie', f'{self.server.cookie_name}={self.server.session}; Path=/; HttpOnly; SameSite=Strict')
        self.end_headers()
        if not head:
            self.wfile.write(body)

    def error(self, status, message):
        self.respond(status, {'error': message})

    def trusted(self, mutation=False, api=False):
        if self.headers.get_all('Host') != [self.server.authority]:
            self.error(403, 'Use the local server address shown at startup.')
            return False
        origin = self.headers.get('Origin')
        if self.headers.get('Sec-Fetch-Site') == 'cross-site' or (origin is not None and origin != self.server.origin):
            self.error(403, 'Cross-origin requests are not allowed.')
            return False
        if api and self.headers.get('X-Neuvetra-Local') != '1':
            self.error(403, 'Local application header required.')
            return False
        if mutation:
            if self.headers.get_all('Origin') != [self.server.origin]:
                self.error(403, 'Matching local origin required.')
                return False
            try:
                cookie = SimpleCookie(self.headers.get('Cookie', ''))
                token = cookie[self.server.cookie_name].value if self.server.cookie_name in cookie else ''
            except CookieError:
                token = ''
            if not token.isascii() or not hmac.compare_digest(token, self.server.session):
                self.error(403, 'Reload the local application before saving.')
                return False
        return True

    def do_GET(self):
        self.get()

    def do_HEAD(self):
        self.get(head=True)

    def get(self, head=False):
        path = urlsplit(self.path).path
        if not self.trusted(api=path.startswith('/api/')):
            return
        if path == '/api/workspace':
            try:
                self.respond(200, self.server.store.read(), session=True, head=head)
            except (sqlite3.Error, ValueError):
                self.error(503, 'Local storage is unavailable. Try again later.')
            return
        if path.startswith('/api/evidence/'):
            try:
                result = self.server.store.read_evidence(path.removeprefix('/api/evidence/'))
                if result is None:
                    self.error(404, 'Evidence file not found.')
                else:
                    self.respond(200, result, head=head)
            except (sqlite3.Error, ValueError):
                self.error(503, 'Local storage is unavailable.')
            return
        if path.startswith('/api/'):
            self.error(404, 'Endpoint not found.')
            return
        decoded = unquote(path)
        if '\\' in decoded or '\x00' in decoded or any(part.startswith('.') for part in decoded.split('/') if part):
            self.error(404, 'File not found.')
            return
        target = (ROOT / (decoded.lstrip('/') or 'index.html')).resolve()
        try:
            relative = target.relative_to(ROOT)
        except ValueError:
            self.error(404, 'File not found.')
            return
        allowed = target.suffix in ('.html', '.css', '.js', '.woff2') and len(relative.parts) == 1
        allowed = allowed or (target.suffix == '.json' and len(relative.parts) == 2 and relative.parts[0] == 'data')
        if not allowed or not target.is_file():
            self.error(404, 'File not found.')
            return
        try:
            self.respond(200, target.read_bytes(), mimetypes.guess_type(target.name)[0] or 'application/octet-stream', session=True, head=head)
        except OSError:
            self.error(404, 'File not found.')

    def do_PUT(self):
        if not self.trusted(mutation=True, api=True):
            return
        if self.path != '/api/workspace':
            self.error(404, 'Endpoint not found.')
            return
        if self.headers.get('Content-Type', '').split(';')[0].strip().lower() != 'application/json':
            self.error(415, 'Use application/json.')
            return
        lengths = self.headers.get_all('Content-Length') or []
        if self.headers.get('Transfer-Encoding') or len(lengths) != 1 or not lengths[0].isdigit():
            self.error(400, 'A single valid Content-Length is required.')
            return
        length = int(lengths[0])
        if length > MAX_BODY:
            self.error(413, 'Workspace exceeds the 1 MiB request limit.')
            return
        try:
            raw = self.rfile.read(length)
            if len(raw) != length:
                raise ValueError('Incomplete request body.')
            value = json.loads(raw.decode('utf-8'), object_pairs_hook=unique_object, parse_constant=lambda _: (_ for _ in ()).throw(ValueError('Nonfinite numbers are not supported.')))
            validate(value)
        except (ValueError, UnicodeError, RecursionError, OverflowError):
            self.error(400, 'Invalid workspace JSON or unsupported field shape or size.')
            return
        except (TimeoutError, OSError):
            self.error(408, 'Request body timed out.')
            return
        try:
            result = self.server.store.write(value)
            if result is None:
                self.error(409, 'A newer revision is saved. Reload before making another change.')
            else:
                self.respond(200, result)
        except UnknownEvidence:
            self.error(400, 'An evidence reference is invalid or was not uploaded to this workspace.')
        except (sqlite3.Error, ValueError, OSError):
            self.error(503, 'Local storage is unavailable. Your changes were not confirmed saved.')

    def do_POST(self):
        if not self.trusted(mutation=True, api=True):
            return
        if self.path != '/api/evidence':
            self.error(404, 'Endpoint not found.')
            return
        if self.headers.get('Content-Type', '').split(';')[0].strip().lower() != 'application/json':
            self.error(415, 'Use application/json.')
            return
        lengths = self.headers.get_all('Content-Length') or []
        if self.headers.get('Transfer-Encoding') or len(lengths) != 1 or not lengths[0].isdigit():
            self.error(400, 'A single valid Content-Length is required.')
            return
        length = int(lengths[0])
        if length > MAX_UPLOAD_BODY:
            self.error(413, 'Evidence exceeds the 5 MiB file limit.')
            return
        try:
            raw = self.rfile.read(length)
            if len(raw) != length:
                raise ValueError()
            value = json.loads(raw.decode('utf-8'), object_pairs_hook=unique_object)
            name, mime, content = validate_evidence(value)
        except (ValueError, UnicodeError, RecursionError, binascii.Error):
            self.error(400, 'Invalid evidence file. Use a PDF, PNG, JPEG, UTF-8 CSV or TXT file up to 5 MiB.')
            return
        except (TimeoutError, OSError):
            self.error(408, 'Request body timed out.')
            return
        try:
            self.respond(201, self.server.store.add_evidence(name, mime, content))
        except EvidenceFull:
            self.error(413, 'This local workspace has reached its 50 MiB evidence limit.')
        except (sqlite3.Error, ValueError, OSError):
            self.error(503, 'Local storage is unavailable. Upload was not confirmed saved.')

    def do_OPTIONS(self):
        self.error(405, 'Cross-origin access is not enabled.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=4321)
    parser.add_argument('--db', type=Path, default=Path(tempfile.gettempdir()) / 'neuvetra-inventory-plan.sqlite3')
    args = parser.parse_args()
    server = Server(args.port, args.db)
    print('Local inventory planning demo: ' + server.origin, flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
