import { NativeSelect } from "@mantine/core";
import type { WorldDto } from "@xivflips/shared";

export function WorldSelect(props: {
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
