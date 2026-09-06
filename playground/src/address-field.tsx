import { useId } from "react";
import type { FormField } from "addressfield-ts";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AddressFieldProps {
  field: FormField;
  value: string;
  error: string | undefined;
  onChange: (value: string) => void;
}

export function AddressField({ field, value, error, onChange }: AddressFieldProps) {
  const inputId = useId();
  const errorId = useId();
  const describedBy = error ? errorId : undefined;

  return (
    <div className="min-w-0 space-y-2">
      <label htmlFor={inputId} className="block text-sm font-medium">
        {field.label}
        {field.required && " *"}
      </label>

      {field.control === "select" ? (
        <Select
          name={field.name}
          value={value || null}
          items={field.options}
          onValueChange={(selected) => onChange(selected ?? "")}
        >
          <SelectTrigger
            id={inputId}
            className="w-full"
            aria-required={field.required}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
          >
            <SelectValue placeholder={`Choose ${field.label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} className="max-h-72">
            {field.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={inputId}
          name={field.name}
          value={value}
          required={field.required}
          autoComplete={field.autocomplete}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
        />
      )}

      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
