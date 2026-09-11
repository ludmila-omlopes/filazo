import type { Locale } from "./i18n";

const genres: Record<string, string> = {
  "point-and-click": "Apontar e clicar",
  fighting: "Luta",
  shooter: "Tiro",
  music: "Música",
  platform: "Plataforma",
  puzzle: "Quebra-cabeça",
  racing: "Corrida",
  "real time strategy (rts)": "Estratégia em tempo real",
  "role-playing (rpg)": "RPG",
  simulator: "Simulação",
  sport: "Esporte",
  strategy: "Estratégia",
  "turn-based strategy (tbs)": "Estratégia por turnos",
  tactical: "Tático",
  "hack and slash/beat 'em up": "Combate corpo a corpo",
  "quiz/trivia": "Perguntas e respostas",
  pinball: "Pinball",
  adventure: "Aventura",
  indie: "Indie",
  arcade: "Arcade",
  "visual novel": "Romance visual",
  "card & board game": "Cartas e tabuleiro",
  moba: "MOBA",
};

export function localizeGameGenre(genre: string, locale: Locale) {
  return locale === "pt-BR"
    ? (genres[genre.trim().toLowerCase()] ?? genre)
    : genre;
}
