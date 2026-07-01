import { Paper, Stack, Text, Title } from "@mantine/core";
import { Sparkles } from "lucide-react";

export function EmptyState(props: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Paper className="glass-card" p="xl" ta="center">
      <Stack align="center" gap="xs">
        <Sparkles size={34} />
        <Title order={3}>{props.title}</Title>
        <Text c="dimmed" maw={360}>
          {props.description}
        </Text>
        {props.action}
      </Stack>
    </Paper>
  );
}
