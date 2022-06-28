import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { TimelineEntry } from "@src/common/database";
import type { RenderResult } from "@src/common/renderer";
import { Pill } from "@src/components/Record";
import type { CategoryKey } from "@src/providers/discord";

export default function render(
  entry: TimelineEntry<CategoryKey>,
  metadata: ReadonlyMap<string, unknown>
): RenderResult {
  let body, trailer;
  if (entry.category === "activity") {
    const channel = metadata.get(
      `channel_meta.${entry.value.channel_id || entry.value.channel}`
    ) as { name: string };
    const server = metadata.get(
      `server.${entry.value.guild_id || entry.value.server}`
    );

    body = (entry.value.event_type as string)
      .replace(/_/g, " ")
      .replace(/\w\S*/g, (w) => " " + w[0].toUpperCase() + w.slice(1));
    trailer = (entry.value.type ||
      entry.value.name ||
      (channel?.name && `#${channel?.name} ${server ? `(${server})` : ""}`) ||
      (server && `in ${server}`) ||
      (entry.value.ip && `from ${entry.value.ip}`)) as string | void;
  } else if (entry.category === "message") {
    body = (entry.value.Contents as string).replaceAll(
      /<(@!?|@&|#)([0-9]+)>/g,
      (original, type, snowflake) => {
        if (type === "@" || type === "@!") {
          // The users list isn't part of the export
          return "`@unknown`";
        } else if (type === "@&") {
          // The roles list isn't part of the export
          return "`&unknown`";
        } else if (type === "#") {
          const channel = metadata.get(`channel.${snowflake}`) as string;
          return `\`${
            channel === undefined
              ? "#unknown"
              : channel.includes(" ")
              ? channel
              : `#${channel}`
          }\``;
        }
        return original;
      }
    );
    body = (
      <ReactMarkdown remarkPlugins={[remarkGfm]} linkTarget="_blank">
        {body}
      </ReactMarkdown>
    );
    if (entry.value.Attachments)
      body = (
        <React.Fragment>
          {body}
          <Pill>Attachment</Pill>
        </React.Fragment>
      );

    const channel = metadata.get(`channel_meta.${entry.file[2].slice(1)}`) as {
      name: string;
      type: number;
      guild: { name: string };
    };
    const fallback = metadata.get(
      `channel.${entry.file[2].slice(1)}`
    ) as string;
    if (channel && [0, 2].includes(channel.type))
      trailer = `in #${channel.name} (${channel.guild.name})`;
    else if (channel && [10, 11, 12].includes(channel.type))
      trailer = `in thread "${channel.name}" (${channel.guild.name})`;
    else if (fallback) trailer = `in ${fallback.toLowerCase()}`;
    else trailer = "in unknown channel";
  } else {
    throw new Error("Unknown category: " + entry.category);
  }
  return [body as JSX.Element, trailer];
}
