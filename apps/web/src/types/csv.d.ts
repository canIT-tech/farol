// CSV importado como string (regra asset/source no next.config.mjs).
declare module "*.csv" {
  const content: string;
  export default content;
}
