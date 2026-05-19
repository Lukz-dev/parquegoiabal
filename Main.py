from flask import Flask, request, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from sqlalchemy.orm import joinedload
import os
from datetime import datetime

app = Flask(__name__)
CORS(app, origins="*", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"], 
     allow_headers=["*"])
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///goiabal.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
app.config['UPLOAD_FOLDER'] = os.path.join(BASE_DIR, 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

db = SQLAlchemy(app)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(100), nullable=False)
    sobrenome = db.Column(db.String(100))
    email = db.Column(db.String(120), unique=True, nullable=False)
    senha = db.Column(db.String(200), nullable=False)
    tipo = db.Column(db.String(50), nullable=False)
    foto = db.Column(db.String(300))  # path to profile image

class Registro(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    especie = db.Column(db.String(200), nullable=False)
    tipo = db.Column(db.String(50), nullable=False)  # fauna or flora
    local = db.Column(db.String(200))
    desc = db.Column(db.Text)
    img = db.Column(db.String(300))  # path to image
    lat = db.Column(db.Float)
    lng = db.Column(db.Float)
    usuario_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    data = db.Column(db.DateTime, default=datetime.utcnow)
    user = db.relationship('User', backref=db.backref('registros', lazy=True))

class Denuncia(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    tipo = db.Column(db.String(50), nullable=False)  # incendio ou poluicao
    desc = db.Column(db.Text, nullable=False)
    local = db.Column(db.String(200))
    gravidade = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(50), default='aberto')  # aberto, andamento, resolvido
    lat = db.Column(db.Float)
    lng = db.Column(db.Float)
    usuario_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    data = db.Column(db.DateTime, default=datetime.utcnow)
    user = db.relationship('User', backref=db.backref('denuncias', lazy=True))

def create_admin_user():
    admin_email = os.environ.get('ADMIN_EMAIL', 'adm@adm.com')
    admin_password = os.environ.get('ADMIN_PASSWORD', 'adm123')
    admin_nome = os.environ.get('ADMIN_NOME', 'Administrador')
    if not User.query.filter_by(tipo='admin').first():
        if not User.query.filter_by(email=admin_email).first():
            admin = User(
                nome=admin_nome,
                sobrenome='',
                email=admin_email,
                senha=generate_password_hash(admin_password),
                tipo='admin',
                foto=None
            )
            db.session.add(admin)
            db.session.commit()
            print(f'Admin inicial criado: {admin_email}')

with app.app_context():
    db.create_all()
    create_admin_user()

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'message': 'Servidor está funcionando!'}), 200

