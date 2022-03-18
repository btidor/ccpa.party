// @flow
import { openDB } from "idb";
import * as React from "react";

import Facebook from "providers/facebook";
import Generic from "providers/generic";
import Slack from "providers/slack";

export interface View<M> {
  +slug: string;
  +displayName: string;
  metadata(db: any): Promise<M>;
  render(key: string, value: { [string]: any }, metadata: M): React.Node;
}

export interface ActivityEvent<M> {
  timestamp: number;
  label: string;
  data: { [string]: any };

  view: View<M>;
  metadata: M;
}

export interface Provider {
  +slug: string;
  +displayName: string;
  +defaultView?: string;
  import(file: File): Promise<void>;
  views(db: any): $ReadOnlyArray<View<any>>;
  activityEvents(db: any): Promise<Array<ActivityEvent<any>>>;
}

export const ProviderRegistry: $ReadOnlyArray<Provider> = [
  new Facebook(),
  new Slack(),
  new Generic(),
];

const ProviderLookup = new Map<string, Provider>();
ProviderRegistry.forEach((provider) =>
  ProviderLookup.set(provider.slug, provider)
);

export function getProvider(slug: string): Provider {
  const provider = ProviderLookup.get(slug);
  if (provider === undefined) {
    throw new Error(`No such provider: ${slug}`);
  }
  return provider;
}

export async function getDbProviderView(
  providerSlug: string,
  viewSlug: string
): Promise<[any, Provider, ?View<any>]> {
  const provider = getProvider(providerSlug);
  const db = await openDB(provider.slug);
  const view = provider.views(db).find((v) => v.slug === viewSlug);
  return [db, provider, view];
}
