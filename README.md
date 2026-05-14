# Deploy do site em nuvem

Este projeto pode ser hospedado em um serviço como Render, Railway ou PythonAnywhere.

## Passo a passo para Render

1. Crie uma conta em https://render.com
2. Crie um novo Web Service.
3. Conecte seu repositório Git ou faça deploy manual.
4. Use as configurações:
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn Main:app`
   - Environment: `PORT` é definido automaticamente pelo Render.

## Passo a passo para Railway

1. Crie uma conta em https://railway.app
2. Faça novo projeto e escolha `Deploy from GitHub` ou `Deploy from repo`.
3. No comando de start, escolha: `gunicorn Main:app`
4. O Railway define a variável `PORT` automaticamente.

## Observações

- O aplicativo já serve `index.html` e o endpoint `/uploads/<filename>` para imagens.
- Render define `PORT` automaticamente.
- O arquivo `render.yaml` também está incluído para facilitar o deploy automático no Render.
- Em produção, remova `debug=True` ou defina `FLASK_DEBUG=0`.
- Atenção: o banco SQLite e uploads em disco são efêmeros no Render; use armazenamento externo para dados persistentes se precisar.
- Caso use outro serviço, garanta que o deploy execute `pip install -r requirements.txt` e `gunicorn Main:app`.
