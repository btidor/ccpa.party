// @flow
import EmojiMap from "emoji-name-map";
import * as React from "react";

import styles from "providers/slack.module.css";

import type { Entry } from "parse";
import type { DataFile, Provider } from "provider";

class Slack implements Provider {
  slug: string = "slack";
  displayName: string = "Slack";

  activityLabels: { [string]: string } = {};
  settingLabels: { [string]: string } = {};

  parse(files: $ReadOnlyArray<DataFile>): $ReadOnlyArray<Entry> {
    return [];
  }
}

type MessageMetadata = {|
  channels: { [string]: { [string]: any } },
  users: { [string]: { [string]: any } },
|};

class MessageView {
  slug: string = "messages";
  displayName: string = "All Messages";

  async metadata(db: any): Promise<MessageMetadata> {
    const users = {};
    (await db.getAll("users")).forEach((u) => (users[u.id] = u));
    const channels = {};
    (await db.getAll("channels")).forEach((ch) => (channels[ch.id] = ch));
    return { channels, users };
  }

  render(
    _key: string,
    item: { [string]: any },
    metadata: MessageMetadata
  ): React.Node {
    let name = "unknown";
    let style = {};
    const user = metadata.users[item.user];
    if (!!user) {
      name = user.profile.display_name || user.profile.real_name;
      if (user.color) style = { color: `#${user.color}` };
    }
    let ch = "unknown";
    const channel = metadata.channels[item.channel];
    if (!!channel) {
      ch = channel.name;
    }
    let message = item.text;
    let messageClass;
    if (item.files || item.attachments) {
      message = (
        <React.Fragment>
          {message} <span className={styles.unknown}>attachment</span>
        </React.Fragment>
      );
    }
    if (item.subtype === "channel_join") {
      message = `joined #${ch}`;
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
        return [
          <span key={key} className={styles.internal}>
            @
            {metadata.users[element.user_id].display_name ||
              metadata.users[element.user_id].real_name}
          </span>,
        ];
      } else if (element.type === "channel") {
        return [
          <span key={key} className={styles.internal}>
            #{metadata.channels[element.channel_id].name}
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
    if (item.blocks) {
      message = item.blocks.flatMap((block) => {
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
          <span className={styles.channel}>#{ch}</span>
        </div>
        <div className={styles.message}>
          <span style={style} className={styles.username}>
            {name}
          </span>{" "}
          <span className={messageClass}>{message}</span>
        </div>
      </div>
    );
  }
}

class ChannelView {
  slug: string = "channels";
  displayName: string = "Channels";

  async metadata(db: any): Promise<void> {}

  render(key: string, item: { [string]: any }, metadata: void): React.Node {
    return (
      <span>
        #{item.name} ({item.id})
      </span>
    );
  }
}

class UserView {
  slug: string = "users";
  displayName: string = "Users";

  async metadata(db: any): Promise<void> {}

  render(key: string, item: { [string]: any }, metadata: void): React.Node {
    return (
      <span>
        {[]}
        {item.real_name} ({item.profile.display_name || item.name}, {item.id})
      </span>
    );
  }
}

class IntegrationLogView {
  slug: string = "integration_logs";
  displayName: string = "Integration Logs";

  async metadata(db: any): Promise<void> {}

  render(key: string, item: { [string]: any }, metadata: void): React.Node {
    return <span>{JSON.stringify(item)}</span>;
  }
}

export default Slack;
