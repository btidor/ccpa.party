// @flow
import * as React from "react";
import { useParams } from "react-router-dom";
import { StopwatchIcon } from "@primer/octicons-react";

import Expander from "components/Expander";
import { InternalLink } from "components/Links";
import Navigation from "components/Navigation";
import Numeral from "components/Numeral";
import ProviderList from "components/ProviderList";

import { getProvider } from "provider";

import styles from "Home.module.css";

function Home(): React.Node {
  const params = useParams();
  const provider =
    params.provider !== "start" ? getProvider(params.provider) : undefined;

  return (
    <React.Fragment>
      <Navigation />
      <main className={styles.home}>
        <div className={styles.providerList}>
          <div>
            <Numeral>1</Numeral> Select a company
          </div>
          <ProviderList selected={provider} />
        </div>
        <div className={styles.steps}>
          <ol>
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
              <i>Wait {!!provider && `${provider.waitTime} for a response`}</i>
            </li>
            <li>
              <Numeral>3</Numeral>
              {provider ? (
                <InternalLink to="import">
                  Inspect your data with ccpa.party
                </InternalLink>
              ) : (
                "Inspect your data with ccpa.party"
              )}
            </li>
          </ol>
        </div>
      </main>
    </React.Fragment>
  );
}

export default Home;
