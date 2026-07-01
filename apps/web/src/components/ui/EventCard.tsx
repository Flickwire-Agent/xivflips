import { Box, Group, Paper, Text } from "@mantine/core";
import { formatGil } from "@xivflips/shared";

export function EventCard(props: {
  label: string;
  icon: React.ReactNode;
  quantity: number;
  unitPrice: number;
  date: string | null;
}) {
  return (
    <Paper className="glass-card" p="md" radius="lg">
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap">
          {props.icon}
          <Box>
            <Text fw={700}>{props.label}</Text>
            <Text size="sm" c="dimmed">
              {props.quantity} at {formatGil(props.unitPrice)}
            </Text>
          </Box>
        </Group>
        <Text size="xs" c="dimmed" ta="right">
          {props.date ? new Date(props.date).toLocaleDateString() : "No date"}
        </Text>
      </Group>
    </Paper>
  );
}
