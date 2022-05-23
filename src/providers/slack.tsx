import EmojiMap from "emoji-name-map";
import { DateTime } from "luxon";
import { Minimatch } from "minimatch";
import React from "react";

import type { DataFile, TimelineEntry } from "@src/common/database";
import {
  MetadataParser,
  TimelineParser,
  parseByStages,
} from "@src/common/parse";
import type { Provider, TimelineCategory } from "@src/common/provider";
import { Highlight, Pill } from "@src/components/Record";

type CategoryKey = "message" | "integration";

class Slack implements Provider<CategoryKey> {
  slug: string = "slack";
  displayName: string = "Slack";

  brandColor: string = "#4a154b";
  neonColor: string = "#f0f";
  neonColorHDR: string = "color(rec2020 0.92827 0.25757 1.11361)";

  requestLink: { href: string; text: string } = {
    text: "Export Workspace Data",
    href: "https://slack.com/help/articles/201658943-Export-your-workspace-data",
  };
  waitTime: string = "a few days";
  instructions: ReadonlyArray<string> = [];
  singleFile: boolean = true;
  fileName: string = "zip file";
  privacyPolicy: string =
    "https://slack.com/trust/privacy/privacy-policy#california-rights";
  // Also: https://slack.com/trust/compliance/ccpa-faq

  timelineCategories: ReadonlyMap<CategoryKey, TimelineCategory> = new Map([
    [
      "message",
      {
        char: "m",
        icon: "",
        displayName: "Messages",
        defaultEnabled: true,
      },
    ],
    [
      "integration",
      {
        char: "i",
        icon: "",
        displayName: "Integration Logs",
        defaultEnabled: false,
      },
    ],
  ]);

  metadataParsers: ReadonlyArray<MetadataParser> = [
    {
      glob: new Minimatch("users.json"),
      parse: (item) => [`user.${item.id}`, item],
    },
    {
      glob: new Minimatch("channels.json"),
      parse: (item) => [`channel.${item.id}`, item],
    },
  ];

  timelineParsers: ReadonlyArray<TimelineParser<CategoryKey>> = [
    {
      glob: new Minimatch("*/*.json"),
      parse: (item) => [
        "message",
        DateTime.fromSeconds(parseInt(item.ts)),
        null,
      ],
    },
    {
      glob: new Minimatch("integration_logs.json"),
      parse: (item) => [
        "integration",
        DateTime.fromSeconds(parseInt(item.date)),
        null,
      ],
    },
  ];

  async parse(
    file: DataFile,
    metadata: Map<string, any>
  ): Promise<ReadonlyArray<TimelineEntry<CategoryKey>>> {
    return await parseByStages(
      file,
      metadata,
      this.timelineParsers,
      this.metadataParsers
    );
  }

  render = (
    entry: TimelineEntry<CategoryKey>,
    metadata: ReadonlyMap<string, any>
  ): [
    JSX.Element | void,
    string | void,
    { display: string; color?: string } | void
  ] => {
    console.warn(metadata);
    const message = entry.value;
    const channelName =
      entry.category === "message"
        ? entry.file[1]
        : metadata.get(`channel.${message.channel}`)?.name;
    let trailer = channelName && `#${channelName}`;

    const user = metadata.get(`user.${message.user || message.user_id}`);
    const username = {
      display: user
        ? user.profile.display_name || user.profile.real_name
        : message.user_name || message.bot_id || "unknown",
      color: user?.color && `#${user.color}`,
    };
    let text = message.text ? <span>{message.text}</span> : undefined;
    if (message.files || message.attachments) {
      text = (
        <React.Fragment>
          {text}
          <Pill>Attachment</Pill>
        </React.Fragment>
      );
    }
    if (message.subtype === "channel_join") {
      text = undefined;
      trailer = `joined #${channelName}`;
    }
    if (entry.category === "integration") {
      let verb = message.change_type;
      if (verb === "wildcard_resource_grant_created") verb = "created";
      trailer = `${verb} integration ${
        message.app_type || message.service_type
      }`;
      if (channelName) trailer += ` in #${channelName}`;
    }
    let key = 0;
    const handleElement = (element: any) => {
      key++;
      if (element.type === "rich_text_section") {
        return element.elements.flatMap(handleElement);
      } else if (element.type === "rich_text_list") {
        return (
          <ul key={key}>
            {element.elements.map((subelement: any) => (
              <li key={key++}>{handleElement(subelement)}</li>
            ))}
          </ul>
        );
      } else if (element.type === "rich_text_quote") {
        return (
          <blockquote key={key}>
            {element.elements.flatMap(handleElement)}
          </blockquote>
        );
      } else if (element.type === "rich_text_preformatted") {
        return <pre key={key}>{element.elements.flatMap(handleElement)}</pre>;
      } else if (element.type === "text") {
        let node = <span>{element.text}</span>;
        if (element.style) {
          if (element.style.bold) node = <b>{node}</b>;
          if (element.style.italic) node = <i>{node}</i>;
          if (element.style.strike) node = <s>{node}</s>;
          if (element.style.code) node = <code>{node}</code>;
        }
        return [<span key={key}>{node}</span>];
      } else if (element.type === "emoji") {
        return [
          <span key={key}>
            {EmojiMap.get(element.name) || `:${element.name}:`}
          </span>,
        ];
      } else if (element.type === "user") {
        const user = metadata.get(`user.${element.user_id}`);
        return [
          <Highlight key={key}>
            @
            {user?.profile.display_name || user?.profile.real_name || "unknown"}
          </Highlight>,
        ];
      } else if (element.type === "channel") {
        const channel = metadata.get(`channel.${element.channel_id}`);
        return [<Highlight key={key}>#{channel?.name || "unknown"}</Highlight>];
      } else if (element.type === "link") {
        return [
          <a href={element.url} key={key} target="_blank" rel="noreferrer">
            {element.text || element.url}
          </a>,
        ];
      } else {
        return [<Pill key={key}>{element.type}</Pill>];
      }
    };
    if (message.blocks) {
      text = message.blocks.flatMap((block: any) => {
        key++;
        if (block.type !== "rich_text") {
          return <Pill key={key}>{block.type}</Pill>;
        } else {
          return block.elements.flatMap(handleElement);
        }
      });
    }

    return [text, trailer, username];
  };
}

export default Slack;
