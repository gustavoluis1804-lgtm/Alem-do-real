# Além do Real — Grupo 3

Projeto completo, com a versão atual do site e todos os arquivos locais.

## Abrir o site

1. Extraia todo o ZIP.
2. Abra `index.html`, na raiz. Ele abre o site em `public/index.html`.
3. Mantenha as pastas e os arquivos na estrutura entregue.

A navegação, o planeta 3D, as animações, o vídeo do grupo e as nove rodadas do desafio estão incluídos. Fontes, GSAP, imagens e vídeos estão no próprio projeto. As páginas externas citadas nas fontes precisam de internet.

## Publicar no GitHub Pages

Envie o conteúdo desta pasta para a raiz do repositório, incluindo `index.html`, `.nojekyll` e a pasta `public`. No GitHub, abra Settings → Pages e selecione a branch e a pasta `/ (root)`. O `index.html` da raiz encaminha para o site completo.

Para publicar somente a versão estática em outro serviço, use a pasta `public` como diretório do site.

## Editar o projeto

- `web/index.html`: HTML principal para edição.
- `public/`: site pronto, imagens, vídeos, fontes e arquivos CSS/JS.
- `public/loader.css` e `public/loader.js`: abertura animada.
- `public/motion.js`: animações da página e rolagem horizontal.
- `public/planet.js` e `public/planet-geometry.js`: planeta tridimensional.
- `public/assets/rounds.js` e `public/assets/challenge.js`: conteúdo e dinâmica do quiz.
- `public/method.css`: composição das seis frases de “Antes de compartilhar”.
- `public/lab.css`: seção do vídeo e transições corrigidas.

Depois de editar o HTML ou os estilos/scripts referenciados, execute na pasta do projeto:

```bash
node scripts/prepare-content.mjs
```

Isso sincroniza `web/index.html` e `public/index.html` e atualiza as versões dos arquivos para evitar cache antigo.

## Desenvolvimento com o projeto completo

O código de aplicação e serviço, as configurações, os scripts, os testes e o arquivo de dependências também estão incluídos. Para usar o ambiente de desenvolvimento, instale Node.js 22.13 ou mais recente e execute:

```bash
npm install
npm run dev
```

A versão portátil abre por padrão em `http://localhost:5173`. Para compilar:

```bash
npm run build
```

Para os testes do serviço:

```bash
npm test
```

## Conteúdo desta versão

- Abertura com letras animadas, progresso e opção de pular.
- Planeta 3D com oceanos e movimento.
- Fotografias com parallax e galeria horizontal conduzida pela rolagem.
- Desafio com 9 rodadas e 18 vídeos, com fontes após cada resposta.
- Vídeo original do Grupo 3, separado dos desafios.
- Seis frases-chave animadas em “Antes de compartilhar”.
- Tema claro/escuro, ajuste de texto e pausa de animações.
- Tópicos removidos, rodapé corrigido, transições do vídeo ajustadas e textos decorativos retirados, conforme os últimos pedidos.

## Créditos

As fontes e licenças estão em `public/CREDITOS-VIDEOS.md`, `public/CREDITOS-FOTOS.md`, `public/assets/vendor/` e na revelação de cada rodada.

O site não classifica vídeos automaticamente: as respostas do desafio seguem a origem documentada de cada amostra.

As dependências instaláveis e os arquivos temporários de compilação não fazem parte do ZIP. Todo o conteúdo necessário à versão estática já está em `public`.
