// Small inline icon set for author/project links, matching the sidebar
// nav's own icon style (stroke-based, currentColor, 24x24 viewbox) so the
// footer and Impact page section stay visually consistent with the rest
// of the app rather than introducing a new icon language.
const ICON_PROPS = {
  width: 15,
  height: 15,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function LinkedInIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M7.5 10v7M7.5 7.5v.01M12 17v-4.5c0-1.2 1-2 2.2-2 1.2 0 1.8.8 1.8 2V17" />
    </svg>
  );
}

export function GitHubIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5-1.3 5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.4 0C6 2.8 4.9 3.1 4.9 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 3.5 9.5c0 4.7 2.2 5.7 5 6-.4.4-.4.9-.5 1.5V20" />
    </svg>
  );
}

export function RepoIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
      <path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H19" />
      <path d="M8 3v6l2-1.5L12 9V3" />
    </svg>
  );
}

export function MailIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M4 7l8 6 8-6" />
    </svg>
  );
}
