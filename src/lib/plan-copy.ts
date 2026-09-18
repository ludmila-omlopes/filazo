import type { Locale } from "./i18n";

export function planCopy(locale: Locale) {
  return locale === "pt-BR" ? {
    calendar: "Calendário Pro", calendarBody: "Planeje quando jogar e explore seu calendário no seu ritmo com o Pro.",
    upgrade: "Conhecer o Pro", compare: "O que cada plano inclui", feature: "Recurso", free: "Grátis", pro: "Pro",
    library: "Biblioteca, avaliações e diário em texto", unlimited: "Sem limite de entradas",
    sync: "Sincronização", manual: "Manual", automatic: "Manual e automática diária",
    storage: "Armazenamento de fotos e áudio", chat: "Assistente: tokens a cada 24 horas", voice: "Transcrições a cada 24 horas",
    web: "Pesquisa web no chat", recap: "Retrospectiva", included: "Incluído", exclusive: "Exclusivo do Pro",
    retained: "Ao voltar ao Grátis, suas anotações e mídias continuam acessíveis. Se exceder a cota, novos anexos ficam pausados até liberar espaço ou voltar ao Pro.",
    ceilings: "As cotas de IA também respeitam os limites de operação do serviço. Sincronização automática depende da disponibilidade de cada plataforma e pausa após inatividade prolongada.",
    storageFull: "Você atingiu a cota de mídia do seu plano. Pode continuar escrevendo, liberar espaço ou conhecer o Pro. Suas memórias salvas continuam acessíveis.",
    syncFree: "Sincronize manualmente quando quiser atualizar sua biblioteca. A sincronização automática diária faz parte do Pro.",
    syncPro: "Seu Pro inclui sincronização automática diária nas plataformas habilitadas. Você também pode atualizar manualmente.",
    chatFree: "O chat básico está disponível no Grátis. O Pro inclui uma cota maior e pesquisa na web.",
    chatPro: "Seu Pro inclui uma cota maior de chat e pesquisa na web, quando disponível.",
    memories: "Suas memórias do ano", recapBody: "Revisite os jogos e as palavras que ficaram com você.",
    year: "Ano", show: "Ver memórias", empty: "Ainda não há memórias registradas neste ano.",
    more: "Próximas memórias", diary: "Abrir no diário", back: "Voltar ao diário", saved: "Memória registrada",
  } : {
    calendar: "Pro calendar", calendarBody: "Plan when to play and explore your calendar at your own pace with Pro.",
    upgrade: "Explore Pro", compare: "What each plan includes", feature: "Feature", free: "Free", pro: "Pro",
    library: "Library, reviews and text journal", unlimited: "Unlimited entries",
    sync: "Synchronization", manual: "Manual", automatic: "Manual and automatic daily",
    storage: "Photo and audio storage", chat: "Assistant: tokens per 24 hours", voice: "Transcriptions per 24 hours",
    web: "Web search in chat", recap: "Retrospective", included: "Included", exclusive: "Pro exclusive",
    retained: "When you return to Free, your notes and media remain accessible. If you exceed its allowance, new attachments pause until you free space or return to Pro.",
    ceilings: "AI allowances also respect service operating limits. Automatic sync depends on each platform's availability and pauses after extended inactivity.",
    storageFull: "You have reached your plan's media allowance. Keep writing, free some space or explore Pro. Your saved memories remain accessible.",
    syncFree: "Sync manually whenever you want to update your library. Automatic daily sync is included with Pro.",
    syncPro: "Your Pro includes automatic daily sync on enabled platforms. You can also update manually.",
    chatFree: "Basic chat is available on Free. Pro includes a larger allowance and web search.",
    chatPro: "Your Pro includes a larger chat allowance and web search, when available.",
    memories: "Your memories of the year", recapBody: "Revisit the games and words that stayed with you.",
    year: "Year", show: "View memories", empty: "There are no memories recorded in this year yet.",
    more: "More memories", diary: "Open in journal", back: "Back to journal", saved: "Saved memory",
  };
}
