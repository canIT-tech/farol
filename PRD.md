# PRD — Assessor de Viagem Completo (codinome: Trip)

- **Status:** rascunho v0.1
- **Data:** 2026-08-27
- **Autor:** Felippe Butland
- **Nome do produto:** a definir (codinome interno: *Trip*)

---

## 1. Visão e problema

### 1.1 Visão
Ser o **assessor de viagem completo**: a pessoa informa quando pode viajar e do que gosta,
e o produto responde *para onde ir*, *como chegar pagando menos* (dinheiro ou milhas),
*onde ficar*, *o que fazer* e *onde comer* — num roteiro pronto para usar, ajustável
por conversa em linguagem natural.

### 1.2 Problema
Planejar uma viagem hoje exige orquestrar 6 a 10 ferramentas desconexas:

- Buscar inspiração de destino (blogs, Instagram, TikTok, ChatGPT).
- Comparar passagens em vários buscadores.
- Descobrir, por conta própria, se vale emitir com milhas — cálculo manual, opaco e demorado.
- Comparar hotéis em Booking/Airbnb sem saber se a região é boa.
- Garimpar restaurantes em Google Maps e guias.
- Montar o roteiro dia a dia numa planilha ou bloco de notas.

O resultado: horas de trabalho, decisões sub-ótimas (principalmente em milhas) e
insegurança sobre se o destino combina com o que a pessoa realmente quer.

### 1.3 Proposta de valor
| Dor | Como o produto resolve |
|---|---|
| "Não sei para onde ir" | Descoberta de destino por perfil de gosto + datas + orçamento |
| "Milhas são confusas" | Motor que compara dinheiro × milhas × pontos e recomenda a melhor emissão |
| "Não sei se o hotel fica numa boa região" | Hotéis rankeados por preço, avaliação e adequação ao roteiro |
| "Perco horas montando o roteiro" | Itinerário dia a dia gerado automaticamente e editável |
| "Ferramentas demais" | Uma interface única + chat IA que ajusta tudo por conversa |

### 1.4 O que o produto **não** é (v1)
- Não é OTA: nas fases iniciais **não processa pagamento nem emite reserva** — redireciona para parceiros (afiliados).
- Não é rede social de viagens.
- Não substitui seguro viagem, câmbio ou emissão de visto (pode indicar parceiros).

---

## 2. Público-alvo e personas

Mercado-alvo amplo (BR primeiro, arquitetura preparada para multi-idioma/multi-moeda).
Priorização de persona por fase na seção 4.

### Persona 1 — Viajante lazer Brasil ("Marina", 32)
- Viaja 1–3 vezes/ano, orçamento consciente, acumula milhas em cartão de crédito.
- Quer aproveitar milhas mas não entende as regras. Decide destino com 2–4 meses de antecedência.
- **Sucesso:** economizar dinheiro real e ter um roteiro confiável sem pesquisar por dias.

### Persona 2 — Viajante lazer global ("David", 40)
- Viaja internacionalmente, multi-moeda, compara opções entre continentes.
- Valoriza curadoria de experiências e otimização de tempo no destino.

### Persona 3 — Nômade digital / viagem longa ("Lu", 28)
- Estadias de semanas a meses, sensível a custo de vida, wifi, coworking, visto.
- Precisa de otimização de estadia estendida e flexibilidade de datas.

### Persona 4 — Consultor / agência de viagens ("Escritório Rota", B2B)
- Monta roteiros para clientes finais. Quer acelerar a montagem e ter cálculo de milhas confiável.
- **Fase v2+** — modo multi-cliente, exportação de proposta com marca própria.

---

## 3. Objetivos e métricas de sucesso

### 3.1 North Star Metric
**Roteiros de viagem concluídos por mês** (usuário gerou um roteiro e clicou para
reservar pelo menos um item ou salvou/exportou o roteiro).