@app.route('/api/register', methods=['POST'])
def register():
    try:
        print(f"\n{'='*60}")
        print(f"📝 Nova requisição de registro")
        print(f"{'='*60}")
        print(f"Content-Type: {request.content_type}")
        print(f"Form data: {dict(request.form)}")
        
        nome = request.form.get('nome')
        sobrenome = request.form.get('sobrenome', '')
        email = request.form.get('email')
        senha = request.form.get('senha')
        tipo = request.form.get('tipo')
        
        print(f"\nDados recebidos:")
        print(f"  Nome: {nome}")
        print(f"  Email: {email}")
        print(f"  Tipo: {tipo}")
        
        if not nome or not email or not senha or len(senha) < 6:
            print(f"❌ Validação falhou: dados inválidos")
            return jsonify({'error': 'Dados inválidos'}), 400
        if tipo == 'admin':
            print(f"❌ Tipo admin não permitido")
            return jsonify({'error': 'Registro de administrador não permitido via site'}), 403
        if User.query.filter_by(email=email).first():
            print(f"❌ E-mail {email} já cadastrado")
            return jsonify({'error': 'E-mail já cadastrado'}), 400
        
        foto_path = None
        if 'foto' in request.files:
            file = request.files['foto']
            if file and file.filename:
                print(f"📸 Processando foto: {file.filename}")
                # Verificar tamanho do arquivo (50MB máximo para fotos de perfil)
                file.seek(0, os.SEEK_END)
                file_size = file.tell()
                file.seek(0)
                
                if file_size > 50 * 1024 * 1024:
                    print(f"❌ Foto muito grande: {file_size} bytes")
                    return jsonify({'error': 'Foto de perfil muito grande. O tamanho máximo permitido é 50MB.'}), 413
                
                filename = secure_filename(file.filename)
                filename = f"profile_{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}_{filename}"
                foto_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                try:
                    file.save(foto_path)
                    print(f"✓ Foto salva em: {foto_path}")
                except Exception as e:
                    print(f'❌ Erro ao salvar foto: {e}')
                    return jsonify({'error': 'Erro ao salvar foto de perfil'}), 500
        
        print(f"\n🔐 Criando hash de senha...")
        hashed_senha = generate_password_hash(senha)
        user = User(nome=nome, sobrenome=sobrenome, email=email, senha=hashed_senha, tipo=tipo, foto=foto_path)
        db.session.add(user)
        db.session.commit()
        
        foto_url = None
        if foto_path:
            foto_url = f'/uploads/{os.path.basename(foto_path)}'
        
        print(f"✅ Usuário criado com sucesso!")
        print(f"   ID: {user.id}")
        print(f"   Email: {user.email}")
        print(f"{'='*60}\n")
        
        return jsonify({'user': {'id': user.id, 'nome': user.nome, 'email': user.email, 'tipo': user.tipo, 'foto': foto_url}})
    except Exception as e:
        import traceback
        print(f'❌ ERRO NO REGISTRO: {e}')
        print(f'Traceback:\n{traceback.format_exc()}')
        print(f"{'='*60}\n")
        return jsonify({'error': f'Erro ao criar conta: {str(e)}'}), 500

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Dados inválidos'}), 400
    email = data.get('email')
    senha = data.get('senha')
    if not email or not senha:
        return jsonify({'error': 'Credenciais inválidas'}), 401
    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.senha, senha):
        return jsonify({'error': 'Credenciais inválidas'}), 401
    return jsonify({'user': {'id': user.id, 'nome': user.nome, 'email': user.email, 'tipo': user.tipo, 'foto': f'/uploads/{os.path.basename(user.foto)}' if user.foto else None}})

@app.route('/api/registros', methods=['GET', 'POST'])
def registros():
    if request.method == 'POST':
        try:
            if 'usuario_id' not in request.form:
                return jsonify({'error': 'Não autorizado'}), 401
            usuario_id = int(request.form['usuario_id'])
            especie = request.form.get('especie')
            tipo = request.form.get('tipo')
            local = request.form.get('local', '')
            desc = request.form.get('desc', '')
            lat_str = request.form.get('lat')
            lng_str = request.form.get('lng')
            lat = float(lat_str) if lat_str and lat_str.strip() else None
            lng = float(lng_str) if lng_str and lng_str.strip() else None
            if not especie:
                return jsonify({'error': 'Nome da espécie obrigatório'}), 400
            img_path = None
            if 'img' in request.files:
                file = request.files['img']
                if file and file.filename:
                    # Verificar tamanho do arquivo (50MB máximo)
                    file.seek(0, os.SEEK_END)
                    file_size = file.tell()
                    file.seek(0)
                    
                    if file_size > 50 * 1024 * 1024:
                        return jsonify({'error': 'Imagem muito grande. O tamanho máximo permitido é 50MB.'}), 413
                    
                    filename = secure_filename(file.filename)
                    filename = f"registro_{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}_{filename}"
                    img_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                    file.save(img_path)
            registro = Registro(especie=especie, tipo=tipo, local=local, desc=desc, img=img_path, lat=lat, lng=lng, usuario_id=usuario_id)
            db.session.add(registro)
            db.session.commit()
            return jsonify({'message': 'Registro criado'})
        except Exception as e:
            print(f"Erro ao criar registro: {e}")
            return jsonify({'error': f'Erro interno do servidor: {str(e)}'}), 500
    else:
        regs = Registro.query.options(joinedload(Registro.user)).all()
        result = []
        for r in regs:
            result.append({
                'id': r.id,
                'especie': r.especie,
                'tipo': r.tipo,
                'local': r.local,
                'desc': r.desc,
                'img': f'/uploads/{os.path.basename(r.img)}' if r.img else None,
                'lat': r.lat,
                'lng': r.lng,
                'data': r.data.strftime('%d/%m/%Y'),
                'usuario': r.user.nome if r.user else None,
                'usuario_foto': f'/uploads/{os.path.basename(r.user.foto)}' if r.user and r.user.foto else None
            })
        return jsonify(result)

