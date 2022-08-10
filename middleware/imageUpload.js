const multerS3 = require('multer-s3');
const multer = require('multer');
const { s3 } = require('../data/s3');

require('dotenv').config();
const { BUCKET_NAME } = process.env;

const upload = (__dir) =>
    multer({
        storage: multerS3({
            s3: s3,
            bucket: `${BUCKET_NAME}`,
            contentType: multerS3.AUTO_CONTENT_TYPE,
            key: (req, file, cb) => {
                cb(null, `${__dir}/` + Date.now() + '.' + file.originalname.split('.').pop());
            },
        }),
        limits: {
            fieldSize: 1024 * 1024 * 10, // 최대 10MB
        },
        fileFilter: (req, file, cb) => {
            if (['image/png', 'image/jpeg', 'image/jpg', 'image/bmp'].includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new Error('Invalid File Type'));
            }
        },
    });

module.exports = { upload };
