function searchText(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
}

export function matchesSearch(query: string, ...fields: string[]) {
  return !query || searchText(fields.join(" ")).includes(searchText(query));
}
