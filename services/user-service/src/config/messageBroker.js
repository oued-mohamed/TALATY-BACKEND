const amqp = require('amqplib');

let connection;
let channel;

const connectMessageBroker = async () => {
  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
    channel = await connection.createChannel();
    
    // Create exchanges
    await channel.assertExchange('user_events', 'topic', { durable: true });
    
    console.log('Auth Service connected to RabbitMQ');
  } catch (error) {
    console.error('RabbitMQ connection error:', error);
    throw error;
  }
};

const getChannel = () => channel;

module.exports = { connectMessageBroker, getChannel };