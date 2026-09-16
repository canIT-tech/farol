# Política de Privacidade — Farol

> **Texto em revisão jurídica.** Publicado em `/privacy` para o período de teste; os campos
> `[ENTRE COLCHETES]` são preenchidos antes do lançamento comercial (ver `docs/legal/README.md`).

**Vigência a partir de:** [DATA DE PUBLICAÇÃO]
**Última atualização:** [DATA]

Esta Política explica como o **Farol** (`farolviagens.com`), operado por
**[RAZÃO SOCIAL], CNPJ [00.000.000/0000-00]**, sede em **[ENDEREÇO]** ("nós",
"operador", "controlador"), trata dados pessoais, em conformidade com a
**Lei nº 13.709/2018 (LGPD)**.

**Encarregado pelo tratamento de dados pessoais (DPO):** `[E-MAIL DO ENCARREGADO]`.

---

## 1. A quem esta Política se aplica

- Visitantes do site e da landing page.
- Pessoas que entram na **lista de espera** (waitlist).
- Usuários cadastrados no aplicativo.
- Clientes dos planos pagos.

---

## 2. Dados que tratamos

### 2.1 Que você nos fornece
| Contexto | Dados |
|---|---|
| Lista de espera | e-mail; origem da inscrição (qual página/campanha) |
| Cadastro / conta | e-mail; identificador de autenticação |
| Perfil de gosto | interesses de viagem, ritmo, preferências |
| Dados da viagem | origem, datas, orçamento, número de viajantes, destino escolhido |
| Chat de ajuste | o texto das mensagens que você envia ao assistente |
| Pagamento | os dados de cartão são inseridos **diretamente na Stripe**; nós recebemos apenas status da transação, valor, data, bandeira e os últimos dígitos |
| Suporte | o conteúdo das mensagens que você nos manda |

### 2.2 Coletados automaticamente
- **Dados de uso e dispositivo:** páginas visitadas, ações no produto, data/hora, tipo
  de navegador e sistema, idioma, endereço IP (para segurança e prevenção a fraude).
- **Cookies e tecnologias similares** — ver seção 8.

Não tratamos intencionalmente dados pessoais **sensíveis** (art. 5º, II, da LGPD). Não
insira dados de saúde, biometria, origem racial, opinião política, etc. no chat.

---

## 3. Para que usamos e com que base legal

| Finalidade | Base legal (LGPD) |
|---|---|
| Criar e manter sua conta; gerar e ajustar roteiros; processar créditos e pagamentos | execução de contrato (art. 7º, V) |
| Enviar e-mails transacionais (confirmação de pagamento, roteiro pronto, avisos de serviço) | execução de contrato (art. 7º, V) |
| Guardar seu e-mail na lista de espera e avisar sobre o lançamento | consentimento (art. 7º, I) |
| Enviar novidades e comunicações de marketing | consentimento (art. 7º, I) — com opt-out em todo e-mail |
| Melhorar o produto, medir uso, depurar erros | legítimo interesse (art. 7º, IX) |
| Prevenir fraude, abuso e garantir a segurança da plataforma | legítimo interesse (art. 7º, IX) |
| Cumprir obrigações fiscais, contábeis e regulatórias | obrigação legal (art. 7º, II) |
| Exercer ou defender direitos em processo | exercício regular de direitos (art. 7º, VI) |

Você pode **revogar o consentimento** a qualquer momento (seção 7); isso não afeta os
tratamentos feitos antes da revogação nem os que têm outra base legal.

---

## 4. Compartilhamento com terceiros (operadores e parceiros)

Não vendemos dados pessoais. Compartilhamos o mínimo necessário com prestadores que
tratam dados **em nosso nome** (operadores) ou como controladores independentes, quando
indicado:

| Terceiro | O que recebe | Para quê |
|---|---|---|
| **Supabase** (infraestrutura) | conta, perfil, dados de viagem, chat | autenticação, banco de dados e armazenamento |
| **Anthropic (Claude)** | preferências e dados da viagem, mensagens do chat (sem seu e-mail) | gerar e ajustar o roteiro por IA |
| **Google Places** | nome da cidade/região e termos de busca de pontos de interesse | trazer restaurantes e POIs para o roteiro |
| **Travelpayouts / Aviasales / Hotellook** | parâmetros de busca (origem, destino, datas) ao montar os links; identificador de afiliado (`marker`) no clique | indicações de voo e hospedagem e mensuração de comissão — **controlador independente** quanto à navegação no site do parceiro |
| **Stripe** (pagamento) | dados que você insere no checkout; e-mail; valor | processar o pagamento — **controlador independente** dos dados do cartão |
| **[PROVEDOR DE E-MAIL]** | seu e-mail e o conteúdo da mensagem transacional | entregar os e-mails do serviço |

