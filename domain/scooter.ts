export const scooterCategory = "Scooter elétrica";

export const scooterFields = [
  { key: "power", label: "Potência", example: "Ex. 1.000 W" },
  { key: "speed", label: "Velocidade máxima", example: "Ex. 32 km/h" },
  { key: "range", label: "Autonomia", example: "Ex. Até 40 km" },
  { key: "battery", label: "Bateria", example: "Ex. Lítio, 60 V / 20 Ah" },
  { key: "charging", label: "Tempo de recarga", example: "Ex. 6 horas" },
  { key: "license", label: "Habilitação", example: "Conforme a classificação do modelo" },
  { key: "registration", label: "Emplacamento", example: "Conforme a classificação do modelo" },
  { key: "load", label: "Peso máximo suportado", example: "Ex. Até 200 kg" },
  { key: "colors", label: "Cores", example: "Ex. Verde militar, vermelho, branco" },
] as const;

export type ScooterSpecs = Partial<Record<(typeof scooterFields)[number]["key"], string>>;
