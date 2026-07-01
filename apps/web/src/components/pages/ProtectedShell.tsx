import { ActionIcon, Box, Group, Image, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useApiClient } from "../../api";
import { LoadingView } from "../ui/LoadingView";
import { LoginRequired } from "./LoginRequired";
import { BottomNav } from "../ui/BottomNav";
import { DashboardPage } from "./DashboardPage";
import { FlipsPage } from "./FlipsPage";
import { NewFlipPage } from "./NewFlipPage";
import { FlipDetailPage } from "./FlipDetailPage";
import { WatchlistPage } from "./WatchlistPage";
import { SettingsPage } from "./SettingsPage";
import { AdminPanel } from "./AdminPanel";

export function ProtectedShell() {
  const api = useApiClient();
  const navigate = useNavigate();
  const location = useLocation();
  const me = useQuery({ queryKey: ["me"], queryFn: api.getMe, retry: false });

  if (me.isLoading) return <LoadingView />;
  if (!me.isSuccess) return <LoginRequired />;

  const currentUserName =
    me.data.user.displayName ??
    me.data.user.email ??
    me.data.xivauthCharacters[0]?.name ??
    "Market tracker";

  const avatarUrl = me.data.xivauthCharacters[0]?.avatarUrl ?? null;

  async function handleLogout() {
    await api.logoutSession().catch(() => undefined);
    navigate("/", { replace: true });
  }

  return (
    <div className="app-shell">
      <div className="mobile-container">
        <Group justify="space-between" mb="lg" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            {avatarUrl ? <Image src={avatarUrl} w={40} h={40} radius="xl" /> : null}
            <Box>
              <Text size="xs" c="dimmed">
                XIV Flips
              </Text>
              <Text fw={700} truncate="end" maw={240}>
                {currentUserName}
              </Text>
            </Box>
          </Group>
          <ActionIcon variant="subtle" aria-label="Log out" onClick={handleLogout}>
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
          {me.data?.user.isAdmin ? <Route path="/admin" element={<AdminPanel />} /> : null}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
      <BottomNav />
    </div>
  );
}
