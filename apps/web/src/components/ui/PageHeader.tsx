import { Box, Group, Text, Title } from "@mantine/core";

export function PageHeader(props: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <Group justify="space-between" align="flex-start" wrap="nowrap" mb="md">
      <Group gap="sm" wrap="nowrap" align="flex-start">
        {props.icon}
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
      </Group>
      {props.action}
    </Group>
  );
}
