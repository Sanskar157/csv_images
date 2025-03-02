const express = require("express");
const multer = require("multer");
const csvParser = require("csv-parser");
const { v4: uuidv4 } = require("uuid");
const Request = require("../models/request");
const Image = require("../models/image");
const stream = require("stream");
const { z } = require("zod");
const imageQueue = require("../queue/imageQueue");

const router = express.Router();
const upload = multer({ limits: { fileSize: 2 * 1024 * 1024 } }); // 2MB file limit

// Zod Schema for CSV Row Validation
const csvRowSchema = z.object({
  "Serial Number": z
    .string()
    .transform(Number)
    .refine((n) => !isNaN(n), {
      message: "Serial Number must be a number",
    }),
  "Product Name": z.string().min(1, "Product Name is required"),
  "Input Image Urls": z.string().min(1, "At least one image URL is required"),
});

// api for uploading csv
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "CSV file is required" });
    }

    const { webhook } = req.query;
    if (!webhook) {
      return res.status(400).json({ error: "Webhook URL is required" });
    }

    const requestId = uuidv4();
    await Request.create({ requestId, status: "pending", webhookUrl: webhook });

    const images = [];
    const csvContent = req.file.buffer.toString().split("\n").slice(1);

    for (const line of csvContent) {
      if (!line.trim()) continue;

      const columns = line.split(",");
      if (columns.length < 3) continue;

      const rowData = {
        "Serial Number": columns[0].trim(),
        "Product Name": columns[1].trim(),
        "Input Image Urls": columns.slice(2).join(",").trim(),
      };

      const parsed = csvRowSchema.safeParse(rowData);
      if (!parsed.success) {
        console.error(`Invalid row:`, parsed.error.format());
        continue;
      }

      const { "Serial Number": serialNumber, "Product Name": productName, "Input Image Urls": inputImages } = parsed.data;
      images.push({
        requestId,
        serialNumber,
        productName,
        inputImages: inputImages.split(",").map(url => url.trim()),
        status: "pending",
      });
    }

    await Image.insertMany(images);

    for (const image of images) {
      await imageQueue.add("process-image", {
        requestId: image.requestId,
        imageUrls: image.inputImages,
        serialNumber: image.serialNumber,
        productName: image.productName,
      });
    }

    res.json({
      requestId,
      message: "File uploaded and processing started",
    });

  } catch (error) {
    console.error("Upload Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


module.exports = router;
