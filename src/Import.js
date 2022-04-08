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
      archive: string,
      path?: string,
      file: File | ArrayBuffer,
      zip?: any,
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
    const db = new Database();

    let total = 0;
    for (const file of files) {
      file.zip = await unzip(file.file);
      total += Object.keys(file.zip.entries).length;
    }
    const fmtTotal = total.toLocaleString("en-US");

    let processed = 0;
    for (const { archive, path, zip } of files) {
      for (const entry of (Object.values(zip?.entries || []): any)) {
        if (processed % 23 === 0) {
          // Surprisingly, toLocaleString is showing up in profiling...
          setStatus(
            `Importing... (${processed.toLocaleString("en-US")} of ${fmtTotal})`
          );
        }
        processed++;
        if (entry.isDirectory) continue;
        const rpath = [path, entry.name].filter((x) => x).join("/");
        const data = await entry.arrayBuffer();
        if (entry.name.endsWith(".zip")) {
          files.push({ archive, path: rpath, file: data });
        } else {
          const dataFile = ({
            provider: provider.slug,
            archive,
            path: rpath,
            data,
          }: DataFile);
          await db.putFile(dataFile);

          const parsed = provider.parse(dataFile);
          if (!Array.isArray(parsed) && parsed.type === "metadata") {
            await db.putMetadata(parsed);
          } else {
            db.putTimelineEntries(parsed);
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
