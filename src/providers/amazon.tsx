import { DateTime } from "luxon";
import { Minimatch } from "minimatch";

import type { DataFile, TimelineEntry } from "@src/common/database";
import {
  TimelineParser,
  parseByStages,
  parseCSV,
  parseJSON,
  smartDecode,
} from "@src/common/parse";
import type { Provider, TimelineCategory } from "@src/common/provider";

type CategoryKey = "activity" | "billing" | "notification" | "order";

class Amazon implements Provider<CategoryKey> {
  slug: string = "amazon";
  displayName: string = "Amazon";

  brandColor: string = "#ff9900";
  neonColor: string = "#ff7100";
  neonColorHDR: string = "color(rec2020 0.84192 0.48607 -0.05713)";

  requestLink: { href: string; text: string } = {
    text: "Request My Data",
    href: "https://amazon.com/gp/privacycentral/dsar/preview.html",
  };
  waitTime: string = "1-2 days";
  instructions: ReadonlyArray<string> = [];
  singleFile: boolean = false;
  fileName: string = "zip files";
  privacyPolicy: string =
    "https://www.amazon.com/gp/help/customer/display.html?nodeId=GC5HB5DVMU5Y8CJ2";

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
      "billing",
      {
        char: "b",
        icon: "💵",
        displayName: "Billing",
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
      "order",
      {
        char: "o",
        icon: "🚚",
        displayName: "Orders",
        defaultEnabled: true,
      },
    ],
  ]);

  timelineParsers: ReadonlyArray<TimelineParser<CategoryKey>> = [
    {
      glob: new Minimatch("Location/Country of Residence-*.csv"),
      parse: (item) => [
        "activity",
        DateTime.fromISO(item["Timestamp"]),
        ["Set Alexa country of residence", item["Country"]],
      ],
    },
    {
      glob: new Minimatch("account.csv"), // Amazon-Music.zip
      parse: (item) => [
        "activity",
        DateTime.fromSQL(item["Account_Creation_Time"]),
        ["Created Music Account", item["Music_Territory"]],
      ],
    },
    {
      glob: new Minimatch("library.csv"), // Amazon-Music.zip
      parse: (item) => [
        "order",
        DateTime.fromISO(item["creationDate"]),
        ["Added to Music Library", `${item["title"]} (${item["albumName"]})`],
      ],
    },
    {
      glob: new Minimatch("AmazonSmile.AggregateCustomerDonation.Data.csv"),
      parse: (item) => [
        "activity",
        DateTime.fromFormat(item["LastUpdatedTimeInUTC"], "MM/dd/yyyy HH:mm", {
          zone: "UTC",
        }),
        ["AmazonSmile Summary"],
      ],
    },
    {
      glob: new Minimatch("AmazonSmile.CharitySelectionHistory.Data.csv"),
      parse: (item) => [
        "activity",
        DateTime.fromFormat(item["SelectionTimeInUTC"], "MM/dd/yyyy HH:mm", {
          zone: "UTC",
        }),
        ["Selected AmazonSmile Charity", item["CharityName"]],
      ],
    },
    {
      glob: new Minimatch("Appstore/**/subscription-transaction.csv"),
      parse: (item) => [
        "billing",
        DateTime.fromSQL(item["transaction_creation_date"], {
          zone: "UTC",
        }),
        ["App Store Subscription", item["transaction_item_id"]],
      ],
    },
    {
      glob: new Minimatch("Audible.CartHistory.csv"),
      parse: (item) => [
        "activity",
        DateTime.fromSQL(item["AddDate"]),
        ["Added to Audible Cart", item["Title"]],
      ],
    },
    {
      glob: new Minimatch("Audible.Credits.csv"),
      parse: (item) => [
        "billing",
        DateTime.fromSQL(item["IssueDate"]),
        ["Received Audible Credit"],
      ],
    },
    {
      glob: new Minimatch("Audible.DevicesActivations.csv"),
      parse: (item) => [
        "activity",
        DateTime.fromSQL(item["StartDate"]),
        ["Activated Audible", item["DeviceCategory"]],
      ],
    },
    {
      glob: new Minimatch("Audible.Library.csv"),
      parse: (item) => [
        "order",
        DateTime.fromSQL(item["DateAdded"]),
        ["Added to Audible Library", item["Title"]],
      ],
    },
    {
      glob: new Minimatch("Audible.MembershipBillings.csv"),
      parse: (item) => [
        "billing",
        DateTime.fromSQL(item["TaxCreateDate"]),
        ["Audible Billing Event", item["OfferName"]],
      ],
    },
    {
      glob: new Minimatch("Audible.MembershipEvent.csv"),
      parse: (item) => [
        "activity",
        DateTime.fromSQL(item["EventDate"]),
        ["Audible Membership Event", item["BusinessEventTypeName"]],
      ],
    },
    {
      glob: new Minimatch("Audible.PurchaseHistory.csv"),
      parse: (item) => [
        "order",
        DateTime.fromSQL(item["OrderPlaceDate"]),
        ["Audible Purchase", item["Title"]],
      ],
    },
    {
      glob: new Minimatch("**/CustomerCommunicationExperience.Preferences.csv"),
      parse: (item) => [
        "notification",
        DateTime.fromFormat(item["ActionTimestamp"], "M/d/yy h:mm:ss a z"),
        ["Notification Event", item["NotificationTopic"]],
      ],
    },
    {
      glob: new Minimatch("registration.csv"), // Devices.Registration.zip
      parse: (item) => [
        "activity",
        DateTime.fromISO(item["FirstTimeRegistered"]),
        ["Registered Device", item["AccountName"]],
      ],
    },
    {
      glob: new Minimatch("Digital Items.csv"),
      parse: (item) => [
        "order",
        DateTime.fromSQL(item["OrderDate"]),
        ["Digital Order", item["Title"]],
      ],
    },
    {
      glob: new Minimatch("Digital Orders.csv"),
      parse: (item) => [
        "order",
        DateTime.fromSQL(item["OrderDate"]),
        ["Digital Order", item["OrderId"]],
      ],
    },
    {
      glob: new Minimatch("Digital.ActionBenefit.*.csv"),
      parse: (item) => [
        "notification",
        DateTime.fromSQL(item["BenefitDate"]),
        ["Qualified for Promotion"],
      ],
    },
    {
      glob: new Minimatch("whispersync.csv"),
      parse: (item) => [
        "activity",
        DateTime.fromISO(item["Customer modified date on device"]),
        [
          `Whispersync ${item["Annotation Type"]
            .split(".")[1]
            .split("_")
            .map((w: any) => w[0].toUpperCase() + w.slice(1))
            .join(" ")}`,
        ],
      ],
    },
    {
      glob: new Minimatch("Digital.PrimeVideo.LocationData.csv"),
      parse: (item) => [
        "activity",
        DateTime.fromFormat(item["last_updated_at"], "MM/dd/yyyy"),
        ["Prime Video Location", item["last_seen_territory"]],
      ],
    },
    {
      glob: new Minimatch("Digital.Redemption.*.csv"),
      parse: (item) => [
        "billing",
        DateTime.fromISO(item["ClaimDate"]),
        ["Recipient Redeemed Gift", item["Title"]],
      ],
    },
    {
      glob: new Minimatch("Beneficiaries.csv"),
      parse: (item) => [
        "billing",
        DateTime.fromISO(item["StartDate"]),
        ["Received Benefits", item["ServiceProvider"]],
      ],
    },
    {
      glob: new Minimatch("Subscriptions.csv"),
      parse: (item) => [
        "billing",
        DateTime.fromISO(item["SubscriptionStartDate"]),
        ["Started Subscription", item["Marketplace"]],
      ],
    },
    {
      glob: new Minimatch(
        "**/Kindle.BooksPromotions.RewardOfferRepository.csv"
      ),
      parse: (item) => [
        "notification",
        DateTime.fromSQL(item["promotion_start_datetime"]),
        ["Offered Kindle Promotion"],
      ],
    },
    {
      glob: new Minimatch("Kindle.Devices.ReadingSession.csv"),
      parse: (item) => [
        "activity",
        DateTime.fromISO(item["end_timestamp"]),
        ["Read Kindle Book", item["ASIN"]],
      ],
    },
    {
      glob: new Minimatch(
        "**/Kindle.Reach.KindleNotifications.InappNotificationEvents.csv"
      ),
      parse: (item) => [
        "notification",
        DateTime.fromFormat(item["Timestamp"], "MM/dd/yyyy HH:mm", {
          zone: "UTC",
        }),
        ["Kindle Notification"],
      ],
    },
    {
      glob: new Minimatch(
        "OutboundNotifications.AmazonApplicationUpdateHistory.csv"
      ),
      parse: (item) => [
        "activity",
        DateTime.fromFormat(item["App Last Updated Time"], "MM/dd/yyyy HH:mm", {
          zone: "UTC",
        }),
        ["Updated App", `${item["Application"]} on ${item["Device"]}`],
      ],
    },
    {
      glob: new Minimatch(
        "OutboundNotifications.EmailDeliveryStatusFeedback.csv"
      ),
      parse: (item) => [
        "notification",
        DateTime.fromFormat(item["Email Delivered Time"], "MM/dd/yyyy HH:mm", {
          zone: "UTC",
        }),
        [`Email ${item["Email Delivery Status"]}`],
      ],
    },
    {
      glob: new Minimatch(
        "OutboundNotifications.NotificationEngagementEvents.csv"
      ),
      parse: (item) => [
        "notification",
        DateTime.fromFormat(item["Record Creation Date"], "MM/dd/yyyy HH:mm", {
          zone: "UTC",
        }),
        [`Email ${item["Event Type"]}`],
      ],
    },
    {
      glob: new Minimatch("OutboundNotifications.PushSentData.csv"),
      parse: (item) => [
        "notification",
        DateTime.fromFormat(item["Recorded Time"], "MM/dd/yyyy HH:mm", {
          zone: "UTC",
        }),
        ["Push Notification"],
      ],
    },
    {
      glob: new Minimatch("OutboundNotifications.SentNotifications.csv"),
      parse: (item) => [
        "notification",
        DateTime.fromFormat(item["Message Sent Time"], "MM/dd/yyyy HH:mm", {
          zone: "UTC",
        }),
        ["Sent Notification"],
      ],
    },
    {
      glob: new Minimatch("PaymentOptions.PaymentInstruments.csv"),
      tokenize: async (data) =>
        (await parseCSV(data)).filter(
          (row) => row["RegistrationDate"] !== "N/A"
        ),
      parse: (item) => [
        "billing",
        DateTime.fromFormat(item["RegistrationDate"], "MM/dd/yyyy HH:mm:ss z"),
        ["Added Card", `****${item["LastDigits"]}`],
      ],
    },
    {
      glob: new Minimatch("**/WholeFoodsMarket.Orders.csv"),
      parse: (item) => [
        "order",
        DateTime.fromFormat(item["order_datetime"], "MM/dd/yyyy HH:mm"),
        ["Whole Foods Order", item["product_name_purchased"]],
      ],
    },
    {
      glob: new Minimatch("**/PhysicalStores.WholeFoods.KeyRegistration.csv"),
      parse: (item) => [
        "activity",
        DateTime.fromFormat(item["Created"], "MM/dd/yyyy HH:mm"),
        ["Whole Foods Key Registered"],
      ],
    },
    {
      glob: new Minimatch("Retail.AuthenticationTokens.json"),
      tokenize: (data) => parseJSON(data).authenticationSessionRecords,
      parse: (item) => [
        "activity",
        DateTime.fromISO(item.creationTime),
        ["Logged In"],
      ],
    },
    {
      glob: new Minimatch("**/BuyerSellerMessaging.csv"),
      parse: (item) => [
        "notification",
        DateTime.fromSQL(item["Timestamp"]),
        ["Seller Message", item["MessageSubject"]],
      ],
    },
    {
      glob: new Minimatch("**/Retail.CustomerProfile.Misc.csv"),
      parse: (item) => [
        "activity",
        DateTime.fromFormat(
          item["profileLastOnboardingTime"],
          "MM/dd/yyyy HH:mm:ss",
          { zone: "UTC" }
        ),
        ["Updated Customer Profile"],
      ],
    },
    {
      glob: new Minimatch("**/Retail.CustomerProfile.PrivacySettings.csv"),
      parse: (item) => [
        "activity",
        DateTime.fromFormat(item["lastModified"], "MM/dd/yyyy HH:mm:ss", {
          zone: "UTC",
        }),
        ["Updated Privacy Settings"],
      ],
    },
    {
      glob: new Minimatch("Retail.CustomerReturns.*.csv"),
      parse: (item) => [
        "billing",
        item["DateOfReturn"][0].match(/[0-9]/)
          ? DateTime.fromSQL(item["DateOfReturn"], {
              zone: "UTC",
            })
          : DateTime.fromFormat(
              item["DateOfReturn"],
              "EEE, dd MMM yyyy HH:mm:ss z"
            ),
        [
          `${item["Resolution"] || "Refund/Return"}`,
          item["ReturnReason"]
            .split(" ")
            .map((w: any) => w[0].toUpperCase() + w.slice(1))
            .join(" "),
        ],
      ],
    },
    {
      glob: new Minimatch("Retail.OrderHistory.*.csv"),
      parse: (item) => [
        "order",
        DateTime.fromFormat(item["Order Date"], "MM/dd/yyyy HH:mm:ss z", {
          zone: "UTC",
        }),
        ["Order", item["Product Name"]],
      ],
    },
    {
      glob: new Minimatch("Retail.OrdersReturned.Payments.*.csv"),
      tokenize: async (data) =>
        (await parseCSV(data)).filter(
          (row) => row["RefundCompletionDate"] !== "N/A"
        ),
      parse: (item) => [
        "billing",
        DateTime.fromFormat(
          item["RefundCompletionDate"],
          "MM/dd/yyyy HH:mm:ss z",
          {
            zone: "UTC",
          }
        ),
        [`Payment ${item["DisbursementType"]}`],
      ],
    },
    {
      glob: new Minimatch("Retail.OrdersReturned.*.csv"),
      parse: (item) => [
        "billing",
        DateTime.fromFormat(item["CreationDate"], "MM/dd/yyyy HH:mm:ss z", {
          zone: "UTC",
        }),
        [
          `Return ${
            item["ReversalAmountState"] === "Final"
              ? "Finalized"
              : item["ReversalAmountState"]
          }`,
        ],
      ],
    },
    {
      glob: new Minimatch(
        "**/Retail.OutboundNotifications.MobileApplications.csv"
      ),
      parse: (item) => [
        "activity",
        DateTime.fromFormat(item["App Registration Time"], "MM/dd/yyyy HH:mm", {
          zone: "UTC",
        }),
        ["Registered App", item["Device"]],
      ],
    },
    {
      glob: new Minimatch(
        "**/Retail.OutboundNotifications.notificationMetadata*.csv"
      ),
      tokenize: (data) =>
        parseCSV(smartDecode(data).replace(/\nFile Summary:[\s\S]*/g, "")),
      parse: (item) => [
        "notification",
        DateTime.fromFormat(item["Sent Time"], "EEE MMM dd HH:mm:ss z yyyy"),
        ["Notification"],
      ],
    },
    {
      glob: new Minimatch("Retail.Promotions.csv"),
      parse: (item) => [
        "billing",
        DateTime.fromFormat(item["creationTime"], "MM/dd/yyyy HH:mm", {
          zone: "UTC",
        }),
        ["Used Promotion", item["promotionDescription"]],
      ],
    },
    {
      glob: new Minimatch("Retail.RegionAuthority.*.csv"),
      parse: (item) => [
        "activity",
        DateTime.fromISO(item["Timestamp"]),
        ["Detected Region", item["City"]],
      ],
    },
    {
      glob: new Minimatch("**/Retail.Reorder.DigitalDashButton.csv"),
      tokenize: async (data) =>
        (await parseCSV(data))
          .slice(1) // skip documentation row
          .filter((row) => row["buttonCreationTime (GMT)"]),
      parse: (item) => [
        "activity",
        DateTime.fromFormat(
          item["buttonCreationTime (GMT)"],
          "MM/dd/yyyy HH:mm",
          {
            zone: "UTC",
          }
        ),
        ["Created Dash Button", item["productTitle"].slice(1, -1)],
      ],
    },
    {
      glob: new Minimatch("Retail.Search-Data.Retail.Customer-Engagement.csv"),
      parse: (item) => {
        let query;
        try {
          const params = new URLSearchParams(item["First Search Query String"]);
          if (params.has("field-keywords")) {
            query = params.get("field-keywords");
          } else if (params.has("k")) {
            query = params.get("k");
          }
        } catch {}
        return [
          "activity",
          DateTime.fromISO(item["Last search Time (GMT)"]),
          ["Search", query ? query : undefined],
        ];
      },
    },
    {
      glob: new Minimatch("Retail.ShoppingProfile.*.csv"),
      parse: (item) => [
        "activity",
        DateTime.fromFormat(item["Date"], "MM/dd/yyyy HH:mm", {
          zone: "UTC",
        }),
        ["Profile Attribute"],
      ],
    },
    {
      glob: new Minimatch("Billing and Refunds Data.csv"),
      parse: (item) => [
        "billing",
        DateTime.fromSQL(item["TransactionCreationDate"]),
        [
          "Transaction",
          item["TransactionReason"].replace(/(.)([A-Z])/g, "$1 $2"),
        ],
      ],
    },
  ];

  async parse(
    file: DataFile,
    metadata: Map<string, any>
  ): Promise<ReadonlyArray<TimelineEntry<CategoryKey>>> {
    return await parseByStages(file, metadata, this.timelineParsers, []);
  }
}

export default Amazon;
