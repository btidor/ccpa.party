// @flow
import EmojiMap from "emoji-name-map";
import { openDB } from "idb";
import * as React from "react";
import { unzip } from "unzipit";

import styles from "providers/slack.module.css";

import type { Provider, View } from "provider";

class Slack implements Provider {
  slug: string = "slack";
  displayName: string = "Slack";

  async import(file: File): Promise<void> {
    const zip = await unzip(file);
    const db = await openDB("data", 1, {
      async upgrade(db) {
        const channels = await db.createObjectStore("slack.channels", {
          keyPath: "id",
        });
        channels.createIndex("name", "name", { unique: true });

        db.createObjectStore("slack.integration_logs", {
          keyPath: "_id",
          autoIncrement: true,
        });
        db.createObjectStore("slack.messages", { keyPath: ["channel", "ts"] });
        db.createObjectStore("slack.users", { keyPath: "id" });
      },
    });

    const channels = await zip.entries["channels.json"].json();
    const tx1 = db.transaction("slack.channels", "readwrite");
    for (const channel of channels) {
      await tx1.store.put(channel);
    }
    await tx1.done;

    const integrationLogs = await zip.entries["integration_logs.json"].json();
    const tx2 = db.transaction("slack.integration_logs", "readwrite");
    for (const log of integrationLogs) {
      await tx2.store.put(log);
    }
    await tx2.done;

    const users = await zip.entries["users.json"].json();
    const tx3 = db.transaction("slack.users", "readwrite");
    for (const user of users) {
      await tx3.store.put(user);
    }
    await tx3.done;

    const files = Object.entries(zip.entries).filter(([name, entry]) => {
      if (
        ["channels.json", "integration_logs.json", "users.json"].includes(name)
      )
        return false;
      if (!entry) return false;
      if (entry.isDirectory) return false;
      return true;
    });
    for (let i = 0; i < files.length; i += 25) {
      const data = await Promise.all(
        files.slice(i, i + 25).map(async ([name, entry]) => {
          let aentry: any = entry;
          return [
            await db.getFromIndex("slack.channels", "name", name.split("/")[0]),
            await aentry.json(),
          ];
        })
      );
      const tx = db.transaction("slack.messages", "readwrite");
      for (const [channel, messages] of data) {
        for (const message of messages) {
          message.channel = channel.id;
          await tx.store.put(message);
        }
      }
      await tx.done;
    }
  }

  views(db: any): $ReadOnlyArray<View<any>> {
    return [
      new ChannelView(),
      new UserView(),
      new IntegrationLogView(),
      new MessageView(),
    ];
  }
}

type MessageMetadata = {|
  channels: { [key: string]: { [key: string]: any } },
  users: { [key: string]: { [key: string]: any } },
|};

class MessageView implements View<MessageMetadata> {
  slug: string = "messages";
  displayName: string = "All Messages";
  table: string = "slack.messages";

  async metadata(db: any): Promise<MessageMetadata> {
    const users = {};
    (await db.getAll("slack.users")).forEach((u) => (users[u.id] = u));
    const channels = {};
    (await db.getAll("slack.channels")).forEach((ch) => (channels[ch.id] = ch));
    return { channels, users };
  }

  render(item: { [key: string]: any }, metadata: MessageMetadata): React.Node {
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

class ChannelView implements View<void> {
  slug: string = "channels";
  displayName: string = "Channels";
  table: string = "slack.channels";

  async metadata(db: any): Promise<void> {}

  render(item: { [key: string]: any }, metadata: void): React.Node {
    return (
      <span>
        #{item.name} ({item.id})
      </span>
    );
  }
}

class UserView implements View<void> {
  slug: string = "users";
  displayName: string = "Users";
  table: string = "slack.users";

  async metadata(db: any): Promise<void> {}

  render(item: { [key: string]: any }, metadata: void): React.Node {
    return (
      <span>
        {[]}
        {item.real_name} ({item.profile.display_name || item.name}, {item.id})
      </span>
    );
  }
}

class IntegrationLogView implements View<void> {
  slug: string = "integration_logs";
  displayName: string = "Integration Logs";
  table: string = "slack.integration_logs";

  async metadata(db: any): Promise<void> {}

  render(item: { [key: string]: any }, metadata: void): React.Node {
    return <span>{JSON.stringify(item)}</span>;
  }
}

export default Slack;
