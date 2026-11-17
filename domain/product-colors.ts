export const productColors = [
  "Vermelho", "Laranja", "Amarelo", "Verde", "Azul", "Anil", "Violeta",
  "Branco", "Preto", "Cinza", "Prata", "Marrom", "Bege", "Rosa", "Carbono", "Verde militar",
] as const;

export type ProductColor = typeof productColors[number];
