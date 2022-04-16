// @flow
import * as React from "react";

import Placeholder from "components/Placeholder";
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

const emptyMessage = "🥛 File is empty";
const pdfFallbackMessage = "🙅 Could not display PDF";
const unknownMessage = "😕 Unknown file type";

function displayText(data: ArrayBuffer): React.Node {
  try {
    const raw = smartDecode(data);
    return <pre>{raw}</pre>;
  } catch {
    return <Placeholder>🥗 Unable to decode text</Placeholder>;
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
          <Placeholder>{pdfFallbackMessage}</Placeholder>
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
      return <Placeholder>{unknownMessage}</Placeholder>;
    }
  }
}

function FilePreview(props: Props): React.Node {
  const { children, filename } = props;

  let node;
  if (children === undefined || typeof children === "string") {
    node = <Placeholder>{children}</Placeholder>;
  } else if (children instanceof ArrayBuffer) {
    node = children.byteLength ? (
      displayFile(children, filename || "")
    ) : (
      <Placeholder>{emptyMessage}</Placeholder>
    );
  } else {
    node = <pre>{JSON.stringify(children, undefined, 2)}</pre>;
  }

  return <div className={styles.inspector}>{node}</div>;
}

export default FilePreview;
