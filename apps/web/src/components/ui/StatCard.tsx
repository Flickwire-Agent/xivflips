import { Box, Group, Paper, Text } from "@mantine/core";

export function StatCard(props: {
  label: string;
  value: string;
  tone?: string;
  icon: React.ReactNode;
}) {
  return (
    <Paper className="glass-card" p="md" radius="xl">
      <Group justify="space-between" align="flex-start">
        <Box>
          <Text size="xs" c="dimmed">
            {props.label}
          </Text>
          <Text fw={800} size="xl" c={props.tone ?? "white"}>
            {props.value}
          </Text>
        </Box>
        {props.icon}
      </Group>
    </Paper>
  );
}
