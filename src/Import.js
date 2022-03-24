// @flow
import { openDB } from "idb";
import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { unzip } from "unzipit";

import Navigation from "Navigation";
import { getProvider } from "provider";

import styles from "Import.module.css";

import type { DataFile } from "provider";

function Import(): React.Node {
  const params = useParams();
  const provider = getProvider(params.provider);
  const [status, setStatus] = React.useState("");

  async function importFile(event) {
    const files: Array<{|
      archive: string,
      path?: string,
      file: File | ArrayBuffer,
    |}> = [];
    for (let i = 0; i < event.target.files.length; i++) {
      const file = event.target.files.item(i);
      files.push({ archive: file.name, file });
    }
    if (files.length < 1) {
      return;
    }

    setStatus("Importing...");
    const start = Date.now();
    const db = await openDB("import", 1, {
      async upgrade(db) {
        const store = db.createObjectStore("files", {
          keyPath: ["archive", "path"],
        });
        store.createIndex("provider", "provider", { unique: false });
      },
    });
    for (const { archive, path, file } of files) {
      const zip = await unzip(file);
      for (const entry of (Object.values(zip.entries): any)) {
        if (entry.isDirectory) continue;
        const rpath = [path, entry.name].filter((x) => x).join("/");
        const data = await entry.arrayBuffer();
        if (entry.name.endsWith(".zip")) {
          files.push({ archive, path: rpath, file: data });
        } else {
          db.put(
            "files",
            ({
              archive,
              path: rpath,
              provider: provider.slug,
              data,
            }: DataFile)
          );
        }
      }
    }
    setStatus(
      <React.Fragment>
        <div>Import complete!</div>
        <Link to="../files">View results</Link>
      </React.Fragment>
    );
    console.warn(`Time: ${(Date.now() - start) / 1000}s`);
  }

  return (
    <React.Fragment>
      <Navigation provider={provider} />
      <main className={styles.import}>
        <div>Import data from {provider.displayName}...</div>
        <input
          type="file"
          multiple
          accept=".zip,application/zip"
          onChange={importFile}
        />
        <div>{status}</div>
      </main>
    </React.Fragment>
  );
}

export default Import;
