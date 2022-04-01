// @flow
import * as React from "react";
import { useParams } from "react-router-dom";
import { StopwatchIcon } from "@primer/octicons-react";

import Expander from "components/Expander";
import { Fader, FaderItem } from "components/Fader";
import { InternalLink } from "components/Links";
import Logo from "components/Logo";
import Numeral from "components/Numeral";
import ProviderList from "components/ProviderList";

import Import from "Import";
import { getProvider } from "provider";

import styles from "Home.module.css";

type Props = {| import?: boolean |};

function Home(props: Props): React.Node {
  const params = useParams();
  const provider = params.provider ? getProvider(params.provider) : undefined;

  return (
    <main className={styles.home}>
      <div className={styles.providerList}>
        <Logo />
        <div className={styles.one}>
          <Numeral>1</Numeral> Select a company
        </div>
        <ProviderList
          selected={provider}
          backLink={props.import ? undefined : "/"}
        />
      </div>
      <Fader>
        {props.import ? (
          <FaderItem key="import">
            <Import />
          </FaderItem>
        ) : (
          <FaderItem key="steps">
            <ol className={styles.steps}>
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
                {provider ? (
                  <InternalLink to={`/${provider.slug}/import`}>
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
