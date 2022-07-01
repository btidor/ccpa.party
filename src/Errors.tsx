import React from "react";

import type { Provider } from "@src/common/provider";
import { useNavigate } from "@src/common/router";
import Navigation from "@src/components/Navigation";
import Placeholder from "@src/components/Placeholder";
import { useProviderDatabase } from "@src/database/hooks";
import type { ParseError } from "@src/database/types";

import styles from "@src/Errors.module.css";

type Props<T> = {
  provider: Provider<T>;
};

function Errors<T>(props: Props<T>): JSX.Element {
  const { provider } = props;

  const navigate = useNavigate();

  const db = useProviderDatabase(props.provider);
  const [message, setMessage] = React.useState({
    provider: provider.slug,
    text: undefined as string | void,
  });
  React.useEffect(() => {
    (async () => {
      if (!db) return;
      const files = await db.getFiles();
      if (files.length === 0) navigate(`/${provider.slug}`);

      const rows: string[] = [];
      rows.push(
        (await db.getHasErrors())
          ? "💥 Imported with errors"
          : "✨ Import completed without errors"
      );

      for (const { path, errors } of files) {
        if (!errors.length) continue;
        const fileLevel = errors.filter((e) => e.stage === "tokenize");
        const entryLevel = errors.filter((e) => e.stage !== "tokenize");

        const errata = [];
        for (const error of fileLevel) {
          errata.push(`* (File) ${error.message}`);
        }

        const entryLevelMap = new Map<string, [ParseError, number]>();
        for (const error of entryLevel) {
          const [sample, ct] = entryLevelMap.get(error.message) || [error, 0];
          entryLevelMap.set(error.message, [sample, ct + 1]);
        }

        for (const [message, [sample, count]] of entryLevelMap.entries()) {
          errata.push(`* (Entry x${count}) ${message}\n  ${sample.line}`);
        }
        rows.push(`${path.join("/")}:\n${errata.join("\n")}`);
      }

      const unknowns = files.filter((f) => f.status === "unknown");
      if (unknowns.length)
        rows.push(
          "Unknown Files:\n" +
            unknowns.map((f) => `* ${f.path.join("/")}`).join("\n")
        );

      setMessage({ provider: provider.slug, text: rows.join("\n\n") + "\n" });
    })();
  }, [db, navigate, provider]);

  return (
    <div
      className={styles.outer}
      style={
        {
          "--neon-hex": props.provider.neonColor,
          "--neon-hdr": props.provider.neonColorHDR,
        } as React.CSSProperties
      }
    >
      <Navigation provider={provider} pageSlug="errors" />
      <main className={styles.errors}>
        {message.provider === provider.slug && message.text ? (
          <textarea
            key={message.provider}
            defaultValue={message.text}
            spellCheck={false}
          />
        ) : (
          <Placeholder />
        )}
      </main>
    </div>
  );
}

export default Errors;
