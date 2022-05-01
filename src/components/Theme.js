// @flow
import * as React from "react";

import { lightColor } from "provider";

import type { Provider } from "provider";

type Props = {|
  +provider: Provider,
  +children: React.Node,
|};

function Theme(props: Props): React.Node {
  return (
    <div
      style={{
        "--primary": props.provider.color,
        "--primary-light": lightColor(props.provider),
      }}
    >
      {props.children}
    </div>
  );
}

export default Theme;
