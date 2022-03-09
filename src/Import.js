// @flow
import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { SupportedProviders } from "./constants";
import importSlack from "./importers/slack";

function Import(): React.Node {
  const params = useParams();
  const provider = SupportedProviders.find((p) => p.slug === params.provider);
  if (!provider) {
    throw new Error(`Unknown provider: ${params.provider}`);
  }
  const [status, setStatus] = React.useState("");

  async function importFile(event) {
    if (event.target.files.length < 1) {
      return;
    }

    setStatus("Importing...");
    const start = Date.now();
    switch (provider.slug) {
      case "slack":
        await importSlack(event.target.files[0]);
        break;
      default:
        setStatus(`Unknown provider: ${provider.displayName}`);
        return;
    }
    setStatus(
      <React.Fragment>
        <div>Import complete!</div>
        <Link to={`/explore/${provider.slug}`}>View results</Link>
      </React.Fragment>
    );
    console.warn(`Time: ${(Date.now() - start) / 1000}s`);
  }

  return (
    <div className="Import">
      <div className="instructions">
        Import data from {provider.displayName}...
      </div>
      <input type="file" accept=".zip,application/zip" onChange={importFile} />
      <div className="status">{status}</div>
    </div>
  );
}

export default Import;
