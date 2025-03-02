const { Queue } = require("bullmq");
const Redis = require("ioredis");

const connection = new Redis(); 

const imageQueue = new Queue("image-processing", { connection });

module.exports = imageQueue;
