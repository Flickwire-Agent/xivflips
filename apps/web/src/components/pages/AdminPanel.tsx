import { Badge, Button, Paper, Stack, Table, Text } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useApiClient } from "../../api";
import { notifyError } from "../utils";
import { LoadingView } from "../ui/LoadingView";
import { ErrorView } from "../ui/ErrorView";
import { PageHeader } from "../ui/PageHeader";

export function AdminPanel() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const users = useQuery({ queryKey: ["admin", "users"], queryFn: api.getAdminUsers });
  const impersonate = useMutation({
    mutationFn: (userId: string) => api.impersonateUser(userId),
    onSuccess: () => {
      notifications.show({ color: "green", message: "Now authenticated as selected user" });
      queryClient.invalidateQueries();
    },
    onError: notifyError,
  });

  if (users.isLoading) return <LoadingView />;
  if (users.error) return <ErrorView error={users.error} />;

  return (
    <Stack>
      <PageHeader
        title="Admin Panel"
        description="Manage users and authenticate as any registered user for moderation purposes."
      />
      <Paper className="glass-card" p="md" radius="xl">
        <Stack gap="md">
          <Text fw={800}>Registered Users</Text>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th>Characters</Table.Th>
                <Table.Th>Role</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {users.data?.users.map((user) => (
                <Table.Tr key={user.id}>
                  <Table.Td>
                    <Text fw={700}>{user.displayName ?? "No name"}</Text>
                    <Text size="xs" c="dimmed">
                      {user.subject}
                    </Text>
                  </Table.Td>
                  <Table.Td>{user.email ?? "-"}</Table.Td>
                  <Table.Td>
                    <Stack gap={4}>
                      {user.characters.length > 0 ? (
                        user.characters.map((char) => (
                          <Text key={char.id} size="sm">
                            {char.name} ({char.homeWorld})
                          </Text>
                        ))
                      ) : (
                        <Text size="sm" c="dimmed">
                          No characters
                        </Text>
                      )}
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={user.isAdmin ? "red" : "gray"}>
                      {user.isAdmin ? "Admin" : "User"}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Button
                      size="xs"
                      variant="light"
                      loading={impersonate.isPending}
                      onClick={() => impersonate.mutate(user.id)}
                    >
                      Authenticate as
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>
      </Paper>
    </Stack>
  );
}