### 3.2 KPIs por camada
| Camada | Métrica | Alvo MVP (6 meses pós-launch) |
|---|---|---|
| Aquisição | Cadastros/mês | 5.000 |
| Ativação | % que gera ≥1 roteiro na 1ª sessão | ≥ 40% |
| Engajamento | % que volta e ajusta o roteiro via chat | ≥ 25% |
| Receita | Taxa de clique em link de afiliado | ≥ 30% dos roteiros |
| Receita | Conversão afiliado (reserva confirmada) | ≥ 3% dos cliques |
| Retenção | Retenção D30 | ≥ 20% |
| Qualidade | CSAT do roteiro gerado | ≥ 4,2 / 5 |
| Milhas (v1) | % de emissões em que a recomendação de milhas foi seguida | ≥ 35% |

### 3.3 Métricas de contra-peso (guard-rails)
- Custo de API de terceiros por roteiro gerado ≤ meta financeira definida no plano de negócio.
- Latência p95 da geração de roteiro ≤ 15 s.
- Taxa de "dados desatualizados/errados" reportada pelo usuário ≤ 2% dos roteiros.

---

## 4. Escopo funcional por fase

A visão é um produto completo. A execução é faseada para manter foco e reduzir risco.

### MVP — "Do gosto ao roteiro"
Persona foco: **Marina** (lazer Brasil).

- **Onboarding de gosto:** questionário curto de interesses (praia, cultura, gastronomia,
  natureza, vida noturna, compras, aventura), ritmo de viagem, companhia (sozinho/casal/família/amigos),
  faixa de orçamento, restrições (mobilidade, kids, pet).
- **Descoberta de destino:** entrada = intervalo de datas OU nº de dias + mês aproximado + origem + orçamento.
  Saída = 3 a 5 destinos rankeados, com justificativa ("por que combina com você"),
  faixa de custo estimada, clima esperado e melhor época.
- **Roteiro dia a dia:** para o destino escolhido, itinerário com manhã/tarde/noite,
  deslocamentos, sugestões de restaurantes e blocos livres. Editável.
- **Busca de hospedagem:** lista de hotéis/apartamentos por região do roteiro,
  com preço, avaliação e "adequação ao roteiro". Link de afiliado.
- **Busca de voos (dinheiro):** melhores opções de voo para as datas, com preço e escalas. Link de afiliado.
- **Recomendações de restaurantes:** por faixa de preço, tipo de cozinha e proximidade dos pontos do roteiro.
- **Chat IA (interface transversal):** "troca o destino para algo mais barato",
  "tira o dia de museu", "quero mais tempo de praia", "acha um hotel mais perto do centro".
  O chat reescreve o roteiro e as buscas.
- **Conta de usuário:** salvar viagens, salvar preferências, histórico.

### v1 — "Milhas e alertas"
Personas foco: **Marina + David**.

- **Motor de milhas:** o usuário conecta (ou informa manualmente) saldos de programas
  (Smiles, Latam Pass, TudoAzul, e pontos de bancos/cartões). Para cada rota, o produto compara:
  emitir em dinheiro × emitir com milhas de cada programa × transferir pontos e emitir,
  calculando **custo efetivo** (incluindo taxas de embarque e valor atribuído ao ponto).
  Recomenda a melhor forma e explica o cálculo.
- **Alertas de preço:** monitorar voos e hotéis de destinos favoritos; notificar por
  e-mail/push web quando cair abaixo de um limite.
- **Datas flexíveis:** "mais barato em qualquer semana de julho" — varredura de calendário.
- **Comparador de câmbio e custo de vida** por destino.
- **Assinatura premium:** free com limites (nº de roteiros/mês, nº de alertas);
  premium libera alertas ilimitados, motor de milhas completo e roteiros avançados.

### v2 — "Consultoria, grupo e reserva"
Personas foco: **todos + B2B**.

- **Roteiro colaborativo:** várias pessoas votam em destino, opinam no roteiro, dividem custos.
- **Consultoria paga:** roteiro premium revisado/curado (humano ou IA avançada), entregue como pacote.
- **Reserva integrada:** checkout de hotéis/experiências dentro do produto (vira merchant of record ou modelo agência).
- **App mobile (iOS/Android):** modo offline do roteiro, notificações em trânsito, check-ins.
- **Modo B2B:** multi-cliente, proposta com marca da agência, exportação PDF.
- **Experiências e tours:** integração com GetYourGuide/Viator via afiliado.

