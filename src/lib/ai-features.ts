import type { AiBudgetFeature } from "./ai-budget";

export type LocalizedText = {
  en: string;
  pt: string;
};

export type AiFeatureDefinition = {
  id: string;
  name: LocalizedText;
  area: LocalizedText;
  description: LocalizedText;
  whenItRuns: LocalizedText;
  input: LocalizedText;
  output: LocalizedText;
  technology: LocalizedText;
  mode: "ai" | "hybrid";
  budgetFeature: AiBudgetFeature;
};

export type AutomatedFeatureDefinition = {
  id: string;
  name: LocalizedText;
  area: LocalizedText;
  description: LocalizedText;
  whenItRuns: LocalizedText;
  input: LocalizedText;
  output: LocalizedText;
  technology: LocalizedText;
};

/**
 * Product-facing inventory of every current generative-AI entry point.
 * Keep this list aligned with AiBudgetFeature and the user-facing flows so the
 * admin area remains an honest map of what happens behind the scenes.
 */
export const AI_FEATURES = [
  {
    id: "player-profile",
    name: { en: "Player profile", pt: "Perfil do jogador" },
    area: { en: "Profile", pt: "Perfil" },
    description: {
      en: "Builds a narrative reading of the player's habits, preferences, and possible next games.",
      pt: "Cria uma leitura narrativa dos hábitos, preferências e possíveis próximos jogos da pessoa.",
    },
    whenItRuns: {
      en: "When the person generates or refreshes the player profile.",
      pt: "Quando a pessoa gera ou atualiza o perfil do jogador.",
    },
    input: {
      en: "Personal library: statuses, playtime, favorites, completion, genres, and recent activity.",
      pt: "Biblioteca pessoal: status, tempo jogado, favoritos, conclusão, gêneros e atividade recente.",
    },
    output: {
      en: "Summary, play styles, behavior patterns, preferred genres, and catalog recommendations.",
      pt: "Resumo, estilos de jogo, padrões de comportamento, gêneros preferidos e recomendações do catálogo.",
    },
    technology: {
      en: "Generative model with catalog tools",
      pt: "Modelo generativo com ferramentas do catálogo",
    },
    mode: "ai",
    budgetFeature: "player_profile",
  },
  {
    id: "library-chat",
    name: { en: "Library chat", pt: "Chat com a biblioteca" },
    area: { en: "Assistant", pt: "Assistente" },
    description: {
      en: "Answers questions about the person's own catalog and can use web search when the conversation needs current context.",
      pt: "Responde perguntas sobre o catálogo da própria pessoa e pode usar busca na web quando a conversa precisa de contexto atual.",
    },
    whenItRuns: {
      en: "When a message is sent in the Assistant chat.",
      pt: "Quando uma mensagem é enviada no chat do Assistente.",
    },
    input: {
      en: "Conversation, personal library, game metadata, and—when enabled—fresh web sources.",
      pt: "Conversa, biblioteca pessoal, metadados dos jogos e, quando habilitado, fontes recentes da web.",
    },
    output: {
      en: "A streamed answer with optional catalog actions or cited web context.",
      pt: "Uma resposta em streaming com ações opcionais no catálogo ou contexto da web com fontes.",
    },
    technology: {
      en: "Generative model with library tools and optional web search",
      pt: "Modelo generativo com ferramentas da biblioteca e busca opcional na web",
    },
    mode: "ai",
    budgetFeature: "assistant_chat",
  },
  {
    id: "play-next",
    name: { en: "Play-next recommendations", pt: "Recomendações do próximo jogo" },
    area: { en: "Assistant", pt: "Assistente" },
    description: {
      en: "Ranks a small set of games that fit the person's current context and reduces choice overload.",
      pt: "Organiza um pequeno conjunto de jogos que combina com o contexto atual da pessoa e reduz o excesso de escolha.",
    },
    whenItRuns: {
      en: "When Assistant insights are refreshed, subject to cache and cooldown rules.",
      pt: "Quando os insights do Assistente são atualizados, respeitando cache e intervalo mínimo.",
    },
    input: {
      en: "Candidate games, deterministic library signals, playtime, status, intent, and release context.",
      pt: "Jogos candidatos, sinais determinísticos da biblioteca, tempo jogado, status, intenção e contexto de lançamentos.",
    },
    output: {
      en: "Three ranked suggestions with effort, mood fit, and a short reason.",
      pt: "Três sugestões ordenadas com esforço esperado, combinação de humor e uma justificativa curta.",
    },
    technology: {
      en: "Generative ranking over rule-based signals; local rules are the fallback",
      pt: "Ranking generativo sobre sinais baseados em regras; as regras locais são o fallback",
    },
    mode: "hybrid",
    budgetFeature: "assistant_play_next",
  },
  {
    id: "assistant-summaries",
    name: { en: "Assistant summaries and explanations", pt: "Resumos e explicações do Assistente" },
    area: { en: "Assistant", pt: "Assistente" },
    description: {
      en: "Turns deterministic backlog signals into short, readable explanations instead of exposing raw scores.",
      pt: "Transforma sinais determinísticos do backlog em explicações curtas e legíveis, sem expor pontuações cruas.",
    },
    whenItRuns: {
      en: "During an Assistant refresh or when a localized game synopsis is first requested.",
      pt: "Durante uma atualização do Assistente ou quando um resumo localizado de jogo é solicitado pela primeira vez.",
    },
    input: {
      en: "Rule-based insights, library context, and the original game synopsis for translation.",
      pt: "Insights baseados em regras, contexto da biblioteca e o resumo original do jogo para tradução.",
    },
    output: {
      en: "A concise explanation, caveats, and—in non-English locales—a cached translated synopsis.",
      pt: "Uma explicação concisa, ressalvas e, em idiomas diferentes do inglês, um resumo traduzido em cache.",
    },
    technology: {
      en: "Generative explanation and translation; deterministic signals remain the source of truth",
      pt: "Explicação e tradução generativas; os sinais determinísticos continuam sendo a fonte de verdade",
    },
    mode: "hybrid",
    budgetFeature: "assistant_summary",
  },
  {
    id: "marketplace-search",
    name: { en: "Where to buy search", pt: "Busca de onde comprar" },
    area: { en: "Game detail", pt: "Detalhe do jogo" },
    description: {
      en: "Searches current store and subscription listings, then verifies the game, platform, delivery type, and price evidence.",
      pt: "Busca ofertas atuais em lojas e catálogos de assinatura e verifica jogo, plataforma, tipo de entrega e evidência de preço.",
    },
    whenItRuns: {
      en: "When someone opens the purchase search or a cached result needs refreshing.",
      pt: "Quando alguém abre a busca de compra ou quando um resultado em cache precisa ser atualizado.",
    },
    input: {
      en: "Exact game title, region, store domains, and live store pages.",
      pt: "Título exato do jogo, região, domínios de lojas e páginas atuais das lojas.",
    },
    output: {
      en: "Supported offers and subscriptions with availability, price when confirmed, and source links.",
      pt: "Ofertas e assinaturas compatíveis com disponibilidade, preço quando confirmado e links das fontes.",
    },
    technology: {
      en: "Generative model with live web search and page verification",
      pt: "Modelo generativo com busca na web e verificação de páginas",
    },
    mode: "ai",
    budgetFeature: "assistant_marketplace",
  },
  {
    id: "photo-import",
    name: { en: "Photo catalog import", pt: "Importação do catálogo por foto" },
    area: { en: "Sources", pt: "Fontes" },
    description: {
      en: "Reads visible game titles from collection photos or screenshots and sends candidates through the normal catalog resolution flow.",
      pt: "Lê títulos de jogos visíveis em fotos ou screenshots de coleções e envia candidatos para o fluxo normal de resolução do catálogo.",
    },
    whenItRuns: {
      en: "When photos are uploaded in the Sources tab.",
      pt: "Quando fotos são enviadas na aba Fontes.",
    },
    input: {
      en: "Uploaded images and only the visual information present in them.",
      pt: "Imagens enviadas e apenas as informações visuais presentes nelas.",
    },
    output: {
      en: "Candidate titles, optional visible platform/status details, confidence, and an import audit trail.",
      pt: "Títulos candidatos, detalhes visíveis de plataforma/status quando houver, confiança e histórico da importação.",
    },
    technology: {
      en: "Vision model followed by canonical catalog matching",
      pt: "Modelo de visão seguido pela correspondência canônica do catálogo",
    },
    mode: "hybrid",
    budgetFeature: "photo_import",
  },
  {
    id: "voice-journal",
    name: { en: "Voice journal transcription", pt: "Transcrição do diário por voz" },
    area: { en: "Journal", pt: "Diário" },
    description: {
      en: "Transcribes a gameplay voice note and can suggest a short journal title from the transcript.",
      pt: "Transcreve uma nota de voz sobre a sessão e pode sugerir um título curto a partir da transcrição.",
    },
    whenItRuns: {
      en: "When an audio note is attached to a new journal entry.",
      pt: "Quando uma nota de áudio é anexada a uma nova entrada do diário.",
    },
    input: {
      en: "The uploaded audio and the requested output language.",
      pt: "O áudio enviado e o idioma solicitado para a saída.",
    },
    output: {
      en: "Transcript, detected language, and an optional generated title.",
      pt: "Transcrição, idioma detectado e um título gerado opcionalmente.",
    },
    technology: {
      en: "Speech-to-text plus a text model for title inference",
      pt: "Fala-para-texto mais um modelo de texto para inferir o título",
    },
    mode: "ai",
    budgetFeature: "voice_transcription",
  },
  {
    id: "story-completion",
    name: { en: "Story completion detection", pt: "Detecção de conclusão da história" },
    area: { en: "Library sync", pt: "Sincronização da biblioteca" },
    description: {
      en: "Helps identify the achievement or trophy that represents the end of a game's main story.",
      pt: "Ajuda a identificar a conquista ou troféu que representa o fim da história principal de um jogo.",
    },
    whenItRuns: {
      en: "During platform sync when achievement candidates are ambiguous and the cache is stale.",
      pt: "Durante a sincronização da plataforma quando as conquistas candidatas são ambíguas e o cache está vencido.",
    },
    input: {
      en: "Game name and achievement/trophy candidates returned by the platform.",
      pt: "Nome do jogo e conquistas/troféus candidatos retornados pela plataforma.",
    },
    output: {
      en: "A selected story achievement or an explicit no-match result, with its source recorded.",
      pt: "Uma conquista de história selecionada ou um resultado explícito sem correspondência, com a fonte registrada.",
    },
    technology: {
      en: "Heuristics first, generative classification only for ambiguous cases",
      pt: "Heurísticas primeiro; classificação generativa apenas em casos ambíguos",
    },
    mode: "hybrid",
    budgetFeature: "story_completion",
  },
] as const satisfies readonly AiFeatureDefinition[];

