const aws = require('aws-sdk');
require('dotenv').config();
const { S3_ACCESS, S3_SECRET, BUCKET_NAME, REGION } = process.env;
/*
 * PROFILE IMAGE STORING STARTS
 */
const s3 = new aws.S3({
    accessKeyId: S3_ACCESS,
    secretAccessKey: S3_SECRET,
    Bucket: BUCKET_NAME,
    region: REGION,
});

module.exports = { s3 };
