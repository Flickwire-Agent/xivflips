import { Badge, Box, Button, Group, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Plus, ShoppingBag, Sparkles, WalletCards } from "lucide-react";
import { NavLink } from "react-router-dom";
import { formatGil, formatPercentFromBps } from "@xivflips/shared";
import { useApiClient } from "../../api";
import { LoadingView } from "../ui/LoadingView";
import { ErrorView } from "../ui/ErrorView";
import { PageHeader } from "../ui/PageHeader";
import { StatCard } from "../ui/StatCard";
import { FlipCard } from "../ui/FlipCard";
import { EmptyState } from "../ui/EmptyState";

export function DashboardPage() {
  const api = useApiClient();
  const dashboard = useQuery({ queryKey: ["dashboard"], queryFn: api.getDashboard });

  if (dashboard.isLoading) return <LoadingView />;
  if (dashboard.error) return <ErrorView error={dashboard.error} />;

  const data = dashboard.data!;

  return (
    <Stack>
      <PageHeader
        title="Dashboard"
        description="Today's view of active gil, realized profit, and stale market context."
      />
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        <StatCard
          label="Active cost"
          value={formatGil(data.activeCostBasis)}
          icon={<WalletCards />}
        />
        <StatCard
          label="Realized"
          value={formatGil(data.realizedProfit)}
          tone={data.realizedProfit >= 0 ? "green" : "red"}
          icon={<BarChart3 />}
        />
        <StatCard
          label="ROI"
          value={data.realizedRoiBps === null ? "-" : formatPercentFromBps(data.realizedRoiBps)}
          icon={<Sparkles />}
        />
        <StatCard
          label="Inventory"
          value={formatGil(data.estimatedInventoryValue)}
          icon={<ShoppingBag />}
        />
      </SimpleGrid>
      <Title order={2} size="h3">
        Active flips
      </Title>
      {data.activeFlips.length ? (
        <Stack gap="sm">
          {data.activeFlips.map((flip) => (
            <FlipCard key={flip.id} flip={flip} />
          ))}
        </Stack>
      ) : (
        <EmptyState
          title="No active flips yet"
          description="Create your first tracked flip when you buy an item to resell."
          action={
            <Button component={NavLink} to="/flips/new" leftSection={<Plus size={16} />}>
              New flip
            </Button>
          }
        />
      )}
      <Title order={2} size="h3">
        Recent sales
      </Title>
      <Stack gap="xs">
        {data.recentSales.map((sale) => (
          <Paper key={sale.id} className="glass-card" p="md" radius="lg">
            <Group justify="space-between" wrap="nowrap">
              <Box>
                <Text fw={700}>{sale.itemName}</Text>
                <Text size="sm" c="dimmed">
                  {sale.quantity} sold at {formatGil(sale.unitPrice)}
                </Text>
              </Box>
              <Badge color="green">{formatGil(sale.quantity * sale.unitPrice)}</Badge>
            </Group>
          </Paper>
        ))}
      </Stack>
    </Stack>
  );
}
