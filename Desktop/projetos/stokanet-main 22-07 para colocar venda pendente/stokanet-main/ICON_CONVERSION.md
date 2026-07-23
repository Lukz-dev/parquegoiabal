# Gerar ícones a partir do anexo

Coloque a imagem original (o anexo que você enviou) em `public/source.png`.

Instale dependências de desenvolvimento (localmente):

```bash
npm install --save-dev sharp png-to-ico
```

Em seguida, execute o script para gerar os arquivos:

```bash
npm run generate:icons
```

Saída gerada em `public/`:

- `logo.png` — versão principal (1024×1024)
- `logo.webp` — versão webp otimizada
- `icon-192.png` — 192×192 (PWA)
- `icon-512.png` — 512×512 (PWA)
- `favicon.ico` — favicon multi-res (se `png-to-ico` estiver instalado) ou `favicon.png` de fallback

Observações:
- O script espera `public/source.png`. Se o anexo estiver em outro formato, renomeie para `source.png`.
- Se preferir que eu gere os binários aqui, faça upload do arquivo diretamente no workspace (`public/source.png`) ou autorize o download via link público.
