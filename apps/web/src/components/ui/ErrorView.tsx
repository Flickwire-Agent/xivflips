import { Alert } from "@mantine/core";

export function ErrorView({ error }: { error: unknown }) {
  return (
    <Alert color="red" title="Unable to load">
      {error instanceof Error ? error.message : String(error)}
    </Alert>
  );
}
