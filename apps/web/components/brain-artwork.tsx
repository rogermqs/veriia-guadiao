export default function BrainArtwork({
  active = false,
  className = "",
}: {
  active?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`neural-artwork ${active ? "neural-active" : ""} ${className}`}
      aria-hidden="true"
    >
      <img
        src="/assets/neural-brain.svg"
        alt=""
        width="640"
        height="530"
        draggable={false}
      />
      <span className="neural-signal signal-one" />
      <span className="neural-signal signal-two" />
      <span className="neural-signal signal-three" />
    </div>
  );
}
