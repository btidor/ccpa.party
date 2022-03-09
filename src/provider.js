// @flow
import * as React from "react";

import Slack from "providers/slack";

export interface Provider<M> {
  slug: string;
  displayName: string;
  import(file: File): Promise<void>;
  categories(db: any): Promise<$ReadOnlyArray<string>>;
  metadata(db: any): Promise<M>;
  render(item: { [key: string]: any }, metadata: M): React.Node;
}

export const ProviderRegistry: $ReadOnlyArray<Provider<any>> = [new Slack()];

const ProviderLookup: { [key: string]: Provider<any> } = {};
ProviderRegistry.forEach(
  (provider) => (ProviderLookup[provider.slug] = provider)
);

export function getProvider(slug: string): Provider<any> {
  const provider = ProviderLookup[slug];
  if (provider === undefined) {
    throw new Error(`No such provider: ${slug}`);
  }
  return provider;
}
