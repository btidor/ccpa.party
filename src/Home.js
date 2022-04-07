// @flow
import * as React from "react";
import { StopwatchIcon } from "@primer/octicons-react";

import Expander from "components/Expander";
import { Fader, FaderItem } from "components/Fader";
import { InternalLink } from "components/Links";
import Logo from "components/Logo";
import Numeral from "components/Numeral";
import ProviderList from "components/ProviderList";

import Import from "Import";
import { openFiles } from "parse";

import styles from "Home.module.css";

import type { Provider } from "provider";

type Props =
  | {| +provider?: void, +screen: "select" |}
  | {|
      +provider: Provider,
      +screen: "request" | "import",
    |};

function Home(props: Props): React.Node {
  const { provider, screen } = props;
  const [inspectLink, setInspectLink] = React.useState(
    provider && `/${provider.slug}/import`
  );

  React.useEffect(() => {
    provider &&
      (async () => {
        const db = await openFiles();
        const exists = await db.getFromIndex(
          "files",
          "provider",
          provider.slug
        );
        setInspectLink(`/${provider.slug}/` + (exists ? "files" : "import"));
      })();
  }, [provider]);

  return (
    <main className={styles.home}>
      <div className={styles.providerList}>
        <Logo />
        <div className={styles.one}>
          <Numeral>1</Numeral> Select a company
        </div>
        <ProviderList
          selected={provider}
          backLink={screen === "import" ? undefined : "/"}
        />
      </div>
      <Fader>
        {props.screen === "import" ? (
          <FaderItem key="import">
            <Import provider={props.provider} />
          </FaderItem>
        ) : (
          <FaderItem key="request">
            <ol className={styles.request}>
              <li>
                <Numeral>2</Numeral>
                Submit data access request
                <Expander className={styles.instructions} marginTop="1em">
                  {!!provider && provider.instructions}
                </Expander>
              </li>
              <li>
                <Numeral>
                  <StopwatchIcon />
                </Numeral>
                <i>
                  Wait {!!provider && `${provider.waitTime} for a response`}
                </i>
              </li>
              <li>
                <Numeral>3</Numeral>
                {provider && inspectLink ? (
                  <InternalLink to={inspectLink}>
                    Inspect your data with ccpa.party
                  </InternalLink>
                ) : (
                  "Inspect your data with ccpa.party"
                )}
              </li>
            </ol>
          </FaderItem>
        )}
      </Fader>
    </main>
  );
}

export default Home;
