import { Button, Divider, Group, Image, SimpleGrid, Stack, Title } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Clock3, ShoppingBag, Tag, WalletCards } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { formatGil } from "@xivflips/shared";
import { useApiClient } from "../../api";
import { notifyError } from "../utils";
import { LoadingView } from "../ui/LoadingView";
import { ErrorView } from "../ui/ErrorView";
import { PageHeader } from "../ui/PageHeader";
import { StatCard } from "../ui/StatCard";
import { EventCard } from "../ui/EventCard";
import { EventForm } from "../ui/EventForm";

export function FlipDetailPage() {
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
        icon={
          current.item?.iconUrl ? (
            <Image src={current.item.iconUrl} w={48} h={48} radius={8} />
          ) : null
        }
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
          label="Estimated Unit Value"
          value={
            current.latestSnapshot?.lowestListingPrice
              ? formatGil(current.latestSnapshot.lowestListingPrice)
              : current.latestSnapshot?.recentAvgPrice
                ? formatGil(current.latestSnapshot.recentAvgPrice)
                : "-"
          }
          icon={<Clock3 />}
        />
      </SimpleGrid>
      <Group grow>
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
