import { Context, EventBridgeEvent, ScheduledEvent } from "aws-lambda";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import Parser from "rss-parser";

const RSS_URL = "https://mgpk-cdn.magazinepocket.com/static/rss/2620/feed.xml";
const DEFAULT_REGION = "ap-northeast-1";

type Config = {
	topicArn: string;
	region: string;
};

const getConfigFromEnv = (): Config => {
	const { TOPIC_ARN, AWS_REGION } = process.env;
	if (!TOPIC_ARN) {
		throw new Error("Missing environment variables: TOPIC_ARN");
	}
	return {
		topicArn: TOPIC_ARN,
		region: AWS_REGION ?? DEFAULT_REGION,
	};
};

const createSnsClient = (region: string) => new SNSClient({ region });

const sendMessage = async (client: SNSClient, topicArn: string, subject: string, message: string) => {
	const input = {
		TopicArn: topicArn,
		Subject: subject,
		Message: message,
	};
	const cmd = new PublishCommand(input);

	try {
		const res = await client.send(cmd);
		console.log("SNS publish succeeded:", { Subject: subject, TopicArn: topicArn });
		return res;
	} catch (err) {
		console.error("SNS publish failed:", err);
		throw err;
	}
};

const formatJstDateTime = (date: Date) => {
	const dtf = new Intl.DateTimeFormat("ja-JP", {
		timeZone: "Asia/Tokyo",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});

	const parts = dtf.formatToParts(date).reduce((acc, p) => {
		if (p.type !== "literal") acc[p.type] = p.value;
		return acc;
	}, {} as Record<string, string>);

	const yyyy = parts.year;
	const mm = parts.month;
	const dd = parts.day;
	const hh = (parts.hour ?? "").padStart(2, "0");
	const min = (parts.minute ?? "").padStart(2, "0");

	return `${yyyy}/${mm}/${dd} ${hh}:${min} (JST)`;
};

const buildMessage = (title: string, pubDate: Date, url: string) => {
	return [
		`『みいちゃんと山田さん』が公開されました！`,
		"",
		"詳細情報",
		`- タイトル: ${title}`,
		`- 配信日: ${formatJstDateTime(pubDate)}`,
		`- URL: ${url}`
	].join("\n");
};

type RssItem = Parser.Item;

const getCutoffDate = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000);

const requirePubDate = (item: RssItem, label: string): Date | null => {
	if (!item.pubDate) {
		console.log(`No pubDate found in the ${label} item.`);
		return null;
	}
	const d = new Date(item.pubDate);
	if (Number.isNaN(d.getTime())) {
		console.log(`Invalid pubDate found in the ${label} item:`, item.pubDate);
		return null;
	}
	return d;
};

const getItemDisplay = (item: RssItem) => ({
	title: item.title || "タイトルなし",
	url: item.link || "URLなし",
});

const fetchFeedItems = async () => {
	const parser = new Parser();
	const feed = await parser.parseURL(RSS_URL);
	return feed.items ?? [];
};

export const handler = async (
	event: EventBridgeEvent<"Scheduled Event", ScheduledEvent>,
	_: Context,
): Promise<void> => {
	console.log("Scheduled event received:", { id: event.id, time: event.time });

	const cfg = getConfigFromEnv();
	const sns = createSnsClient(cfg.region);

	const items = await fetchFeedItems();
	if (items.length === 0) {
		console.log("No items found in the RSS feed.");
		return;
	}

	const latestItem = items[0];
	const latestPubDate = requirePubDate(latestItem, "latest");
	if (!latestPubDate) return;

	const cutoff = getCutoffDate(24);
	if (latestPubDate <= cutoff) {
		console.log("No new items published since cutoff.", { cutoff: cutoff.toISOString() });
		return;
	}

	if (items.length < 2) {
		console.log("Only one item exists; nothing to notify (needs second latest item).");
		return;
	}

	const secondLatestItem = items[1];
	const secondLatestPubDate = requirePubDate(secondLatestItem, "second latest");
	if (!secondLatestPubDate) return;

	const { title, url } = getItemDisplay(secondLatestItem);
	const msg = buildMessage(title, secondLatestPubDate, url);

	await sendMessage(sns, cfg.topicArn, `配信予定: 『みいちゃんと山田さん』`, msg);
};

