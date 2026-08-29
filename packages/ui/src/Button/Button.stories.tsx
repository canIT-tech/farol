import { Button } from "./Button";

export default { title: "Button", component: Button };

export const Primary = () => <Button>Buscar destinos</Button>;
export const Ghost = () => <Button variant="ghost">Ver roteiro</Button>;
export const Text = () => <Button variant="text">Ajustar</Button>;
export const Sizes = () => (
  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
    <Button size="sm">sm</Button>
    <Button size="md">md</Button>
    <Button size="lg">lg</Button>
  </div>
);
export const Loading = () => <Button loading>Enviando</Button>;
export const Disabled = () => <Button disabled>Indisponível</Button>;
