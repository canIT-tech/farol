// Marca do Farol (o mesmo desenho de icon.svg) para as imagens geradas com
// next/og: ícone PNG e imagem de compartilhamento.
const RAYS = [
  "M16 5.5v3.2",
  "M16 23.3v3.2",
  "M5.5 16h3.2",
  "M23.3 16h3.2",
  "M8.9 8.9l2.3 2.3",
  "M20.8 20.8l2.3 2.3",
  "M23.1 8.9l-2.3 2.3",
  "M11.2 20.8l-2.3 2.3"
];

export function Mark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="7" fill="#1c1b19" />
      <g stroke="#c25a38" strokeWidth="2.4" strokeLinecap="round">
        {RAYS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <circle cx="16" cy="16" r="4.3" fill="#c25a38" />
    </svg>
  );
}