---

## 5. Requisitos funcionais por módulo

Notação: **[M]** MVP · **[1]** v1 · **[2]** v2.

### 5.1 Perfil de gosto
- [M] Questionário de onboarding com no máximo 10 perguntas, puláveis.
- [M] Perfil editável a qualquer momento; mudanças re-influenciam recomendações futuras.
- [M] Inferência implícita: ações do usuário (rejeitar destino, remover atividade) ajustam o perfil.
- [1] Importar sinais externos opcionais (ex.: histórico de viagens informado, gostos de gastronomia).

### 5.2 Descoberta de destino
- [M] Entrada: datas ou duração + mês + origem + orçamento + nº de viajantes.
- [M] Saída: 3–5 destinos com score de aderência, faixa de custo (voo + hospedagem + diária local),
  clima, melhor época, tempo de voo desde a origem.
- [M] Cada destino traz 2–3 frases de justificativa personalizada.
- [M] Filtros pós-resultado: "só nacional", "sem voo com escala longa", "clima quente", "orçamento menor".
- [1] Considerar disponibilidade real de passagem/milha no ranking (não só custo médio).
- [2] Considerar exigência de visto/vacina conforme nacionalidade do usuário.

### 5.3 Roteiro dia a dia
- [M] Gera itinerário para a duração informada, com blocos manhã/tarde/noite.
- [M] Cada item: nome, tipo, duração estimada, custo estimado, deslocamento do item anterior.
- [M] Edição: adicionar, remover, reordenar, fixar item, marcar "dia livre".
- [M] Regeneração parcial (só um dia) sem perder o resto.
- [M] Exportar (PDF e link compartilhável).
- [1] Sincronizar com Google Calendar.
- [2] Otimização de rota intra-dia (minimizar deslocamento).

### 5.4 Voos
- [M] Buscar voos para as datas/origem/destino; ordenar por preço, duração, nº de escalas.
- [M] Link de afiliado para o parceiro de busca/emissão.
- [1] **Motor de milhas** (ver 5.7).
- [1] Datas flexíveis (±3 dias, semana mais barata do mês).
- [1] Alerta de preço por rota.

### 5.5 Hospedagem
- [M] Listar opções por região relevante do roteiro; preço por noite, total, avaliação, distância dos pontos-chave.
- [M] Campo "adequação ao roteiro" (proximidade média ponderada dos itens do itinerário).
- [M] Link de afiliado.
- [1] Alerta de preço por hotel favoritado.
- [2] Reserva dentro do produto.

### 5.6 Restaurantes
- [M] Sugestões por tipo de cozinha, faixa de preço, avaliação, proximidade de itens do roteiro.
- [M] Encaixe automático no roteiro (almoço/jantar) com opção de trocar.
- [2] Reserva de mesa via parceiro.

### 5.7 Motor de milhas (v1 — diferencial crítico)
- [1] Cadastro de programas e saldos: manual no mínimo; via integração/scraping onde houver API ou parceria.
- [1] Base de regras por programa: valor de referência do ponto, taxas de embarque típicas,
  parceiros de transferência e bônus vigentes, regras de disponibilidade.
- [1] Para uma rota, calcular e comparar:
  - Dinheiro: preço da passagem.
  - Milhas diretas: milhas necessárias × valor de referência + taxas.
  - Transferência: custo de adquirir/transferir pontos + emissão.
- [1] Recomendar a opção de menor **custo efetivo**, mostrando a memória de cálculo e o
  "valor por milha" resultante para o usuário validar a premissa.
- [1] Sinalizar quando faltam milhas e quanto/como conseguir (transferência, compra, bônus).
- [1] Atualização das regras/bônus: processo definido (curadoria manual + fontes) com data da última atualização visível.

