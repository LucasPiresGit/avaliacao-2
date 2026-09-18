# Critérios de Aceitação

- [x] O site é servido pelo endereço pages.dev atribuído à equipe;
- [x] Os arquivos estáticos e as Functions compartilham a mesma origem;
- [x] O projeto foi publicado por integração com GitHub;
- [x] A equipe não instalou nem executou Node.js, npm, npx ou Wrangler;
- [x] Cada provedor usa uma URL de retorno própria e exata;
- [x] Os pedidos de autorização usam código e PKCE S256;
- [x] A Function apresenta o Client Secret correto somente na troca de tokens;
- [x] O retorno recusa uma transação ausente, expirada, alterada ou reutilizada;
- [x] O id_token do Google só produz uma sessão depois da validação criptográfica e semântica;
- [x] O access_token do GitHub é usado somente para consultar /user e a autorização é revogada antes da criação da sessão;
- [x] O cookie de sessão é opaco, Secure, HttpOnly, SameSite=Strict e não possui Domain;
- [x] O D1 guarda o resumo do cookie, não seu valor bruto;
- [x] /api/me devolve somente o perfil necessário;
- [x] O logout confere Origin, remove a sessão e expira o cookie;
- [x] Um cookie revogado não restaura a sessão;
- [x] Tokens e segredos não aparecem no HTML, nas URLs salvas, no armazenamento Web ou nos registros;
- [x] A dupla consegue explicar por que os arquivos estáticos permanecem públicos;
- [x] As sessões administrativas foram encerradas no computador compartilhado.

**Assinaturas:**
Lucas Oliveira Pires