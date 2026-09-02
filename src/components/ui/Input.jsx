/**
 * Input — labelled text field. Pass `search` for the magnifier affordance.
 */
export default function Input({
  label,
  search = false,
  className = "",
  id,
  ...rest
}) {
  const input = (
    <input
      id={id}
      className={["lt-input", search && "lt-input--search", className]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    />
  );

  if (!label) return input;

  return (
    <label className="lt-field" htmlFor={id}>
      <span className="lt-field__label">{label}</span>
      {input}
    </label>
  );
}