> **Analytics não faz parte do MVP** (decisão 2026-08-31: instrumentação de produto
> fica para uma fase posterior). Quando uma ferramenta de analytics (PostHog) for
> adotada, ela entra nesta tabela e na seção de cookies, e passa a exigir opt-in.

Também podemos compartilhar dados com **autoridades** quando exigido por lei ou ordem
judicial, e com **assessores** (contábil, jurídico) sob dever de sigilo. Em caso de
reorganização societária, os dados podem ser transferidos ao sucessor, mantida esta
Política.

---

## 5. Transferência internacional

Alguns operadores acima (por exemplo, **Anthropic**, **Stripe**, **Supabase**,
**Google**) podem tratar dados **fora do Brasil**. Nesses casos, adotamos as
salvaguardas do art. 33 da LGPD — cláusulas contratuais padrão e compromissos de
segurança equivalentes ao padrão brasileiro.

---

## 6. Por quanto tempo guardamos

- **Conta e dados de viagem:** enquanto a conta existir. Após o encerramento, excluímos
  ou anonimizamos em até **[30/60/90] dias**, salvo o que a lei exigir manter.
- **Dados de pagamento e fiscais:** pelo prazo legal (em regra, **5 anos**).
- **Lista de espera:** até o lançamento e a conversão em conta, ou até você pedir a
  remoção / cancelar a inscrição — o que ocorrer primeiro.
- **Logs de segurança:** até **[6/12] meses**.
- **Backups:** expiram no ciclo de rotação (**[período]**).

---

## 7. Seus direitos (art. 18 da LGPD)

Você pode, a qualquer tempo:

- confirmar a existência de tratamento e **acessar** seus dados;
- pedir **correção** de dados incompletos, inexatos ou desatualizados;
- pedir **anonimização, bloqueio ou eliminação** de dados desnecessários ou tratados em
  desconformidade;
- pedir a **portabilidade** a outro fornecedor;
- pedir a **eliminação** dos dados tratados com base no consentimento;
- obter informação sobre com quem **compartilhamos** seus dados;
- **revogar o consentimento** e se **opor** a tratamento baseado em legítimo interesse;
- ser informado sobre a possibilidade de **não fornecer** consentimento e as
  consequências.

Para exercer, escreva para `[E-MAIL DO ENCARREGADO]`. Podemos pedir confirmação de
identidade. Respondemos no prazo legal. Se não ficar satisfeito, você pode reclamar à
**ANPD** (Autoridade Nacional de Proteção de Dados).

---

## 8. Cookies e tecnologias similares

Usamos cookies e recursos equivalentes (armazenamento local, scripts de terceiros) nas
seguintes categorias:

| Categoria | Exemplos | Precisa de consentimento? |
|---|---|---|
| **Essenciais** | sessão, autenticação, segurança, preferência de tema, o próprio registro da sua escolha de cookies | Não — necessários para o serviço funcionar |
| **Afiliado / monetização** | script do **Travelpayouts** (`tp-em.com`) — atribuição de comissão dos links de voo e hospedagem | Sim |

*(Analytics não está em uso no MVP — quando entrar, vira uma terceira categoria aqui,
também sujeita a opt-in.)*

**Banner de consentimento:** ao acessar o site, apenas os cookies **essenciais** são
carregados. Os cookies de **afiliado/monetização** só são ativados **depois que você
aceita** no banner. Você pode **recusar os não essenciais** e mudar a escolha depois em
"Preferências de cookies" no rodapé. Recusar não impede o uso do serviço.

> **Nota de implementação (a remover na publicação):** enquanto o banner não estiver no
> ar, o script do Travelpayouts pode carregar sem gate. Alinhar com o jurídico se isso
> é aceitável no período de waitlist ou se o banner precede o lançamento
> (ver `docs/legal/README.md`).

---

## 9. Segurança

Adotamos medidas técnicas e organizacionais para proteger os dados: criptografia em
trânsito (HTTPS), controle de acesso, segregação de ambientes, backups e registro de
acessos. Nenhum sistema é 100% seguro; em caso de incidente com risco relevante aos
titulares, comunicaremos os afetados e a ANPD nos termos da LGPD.

---

## 10. Crianças e adolescentes

O Farol não se destina a menores de 18 anos e não coletamos intencionalmente dados
dessas pessoas. Se identificarmos cadastro nessa condição sem o devido amparo do
responsável, a conta será encerrada e os dados eliminados.

---

## 11. Alterações desta Política

Podemos atualizar esta Política. Mudanças relevantes serão comunicadas pelo site ou por
e-mail antes da vigência. A data no topo indica a última atualização.

---

## 12. Contato

- Encarregado (DPO): `[E-MAIL DO ENCARREGADO]`
- Operador: [RAZÃO SOCIAL], CNPJ [00.000.000/0000-00], [ENDEREÇO].
