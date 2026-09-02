/**
 * Badge — pill status / category label.
 * tone: "success" | "warning" | "neutral" | "muted" | "brand"
 * Renders an <a> when `href` is provided, otherwise a <span>.
 */
export default function Badge({
  tone = "neutral",
  href,
  className = "",
  children,
  ...rest
}) {
  const classes = ["lt-badge", `lt-badge--${tone}`, className]
    .filter(Boolean)
    .join(" ");

  if (href) {
    return (
      <a className={classes} href={href} target="_blank" rel="noreferrer" {...rest}>
        {children}
      </a>
    );
  }

  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  );
}
