import { Button, Paper, Stack, Text, Title } from "@mantine/core";
import { apiUrl } from "../../api";

export function LoginRequired() {
  return (
    <main className="hero">
      <Paper className="glass-card" p="xl" radius="xl" maw={420}>
        <Stack>
          <Title order={2}>Login required</Title>
          <Text c="dimmed">All flip tracking features are private to your account.</Text>
          <Button
            onClick={() => {
              window.location.href = apiUrl("/auth/xivauth/start");
            }}
          >
            Log in with XIVAuth
          </Button>
        </Stack>
      </Paper>
    </main>
  );
}
