const { App } = require('@slack/bolt');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: false, // Disable socket mode for Render hosting
  port: process.env.PORT || 3000,
});

const activeTimers = new Map();

// Helper function to update the channel topic
async function updateChannelTopic(channelId, newTopic) {
  await app.client.conversations.setTopic({
    channel: channelId,
    topic: newTopic,
  });
}

// Function to start a timer for intelligence-ui PR
async function startTimer(channelId, prNumber, duration, username) {
  const timerId = setTimeout(async () => {
    // Notify when the timer expires
    await app.client.chat.postMessage({
      channel: channelId,
      text: `🚨 Timer expired for ${username} - int-ui PR#${prNumber}. The environment is now free.`,
    });

    // Update the channel topic to remove the PR entry
    const currentTopic = (await app.client.conversations.info({ channel: channelId })).channel.topic.value;
    const updatedTopic = currentTopic.replace(`@${username} - int-ui PR#${prNumber}`, '').trim();
    await updateChannelTopic(channelId, updatedTopic);

    activeTimers.delete(prNumber);
  }, duration * 60 * 1000);

  activeTimers.set(prNumber, timerId);
}

// Listen for deployment messages
app.message(async ({ message, say }) => {
  const { text, channel } = message;

  // Check if the message is a deployment for intelligence-ui
  const match = text.match(/intelligence-ui #(\d+)/);
  if (match) {
    const prNumber = match[1];
    const username = message.user;

    // Get the current channel topic
    const topic = (await app.client.conversations.info({ channel })).channel.topic.value;
    const prMatch = new RegExp(`@${username} - int-ui PR#${prNumber} \\| (\\d+)m`);
    const durationMatch = topic.match(prMatch);

    if (durationMatch) {
      const duration = parseInt(durationMatch[1]);

      // Start the timer
      await say(`🕒 Timer started for ${username} - int-ui PR#${prNumber} for ${duration} minutes.`);
      startTimer(channel, prNumber, duration, username);
    }
  }
});

// Start the app
(async () => {
  await app.start();
  console.log('⚡️ Slack bot is running on Render!');
})();
