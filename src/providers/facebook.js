// @flow
import { deleteDB, openDB } from "idb";
import * as React from "react";
import { unzip } from "unzipit";

import styles from "providers/facebook.module.css";

import type { Provider, View } from "provider";

class Facebook implements Provider {
  slug: string = "facebook";
  displayName: string = "Facebook";

  async import(file: File): Promise<void> {
    const zip = await unzip(file);
    const entries: $ReadOnlyArray<any> = Object.values(zip.entries).filter(
      (entry) => !(entry: any).isDirectory
    );

    const metadata = new Map<string, { [string]: any }>();
    const noData = [];
    const content = new Map<string, { [string]: any }>();
    const media = new Map<string, Blob>();
    const tables = new Map<string, { [string]: any }>();
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      if (entry.name.endsWith("/no-data.txt")) {
        const name = entry.name.slice(0, -12);
        noData.push(name);
      } else if (entry.name.startsWith("posts/media/")) {
        media.set(entry.name, await entry.blob());
      } else if (entry.name.startsWith("messages/stickers_used/")) {
        media.set(entry.name, await entry.blob());
      } else if (
        entry.name.startsWith("messages/") &&
        (entry.name.includes("/gifs/") ||
          entry.name.includes("/photos/") ||
          entry.name.includes("/videos/") ||
          entry.name.includes("/files/"))
      ) {
        media.set(entry.name, await entry.blob());
      } else if (
        entry.name.startsWith("messages/") &&
        entry.name.split("/").length > 2
      ) {
        content.set(entry.name, await entry.json());
      } else if (entry.name.startsWith("posts/")) {
        content.set(entry.name, await entry.json());
      } else if (entry.name.endsWith(".json")) {
        const data = await entry.json();
        if (Object.keys(data).length !== 1) {
          console.error("JSON:UNKNOWN", entry.name, data);
        } else {
          const key = Object.keys(data)[0];
          if (Object.keys(tables).includes(key)) {
            console.error("JSON:DUPLICATE_KEY", entry.name, data);
          }
          if (Array.isArray(data[key])) {
            if (data[key].length > 0 && typeof data[key][0] === "string") {
              metadata.set(key, data[key]);
            } else {
              tables.set(key, data[key]);
            }
          } else {
            metadata.set(key, data[key]);
          }
        }
      } else {
        console.error("UNKNOWN", entry.name);
      }
    }

    await deleteDB(this.slug);
    const db = await openDB(this.slug, 1, {
      async upgrade(db) {
        db.createObjectStore("_metadata");
        db.createObjectStore("_content");
        db.createObjectStore("_media");
        for (const [table] of tables) {
          db.createObjectStore(table, {
            autoIncrement: true,
          });
        }
      },
    });

    for (const [key, value] of metadata) {
      await db.put("_metadata", value, key);
    }
    await db.put("_metadata", noData, "no_data");

    for (const [key, value] of content) {
      await db.put("_content", value, key);
    }

    for (const [key, value] of media) {
      await db.put("_media", value, key);
    }

    for (const [key, values] of tables) {
      const tx = db.transaction(key, "readwrite");
      await Promise.all(values.map((value) => tx.store.put(value)));
      await tx.done;
    }
  }

  views(db: any): $ReadOnlyArray<View<any>> {
    if (!db) return [];
    return [...db.objectStoreNames].map((slug) => new GenericView(slug));
  }
}

class GenericView implements View<void> {
  slug: string;
  displayName: string;

  constructor(slug: string) {
    this.slug = slug;
    this.displayName = slug;
  }

  async metadata(db: any): Promise<void> {}

  render(
    key: string,
    item: { [key: string]: any },
    metadata: void
  ): React.Node {
    let content;
    if (typeof key === "string") {
      content = key;
    } else if (typeof item.name === "string" && item.name !== "") {
      content = item.name;
    } else {
      content = JSON.stringify(item);
    }
    return <span className={styles.item}>{content}</span>;
  }
}

export default Facebook;
