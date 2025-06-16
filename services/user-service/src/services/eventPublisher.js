const { getChannel } = require('../config/messageBroker');

const publishEvent = async (eventType, data) => {
  try {
    const channel = getChannel();
    if (!channel) {
      console.error('Message broker channel not available');
      return;
    }

    const message = {
      eventType,
      data,
      timestamp: new Date().toISOString(),
      service: 'auth-service'
    };

    await channel.publish(
      'user_events',
      eventType,
      Buffer.from(JSON.stringify(message)),
      { persistent: true }
    );

    console.log(`Event published: ${eventType}`);
  } catch (error) {
    console.error('Error publishing event:', error);
  }
};

module.exports = { publishEvent };