export type PlaygroundProvider = {
  id: string;
  name: string;
  provider_type: string;
  enabled?: boolean;
};

/** Return a stable provider choice without clobbering a valid user selection. */
export function selectPlaygroundProviderId(
  providers: PlaygroundProvider[],
  current: string
): string {
  const selectable = providers.filter(
    (provider) =>
      provider.enabled !== false &&
      Boolean(provider.id?.trim()) &&
      Boolean(provider.name?.trim()) &&
      Boolean(provider.provider_type?.trim())
  );
  if (current && selectable.some((provider) => provider.id === current)) return current;
  return selectable[0]?.id ?? "";
}
