// @flow
import { openDB } from "idb";
import * as React from "react";
import { unzip } from "unzipit";

import type { Provider, View } from "provider";

class Generic implements Provider {
  slug: string = "generic";
  displayName: string = "Generic";

  async import(file: File): Promise<void> {
    const zip = await unzip(file);
    const entries = Object.values(zip.entries).filter(
      (entry) => !(entry: any).isDirectory
    );
    const db = await openDB("data", 1, {
      async upgrade(db) {
        entries.forEach((entry) =>
          db.createObjectStore("generic.files", {
            keyPath: "filename",
          })
        );
      },
    });

    for (let i = 0; i < entries.length; i++) {
      const filename = (entries[i]: any).name;
      const data = await (entries[i]: any).text();
      await db.put("generic.files", { filename, data });
    }
  }

  views(): $ReadOnlyArray<View<any>> {
    return [new FileView()];
  }
}

class FileView implements View<void> {
  slug: string = "files";
  displayName: string = "Files";
  table: string = "generic.files";

  async metadata(db: any): Promise<void> {}

  render(item: { [key: string]: any }, metadata: void): React.Node {
    return <span>{item.filename}</span>;
  }
}

export default Generic;
