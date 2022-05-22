import React from "react";

import { smartDecode, parseJSON } from "common/parse";

import Placeholder from "components/Placeholder";

import styles from "components/FilePreview.module.css";

type Props = {
  children:
    | void // show standard loading message
    | string // show custom placeholder message
    | ArrayBufferLike // display file (please also pass filename)
    | { [key: string]: any }; // display JSON object
  filename?: string;
};

const decodeFailureMessage = "🥗 Unable to decode text";
const emptyMessage = "🥛 File is empty";
const unknownMessage = "😕 Unknown file type";

function displayText(data: ArrayBufferLike): JSX.Element {
  try {
    const raw = smartDecode(data);
    if (/^\n*$/.test(raw)) return <Placeholder>{emptyMessage}</Placeholder>;
    else return <pre>{raw}</pre>;
  } catch {
    return <Placeholder>{decodeFailureMessage}</Placeholder>;
  }
}

function displayFile(data: ArrayBufferLike, filename: string): JSX.Element {
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
      // our server; with caveats: https://btidor.dev/content-security-policy).
      // As an additional precaution, we apply a sandbox policy that prevents
      // scripts from running.
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
      const url =
        URL.createObjectURL(
          new Blob([data], {
            type: "application/pdf",
          })
        ) + "#toolbar=0";
      return (
        // Unfortunately, Chrome won't load its PDF viewer in an iframe if
        // sandboxing is enabled, no matter which options are passed
        // (crbug.com/413851). As a result, we have to disable sandboxing
        // completely on this frame. Fortunately, browsers do respect the MIME
        // type set in the Blob constructor, so crafting a file with the
        // contents "<script>...</script>" and a *.pdf extension won't achieve
        // script execution.
        <iframe key={filename} src={url} title={filename}></iframe>
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
      return (
        <div className={styles.container}>
          <img src={url} alt={filename} className={styles.media} />
        </div>
      );
    }
    default: {
      return <Placeholder>{unknownMessage}</Placeholder>;
    }
  }
}

function FilePreview(props: Props): JSX.Element {
  const { children, filename } = props;

  let node;
  if (children === undefined || typeof children === "string") {
    node = <pre>{children || undefined}</pre>;
  } else if (children instanceof ArrayBuffer) {
    node = displayFile(children, filename || "");
  } else {
    node = <pre>{JSON.stringify(children, undefined, 2)}</pre>;
  }

  return <div className={styles.inspector}>{node}</div>;
}

export default FilePreview;
