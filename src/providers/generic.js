// @flow
import { deleteDB, openDB } from "idb";
import * as React from "react";
import { unzip } from "unzipit";

import type { Provider, View } from "provider";

class Generic implements Provider {
  slug: string = "generic";
  displayName: string = "Generic";

  async import(file: File): Promise<void> {
    const zip = await unzip(file);
    const entries: $ReadOnlyArray<any> = Object.values(zip.entries).filter(
      (entry) => !(entry: any).isDirectory
    );
    await deleteDB(this.slug);
    const db = await openDB(this.slug, 1, {
      async upgrade(db) {
        entries.forEach((entry) => db.createObjectStore("files"));
      },
    });

    for (const entry of entries) {
      let data;
      if (entry.name.endsWith(".json")) {
        data = await entry.text();
      } else if (entry.name.endsWith(".txt")) {
        data = await entry.text();
      } else {
        data = await entry.blob();
      }
      await db.put("files", data, entry.name);
    }
  }

  views(): $ReadOnlyArray<View<any>> {
    return [new FileView()];
  }
}

class FileView implements View<void> {
  slug: string = "files";
  displayName: string = "Files";

  async metadata(db: any): Promise<void> {}

  render(key: string, item: { [string]: any }, metadata: void): React.Node {
    return <span>{key}</span>;
  }
}

export default Generic;
