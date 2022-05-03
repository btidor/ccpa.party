// @flow
import { DateTime } from "luxon";
import * as React from "react";

import { smartDecode, getSlugAndDay, parseCSV, parseJSON } from "database";

import type { DataFile, Entry, TimelineEntry } from "database";
import type { Provider, TimelineCategory } from "provider";

class Amazon implements Provider {
  slug: string = "amazon";
  displayName: string = "Amazon";
  color: string = "#ff9900";

  requestLink: {| href: string, text: string |} = {
    text: "Request My Data",
    href: "https://amazon.com/gp/privacycentral/dsar/preview.html",
  };
  waitTime: string = "1–2 days";
  instructions: $ReadOnlyArray<string> = [];
  privacyPolicy: string =
    "https://www.amazon.com/gp/help/customer/display.html?nodeId=GC5HB5DVMU5Y8CJ2";

  timelineCategories: $ReadOnlyArray<TimelineCategory> = [
    {
      char: "a",
      slug: "activity",
      displayName: "Activity",
      defaultEnabled: true,
    },
    {
      char: "b",
      slug: "billing",
      displayName: "Billing",
      defaultEnabled: true,
    },
    {
      char: "o",
      slug: "order",
      displayName: "Orders",
      defaultEnabled: true,
    },
  ];