@app.route('/api/denuncias', methods=['GET', 'POST'])
def denuncias():
    if request.method == 'POST':
        if 'usuario_id' not in request.form:
            return jsonify({'error': 'Não autorizado'}), 401
        usuario_id = int(request.form['usuario_id'])
        tipo = request.form.get('tipo')
        desc = request.form.get('desc')
        local = request.form.get('local', '')
        gravidade = request.form.get('gravidade')
        lat = request.form.get('lat')
        lng = request.form.get('lng')
        if lat: lat = float(lat)
        if lng: lng = float(lng)
        if not tipo or not desc:
            return jsonify({'error': 'Dados obrigatórios faltando'}), 400
        denuncia = Denuncia(tipo=tipo, desc=desc, local=local, gravidade=gravidade, lat=lat, lng=lng, usuario_id=usuario_id)
        db.session.add(denuncia)
        db.session.commit()
        return jsonify({'message': 'Denúncia criada'})
    else:
        dens = Denuncia.query.join(User).add_columns(
            Denuncia.id, Denuncia.tipo, Denuncia.desc, Denuncia.local, Denuncia.gravidade, Denuncia.status, Denuncia.lat, Denuncia.lng, Denuncia.data,
            User.nome.label('usuario')
        ).all()
        result = []
        for d in dens:
            result.append({
                'id': d.id,
                'tipo': d.tipo,
                'desc': d.desc,
                'local': d.local,
                'gravidade': d.gravidade,
                'status': d.status,
                'lat': d.lat,
                'lng': d.lng,
                'data': d.data.strftime('%d/%m/%Y'),
                'usuario': d.usuario
            })
        return jsonify(result)

@app.route('/api/stats')
def stats():
    usuarios = User.query.count()
    registros = Registro.query.count()
    denuncias = Denuncia.query.count()
    fauna = Registro.query.filter_by(tipo='fauna').count()
    flora = Registro.query.filter_by(tipo='flora').count()
    incendio = Denuncia.query.filter_by(tipo='incendio').count()
    poluicao = Denuncia.query.filter_by(tipo='poluicao').count()
    return jsonify({
        'usuarios': usuarios,
        'registros': registros,
        'denuncias': denuncias,
        'fauna': fauna,
        'flora': flora,
        'incendio': incendio,
        'poluicao': poluicao
    })

@app.route('/api/imagens')
def imagens():
    regs = Registro.query.filter(Registro.img.isnot(None)).join(User).add_columns(
        Registro.id, Registro.especie, Registro.tipo, Registro.local, Registro.desc, Registro.img, Registro.lat, Registro.lng, Registro.data,
        User.nome.label('usuario'), User.foto.label('usuario_foto')
    ).order_by(Registro.data.desc()).all()
    
    result = []
    for r in regs:
        result.append({
            'id': r.id,
            'especie': r.especie,
            'tipo': r.tipo,
            'local': r.local,
            'desc': r.desc,
            'img': f'/uploads/{os.path.basename(r.img)}' if r.img else None,
            'lat': r.lat,
            'lng': r.lng,
            'data': r.data.strftime('%d/%m/%Y'),
            'usuario': r.usuario,
            'usuario_foto': f'/uploads/{os.path.basename(r.usuario_foto)}' if r.usuario_foto else None
        })
    return jsonify(result)

@app.route('/api/imagens/<int:registro_id>', methods=['DELETE'])
def delete_imagem(registro_id):
    data = request.get_json() or {}
    usuario_id = data.get('usuario_id')
    if not usuario_id:
        return jsonify({'error': 'Não autorizado'}), 401
    user = User.query.get(usuario_id)
    if not user or user.tipo != 'admin':
        return jsonify({'error': 'Acesso negado'}), 403

    registro = Registro.query.get(registro_id)
    if not registro:
        return jsonify({'error': 'Registro não encontrado'}), 404

    if registro.img:
        try:
            os.remove(registro.img)
        except OSError:
            pass
    db.session.delete(registro)
    db.session.commit()
    return jsonify({'message': 'Registro excluído'})

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', '0') == '1'
    host = os.environ.get('FLASK_HOST', '0.0.0.0')
    
    print(f"🚀 Iniciando servidor em http://{host}:{port}")
    print(f"Debug mode: {debug}")
    
    app.run(
        host=host,
        port=port,
        debug=debug
    )