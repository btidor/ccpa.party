import React, { useEffect } from "react";

import Placeholder from "@src/components/Placeholder";
import { decodeData } from "@src/worker/client";

import styles from "@src/components/FilePreview.module.css";

type Props = {
  children:
    | void // show standard loading message
    | string // show custom placeholder message
    | ArrayBufferLike // display file (please also pass filename)
    | { [key: string]: unknown }; // display JSON object
  filename?: string;
  special?: "email" | void;
};

const decodeFailureMessage = "🥗 Unable to decode text";
const emptyMessage = "🥛 File is empty";
const unknownMessage = "😕 Unknown file type";

function FilePreview(props: Props): JSX.Element {
  const { children, filename, special } = props;

  const [mode, setMode] = React.useState<DisplayMode | void>();
  useEffect(() => {
    displayMode(children, filename, special).then((m) => setMode(m));
  }, [children, filename, special]);

  if (!mode) {
    return <React.Fragment></React.Fragment>;
  } else if (mode.type === "error") {
    return <Placeholder>{decodeFailureMessage}</Placeholder>;
  } else if (mode.type === "empty") {
    return <Placeholder>{emptyMessage}</Placeholder>;
  } else if (mode.type === "unknown") {
    return <Placeholder>{unknownMessage}</Placeholder>;
  } else if (mode.type === "text") {
    return <pre className={styles.preview}>{mode.parsed}</pre>;
  } else if (mode.type === "json") {
    return (
      <pre className={styles.preview}>
        {JSON.stringify(mode.parsed, undefined, 2)}
      </pre>
    );
  } else if (mode.type === "pdf") {
    const url =
      URL.createObjectURL(
        new Blob([mode.document], {
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
      <iframe
        key={filename}
        className={styles.preview}
        src={url}
        title={filename}
      ></iframe>
    );
  } else if (mode.type === "webpage") {
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
      new Blob([mode.document], {
        type: "text/html; charset=utf-8",
      })
    );
    return (
      <iframe
        key={filename}
        className={styles.preview}
        src={url}
        sandbox=""
        title={filename}
      ></iframe>
    );
  } else if (mode.type === "image") {
    const url = URL.createObjectURL(new Blob([mode.document]));
    return (
      <div className={styles.preview}>
        <img src={url} alt={filename} />
      </div>
    );
  } else {
    throw new Error("unknown display mode: " + JSON.stringify(mode));
  }
}

type DisplayMode =
  | { type: "error" }
  | { type: "empty" }
  | { type: "unknown" }
  | { type: "text"; parsed: string }
  | { type: "json"; parsed: unknown }
  | { type: "pdf"; document: ArrayBufferLike }
  | { type: "webpage"; document: ArrayBufferLike }
  | { type: "image"; document: ArrayBufferLike };

async function displayMode(
  data: void | string | ArrayBufferLike | { [key: string]: unknown },
  filename: string | void,
  special: "email" | void
): Promise<DisplayMode | void> {
  if (data === undefined) {
    return undefined;
  } else if (special === "email") {
    if (typeof data !== "string") {
      throw new Error(
        "filepreview: special email must be used with string data"
      );
    }
    const parts = data.split("\r\n\r\n");
    const header = parts[0];
    const body = parts.slice(1).join("\r\n\r\n").trim();
    if (body.match(/^\s*(<!DOCTYPE|<HTML)\b/i)) {
      return {
        type: "webpage",
        document: new TextEncoder().encode(
          "<pre style='background-color: #000; color: #fff; font-size: 13px; padding: 4px; line-height: 1.425;'>" +
            header +
            "</pre>" +
            body
        ),
      };
    } else {
      return { type: "text", parsed: data };
    }
  } else if (typeof data === "string") {
    if (/^\s*$/.test(data)) return { type: "empty" };
    else return { type: "text", parsed: data };
  } else if (data instanceof ArrayBuffer) {
    if (data.byteLength < 16 * 1024) {
      const decoded = new TextDecoder().decode(data);
      if (decoded.match(/^\s*$/)) return { type: "empty" };
    }

    const ext = filename?.includes(".")
      ? filename.split(".").at(-1)
      : undefined;
    switch (ext) {
      case "json": {
        return await decodeData(data, true);
      }
      case "csv":
      case "txt":
      case undefined: // e.g. "README"
      case "xml":
      case "eml":
      case "ics": {
        return await decodeData(data, false);
      }
      case "htm":
      case "html": {
        return { type: "webpage", document: data };
      }
      case "pdf": {
        return { type: "pdf", document: data };
      }
      case "avif":
      case "gif":
      case "jpg":
      case "jpeg":
      case "png":
      case "svg":
      case "webp": {
        return { type: "image", document: data };
      }
      default: {
        return { type: "unknown" };
      }
    }
  } else {
    return { type: "json", parsed: data };
  }
}

export default React.memo(FilePreview);
