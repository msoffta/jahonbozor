import type { AnyFieldApi } from "@tanstack/react-form";

interface FieldErrorProps {
    field: AnyFieldApi;
}

export function FieldError({ field }: FieldErrorProps) {
    if (!field.state.meta.isTouched || !field.state.meta.errors?.length) {
        return null;
    }

    return (
        <p className="text-destructive px-1 text-xs font-medium">
            {field.state.meta.errors
                .map((err: unknown) =>
                    typeof err === "object" && err !== null && "message" in err
                        ? (err as { message: string }).message
                        : String(err),
                )
                .join(", ")}
        </p>
    );
}
