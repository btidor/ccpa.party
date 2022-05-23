import { DateTime } from "luxon";

import type {
  DataFile,
  TimelineContext,
  TimelineEntry,
} from "@/common/database";
import { getSlugAndDayTime, parseJSON } from "@/common/parse";
import type { Provider, TimelineCategory } from "@/common/provider";

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
  installed_apps_v2: (item: any) => [
    `App ${item.category[0].toUpperCase() + item.category.slice(1)}`,
    item.name,
  ],
  comments_v2: (item: any) => [
    "Comment",
    item.data?.[0]?.comment?.comment || item.title,
  ],
  reactions_v2: (item: any) => ["Reaction", item.title],
  events_invited_v2: (item: any) => ["Event Invitation", item.name],
  received_requests_v2: (item: any) => ["Friend Request", item.name],
  friends_v2: (item: any) => ["Became Friends", item.name],
  rejected_requests_v2: (item: any) => ["Rejected Friend Request", item.name],
  deleted_friends_v2: (item: any) => ["Unfriended", item.name],
  group_comments_v2: (item: any) => [
    "Comment",
    item.data?.[0]?.comment?.comment || item.title,
  ],
  groups_joined_v2: (item: any) => [
    "Joined Group",
    item.data?.[0]?.name || item.title,
  ],
  groups_admined_v2: (item: any) => ["Became Group Admin", item.name],
  group_posts_v2: (item: any) => ["Post", item.data?.[0]?.post || item.title],
  notifications_v2: (item: any) => ["Notification", item.text],
  pages_unfollowed_v2: (item: any) => [
    "Un-Followed",
    item.data?.[0]?.name || item.title,
  ],
  poll_votes_v2: (item: any) => ["Voted on Poll"],
  account_activity_v2: (item: any) => [
    (item.action as string)
      .split(" ")
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" "),
    item.ip_address,
  ],
  contact_verifications_v2: (item: any) => [
    "Verified Email Address",
    item.contact,
  ],
  used_ip_address_v2: (item: any) => [
    (item.action as string)
      .split(" ")
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" "),
    item.ip,
  ],
  login_protection_data_v2: (item: any) => ["Session", item.name],
  account_accesses_v2: (item: any) => [
    (item.action as string)
      .split(" ")
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" "),
    item.ip_address,
  ],
  admin_records_v2: (item: any) => [
    (item.event as string)
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

  requestLink: { href: string; text: string } = {
    text: "Download Your Information",
    href: "https://www.facebook.com/ccpa/download_your_information/",
  };
  waitTime: string = "1-2 hours";
  instructions: ReadonlyArray<string> = ["select format JSON"];
  singleFile: boolean = true;
  fileName: string = "facebook.zip";
  privacyPolicy: string = "https://www.facebook.com/legal/policy/ccpa";

  metadataFiles: ReadonlyArray<string | RegExp> = [];

  timelineCategories: ReadonlyMap<CategoryKey, TimelineCategory> = new Map([
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
  ): Promise<ReadonlyArray<TimelineEntry<CategoryKey>>> {
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
        let parsed: any;
        try {
          parsed = parseJSON(file.data, { smart: true });
        } catch {
          return [];
        }
        return parsed.messages.map((item: any) =>
          entry(item, "message", DateTime.fromMillis(item.timestamp_ms), [
            item.content,
            parsed.title === item.sender_name ? undefined : parsed.title,
            { color: "var(--neon)", display: item.sender_name },
          ])
        );
      }
    } else if (file.path[1] === "posts") {
      if (
        file.path[2].startsWith("your_posts") &&
        file.path[2].endsWith(".json")
      ) {
        let parsed = parseJSON(file.data, { smart: true });
        if (!Array.isArray(parsed)) parsed = [parsed];
        return parsed.map((item: any) =>
          entry(item, "content", DateTime.fromSeconds(item.timestamp), [
            "Post",
            item.data?.[0]?.post,
          ])
        );
      }
    } else if (file.path.slice(-1)[0] === "your_event_responses.json") {
      const parsed = parseJSON(file.data, { smart: true });
      const root = parsed.event_responses_v2;
      return root.events_joined
        .map((item: any) =>
          entry(item, "content", DateTime.fromSeconds(item.start_timestamp), [
            "Going to Event",
            item.name,
          ])
        )
        .concat(
          root.events_declined.map((item: any) =>
            entry(item, "content", DateTime.fromSeconds(item.start_timestamp), [
              "Declined Event",
              item.name,
            ])
          )
        );
    } else if (file.path.slice(-1)[0] === "your_off-facebook_activity.json") {
      return parseJSON(file.data, {
        smart: true,
      }).off_facebook_activity_v2.flatMap((company: any) =>
        company.events.map((item: any) =>
          entry(item, "activity", DateTime.fromSeconds(item.timestamp), [
            "Off-Facebook Purchase",
            company.name,
          ])
        )
      );
    } else if (file.path.slice(-1)[0] === "feed.json") {
      return parseJSON(file.data, {
        smart: true,
      }).people_and_friends_v2.flatMap((feed: any) =>
        feed.entries.map((item: any) =>
          entry(item, "activity", DateTime.fromSeconds(item.timestamp), [
            feed.name,
            item.data.name,
          ])
        )
      );
    } else if (file.path.slice(-1)[0] === "profile_information.json") {
      const parsed = parseJSON(file.data, { smart: true }).profile_v2;
      return [
        entry(
          parsed,
          "activity",
          DateTime.fromSeconds(parsed.registration_timestamp),
          ["Created Profile", parsed.name.full_name]
        ),
      ];
    } else if (file.path.slice(-1)[0] === "recently_viewed.json") {
      return parseJSON(file.data, { smart: true })
        .recently_viewed.flatMap((category: any) =>
          category.entries?.map(
            (item: any) =>
              item.timestamp &&
              entry(item, "activity", DateTime.fromSeconds(item.timestamp), [
                `Viewed ${category.name}`,
                item.data.name,
              ])
          )
        )
        .filter((x: any) => x);
    } else if (file.path.slice(-1)[0] === "recently_visited.json") {
      return parseJSON(file.data, { smart: true })
        .visited_things_v2.flatMap(
          (category: any) =>
            category.name === "Profile visits" &&
            category.entries.map(
              (item: any) =>
                item.timestamp &&
                entry(item, "activity", DateTime.fromSeconds(item.timestamp), [
                  "Viewed Profile",
                  item.data.name,
                ])
            )
        )
        .filter((x: any) => x);
    } else if (file.path.slice(-1)[0].endsWith(".json")) {
      return Object.entries(parseJSON(file.data, { smart: true }))
        .flatMap(([key, value]) => {
          if (
            Array.isArray(value) &&
            (categories as any)[key] &&
            (mappers as any)[key]
          ) {
            return value.map((item: any) => {
              const timestamp =
                item.timestamp ||
                item.start_timestamp ||
                item.removed_timestamp ||
                item.added_timestamp ||
                item.verification_time ||
                item.session?.created_timestamp;
              if (!timestamp) {
                console.warn(
                  "Skipping entry due to no timestamp:",
                  file.path.slice(1).join("/"),
                  item
                );
              }
              return (
                timestamp &&
                entry(
                  item,
                  (categories as any)[key],
                  DateTime.fromSeconds(timestamp),
                  (mappers as any)[key](item)
                )
              );
            });
          } else {
            return [];
          }
        })
        .filter((x) => x);
    }
    return [];
  }
}

export default Facebook;
