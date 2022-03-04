import { Link } from "react-router-dom";
import { SupportedProviders } from "./constants"

function Home() {
  return (
    <div className="Home">
      <div className="instructions">Upload data from...</div>
      <ul>
        {SupportedProviders.map(provider =>
          <li key={provider.slug}>
            <Link to={'/import/' + provider.slug}>{provider.displayName}</Link>
          </li>
        )}
      </ul>
    </div>
  );
}

export default Home;
