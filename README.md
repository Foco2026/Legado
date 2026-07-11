# Legado Barbearia — Agendamento + Portfólio Premium V3

Site responsivo em HTML, CSS e JavaScript com a identidade azul-marinho, dourada e sofisticada da Legado Barbearia.

## Dados configurados

- Profissional: **Gilliel Glaydson**
- WhatsApp: **+55 (64) 9988-6880**
- Instagram: **@gdlegadobarbearia**

## Site público

- Agendamento inteligente por duração, intervalo, expediente e bloqueios.
- Consulta, cancelamento e reagendamento local com WhatsApp e código.
- Envio pelo WhatsApp e arquivo `.ics` para o calendário.
- Seção institucional sobre a barbearia e o profissional.
- Portfólio com categorias, cards em destaque e visualização ampliada.
- Avaliações de clientes cadastradas pelo administrador.
- Sinal por Pix opcional, com valor, chave e mensagem configuráveis.
- Programa de fidelidade opcional acompanhado no cadastro dos clientes.
- Perguntas frequentes, mapa, Instagram e página de privacidade.
- Link de consulta que preenche telefone e código no mesmo navegador.
- PWA instalável quando publicado em HTTPS.
- SEO básico e dados estruturados de barbearia.

## Painel administrativo

- Agenda visual diária, semanal e mensal.
- Gestão completa de agendamentos, clientes, serviços, horários e bloqueios.
- Relatórios, CSV, backup e restauração JSON.
- Gestão do portfólio com upload, compressão e ordenação de fotos.
- Gestão de depoimentos reais e controle de publicação.
- Mensagem de lembrete pronta para enviar ao WhatsApp do cliente.
- Configuração de sinal por Pix e fidelidade.
- Edição dos textos institucionais, foto do profissional, Instagram, mapa e regras.
- Indicador aproximado do uso de armazenamento local.

## Como usar o portfólio

1. Abra `admin.html`.
2. Crie o acesso local no primeiro uso.
3. Entre em **Portfólio**.
4. Escolha a foto, título, categoria, descrição e ordem.
5. Salve. A imagem é redimensionada e convertida para WebP no navegador.

Até a integração online, evite dezenas de imagens grandes: o `localStorage` normalmente tem limite baixo por domínio. Faça backups frequentes.

## Preparação para Supabase

O pacote inclui:

- `supabase-schema.sql`
- `SUPABASE-SETUP.md`
- `supabase-config.example.js`

A integração ainda não está ativa. Os dados continuam separados por navegador até recebermos as credenciais públicas do projeto Supabase.

## Ícones dos serviços pelo administrador

Na aba **Serviços**, cada serviço agora possui prévia visual, seleção entre os ícones padrão e envio de uma imagem personalizada em PNG, JPG ou WebP. A imagem é otimizada automaticamente e passa a aparecer no card do serviço no site.

## Ajuste de layout do portfólio

- Grade desktop padronizada em duas colunas.
- Todos os cards com o mesmo tamanho.
- Removido o espaço vazio causado pelos cards em destaque.
- Rodapé do portfólio alinhado à largura da grade.
- No celular, os cards passam automaticamente para uma coluna.


## Melhorias V8
- Status de funcionamento em tempo real, calculado conforme a agenda configurada.
- Nova seção de localização, horário e contato.
- Botão flutuante de WhatsApp.
- Portfólio com navegação por setas, miniaturas, compartilhamento e botão para agendar usando o trabalho como referência.
- Chamada para avaliações via WhatsApp.
- Menu mobile aprimorado, suporte ao teclado, foco visível e redução de animações para acessibilidade.
- Foto do profissional otimizada em WebP para carregamento mais rápido.

Tudo continua funcionando sem Supabase; os dados permanecem no navegador até a integração online.


## Localização
- Google Maps: https://maps.app.goo.gl/uMqV56GQe719X8EE7
- Exibição: St. Cruvinel, Mineiros - GO, 75830-000


## V10 — Portfólio sem repetição de ícones
- Os ícones permanecem apenas na seção de serviços.
- O portfólio começa vazio e recebe somente fotos reais adicionadas pelo administrador.
- Os antigos cards demonstrativos com ícones são removidos automaticamente, sem apagar fotos reais já cadastradas.


## Tutorial integrado — V11

- O site público possui uma seção “Tutorial” com o passo a passo para agendar, confirmar e consultar horários.
- O administrador possui uma Central de Ajuda completa, checklist de configuração e explicações de cada aba.
- No primeiro acesso administrativo, o tutorial é aberto automaticamente uma única vez.
- O botão “Tutorial” no topo e na barra lateral permite abrir o guia novamente.


## Proteção contra agendamentos duplicados — V12
- Uma solicitação pendente já reserva o período do profissional.
- A confirmação administrativa refaz a checagem de data, horário, duração, intervalo e profissional.
- Dois agendamentos confirmados não podem ocupar o mesmo período do mesmo profissional.
- Em registros pendentes concorrentes, o administrador escolhe qual confirmar; os demais podem ser cancelados automaticamente.
- A proteção é completa dentro dos dados deste navegador. A sincronização entre aparelhos diferentes dependerá da conexão com o Supabase.


## V13 — Painel administrativo reorganizado
- Menu lateral dividido por áreas.
- Navegação simplificada no celular.
- Ações rápidas no topo.
- Indicador de agendamentos pendentes.
- Lista de agendamentos em cartões no celular.
- Melhorias gerais de espaçamento, leitura e responsividade.


## V14 — textos do portfólio
- Textos gerais da seção editáveis dentro da aba Portfólio.
- Título, legenda curta e texto completo para cada trabalho.
- Fotos e textos organizados em etapas visuais.

## V15 — Calendário por dia
- Ao clicar em uma data na visão mensal ou semanal, o painel abre a agenda daquele dia.
- A edição não abre mais diretamente a partir do calendário mensal/semanal.
- Na visão diária, cada atendimento possui o botão explícito “Ver detalhes / editar”.
- A visão diária mostra totais de agendamentos ativos, pendentes e confirmados.
