import { useState } from "react";
import { TextField } from "./TextField";

export default { title: "TextField", component: TextField };

export const Default = () => {
  const [v, setV] = useState("");
  return <TextField label="Saindo de" value={v} onChange={setV} placeholder="Cidade ou aeroporto" />;
};
export const WithError = () => (
  <TextField label="Orçamento" value="500" onChange={() => {}} error="Mínimo R$ 1.500 por pessoa." />
);
export const WithHint = () => (
  <TextField label="E-mail" value="" onChange={() => {}} hint="Usamos só para enviar o roteiro." />
);