  async parse(file: DataFile): Promise<$ReadOnlyArray<Entry>> {
    if (file.skipped) return [];
    if (
      file.path[1] === "Location" &&
      file.path[2]?.startsWith("Country of Residence")
    ) {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "activity",
            ...getSlugAndDay(
              DateTime.fromISO(row["Timestamp"]).toSeconds(),
              row
            ),
            context: `Set Alexa country of residence to ${row["Country"]}`,
            value: row,
          }: TimelineEntry)
      );
    } else if (file.path[1] === "account.csv") {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "activity",
            ...getSlugAndDay(
              DateTime.fromSQL(row["Account_Creation_Time"]).toSeconds(),
              row
            ),
            context: `Created music account in ${row["Music_Territory"]}`,
            value: row,
          }: TimelineEntry)
      );
    } else if (file.path[1] === "library.csv") {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "order",
            ...getSlugAndDay(
              DateTime.fromISO(row["creationDate"]).toSeconds(),
              row
            ),
            context: `Added to music library: ${row["title"]} from ${row["albumName"]}`,
            value: row,
          }: TimelineEntry)
      );
    } else if (
      file.path[1] === "AmazonSmile.AggregateCustomerDonation.Data.csv"
    ) {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "activity",
            ...getSlugAndDay(
              DateTime.fromFormat(
                row["LastUpdatedTimeInUTC"],
                "MM/dd/yyyy HH:mm",
                { zone: "UTC" }
              ).toSeconds(),
              row
            ),
            context: `AmazonSmile summary`,
            value: row,
          }: TimelineEntry)
      );
    } else if (
      file.path[1] === "AmazonSmile.CharitySelectionHistory.Data.csv"
    ) {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "activity",
            ...getSlugAndDay(
              DateTime.fromFormat(
                row["SelectionTimeInUTC"],
                "MM/dd/yyyy HH:mm",
                { zone: "UTC" }
              ).toSeconds(),
              row
            ),
            context: `Selected AmazonSmile charity ${row["CharityName"]}`,
            value: row,
          }: TimelineEntry)
      );
    } else if (
      file.path[1] === "Appstore" &&
      file.path[4] === "subscription-transaction.csv"
    ) {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "billing",
            ...getSlugAndDay(
              DateTime.fromSQL(row["transaction_creation_date"], {
                zone: "UTC",
              }).toSeconds(),
              row
            ),
            context: `App store subscription`,
            value: row,
          }: TimelineEntry)
      );
    } else if (file.path[1] === "Audible.CartHistory.csv") {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "activity",
            ...getSlugAndDay(DateTime.fromSQL(row["AddDate"]).toSeconds(), row),
            context: `Added to Audible cart: ${row["Title"]}`,
            value: row,
          }: TimelineEntry)
      );
    } else if (file.path[1] === "Audible.Credits.csv") {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "billing",
            ...getSlugAndDay(
              DateTime.fromSQL(row["IssueDate"]).toSeconds(),
              row
            ),
            context: `Received Audible credit`,
            value: row,
          }: TimelineEntry)
      );
    } else if (file.path[1] === "Audible.DevicesActivations.csv") {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "activity",
            ...getSlugAndDay(
              DateTime.fromSQL(row["StartDate"]).toSeconds(),
              row
            ),
            context: `Activated Audible with ${row["DeviceCategory"]}`,
            value: row,
          }: TimelineEntry)
      );
    } else if (file.path[1] === "Audible.Library.csv") {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "order",
            ...getSlugAndDay(
              DateTime.fromSQL(row["DateAdded"]).toSeconds(),
              row
            ),
            context: `Added to Audible library: ${row["Title"]}`,
            value: row,
          }: TimelineEntry)
      );
    } else if (file.path[1] === "Audible.MembershipBillings.csv") {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "billing",
            ...getSlugAndDay(
              DateTime.fromSQL(row["TaxCreateDate"]).toSeconds(),
              row
            ),
            context: `Audible billing event for ${row["OfferName"]}`,
            value: row,
          }: TimelineEntry)
      );
    } else if (file.path[1] === "Audible.MembershipEvent.csv") {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "activity",
            ...getSlugAndDay(
              DateTime.fromSQL(row["EventDate"]).toSeconds(),
              row
            ),
            context: `Audible membership event: ${row["BusinessEventTypeName"]}`,
            value: row,
          }: TimelineEntry)
      );
    } else if (file.path[1] === "Audible.PurchaseHistory.csv") {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "order",
            ...getSlugAndDay(
              DateTime.fromSQL(row["OrderPlaceDate"]).toSeconds(),
              row
            ),
            context: `Audible purchase: ${row["Title"]}`,
            value: row,
          }: TimelineEntry)
      );
    } else if (
      file.path[4] === "CustomerCommunicationExperience.Preferences.csv"
    ) {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "activity",
            ...getSlugAndDay(
              DateTime.fromFormat(
                row["ActionTimestamp"],
                "M/d/yy h:mm:ss a z"
              ).toSeconds(),
              row
            ),
            context: `Notification event`,
            value: row,
          }: TimelineEntry)
      );
    } else if (
      file.path[4] ===
      "CustomerCommunicationExperience.PreferencesEmailHistory.csv"
    ) {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "activity",
            ...getSlugAndDay(
              DateTime.fromFormat(
                row["ActionTimestamp"],
                "M/d/yy h:mm:ss a z"
              ).toSeconds(),
              row
            ),
            context: `Notification event`,
            value: row,
          }: TimelineEntry)
      );
    } else if (file.path[1] === "registration.csv") {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "activity",
            ...getSlugAndDay(
              DateTime.fromISO(row["FirstTimeRegistered"]).toSeconds(),
              row
            ),
            context: `Registered device: ${row["AccountName"]}`,
            value: row,
          }: TimelineEntry)
      );
    } else if (file.path[1] === "Digital Items.csv") {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "order",
            ...getSlugAndDay(
              DateTime.fromSQL(row["OrderDate"]).toSeconds(),
              row
            ),
            context: `Ordered digital item: ${row["Title"]}`,
            value: row,
          }: TimelineEntry)
      );
    } else if (file.path[1] === "Digital Orders.csv") {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "order",
            ...getSlugAndDay(
              DateTime.fromSQL(row["OrderDate"]).toSeconds(),
              row
            ),
            context: `Digital order ${row["OrderId"]}`,
            value: row,
          }: TimelineEntry)
      );
    } else if (file.path[1].startsWith("Digital.ActionBenefit.")) {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "billing",
            ...getSlugAndDay(
              DateTime.fromSQL(row["BenefitDate"]).toSeconds(),
              row
            ),
            context: `Qualified for promotion`,
            value: row,
          }: TimelineEntry)
      );
    } else if (
      file.path[1].startsWith("Digital.Content.Ownership.") &&
      file.path[1].endsWith(".json")
    ) {
      const parsed = parseJSON(file.data);
      return [
        ({
          type: "timeline",
          provider: file.provider,
          file: file.path,
          category: "order",
          ...getSlugAndDay(
            DateTime.fromISO(parsed.rights[0].acquiredDate).toSeconds(),
            parsed
          ),
          context: `Acquired digital item ${parsed.resource.ASIN}`,
          value: parsed,
        }: TimelineEntry),
      ];
    } else if (file.path[1] === "whispersync.csv") {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "activity",
            ...getSlugAndDay(
              DateTime.fromISO(
                row["Customer modified date on device"]
              ).toSeconds(),
              row
            ),
            context: `Whispersync ${row["Annotation Type"]}`,
            value: row,
          }: TimelineEntry)
      );
    } else if (file.path[1] === "Digital.PrimeVideo.LocationData.csv") {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "activity",
            ...getSlugAndDay(
              DateTime.fromFormat(
                row["last_updated_at"],
                "MM/dd/yyyy"
              ).toSeconds(),
              row
            ),
            context: `Seen in Prime Video territory: ${row["last_seen_territory"]}`,
            value: row,
          }: TimelineEntry)
      );
    } else if (file.path[1].startsWith("Digital.Redemption.")) {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "billing",
            ...getSlugAndDay(
              DateTime.fromISO(row["ClaimDate"]).toSeconds(),
              row
            ),
            context: `Recipient redeemed gift: ${row["Title"]}`,
            value: row,
          }: TimelineEntry)
      );
    } else if (file.path[1] === "Beneficiaries.csv") {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "billing",
            ...getSlugAndDay(
              DateTime.fromISO(row["StartDate"]).toSeconds(),
              row
            ),
            context: `Started receiving subscription benefits for ${row["ServiceProvider"]}`,
            value: row,
          }: TimelineEntry)
      );
    } else if (file.path[1] === "Subscriptions.csv") {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "billing",
            ...getSlugAndDay(
              DateTime.fromISO(row["SubscriptionStartDate"]).toSeconds(),
              row
            ),
            context: `Started subscription on ${row["Marketplace"]}`,
            value: row,
          }: TimelineEntry)
      );
    } else if (
      file.path[4] === "Kindle.BooksPromotions.RewardOfferRepository.csv"
    ) {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "billing",
            ...getSlugAndDay(
              DateTime.fromSQL(row["promotion_start_datetime"]).toSeconds(),
              row
            ),
            context: `Qualified for Kindle promotion`,
            value: row,
          }: TimelineEntry)
      );
    } else if (file.path[1] === "Kindle.Devices.ReadingSession.csv") {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "activity",
            ...getSlugAndDay(
              DateTime.fromISO(row["end_timestamp"]).toSeconds(),
              row
            ),
            context: `Read from Kindle book ${row["ASIN"]}`,
            value: row,
          }: TimelineEntry)
      );
    } else if (
      file.path[4] ===
      "Kindle.Reach.KindleNotifications.InappNotificationEvents.csv"
    ) {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "activity",
            ...getSlugAndDay(
              DateTime.fromFormat(row["Timestamp"], "MM/dd/yyyy HH:mm", {
                zone: "UTC",
              }).toSeconds(),
              row
            ),
            context: `Kindle notification`,
            value: row,
          }: TimelineEntry)
      );
    } else if (
      file.path[1] ===
      "OutboundNotifications.AmazonApplicationUpdateHistory.csv"
    ) {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "activity",
            ...getSlugAndDay(
              DateTime.fromFormat(
                row["App Last Updated Time"],
                "MM/dd/yyyy HH:mm",
                {
                  zone: "UTC",
                }
              ).toSeconds(),
              row
            ),
            context: `Updated ${row["Application"]} app on ${row["Device"]}`,
            value: row,
          }: TimelineEntry)
      );
    } else if (
      file.path[1] === "OutboundNotifications.EmailDeliveryStatusFeedback.csv"
    ) {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "activity",
            ...getSlugAndDay(
              DateTime.fromFormat(
                row["Email Delivered Time"],
                "MM/dd/yyyy HH:mm",
                {
                  zone: "UTC",
                }
              ).toSeconds(),
              row
            ),
            context: `Email ${row["Email Delivery Status"]}`,
            value: row,
          }: TimelineEntry)
      );
    } else if (
      file.path[1] === "OutboundNotifications.NotificationEngagementEvents.csv"
    ) {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "activity",
            ...getSlugAndDay(
              DateTime.fromFormat(
                row["Record Creation Date"],
                "MM/dd/yyyy HH:mm",
                {
                  zone: "UTC",
                }
              ).toSeconds(),
              row
            ),
            context: `Email ${row["Event Type"]}`,
            value: row,
          }: TimelineEntry)
      );
    } else if (file.path[1] === "OutboundNotifications.PushSentData.csv") {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "activity",
            ...getSlugAndDay(
              DateTime.fromFormat(row["Recorded Time"], "MM/dd/yyyy HH:mm", {
                zone: "UTC",
              }).toSeconds(),
              row
            ),
            context: `Push notification to ${row["Device"]}`,
            value: row,
          }: TimelineEntry)
      );
    } else if (file.path[1] === "OutboundNotifications.SentNotifications.csv") {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "activity",
            ...getSlugAndDay(
              DateTime.fromFormat(
                row["Message Sent Time"],
                "MM/dd/yyyy HH:mm",
                {
                  zone: "UTC",
                }
              ).toSeconds(),
              row
            ),
            context: `Sent notification`,
            value: row,
          }: TimelineEntry)
      );
    } else if (file.path[1] === "PaymentOptions.PaymentInstruments.csv") {
      return (await parseCSV(file.data))
        .filter((row) => row["RegistrationDate"] !== "N/A")
        .map(
          (row) =>
            ({
              type: "timeline",
              provider: file.provider,
              file: file.path,
              category: "billing",
              ...getSlugAndDay(
                DateTime.fromFormat(
                  row["RegistrationDate"],
                  "MM/dd/yyyy HH:mm:ss z"
                ).toSeconds(),
                row
              ),
              context: `Added card ****${row["LastDigits"]}`,
              value: row,
            }: TimelineEntry)
        );
    } else if (file.path[4] === "WholeFoodsMarket.Orders.csv") {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "order",
            ...getSlugAndDay(
              DateTime.fromFormat(
                row["order_datetime"],
                "MM/dd/yyyy HH:mm"
              ).toSeconds(),
              row
            ),
            context: `Whole Foods purchase: ${row["product_name_purchased"]}`,
            value: row,
          }: TimelineEntry)
      );
    } else if (
      file.path[4] === "PhysicalStores.WholeFoods.KeyRegistration.csv"
    ) {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "activity",
            ...getSlugAndDay(
              DateTime.fromFormat(
                row["Created"],
                "MM/dd/yyyy HH:mm"
              ).toSeconds(),
              row
            ),
            context: `Whole Foods key registered`,
            value: row,
          }: TimelineEntry)
      );
    } else if (file.path[1] === "Retail.AuthenticationTokens.json") {
      const parsed = parseJSON(file.data);
      return parsed.authenticationSessionRecords.map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "activity",
            ...getSlugAndDay(
              DateTime.fromISO(row.creationTime).toSeconds(),
              row
            ),
            context: `Logged in`,
            value: row,
          }: TimelineEntry)
      );
    } else if (file.path[4] === "BuyerSellerMessaging.csv") {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "activity",
            ...getSlugAndDay(
              DateTime.fromSQL(row["Timestamp"]).toSeconds(),
              row
            ),
            context: `Message: ${row["MessageSubject"]}`,
            value: row,
          }: TimelineEntry)
      );
    } else if (file.path[4] === "Retail.CustomerProfile.Misc.csv") {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "activity",
            ...getSlugAndDay(
              DateTime.fromFormat(
                row["profileLastOnboardingTime"],
                "MM/dd/yyyy HH:mm:ss",
                { zone: "UTC" }
              ).toSeconds(),
              row
            ),
            context: `Updated customer profile`,
            value: row,
          }: TimelineEntry)
      );
    } else if (file.path[4] === "Retail.CustomerProfile.PrivacySettings.csv") {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "activity",
            ...getSlugAndDay(
              DateTime.fromFormat(row["lastModified"], "MM/dd/yyyy HH:mm:ss", {
                zone: "UTC",
              }).toSeconds(),
              row
            ),
            context: `Updated privacy settings`,
            value: row,
          }: TimelineEntry)
      );
    } else if (file.path[1].startsWith("Retail.CustomerReturns.")) {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "billing",
            ...getSlugAndDay(
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
            context: `${row["Resolution"] || "Refund/Return"}: ${
              row["ReturnReason"]
            }`,
            value: row,
          }: TimelineEntry)
      );
    } else if (file.path[1].startsWith("Retail.OrderHistory.")) {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "billing",
            ...getSlugAndDay(
              DateTime.fromFormat(row["Order Date"], "MM/dd/yyyy HH:mm:ss z", {
                zone: "UTC",
              }).toSeconds(),
              row
            ),
            context: `Ordered ${row["Product Name"]}`,
            value: row,
          }: TimelineEntry)
      );
    } else if (file.path[1].startsWith("Retail.OrdersReturned.Payments.")) {
      return (await parseCSV(file.data))
        .filter((row) => row["RefundCompletionDate"] !== "N/A")
        .map(
          (row) =>
            ({
              type: "timeline",
              provider: file.provider,
              file: file.path,
              category: "billing",
              ...getSlugAndDay(
                DateTime.fromFormat(
                  row["RefundCompletionDate"],
                  "MM/dd/yyyy HH:mm:ss z",
                  {
                    zone: "UTC",
                  }
                ).toSeconds(),
                row
              ),
              context: `Payment ${row["DisbursementType"]}`,
              value: row,
            }: TimelineEntry)
        );
    } else if (file.path[1].startsWith("Retail.OrdersReturned.")) {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "billing",
            ...getSlugAndDay(
              DateTime.fromFormat(
                row["CreationDate"],
                "MM/dd/yyyy HH:mm:ss z",
                {
                  zone: "UTC",
                }
              ).toSeconds(),
              row
            ),
            context: `Return: ${row["ReversalReason"]}`,
            value: row,
          }: TimelineEntry)
      );
    } else if (
      file.path[4] === "Retail.OutboundNotifications.MobileApplications.csv"
    ) {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "activity",
            ...getSlugAndDay(
              DateTime.fromFormat(
                row["App Registration Time"],
                "MM/dd/yyyy HH:mm",
                {
                  zone: "UTC",
                }
              ).toSeconds(),
              row
            ),
            context: `Registered app on ${row["Device"]}`,
            value: row,
          }: TimelineEntry)
      );
    } else if (
      file.path[4]?.startsWith(
        "Retail.OutboundNotifications.notificationMetadata"
      )
    ) {
      // Strip out footer
      const raw = smartDecode(file.data).replace(/\nFile Summary:[\s\S]*/g, "");
      return (await parseCSV(raw)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "activity",
            ...getSlugAndDay(
              DateTime.fromFormat(
                row["Sent Time"],
                "EEE MMM dd HH:mm:ss z yyyy"
              ).toSeconds(),
              row
            ),
            context: `Sent notification`,
            value: row,
          }: TimelineEntry)
      );
    } else if (file.path[1] === "Retail.Promotions.csv") {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "billing",
            ...getSlugAndDay(
              DateTime.fromFormat(row["creationTime"], "MM/dd/yyyy HH:mm", {
                zone: "UTC",
              }).toSeconds(),
              row
            ),
            context: `Used promotion: ${row["promotionDescription"]}`,
            value: row,
          }: TimelineEntry)
      );
    } else if (file.path[1].startsWith("Retail.RegionAuthority.")) {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "activity",
            ...getSlugAndDay(
              DateTime.fromISO(row["Timestamp"]).toSeconds(),
              row
            ),
            context: `Region authority: ${row["City"]}`,
            value: row,
          }: TimelineEntry)
      );
    } else if (file.path[2] === "Retail.Reorder.DigitalDashButton.csv") {
      return (await parseCSV(file.data))
        .slice(1) // skip documentation row
        .filter((row) => row["buttonCreationTime (GMT)"])
        .map(
          (row) =>
            ({
              type: "timeline",
              provider: file.provider,
              file: file.path,
              category: "activity",
              ...getSlugAndDay(
                DateTime.fromFormat(
                  row["buttonCreationTime (GMT)"],
                  "MM/dd/yyyy HH:mm",
                  {
                    zone: "UTC",
                  }
                ).toSeconds(),
                row
              ),
              context: `Created Dash button: ${row["productTitle"].slice(
                1,
                -1
              )}`,
              value: row,
            }: TimelineEntry)
        );
    } else if (
      file.path[1] === "Retail.Search-Data.Retail.Customer-Engagement.csv"
    ) {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "activity",
            ...getSlugAndDay(
              DateTime.fromISO(row["Last search Time (GMT)"]).toSeconds(),
              row
            ),
            context: `Searched: ${row["First Search Query String"]}`,
            value: row,
          }: TimelineEntry)
      );
    } else if (file.path[1].startsWith("Retail.ShoppingProfile.")) {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "activity",
            ...getSlugAndDay(
              DateTime.fromFormat(row["Date"], "MM/dd/yyyy HH:mm", {
                zone: "UTC",
              }).toSeconds(),
              row
            ),
            context: `Profile: ${row["Question"]}`,
            value: row,
          }: TimelineEntry)
      );
    } else if (file.path[1] === "Billing and Refunds Data.csv") {
      return (await parseCSV(file.data)).map(
        (row) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "billing",
            ...getSlugAndDay(
              DateTime.fromSQL(row["TransactionCreationDate"]).toSeconds(),
              row
            ),
            context: `Transaction: ${row["TransactionReason"]}`,
            value: row,
          }: TimelineEntry)
      );
    }
    return [];
  }

  render(entry: TimelineEntry): React.Node {
    return <React.Fragment>{entry.context}</React.Fragment>;
  }
}

export default Amazon;
