export function PhoneDifference({
  text,
  other,
  correct = false,
}: {
  text: string;
  other: string;
  correct?: boolean;
}) {
  const value = text.replace(/^\[|\]$/g, "");
  const comparison = other.replace(/^\[|\]$/g, "");
  return (
    <>
      [
      {Array.from(value).map((char, i) => (
        <span
          key={i}
          className={
            char !== comparison[i]
              ? correct
                ? "text-[#2667ff] font-bold"
                : "text-[#ff4b63] underline underline-offset-4 font-bold"
              : undefined
          }
        >
          {char}
        </span>
      ))}
      ]
    </>
  );
}
