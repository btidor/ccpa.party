import { DateTime } from "luxon";

import {
  smartDecode,
  getSlugAndDayTime,
  parseCSV,
  parseJSON,
} from "common/parse";

import type { DataFile, TimelineEntry } from "common/database";
import type { Provider, TimelineCategory } from "common/provider";

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

  async parse(
    file: DataFile
  ): Promise<ReadonlyArray<TimelineEntry<CategoryKey>>> {
    if (
      file.path[1] === "Location" &&
      file.path[2]?.startsWith("Country of Residence")
    ) {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "activity",
        ...getSlugAndDayTime(
          DateTime.fromISO(row["Timestamp"]).toSeconds(),
          row
        ),
        context: ["Set Alexa country of residence", row["Country"]],
        value: row,
      }));
    } else if (file.path[1] === "account.csv") {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "activity",
        ...getSlugAndDayTime(
          DateTime.fromSQL(row["Account_Creation_Time"]).toSeconds(),
          row
        ),
        context: ["Created Music Account", row["Music_Territory"]],
        value: row,
      }));
    } else if (file.path[1] === "library.csv") {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "order",
        ...getSlugAndDayTime(
          DateTime.fromISO(row["creationDate"]).toSeconds(),
          row
        ),
        context: [
          "Added to Music Library",
          `${row["title"]} (${row["albumName"]})`,
        ],
        value: row,
      }));
    } else if (
      file.path[1] === "AmazonSmile.AggregateCustomerDonation.Data.csv"
    ) {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "activity",
        ...getSlugAndDayTime(
          DateTime.fromFormat(row["LastUpdatedTimeInUTC"], "MM/dd/yyyy HH:mm", {
            zone: "UTC",
          }).toSeconds(),
          row
        ),
        context: ["AmazonSmile Summary"],
        value: row,
      }));
    } else if (
      file.path[1] === "AmazonSmile.CharitySelectionHistory.Data.csv"
    ) {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "activity",
        ...getSlugAndDayTime(
          DateTime.fromFormat(row["SelectionTimeInUTC"], "MM/dd/yyyy HH:mm", {
            zone: "UTC",
          }).toSeconds(),
          row
        ),
        context: ["Selected AmazonSmile Charity", row["CharityName"]],
        value: row,
      }));
    } else if (
      file.path[1] === "Appstore" &&
      file.path[4] === "subscription-transaction.csv"
    ) {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "billing",
        ...getSlugAndDayTime(
          DateTime.fromSQL(row["transaction_creation_date"], {
            zone: "UTC",
          }).toSeconds(),
          row
        ),
        context: ["App Store Subscription", row["transaction_item_id"]],
        value: row,
      }));
    } else if (file.path[1] === "Audible.CartHistory.csv") {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "activity",
        ...getSlugAndDayTime(DateTime.fromSQL(row["AddDate"]).toSeconds(), row),
        context: ["Added to Audible Cart", row["Title"]],
        value: row,
      }));
    } else if (file.path[1] === "Audible.Credits.csv") {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "billing",
        ...getSlugAndDayTime(
          DateTime.fromSQL(row["IssueDate"]).toSeconds(),
          row
        ),
        context: ["Received Audible Credit"],
        value: row,
      }));
    } else if (file.path[1] === "Audible.DevicesActivations.csv") {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "activity",
        ...getSlugAndDayTime(
          DateTime.fromSQL(row["StartDate"]).toSeconds(),
          row
        ),
        context: ["Activated Audible", row["DeviceCategory"]],
        value: row,
      }));
    } else if (file.path[1] === "Audible.Library.csv") {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "order",
        ...getSlugAndDayTime(
          DateTime.fromSQL(row["DateAdded"]).toSeconds(),
          row
        ),
        context: ["Added to Audible Library", row["Title"]],
        value: row,
      }));
    } else if (file.path[1] === "Audible.MembershipBillings.csv") {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "billing",
        ...getSlugAndDayTime(
          DateTime.fromSQL(row["TaxCreateDate"]).toSeconds(),
          row
        ),
        context: ["Audible Billing Event", row["OfferName"]],
        value: row,
      }));
    } else if (file.path[1] === "Audible.MembershipEvent.csv") {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "activity",
        ...getSlugAndDayTime(
          DateTime.fromSQL(row["EventDate"]).toSeconds(),
          row
        ),
        context: ["Audible Membership Event", row["BusinessEventTypeName"]],
        value: row,
      }));
    } else if (file.path[1] === "Audible.PurchaseHistory.csv") {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "order",
        ...getSlugAndDayTime(
          DateTime.fromSQL(row["OrderPlaceDate"]).toSeconds(),
          row
        ),
        context: ["Audible Purchase", row["Title"]],
        value: row,
      }));
    } else if (
      file.path[4] === "CustomerCommunicationExperience.Preferences.csv" ||
      file.path[4] ===
        "CustomerCommunicationExperience.PreferencesEmailHistory.csv"
    ) {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "notification",
        ...getSlugAndDayTime(
          DateTime.fromFormat(
            row["ActionTimestamp"],
            "M/d/yy h:mm:ss a z"
          ).toSeconds(),
          row
        ),
        context: ["Notification Event", row["NotificationTopic"]],
        value: row,
      }));
    } else if (file.path[1] === "registration.csv") {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "activity",
        ...getSlugAndDayTime(
          DateTime.fromISO(row["FirstTimeRegistered"]).toSeconds(),
          row
        ),
        context: ["Registered Device", row["AccountName"]],
        value: row,
      }));
    } else if (file.path[1] === "Digital Items.csv") {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "order",
        ...getSlugAndDayTime(
          DateTime.fromSQL(row["OrderDate"]).toSeconds(),
          row
        ),
        context: ["Digital Order", row["Title"]],
        value: row,
      }));
    } else if (file.path[1] === "Digital Orders.csv") {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "order",
        ...getSlugAndDayTime(
          DateTime.fromSQL(row["OrderDate"]).toSeconds(),
          row
        ),
        context: ["Digital Order", row["OrderId"]],
        value: row,
      }));
    } else if (file.path[1].startsWith("Digital.ActionBenefit.")) {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "notification",
        ...getSlugAndDayTime(
          DateTime.fromSQL(row["BenefitDate"]).toSeconds(),
          row
        ),
        context: ["Qualified for Promotion"],
        value: row,
      }));
    } else if (file.path[1] === "whispersync.csv") {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "activity",
        ...getSlugAndDayTime(
          DateTime.fromISO(row["Customer modified date on device"]).toSeconds(),
          row
        ),
        context: [
          `Whispersync ${row["Annotation Type"]
            .split(".")[1]
            .split("_")
            .map((w) => w[0].toUpperCase() + w.slice(1))
            .join(" ")}`,
        ],
        value: row,
      }));
    } else if (file.path[1] === "Digital.PrimeVideo.LocationData.csv") {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "activity",
        ...getSlugAndDayTime(
          DateTime.fromFormat(row["last_updated_at"], "MM/dd/yyyy").toSeconds(),
          row
        ),
        context: ["Prime Video Location", row["last_seen_territory"]],
        value: row,
      }));
    } else if (file.path[1].startsWith("Digital.Redemption.")) {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "billing",
        ...getSlugAndDayTime(
          DateTime.fromISO(row["ClaimDate"]).toSeconds(),
          row
        ),
        context: ["Recipient Redeemed Gift", row["Title"]],
        value: row,
      }));
    } else if (file.path[1] === "Beneficiaries.csv") {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "billing",
        ...getSlugAndDayTime(
          DateTime.fromISO(row["StartDate"]).toSeconds(),
          row
        ),
        context: ["Received Benefits", row["ServiceProvider"]],
        value: row,
      }));
    } else if (file.path[1] === "Subscriptions.csv") {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "billing",
        ...getSlugAndDayTime(
          DateTime.fromISO(row["SubscriptionStartDate"]).toSeconds(),
          row
        ),
        context: ["Started Subscription", row["Marketplace"]],
        value: row,
      }));
    } else if (
      file.path[4] === "Kindle.BooksPromotions.RewardOfferRepository.csv"
    ) {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "notification",
        ...getSlugAndDayTime(
          DateTime.fromSQL(row["promotion_start_datetime"]).toSeconds(),
          row
        ),
        context: ["Offered Kindle Promotion"],
        value: row,
      }));
    } else if (file.path[1] === "Kindle.Devices.ReadingSession.csv") {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "activity",
        ...getSlugAndDayTime(
          DateTime.fromISO(row["end_timestamp"]).toSeconds(),
          row
        ),
        context: ["Read Kindle Book", row["ASIN"]],
        value: row,
      }));
    } else if (
      file.path[4] ===
      "Kindle.Reach.KindleNotifications.InappNotificationEvents.csv"
    ) {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "notification",
        ...getSlugAndDayTime(
          DateTime.fromFormat(row["Timestamp"], "MM/dd/yyyy HH:mm", {
            zone: "UTC",
          }).toSeconds(),
          row
        ),
        context: ["Kindle Notification"],
        value: row,
      }));
    } else if (
      file.path[1] ===
      "OutboundNotifications.AmazonApplicationUpdateHistory.csv"
    ) {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "activity",
        ...getSlugAndDayTime(
          DateTime.fromFormat(
            row["App Last Updated Time"],
            "MM/dd/yyyy HH:mm",
            {
              zone: "UTC",
            }
          ).toSeconds(),
          row
        ),
        context: ["Updated App", `${row["Application"]} on ${row["Device"]}`],
        value: row,
      }));
    } else if (
      file.path[1] === "OutboundNotifications.EmailDeliveryStatusFeedback.csv"
    ) {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "notification",
        ...getSlugAndDayTime(
          DateTime.fromFormat(row["Email Delivered Time"], "MM/dd/yyyy HH:mm", {
            zone: "UTC",
          }).toSeconds(),
          row
        ),
        context: [`Email ${row["Email Delivery Status"]}`],
        value: row,
      }));
    } else if (
      file.path[1] === "OutboundNotifications.NotificationEngagementEvents.csv"
    ) {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "notification",
        ...getSlugAndDayTime(
          DateTime.fromFormat(row["Record Creation Date"], "MM/dd/yyyy HH:mm", {
            zone: "UTC",
          }).toSeconds(),
          row
        ),
        context: [`Email ${row["Event Type"]}`],
        value: row,
      }));
    } else if (file.path[1] === "OutboundNotifications.PushSentData.csv") {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "notification",
        ...getSlugAndDayTime(
          DateTime.fromFormat(row["Recorded Time"], "MM/dd/yyyy HH:mm", {
            zone: "UTC",
          }).toSeconds(),
          row
        ),
        context: ["Push Notification"],
        value: row,
      }));
    } else if (file.path[1] === "OutboundNotifications.SentNotifications.csv") {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "notification",
        ...getSlugAndDayTime(
          DateTime.fromFormat(row["Message Sent Time"], "MM/dd/yyyy HH:mm", {
            zone: "UTC",
          }).toSeconds(),
          row
        ),
        context: ["Sent Notification"],
        value: row,
      }));
    } else if (file.path[1] === "PaymentOptions.PaymentInstruments.csv") {
      return (await parseCSV(file.data))
        .filter((row) => row["RegistrationDate"] !== "N/A")
        .map((row) => ({
          file: file.path,
          category: "billing",
          ...getSlugAndDayTime(
            DateTime.fromFormat(
              row["RegistrationDate"],
              "MM/dd/yyyy HH:mm:ss z"
            ).toSeconds(),
            row
          ),
          context: ["Added Card", `****${row["LastDigits"]}`],
          value: row,
        }));
    } else if (file.path[4] === "WholeFoodsMarket.Orders.csv") {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "order",
        ...getSlugAndDayTime(
          DateTime.fromFormat(
            row["order_datetime"],
            "MM/dd/yyyy HH:mm"
          ).toSeconds(),
          row
        ),
        context: ["Whole Foods Order", row["product_name_purchased"]],
        value: row,
      }));
    } else if (
      file.path[4] === "PhysicalStores.WholeFoods.KeyRegistration.csv"
    ) {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "activity",
        ...getSlugAndDayTime(
          DateTime.fromFormat(row["Created"], "MM/dd/yyyy HH:mm").toSeconds(),
          row
        ),
        context: ["Whole Foods Key Registered"],
        value: row,
      }));
    } else if (file.path[1] === "Retail.AuthenticationTokens.json") {
      const parsed = parseJSON(file.data);
      return parsed.authenticationSessionRecords.map((row: any) => ({
        file: file.path,
        category: "activity",
        ...getSlugAndDayTime(
          DateTime.fromISO(row.creationTime).toSeconds(),
          row
        ),
        context: ["Logged In"],
        value: row,
      }));
    } else if (file.path[4] === "BuyerSellerMessaging.csv") {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "notification",
        ...getSlugAndDayTime(
          DateTime.fromSQL(row["Timestamp"]).toSeconds(),
          row
        ),
        context: ["Seller Message", row["MessageSubject"]],
        value: row,
      }));
    } else if (file.path[4] === "Retail.CustomerProfile.Misc.csv") {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "activity",
        ...getSlugAndDayTime(
          DateTime.fromFormat(
            row["profileLastOnboardingTime"],
            "MM/dd/yyyy HH:mm:ss",
            { zone: "UTC" }
          ).toSeconds(),
          row
        ),
        context: ["Updated Customer Profile"],
        value: row,
      }));
    } else if (file.path[4] === "Retail.CustomerProfile.PrivacySettings.csv") {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "activity",
        ...getSlugAndDayTime(
          DateTime.fromFormat(row["lastModified"], "MM/dd/yyyy HH:mm:ss", {
            zone: "UTC",
          }).toSeconds(),
          row
        ),
        context: ["Updated Privacy Settings"],
        value: row,
      }));
    } else if (file.path[1].startsWith("Retail.CustomerReturns.")) {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "billing",
        ...getSlugAndDayTime(
          row["DateOfReturn"][0].match(/[0-9]/)
            ? DateTime.fromSQL(row["DateOfReturn"], {
                zone: "UTC",
              }).toSeconds()
            : DateTime.fromFormat(
                row["DateOfReturn"],
                "EEE, dd MMM yyyy HH:mm:ss z"
              ).toSeconds(),
          row
        ),
        context: [
          `${row["Resolution"] || "Refund/Return"}`,
          row["ReturnReason"]
            .split(" ")
            .map((w) => w[0].toUpperCase() + w.slice(1))
            .join(" "),
        ],
        value: row,
      }));
    } else if (file.path[1].startsWith("Retail.OrderHistory.")) {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "order",
        ...getSlugAndDayTime(
          DateTime.fromFormat(row["Order Date"], "MM/dd/yyyy HH:mm:ss z", {
            zone: "UTC",
          }).toSeconds(),
          row
        ),
        context: ["Order", row["Product Name"]],
        value: row,
      }));
    } else if (file.path[1].startsWith("Retail.OrdersReturned.Payments.")) {
      return (await parseCSV(file.data))
        .filter((row) => row["RefundCompletionDate"] !== "N/A")
        .map((row) => ({
          file: file.path,
          category: "billing",
          ...getSlugAndDayTime(
            DateTime.fromFormat(
              row["RefundCompletionDate"],
              "MM/dd/yyyy HH:mm:ss z",
              {
                zone: "UTC",
              }
            ).toSeconds(),
            row
          ),
          context: [`Payment ${row["DisbursementType"]}`],
          value: row,
        }));
    } else if (file.path[1].startsWith("Retail.OrdersReturned.")) {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "billing",
        ...getSlugAndDayTime(
          DateTime.fromFormat(row["CreationDate"], "MM/dd/yyyy HH:mm:ss z", {
            zone: "UTC",
          }).toSeconds(),
          row
        ),
        context: [
          `Return ${
            row["ReversalAmountState"] === "Final"
              ? "Finalized"
              : row["ReversalAmountState"]
          }`,
        ],
        value: row,
      }));
    } else if (
      file.path[4] === "Retail.OutboundNotifications.MobileApplications.csv"
    ) {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "activity",
        ...getSlugAndDayTime(
          DateTime.fromFormat(
            row["App Registration Time"],
            "MM/dd/yyyy HH:mm",
            {
              zone: "UTC",
            }
          ).toSeconds(),
          row
        ),
        context: ["Registered App", row["Device"]],
        value: row,
      }));
    } else if (
      file.path[4]?.startsWith(
        "Retail.OutboundNotifications.notificationMetadata"
      )
    ) {
      // Strip out footer
      const raw = smartDecode(file.data).replace(/\nFile Summary:[\s\S]*/g, "");
      return (await parseCSV(raw)).map((row) => ({
        file: file.path,
        category: "notification",
        ...getSlugAndDayTime(
          DateTime.fromFormat(
            row["Sent Time"],
            "EEE MMM dd HH:mm:ss z yyyy"
          ).toSeconds(),
          row
        ),
        context: ["Notification"],
        value: row,
      }));
    } else if (file.path[1] === "Retail.Promotions.csv") {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "billing",
        ...getSlugAndDayTime(
          DateTime.fromFormat(row["creationTime"], "MM/dd/yyyy HH:mm", {
            zone: "UTC",
          }).toSeconds(),
          row
        ),
        context: ["Used Promotion", row["promotionDescription"]],
        value: row,
      }));
    } else if (file.path[1].startsWith("Retail.RegionAuthority.")) {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "activity",
        ...getSlugAndDayTime(
          DateTime.fromISO(row["Timestamp"]).toSeconds(),
          row
        ),
        context: ["Detected Region", row["City"]],
        value: row,
      }));
    } else if (file.path[2] === "Retail.Reorder.DigitalDashButton.csv") {
      return (await parseCSV(file.data))
        .slice(1) // skip documentation row
        .filter((row) => row["buttonCreationTime (GMT)"])
        .map((row) => ({
          file: file.path,
          category: "activity",
          ...getSlugAndDayTime(
            DateTime.fromFormat(
              row["buttonCreationTime (GMT)"],
              "MM/dd/yyyy HH:mm",
              {
                zone: "UTC",
              }
            ).toSeconds(),
            row
          ),
          context: ["Created Dash Button", row["productTitle"].slice(1, -1)],
          value: row,
        }));
    } else if (
      file.path[1] === "Retail.Search-Data.Retail.Customer-Engagement.csv"
    ) {
      return (await parseCSV(file.data)).map((row) => {
        let query;
        try {
          const params = new URLSearchParams(row["First Search Query String"]);
          if (params.has("field-keywords")) {
            query = params.get("field-keywords");
          } else if (params.has("k")) {
            query = params.get("k");
          }
        } catch {}

        return {
          file: file.path,
          category: "activity",
          ...getSlugAndDayTime(
            DateTime.fromISO(row["Last search Time (GMT)"]).toSeconds(),
            row
          ),
          context: ["Search", query ? query : undefined],
          value: row,
        };
      });
    } else if (file.path[1].startsWith("Retail.ShoppingProfile.")) {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "activity",
        ...getSlugAndDayTime(
          DateTime.fromFormat(row["Date"], "MM/dd/yyyy HH:mm", {
            zone: "UTC",
          }).toSeconds(),
          row
        ),
        context: ["Profile Attribute"],
        value: row,
      }));
    } else if (file.path[1] === "Billing and Refunds Data.csv") {
      return (await parseCSV(file.data)).map((row) => ({
        file: file.path,
        category: "billing",
        ...getSlugAndDayTime(
          DateTime.fromSQL(row["TransactionCreationDate"]).toSeconds(),
          row
        ),
        context: [
          "Transaction",
          row["TransactionReason"].replace(/(.)([A-Z])/g, "$1 $2"),
        ],
        value: row,
      }));
    }
    return [];
  }
}

export default Amazon;
