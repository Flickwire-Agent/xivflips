import { Button, SegmentedControl, Stack } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { startTransition, useState } from "react";
import { NavLink } from "react-router-dom";
import { useApiClient } from "../../api";
import { statusFilters } from "../constants";
import { EmptyState } from "../ui/EmptyState";
import { ErrorView } from "../ui/ErrorView";
import { FlipCard } from "../ui/FlipCard";
import { LoadingView } from "../ui/LoadingView";
import { PageHeader } from "../ui/PageHeader";

export function FlipsPage() {
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
