import { useAuth0 } from "@auth0/auth0-react";
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Divider,
  Group,
  Loader,
  NativeSelect,
  NumberInput,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FlipDetailDto, FlipDto, WatchlistItemDto, WorldDto } from "@xivflips/shared";
import { formatGil, formatPercentFromBps } from "@xivflips/shared";
import {
  BarChart3,
  Clock3,
  ListChecks,
  LogOut,
  Plus,
  RefreshCw,
  Settings,
  ShoppingBag,
  Sparkles,
  Star,
  Tag,
  WalletCards,
} from "lucide-react";
import { FormEvent, startTransition, useState } from "react";
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { useApiClient } from "./api";
import { authConfigured } from "./env";

const statusFilters = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "listed", label: "Listed" },
  { value: "partially_sold", label: "Partial" },
  { value: "sold", label: "Sold" },
  { value: "archived", label: "Archived" },
];

function toInt(value: string | number): number {
  return typeof value === "number" ? value : Number(value.replaceAll(",", ""));
}

function optionalInt(value: string | number | null): number | null {
  if (value === null || value === "") return null;
  const next = toInt(value);
  return Number.isFinite(next) ? next : null;
}

function notifyError(error: unknown) {
  notifications.show({
    color: "red",
    title: "Something went wrong",
    message: error instanceof Error ? error.message : String(error),
  });
}

function PageHeader(props: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <Group justify="space-between" align="flex-start" wrap="nowrap" mb="md">
      <Box>
        <Title order={1} size="h2">
          {props.title}
        </Title>
        {props.description ? (
          <Text c="dimmed" size="sm" mt={4}>
            {props.description}
          </Text>
        ) : null}
      </Box>
      {props.action}
    </Group>
  );
}

function LoadingView() {
  return (
    <Center mih="50vh">
      <Loader />
    </Center>
  );
}

function ErrorView({ error }: { error: unknown }) {
  return (
    <Alert color="red" title="Unable to load">
      {error instanceof Error ? error.message : String(error)}
    </Alert>
  );
}

