import type { TimelineEntry } from "@src/database/types";
import Discord from "@src/renderers/discord";
import Google from "@src/renderers/google";
import Slack from "@src/renderers/slack";

export type RenderResult =
  | void
  | [JSX.Element, string | void]
  | [
      JSX.Element | void,
      string | void,
      { display: string; color?: string } | void,
    ];

export type Renderer = (
  entry: TimelineEntry<unknown>,
  metadata: ReadonlyMap<string, unknown>,
) => RenderResult;

export const RendererLookup: ReadonlyMap<string, Renderer> = new Map([
  ["discord", Discord as Renderer],
  ["google", Google as Renderer],
  ["slack", Slack as Renderer],
]);
