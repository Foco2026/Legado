# Preparação do Supabase — Legado Barbearia

O projeto continua funcionando sem Supabase. Estes arquivos deixam a próxima integração organizada:

- `supabase-schema.sql`: tabelas, índices, RLS e funções iniciais.
- `supabase-config.example.js`: modelo para URL e chave pública.
- Backup JSON do painel: será a fonte para migrar os dados locais.

## Dados que serão necessários

1. URL do projeto Supabase.
2. Chave `anon` ou `publishable` pública.
3. E-mail que será usado como proprietário do painel.

Nunca envie nem coloque a chave `service_role` dentro do site.

## Ordem da integração

1. Executar `supabase-schema.sql` no SQL Editor.
2. Criar o usuário proprietário no Supabase Auth.
3. Renomear `supabase-config.example.js` para `supabase-config.js` e inserir as credenciais públicas.
4. Substituir o armazenamento local pelo adaptador Supabase.
5. Migrar serviços, horários, portfólio, avaliações e agendamentos usando o backup JSON.
6. Testar conflitos de horário, login, consulta por código e políticas RLS.
7. Publicar em HTTPS.

## Cuidados antes da produção

- A criação pública de agendamentos deve receber validação contra conflitos no servidor.
- Recomenda-se usar Edge Function ou RPC para agendar, cancelar e reagendar.
- Adicionar proteção contra spam, limite de requisições e, se necessário, CAPTCHA.
- As fotos do portfólio devem ser enviadas ao Supabase Storage e salvas no banco somente como URL.
- Revisar as políticas RLS com dados de teste antes de receber clientes reais.
