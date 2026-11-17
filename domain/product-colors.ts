export const productColors = [
  "Vermelho", "Laranja", "Amarelo", "Verde", "Azul", "Anil", "Violeta",
  "Branco", "Preto", "Cinza", "Prata", "Marrom", "Bege", "Rosa", "Carbono", "Verde militar",
] as const;

export type ProductColor = typeof productColors[number];

export const productColorHex: Record<ProductColor, string> = {
  Vermelho: "#DE303A", Laranja: "#F47B24", Amarelo: "#FFD332", Verde: "#28A653",
  Azul: "#2474D8", Anil: "#4B449F", Violeta: "#9749CB", Branco: "#FFFFFF",
  Preto: "#171717", Cinza: "#80848A", Prata: "#C5CAD1", Marrom: "#805438",
  Bege: "#D8C29D", Rosa: "#EB80AF", Carbono: "#383B41", "Verde militar": "#55623F",
};
