// @flow
import EmojiMap from "emoji-name-map";
import * as React from "react";

import { getSlugAndDayTime, parseJSON } from "common/parse";

import styles from "providers/slack.module.css";

import type { DataFile, Entry, TimelineEntry } from "common/database";
import type { Provider, TimelineCategory } from "common/provider";

class Slack implements Provider {
  slug: string = "slack";
  displayName: string = "Slack";
  color: string = "#4a154b";

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

  timelineCategories: $ReadOnlyArray<TimelineCategory> = [
    {
      char: "m",
      slug: "message",
      displayName: "Messages",
      defaultEnabled: true,
    },
    {
      char: "i",
      slug: "integration",
      displayName: "Integration Logs",
      defaultEnabled: false,
    },
  ];

  async parse(file: DataFile): Promise<$ReadOnlyArray<Entry>> {
    if (file.skipped) return [];
    if (file.path[1] === "users.json") {
      return [
        {
          type: "metadata",
          provider: file.provider,
          key: "users",
          value: parseJSON(file.data),
        },
      ];
    } else if (file.path[1] === "channels.json") {
      return [
        {
          type: "metadata",
          provider: file.provider,
          key: "channels",
          value: parseJSON(file.data),
        },
      ];
    } else if (file.path[1] === "integration_logs.json") {
      return parseJSON(file.data).map(
        (log) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "integration",
            ...getSlugAndDayTime(parseInt(log.date), log),
            context: null,
            value: log,
          }: TimelineEntry)
      );
    } else {
      return parseJSON(file.data).map(
        (message) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "message",
            ...getSlugAndDayTime(parseInt(message.ts), message),
            context: file.path[1],
            value: message,
          }: TimelineEntry)
      );
    }
  }

  render(
    entry: TimelineEntry,
    time: ?string,
    metadata: $ReadOnlyMap<string, any>
  ): React.Node {
    const message = entry.value;
    const users = metadata.get("users");
    const channels = metadata.get("channels");

    if (!users || !channels) throw new Error("Failed to load metadata");

    const channelName =
      entry.context || channels.find((x) => x.id === message.channel)?.name;
    let trailer = channelName && `#${channelName}`;

    let name = message.user_name || message.bot_id || "unknown";
    let style = {};
    const user = users.find((x) => x.id === (message.user || message.user_id));
    if (!!user) {
      name = user.profile.display_name || user.profile.real_name;
      if (user.color) style = { color: `#${user.color}` };
    }
    let text = message.text;
    if (message.files || message.attachments) {
      text = (
        <React.Fragment>
          {text} <span className={styles.unknown}>attachment</span>
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
        let node = <React.Fragment>{element.text}</React.Fragment>;
        if (element.style) {
          if (element.style.bold) node = <b>{node}</b>;
          if (element.style.italic) node = <i>{node}</i>;
          if (element.style.strike) node = <s>{node}</s>;
          if (element.style.code) node = <code>{node}</code>;
        }
        return [<React.Fragment key={key}>{node}</React.Fragment>];
      } else if (element.type === "emoji") {
        return [
          <React.Fragment key={key}>
            {EmojiMap.get(element.name) || `:${element.name}:`}
          </React.Fragment>,
        ];
      } else if (element.type === "user") {
        const user = users.find((x) => x.id === element.user_id) || {};
        return [
          <span key={key} className={styles.internal}>
            @{user.display_name || user.real_name || "unknown"}
          </span>,
        ];
      } else if (element.type === "channel") {
        const channel = channels.find((x) => x.id === element.channel_id) || {};
        return [
          <span key={key} className={styles.internal}>
            #{channel.name || "unknown"}
          </span>,
        ];
      } else if (element.type === "link") {
        return [
          <a href={element.url} key={key} target="_blank" rel="noreferrer">
            {element.url}
          </a>,
        ];
      } else {
        return [
          <span key={key} className={styles.unknown}>
            {element.type}
          </span>,
        ];
      }
    };
    if (message.blocks) {
      text = message.blocks.flatMap((block) => {
        key++;
        if (block.type !== "rich_text") {
          return (
            <span key={key} className={styles.unknown}>
              {block.type}
            </span>
          );
        } else {
          return block.elements.flatMap(handleElement);
        }
      });
    }
    return (
      <div className={styles.item}>
        <div className={styles.time}>{time}</div>
        <div className={styles.message}>
          <span style={style} className={styles.username}>
            {name}
          </span>
          {text} <span className={styles.trailer}>{trailer}</span>
        </div>
      </div>
    );
  }
}

export default Slack;
