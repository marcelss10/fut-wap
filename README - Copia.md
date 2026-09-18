# WAAW Kit Store — reserva de uniformes + Pix

Loja Next.js para os uniformes WAAW by Alok, com:

- escolha de camisa **preta ou branca**;
- nome e numero de 0 a 100;
- ate 2 kits por reserva;
- visualizacao da camisa em 360°;
- QR Code Pix dinamico e copia e cola;
- bloqueio temporario do numero por 30 minutos enquanto aguarda o pagamento;
- painel `/admin` para acompanhar reservas, numeros e pagamentos;
- grade 0–100 separada por cor;
- marcacao de **Pago**, **Pendente**, **Rejeitado** ou **Cancelado**;
- imagem oficial completa do uniforme exibida na loja, com logos, patrocinador e detalhes do acabamento.

## Banco: Supabase

O projeto foi preparado para usar o **Supabase PostgreSQL** como banco de producao. As reservas nao ficam mais dependentes de arquivo local ou Redis.

O backend Next.js usa a `SUPABASE_SERVICE_ROLE_KEY` somente no servidor. Essa chave **nao deve ser exposta no navegador**.

### 1. Criar o banco

No Supabase, abra **SQL Editor** e execute o arquivo:

```text
supabase.sql
```

Ele cria:

- tabela `public.reservations`;
- indices para consultas;
- regra de exclusividade de `cor + numero` para reservas ativas;
- cancelamento automatico de reservas pendentes expiradas;
- RPC `reserve_kits`, que grava 1 ou 2 numeros em uma unica transacao;
- RPC `expire_pending_reservations`;
- registros iniciais que ja estavam no projeto.

### 2. Variaveis na Vercel

Configure em **Project → Settings → Environment Variables**:

```env
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key

ADMIN_USER=aidmin
ADMIN_PASS=12346
ADMIN_SESSION_SECRET=troque-por-uma-chave-grande-e-aleatoria

PIX_KEY=+5541995773260
PIX_RECEIVER_NAME=MARCEL CRISTIAN AMBROSIO
PIX_RECEIVER_CITY=SAO PAULO
KIT_PRICE=89.90
```

A `SUPABASE_SERVICE_ROLE_KEY` deve ficar somente nas variaveis do servidor/Vercel. Nao use `NEXT_PUBLIC_` nela.

## Como funciona a numeracao

Cada combinacao **cor + numero** e exclusiva.

Exemplo:

- 10 preto → pode pertencer a uma pessoa;
- 10 branco → pode pertencer a outra pessoa.

Quando o cliente reserva, o registro entra como `pendente` por 30 minutos. Se o pagamento nao for confirmado, o banco libera o numero automaticamente. Quando o admin marca como `pago`, o numero fica bloqueado.

A reserva publica usa a RPC `reserve_kits`, entao os 1 ou 2 numeros sao gravados juntos. Se outra pessoa pegar um deles primeiro, a transacao inteira falha e nenhum numero fica parcialmente reservado.

## Pix

O Pix continua sendo gerado dinamicamente pelo backend. O valor e calculado pela quantidade de kits:

- 1 kit → R$ 89,90
- 2 kits → R$ 179,80

A confirmacao do pagamento continua sendo feita no painel por enquanto: confira o comprovante e clique em **Marcar pago**. Para baixa automatica, sera necessario integrar a API/webhook do banco ou de um PSP que forneca eventos de Pix.

## Painel administrativo

Acesse:

```text
/admin
```

O painel permite:

- visualizar todas as reservas;
- ver quem esta aguardando pagamento;
- ver faturamento confirmado;
- marcar Pix como pago;
- rejeitar/cancelar reserva;
- adicionar uma reserva manual;
- consultar a grade de numeros 0–100 por cor.

## Imagem oficial do uniforme

A arte completa enviada para o projeto fica em:

```text
public/img/kit-full.webp
```

Ela aparece na pagina principal em uma secao de detalhes oficiais, antes do seletor/visualizador do kit.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

Sem as variaveis do Supabase, o projeto continua com fallback para `data/reservations.json` para desenvolvimento local. Para producao, configure o Supabase.

## Estrutura principal

```text
pages/index.js                  loja + visualizador + Pix + arte oficial
pages/admin.js                  painel administrativo
pages/api/reserve.js            reserva publica
pages/api/availability.js       disponibilidade dos numeros
pages/api/admin/list.js          reservas e indicadores
pages/api/admin/create.js        reserva manual
pages/api/admin/update-status.js atualizacao de pagamento/status
lib/db.js                      camada Supabase + fallback local
lib/pix.js                     gerador Pix EMV/BR Code
supabase.sql                   schema, regras e RPCs
public/img/kit-full.webp         imagem oficial completa enviada
```