### 5.8 Chat IA (interface transversal)
- [M] Entende comandos sobre destino, datas, orçamento, roteiro, hotel e restaurante em linguagem natural.
- [M] Toda alteração via chat atualiza o estado estruturado da viagem (não é só texto).
- [M] Mantém contexto da viagem atual; permite desfazer.
- [M] Explica o "porquê" das recomendações quando perguntado.
- [1] Responde perguntas sobre milhas ("vale a pena emitir para Lisboa em outubro?").
- [2] Proativo: sugere ajustes ("o preço para seu destino caiu 18%").

### 5.9 Conta, planos e pagamento
- [M] Cadastro/login (e-mail + social login).
- [M] Salvar múltiplas viagens; estados: rascunho, planejada, concluída.
- [1] Planos free × premium; limites e paywall; gestão de assinatura.
- [1] Cobrança recorrente (gateway a definir — ex.: Stripe).
- [2] Cobrança avulsa por roteiro de consultoria.

### 5.10 Notificações
- [1] E-mail e push web para alertas de preço e mudanças relevantes.
- [1] Preferências de frequência e canais.

---

## 6. Requisitos não-funcionais

- **Latência:** descoberta de destino p95 ≤ 8 s; roteiro completo p95 ≤ 15 s; resposta de chat p95 ≤ 5 s.
- **Disponibilidade:** 99,5% no MVP.
- **Dados de terceiros:** preços e disponibilidade são estimativas com timestamp; UI sempre mostra
  "atualizado há X" e sempre há link para confirmar no parceiro. Cache com TTL curto para preços.
- **Custo de IA/APIs:** orçamento por roteiro monitorado; usar cache e modelos adequados por tarefa
  (descoberta e chat podem exigir modelo mais capaz; formatação/extração, modelo mais barato).
- **Privacidade / LGPD:** consentimento explícito para dados de perfil e para conexão de contas de milhas;
  dados de fidelidade criptografados em repouso; direito a exclusão; nunca compartilhar credenciais de
  programas com terceiros sem consentimento.
- **Segurança:** OAuth para social login; segredos em cofre; rate limiting nas rotas de busca;
  proteção contra abuso do chat (limites por usuário).
- **Acessibilidade:** WCAG 2.1 AA no web app.
- **Internacionalização:** textos externalizados desde o MVP; moeda e idioma configuráveis (PT-BR default);
  multi-idioma ativado em fase posterior.
- **Observabilidade:** tracing das chamadas a terceiros e ao LLM; painel de custo e latência por módulo.

---

## 7. Integrações e dependências

| Área | Candidatos | Observação |
|---|---|---|
| Voos (busca/preço) | Amadeus Self-Service, Skyscanner, Kiwi, Duffel | Confirmar termos de afiliado e limites de rate |
| Hospedagem | Booking.com Affiliate, Expedia EPS, Airbnb (afiliado limitado), Hotelbeds | Comissão varia por parceiro |
| Restaurantes / POIs | Google Places, Foursquare, TripAdvisor Content API | Custo por chamada relevante — cachear |
| Experiências / tours | GetYourGuide, Viator (v2) | Afiliado |
| Milhas / pontos | Sem API oficial na maioria — curadoria manual + possíveis parcerias (Smiles, Latam Pass, TudoAzul, Livelo, bancos) | Maior risco de viabilidade do v1 |
| Clima / sazonalidade | Open-Meteo, dados históricos | Para "melhor época" |
| Câmbio | provedor de FX (ex.: exchangerate API) | v1 |
| LLM | Claude (Anthropic) | Descoberta, roteiro, chat; roteamento por tarefa |
| Pagamento | Stripe (ou Pagar.me/Adyen para BR) | v1 |
| E-mail/push | provedor transacional (ex.: Resend/SendGrid) + Web Push | v1 |

**Dependências críticas de negócio:** aprovação nos programas de afiliados (voo e hotel) antes do launch;
fonte confiável e sustentável de regras de milhas para o v1.

---

## 8. Modelo de monetização

Três fontes combinadas; pesos e prioridade a validar com dados pós-MVP.

1. **Comissão de afiliados (principal no MVP):** reservas de voo, hotel e experiências via parceiros.
   Depende de volume e de taxa de conversão do clique.
