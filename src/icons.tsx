import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export function FolderIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3.5 7.5h6l1.6 2h9.4v8.2a1.8 1.8 0 0 1-1.8 1.8H5.3a1.8 1.8 0 0 1-1.8-1.8V7.5Z" />
      <path d="M3.5 7.5V5.8C3.5 4.8 4.3 4 5.3 4h4l1.6 2h7.8c1 0 1.8.8 1.8 1.8v1.7" />
    </IconBase>
  );
}

export function DocIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7 3.5h7l3 3v14H7a1.8 1.8 0 0 1-1.8-1.8V5.3C5.2 4.3 6 3.5 7 3.5Z" />
      <path d="M14 3.5V7h3.5" />
      <path d="M8.6 11h6.8M8.6 14.3h6.8M8.6 17.6h4.1" />
    </IconBase>
  );
}

export function GearIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 8.3a3.7 3.7 0 1 0 0 7.4 3.7 3.7 0 0 0 0-7.4Z" />
      <path d="M19.4 13.6v-3.2l-2.1-.5a6.5 6.5 0 0 0-.8-1.9l1.1-1.9-2.3-2.3-1.9 1.1a6.5 6.5 0 0 0-1.9-.8L11 2H7.8l-.5 2.1a6.5 6.5 0 0 0-1.9.8L3.5 3.8 1.2 6.1 2.3 8a6.5 6.5 0 0 0-.8 1.9l-2.1.5v3.2l2.1.5c.2.7.5 1.3.8 1.9l-1.1 1.9 2.3 2.3 1.9-1.1c.6.3 1.2.6 1.9.8l.5 2.1H11l.5-2.1c.7-.2 1.3-.5 1.9-.8l1.9 1.1 2.3-2.3-1.1-1.9c.3-.6.6-1.2.8-1.9l2.1-.5Z" transform="translate(2.6 0)" />
    </IconBase>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 4v10" />
      <path d="m8.5 10.5 3.5 3.5 3.5-3.5" />
      <path d="M5 19h14" />
    </IconBase>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 7h16" />
      <path d="M9 7V5h6v2" />
      <path d="M7 10v8.5c0 .8.7 1.5 1.5 1.5h7c.8 0 1.5-.7 1.5-1.5V10" />
      <path d="M10 11.5v5M14 11.5v5" />
    </IconBase>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="10.5" cy="10.5" r="5.5" />
      <path d="m15 15 4 4" />
    </IconBase>
  );
}

export function CleanIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 8h16" />
      <path d="M7 8l1.2 11h7.6L17 8" />
      <path d="M9 5h6l1 3H8l1-3Z" />
    </IconBase>
  );
}

export function RestartIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M17.7 8.2A6.8 6.8 0 1 0 19 12" />
      <path d="M17.8 4.2v4.1h-4.1" />
    </IconBase>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="8" y="7" width="10" height="13" rx="1.5" />
      <path d="M6 17H5.5A1.5 1.5 0 0 1 4 15.5v-10A1.5 1.5 0 0 1 5.5 4h8A1.5 1.5 0 0 1 15 5.5V6" />
    </IconBase>
  );
}

export function CodeIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m8 8-4 4 4 4" />
      <path d="m16 8 4 4-4 4" />
      <path d="m13.5 6-3 12" />
    </IconBase>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M2.8 12s3.2-5.6 9.2-5.6 9.2 5.6 9.2 5.6-3.2 5.6-9.2 5.6S2.8 12 2.8 12Z" />
      <circle cx="12" cy="12" r="2.6" />
    </IconBase>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 14 14" fill="none" aria-hidden="true" {...props}>
      <path d="m3.7 7.2 2.1 2.1 4.5-4.8" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
