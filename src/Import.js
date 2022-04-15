// @flow
import pako from "pako";
import * as React from "react";
import untar from "js-untar";
import { unzip } from "unzipit";

import { InternalLink } from "components/Links";
import { Database, fileSizeLimitMB } from "database";

import styles from "Import.module.css";

import type { DataFile } from "database";
import type { Provider } from "provider";
import { ShieldLockIcon } from "@primer/octicons-react";

type ImportFile = {|
  path: $ReadOnlyArray<string>,
  data: () => Promise<ArrayBuffer>,
|};

type Props = {| +provider: Provider |};

function Import(props: Props): React.Node {
  const { provider } = props;
  const [status, setStatus] = React.useState("");

  const [epoch, setEpoch] = React.useState(0);
  const db = React.useMemo(
    () => new Database(() => setEpoch(epoch + 1)),
    [epoch]
  );

  async function importFiles(event) {
    const files: Array<ImportFile> = [];
    for (let i = 0; i < event.target.files.length; i++) {
      const file = event.target.files.item(i);
      files.push({ path: [file.name], data: () => file.arrayBuffer() });
    }
    if (files.length < 1) {
      return;
    }

    setStatus("Importing...");
    const start = Date.now();
    let processed = 0;
    const processEntry = async (
      path: $ReadOnlyArray<string>,
      data: ArrayBuffer
    ): Promise<?ImportFile> => {
      if (processed % 23 === 0) {
        setStatus(`Importing ${processed.toLocaleString("en-US")} items...`);
      }
      if (
        path.slice(-1)[0].endsWith(".zip") ||
        path.slice(-1)[0].endsWith(".tar.gz")
      ) {
        return ({ path, data: () => Promise.resolve(data) }: ImportFile);
      } else if (data.byteLength > (2 << 20) * fileSizeLimitMB) {
        const dataFile = ({
          provider: provider.slug,
          path,
          data: undefined,
          skipped: "tooLarge",
        }: DataFile);
        await db.putFile(dataFile);
        processed++;
        return;
      } else {
        const dataFile = ({
          provider: provider.slug,
          path,
          data,
          skipped: undefined,
        }: DataFile);
        await db.putFile(dataFile);
        const parsed = await provider.parse(dataFile);
        for (const entry of parsed) {
          if (entry.type === "metadata") await db.putMetadata(entry);
          else if (entry.type === "timeline") await db.putTimelineEntry(entry);
          processed++;
        }
        return;
      }
    };

    for (const { path, data } of files) {
      if (path.slice(-1)[0].endsWith(".zip")) {
        const zip = await unzip(await data());
        for (const entry of (Object.values(zip.entries || []): any)) {
          if (entry.isDirectory) continue;
          const subpath = [
            ...path,
            ...entry.name.split("/").filter((x) => x && x !== "."),
          ];
          const next = await processEntry(subpath, await entry.arrayBuffer());
          if (next) files.push(next);
        }
      } else if (path.slice(-1)[0].endsWith(".tar.gz")) {
        const inflated = pako.inflate(await data());
        const entries = await untar(inflated.buffer);
        for (const entry of entries) {
          if (entry.type !== "0") continue;
          const subpath = [
            ...path,
            ...entry.name.split("/").filter((x) => x && x !== "."),
          ];
          const next = await processEntry(subpath, entry.buffer);
          if (next) files.push(next);
        }
      } else {
        throw new Error("Unknown archive: " + path.slice(-1)[0]);
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
        accept=".zip,.tar.gz"
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
