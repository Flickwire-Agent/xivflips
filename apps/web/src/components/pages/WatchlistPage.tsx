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
  useCombobox,
} from "@mantine/core";
import { useDebouncedCallback } from "@mantine/hooks";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star, Tag } from "lucide-react";
import { FormEvent, useState } from "react";
import type { ItemDto } from "@xivflips/shared";
import { useApiClient } from "../../api";
import { notifyError, optionalInt } from "../utils";
import { PageHeader } from "../ui/PageHeader";
import { WorldSelect } from "../ui/WorldSelect";
import { LoadingView } from "../ui/LoadingView";
import { ErrorView } from "../ui/ErrorView";
import { WatchlistCard } from "../ui/WatchlistCard";

export function WatchlistPage() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const worlds = useQuery({ queryKey: ["worlds"], queryFn: api.getWorlds });
  const watchlist = useQuery({ queryKey: ["watchlist"], queryFn: api.getWatchlist });
  const [selectedItem, setSelectedItem] = useState<ItemDto | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [worldId, setWorldId] = useState("");
  const [targetBuyPrice, setTargetBuyPrice] = useState<string | number>("");
  const [targetSellPrice, setTargetSellPrice] = useState<string | number>("");

  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });

  const debouncedSearch = useDebouncedCallback((query: string) => {
    setDebouncedQuery(query);
  }, 300);

  const itemSearch = useQuery({
    queryKey: ["watchlist-item-search", debouncedQuery],
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

  const add = useMutation({
    mutationFn: () => {
      if (!selectedItem) throw new Error("Please select an item");
      return api.createWatchlistItem({
        itemId: selectedItem.id,
        itemName: selectedItem.name,
        worldId: worldId ? Number(worldId) : null,
        targetBuyPrice: optionalInt(targetBuyPrice),
        targetSellPrice: optionalInt(targetSellPrice),
      });
    },
    onSuccess: () => {
      setSelectedItem(null);
      setSearchValue("");
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