/**
 * Related catalog automations that are easy to mistake for AI-powered work.
 * Showing them next to the AI inventory makes the boundary explicit for admins.
 */
export const AUTOMATED_FEATURES = [
  {
    id: "release-dates",
    name: { en: "Related release dates", pt: "Datas de lançamentos relacionados" },
    area: { en: "Calendar and Assistant", pt: "Calendário e Assistente" },
    description: {
      en: "Finds upcoming releases related to finished games in the person's library, such as sequels, remakes, expansions, and DLC.",
      pt: "Encontra lançamentos futuros relacionados a jogos concluídos da biblioteca, como sequências, remakes, expansões e DLCs.",
    },
    whenItRuns: {
      en: "When Assistant context refreshes and the cached lookup is older than seven days; at most six games are checked per run.",
      pt: "Quando o contexto do Assistente é atualizado e a consulta em cache tem mais de sete dias; no máximo seis jogos são verificados por execução.",
    },
    input: {
      en: "Canonical game ID, its provider relationships, and a 365-day date window.",
      pt: "ID canônico do jogo, seus relacionamentos no provedor e uma janela de 365 dias.",
    },
    output: {
      en: "Cached dates, related game titles, relationship type, and source links.",
      pt: "Datas em cache, títulos relacionados, tipo de relação e links da fonte.",
    },
    technology: {
      en: "Metadata provider query; no generative AI",
      pt: "Consulta de provedor de metadados; não usa IA generativa",
    },
  },
] as const satisfies readonly AutomatedFeatureDefinition[];
