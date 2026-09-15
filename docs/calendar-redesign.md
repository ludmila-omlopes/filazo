# Calendário: avaliação e novo funcionamento

## Problemas encontrados

- `buildPlayProjections` reconstruía o início subtraindo horas acumuladas de uma frequência declarada. O resultado parecia um registro real, mas mudava com o dia atual.
- `weeklyHoursFromOnboarding` convertia categorias como “várias vezes por semana” em horas fixas, com um padrão de 5 horas, sem observar quanto a pessoa jogava.
- Cada jogo em paralelo recebia todo esse tempo semanal, superestimando a capacidade total.
- A previsão era recalculada ao renderizar a página, sem histórico, limite diário ou atualização em segundo plano.
- Jogos que ultrapassavam a duração média ainda recebiam uma data próxima de término. O calendário não distinguia bem jogos sem final definido.
- A grade de pelo menos 1120 pixels exigia rolagem horizontal; barras por jogo, divisão de horas e formulário de frequência repetiam informação antes de chegar às datas úteis.

## Experiência implementada

1. Registrar ou corrigir “Comecei em”, a data real informada pela pessoa. A data em que o jogo entrou em Jogando agora não é tratada como início confirmado.
2. Acompanhar o ritmo de cada jogo, com início e previsão separados. Sem dados suficientes, mostrar o motivo em linguagem direta.
3. Consultar primeiro a grade mensal, com dias da semana, destaque de hoje e seleção de um dia para ver os eventos completos. Alternar entre mês e lista, navegar por meses e voltar a hoje sem recarregar a página. Diferenciar início, término observado, término estimado e lançamento por ícones e texto, sem barras sobrepostas ou rolagem lateral. No celular, os ícones mantêm a grade compacta; os títulos completos aparecem nos detalhes do dia. As setas do teclado percorrem dias e semanas.
4. Consultar datas de lançamento ao final da página e decidir quais adicionar. A pesquisa cobre lançamentos gerais, de todas as plataformas.

Os formulários de correção e de registro de tempo ficam recolhidos. Jogos sem fonte conectada permitem informar o total de minutos de hoje; salvar novamente substitui esse valor. Para fontes conectadas, o calendário usa as horas aceitas da última sincronização. Atualizar estimativas não inicia uma nova sincronização da biblioteca.

## Estimativas e limites

`PlayObservation` armazena contadores acumulados observados, não sessões inventadas. A primeira leitura estabelece uma referência, sem distribuir horas históricas pelos dias anteriores. A previsão usa até 28 dias, com pelo menos 7 dias entre a referência e o cálculo. Dias sem jogar entram no denominador. O ritmo é específico de cada jogo.

Tempo restante = duração da história principal − horas acumuladas. Dias até terminar = tempo restante ÷ minutos observados por dia. Não se usa porcentagem de conquistas. Sem duração da história, para jogos sem final definido, durante pausas, com fontes desatualizadas ou com tempo acima da média, a previsão fica indisponível em vez de inventar uma data. Correções negativas, mudanças de fonte e saltos incompatíveis com 16 horas/dia reiniciam a referência. Esse filtro detecta anomalias, mas não consegue distinguir toda correção de um progresso real.

O resultado fica salvo em `CalendarEstimate`: abrir a página não calcula nem modifica nada. A rotina percorre usuários em lotes, atualizando cada um uma vez por dia UTC, inclusive sem visita à página. Há uma atualização manual adicional por usuário por dia UTC. A exclusão mútua no PostgreSQL protege solicitações concorrentes, e uma falha transacional não gasta a atualização. Corrigir o início invalida a previsão antiga sem renovar a cota.

Limitação inicial: não existem observações históricas anteriores à ativação. É necessário acumular pelo menos uma semana de dados; a informação de início, sozinha, não autoriza distribuir as horas importadas por esse período.

## Datas de lançamento

Uma pesquisa global diária usa a integração de IA com busca na web. O retorno contém somente datas de jogos, separadas por título, plataforma e região, com URLs presentes nas citações do provedor. Além do formato, o servidor exige domínio oficial conhecido e busca a página citada: o trecho de evidência precisa existir no conteúdo e conter título, plataforma e data por extenso ou ISO, incluindo o ano. URLs de veículos de notícias são descartadas mesmo quando a IA as classifica como primárias. Páginas bloqueadas, inacessíveis ou cujo conteúdo não possa ser conferido também são descartadas. Isso reduz a cobertura, especialmente de pequenos sites de estúdios e páginas dependentes de JavaScript, mas evita exibir uma data apoiada apenas na resposta do modelo. A seleção feita pela IA continua sujeita a erro; os links permitem conferir o anúncio original.

A busca é limitada a uma chamada diária, até oito anúncios solicitados e 4000 tokens de saída. Ela reconsulta até oito anúncios já acompanhados, priorizando os verificados há mais tempo. Isso não promete cobertura exaustiva de todos os lançamentos ou revisão diária de todas as datas salvas. Os tokens de uso retornados pelo provedor são registrados separadamente em `CalendarReleaseRun`, sem cobrança à cota pessoal de chat.

Meses, anos, trimestres e “a definir” nunca são convertidos para um dia arbitrário. Só datas completas podem ser adicionadas. `UserCalendarRelease` é uma referência pessoal ao anúncio: mudanças confirmadas são refletidas na agenda; adiamentos sem novo dia retiram o evento datado e continuam visíveis entre os lançamentos acompanhados. Adicionar é idempotente, remover afeta apenas o usuário autenticado. A pesquisa não altera `Game.releaseDate` globalmente com uma data específica de plataforma.

## Entrega e validação

Branch de desenvolvimento: `codex/calendar-observed-pace`. A navegação do calendário está habilitada neste branch. A migração é aditiva, sem preenchimento retroativo de início ou horas.

- Testes de cálculo: ritmo, dias sem jogar, primeira importação, dados desatualizados, correções, pausas, jogos sem final e datas inválidas.
- Testes de respostas de IA simuladas: citações, tipos de notícia, precisão, plataformas e truncamento.
- PostgreSQL isolado: cliques simultâneos, limites independentes, troca do dia UTC, isolamento entre usuários, registros idempotentes, adiamentos e uma busca global por dia.
- Prévia com dados fictícios conferida em desktop, 390 px e 360 px, incluindo formulários expandidos.

Além dos testes simulados, uma consulta real identificou uma classificação incorreta de fonte jornalística; após reforçar a validação, a consulta real retornou datas de quatro plataformas apoiadas no conteúdo de uma página oficial. Os resultados não foram gravados no banco compartilhado. A sincronização real das plataformas não foi executada. A ativação em produção depende da migração e das configurações documentadas no README.
