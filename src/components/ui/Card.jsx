/**
 * Card — surface container. `interactive` adds hover lift; `selected` highlights.
 */
export default function Card({
  interactive = false,
  selected = false,
  pad = true,
  className = "",
  children,
  ...rest
}) {
  const classes = [
    "lt-card",
    pad && "lt-card--pad",
    interactive && "lt-card--interactive",
    selected && "lt-card--selected",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
