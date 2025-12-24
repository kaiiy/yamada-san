import { Context, EventBridgeEvent, ScheduledEvent } from "aws-lambda";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import Parser from "rss-parser";

const RSS_URL = "https://mgpk-cdn.magazinepocket.com/static/rss/2620/feed.xml";
const DEFAULT_REGION = "ap-northeast-1";

type Config = {
	key: string;
	topicArn: string;
	region: string;
};

const getConfigFromEnv = (): Config => {
	const { KEY, TOPIC_ARN, AWS_REGION } = process.env;
	if (!KEY || !TOPIC_ARN) {
		throw new Error("Missing environment variables: KEY or TOPIC_ARN");
	}
	return {
		key: KEY,
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
	const yyyy = new Intl.DateTimeFormat("ja-JP", {
		timeZone: "Asia/Tokyo",
		year: "numeric",
	}).format(date);
	const mm = new Intl.DateTimeFormat("ja-JP", {
		timeZone: "Asia/Tokyo",
		month: "2-digit",
	}).format(date);
	const dd = new Intl.DateTimeFormat("ja-JP", {
		timeZone: "Asia/Tokyo",
		day: "2-digit",
	}).format(date);
	const hh = new Intl.DateTimeFormat("ja-JP", {
		timeZone: "Asia/Tokyo",
		hour: "2-digit",
		hour12: false,
	}).format(date);
	const min = new Intl.DateTimeFormat("ja-JP", {
		timeZone: "Asia/Tokyo",
		minute: "2-digit",
	}).format(date);

	return `${yyyy}/${mm}/${dd} ${hh}:${min} (JST)`;
};

const buildMessage = (title: string, pubDate: Date) => {
	return [
		`『みいちゃんと山田さん』が公開されました！`,
		"",
		"詳細情報",
		`- タイトル: ${title}`,
		`- 配信日: ${formatJstDateTime(pubDate)}`,
	].join("\n");
};

// Lambda handler
export const handler = async (
	event: EventBridgeEvent<"Scheduled Event", ScheduledEvent>,
	_: Context,
): Promise<void> => {
	const cfg = getConfigFromEnv();
	const sns = createSnsClient(cfg.region);
	const parser = new Parser();
	const feed = await parser.parseURL(RSS_URL);

	const items = feed.items;
	const yesterday = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);

	for (const item of items) {
		if (!item.pubDate) {
			continue;
		}
		const pubDate = new Date(item.pubDate);
		if (Number.isNaN(pubDate.getTime())) {
			continue;
		}

		if (pubDate > yesterday) {
			const msg = buildMessage(item.title || "タイトルなし", pubDate);
			await sendMessage(sns, cfg.topicArn, `配信予定: 『みいちゃんと山田さん』`, msg);
		}
	}
};
