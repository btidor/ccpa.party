// @flow
import * as React from "react";

import Slack from "providers/slack";

export interface View<M> {
  slug: string;
  displayName: string;
  table: string;
  metadata(db: any): Promise<M>;
  render(item: { [key: string]: any }, metadata: M): React.Node;
}

export interface Provider {
  slug: string;
  displayName: string;
  import(file: File): Promise<void>;
  views(db: any): $ReadOnlyArray<View<any>>;
}

export const ProviderRegistry: $ReadOnlyArray<Provider> = [new Slack()];

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
): Promise<[Provider, View<any>]> {
  const provider = getProvider(providerSlug);
  const view = (await provider.views()).find((v) => v.slug === viewSlug);
  if (view === undefined) {
    throw new Error(`No such view: ${viewSlug}`);
  }
  return [provider, view];
}
