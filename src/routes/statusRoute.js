const express = require("express");
const Image = require("../models/image");
const Request = require("../models/request");

const router = express.Router();

router.get("/status/:requestId", async (req, res) => {
  try {
    const { requestId } = req.params;
    console.log(`Checking status for requestId: ${requestId}`);

    const requestExists = await Request.findOne({ requestId });
    if (!requestExists) {
      console.error(`Request ID not found in Request collection: ${requestId}`);
      return res.status(404).json({ error: "Request ID not found" });
    }

    const images = await Image.find({ requestId });

    if (!images.length) {
      console.error(`No images found for requestId: ${requestId}`);
      return res.status(404).json({ error: "No images found for this request ID" });
    }

    const processedImages = images.filter(img => img.outputImages.length > 0).length;
    const totalImages = images.length;
    
    // Format response with all documents
    const responseData = images.map(img => ({
      serialNumber: img.serialNumber,
      productName: img.productName,
      inputImages: img.inputImages,
      outputImages: img.outputImages.length ? img.outputImages : ["Pending"],
      status: img.outputImages.length > 0 ? "processed" : "pending"
    }));

    res.json({
      requestId,
      totalImages,
      processedImages,
      details: responseData
    });

  } catch (error) {
    console.error("Error fetching status:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;

