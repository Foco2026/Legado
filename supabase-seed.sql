-- Dados iniciais da Legado Barbearia para Supabase.
-- Execute depois do supabase-schema.sql.

insert into public.business_settings (id, data, updated_at)
values (
  'main',
  '{
    "businessName": "Legado Barbearia",
    "whatsappNumber": "556499886880",
    "displayPhone": "+55 (64) 9988-6880",
    "professional": "Gilliel Glaydson",
    "barbers": ["Gilliel Glaydson"],
    "instagram": "@gdlegadobarbearia",
    "instagramUrl": "https://www.instagram.com/gdlegadobarbearia?igsh=M2xwZ3V5MmtjY2Vm",
    "address": "St. Cruvinel",
    "city": "Mineiros - GO, 75830-000",
    "businessDays": "Segunda a sábado",
    "businessHours": "09h às 19h",
    "bookingMessage": "Seu horário será analisado e confirmado pela barbearia.",
    "cancellationPolicy": "Cancelamentos e reagendamentos devem ser feitos com antecedência.",
    "showPrices": true,
    "aboutEyebrow": "CONHEÇA A LEGADO",
    "aboutTitle": "Tradição, técnica e personalidade em cada detalhe.",
    "aboutText": "A Legado Barbearia nasceu para oferecer uma experiência completa: atendimento com hora marcada, ambiente sofisticado e cuidado pensado para valorizar o estilo de cada cliente.",
    "professionalBio": "Gilliel Glaydson une precisão, atenção aos detalhes e atendimento personalizado para entregar cortes e barbas alinhados ao perfil de cada cliente.",
    "professionalPhoto": "assets/gilliel-apresentacao.webp",
    "portfolioEyebrow": "PORTFÓLIO",
    "portfolioTitle": "Resultados reais, feitos na Legado.",
    "portfolioText": "Fotos reais de cortes, barbas, acabamentos e transformações realizadas na barbearia.",
    "testimonialsEyebrow": "EXPERIÊNCIA DOS CLIENTES",
    "testimonialsTitle": "Quem vive a experiência, recomenda.",
    "testimonialsText": "Depoimentos reais podem ser cadastrados e publicados diretamente pelo administrador.",
    "googleMapsUrl": "https://maps.app.goo.gl/uMqV56GQe719X8EE7",
    "depositEnabled": false,
    "depositAmount": 0,
    "pixKey": "",
    "depositMessage": "O sinal será conferido manualmente pela barbearia.",
    "loyaltyEnabled": false,
    "loyaltyGoal": 10,
    "loyaltyReward": "Um benefício especial após 10 atendimentos concluídos."
  }'::jsonb,
  now()
)
on conflict (id) do update set data = excluded.data, updated_at = now();

insert into public.availability (id, data, updated_at)
values (
  'main',
  '{
    "slotInterval": 15,
    "bufferMinutes": 10,
    "advanceDays": 45,
    "minimumLeadMinutes": 60,
    "cancellationDeadlineMinutes": 120,
    "weekdays": {
      "0": { "enabled": false, "periods": [] },
      "1": { "enabled": true, "periods": [{ "start": "09:00", "end": "12:00" }, { "start": "13:00", "end": "19:00" }] },
      "2": { "enabled": true, "periods": [{ "start": "09:00", "end": "12:00" }, { "start": "13:00", "end": "19:00" }] },
      "3": { "enabled": true, "periods": [{ "start": "09:00", "end": "12:00" }, { "start": "13:00", "end": "19:00" }] },
      "4": { "enabled": true, "periods": [{ "start": "09:00", "end": "12:00" }, { "start": "13:00", "end": "19:00" }] },
      "5": { "enabled": true, "periods": [{ "start": "09:00", "end": "12:00" }, { "start": "13:00", "end": "19:00" }] },
      "6": { "enabled": true, "periods": [{ "start": "09:00", "end": "12:00" }, { "start": "13:00", "end": "18:00" }] }
    }
  }'::jsonb,
  now()
)
on conflict (id) do update set data = excluded.data, updated_at = now();

insert into public.services (id, name, description, duration_minutes, price, icon, active, sort_order)
values
  ('corte-classico', 'Corte Clássico', 'Acabamento preciso e finalização personalizada.', 45, 0, 'corte.webp', true, 1),
  ('barba-premium', 'Barba Premium', 'Modelagem, alinhamento e cuidado completo.', 35, 0, 'barba.webp', true, 2),
  ('corte-barba', 'Corte + Barba', 'Experiência completa para renovar o visual.', 70, 0, 'produtos.webp', true, 3),
  ('acabamento', 'Acabamento', 'Pezinho, contorno e pequenos ajustes.', 20, 0, 'agendamento.webp', true, 4)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  duration_minutes = excluded.duration_minutes,
  price = excluded.price,
  icon = excluded.icon,
  active = excluded.active,
  sort_order = excluded.sort_order,
  updated_at = now();