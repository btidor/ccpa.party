// @flow
import * as React from "react";

import { smartDecode, parseJSON } from "database";

import styles from "components/FilePreview.module.css";

type Props = {|
  +children:
    | void // show standard loading message
    | string // show custom placeholder message
    | ArrayBuffer // display file (please also pass filename)
    | { [string]: any }, // display JSON object
  +filename?: string,
|};

const loadingMessage = "📊 Loading...";
const emptyMessage = "🥛 File is empty";

function placeholder(message: string): React.Node {
  return <code className={styles.placeholder}>{message}</code>;
}

function displayText(data: ArrayBuffer): React.Node {
  try {
    const raw = smartDecode(data);
    return <pre>{raw}</pre>;
  } catch {
    return placeholder("🥗 Unable to decode text");
  }
}

function displayFile(data: ArrayBuffer, filename: string): React.Node {
  const ext = filename.includes(".")
    ? filename.split(".").slice(-1)[0]
    : undefined;
  switch (ext) {
    case "json": {
      try {
        const parsed = parseJSON(data);
        return <pre>{JSON.stringify(parsed, undefined, 2)}</pre>;
      } catch {
        return displayText(data);
      }
    }
    case "csv":
    case "txt":
    case undefined: // e.g. "README"
    case "xml": {
      return displayText(data);
    }
    case "pdf": {
      const url = URL.createObjectURL(new Blob([data]));
      return (
        // TODO: if file is actually HTML, this could be dangerous!
        <object data={url} type="application/pdf">
          <code className={styles.placeholder}>🙅 Could not display PDF</code>
        </object>
      );
    }
    case "htm":
    case "html": {
      // TODO: block network requests!
      const url = URL.createObjectURL(new Blob([data]));
      return <iframe src={url} sandbox="" title={filename}></iframe>;
    }
    case "avif":
    case "gif":
    case "jpg":
    case "jpeg":
    case "png":
    case "svg":
    case "webp": {
      const url = URL.createObjectURL(new Blob([data]));
      return <img src={url} alt={filename} className={styles.media} />;
    }
    default: {
      return placeholder("😕 Unknown file type");
    }
  }
}

function FilePreview(props: Props): React.Node {
  const { children, filename } = props;

  let node;
  if (children === undefined || typeof children === "string") {
    node = placeholder(children || loadingMessage);
  } else if (children instanceof ArrayBuffer) {
    node = children.byteLength
      ? displayFile(children, filename || "")
      : placeholder(emptyMessage);
  } else {
    node = <pre>{JSON.stringify(children, undefined, 2)}</pre>;
  }

  return <div className={styles.inspector}>{node}</div>;
}

export default FilePreview;
