import { notifications } from "@mantine/notifications";

export function toInt(value: string | number): number {
  return typeof value === "number" ? value : Number(value.replaceAll(",", ""));
}

export function optionalInt(value: string | number | null): number | null {
  if (value === null || value === "") return null;
  const next = toInt(value);
  return Number.isFinite(next) ? next : null;
}

export function notifyError(error: unknown) {
  notifications.show({
    color: "red",
    title: "Something went wrong",
    message: error instanceof Error ? error.message : String(error),
  });
}
