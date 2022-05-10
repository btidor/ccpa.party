// @flow
import * as React from "react";

import Placeholder from "components/Placeholder";
import { smartDecode, parseJSON } from "common/importer";

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
    case "htm":
    case "html": {
      // Blob iframes inherit the Content Security Policy of their parent. Here
      // this prevents them from loading resources from the network (except from
      // our server). As an additional precaution, we apply a sandbox policy
      // that prevents scripts from running.
      //
      // We set a unique key here to prevent React from trying to re-use the
      // iframe for different documents, which triggers a bug in Firefox.
      //
      // Warning: removing the sandbox, or adding `allow-scripts` +
      // `allow-same-origin`, will cause the content to execute under *our*
      // origin!
      //
      const url = URL.createObjectURL(
        new Blob([data], {
          type: "text/html; charset=utf-8",
        })
      );
      return (
        <iframe key={filename} src={url} sandbox="" title={filename}></iframe>
      );
    }
    case "pdf": {
      const url = URL.createObjectURL(
        new Blob([data], {
          type: "application/pdf",
        })
      );
      return (
        // See above for iframe-related warnings. Firefox uses PDF.js to render
        // PDFs and requires allow-scripts for it to run. Fortunately, browsers
        // do seem to respect the MIME type set in the Blob constructor, so
        // crafting an HTML file with a *.pdf extension won't work.
        <iframe
          key={filename}
          src={url}
          sandbox="allow-scripts"
          title={filename}
        ></iframe>
      );
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
