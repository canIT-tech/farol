import { iconPaths, type IconName } from "./icons";

export type { IconName };

export type IconSize = 14 | 16 | 18 | 20 | 24;

export type IconProps = {
  name: IconName;
  size?: IconSize;
  title?: string;
};

export function Icon({ name, size = 20, title }: IconProps) {
  const labelled = title !== undefined;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={labelled ? "img" : undefined}
      aria-hidden={labelled ? undefined : true}
    >
      {labelled && <title>{title}</title>}
      {iconPaths[name]}
    </svg>
  );
}
