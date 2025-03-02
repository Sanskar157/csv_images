const { Worker } = require("bullmq");
const Redis = require("ioredis");
const sharp = require("sharp");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const connectDB = require("../config/db");
const Image = require("../models/image");
const Request = require("../models/request");
const FormData = require("form-data");

const connection = new Redis({
  maxRetriesPerRequest: null,
});

const processImage = async (imageUrl, serialNumber) => {
  try {
    console.log(`Downloading: ${imageUrl}`);

    const processedDir = path.join(__dirname, "../processed");
    if (!fs.existsSync(processedDir)) {
      fs.mkdirSync(processedDir, { recursive: true });
    }

    const response = await axios({ url: imageUrl, responseType: "arraybuffer", timeout: 5000 });

    if (response.status !== 200) {
      console.error(`Failed to download: ${imageUrl} (Status: ${response.status})`);
      return null;
    }

    const inputBuffer = Buffer.from(response.data);
    const outputBuffer = await sharp(inputBuffer).jpeg({ quality: 50 }).toBuffer();

    const outputFilePath = path.join(
      processedDir,
      `${serialNumber}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.jpg`
    );

    fs.writeFileSync(outputFilePath, outputBuffer);

    console.log(`Image saved: ${outputFilePath}`);
    return outputFilePath;
  } catch (error) {
    console.error(`Error processing image: ${imageUrl}`, error.message);
    return null;
  }
};

const checkCompletionAndTriggerWebhook = async (requestId) => {
  try {
    const images = await Image.find({ requestId });
    const request = await Request.findOne({ requestId });

    if (!images.length || !request) return;

    const processedImages = images.filter((img) => img.outputImages.length > 0).length;
    const totalImages = images.length;

    if (processedImages !== totalImages) return;

    console.log(`Processing completed for requestId: ${requestId}`);

    const downloadsDir = path.join(__dirname, "../downloads");
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }

    // Generate CSV
    const csvFilePath = path.join(downloadsDir, `status_${requestId}.csv`);
    fs.writeFileSync(
      csvFilePath,
      `Serial Number,Product Name,Input Image Urls,Output Image Urls\n` +
        images
          .map(
            (img) =>
              `${img.serialNumber},${img.productName},"${img.inputImages.join(
                ", "
              )}","${img.outputImages.length ? img.outputImages.join(", ") : "Pending"}"`
          )
          .join("\n")
    );

    // Send Webhook Request
    if (request.webhookUrl) {
      console.log(`Sending webhook to: ${request.webhookUrl}`);

      const formData = new FormData();
      formData.append("file", fs.createReadStream(csvFilePath));

      try {
        const response = await axios.post(request.webhookUrl, formData, {
          headers: { ...formData.getHeaders() },
        });

        console.log(`Webhook sent successfully! Response: ${response.status} ${response.statusText}`);
      } catch (error) {
        console.error(`Webhook failed! Error:`, error.response?.data || error.message);
      }
    } else {
      console.warn(`No webhook URL found for requestId: ${requestId}`);
    }
  } catch (error) {
    console.error(`Error in checkCompletionAndTriggerWebhook:`, error.message);
  }
};

(async () => {
  await connectDB();

  console.log("Worker started, listening for jobs...");

  const imageWorker = new Worker(
    "image-processing",
    async (job) => {
      try {
        const { requestId, imageUrls, serialNumber, productName } = job.data;
        console.log(`Processing ${imageUrls.length} images for ${productName}`);

        const processPromises = imageUrls.map((url) => processImage(url, serialNumber));
        const processedImages = await Promise.all(processPromises);
        const successfulImages = processedImages.filter((img) => img !== null);

        console.log(`Processed Images for ${productName}:`, successfulImages);

        if (successfulImages.length > 0) {
          console.log(`🛠 Updating MongoDB for requestId=${requestId}, serialNumber=${serialNumber}`);

          const updated = await Image.findOneAndUpdate(
            { requestId, serialNumber },
            { $set: { outputImages: successfulImages, status: "completed" } },
            { new: true }
          );

          if (updated) {
            console.log(`MongoDB successfully updated:`, updated);
          } else {
            console.error(`MongoDB update failed! Document not found.`);
          }
        } else {
          console.warn(`No images processed for ${productName}, skipping MongoDB update.`);
        }

        console.log(`Completed processing for ${productName}`);

        // Check if all images are processed & trigger webhook
        await checkCompletionAndTriggerWebhook(requestId);
      } catch (error) {
        console.error(`Error in worker process:`, error);
      }
    },
    { connection, concurrency:5 }
  );
})();

console.log("Image worker is running...");
