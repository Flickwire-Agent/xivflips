import {
  Button,
  Combobox,
  Group,
  Image,
  Loader,
  NumberInput,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  useCombobox,
} from "@mantine/core";
import { useDebouncedCallback } from "@mantine/hooks";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Tag } from "lucide-react";
import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ItemDto } from "@xivflips/shared";
import { useApiClient } from "../../api";
import { notifyError, optionalInt, toInt } from "../utils";
import { PageHeader } from "../ui/PageHeader";
import { WorldSelect } from "../ui/WorldSelect";

export function NewFlipPage() {
  const api = useApiClient();
  const navigate = useNavigate();
  const worldsQuery = useQuery({ queryKey: ["worlds"], queryFn: api.getWorlds });
  const [selectedItem, setSelectedItem] = useState<ItemDto | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [worldId, setWorldId] = useState("");
  const [quantity, setQuantity] = useState<string | number>(1);
  const [unitPrice, setUnitPrice] = useState<string | number>("");
  const [targetSellPrice, setTargetSellPrice] = useState<string | number>("");
  const [notes, setNotes] = useState("");

  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });

  const debouncedSearch = useDebouncedCallback((query: string) => {
    setDebouncedQuery(query);
  }, 300);

  const itemSearch = useQuery({
    queryKey: ["item-search", debouncedQuery],
    queryFn: () => api.searchItems(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 60_000,
  });

  function handleSearchChange(value: string) {
    setSearchValue(value);
    setSelectedItem(null);
    debouncedSearch(value);
    if (value.length >= 2) {
      combobox.openDropdown();
    } else {
      combobox.closeDropdown();
    }
  }

  function handleSelectItem(item: ItemDto) {
    setSelectedItem(item);
    setSearchValue(item.name);
    combobox.closeDropdown();
  }

  const results = itemSearch.data?.items ?? [];

  const mutation = useMutation({
    mutationFn: () => {
      if (!selectedItem) throw new Error("Please select an item");
      return api.createFlip({
        itemId: selectedItem.id,
        itemName: selectedItem.name,
        worldId: worldId ? Number(worldId) : null,
        targetSellPrice: optionalInt(targetSellPrice),
        notes: notes || null,
        initialPurchase: {
          quantity: toInt(quantity),
          unitPrice: toInt(unitPrice),
          worldId: worldId ? Number(worldId) : null,
        },
      });
    },
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
            <Combobox
              store={combobox}
              onOptionSubmit={(optionValue) => {
                const item = results.find((i) => String(i.id) === optionValue);
                if (item) handleSelectItem(item);
              }}
            >
              <Combobox.Target>
                <TextInput
                  label="Item"
                  placeholder="Search by name or ID..."
                  value={searchValue}
                  onChange={(event) => handleSearchChange(event.currentTarget.value)}
                  onFocus={() => {
                    if (searchValue.length >= 2) combobox.openDropdown();
                  }}
                  rightSection={
                    itemSearch.isFetching ? (
                      <Loader size="xs" />
                    ) : selectedItem ? (
                      <Tag size={14} />
                    ) : null
                  }
                  required
                />
              </Combobox.Target>
              <Combobox.Dropdown>
                <Combobox.Options>
                  <ScrollArea.Autosize mah={250} type="scroll">
                    {results.length === 0 && !itemSearch.isFetching ? (
                      <Combobox.Empty>
                        {debouncedQuery.length < 2
                          ? "Type at least 2 characters to search"
                          : "No items found"}
                      </Combobox.Empty>
                    ) : null}
                    {results.map((item) => (
                      <Combobox.Option value={String(item.id)} key={item.id}>
                        <Group gap="xs" wrap="nowrap">
                          {item.iconUrl ? (
                            <Image src={item.iconUrl} w={28} h={28} radius={4} />
                          ) : null}
                          <div>
                            <Text size="sm">{item.name}</Text>
                            {item.categoryName ? (
                              <Text size="xs" c="dimmed">
                                {item.categoryName}
                              </Text>
                            ) : null}
                          </div>
                        </Group>
                      </Combobox.Option>
                    ))}
                  </ScrollArea.Autosize>
                </Combobox.Options>
              </Combobox.Dropdown>
            </Combobox>
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
          <Button
            type="submit"
            fullWidth
            size="lg"
            loading={mutation.isPending}
            disabled={!selectedItem}
          >
            Save flip
          </Button>
        </div>
      </Stack>
    </form>
  );
}
