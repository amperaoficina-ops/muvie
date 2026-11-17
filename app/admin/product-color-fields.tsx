"use client";

import { useState } from "react";
import { productColors, type ProductColor } from "@/domain/product-colors";
import { SearchSelect } from "./search-select";

export function LotColorField({ initial, name = "lotColor" }: { initial?: ProductColor | null; name?: string }) {
  return <label>Cor do lote<SearchSelect name={name} defaultValue={initial ?? "none"} required>
    <option value="none">Sem cor definida</option>
    {productColors.map((color) => <option key={color}>{color}</option>)}
  </SearchSelect></label>;
}

export function ProductColorsField({ initial = [] }: { initial?: ProductColor[] }) {
  const [colors, setColors] = useState(initial);
  return <fieldset className="address-fields span-two">
    <legend>Cores do produto</legend>
    <label className="span-two">Adicionar uma cor<SearchSelect value="" onChange={(event) => {
      const color = productColors.find((item) => item === event.target.value);
      if (color && !colors.includes(color)) setColors([...colors, color]);
    }}>
      <option value="" disabled>Pesquisar e selecionar cor</option>
      {productColors.filter((color) => !colors.includes(color)).map((color) => <option key={color}>{color}</option>)}
    </SearchSelect></label>
    <div className="inventory-tags span-two">
      {colors.map((color) => <span className="pill" key={color}>
        <input type="hidden" name="productColor" value={color} />
        <button type="button" aria-label={"Remover " + color} onClick={() => setColors(colors.filter((item) => item !== color))}>{color} ×</button>
      </span>)}
    </div>
  </fieldset>;
}
