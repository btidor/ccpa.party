// @flow
import * as React from "react";

import Generic from "providers/generic";
import Slack from "providers/slack";

export interface View<M> {
  +slug: string;
  +displayName: string;
  +table: string;
  metadata(db: any): Promise<M>;
  render(item: { [key: string]: any }, metadata: M): React.Node;
}

export interface Provider {
  +slug: string;
  +displayName: string;
  +defaultView?: string;
  import(file: File): Promise<void>;
  views(): $ReadOnlyArray<View<any>>;
}

export const ProviderRegistry: $ReadOnlyArray<Provider> = [
  new Slack(),
  new Generic(),
];

const ProviderLookup: { [key: string]: Provider } = {};
ProviderRegistry.forEach(
  (provider) => (ProviderLookup[provider.slug] = provider)
);

export function getProvider(slug: string): Provider {
  const provider = ProviderLookup[slug];
  if (provider === undefined) {
    throw new Error(`No such provider: ${slug}`);
  }
  return provider;
}

export async function getProviderView(
  providerSlug: string,
  viewSlug: string
): Promise<[Provider, ?View<any>]> {
  const provider = getProvider(providerSlug);
  const view = (await provider.views()).find((v) => v.slug === viewSlug);
  return [provider, view];
}
