const { Router } = require('express');

const ownerRouter = Router();

const signupRouter = require('./owner/signup');
const interviewRouter = require('./owner/interview');
const employmentRouter = require('./owner/employment');
const ownerMypageRouter = require('./owner/mypage');
const angelRouter = require('./owner/angel');
const qrCodeRouter = require('./owner/qrCode');

const pool = require('../util/function');


ownerRouter.use('/signup', signupRouter);
ownerRouter.use('/interview', interviewRouter);
ownerRouter.use('/employment', employmentRouter);
ownerRouter.use('/mypage', ownerMypageRouter);
ownerRouter.use('/angel', angelRouter);
ownerRouter.use('/qrCode', qrCodeRouter);

module.exports = ownerRouter;

/************************ function *************************/
 