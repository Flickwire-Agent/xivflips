import { Button, Box, Group, Image, Paper, SimpleGrid, Stack, Text } from "@mantine/core";
import type { WatchlistItemDto } from "@xivflips/shared";
import { formatGil } from "@xivflips/shared";

export function WatchlistCard({
  item,
  onDelete,
}: {
  item: WatchlistItemDto;
  onDelete: () => void;
}) {
  const current =
    item.latestSnapshot?.lowestListingPrice ?? item.latestSnapshot?.recentAvgPrice ?? null;
  const meetsBuy = item.targetBuyPrice && current ? current <= item.targetBuyPrice : false;
  return (
    <Paper className="glass-card" p="md" radius="xl">
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            {item.item?.iconUrl ? <Image src={item.item.iconUrl} w={40} h={40} radius={8} /> : null}
            <Box>
              <Text fw={800}>{item.item?.name ?? `Item ${item.itemId}`}</Text>
              <Text size="sm" c="dimmed">
                {item.world?.name ?? item.dataCenter ?? "Any world"}
              </Text>
            </Box>
          </Group>
        </Group>
        <SimpleGrid cols={3} spacing="xs">
          <Box>
            <Text size="xs" c="dimmed">
              Target buy
            </Text>
            <Text fw={700}>{item.targetBuyPrice ? formatGil(item.targetBuyPrice) : "-"}</Text>
          </Box>
          <Box>
            <Text size="xs" c="dimmed">
              Market
            </Text>
            <Text fw={700} c={meetsBuy ? "green" : "white"}>
              {current ? formatGil(current) : "-"}
            </Text>
          </Box>
          <Box>
            <Text size="xs" c="dimmed">
              Sell
            </Text>
            <Text fw={700}>{item.targetSellPrice ? formatGil(item.targetSellPrice) : "-"}</Text>
          </Box>
        </SimpleGrid>
        <Button color="red" variant="subtle" size="xs" onClick={onDelete}>
          Remove
        </Button>
      </Stack>
    </Paper>
  );
}
