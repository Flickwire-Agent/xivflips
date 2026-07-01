import { Badge, Box, Card, Group, Image, SimpleGrid, Stack, Text } from "@mantine/core";
import { NavLink } from "react-router-dom";
import type { FlipDto } from "@xivflips/shared";
import { formatGil } from "@xivflips/shared";

export function FlipCard({ flip }: { flip: FlipDto }) {
  return (
    <Card component={NavLink} to={`/flips/${flip.id}`} className="glass-card" p="md" radius="xl">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            {flip.item?.iconUrl ? <Image src={flip.item.iconUrl} w={40} h={40} radius={8} /> : null}
            <Box>
              <Text fw={800}>{flip.item?.name ?? `Item ${flip.itemId}`}</Text>
              <Text size="sm" c="dimmed">
                {flip.world ? `${flip.world.name} • ${flip.world.dataCenter}` : "No world"}
              </Text>
            </Box>
          </Group>
          <Badge>{flip.status.replaceAll("_", " ")}</Badge>
        </Group>
        <SimpleGrid cols={3} spacing="xs">
          <Box>
            <Text size="xs" c="dimmed">
              Profit
            </Text>
            <Text fw={700} c={flip.profit.realizedProfit >= 0 ? "green" : "red"}>
              {formatGil(flip.profit.realizedProfit)}
            </Text>
          </Box>
          <Box>
            <Text size="xs" c="dimmed">
              Left
            </Text>
            <Text fw={700}>{flip.profit.remainingQuantity}</Text>
          </Box>
        </SimpleGrid>
      </Stack>
    </Card>
  );
}
