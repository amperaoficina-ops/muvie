import assert from "node:assert/strict";
import test from "node:test";
import { parseReais } from "../domain/money-input.ts";

test("aceita valores brasileiros, decimais de formulário e zero", () => {
  for (const [input, expected] of [
    ["7.990,00", 799000], ["R$ 7.990,50", 799050], ["7990.50", 799050],
    ["7990,5", 799050], ["7.990", 799000], ["0", 0], ["", 0], ["99.999.999,99", 9999999999],
  ]) assert.equal(parseReais(input), expected, input);
});

test("rejeita negativos, notação científica, separadores inválidos e excesso de dígitos", () => {
  for (const input of ["-1", "1e3", "1,234", "1.00,00", "1.234.56", "100000000", "R$", "7.990,001"]) {
    assert.equal(parseReais(input), null, input);
  }
});
