/**
 * Button — pill button.
 * variants: "primary" (blue) | "accent" (green) | "secondary" (outline) | "ghost" | "danger" (destructive)
 */
export default function Button({
  variant = "primary",
  size,
  block = false,
  href,
  className = "",
  children,
  ...rest
}) {
  const classes = [
    "lt-btn",
    `lt-btn--${variant}`,
    size === "sm" && "lt-btn--sm",
    block && "lt-btn--block",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (href) {
    return (
      <a className={classes} href={href} {...rest}>
        {children}
      </a>
    );
  }

  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
