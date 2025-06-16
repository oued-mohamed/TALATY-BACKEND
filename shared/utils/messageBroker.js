const amqp = require('amqplib');
const { EventTypes } = require('../types/events');
const logger = require('./logger');

class MessageBroker {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.exchanges = {
      EVENTS: 'business_ekyc_events',
      NOTIFICATIONS: 'business_ekyc_notifications'
    };
  }

  async connect() {
    try {
      const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost';
      this.connection = await amqp.connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();

      // Create exchanges
      await this.channel.assertExchange(this.exchanges.EVENTS, 'topic', { durable: true });
      await this.channel.assertExchange(this.exchanges.NOTIFICATIONS, 'fanout', { durable: true });

      logger.info('Connected to RabbitMQ successfully');
    } catch (error) {
      logger.error('Failed to connect to RabbitMQ:', error);
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      logger.info('Disconnected from RabbitMQ');
    } catch (error) {
      logger.error('Error disconnecting from RabbitMQ:', error);
    }
  }

  async publishEvent(eventType, data, routingKey = '') {
    try {
      if (!this.channel) {
        await this.connect();
      }

      const message = {
        eventType,
        data,
        timestamp: new Date().toISOString(),
        messageId: require('crypto').randomUUID()
      };

      const messageBuffer = Buffer.from(JSON.stringify(message));
      
      await this.channel.publish(
        this.exchanges.EVENTS,
        routingKey || eventType,
        messageBuffer,
        { persistent: true }
      );

      logger.info(`Event published: ${eventType}`, { messageId: message.messageId });
    } catch (error) {
      logger.error(`Failed to publish event ${eventType}:`, error);
      throw error;
    }
  }

  async subscribeToEvents(patterns, handler) {
    try {
      if (!this.channel) {
        await this.connect();
      }

      const queueName = `${process.env.SERVICE_NAME || 'unknown'}_events_${Date.now()}`;
      const queue = await this.channel.assertQueue(queueName, { 
        exclusive: true,
        autoDelete: true 
      });

      // Bind to multiple patterns
      for (const pattern of patterns) {
        await this.channel.bindQueue(queue.queue, this.exchanges.EVENTS, pattern);
      }

      await this.channel.consume(queue.queue, async (msg) => {
        if (msg) {
          try {
            const message = JSON.parse(msg.content.toString());
            await handler(message);
            this.channel.ack(msg);
          } catch (error) {
            logger.error('Error processing event:', error);
            this.channel.nack(msg, false, false); // Don't requeue
          }
        }
      });

      logger.info(`Subscribed to events with patterns: ${patterns.join(', ')}`);
    } catch (error) {
      logger.error('Failed to subscribe to events:', error);
      throw error;
    }
  }

  async publishNotification(notification) {
    try {
      if (!this.channel) {
        await this.connect();
      }

      const message = {
        ...notification,
        timestamp: new Date().toISOString(),
        messageId: require('crypto').randomUUID()
      };

      const messageBuffer = Buffer.from(JSON.stringify(message));
      
      await this.channel.publish(
        this.exchanges.NOTIFICATIONS,
        '',
        messageBuffer,
        { persistent: true }
      );

      logger.info('Notification published', { messageId: message.messageId });
    } catch (error) {
      logger.error('Failed to publish notification:', error);
      throw error;
    }
  }

  async subscribeToNotifications(handler) {
    try {
      if (!this.channel) {
        await this.connect();
      }

      const queueName = `${process.env.SERVICE_NAME || 'unknown'}_notifications`;
      const queue = await this.channel.assertQueue(queueName);
      
      await this.channel.bindQueue(queue.queue, this.exchanges.NOTIFICATIONS, '');

      await this.channel.consume(queue.queue, async (msg) => {
        if (msg) {
          try {
            const notification = JSON.parse(msg.content.toString());
            await handler(notification);
            this.channel.ack(msg);
          } catch (error) {
            logger.error('Error processing notification:', error);
            this.channel.nack(msg, false, true); // Requeue for retry
          }
        }
      });

      logger.info('Subscribed to notifications');
    } catch (error) {
      logger.error('Failed to subscribe to notifications:', error);
      throw error;
    }
  }

  // Convenience methods for common events
  async publishUserEvent(eventType, userId, data = {}) {
    await this.publishEvent(eventType, { userId, ...data }, `user.${userId}`);
  }

  async publishDocumentEvent(eventType, userId, documentId, data = {}) {
    await this.publishEvent(eventType, { userId, documentId, ...data }, `document.${userId}`);
  }

  async publishKycEvent(eventType, userId, kycId, data = {}) {
    await this.publishEvent(eventType, { userId, kycId, ...data }, `kyc.${userId}`);
  }
}

module.exports = new MessageBroker();