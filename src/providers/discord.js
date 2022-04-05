// @flow
import * as React from "react";

import { ExternalLink } from "components/Links";

import DiscordIcon from "icons/discord.svg";

import type { Entry } from "parse";
import type { DataFile, Provider } from "provider";

class Discord implements Provider<void> {
  slug: string = "discord";
  displayName: string = "Discord";
  icon: React.Node = (<DiscordIcon />);
  color: string = "#5865f2";

  privacyPolicy: string =
    "https://discord.com/privacy#information-for-california-users";
  waitTime: string = "about a week";
  instructions: React.Node = (
    <ol>
      <li>
        Log in to{" "}
        <ExternalLink to="https://discord.com/app" newTab>
          Discord
        </ExternalLink>
      </li>
      <li>
        Open <i>User Settings</i>
      </li>
      <li>
        Select the <i>Privacy &amp; Safety</i> tab
      </li>
      <li>
        Scroll down and hit the <i>Request Data</i> button
      </li>
    </ol>
  );

  categoryLabels: $ReadOnlyMap<void, string> = new Map();
  timelineLabels: { [string]: [string, void] } = {};
  settingLabels: { [string]: string } = {};

  parse(files: $ReadOnlyArray<DataFile>): $ReadOnlyArray<Entry> {
    return []; // TODO
  }
}

export default Discord;
