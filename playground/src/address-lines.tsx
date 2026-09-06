import { useId } from "react";
import { Input } from "@/components/ui/input";

interface AddressLinesProps {
  value: readonly string[];
  required: boolean;
  error: string | undefined;
  onChange: (lines: string[]) => void;
}

export function AddressLines({ value, required, error, onChange }: AddressLinesProps) {
  const line1Id = useId();
  const line2Id = useId();
  const errorId = useId();
  const [line1 = "", line2 = ""] = value;

  function updateLines(first: string, second: string) {
    onChange(second ? [first, second] : [first]);
  }

  return (
    <div className="min-w-0 space-y-2">
      <label htmlFor={line1Id} className="block text-sm font-medium">
        Address line 1{required && " *"}
      </label>
      <Input
        id={line1Id}
        name="address-line1"
        autoComplete="address-line1"
        required={required}
        value={line1}
        onChange={(event) => updateLines(event.target.value, line2)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />

      <label htmlFor={line2Id} className="block text-sm font-medium">
        Address line 2 (optional)
      </label>
      <Input
        id={line2Id}
        name="address-line2"
        autoComplete="address-line2"
        value={line2}
        onChange={(event) => updateLines(line1, event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />

      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
