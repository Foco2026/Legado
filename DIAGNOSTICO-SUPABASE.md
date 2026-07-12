# Diagnóstico da conexão Supabase — Legado Barbearia

## Problema encontrado no código

O projeto usa uma chave moderna no formato `sb_publishable_...`.

No arquivo antigo `supabase-bridge.js`, essa chave era enviada assim:

```http
Authorization: Bearer sb_publishable_...
```

Essa chave não é o token JWT de um usuário autenticado. Isso pode fazer a API recusar as requisições e o login com erro de JWT.

A correção aplicada foi:

- enviar a chave pública somente no cabeçalho `apikey`;
- enviar `Authorization: Bearer <access_token>` apenas depois do login;
- renovar automaticamente a sessão expirada;
- mostrar no painel se o Supabase está conectado ou desconectado.

## Projeto configurado

O arquivo `supabase-config.js` aponta para:

```text
pvapfmoejntpadjtyezj
```

Esse projeto não apareceu entre os projetos disponíveis na conta Supabase conectada durante a revisão. Portanto, ele pode estar em outra conta, pertencer ao cliente ou não estar mais acessível.

Para manter essa configuração, é necessário entrar na conta que possui esse projeto e executar `supabase-fix.sql`.

Caso o projeto não exista mais, crie um projeto exclusivo para a Legado Barbearia e substitua a URL e a chave pública em `supabase-config.js`.

## Ordem para colocar online

1. Acesse a conta que possui o projeto `pvapfmoejntpadjtyezj`.
2. Execute `supabase-fix.sql` no SQL Editor.
3. Execute `supabase-seed.sql`.
4. Crie o administrador em Authentication → Users.
5. Publique todos os arquivos atualizados.
6. Abra o site com Ctrl + F5 para remover o cache antigo.
7. Confirme se o topo do painel mostra “Supabase conectado”.
