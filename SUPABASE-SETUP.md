# Conexão do Supabase — Legado Barbearia

A integração já está preparada no site. Para ativá-la no projeto publicado, siga esta ordem.

## 1. Atualize o banco

No painel do Supabase, abra **SQL Editor**, crie uma nova consulta e execute todo o conteúdo de:

- `supabase-fix.sql` para corrigir um projeto que já possui as tabelas; ou
- `supabase-schema.sql` para uma instalação completa.

Depois execute `supabase-seed.sql` para cadastrar as configurações e serviços iniciais.

## 2. Crie o usuário administrador

No Supabase, abra **Authentication → Users → Add user** e crie o usuário que entrará no painel administrativo.

Use o mesmo e-mail e a mesma senha na página `admin.html`.

## 3. Confira a configuração pública

O arquivo `supabase-config.js` deve conter:

```js
window.LEGADO_SUPABASE = {
  url: "https://SEU-PROJETO.supabase.co",
  anonKey: "SUA_CHAVE_PUBLISHABLE_OU_ANON"
};
```

A chave `publishable`/`anon` pode ficar no navegador. Nunca coloque a chave `service_role` ou `secret` no site.

## 4. Publique todos os arquivos

Envie novamente, principalmente:

- `index.html`
- `admin.html`
- `app.js`
- `admin.js`
- `supabase-bridge.js`
- `supabase-config.js`
- `sw.js`

O Service Worker recebeu uma nova versão. Depois da publicação, atualize a página com **Ctrl + F5** ou limpe os dados do site uma vez para remover o cache antigo.

## 5. Como verificar

Abra `admin.html`. No topo deve aparecer **Supabase conectado**.

Caso apareça **Supabase desconectado**:

1. confira a URL e a chave em `supabase-config.js`;
2. confirme que `supabase-fix.sql` foi executado sem erros;
3. confirme que o usuário foi criado em Authentication;
4. abra o Console do navegador para ver a mensagem detalhada.

## Correção aplicada

A chave nova do Supabase começa com `sb_publishable_`. Ela deve ser enviada no cabeçalho `apikey`. O código antigo também a enviava como `Authorization: Bearer`, o que podia causar erro de JWT e impedir toda a conexão. O novo `supabase-bridge.js` envia o token de usuário no cabeçalho `Authorization` somente depois do login.
