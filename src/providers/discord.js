// @flow
import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { getSlugAndDay, parseCSV, parseJSON, smartDecode } from "database";

import styles from "providers/discord.module.css";

import type { DataFile, Entry, TimelineEntry } from "database";
import type { Provider, TimelineCategory } from "provider";

class Discord implements Provider {
  slug: string = "discord";
  displayName: string = "Discord";
  color: string = "#5865f2";

  requestLink: {| href: string, text: string |} = {
    text: "Discord",
    href: "https://discord.com/app",
  };
  waitTime: string = "about a week";
  instructions: $ReadOnlyArray<string> = [
    "open User Settings",
    "Privacy & Safety tab",
    "scroll down",
  ];
  privacyPolicy: string =
    "https://discord.com/privacy#information-for-california-users";
  timelineCategories: $ReadOnlyArray<TimelineCategory> = [
    {
      char: "a",
      slug: "activity",
      displayName: "Activity",
      defaultEnabled: false,
    },
    {
      char: "m",
      slug: "message",
      displayName: "Sent Messages",
      defaultEnabled: true,
    },
  ];

  async parse(file: DataFile): Promise<$ReadOnlyArray<Entry>> {
    if (file.skipped) return [];
    if (file.path.slice(1).join("/") === "servers/index.json") {
      return [
        {
          type: "metadata",
          provider: file.provider,
          key: "servers",
          value: parseJSON(file.data),
        },
      ];
    } else if (file.path.slice(-1)[0] === "channel.json") {
      const value = parseJSON(file.data);
      return [
        {
          type: "metadata",
          provider: file.provider,
          key: `channel/${value.id}`,
          value,
        },
      ];
    } else if (file.path.slice(-1)[0] === "messages.csv") {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "message",
            ...getSlugAndDay(new Date(row.Timestamp).getTime() / 1000, row),
            context: file.path[2].slice(1),
            value: row,
          }: TimelineEntry)
      );
    } else if (file.path[1] === "activity") {
      return smartDecode(file.data)
        .trim()
        .split("\n")
        .map((line) => {
          const parsed = parseJSON(line);
          return ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "activity",
            ...getSlugAndDay(
              // Trim quotes from timestamp
              new Date(parsed.timestamp.slice(1, -1)).getTime() / 1000,
              parsed
            ),
            context: null,
            value: parsed,
          }: TimelineEntry);
        });
    }
    return [];
  }

  render(
    entry: TimelineEntry,
    metadata: $ReadOnlyMap<string, any>
  ): React.Node {
    if (entry.category === "message") {
      let markdown = entry.value.Contents;
      markdown = markdown.replaceAll(
        /<(@!?|@&|#)([0-9]+)>/g,
        (original, type, snowflake) => {
          if (type === "@" || type === "@!") {
            // The users list isn't part of the export
            return "@unknown";
          } else if (type === "@&") {
            // The roles list isn't part of the export
            return "&unknown";
          } else if (type === "#") {
            const channel = metadata.get(`channel/${snowflake}`);
            if (channel) return `#${channel.name}`;
          }
          return original;
        }
      );

      return (
        <React.Fragment>
          <span className={styles.channel}>
            {(() => {
              const channel = metadata.get(`channel/${entry.context}`);
              if (!channel) return "#unknown";
              if ([1, 3].includes(channel.type)) return "DM";
              if ([0, 2].includes(channel.type))
                return `${channel.guild?.name} #${channel.name}`;
              if ([10, 11, 12].includes(channel.type))
                return `Thread: ${channel.name}`;
              return "#unknown";
            })()}
          </span>
          <ReactMarkdown
            className={styles.markdown}
            remarkPlugins={[remarkGfm]}
            linkTarget="_blank"
          >
            {markdown}
          </ReactMarkdown>
          {entry.value.Attachments?.trim() && (
            <div className={styles.pill}>Attachment</div>
          )}
        </React.Fragment>
      );
    } else {
      const channel =
        metadata.get(`channel/${entry.value.channel_id}`) ||
        metadata.get(`channel/${entry.value.channel}`);
      const server = metadata.get(`servers`)?.[entry.value.guild_id];
      return (
        <span className={styles.channel}>
          {entry.value.event_type} {entry.value.type || entry.value.name}{" "}
          {entry.value.source && ` from ${entry.value.source}`}
          {channel
            ? ` in ${channel.guild?.name}#${channel.name}`
            : server && ` in ${server}`}
        </span>
      );
    }
  }
}

export default Discord;
