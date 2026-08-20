/** The app mark: what was swallowed comes back up to be chewed again. */
export function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect width="32" height="32" rx="7" className="fill-accent" />
      <path
        d="M23 16a7 7 0 1 1-2.6-5.45"
        fill="none"
        className="stroke-on-accent"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M14.6 9.2 21.4 9.9 20.7 16.4z" className="fill-on-accent" />
    </svg>
  );
}
