// @flow
import * as React from "react";
import { useParams } from "react-router-dom";
import { unzip } from "unzipit";

import { InternalLink } from "components/Links";
import { openFiles } from "parse";
import { getProvider } from "provider";

import styles from "Import.module.css";

import type { DataFile } from "provider";

function Import(): React.Node {
  const params = useParams();
  const provider = getProvider(params.provider);
  const [status, setStatus] = React.useState("");

  async function importFiles(event) {
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
    const db = await openFiles();
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
        <div className={styles.message}>Import complete!</div>{" "}
        <InternalLink to={`/${provider.slug}/files`}>View results</InternalLink>
      </React.Fragment>
    );
    console.warn(`Time: ${(Date.now() - start) / 1000}s`);
  }

  return (
    <div className={styles.import}>
      <div>Import from {provider.displayName}</div>
      <input
        type="file"
        multiple
        accept=".zip,application/zip"
        onChange={importFiles}
      />
      <div>{status}</div>
    </div>
  );
}

export default Import;
