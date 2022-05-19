// @flow
import { DateTime } from "luxon";

import { getSlugAndDayTime, parseJSON } from "common/parse";

import type { DataFile, TimelineContext, TimelineEntry } from "common/database";
import type { Provider, TimelineCategory } from "common/provider";

const categories = {
  installed_apps_v2: "activity",
  comments_v2: "content",
  reactions_v2: "content",
  events_invited_v2: "content",
  received_requests_v2: "content",
  friends_v2: "content",
  rejected_requests_v2: "content",
  deleted_friends_v2: "content",
  group_comments_v2: "content",
  groups_joined_v2: "content",
  groups_admined_v2: "activity",
  group_posts_v2: "content",
  notifications_v2: "notification",
  pages_unfollowed_v2: "activity",
  poll_votes_v2: "content",
  account_activity_v2: "security",
  contact_verifications_v2: "security",
  used_ip_address_v2: "security",
  login_protection_data_v2: "security",
  account_accesses_v2: "security",
  admin_records_v2: "security",
};

const mappers = {
  installed_apps_v2: (item) => [
    `App ${item.category[0].toUpperCase() + item.category.slice(1)}`,
    item.name,
  ],
  comments_v2: (item) => [
    "Comment",
    item.data?.[0]?.comment?.comment || item.title,
  ],
  reactions_v2: (item) => ["Reaction", item.title],
  events_invited_v2: (item) => ["Event Invitation", item.name],
  received_requests_v2: (item) => ["Friend Request", item.name],
  friends_v2: (item) => ["Became Friends", item.name],
  rejected_requests_v2: (item) => ["Rejected Friend Request", item.name],
  deleted_friends_v2: (item) => ["Unfriended", item.name],
  group_comments_v2: (item) => [
    "Comment",
    item.data?.[0]?.comment?.comment || item.title,
  ],
  groups_joined_v2: (item) => [
    "Joined Group",
    item.data?.[0]?.name || item.title,
  ],
  groups_admined_v2: (item) => ["Became Group Admin", item.name],
  group_posts_v2: (item) => ["Post", item.data?.[0]?.post || item.title],
  notifications_v2: (item) => ["Notification", item.text],
  pages_unfollowed_v2: (item) => [
    "Un-Followed",
    item.data?.[0]?.name || item.title,
  ],
  poll_votes_v2: (item) => ["Voted on Poll"],
  account_activity_v2: (item) => [
    item.action
      .split(" ")
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" "),
    item.ip_address,
  ],
  contact_verifications_v2: (item) => ["Verified Email Address", item.contact],
  used_ip_address_v2: (item) => [
    item.action
      .split(" ")
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" "),
    item.ip,
  ],
  login_protection_data_v2: (item) => ["Session", item.name],
  account_accesses_v2: (item) => [
    item.action
      .split(" ")
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" "),
    item.ip_address,
  ],
  admin_records_v2: (item) => [
    item.event
      .split(" ")
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" "),
    item.session?.ip_address,
  ],
};

type CategoryKey =
  | "activity"
  | "content"
  | "message"
  | "notification"
  | "security";

class Facebook implements Provider<CategoryKey> {
  slug: string = "facebook";
  displayName: string = "Facebook";

  brandColor: string = "#1877f2";
  neonColor: string = "#009eff";
  neonColorHDR: string = "color(rec2020 0.12623 0.5874 1.52179)";

  requestLink: {| href: string, text: string |} = {
    text: "Download Your Information",
    href: "https://www.facebook.com/ccpa/download_your_information/",
  };
  waitTime: string = "1-2 hours";
  instructions: $ReadOnlyArray<string> = ["select format JSON"];
  singleFile: boolean = true;
  privacyPolicy: string = "https://www.facebook.com/legal/policy/ccpa";

  metadataFiles: $ReadOnlyArray<string | RegExp> = [];

  timelineCategories: $ReadOnlyMap<CategoryKey, TimelineCategory> = new Map([
    [
      "activity",
      {
        char: "a",
        icon: "🖱",
        displayName: "Activity",
        defaultEnabled: true,
      },
    ],
    [
      "content",
      {
        char: "c",
        icon: "📱",
        displayName: "Content",
        defaultEnabled: true,
      },
    ],
    [
      "message",
      {
        char: "m",
        icon: "💬",
        displayName: "Messages",
        defaultEnabled: true,
      },
    ],
    [
      "notification",
      {
        char: "n",
        icon: "🔔",
        displayName: "Notifications",
        defaultEnabled: false,
      },
    ],
    [
      "security",
      {
        char: "s",
        icon: "🪪",
        displayName: "Security Logs",
        defaultEnabled: false,
      },
    ],
  ]);

