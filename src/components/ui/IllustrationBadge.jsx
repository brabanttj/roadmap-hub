import Icon from "./Icon.jsx";

/**
 * IllustrationBadge — a colored circle behind a line-art icon, the same
 * decorative pattern LendingTree uses for its hand-drawn character
 * illustrations. Reuses their real icon glyphs inside the same circle
 * treatment instead.
 */
export default function IllustrationBadge({ icon, tone = "green", size = 96 }) {
  return (
    <div className={`lt-illo lt-illo--${tone}`} style={{ width: size, height: size }}>
      <Icon name={icon} size={Math.round(size * 0.5)} />
    </div>
  );
}
