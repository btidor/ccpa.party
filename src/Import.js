// @flow
import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { getProvider } from "provider";

function Import(): React.Node {
  const params = useParams();
  const provider = getProvider(params.provider);
  const [status, setStatus] = React.useState("");

  async function importFile(event) {
    if (event.target.files.length < 1) {
      return;
    }

    setStatus("Importing...");
    const start = Date.now();
    await provider.import(event.target.files[0]);
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