function EmptyState(props: { title: string; description: string; action?: React.ReactNode }) {
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

function SnapshotBadge({ capturedAt }: { capturedAt: string | null | undefined }) {
  if (!capturedAt) return <Badge color="gray">No market snapshot</Badge>;
  const hours = Math.max(0, Math.round((Date.now() - new Date(capturedAt).getTime()) / 3_600_000));
  return <Badge color={hours <= 36 ? "green" : "yellow"}>{hours}h old</Badge>;
}

function WorldSelect(props: {
  worlds: WorldDto[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  return (
    <NativeSelect
      label={props.label ?? "World"}
      value={props.value}
      onChange={(event) => props.onChange(event.currentTarget.value)}
      data={[
        { value: "", label: "No world" },
        ...props.worlds.map((world) => ({
          value: String(world.id),
          label: `${world.name} (${world.dataCenter})`,
        })),
      ]}
    />
  );
}

function LandingPage() {
  const { isAuthenticated, loginWithRedirect } = useAuth0();

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

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
          {!authConfigured ? (
            <Alert color="yellow" title="Auth0 setup required">
              Add Auth0 values to the environment before login is available.
            </Alert>
          ) : null}
          <Button
            size="lg"
            leftSection={<Sparkles size={18} />}
            disabled={!authConfigured}
            onClick={() => loginWithRedirect()}
          >
            Log in to start tracking
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

function LoginRequired() {
  const { loginWithRedirect } = useAuth0();
  return (
    <main className="hero">
      <Paper className="glass-card" p="xl" radius="xl" maw={420}>
        <Stack>
          <Title order={2}>Login required</Title>
          <Text c="dimmed">All flip tracking features are private to your Auth0 account.</Text>
          <Button disabled={!authConfigured} onClick={() => loginWithRedirect()}>
            Log in
          </Button>
        </Stack>
      </Paper>
    </main>
  );
}

function BottomNav() {
  const links = [
    { to: "/dashboard", label: "Dash", icon: BarChart3 },
    { to: "/flips", label: "Flips", icon: ListChecks },
    { to: "/watchlist", label: "Watch", icon: Star },
    { to: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <nav className="bottom-nav" aria-label="Primary">
      {links.map((link) => (
        <NavLink key={link.to} to={link.to}>
          <link.icon size={20} />
          <span>{link.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function ProtectedShell() {
  const { isLoading, isAuthenticated, logout, user } = useAuth0();
  const location = useLocation();

  if (!authConfigured) {
    return (
      <main className="hero">
        <Alert color="yellow" title="Auth0 is not configured" maw={460}>
          Set `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, and `VITE_AUTH0_AUDIENCE` to use the
          authenticated app.
        </Alert>
      </main>
    );
  }

  if (isLoading) return <LoadingView />;
  if (!isAuthenticated) return <LoginRequired />;

  return (
    <div className="app-shell">
      <div className="mobile-container">
        <Group justify="space-between" mb="lg" wrap="nowrap">
          <Box>
            <Text size="xs" c="dimmed">
              XIV Flips
            </Text>
            <Text fw={700} truncate="end" maw={240}>
              {user?.name ?? user?.email ?? "Market tracker"}
            </Text>
          </Box>
          <ActionIcon
            variant="subtle"
            aria-label="Log out"
            onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
          >
            <LogOut size={18} />
          </ActionIcon>
        </Group>
        <Routes location={location}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/flips" element={<FlipsPage />} />
          <Route path="/flips/new" element={<NewFlipPage />} />
          <Route path="/flips/:id" element={<FlipDetailPage />} />
          <Route path="/watchlist" element={<WatchlistPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
      <BottomNav />
    </div>
  );
}

function StatCard(props: { label: string; value: string; tone?: string; icon: React.ReactNode }) {
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

function FlipCard({ flip }: { flip: FlipDto }) {
  return (
    <Card component={NavLink} to={`/flips/${flip.id}`} className="glass-card" p="md" radius="xl">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Box>
            <Text fw={800}>{flip.item?.name ?? `Item ${flip.itemId}`}</Text>
            <Text size="sm" c="dimmed">
              {flip.world ? `${flip.world.name} • ${flip.world.dataCenter}` : "No world"}
            </Text>
          </Box>
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
          <Box>
            <Text size="xs" c="dimmed">
              Market
            </Text>
            <SnapshotBadge capturedAt={flip.latestSnapshot?.capturedAt} />
          </Box>
        </SimpleGrid>
      </Stack>
    </Card>
  );
}

function DashboardPage() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const dashboard = useQuery({ queryKey: ["dashboard"], queryFn: api.getDashboard });
  const refresh = useMutation({
    mutationFn: () => api.refreshMarket(),
    onSuccess: (result) => {
      notifications.show({
        color: "green",
        title: "Market refresh complete",
        message: `${result.snapshots}/${result.checked} snapshots updated`,
      });
      queryClient.invalidateQueries();
    },
    onError: notifyError,
  });

  if (dashboard.isLoading) return <LoadingView />;
  if (dashboard.error) return <ErrorView error={dashboard.error} />;

  const data = dashboard.data!;

  return (
    <Stack>
      <PageHeader
        title="Dashboard"
        description="Today’s view of active gil, realized profit, and stale market context."
        action={
          <ActionIcon variant="light" onClick={() => refresh.mutate()} loading={refresh.isPending}>
            <RefreshCw size={18} />
          </ActionIcon>
        }
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

function FlipsPage() {
  const [status, setStatus] = useState("active");
  const api = useApiClient();
  const flips = useQuery({
    queryKey: ["flips", status],
    queryFn: () => api.getFlips(status === "all" ? undefined : status),
  });

  return (
    <Stack>
      <PageHeader
        title="Flips"
        description="Card-first tracking for quick mobile checks."
        action={
          <Button component={NavLink} to="/flips/new" leftSection={<Plus size={16} />}>
            New
          </Button>
        }
      />
      <SegmentedControl
        fullWidth
        value={status}
        onChange={(value) => startTransition(() => setStatus(value))}
        data={statusFilters}
      />
      {flips.isLoading ? <LoadingView /> : null}
      {flips.error ? <ErrorView error={flips.error} /> : null}
      {flips.data?.flips.length ? (
        <Stack gap="sm">
          {flips.data.flips.map((flip) => (
            <FlipCard key={flip.id} flip={flip} />
          ))}
        </Stack>
      ) : null}
      {flips.data && flips.data.flips.length === 0 ? (
        <EmptyState
          title="Nothing in this filter"
          description="Switch filters or create a new flip from a purchase."
        />
      ) : null}
    </Stack>
  );
}

function NewFlipPage() {
  const api = useApiClient();
  const navigate = useNavigate();
  const worldsQuery = useQuery({ queryKey: ["worlds"], queryFn: api.getWorlds });
  const [itemId, setItemId] = useState<string | number>("");
  const [itemName, setItemName] = useState("");
  const [worldId, setWorldId] = useState("");
  const [quantity, setQuantity] = useState<string | number>(1);
  const [unitPrice, setUnitPrice] = useState<string | number>("");
  const [targetSellPrice, setTargetSellPrice] = useState<string | number>("");
  const [notes, setNotes] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      api.createFlip({
        itemId: toInt(itemId),
        itemName: itemName || undefined,
        worldId: worldId ? Number(worldId) : null,
        targetSellPrice: optionalInt(targetSellPrice),
        notes: notes || null,
        initialPurchase: {
          quantity: toInt(quantity),
          unitPrice: toInt(unitPrice),
          worldId: worldId ? Number(worldId) : null,
        },
      }),
    onSuccess: (result) => navigate(`/flips/${result.flip.id}`),
    onError: notifyError,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <form onSubmit={submit}>
      <Stack>
        <PageHeader
          title="New flip"
          description="Log the purchase first; sale/listing events can be added later."
        />
        <Paper className="glass-card" p="md" radius="xl">
          <Stack>
            <NumberInput label="Item ID" value={itemId} onChange={setItemId} required min={1} />
            <TextInput
              label="Item name"
              description="Optional, used immediately while metadata warms up."
              value={itemName}
              onChange={(event) => setItemName(event.currentTarget.value)}
            />
            <WorldSelect
              worlds={worldsQuery.data?.worlds ?? []}
              value={worldId}
              onChange={setWorldId}
            />
            <SimpleGrid cols={2} spacing="sm">
              <NumberInput
                label="Quantity"
                value={quantity}
                onChange={setQuantity}
                required
                min={1}
              />
              <NumberInput
                label="Buy/unit"
                value={unitPrice}
                onChange={setUnitPrice}
                required
                min={0}
              />
            </SimpleGrid>
            <NumberInput
              label="Target sell/unit"
              value={targetSellPrice}
              onChange={setTargetSellPrice}
              min={0}
            />
            <Textarea
              label="Notes"
              value={notes}
              onChange={(event) => setNotes(event.currentTarget.value)}
            />
          </Stack>
        </Paper>
        <div className="sticky-actions">
          <Button type="submit" fullWidth size="lg" loading={mutation.isPending}>
            Save flip
          </Button>
        </div>
      </Stack>
    </form>
  );
}

function EventForm(props: {
  type: "purchase" | "listing" | "sale";
  flipId: string;
  worlds: WorldDto[];
}) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState<string | number>(1);
  const [unitPrice, setUnitPrice] = useState<string | number>("");
  const [worldId, setWorldId] = useState("");
  const [taxRatePercent, setTaxRatePercent] = useState<string | number>(5);
  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        quantity: toInt(quantity),
        unitPrice: toInt(unitPrice),
        worldId: worldId ? Number(worldId) : null,
        taxRateBps: props.type === "sale" ? Math.round(Number(taxRatePercent) * 100) : undefined,
      };
      if (props.type === "purchase") return api.addPurchase(props.flipId, body);
      if (props.type === "listing") return api.addListing(props.flipId, body);
      return api.addSale(props.flipId, body);
    },
    onSuccess: () => {
      setQuantity(1);
      setUnitPrice("");
      queryClient.invalidateQueries({ queryKey: ["flip", props.flipId] });
      queryClient.invalidateQueries({ queryKey: ["flips"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: notifyError,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <Paper component="form" onSubmit={submit} className="glass-card" p="md" radius="xl">
      <Stack gap="sm">
        <Group justify="space-between">
          <Text fw={800}>Add {props.type}</Text>
          {props.type === "purchase" ? <ShoppingBag size={18} /> : null}
          {props.type === "listing" ? <Tag size={18} /> : null}
          {props.type === "sale" ? <BarChart3 size={18} /> : null}
        </Group>
        <SimpleGrid cols={2} spacing="sm">
          <NumberInput label="Qty" value={quantity} onChange={setQuantity} min={1} required />
          <NumberInput
            label="Gil/unit"
            value={unitPrice}
            onChange={setUnitPrice}
            min={0}
            required
          />
        </SimpleGrid>
        {props.type === "sale" ? (
          <NumberInput
            label="Tax rate"
            suffix="%"
            value={taxRatePercent}
            onChange={setTaxRatePercent}
            min={0}
            max={100}
            decimalScale={2}
          />
        ) : null}
        <WorldSelect worlds={props.worlds} value={worldId} onChange={setWorldId} />
        <Button type="submit" loading={mutation.isPending} fullWidth>
          Add {props.type}
        </Button>
      </Stack>
    </Paper>
  );
}

function FlipDetailPage() {
  const { id } = useParams<{ id: string }>();
  const api = useApiClient();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const flip = useQuery({
    queryKey: ["flip", id],
    queryFn: () => api.getFlip(id!),
    enabled: Boolean(id),
  });
  const worlds = useQuery({ queryKey: ["worlds"], queryFn: api.getWorlds });
  const archive = useMutation({
    mutationFn: () => api.archiveFlip(id!),
    onSuccess: () => navigate("/flips"),
    onError: notifyError,
  });
  const restore = useMutation({
    mutationFn: () => api.restoreFlip(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flip", id] });
      queryClient.invalidateQueries({ queryKey: ["flips"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: notifyError,
  });
  const refresh = useMutation({
    mutationFn: (current: FlipDetailDto) =>
      api.refreshMarket({
        itemId: current.itemId,
        worldId: current.worldId,
        dataCenter: current.world?.dataCenter ?? null,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["flip", id] }),
    onError: notifyError,
  });

  if (flip.isLoading) return <LoadingView />;
  if (flip.error) return <ErrorView error={flip.error} />;

  const current = flip.data!.flip;

  return (
    <Stack>
      <PageHeader
        title={current.item?.name ?? `Item ${current.itemId}`}
        description={
          current.world ? `${current.world.name} • ${current.world.dataCenter}` : "No world"
        }
        action={<SnapshotBadge capturedAt={current.latestSnapshot?.capturedAt} />}
      />
      <SimpleGrid cols={2} spacing="sm">
        <StatCard
          label="Profit"
          value={formatGil(current.profit.realizedProfit)}
          icon={<BarChart3 />}
        />
        <StatCard
          label="Remaining"
          value={String(current.profit.remainingQuantity)}
          icon={<ShoppingBag />}
        />
        <StatCard
          label="Avg cost"
          value={formatGil(current.profit.averageCostPerUnit)}
          icon={<WalletCards />}
        />
        <StatCard
          label="Market low"
          value={
            current.latestSnapshot?.lowestListingPrice
              ? formatGil(current.latestSnapshot.lowestListingPrice)
              : "-"
          }
          icon={<Clock3 />}
        />
      </SimpleGrid>
      <Group grow>
        <Button
          variant="light"
          leftSection={<RefreshCw size={16} />}
          loading={refresh.isPending}
          onClick={() => refresh.mutate(current)}
        >
          Refresh
        </Button>
        {current.status === "archived" ? (
          <Button variant="light" loading={restore.isPending} onClick={() => restore.mutate()}>
            Restore
          </Button>
        ) : (
          <Button
            color="red"
            variant="subtle"
            loading={archive.isPending}
            onClick={() => archive.mutate()}
          >
            Archive
          </Button>
        )}
      </Group>
      <Title order={2} size="h3">
        Timeline
      </Title>
      <Stack gap="xs">
        {current.purchases.map((purchase) => (
          <EventCard
            key={purchase.id}
            label="Purchase"
            icon={<ShoppingBag size={16} />}
            quantity={purchase.quantity}
            unitPrice={purchase.unitPrice}
            date={purchase.purchasedAt}
          />
        ))}
        {current.listings.map((listing) => (
          <EventCard
            key={listing.id}
            label={`Listing (${listing.status})`}
            icon={<Tag size={16} />}
            quantity={listing.quantity}
            unitPrice={listing.unitPrice}
            date={listing.listedAt}
          />
        ))}
        {current.sales.map((sale) => (
          <EventCard
            key={sale.id}
            label="Sale"
            icon={<BarChart3 size={16} />}
            quantity={sale.quantity}
            unitPrice={sale.unitPrice}
            date={sale.soldAt}
          />
        ))}
      </Stack>
      <Divider />
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
        <EventForm type="purchase" flipId={current.id} worlds={worlds.data?.worlds ?? []} />
        <EventForm type="listing" flipId={current.id} worlds={worlds.data?.worlds ?? []} />
        <EventForm type="sale" flipId={current.id} worlds={worlds.data?.worlds ?? []} />
      </SimpleGrid>
    </Stack>
  );
}

function EventCard(props: {
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

function WatchlistCard({ item, onDelete }: { item: WatchlistItemDto; onDelete: () => void }) {
  const current =
    item.latestSnapshot?.lowestListingPrice ?? item.latestSnapshot?.recentAvgPrice ?? null;
  const meetsBuy = item.targetBuyPrice && current ? current <= item.targetBuyPrice : false;
  return (
    <Paper className="glass-card" p="md" radius="xl">
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap">
          <Box>
            <Text fw={800}>{item.item?.name ?? `Item ${item.itemId}`}</Text>
            <Text size="sm" c="dimmed">
              {item.world?.name ?? item.dataCenter ?? "Any world"}
            </Text>
          </Box>
          <SnapshotBadge capturedAt={item.latestSnapshot?.capturedAt} />
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

function WatchlistPage() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const worlds = useQuery({ queryKey: ["worlds"], queryFn: api.getWorlds });
  const watchlist = useQuery({ queryKey: ["watchlist"], queryFn: api.getWatchlist });
  const [itemId, setItemId] = useState<string | number>("");
  const [itemName, setItemName] = useState("");
  const [worldId, setWorldId] = useState("");
  const [targetBuyPrice, setTargetBuyPrice] = useState<string | number>("");
  const [targetSellPrice, setTargetSellPrice] = useState<string | number>("");
  const add = useMutation({
    mutationFn: () =>
      api.createWatchlistItem({
        itemId: toInt(itemId),
        itemName: itemName || undefined,
        worldId: worldId ? Number(worldId) : null,
        targetBuyPrice: optionalInt(targetBuyPrice),
        targetSellPrice: optionalInt(targetSellPrice),
      }),
    onSuccess: () => {
      setItemId("");
      setItemName("");
      setTargetBuyPrice("");
      setTargetSellPrice("");
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
    onError: notifyError,
  });
  const remove = useMutation({
    mutationFn: api.deleteWatchlistItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watchlist"] }),
    onError: notifyError,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    add.mutate();
  }

  return (
    <Stack>
      <PageHeader
        title="Watchlist"
        description="Track target prices against the daily snapshot job."
      />
      <Paper component="form" onSubmit={submit} className="glass-card" p="md" radius="xl">
        <Stack gap="sm">
          <Group wrap="nowrap">
            <Star size={20} />
            <Text fw={800}>Add target</Text>
          </Group>
          <SimpleGrid cols={2} spacing="sm">
            <NumberInput label="Item ID" value={itemId} onChange={setItemId} min={1} required />
            <TextInput
              label="Name"
              value={itemName}
              onChange={(e) => setItemName(e.currentTarget.value)}
            />
          </SimpleGrid>
          <WorldSelect worlds={worlds.data?.worlds ?? []} value={worldId} onChange={setWorldId} />
          <SimpleGrid cols={2} spacing="sm">
            <NumberInput
              label="Buy target"
              value={targetBuyPrice}
              onChange={setTargetBuyPrice}
              min={0}
            />
            <NumberInput
              label="Sell target"
              value={targetSellPrice}
              onChange={setTargetSellPrice}
              min={0}
            />
          </SimpleGrid>
          <Button type="submit" loading={add.isPending} fullWidth>
            Add watch
          </Button>
        </Stack>
      </Paper>
      {watchlist.isLoading ? <LoadingView /> : null}
      {watchlist.error ? <ErrorView error={watchlist.error} /> : null}
      <Stack gap="sm">
        {watchlist.data?.watchlist.map((item) => (
          <WatchlistCard key={item.id} item={item} onDelete={() => remove.mutate(item.id)} />
        ))}
      </Stack>
    </Stack>
  );
}

function SettingsPage() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: api.getMe });
  const worlds = useQuery({ queryKey: ["worlds"], queryFn: api.getWorlds });
  const [worldId, setWorldId] = useState("");
  const [taxRateBps, setTaxRateBps] = useState<string | number>(500);
  const update = useMutation({
    mutationFn: () =>
      api.updateSettings({
        homeWorldId: worldId ? Number(worldId) : null,
        defaultTaxRateBps: toInt(taxRateBps),
      }),
    onSuccess: () => {
      notifications.show({ color: "green", message: "Settings saved" });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: notifyError,
  });

  if (me.isLoading) return <LoadingView />;
  if (me.error) return <ErrorView error={me.error} />;

  function hydrate() {
    setWorldId(me.data?.user.homeWorldId ? String(me.data.user.homeWorldId) : "");
    setTaxRateBps(me.data?.user.defaultTaxRateBps ?? 500);
  }

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
          </Box>
          <WorldSelect
            worlds={worlds.data?.worlds ?? []}
            value={worldId}
            onChange={setWorldId}
            label="Home world"
          />
          <NumberInput
            label="Default tax bps"
            value={taxRateBps}
            onChange={setTaxRateBps}
            min={0}
            max={10000}
          />
          <Group grow>
            <Button variant="light" onClick={hydrate}>
              Load current
            </Button>
            <Button loading={update.isPending} onClick={() => update.mutate()}>
              Save
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Stack>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/*" element={<ProtectedShell />} />
    </Routes>
  );
}
