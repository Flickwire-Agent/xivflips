import { Badge, Box, Button, Divider, Group, NumberInput, Paper, Stack, Text } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { notifications } from "@mantine/notifications";
import { useApiClient } from "../../api";
import { notifyError } from "../utils";
import { LoadingView } from "../ui/LoadingView";
import { ErrorView } from "../ui/ErrorView";
import { PageHeader } from "../ui/PageHeader";
import { WorldSelect } from "../ui/WorldSelect";

export function SettingsPage() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const me = useQuery({ queryKey: ["me"], queryFn: api.getMe });
  const worlds = useQuery({ queryKey: ["worlds"], queryFn: api.getWorlds });
  const [worldId, setWorldId] = useState("");
  const [taxRatePercent, setTaxRatePercent] = useState<string | number>(5);
  const update = useMutation({
    mutationFn: () =>
      api.updateSettings({
        homeWorldId: worldId ? Number(worldId) : null,
        defaultTaxRateBps: Math.round(Number(taxRatePercent) * 100),
      }),
    onSuccess: () => {
      notifications.show({ color: "green", message: "Settings saved" });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: notifyError,
  });
  const linkXivauth = useMutation({
    mutationFn: api.getXivauthLinkUrl,
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: notifyError,
  });

  useEffect(() => {
    setWorldId(me.data?.user.homeWorldId ? String(me.data.user.homeWorldId) : "");
    setTaxRatePercent((me.data?.user.defaultTaxRateBps ?? 500) / 100);
  }, [me.data?.user.defaultTaxRateBps, me.data?.user.homeWorldId]);

  if (me.isLoading) return <LoadingView />;
  if (me.error) return <ErrorView error={me.error} />;

  return (
    <Stack>
      <PageHeader title="Settings" description="Defaults used when entering sales and purchases." />
      <Paper className="glass-card" p="md" radius="xl">
        <Stack>
          <Box>
            <Text size="sm" c="dimmed">
              Account
            </Text>
            <Text fw={800}>
              {me.data?.user.displayName ?? me.data?.user.email ?? "Authenticated user"}
            </Text>
            <Text size="xs" c="dimmed">
              Signed in with XIVAuth
            </Text>
          </Box>
          {me.data?.user.isAdmin ? (
            <>
              <Divider />
              <Button variant="light" color="red" onClick={() => navigate("/admin")}>
                Admin Panel
              </Button>
            </>
          ) : null}
          <Divider />
          <Stack gap="xs">
            <Group justify="space-between" align="center">
              <Box>
                <Text fw={800}>XIVAuth</Text>
                <Text size="sm" c="dimmed">
                  Link a verified FFXIV character for account recovery and future character-aware
                  defaults.
                </Text>
              </Box>
              <Button
                variant="light"
                loading={linkXivauth.isPending}
                onClick={() => linkXivauth.mutate()}
              >
                {me.data?.xivauthCharacters.length ? "Refresh link" : "Link XIVAuth"}
              </Button>
            </Group>
            {me.data?.xivauthCharacters.length ? (
              <Stack gap="xs">
                {me.data.xivauthCharacters.map((character) => (
                  <Paper key={character.id} p="sm" radius="lg" bg="rgba(255,255,255,0.04)">
                    <Group justify="space-between" wrap="nowrap">
                      <Box>
                        <Text fw={700}>{character.name}</Text>
                        <Text size="sm" c="dimmed">
                          {character.homeWorld} • {character.dataCenter}
                        </Text>
                      </Box>
                      <Badge variant="light">Verified</Badge>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">
                No XIVAuth character linked yet.
              </Text>
            )}
          </Stack>
          <Divider />
          <WorldSelect
            worlds={worlds.data?.worlds ?? []}
            value={worldId}
            onChange={setWorldId}
            label="Home world"
          />
          <NumberInput
            label="Default tax rate"
            suffix="%"
            value={taxRatePercent}
            onChange={setTaxRatePercent}
            min={0}
            max={100}
            decimalScale={2}
          />
          <Button loading={update.isPending} onClick={() => update.mutate()}>
            Save
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
}
