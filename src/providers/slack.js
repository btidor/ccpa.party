// @flow
import EmojiMap from "emoji-name-map";
import * as React from "react";

import { parseJSON } from "parse";

import styles from "providers/slack.module.css";

import type { Entry } from "parse";
import type { DataFile, Provider } from "provider";

class Slack implements Provider {
  slug: string = "slack";
  displayName: string = "Slack";

  activityLabels: { [string]: string } = {};
  settingLabels: { [string]: string } = {};

  parse(files: $ReadOnlyArray<DataFile>): $ReadOnlyArray<Entry> {
    const users = new Map();
    const channels = new Map();
    const messages = [];
    for (const file of files) {
      if (file.path === "users.json") {
        for (const user of parseJSON(file)) {
          users.set(user.id, user);
        }
      } else if (file.path === "channels.json") {
        for (const channel of parseJSON(file)) {
          channels.set(channel.id, channel);
        }
      } else if (file.path === "integration_logs.json") {
        // Skip
      } else {
        for (const message of parseJSON(file)) {
          messages.push({ message, file });
        }
      }
    }

    return messages.map(({ message, file }) => ({
      type: "activity",
      file,
      timestamp: parseInt(message.ts),
      label: this.renderMessage(
        message,
        file.path.split("/")[0],
        users,
        channels
      ),
      value: message,
    }));
  }

  renderMessage(
    message: any,
    channelName: string,
    users: Map<string, any>,
    channels: Map<string, any>
  ): React.Node {
    let name = "unknown";
    let style = {};
    const user = users.get(message.user);
    if (!!user) {
      name = user.profile.display_name || user.profile.real_name;
      if (user.color) style = { color: `#${user.color}` };
    }
    let text = message.text;
    let messageClass;
    if (message.files || message.attachments) {
      text = (
        <React.Fragment>
          {text} <span className={styles.unknown}>attachment</span>
        </React.Fragment>
      );
    }
    if (message.subtype === "channel_join") {
      text = `joined #${channelName}`;
      messageClass = styles.system;
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
        const user = users.get(element.user_id) || {};
        return [
          <span key={key} className={styles.internal}>
            @{user.display_name || user.real_name || "unknown"}
          </span>,
        ];
      } else if (element.type === "channel") {
        const channel = channels.get(element.channel_id) || {};
        return [
          <span key={key} className={styles.internal}>
            #{channel.name || "unknown"}
          </span>,
        ];
      } else if (element.type === "link") {
        return [
          <a href={element.url} key={key}>
            {element.url}
          </a>,
        ];
      } else {
        console.warn(element.type);
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
        <div className={styles.prefix}>
          <span className={styles.channel}>#{channelName}</span>
        </div>
        <div className={styles.message}>
          <span style={style} className={styles.username}>
            {name}
          </span>{" "}
          <span className={messageClass}>{text}</span>
        </div>
      </div>
    );
  }
}

export default Slack;
