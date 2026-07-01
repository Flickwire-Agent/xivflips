import { BarChart3, ShoppingBag, Tag } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Button, Group, NumberInput, Paper, SimpleGrid, Stack, Text } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { WorldDto } from "@xivflips/shared";
import { useApiClient } from "../../api";
import { notifyError, toInt } from "../utils";
import { WorldSelect } from "./WorldSelect";

export function EventForm(props: {
  type: "purchase" | "listing" | "sale";
  flipId: string;
  worlds: WorldDto[];
}) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: api.getMe });
  const [quantity, setQuantity] = useState<string | number>(1);
  const [unitPrice, setUnitPrice] = useState<string | number>("");
  const [worldId, setWorldId] = useState("");
  const [taxRatePercent, setTaxRatePercent] = useState<string | number>(5);

  useEffect(() => {
    if (me.data?.user.defaultTaxRateBps != null) {
      setTaxRatePercent(me.data.user.defaultTaxRateBps / 100);
    }
  }, [me.data?.user.defaultTaxRateBps]);
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
