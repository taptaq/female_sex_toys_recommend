export type CuteAstronautProps = {
  className?: string;
  label?: string;
};

export function CuteAstronaut({ className, label }: CuteAstronautProps) {
  const rootClassName = ["cute-astronaut", className].filter(Boolean).join(" ");
  const accessibilityProps = label
    ? { role: "img", "aria-label": label }
    : { "aria-hidden": true };

  return (
    <div className={rootClassName} {...accessibilityProps}>
      <span className="cute-astronaut__bubble cute-astronaut__bubble-a" />
      <span className="cute-astronaut__bubble cute-astronaut__bubble-b" />
      <span className="cute-astronaut__star cute-astronaut__star-a" />
      <span className="cute-astronaut__star cute-astronaut__star-b" />
      <span className="cute-astronaut__star cute-astronaut__star-c" />
      <div className="cute-astronaut__figure">
        <div className="cute-astronaut__helmet">
          <div className="cute-astronaut__face">
            <span className="cute-astronaut__eye cute-astronaut__eye-left" />
            <span className="cute-astronaut__eye cute-astronaut__eye-right" />
            <span className="cute-astronaut__smile" />
          </div>
        </div>
        <div className="cute-astronaut__body">
          <span className="cute-astronaut__badge" />
          <span className="cute-astronaut__arm cute-astronaut__arm-left" />
          <span className="cute-astronaut__arm cute-astronaut__arm-right" />
          <span className="cute-astronaut__leg cute-astronaut__leg-left" />
          <span className="cute-astronaut__leg cute-astronaut__leg-right" />
        </div>
      </div>
    </div>
  );
}
