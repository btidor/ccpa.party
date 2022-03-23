// @flow
import Facebook from "providers/facebook";
import Generic from "providers/generic";
import Slack from "providers/slack";

import type { Entry } from "parse";

export type DataFile = {|
  archive: string,
  path: string,
  provider: string,
  data: ArrayBuffer,
|};

export interface Provider {
  +slug: string;
  +displayName: string;
  +activityLabels: { [string]: string };
  +settingLabels: { [string]: string };
  parse(files: $ReadOnlyArray<DataFile>): $ReadOnlyArray<Entry>;
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