2. **Assinatura premium (v1):** free com limites (ex.: 2 roteiros/mês, 3 alertas);
   premium libera motor de milhas completo, alertas ilimitados, datas flexíveis e roteiros avançados.
   Hipótese de preço a testar.
3. **Taxa por roteiro / consultoria (v2):** pacote de roteiro curado, cobrança avulsa;
   base para o modo B2B (agências pagam por assento ou por proposta).

**Hipóteses a validar (registradas como abertas):**
- Comissão de afiliado sozinha cobre o custo de API+IA por usuário ativo? (medir no MVP)
- Qual % de usuários enxerga valor suficiente no motor de milhas para assinar? (medir no v1)
- Consultoria paga tem demanda B2C ou é só B2B? (entrevistas + teste no v2)

---

## 9. Riscos e questões em aberto

| # | Risco / questão | Impacto | Mitigação / próximo passo |
|---|---|---|---|
| R1 | Dados de milhas sem API oficial; regras mudam toda semana | Alto — é o diferencial do v1 | Começar com curadoria manual + data de atualização visível; buscar parceria; medir apetite antes de investir pesado |
| R2 | Custo de LLM + APIs por roteiro pode inviabilizar o modelo de afiliado | Alto | Definir teto de custo por roteiro; cache agressivo; roteamento de modelo por tarefa; medir desde o dia 1 |
| R3 | Aprovação nos programas de afiliado pode demorar ou ser negada | Alto | Iniciar cadastros já na fase de MVP; ter parceiro alternativo por área |
| R4 | Precisão do roteiro (lugar fechado, informação errada) mina confiança | Médio-alto | Timestamp + link de verificação; feedback de erro fácil; não afirmar disponibilidade que não foi checada |
| R5 | Escopo "tudo para todos" dilui o MVP | Médio | Faseamento desta PRD; persona foco por fase; gate de métricas antes de avançar |
| R6 | Concorrência (Google Travel, Hopper, Wanderlog, ChatGPT) | Médio | Diferencial = milhas + personalização por gosto + roteiro acionável num só lugar |
| R7 | LGPD ao conectar contas de fidelidade | Médio | Consentimento explícito, criptografia, opção manual sem conexão |
| Q1 | Nome do produto | — | Definir antes do launch |
| Q2 | Origem sempre Brasil no MVP ou multi-origem? | — | Decidir na fase de discovery técnica |
| Q3 | Stack e arquitetura (mono web + serviço de IA?) | — | Próximo documento (design técnico) |
| Q4 | Gateway de pagamento (global vs BR) | — | Decidir no v1 |

---

## 10. Roadmap de alto nível

> Estimativas grosseiras, a refinar no planejamento técnico.

| Fase | Duração aproximada | Marcos |
|---|---|---|
| Discovery técnico | 3–4 semanas | Design técnico, escolha de APIs, contratos de afiliado iniciados, protótipo do chat |
| MVP | 3–4 meses | Onboarding de gosto → descoberta → roteiro → voo/hotel/restaurante → chat → contas. Beta fechado. |
| Launch MVP + aprendizado | 1 mês | Métricas de ativação, custo por roteiro, conversão de afiliado |
| v1 — Milhas & alertas | 3–4 meses | Motor de milhas, alertas, datas flexíveis, premium + billing |
| v2 — Consultoria, grupo, reserva, mobile | 4–6 meses | Colaboração, consultoria paga, checkout integrado, app mobile, B2B |

**Gates entre fases:** só avança se os KPIs de ativação e de custo/roteiro da fase anterior
estiverem dentro da meta.

---

## Apêndice A — Glossário
- **Custo efetivo (milhas):** valor em dinheiro equivalente de uma emissão com milhas,
  somando taxas e o valor atribuído a cada milha/ponto.
- **Adequação ao roteiro (hotel):** score de proximidade ponderada entre o hotel e os itens do itinerário.
- **North Star Metric:** métrica única que melhor representa valor entregue ao usuário.

## Apêndice B — Fora de escopo (todas as fases, salvo revisão)
- Emissão de visto e passaporte.
- Seguro viagem próprio (apenas indicação de parceiro).
- Rede social / feed público de viagens.
- Câmbio/remessa próprios.