  async parse(
    file: DataFile
  ): Promise<$ReadOnlyArray<TimelineEntry<CategoryKey>>> {
    const entry = (
      row: any,
      category: CategoryKey,
      datetime: any,
      context: TimelineContext
    ) => ({
      file: file.path,
      category,
      ...getSlugAndDayTime(datetime.toSeconds(), row),
      context,
      value: row,
    });

    if (file.path[1] === "messages") {
      const filename = file.path.slice(-1)[0];
      if (filename.startsWith("message_") && filename.endsWith(".json")) {
        let parsed;
        try {
          parsed = parseJSON(file.data);
        } catch {
          return [];
        }
        return parsed.messages.map((item) =>
          entry(item, "message", DateTime.fromMillis(item.timestamp_ms), [
            item.content,
            parsed.title === item.sender_name ? undefined : parsed.title,
            item.sender_name,
          ])
        );
      }
    } else if (file.path[1] === "posts") {
      if (
        file.path[2].startsWith("your_posts") &&
        file.path[2].endsWith(".json")
      ) {
        const parsed = parseJSON(file.data);
        return [
          entry(parsed, "content", DateTime.fromSeconds(parsed.timestamp), [
            "Post",
            parsed.data?.[0]?.post,
          ]),
        ];
      }
    } else if (file.path.slice(-1)[0] === "your_event_responses.json") {
      const parsed = parseJSON(file.data);
      const root = parsed.event_responses_v2;
      return root.events_joined
        .map((item) =>
          entry(item, "content", DateTime.fromSeconds(item.start_timestamp), [
            "Going to Event",
            item.name,
          ])
        )
        .concat(
          root.events_declined.map((item) =>
            entry(item, "content", DateTime.fromSeconds(item.start_timestamp), [
              "Declined Event",
              item.name,
            ])
          )
        );
    } else if (file.path.slice(-1)[0] === "your_off-facebook_activity.json") {
      return parseJSON(file.data).off_facebook_activity_v2.flatMap((company) =>
        company.events.map((item) =>
          entry(item, "activity", DateTime.fromSeconds(item.timestamp), [
            "Off-Facebook Purchase",
            company.name,
          ])
        )
      );
    } else if (file.path.slice(-1)[0] === "feed.json") {
      return parseJSON(file.data).people_and_friends_v2.flatMap((feed) =>
        feed.entries.map((item) =>
          entry(item, "activity", DateTime.fromSeconds(item.timestamp), [
            feed.name,
            item.data.name,
          ])
        )
      );
    } else if (file.path.slice(-1)[0] === "profile_information.json") {
      const parsed = parseJSON(file.data).profile_v2;
      return [
        entry(
          parsed,
          "activity",
          DateTime.fromSeconds(parsed.registration_timestamp),
          ["Created Profile", parsed.name.full_name]
        ),
      ];
    } else if (file.path.slice(-1)[0] === "recently_viewed.json") {
      return parseJSON(file.data)
        .recently_viewed.flatMap((category) =>
          category.entries?.map(
            (item) =>
              item.timestamp &&
              entry(item, "activity", DateTime.fromSeconds(item.timestamp), [
                `Viewed ${category.name}`,
                item.data.name,
              ])
          )
        )
        .filter((x) => x);
    } else if (file.path.slice(-1)[0] === "recently_visited.json") {
      return parseJSON(file.data)
        .visited_things_v2.flatMap(
          (category) =>
            category.name === "Profile visits" &&
            category.entries.map(
              (item) =>
                item.timestamp &&
                entry(item, "activity", DateTime.fromSeconds(item.timestamp), [
                  "Viewed Profile",
                  item.data.name,
                ])
            )
        )
        .filter((x) => x);
    } else if (file.path.slice(-1)[0].endsWith(".json")) {
      return Object.entries(parseJSON(file.data)).flatMap(([key, value]) => {
        if (Array.isArray(value) && categories[key] && mappers[key]) {
          return value.map((item: any) =>
            entry(
              item,
              categories[key],
              DateTime.fromSeconds(
                item.timestamp ||
                  item.start_timestamp ||
                  item.removed_timestamp ||
                  item.removed_timestamp ||
                  item.verification_time ||
                  item.session?.created_timestamp
              ),
              mappers[key](item)
            )
          );
        } else {
          return [];
        }
      });
    }
    return [];
  }
}

export default Facebook;
