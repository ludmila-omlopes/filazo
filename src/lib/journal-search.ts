export function normalizeJournalSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim();
}

export function matchesJournalSearch(
  query: string,
  ...values: Array<string | null | undefined>
) {
  const text = normalizeJournalSearch(values.filter(Boolean).join(" "));
  return normalizeJournalSearch(query)
    .split(/\s+/)
    .every((word) => text.includes(word));
}
