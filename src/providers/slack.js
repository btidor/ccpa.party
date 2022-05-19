// @flow
import EmojiMap from "emoji-name-map";
import * as React from "react";

import { getSlugAndDayTime, parseJSON } from "common/parse";
import { Highlight, Pill } from "components/Record";

import type { DataFile, TimelineEntry } from "common/database";
import type { Provider, TimelineCategory } from "common/provider";

type CategoryKey = "message" | "integration";

class Slack implements Provider<CategoryKey> {
  slug: string = "slack";
  displayName: string = "Slack";

  brandColor: string = "#4a154b";
  neonColor: string = "#f0f";
  neonColorHDR: string = "color(rec2020 0.92827 0.25757 1.11361)";

  requestLink: {| href: string, text: string |} = {
    text: "Export Workspace Data",
    href: "https://slack.com/help/articles/201658943-Export-your-workspace-data",
  };
  waitTime: string = "a few days";
  instructions: $ReadOnlyArray<string> = [];
  singleFile: boolean = true;
  privacyPolicy: string =
    "https://slack.com/trust/privacy/privacy-policy#california-rights";
  // Also: https://slack.com/trust/compliance/ccpa-faq

  metadataFiles: $ReadOnlyArray<string | RegExp> = [
    "channels.json",
    "users.json",
  ];

  timelineCategories: $ReadOnlyMap<CategoryKey, TimelineCategory> = new Map([
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

  async parse(
    file: DataFile,
    metadata: Map<string, any>
  ): Promise<$ReadOnlyArray<TimelineEntry<CategoryKey>>> {
    if (file.path[1] === "users.json") {
      metadata.set("users", parseJSON(file.data));
      return [];
    } else if (file.path[1] === "channels.json") {
      metadata.set("channels", parseJSON(file.data));
      return [];
    } else if (file.path[1] === "integration_logs.json") {
      return parseJSON(file.data).map(
        (log) =>
          ({
            file: file.path,
            category: "integration",
            ...getSlugAndDayTime(parseInt(log.date), log),
            context: null,
            value: log,
          }: TimelineEntry<CategoryKey>)
      );
    } else {
      return parseJSON(file.data).map(
        (message) =>
          ({
            file: file.path,
            category: "message",
            ...getSlugAndDayTime(parseInt(message.ts), message),
            context: null,
            value: message,
          }: TimelineEntry<CategoryKey>)
      );
    }
  }

  render: (
    TimelineEntry<CategoryKey>,
    $ReadOnlyMap<string, any>
  ) => [?React.Node, ?string, ?{| display: string, color: ?string |}] = (
    entry,
    metadata
  ) => {
    const message = entry.value;
    const users = metadata.get("users");
    const channels = metadata.get("channels");

    if (!users || !channels) throw new Error("Failed to load metadata");

    const channelName =
      entry.category === "message"
        ? entry.file[1]
        : channels.find((x) => x.id === message.channel)?.name;
    let trailer = channelName && `#${channelName}`;

    const user = users.find((x) => x.id === (message.user || message.user_id));
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
    const handleElement = (element) => {
      key++;
      if (element.type === "rich_text_section") {
        return element.elements.flatMap(handleElement);
      } else if (element.type === "rich_text_list") {
        return (
          <ul key={key}>
            {element.elements.map((subelement) => (
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
        const user = users.find((x) => x.id === element.user_id) || {};
        return [
          <Highlight>
            @{user.display_name || user.real_name || "unknown"}
          </Highlight>,
        ];
      } else if (element.type === "channel") {
        const channel = channels.find((x) => x.id === element.channel_id) || {};
        return [<Highlight>#{channel.name || "unknown"}</Highlight>];
      } else if (element.type === "link") {
        return [
          <a href={element.url} key={key} target="_blank" rel="noreferrer">
            {element.text || element.url}
          </a>,
        ];
      } else {
        return [<Pill>{element.type}</Pill>];
      }
    };
    if (message.blocks) {
      text = message.blocks.flatMap((block) => {
        key++;
        if (block.type !== "rich_text") {
          return <Pill>{block.type}</Pill>;
        } else {
          return block.elements.flatMap(handleElement);
        }
      });
    }

    return [text, trailer, username];
  };
}

export default Slack;
