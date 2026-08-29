import { useState } from "react";
import { Slider } from "./Slider";

export default { title: "Slider", component: Slider };

export const Budget = () => {
  const [v, setV] = useState(5000);
  return (
    <Slider
      label="Orçamento por pessoa"
      value={v}
      min={1500}
      max={12000}
      step={100}
      onChange={setV}
      formatValue={(n) => `R$ ${n.toLocaleString("pt-BR")}`}
    />
  );
};
