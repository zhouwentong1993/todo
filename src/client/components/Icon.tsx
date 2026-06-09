import type { SVGProps } from "react";

type IconName =
  | "bell"
  | "calendar"
  | "check"
  | "chevron"
  | "circle"
  | "clock"
  | "flag"
  | "inbox"
  | "list"
  | "logout"
  | "menu"
  | "plus"
  | "refresh"
  | "search"
  | "tag"
  | "trash"
  | "x";

const paths: Record<IconName, string[]> = {
  bell: ["M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9", "M13.7 21a2 2 0 0 1-3.4 0"],
  calendar: ["M8 2v4M16 2v4M3 10h18", "M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"],
  check: ["M20 6 9 17l-5-5"],
  chevron: ["m6 9 6 6 6-6"],
  circle: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z"],
  clock: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z", "M12 6v6l4 2"],
  flag: ["M5 22V4", "M5 4h12l-2 5 2 5H5"],
  inbox: ["M22 12h-6l-2 3h-4l-2-3H2", "M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6l3.5-7Z"],
  list: ["M8 6h13M8 12h13M8 18h13", "M3 6h.01M3 12h.01M3 18h.01"],
  logout: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "M16 17l5-5-5-5", "M21 12H9"],
  menu: ["M4 6h16M4 12h16M4 18h16"],
  plus: ["M12 5v14M5 12h14"],
  refresh: ["M21 12a9 9 0 0 1-15.4 6.4L3 16", "M3 21v-5h5", "M3 12A9 9 0 0 1 18.4 5.6L21 8", "M21 3v5h-5"],
  search: ["M21 21l-4.3-4.3", "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"],
  tag: ["M20.6 13.1 13 20.7a2 2 0 0 1-2.8 0L3.3 13.8a2 2 0 0 1 0-2.8L10.9 3.4A2 2 0 0 1 12.3 3H19a2 2 0 0 1 2 2v6.7a2 2 0 0 1-.4 1.4Z", "M16 8h.01"],
  trash: ["M3 6h18", "M8 6V4h8v2", "M19 6l-1 14H6L5 6", "M10 11v6M14 11v6"],
  x: ["M18 6 6 18", "M6 6l12 12"]
};

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {paths[name].map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}
