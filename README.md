# MeuDate

Projeto "MeuDate": protótipo de criação e aceitação de convites com duas opções de operação:

- Modo offline (localStorage): ideal para testar rápido sem backend; permite exportar/importar convites como JSON.
- Modo online (Firebase): quando você configurar o Firebase (Auth + Firestore + Hosting) o site passa a salvar convites e respostas na nuvem.

Como usar (modo offline)

1. Abra o site (index.html) no navegador ou na URL hospedada.
2. Marque "Usar modo offline".
3. Preencha seu nome e, opcionalmente, um título; clique em "Criar convite".
4. Um link será gerado (ex.: /d/ABC123) e uma chave de painel. As respostas feitas nesse navegador serão salvas no localStorage.
5. Use "Exportar convite (.json)" para baixar um arquivo que pode ser importado em outro navegador (clique "Importar convite").

Modo online (Firebase)

Se preferir persistência centralizada, conecte o repositório ao Firebase Hosting e habilite Firestore e Google Sign‑in:

1. No Firebase Console do seu projeto → Hosting → Connect to GitHub → autorize e selecione o repositório `pradodouglas313-creator/Date` e branch `main`.
2. Habilite Authentication → Sign‑in method → Google.
3. Crie um Firestore Database (modo teste para desenvolvimento). 
4. Você também pode gerar um token CI `firebase login:ci` e adicionar no GitHub Secrets como `FIREBASE_TOKEN` se preferir deploy via token.

Publicação (rápida) — GitHub Pages

Este repositório já inclui uma workflow (GitHub Actions) que publica o conteúdo para GitHub Pages automaticamente ao dar push na branch `main`.

Observações e limitações

- localStorage tem limite (~5MB). Evite salvar imagens grandes no modo offline.
- O modo offline não sincroniza entre dispositivos; use a exportação/importação para mover convites.
- Antes de ir para produção, endureça as regras do Firestore e revise permissões do Firebase.

Quer ajuda para conectar o Firebase (pelo celular) ou testar o deploy? Peça que eu te guie passo a passo.
