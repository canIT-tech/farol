import { useState } from "react";
import { Stepper } from "./Stepper";

export default { title: "Stepper", component: Stepper };

export const Default = () => {
  const [n, setN] = useState(2);
  return <Stepper label="Adultos" value={n} min={1} max={9} onChange={setN} />;
};
