This project provides an asynchronous image processing system using Node.js, MongoDB, Redis (BullMQ). It consists of:

A REST API server to handle image processing requests.
A Worker server to process images asynchronously using BullMQ.
Redis for job queuing and caching.


**Steps to run the project**

1. Clone the repository
2. npm install
3. Set up .env file, with PORT and MONGO_URI
4. Ensure that redis is running locally
5. Start the api server (command => node src/index.js)
6. Start the worker server (command => node src/workers/imageWorkers.js)
   
