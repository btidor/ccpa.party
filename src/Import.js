// @flow
import * as React from "react";
import { unzip } from "unzipit";

import { InternalLink } from "components/Links";
import { Database } from "database";

import styles from "Import.module.css";

import type { DataFile } from "database";
import type { Provider } from "provider";
import { ShieldLockIcon } from "@primer/octicons-react";

type Props = {| +provider: Provider |};

function Import(props: Props): React.Node {
  const { provider } = props;
  const [status, setStatus] = React.useState("");

  async function importFiles(event) {
    const files: Array<{|
      path: $ReadOnlyArray<string>,
      file: File | ArrayBuffer,
      zip?: any,
    |}> = [];
    for (let i = 0; i < event.target.files.length; i++) {
      const file = event.target.files.item(i);
      files.push({ path: [file.name], file });
    }
    if (files.length < 1) {
      return;
    }

    setStatus("Importing...");
    const start = Date.now();
    const db = new Database();

    let total = 0;
    for (const file of files) {
      file.zip = await unzip(file.file);
      total += Object.keys(file.zip.entries).length;
    }
    const fmtTotal = total.toLocaleString("en-US");

    let processed = 0;
    for (const { path, zip } of files) {
      for (const entry of (Object.values(zip?.entries || []): any)) {
        if (processed % 23 === 0) {
          // Surprisingly, toLocaleString is showing up in profiling...
          setStatus(
            `Importing... (${processed.toLocaleString("en-US")} of ${fmtTotal})`
          );
        }
        processed++;
        if (entry.isDirectory) continue;
        const data = await entry.arrayBuffer();
        const subpath = [...path, ...entry.name.split("/").filter((x) => x)];
        if (entry.name.endsWith(".zip")) {
          files.push({ path: subpath, file: data });
        } else {
          const dataFile = ({
            provider: provider.slug,
            path: subpath,
            data,
          }: DataFile);
          await db.putFile(dataFile);

          const parsed = await provider.parse(dataFile);
          for (const entry of parsed) {
            if (entry.type === "metadata") await db.putMetadata(entry);
            else if (entry.type === "timeline")
              await db.putTimelineEntry(entry);
          }
        }
      }
    }
    setStatus(
      <React.Fragment>
        <div className={styles.message}>
          Import complete! (
          {((Date.now() - start) / 1000).toLocaleString("en-US", {
            maximumSignificantDigits: 2,
          })}
          s)
        </div>{" "}
        <InternalLink to={`/${provider.slug}/timeline`}>
          View results
        </InternalLink>
      </React.Fragment>
    );
  }

  return (
    <div className={styles.import}>
      <h2>Import from {provider.displayName}</h2>
      <input
        type="file"
        multiple
        accept=".zip,application/zip"
        onChange={importFiles}
      />
      <div className={styles.shield}>
        <ShieldLockIcon /> Data is processed locally and never leaves your
        computer
      </div>
      <div>{status}</div>
    </div>
  );
}

export default Import;
