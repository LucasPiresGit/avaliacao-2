# Testes de Falha

## Caso 1: Retorno sem cookie temporário
*   **Preparação:** Login iniciado em janela comum e URL de autorização copiada para uma janela privativa sem o cookie `__Host-oauth-tx`.
*   **Pedido enviado:** GET na rota de retorno (`/oauth/callback/...`) sem o cookie temporário.
*   **Resultado esperado:** A rota deve recusar a resposta com status 400 e não criar a sessão.
*   **Resultado observado:** Sessão não foi criada e html retornou a mensagem: "Transação ausente".

## Caso 2: state alterado
*   **Preparação:** Login iniciado, mas antes de fornecer as credenciais, o parâmetro `state` foi alterado na URL do provedor.
*   **Pedido enviado:** Retorno do provedor com um `state` diferente do que foi salvo no banco D1.
*   **Resultado esperado:** A rota de retorno deve recusar a resposta antes de trocar o código.
*   **Resultado observado:** Resposta recusada, com retorno 500.

## Caso 3: Reutilização da transação
*   **Preparação:** Login concluído com sucesso e a URL de retorno (callback) localizada na aba Network.
*   **Pedido enviado:** Acessar a mesma URL de retorno copiada anteriormente.
*   **Resultado esperado:** A repetição deve falhar pois a transação já foi apagada do banco D1.
*   **Resultado observado:** Repetição falhou, html retornou a mensagem: "Erro na resposta do provedor".

## Caso 4: Sessão expirada
*   **Preparação:** Sessão válida criada. Executado `UPDATE sessions SET expires_at = 0;` no console D1.
*   **Pedido enviado:** Recarregar a página inicial (que dispara a consulta para `/api/me`).
*   **Resultado esperado:** A rota `/api/me` deve responder com 401 Unauthorized.
*   **Resultado observado:** 401 Unauthorized.

## Caso 5: Origem inválida na saída
*   **Preparação:** Sessão válida aberta na URL base. Console aberto em outra origem (ex: https://example.com).
*   **Pedido enviado:** `fetch("SUA_URL_BASE/oauth/logout", { method: "POST", credentials: "include" })`
*   **Resultado esperado:** A rota deve recusar a operação por validação de Origin (status 403) e a sessão original deve permanecer válida.
*   **Resultado observado:** Resposta recusada, com retorno 403 e sessão continuou válida.

## Caso 6: Reutilização do cookie revogado
*   **Preparação:** Valor do cookie `__Host-session` copiado. Logout executado na página.
*   **Pedido enviado:** Cookie recriado manualmente no navegador usando o valor copiado e rota `/api/me` consultada.
*   **Resultado esperado:** A resposta deve ser 401, pois a linha correspondente foi apagada no banco D1.
*   **Resultado observado:** Resposta recusada, com retorno 401.