/**
 * Select — labelled dropdown. Pass either `children` <option>s or an
 * `options` array of strings / { value, label } objects.
 */
export default function Select({
  label,
  options,
  className = "",
  id,
  children,
  ...rest
}) {
  const select = (
    <select id={id} className={["lt-select", className].filter(Boolean).join(" ")} {...rest}>
      {children ??
        options?.map((opt) => {
          const value = typeof opt === "string" ? opt : opt.value;
          const text = typeof opt === "string" ? opt : opt.label;
          return (
            <option key={value} value={value}>
              {text}
            </option>
          );
        })}
    </select>
  );

  if (!label) return select;

  return (
    <label className="lt-field" htmlFor={id}>
      <span className="lt-field__label">{label}</span>
      {select}
    </label>
  );
}
