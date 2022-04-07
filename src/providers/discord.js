// @flow
import * as React from "react";

import { ExternalLink } from "components/Links";

import DiscordIcon from "icons/discord.svg";

import type { DataFile, TimelineEntry } from "parse";
import type { Provider, TimelineCategory } from "provider";

class Discord implements Provider {
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

  timelineCategories: $ReadOnlyArray<TimelineCategory> = [];

  parse(files: DataFile): $ReadOnlyArray<TimelineEntry> {
    return []; // TODO
  }

  render(entry: TimelineEntry): React.Node {
    return <React.Fragment></React.Fragment>; // TODO
  }
}

export default Discord;
