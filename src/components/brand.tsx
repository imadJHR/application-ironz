import Image from "next/image";

export function Brand({
  light = false,
  compact = false,
}: {
  light?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={
        "brand " +
        (light ? "brand-light " : "") +
        (compact ? "brand-compact" : "")
      }
    >
      <span className="brand-logo-crop">
        <Image
          src="/ironz-logo.png"
          alt="IRONZ"
          width={540}
          height={675}
          priority
        />
      </span>
    </div>
  );
}
