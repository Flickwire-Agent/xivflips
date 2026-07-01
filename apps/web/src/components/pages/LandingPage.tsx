import { Badge, Box, Button, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { apiUrl, useApiClient } from "../../api";

export function LandingPage() {
  const api = useApiClient();
  const me = useQuery({ queryKey: ["me"], queryFn: api.getMe, retry: false });

  if (me.isSuccess) return <Navigate to="/dashboard" replace />;

  return (
    <main className="hero">
      <Paper className="glass-card" p="xl" radius="xl" maw={560}>
        <Stack gap="lg">
          <Badge w="fit-content" color="indigo" variant="light">
            FFXIV market-board companion
          </Badge>
          <Box>
            <Title order={1} size="2.6rem" lh={1.03}>
              Track flips before the market forgets.
            </Title>
            <Text c="dimmed" mt="md" size="lg">
              Log buys, listings, and sales from your phone while checking retainers. XIV Flips
              keeps your profit math, inventory value, and daily market context in one place.
            </Text>
          </Box>
          <Button
            size="lg"
            leftSection={<Sparkles size={18} />}
            onClick={() => {
              window.location.href = apiUrl("/auth/xivauth/start");
            }}
          >
            Log in with XIVAuth
          </Button>
          <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="sm">
            <Paper p="md" radius="lg" bg="rgba(99, 102, 241, 0.12)">
              <Text fw={700}>Profit</Text>
              <Text size="sm" c="dimmed">
                Realized ROI and fees
              </Text>
            </Paper>
            <Paper p="md" radius="lg" bg="rgba(20, 184, 166, 0.12)">
              <Text fw={700}>Inventory</Text>
              <Text size="sm" c="dimmed">
                Active gil at risk
              </Text>
            </Paper>
            <Paper p="md" radius="lg" bg="rgba(234, 179, 8, 0.12)">
              <Text fw={700}>Market</Text>
              <Text size="sm" c="dimmed">
                Daily snapshots
              </Text>
            </Paper>
          </SimpleGrid>
        </Stack>
      </Paper>
    </main>
  );
}
